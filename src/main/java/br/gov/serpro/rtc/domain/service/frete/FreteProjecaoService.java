package br.gov.serpro.rtc.domain.service.frete;

import static java.math.BigDecimal.ZERO;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.AnoProjecao;
import br.gov.serpro.rtc.api.model.frete.FreteProjecaoInput;
import br.gov.serpro.rtc.api.model.frete.FreteProjecaoOutput;
import br.gov.serpro.rtc.api.model.frete.NotaEtapa;
import br.gov.serpro.rtc.api.model.frete.ParametrosTransicaoAno;
import br.gov.serpro.rtc.api.model.frete.ResumoProjecao;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import br.gov.serpro.rtc.domain.model.enumeration.PeriodicidadeFrete;
import br.gov.serpro.rtc.domain.model.enumeration.RegimePisCofins;
import br.gov.serpro.rtc.domain.model.enumeration.TipoOperacaoFrete;
import br.gov.serpro.rtc.domain.service.MunicipioService;
import br.gov.serpro.rtc.domain.service.VersaoBaseDadosService;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Projeta a carga tributária incidente sobre uma operação de frete ao longo da
 * transição da reforma tributária do consumo.
 *
 * <p>O valor informado corresponde a um dia útil, a uma quinzena ou a um mês, e é
 * convertido em valor por dia útil e, de volta, no valor do período de cada ano —
 * a quantidade de dias úteis do mesmo mês muda de um ano para o outro.</p>
 *
 * <p>O IBS e a CBS de cada ano são calculados pela própria calculadora do regime
 * geral, com o mesmo item de CT-e (cClassTrib 000001, CST 000) usado pela API
 * oficial, garantindo aderência à base de dados. Os tributos do regime anterior
 * (ICMS, PIS, COFINS e ISS) são compostos com as alíquotas informadas e
 * reduzidos conforme o cronograma de extinção da LC 214/2025.</p>
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class FreteProjecaoService {

    private static final BigDecimal CEM = new BigDecimal("100");
    private static final int ESCOPO_CALCULO = 6;
    private static final NumberFormat MOEDA_BR = NumberFormat.getCurrencyInstance(Locale.of("pt", "BR"));
    private static final long MUNICIPIO_PADRAO = 4314902L;

    private final IbsCbsFreteService ibsCbsFreteService;
    private final MunicipioService municipioService;
    private final TransicaoTributariaService transicaoTributariaService;
    private final FreteCatalogoService freteCatalogoService;
    private final DiasUteisService diasUteisService;
    private final IcmsInterestadualService icmsInterestadualService;
    private final VersaoBaseDadosService versaoBaseDadosService;

    /**
     * Executa a projeção anual da carga tributária do frete.
     *
     * @param entrada valor do frete no período, serviço, local, periodicidade e
     *                alíquotas do regime anterior
     * @return série anual de tributos, notas por etapa, parâmetros e resumo
     */
    public FreteProjecaoOutput projetar(FreteProjecaoInput entrada) {
        if (entrada == null || entrada.getValorFrete() == null) {
            throw new CampoInvalidoException("Informe o valor do frete para a simulação.");
        }

        final BigDecimal valorInformado = escala2(entrada.getValorFrete());
        final PeriodicidadeFrete periodicidade = PeriodicidadeFrete.from(entrada.getPeriodicidade());
        final int mesReferencia = entrada.getMesReferencia() != null
            ? entrada.getMesReferencia()
            : LocalDate.now().getMonthValue();
        final TipoOperacaoFrete tipoOperacao = TipoOperacaoFrete.from(entrada.getTipoOperacao());
        final RegimePisCofins regime = RegimePisCofins.from(entrada.getRegimePisCofins());
        final String nbs = normalizarNbs(entrada.getNbs());

        final String ufOrigem = normalizarUf(entrada.getUfOrigem());
        final String ufDestino = normalizarUf(entrada.getUfDestino());

        final Long municipio;
        final String ufOperacao;

        if (entrada.getMunicipio() != null) {
            municipio = entrada.getMunicipio();
            ufOperacao = resolverUf(municipio, entrada.getUf());
        } else if (ufDestino != null) {
            municipio = icmsInterestadualService.capitalDe(ufDestino);
            ufOperacao = ufDestino;
        } else if (entrada.getUf() != null && !entrada.getUf().isBlank()) {
            ufOperacao = normalizarUf(entrada.getUf());
            municipio = icmsInterestadualService.capitalDe(ufOperacao);
        } else {
            municipio = MUNICIPIO_PADRAO;
            ufOperacao = municipioService.buscarUfPorMunicipio(municipio);
        }

        final BigDecimal aliquotaIcms = resolverAliquotaIcms(entrada, tipoOperacao, ufOrigem, ufDestino);
        final BigDecimal aliquotaIss = defaultSeNulo(entrada.getAliquotaIss(), tipoOperacao.getAliquotaIssPadrao());
        final boolean incluirMemoria = Boolean.TRUE.equals(entrada.getIncluirMemoriaCalculo());

        final int diasReferencia = diasUteisService.diasUteisDoPeriodo(
            TransicaoTributariaService.ANO_REFERENCIA, mesReferencia, periodicidade);
        final BigDecimal valorDiario = escala2(valorInformado.divide(
            BigDecimal.valueOf(diasReferencia), ESCOPO_CALCULO, RoundingMode.HALF_UP));

        final List<ParametrosTransicaoAno> tabela =
            transicaoTributariaService.montarTabela(entrada.getParametrosTransicao());

        final List<AnoProjecao> anos = new ArrayList<>();
        anos.add(anoDeReferencia(valorInformado, diasReferencia, valorDiario, tipoOperacao, regime,
            aliquotaIcms, aliquotaIss));

        for (ParametrosTransicaoAno parametros : tabela) {
            final int dias = diasUteisService.diasUteisDoPeriodo(parametros.getAno(), mesReferencia, periodicidade);
            final BigDecimal valorPeriodo = escalarPorDias(valorInformado, dias, diasReferencia);

            anos.add(projetarAno(parametros, valorPeriodo, valorDiario, dias, tipoOperacao, regime,
                aliquotaIcms, aliquotaIss, nbs, municipio, ufOperacao, incluirMemoria));
        }

        final AnoProjecao referencia = anos.getFirst();
        aplicarVariacoes(anos, referencia);

        final List<NotaEtapa> notas = montarNotas(anos, referencia, tipoOperacao, regime);

        return FreteProjecaoOutput.builder()
                .valorFrete(valorInformado)
                .periodicidade(periodicidade.name())
                .mesReferencia(mesReferencia)
                .diasUteisReferencia(diasReferencia)
                .valorFreteDiario(valorDiario)
                .nbs(nbs)
                .descricaoNbs(freteCatalogoService.descrever(nbs, LocalDate.of(TransicaoTributariaService.ANO_FINAL, 1, 1)))
                .municipio(municipio)
                .uf(ufOperacao)
                .tipoOperacao(tipoOperacao.name())
                .regimePisCofins(regime.name())
                .aliquotaIcms(aliquotaIcms)
                .aliquotaIss(aliquotaIss)
                .anos(anos)
                .parametros(tabela)
                .resumo(resumir(anos, referencia))
                .notasEtapa(notas)
                .avisos(avisos(tipoOperacao, regime, periodicidade, mesReferencia, diasReferencia, ufOrigem, ufDestino))
                .versaoBaseDados(versaoBaseDados())
                .geradoEm(OffsetDateTime.now())
                .build();
    }

    /**
     * Converte o valor do período do ano de referência no valor do mesmo período em
     * outro ano, mantendo o preço por dia útil.
     */
    private BigDecimal escalarPorDias(BigDecimal valorInformado, int dias, int diasReferencia) {
        return escala2(valorInformado
            .multiply(BigDecimal.valueOf(dias))
            .divide(BigDecimal.valueOf(diasReferencia), ESCOPO_CALCULO, RoundingMode.HALF_UP));
    }

    private AnoProjecao anoDeReferencia(BigDecimal valorPeriodo, int dias, BigDecimal valorDiario,
            TipoOperacaoFrete tipo, RegimePisCofins regime, BigDecimal aliquotaIcms, BigDecimal aliquotaIss) {

        final BigDecimal pis = percentualDe(valorPeriodo, regime.getAliquotaPis());
        final BigDecimal cofins = percentualDe(valorPeriodo, regime.getAliquotaCofins());
        final BigDecimal icms = percentualDe(valorPeriodo, aliquotaIcms);
        final BigDecimal iss = percentualDe(valorPeriodo, aliquotaIss);
        final BigDecimal total = escala2(pis.add(cofins).add(icms).add(iss));

        return AnoProjecao.builder()
                .ano(TransicaoTributariaService.ANO_REFERENCIA)
                .rotulo(FaseTransicao.REFERENCIA.getRotulo())
                .fase(FaseTransicao.REFERENCIA)
                .diasUteis(dias)
                .valorFretePeriodo(valorPeriodo)
                .valorFreteDiario(valorDiario)
                .percentualCbs(ZERO)
                .percentualIbsUf(ZERO)
                .percentualIbsMun(ZERO)
                .percentualIcms(escala4(aliquotaIcms))
                .percentualPis(escala4(regime.getAliquotaPis()))
                .percentualCofins(escala4(regime.getAliquotaCofins()))
                .percentualIss(escala4(aliquotaIss))
                .valorCbs(ZERO)
                .valorIbsUf(ZERO)
                .valorIbsMun(ZERO)
                .valorIcms(icms)
                .valorPis(pis)
                .valorCofins(cofins)
                .valorIss(iss)
                .totalDestacado(total)
                .totalEfetivo(total)
                .percentualTotal(percentualDeTotal(total, valorPeriodo))
                .observacao(tipo == TipoOperacaoFrete.MUNICIPAL
                    ? "Regime anterior: ISS sobre o frete municipal."
                    : "Regime anterior: ICMS, PIS e COFINS sobre o frete.")
                .build();
    }

    private AnoProjecao projetarAno(ParametrosTransicaoAno parametros, BigDecimal valorPeriodo,
            BigDecimal valorDiario, int dias, TipoOperacaoFrete tipo, RegimePisCofins regime,
            BigDecimal aliquotaIcms, BigDecimal aliquotaIss, String nbs, Long municipio, String uf,
            boolean incluirMemoria) {

        final int ano = parametros.getAno();
        final IbsCbsFreteService.ResultadoIbsCbs calculo = ibsCbsFreteService.calcular(
            ano, valorPeriodo, 6, nbs, municipio, uf,
            parametros.getCbs(), parametros.getIbsUf(), parametros.getIbsMun());

        final BigDecimal fatorReducao = BigDecimal.ONE.subtract(
            dividir(parametros.getReducaoIcmsIss() != null ? parametros.getReducaoIcmsIss() : ZERO, CEM, ESCOPO_CALCULO));

        final BigDecimal icms = percentualDe(valorPeriodo, aliquotaIcms.multiply(fatorReducao));
        final BigDecimal iss = percentualDe(valorPeriodo, aliquotaIss.multiply(fatorReducao));

        final boolean incidemPisCofins = ano <= TransicaoTributariaService.ANO_INICIAL;
        final BigDecimal pis = incidemPisCofins ? percentualDe(valorPeriodo, regime.getAliquotaPis()) : ZERO;
        final BigDecimal cofins = incidemPisCofins ? percentualDe(valorPeriodo, regime.getAliquotaCofins()) : ZERO;

        final BigDecimal totalDestacado = escala2(
            calculo.cbs().add(calculo.ibsUf()).add(calculo.ibsMun()).add(icms).add(pis).add(cofins).add(iss));

        final boolean compensacaoFaseTeste = parametros.getFase() == FaseTransicao.TESTE;
        final BigDecimal totalEfetivo = compensacaoFaseTeste
            ? escala2(totalDestacado.subtract(calculo.cbs()).subtract(calculo.ibsUf()).subtract(calculo.ibsMun()))
            : totalDestacado;

        return AnoProjecao.builder()
                .ano(ano)
                .rotulo(parametros.getRotulo())
                .fase(parametros.getFase())
                .diasUteis(dias)
                .valorFretePeriodo(valorPeriodo)
                .valorFreteDiario(valorDiario)
                .percentualCbs(calculo.percentualCbs())
                .percentualIbsUf(calculo.percentualIbsUf())
                .percentualIbsMun(calculo.percentualIbsMun())
                .percentualIcms(escala4(aliquotaIcms.multiply(fatorReducao)))
                .percentualPis(escala4(incidemPisCofins ? regime.getAliquotaPis() : ZERO))
                .percentualCofins(escala4(incidemPisCofins ? regime.getAliquotaCofins() : ZERO))
                .percentualIss(escala4(aliquotaIss.multiply(fatorReducao)))
                .valorCbs(calculo.cbs())
                .valorIbsUf(calculo.ibsUf())
                .valorIbsMun(calculo.ibsMun())
                .valorIcms(icms)
                .valorPis(pis)
                .valorCofins(cofins)
                .valorIss(iss)
                .totalDestacado(totalDestacado)
                .totalEfetivo(totalEfetivo)
                .percentualTotal(percentualDeTotal(totalEfetivo, valorPeriodo))
                .observacao(observacao(parametros, tipo))
                .memoriaCalculo(incluirMemoria ? calculo.memoria() : null)
                .build();
    }

    private String observacao(ParametrosTransicaoAno parametros, TipoOperacaoFrete tipo) {
        return switch (parametros.getFase()) {
            case TESTE -> "Fase de teste: CBS e IBS destacados são compensáveis com PIS/COFINS e ICMS.";
            case CBS_PLENA -> "PIS/COFINS extintos; CBS integral e IBS ainda em 0,10%.";
            case TRANSICAO_IBS -> "IBS em " + formatar(parametros.getIbsUf().add(parametros.getIbsMun()))
                + "% (UF " + formatar(parametros.getIbsUf()) + "% + município " + formatar(parametros.getIbsMun())
                + "%) e ICMS/ISS reduzidos em " + formatar(parametros.getReducaoIcmsIss()) + "%.";
            case REGIME_PLENO -> tipo == TipoOperacaoFrete.MUNICIPAL
                ? "Regime pleno: ISS extinto; CBS e IBS integrais."
                : "Regime pleno: ICMS extinto; CBS e IBS integrais.";
            default -> null;
        };
    }

    private void aplicarVariacoes(List<AnoProjecao> anos, AnoProjecao referencia) {
        final BigDecimal percentualReferencia = referencia.getPercentualTotal();

        for (int i = 0; i < anos.size(); i++) {
            final AnoProjecao ano = anos.get(i);

            final BigDecimal diferenca = escala2(ano.getTotalEfetivo().subtract(referencia.getTotalEfetivo()));
            final BigDecimal pontos = escala2(ano.getPercentualTotal().subtract(percentualReferencia));
            final BigDecimal relativa = referencia.getTotalEfetivo().signum() == 0
                ? ZERO
                : escala2(diferenca.multiply(CEM).divide(referencia.getTotalEfetivo(), ESCOPO_CALCULO, RoundingMode.HALF_UP));

            ano.setVariacaoAbsoluta(diferenca);
            ano.setVariacaoPontosPercentuais(pontos);
            ano.setVariacaoRelativa(relativa);

            if (i == 0) {
                ano.setVariacaoAnoAnteriorAbsoluta(ZERO);
                ano.setVariacaoAnoAnteriorPontosPercentuais(ZERO);
                ano.setVariacaoAnoAnteriorRelativa(ZERO);
                continue;
            }

            final AnoProjecao anterior = anos.get(i - 1);
            final BigDecimal variacaoAbsoluta = escala2(ano.getTotalEfetivo().subtract(anterior.getTotalEfetivo()));

            ano.setVariacaoAnoAnteriorAbsoluta(variacaoAbsoluta);
            ano.setVariacaoAnoAnteriorPontosPercentuais(
                escala2(ano.getPercentualTotal().subtract(anterior.getPercentualTotal())));
            ano.setVariacaoAnoAnteriorRelativa(anterior.getTotalEfetivo().signum() == 0
                ? ZERO
                : escala2(variacaoAbsoluta.multiply(CEM)
                    .divide(anterior.getTotalEfetivo(), ESCOPO_CALCULO, RoundingMode.HALF_UP)));
        }
    }

    private ResumoProjecao resumir(List<AnoProjecao> anos, AnoProjecao referencia) {
        final List<AnoProjecao> reforma = anos.stream()
                .filter(a -> a.getFase() != FaseTransicao.REFERENCIA)
                .toList();

        final AnoProjecao pleno = reforma.stream()
                .filter(a -> a.getFase() == FaseTransicao.REGIME_PLENO)
                .findFirst()
                .orElse(reforma.getLast());

        final AnoProjecao maior = reforma.stream()
                .max(Comparator.comparing(AnoProjecao::getTotalEfetivo))
                .orElse(pleno);

        final BigDecimal cargaMedia = escala2(
            reforma.stream()
                .map(AnoProjecao::getTotalEfetivo)
                .reduce(ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(reforma.size()), ESCOPO_CALCULO, RoundingMode.HALF_UP));

        final Integer primeiroAumento = anos.stream()
                .filter(a -> a.getFase() != FaseTransicao.REFERENCIA)
                .filter(a -> a.getPercentualTotal().compareTo(referencia.getPercentualTotal()) > 0)
                .map(AnoProjecao::getAno)
                .findFirst()
                .orElse(null);

        final BigDecimal diferenca = escala2(pleno.getTotalEfetivo().subtract(referencia.getTotalEfetivo()));

        return ResumoProjecao.builder()
                .anoReferencia(referencia.getAno())
                .cargaReferencia(referencia.getTotalEfetivo())
                .percentualReferencia(referencia.getPercentualTotal())
                .anoRegimePleno(pleno.getAno())
                .cargaRegimePleno(pleno.getTotalEfetivo())
                .percentualRegimePleno(pleno.getPercentualTotal())
                .diferencaAbsoluta(diferenca)
                .diferencaPontosPercentuais(escala2(pleno.getPercentualTotal().subtract(referencia.getPercentualTotal())))
                .variacaoRelativa(referencia.getTotalEfetivo().signum() == 0
                    ? ZERO
                    : escala2(diferenca.multiply(CEM).divide(referencia.getTotalEfetivo(), ESCOPO_CALCULO, RoundingMode.HALF_UP)))
                .anoPrimeiroAumento(primeiroAumento)
                .anoMaiorCarga(maior.getAno())
                .maiorCarga(maior.getTotalEfetivo())
                .cargaMediaAnual(cargaMedia)
                .build();
    }

    /**
     * Monta os blocos de notação de cada etapa, comparando com o ano anterior e com
     * o método de tributação vigente antes da reforma.
     */
    private List<NotaEtapa> montarNotas(List<AnoProjecao> anos, AnoProjecao referencia,
            TipoOperacaoFrete tipo, RegimePisCofins regime) {

        final List<NotaEtapa> notas = new ArrayList<>();

        for (int i = 1; i < anos.size(); i++) {
            final AnoProjecao anterior = anos.get(i - 1);
            final AnoProjecao atual = anos.get(i);

            final BigDecimal efeito = escala2(atual.getTotalEfetivo().subtract(anterior.getTotalEfetivo()));
            final BigDecimal efeitoPontos = escala2(atual.getPercentualTotal().subtract(anterior.getPercentualTotal()));
            final BigDecimal efeitoRelativo = anterior.getTotalEfetivo().signum() == 0
                ? ZERO
                : escala2(efeito.multiply(CEM).divide(anterior.getTotalEfetivo(), ESCOPO_CALCULO, RoundingMode.HALF_UP));

            notas.add(NotaEtapa.builder()
                    .ano(atual.getAno())
                    .rotulo(atual.getRotulo())
                    .fase(atual.getFase())
                    .resumo(resumoEtapa(anterior, atual, efeito, efeitoPontos))
                    .mudancas(mudancas(anterior, atual))
                    .comparacaoMetodoAnterior(comparacaoMetodoAnterior(atual, anterior, referencia, tipo, regime))
                    .efeitoAbsoluto(efeito)
                    .efeitoPontosPercentuais(efeitoPontos)
                    .efeitoRelativo(efeitoRelativo)
                    .fundamento(fundamento(atual.getFase()))
                    .build());
        }

        return notas;
    }

    private String resumoEtapa(AnoProjecao anterior, AnoProjecao atual, BigDecimal efeito, BigDecimal efeitoPontos) {
        final String inicio = "De " + moeda(anterior.getTotalEfetivo()) + " em " + anterior.getAno()
            + " para " + moeda(atual.getTotalEfetivo()) + " em " + atual.getAno();

        if (efeito.signum() == 0 && efeitoPontos.signum() == 0) {
            return "Carga estável em " + moeda(atual.getTotalEfetivo()) + " ("
                + formatar(atual.getPercentualTotal()) + "% do frete): nenhuma alíquota muda em relação a "
                + anterior.getAno() + ".";
        }

        if (efeitoPontos.signum() == 0) {
            return inicio + ": variação de " + moedaSinal(efeito)
                + " apenas pela quantidade de dias úteis (alíquotas inalteradas).";
        }

        final String sentido = efeito.signum() > 0 ? "aumento" : "redução";
        return inicio + ": " + sentido + " de " + moedaSinal(efeito) + " ("
            + formatar(efeitoPontos.abs()) + " p.p.).";
    }

    /**
     * Lista, tributo a tributo, o que entrou, saiu ou mudou de alíquota, e explica
     * a variação do valor do período quando a quantidade de dias úteis muda.
     */
    private List<String> mudancas(AnoProjecao anterior, AnoProjecao atual) {
        final List<String> mudancas = new ArrayList<>();

        if (nuloParaZero(anterior.getValorFretePeriodo()).compareTo(nuloParaZero(atual.getValorFretePeriodo())) != 0) {
            mudancas.add("Valor do frete no período: " + moeda(anterior.getValorFretePeriodo()) + " em "
                + anterior.getAno() + " para " + moeda(atual.getValorFretePeriodo()) + " em " + atual.getAno()
                + " (" + atual.getDiasUteis() + " dias úteis contra " + anterior.getDiasUteis()
                + "), mantendo o preço por dia útil em " + moeda(atual.getValorFreteDiario()) + ".");
        }

        compararTributo(mudancas, "CBS", anterior.getPercentualCbs(), atual.getPercentualCbs(),
            anterior.getValorCbs(), atual.getValorCbs());
        compararTributo(mudancas, "IBS UF", anterior.getPercentualIbsUf(), atual.getPercentualIbsUf(),
            anterior.getValorIbsUf(), atual.getValorIbsUf());
        compararTributo(mudancas, "IBS município", anterior.getPercentualIbsMun(), atual.getPercentualIbsMun(),
            anterior.getValorIbsMun(), atual.getValorIbsMun());
        compararTributo(mudancas, "ICMS", anterior.getPercentualIcms(), atual.getPercentualIcms(),
            anterior.getValorIcms(), atual.getValorIcms());
        compararTributo(mudancas, "PIS", anterior.getPercentualPis(), atual.getPercentualPis(),
            anterior.getValorPis(), atual.getValorPis());
        compararTributo(mudancas, "COFINS", anterior.getPercentualCofins(), atual.getPercentualCofins(),
            anterior.getValorCofins(), atual.getValorCofins());
        compararTributo(mudancas, "ISS", anterior.getPercentualIss(), atual.getPercentualIss(),
            anterior.getValorIss(), atual.getValorIss());

        if (atual.getFase() == FaseTransicao.TESTE) {
            mudancas.add("CBS e IBS de 2026 são compensáveis com PIS/COFINS e ICMS: a carga efetiva não se altera.");
        }
        if (mudancas.isEmpty()) {
            mudancas.add("Nenhuma alíquota muda neste ano e o valor do período é o mesmo.");
        }
        return mudancas;
    }

    private void compararTributo(List<String> mudancas, String nome, BigDecimal percentualAnterior,
            BigDecimal percentualAtual, BigDecimal valorAnterior, BigDecimal valorAtual) {

        final BigDecimal pAnterior = nuloParaZero(percentualAnterior);
        final BigDecimal pAtual = nuloParaZero(percentualAtual);
        final BigDecimal vAnterior = nuloParaZero(valorAnterior);
        final BigDecimal vAtual = nuloParaZero(valorAtual);

        if (vAnterior.signum() == 0 && vAtual.signum() == 0) {
            return;
        }
        if (pAnterior.signum() == 0 && pAtual.signum() > 0) {
            mudancas.add("Entra " + nome + " de " + formatar(pAtual) + "%: " + moeda(vAtual) + ".");
            return;
        }
        if (pAnterior.signum() > 0 && pAtual.signum() == 0) {
            mudancas.add("Sai " + nome + " de " + formatar(pAnterior) + "%: deixa de ser cobrado "
                + moeda(vAnterior) + ".");
            return;
        }
        if (pAnterior.compareTo(pAtual) == 0) {
            if (vAnterior.compareTo(vAtual) != 0) {
                mudancas.add(nome + " mantém " + formatar(pAtual) + "%, mas o valor passa de "
                    + moeda(vAnterior) + " para " + moeda(vAtual) + ".");
            }
            return;
        }
        mudancas.add(nome + " passa de " + formatar(pAnterior) + "% (" + moeda(vAnterior) + ") para "
            + formatar(pAtual) + "% (" + moeda(vAtual) + ").");
    }

    private String comparacaoMetodoAnterior(AnoProjecao atual, AnoProjecao anterior, AnoProjecao referencia,
            TipoOperacaoFrete tipo, RegimePisCofins regime) {

        final boolean municipal = tipo == TipoOperacaoFrete.MUNICIPAL;

        final BigDecimal legadoPercentual = municipal
            ? nuloParaZero(referencia.getPercentualIss())
            : nuloParaZero(referencia.getPercentualIcms());
        final BigDecimal atualPercentual = municipal
            ? nuloParaZero(atual.getPercentualIss())
            : nuloParaZero(atual.getPercentualIcms());

        final String tributoLegado = municipal ? "ISS" : "ICMS";
        final String legado = tributoLegado + " de " + formatar(legadoPercentual) + "% + PIS/COFINS de "
            + formatar(regime.getAliquotaTotal()) + "%";

        final String antigo = "No método anterior (2025) o frete pagava " + legado + ", equivalentes a "
            + moeda(referencia.getTotalEfetivo()) + " (" + formatar(referencia.getPercentualTotal()) + "% do frete).";

        final BigDecimal reducao = reducaoPercentual(legadoPercentual, atualPercentual);
        final BigDecimal ibsDoAno = nuloParaZero(atual.getPercentualIbsUf()).add(nuloParaZero(atual.getPercentualIbsMun()));
        final boolean anoDaSubstituicao = anterior == null || anterior.getFase() != atual.getFase();

        return switch (atual.getFase()) {
            case REFERENCIA -> antigo;
            case TESTE -> antigo + " Em 2026 o desenho é o mesmo: a CBS de 0,90% e o IBS de 0,10% são"
                + " destacados como teste e compensados com PIS/COFINS e ICMS, sem alterar a carga.";
            case CBS_PLENA -> anoDaSubstituicao
                ? antigo + " Em " + atual.getAno() + " o PIS/COFINS sai e a CBS entra integral (8,40%),"
                    + " mas o " + tributoLegado + " continua sendo cobrado: o frete paga CBS e "
                    + tributoLegado + " ao mesmo tempo até 2028, situação que não existia no método antigo."
                : antigo + " Em " + atual.getAno() + " a CBS segue em 8,40% e o PIS/COFINS já foi extinto em"
                    + " 2027; o " + tributoLegado + " continua integral, então só os dias úteis alteram o valor"
                    + " do período.";
            case TRANSICAO_IBS -> antigo + " Em " + atual.getAno() + " o IBS entra em " + formatar(ibsDoAno)
                + "% e o " + tributoLegado + " cai " + formatar(reducao) + "% (de " + formatar(legadoPercentual)
                + "% para " + formatar(atualPercentual) + "%): a carga total fica próxima da anterior, mas o"
                + " tributo passa a ser compartilhado entre União (CBS), estado e município (IBS) e o crédito"
                + " deixa de depender de regras estaduais.";
            case REGIME_PLENO -> antigo + " No regime pleno o " + tributoLegado + " deixa de existir e a carga"
                + " passa a ser CBS " + formatar(nuloParaZero(atual.getPercentualCbs())) + "% + IBS "
                + formatar(ibsDoAno) + "% = " + formatar(atual.getPercentualTotal()) + "% do frete, sem os"
                + " tributos antigos.";
        };
    }

    /**
     * Redução percentual da alíquota do tributo legado entre o ano de referência e
     * o ano corrente.
     */
    private BigDecimal reducaoPercentual(BigDecimal legado, BigDecimal atual) {
        if (legado == null || legado.signum() == 0) {
            return ZERO;
        }
        return escala2(CEM.subtract(nuloParaZero(atual).multiply(CEM)
            .divide(legado, ESCOPO_CALCULO, RoundingMode.HALF_UP)));
    }

    private String fundamento(FaseTransicao fase) {
        return switch (fase) {
            case TESTE -> "ADCT (EC 132/2023), art. 125 — ano de teste: CBS 0,90% e IBS 0,10%.";
            case CBS_PLENA -> "ADCT (EC 132/2023) e LC 214/2025 — extinção do PIS/COFINS e CBS integral a partir de 2027.";
            case TRANSICAO_IBS -> "ADCT (EC 132/2023), art. 128 — redução anual do ICMS/ISS e entrada progressiva do IBS.";
            case REGIME_PLENO -> "ADCT (EC 132/2023), arts. 128 e 129 — ICMS e ISS extintos; CBS e IBS integrais.";
            default -> null;
        };
    }

    private List<String> avisos(TipoOperacaoFrete tipo, RegimePisCofins regime, PeriodicidadeFrete periodicidade,
            int mesReferencia, int diasReferencia, String ufOrigem, String ufDestino) {

        final List<String> avisos = new ArrayList<>();

        avisos.add("O transporte de cargas é tributado integralmente pelo IBS e pela CBS "
            + "(cClassTrib 000001), sem redução de alíquota.");

        avisos.add("Período: " + periodicidade.getRotulo().toLowerCase() + " · mês de referência "
            + mesReferencia + "/" + TransicaoTributariaService.ANO_REFERENCIA + " com " + diasReferencia
            + " dias úteis. Contam-se apenas dias úteis (segunda a sexta), sem feriados; como a quantidade"
            + " de dias úteis muda de ano para ano, o valor do período também muda.");

        if (tipo == TipoOperacaoFrete.INTERESTADUAL && ufOrigem != null && ufDestino != null) {
            avisos.add("ICMS interestadual de " + ufOrigem + " para " + ufDestino
                + " conforme a Resolução do Senado Federal nº 22/1989 (7% ou 12%).");
        } else if (tipo == TipoOperacaoFrete.MUNICIPAL) {
            avisos.add("Operação municipal: o ISS substitui o ICMS no regime anterior.");
        } else {
            avisos.add("A alíquota de ICMS considerada é a do tipo de operação informado, "
                + "sem benefícios fiscais estaduais.");
        }

        avisos.add("Não estão modelados o ICMS de 4% para mercadorias importadas (Resolução nº 13/2012) "
            + "nem o adicional do FECP, que varia por estado.");

        avisos.add("PIS/COFINS considerados no regime " + regime.getRotulo().toLowerCase()
            + ": " + formatar(regime.getAliquotaPis()) + "% + " + formatar(regime.getAliquotaCofins()) + "%.");

        avisos.add("2026: CBS de 0,90% e IBS de 0,10% são compensáveis com PIS/COFINS e ICMS, "
            + "por isso a carga efetiva do ano é igual à do regime anterior.");

        avisos.add("2027 em diante: as alíquotas de referência são definidas anualmente; "
            + "os valores usados são os de referência da base oficial e podem ser ajustados na simulação.");

        avisos.add("A redução do ICMS/ISS acompanha a entrada do IBS: 10% em 2029, 20% em 2030, "
            + "30% em 2031, 40% em 2032 e extinção em 2033.");

        avisos.add("Carga calculada sobre o valor do frete, sem créditos de entradas, retenções "
            + "ou benefícios fiscais.");

        return avisos;
    }

    private BigDecimal resolverAliquotaIcms(FreteProjecaoInput entrada, TipoOperacaoFrete tipo,
            String ufOrigem, String ufDestino) {

        if (tipo == TipoOperacaoFrete.INTERESTADUAL && ufOrigem != null && ufDestino != null) {
            return icmsInterestadualService.aliquota(ufOrigem, ufDestino);
        }
        return defaultSeNulo(entrada.getAliquotaIcms(), tipo.getAliquotaIcmsPadrao());
    }

    private String versaoBaseDados() {
        try {
            return versaoBaseDadosService.getUltimaVersao().getNumeroVersao();
        } catch (RuntimeException e) {
            log.debug("Versão da base de dados indisponível: {}", e.getMessage());
            return null;
        }
    }

    private String normalizarNbs(String nbs) {
        final String valor = nbs == null || nbs.isBlank()
            ? FreteCatalogoService.NBS_PADRAO
            : nbs.replaceAll("\\D", "");

        if (valor.isBlank()) {
            throw new CampoInvalidoException("Informe um código NBS válido para o serviço de frete.");
        }
        return valor;
    }

    private String normalizarUf(String uf) {
        return uf == null || uf.isBlank() ? null : uf.trim().toUpperCase();
    }

    private String coalesce(String primeiro, String segundo) {
        return primeiro != null && !primeiro.isBlank() ? primeiro : segundo;
    }

    private String resolverUf(Long municipio, String uf) {
        if (uf != null && !uf.isBlank()) {
            return uf.trim().toUpperCase();
        }
        return municipioService.buscarUfPorMunicipio(municipio);
    }

    private BigDecimal percentualDe(BigDecimal base, BigDecimal percentual) {
        return escala2(base.multiply(percentual).divide(CEM, ESCOPO_CALCULO, RoundingMode.HALF_UP));
    }

    private BigDecimal percentualDeTotal(BigDecimal total, BigDecimal base) {
        if (base == null || base.signum() == 0) {
            return ZERO;
        }
        return escala2(total.multiply(CEM).divide(base, ESCOPO_CALCULO, RoundingMode.HALF_UP));
    }

    private BigDecimal dividir(BigDecimal dividendo, BigDecimal divisor, int escala) {
        return dividendo.divide(divisor, escala, RoundingMode.HALF_UP);
    }

    private BigDecimal defaultSeNulo(BigDecimal valor, BigDecimal padrao) {
        return valor != null ? valor : padrao;
    }

    private BigDecimal nuloParaZero(BigDecimal valor) {
        return valor != null ? valor : ZERO;
    }

    private BigDecimal escala2(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal escala4(BigDecimal valor) {
        return valor.setScale(4, RoundingMode.HALF_UP);
    }

    private String formatar(BigDecimal valor) {
        return nuloParaZero(valor).setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private String moeda(BigDecimal valor) {
        return MOEDA_BR.format(nuloParaZero(valor).setScale(2, RoundingMode.HALF_UP)).replace('\u00A0', ' ');
    }

    private String moedaSinal(BigDecimal valor) {
        final BigDecimal numero = nuloParaZero(valor);
        final String sinal = numero.signum() > 0 ? "+" : numero.signum() < 0 ? "-" : "";
        return sinal + moeda(numero.abs());
    }

}
