package br.gov.serpro.rtc.domain.service.frete;

import static java.math.BigDecimal.ONE;
import static java.math.BigDecimal.ZERO;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.AnoComparativoCte;
import br.gov.serpro.rtc.api.model.frete.ComponenteCte;
import br.gov.serpro.rtc.api.model.frete.ConferenciaCte;
import br.gov.serpro.rtc.api.model.frete.CteExemploOutput;
import br.gov.serpro.rtc.api.model.frete.CtePagamentoInput;
import br.gov.serpro.rtc.api.model.frete.CtePagamentoOutput;
import br.gov.serpro.rtc.api.model.frete.ParametrosTransicaoAno;
import br.gov.serpro.rtc.api.model.frete.RetencaoCte;
import br.gov.serpro.rtc.api.model.frete.TributoCte;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import br.gov.serpro.rtc.domain.model.enumeration.RegimePagadora;
import br.gov.serpro.rtc.domain.model.enumeration.RegimePisCofins;
import br.gov.serpro.rtc.domain.model.enumeration.TipoOperacaoFrete;
import br.gov.serpro.rtc.domain.model.enumeration.TipoTransportador;
import br.gov.serpro.rtc.domain.service.VersaoBaseDadosService;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Simula o pagamento de um CT-e na data de referência: composição do documento,
 * tributos destacados, retenções, créditos da empresa pagadora e o efeito nos
 * próximos anos da transição.
 *
 * <p>O recorte é o do pagador do frete, não o do transportador: o documento é a
 * conta que a empresa recebe e precisa conferir, pagar e escriturar. Por isso o
 * resultado separa o que está embutido no valor, o que a pagadora retém, o que
 * ela recupera por crédito e o que sobra como custo.</p>
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class CtePagamentoService {

    /** Primeiro ano coberto pelo simulador de CT-e. */
    public static final int ANO_INICIAL_CTE = 2026;
    /** Último ano coberto pelo simulador de CT-e. */
    public static final int ANO_FINAL_CTE = 2034;

    private static final BigDecimal CEM = new BigDecimal("100");
    private static final BigDecimal ALIQUOTA_IRRF = new BigDecimal("1.50");
    private static final BigDecimal ALIQUOTA_INSS = new BigDecimal("11.00");
    private static final BigDecimal ALIQUOTA_SEST_SENAT = new BigDecimal("2.50");
    private static final int ESCOPO_CALCULO = 6;
    private static final NumberFormat MOEDA_BR = NumberFormat.getCurrencyInstance(Locale.of("pt", "BR"));
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final IbsCbsFreteService ibsCbsFreteService;
    private final TransicaoTributariaService transicaoTributariaService;
    private final IcmsInterestadualService icmsInterestadualService;
    private final FreteCatalogoService freteCatalogoService;
    private final VersaoBaseDadosService versaoBaseDadosService;

    /**
     * Monta o exemplo de CT-e de novembro de 2026 usado como demonstração.
     *
     * @return entrada do exemplo e o resultado do seu pagamento
     */
    public CteExemploOutput exemplo() {
        final LocalDate hoje = LocalDate.now();
        final CtePagamentoInput entrada = new CtePagamentoInput();

        entrada.setNumeroCte("458");
        entrada.setSerie("1");
        entrada.setDataEmissao(hoje.minusDays(15));
        entrada.setDataPagamento(hoje);

        entrada.setEmitenteNome("Transportes Vale do Rio Ltda.");
        entrada.setEmitenteCnpj("12.345.678/0001-90");
        entrada.setEmitenteRntrc("12345678");

        entrada.setTomadorNome("Indústria Alimentos Bom Sabor S.A.");
        entrada.setTomadorCnpj("98.765.432/0001-10");

        entrada.setUfOrigem("SP");
        entrada.setUfDestino("BA");
        entrada.setTipoOperacao(TipoOperacaoFrete.INTERESTADUAL.name());
        entrada.setRegimePisCofins(RegimePisCofins.NAO_CUMULATIVO.name());
        entrada.setTipoTransportador(TipoTransportador.TDE.name());
        entrada.setRegimePagadora(RegimePagadora.REGIME_REGULAR.name());
        entrada.setNbs(FreteCatalogoService.NBS_PADRAO);

        entrada.setValorMercadoria(new BigDecimal("350000.00"));
        entrada.setFretePeso(new BigDecimal("4200.00"));
        entrada.setFreteValor(new BigDecimal("1050.00"));
        entrada.setGris(new BigDecimal("525.00"));
        entrada.setPedagio(ZERO);
        entrada.setTaxas(new BigDecimal("180.00"));
        entrada.setOutros(ZERO);
        entrada.setDesconto(ZERO);
        entrada.setValePedagio(new BigDecimal("320.00"));

        entrada.setTomaCreditoIcms(true);
        entrada.setTomaCreditoPisCofins(true);

        return CteExemploOutput.builder()
                .entrada(entrada)
                .resultado(pagar(entrada))
                .build();
    }

    /**
     * Calcula o pagamento de um CT-e.
     *
     * @param entrada dados do documento e escolhas de apuração da pagadora
     * @return composição, tributos, retenções, créditos e comparativo anual
     */
    public CtePagamentoOutput pagar(CtePagamentoInput entrada) {
        if (entrada == null) {
            throw new CampoInvalidoException("Informe os dados do CT-e para a simulação.");
        }

        final LocalDate pagamento = entrada.getDataPagamento() != null
            ? entrada.getDataPagamento()
            : LocalDate.now();
        final LocalDate emissao = entrada.getDataEmissao() != null
            ? entrada.getDataEmissao()
            : pagamento.minusDays(15);

        if (pagamento.getYear() < ANO_INICIAL_CTE || pagamento.getYear() > ANO_FINAL_CTE) {
            throw new CampoInvalidoException("O simulador de CT-e cobre de " + ANO_INICIAL_CTE + " a "
                + ANO_FINAL_CTE + ". Data de pagamento informada: " + DATA_BR.format(pagamento) + ".");
        }

        final int ano = pagamento.getYear();
        final ParametrosTransicaoAno parametros = parametrosDoAno(ano);
        final TipoOperacaoFrete tipo = TipoOperacaoFrete.from(entrada.getTipoOperacao());
        final TipoTransportador transportador = TipoTransportador.from(entrada.getTipoTransportador());
        final RegimePagadora regimePagadora = RegimePagadora.from(entrada.getRegimePagadora());
        final RegimePisCofins regimePis = RegimePisCofins.from(entrada.getRegimePisCofins());
        final String nbs = normalizarNbs(entrada.getNbs());

        final String ufOrigem = normalizarUf(entrada.getUfOrigem(), "SP");
        final String ufDestino = normalizarUf(entrada.getUfDestino(), ufOrigem);
        final Long municipio = entrada.getMunicipio() != null
            ? entrada.getMunicipio()
            : icmsInterestadualService.capitalDe(ufDestino);

        final BigDecimal fretePeso = nz(entrada.getFretePeso());
        final BigDecimal freteValor = nz(entrada.getFreteValor());
        final BigDecimal gris = nz(entrada.getGris());
        final BigDecimal pedagio = nz(entrada.getPedagio());
        final BigDecimal taxas = nz(entrada.getTaxas());
        final BigDecimal outros = nz(entrada.getOutros());
        final BigDecimal desconto = nz(entrada.getDesconto());
        final BigDecimal valePedagio = nz(entrada.getValePedagio());

        final BigDecimal base = escala2(fretePeso.add(freteValor).add(gris).add(pedagio).add(taxas).add(outros)
            .subtract(desconto));

        if (base.signum() <= 0) {
            throw new CampoInvalidoException(
                "O valor da prestação do serviço deve ser maior que zero. Revise as parcelas do frete.");
        }

        final boolean municipal = tipo == TipoOperacaoFrete.MUNICIPAL;
        final BigDecimal aliquotaIcms = municipal
            ? ZERO
            : entrada.getAliquotaIcms() != null
                ? entrada.getAliquotaIcms()
                : tipo == TipoOperacaoFrete.INTERESTADUAL
                    ? icmsInterestadualService.aliquota(ufOrigem, ufDestino)
                    : tipo.getAliquotaIcmsPadrao();
        final BigDecimal aliquotaIss = municipal
            ? defaultSeNulo(entrada.getAliquotaIss(), tipo.getAliquotaIssPadrao())
            : ZERO;

        final IbsCbsFreteService.ResultadoIbsCbs ibsCbs = ibsCbsFreteService.calcular(ano, base,
            pagamento.getMonthValue(), nbs, municipio, ufDestino,
            parametros.getCbs(), parametros.getIbsUf(), parametros.getIbsMun());

        final boolean faseTeste = parametros.getFase() == FaseTransicao.TESTE;
        final BigDecimal fatorReducao = ONE.subtract(
            dividir(nz(parametros.getReducaoIcmsIss()), CEM, ESCOPO_CALCULO));

        final BigDecimal valorIcms = percentualDe(base, aliquotaIcms.multiply(fatorReducao));
        final BigDecimal valorIss = percentualDe(base, aliquotaIss.multiply(fatorReducao));
        final BigDecimal valorPis = ano <= 2026 ? percentualDe(base, regimePis.getAliquotaPis()) : ZERO;
        final BigDecimal valorCofins = ano <= 2026 ? percentualDe(base, regimePis.getAliquotaCofins()) : ZERO;

        final BigDecimal valorIbsCbs = escala2(ibsCbs.cbs().add(ibsCbs.ibsUf()).add(ibsCbs.ibsMun()));
        final BigDecimal totalTributos = escala2(valorIcms.add(valorIss).add(valorPis).add(valorCofins)
            .add(valorIbsCbs));

        final boolean creditoIcms = Boolean.TRUE.equals(entrada.getTomaCreditoIcms())
            && regimePagadora.isAproveitaCredito();
        final boolean creditoPisCofins = Boolean.TRUE.equals(entrada.getTomaCreditoPisCofins())
            && regimePagadora.isAproveitaCredito() && ano <= 2026;
        final boolean creditoIbsCbs = regimePagadora.isAproveitaCredito() && ano >= 2027;

        final BigDecimal creditoIcmsValor = creditoIcms ? valorIcms : ZERO;
        final BigDecimal creditoPisCofinsValor = creditoPisCofins ? valorPis.add(valorCofins) : ZERO;
        final BigDecimal creditoIbsCbsValor = creditoIbsCbs ? valorIbsCbs : ZERO;
        final BigDecimal creditoTotal = escala2(creditoIcmsValor.add(creditoPisCofinsValor).add(creditoIbsCbsValor));

        final BigDecimal destaqueCompensavel = faseTeste ? valorIbsCbs : ZERO;
        final BigDecimal custoNaoRecuperavel = escala2(
            totalTributos.subtract(creditoTotal).subtract(destaqueCompensavel));

        final boolean reterIrrf = entrada.getReterIrrf() != null
            ? Boolean.TRUE.equals(entrada.getReterIrrf())
            : transportador.isRetemIrrf();
        final boolean reterInss = entrada.getReterInss() != null
            ? Boolean.TRUE.equals(entrada.getReterInss())
            : transportador.isRetemInss();
        final boolean reterSestSenat = entrada.getReterSestSenat() != null
            ? Boolean.TRUE.equals(entrada.getReterSestSenat())
            : transportador.isRetemSestSenat();

        final List<RetencaoCte> retencoes = new ArrayList<>();
        if (reterIrrf) {
            retencoes.add(retencao("IRRF", "IRRF sobre o frete", base,
                defaultSeNulo(entrada.getAliquotaIrrf(), ALIQUOTA_IRRF),
                "IN RFB nº 1.234/2012 — 1,5% sobre o valor do transporte de cargas.",
                "Pagadora — DARF"));
        }
        if (reterInss) {
            retencoes.add(retencao("INSS", "INSS retido (contribuinte individual)", base,
                defaultSeNulo(entrada.getAliquotaInss(), ALIQUOTA_INSS),
                "Lei 8.212/1991, art. 31 — 11% sobre o valor bruto da nota.",
                "Pagadora — DCTFWeb"));
        }
        if (reterSestSenat) {
            retencoes.add(retencao("SEST_SENAT", "SEST/SENAT", base,
                defaultSeNulo(entrada.getAliquotaSestSenat(), ALIQUOTA_SEST_SENAT),
                "Lei 8.706/1993 — 2,5% (SEST 1,5% + SENAT 1,0%) sobre a remuneração do transporte.",
                "Pagadora — DARF"));
        }

        final BigDecimal totalRetencoes = escala2(retencoes.stream()
            .map(RetencaoCte::getValor)
            .reduce(ZERO, BigDecimal::add));

        final BigDecimal liquidoTransportador = escala2(base.subtract(totalRetencoes));
        final String chaveAcesso = chaveAcesso(entrada, emissao, ufOrigem);

        return CtePagamentoOutput.builder()
                .numeroCte(entrada.getNumeroCte())
                .serie(entrada.getSerie())
                .chaveAcesso(chaveAcesso)
                .dataEmissao(emissao)
                .dataPagamento(pagamento)
                .emitenteNome(entrada.getEmitenteNome())
                .emitenteCnpj(entrada.getEmitenteCnpj())
                .emitenteRntrc(entrada.getEmitenteRntrc())
                .tomadorNome(entrada.getTomadorNome())
                .tomadorCnpj(entrada.getTomadorCnpj())
                .ufOrigem(ufOrigem)
                .ufDestino(ufDestino)
                .rota(ufOrigem + " → " + ufDestino)
                .tipoOperacao(tipo.name())
                .tipoTransportador(transportador.name())
                .regimePagadora(regimePagadora.name())
                .nbs(nbs)
                .descricaoNbs(descricaoNbs(nbs, ano))
                .municipio(municipio)
                .regimePisCofins(regimePis.name())
                .anoReferencia(ano)
                .fase(parametros.getFase().name())
                .valorMercadoria(nz(entrada.getValorMercadoria()))
                .baseCalculo(base)
                .valePedagio(valePedagio)
                .desembolsoTotal(escala2(base.add(valePedagio)))
                .componentes(componentes(base, fretePeso, freteValor, gris, pedagio, taxas, outros, desconto,
                    valePedagio))
                .tributos(tributos(ano, faseTeste, base, aliquotaIcms, aliquotaIss, ibsCbs, valorIcms, valorIss,
                    valorPis, valorCofins, creditoIcms, creditoPisCofins, creditoIbsCbs, tipo))
                .retencoes(retencoes)
                .totalTributos(totalTributos)
                .percentualTributos(percentualDeTotal(totalTributos, base))
                .creditoTotal(creditoTotal)
                .creditoIcms(creditoIcmsValor)
                .creditoPisCofins(creditoPisCofinsValor)
                .creditoIbsCbs(creditoIbsCbsValor)
                .custoNaoRecuperavel(custoNaoRecuperavel)
                .percentualCustoNaoRecuperavel(percentualDeTotal(custoNaoRecuperavel, base))
                .totalRetencoes(totalRetencoes)
                .liquidoTransportador(liquidoTransportador)
                .comparativo(comparativo(base, ufOrigem, ufDestino, municipio, nbs, tipo, regimePis,
                    regimePagadora, aliquotaIcms, aliquotaIss, totalRetencoes))
                .conferencias(conferencias(chaveAcesso, base, ano, faseTeste, ibsCbs, ufOrigem, ufDestino,
                    aliquotaIcms, valePedagio))
                .premissas(premissas(ano, tipo, transportador, regimePagadora, regimePis, ufOrigem, ufDestino))
                .versaoBaseDados(versaoBaseDados())
                .geradoEm(OffsetDateTime.now())
                .build();
    }

    private ParametrosTransicaoAno parametrosDoAno(int ano) {
        return transicaoTributariaService.tabelaPadrao().stream()
                .filter(p -> p.getAno() != null && p.getAno() == ano)
                .findFirst()
                .orElseThrow(() -> new CampoInvalidoException(
                    "Ano sem parâmetros de transição: " + ano + "."));
    }

    private List<ComponenteCte> componentes(BigDecimal base, BigDecimal fretePeso, BigDecimal freteValor,
            BigDecimal gris, BigDecimal pedagio, BigDecimal taxas, BigDecimal outros, BigDecimal desconto,
            BigDecimal valePedagio) {

        final List<ComponenteCte> componentes = new ArrayList<>();
        componentes.add(componente("FRETE_PESO", "Frete-peso", fretePeso, base, true,
            "Parcela calculada sobre o peso ou o volume transportado."));
        componentes.add(componente("FRETE_VALOR", "Frete-valor (ad valorem)", freteValor, base, true,
            "Percentual sobre o valor da mercadoria declarado no CT-e."));
        componentes.add(componente("GRIS", "GRIS — gerenciamento de risco", gris, base, true,
            "Cobertura de risco da carga, quando contratada."));
        componentes.add(componente("PEDAGIO", "Pedágio", pedagio, base, true,
            "Pedágio cobrado dentro do valor da prestação."));
        componentes.add(componente("TAXAS", "Taxas de coleta e entrega", taxas, base, true,
            "Serviços acessórios vinculados à prestação."));
        componentes.add(componente("OUTROS", "Outros serviços", outros, base, true,
            "Estadia, diária, agendamento e demais acréscimos."));
        componentes.add(componente("DESCONTO", "Desconto comercial", desconto.negate(), base, false,
            "Redução concedida sobre o valor da prestação."));
        componentes.add(componente("VALE_PEDAGIO", "Vale-pedágio obrigatório", valePedagio, base, false,
            "Antecipado pela pagadora e pago diretamente ao transportador; não integra a remuneração do frete"
                + " (Lei 10.209/2001)."));
        return componentes;
    }

    private ComponenteCte componente(String codigo, String descricao, BigDecimal valor, BigDecimal base,
            boolean incideTributos, String observacao) {

        return ComponenteCte.builder()
                .codigo(codigo)
                .descricao(descricao)
                .valor(escala2(valor))
                .percentual(percentualDeTotal(valor, base))
                .incideTributos(incideTributos)
                .observacao(observacao)
                .build();
    }

    private List<TributoCte> tributos(int ano, boolean faseTeste, BigDecimal base, BigDecimal aliquotaIcms,
            BigDecimal aliquotaIss, IbsCbsFreteService.ResultadoIbsCbs ibsCbs, BigDecimal valorIcms,
            BigDecimal valorIss, BigDecimal valorPis, BigDecimal valorCofins, boolean creditoIcms,
            boolean creditoPisCofins, boolean creditoIbsCbs, TipoOperacaoFrete tipo) {

        final List<TributoCte> tributos = new ArrayList<>();
        final boolean municipal = tipo == TipoOperacaoFrete.MUNICIPAL;

        if (valorIcms.signum() > 0 || !municipal) {
            tributos.add(TributoCte.builder()
                .codigo("ICMS")
                .nome("ICMS")
                .baseCalculo(base)
                .aliquota(aliquotaIcms)
                .valor(valorIcms)
                .apuracao("Transportador · estadual")
                .creditoPagadora(creditoIcms)
                .fundamento(tipo == TipoOperacaoFrete.INTERESTADUAL
                    ? "Resolução do Senado Federal nº 22/1989 e legislação estadual."
                    : "Legislação estadual do ICMS.")
                .observacao(valorIcms.signum() == 0
                    ? "Alíquota zerada no regime pleno."
                    : "Tributo embutido no valor da prestação, não cobrado à parte.")
                .build());
        }

        if (municipal) {
            tributos.add(TributoCte.builder()
                .codigo("ISS")
                .nome("ISS")
                .baseCalculo(base)
                .aliquota(aliquotaIss)
                .valor(valorIss)
                .apuracao("Transportador · municipal")
                .creditoPagadora(false)
                .fundamento("LC 116/2003, item 16.01 — transporte de natureza municipal.")
                .observacao("O ISS não gera crédito para o tomador.")
                .build());
        }

        if (valorPis.signum() > 0 || valorCofins.signum() > 0) {
            tributos.add(TributoCte.builder()
                .codigo("PIS")
                .nome("PIS")
                .baseCalculo(base)
                .aliquota(percentualDeTotal(valorPis, base))
                .valor(valorPis)
                .apuracao("Transportador · federal")
                .creditoPagadora(creditoPisCofins)
                .fundamento("Lei 10.637/2002 — vigente até 2026.")
                .observacao("Substituído pela CBS a partir de 2027.")
                .build());
            tributos.add(TributoCte.builder()
                .codigo("COFINS")
                .nome("COFINS")
                .baseCalculo(base)
                .aliquota(percentualDeTotal(valorCofins, base))
                .valor(valorCofins)
                .apuracao("Transportador · federal")
                .creditoPagadora(creditoPisCofins)
                .fundamento("Lei 10.833/2003 — vigente até 2026.")
                .observacao("Substituída pela CBS a partir de 2027.")
                .build());
        }

        tributos.add(TributoCte.builder()
            .codigo("IBS_UF")
            .nome("IBS estadual")
            .baseCalculo(base)
            .aliquota(ibsCbs.percentualIbsUf())
            .valor(ibsCbs.ibsUf())
            .apuracao(faseTeste
                ? "Transportador · compensável em 2026"
                : "Transportador · IBS")
            .creditoPagadora(creditoIbsCbs)
            .fundamento("LC 214/2025 e ADCT (EC 132/2023), art. 125 (2026).")
            .observacao(faseTeste
                ? "Compensado pelo transportador com o ICMS da apuração."
                : "Crédito do tomador no regime regular.")
            .build());

        if (nz(ibsCbs.ibsMun()).signum() > 0) {
            tributos.add(TributoCte.builder()
                .codigo("IBS_MUN")
                .nome("IBS municipal")
                .baseCalculo(base)
                .aliquota(ibsCbs.percentualIbsMun())
                .valor(ibsCbs.ibsMun())
                .apuracao("Transportador · IBS")
                .creditoPagadora(creditoIbsCbs)
                .fundamento("LC 214/2025 — IBS municipal.")
                .observacao("Parcela municipal do IBS, cobrada a partir de 2027.")
                .build());
        }

        tributos.add(TributoCte.builder()
            .codigo("CBS")
            .nome("CBS")
            .baseCalculo(base)
            .aliquota(ibsCbs.percentualCbs())
            .valor(ibsCbs.cbs())
            .apuracao(faseTeste
                ? "Transportador · compensável em 2026"
                : "Transportador — apuração da CBS")
            .creditoPagadora(creditoIbsCbs)
            .fundamento("LC 214/2025 e ADCT (EC 132/2023), art. 125 (2026).")
            .observacao(faseTeste
                ? "Compensada pelo transportador com o PIS/COFINS da apuração."
                : "Crédito do tomador no regime regular.")
            .build());

        return tributos;
    }

    private List<AnoComparativoCte> comparativo(BigDecimal base, String ufOrigem, String ufDestino, Long municipio,
            String nbs, TipoOperacaoFrete tipo, RegimePisCofins regimePis, RegimePagadora regimePagadora,
            BigDecimal aliquotaIcms, BigDecimal aliquotaIss, BigDecimal totalRetencoes) {

        final List<AnoComparativoCte> comparativo = new ArrayList<>();

        for (int ano : new int[] {2026, 2027, 2029, 2033}) {
            final ParametrosTransicaoAno parametros = parametrosDoAno(ano);
            final boolean faseTeste = parametros.getFase() == FaseTransicao.TESTE;
            final boolean municipal = tipo == TipoOperacaoFrete.MUNICIPAL;

            final IbsCbsFreteService.ResultadoIbsCbs ibsCbs = ibsCbsFreteService.calcular(ano, base, 11, nbs,
                municipio, ufDestino, parametros.getCbs(), parametros.getIbsUf(), parametros.getIbsMun());

            final BigDecimal fatorReducao = ONE.subtract(
                dividir(nz(parametros.getReducaoIcmsIss()), CEM, ESCOPO_CALCULO));
            final BigDecimal valorIcms = municipal
                ? ZERO
                : percentualDe(base, aliquotaIcms.multiply(fatorReducao));
            final BigDecimal valorIss = municipal
                ? percentualDe(base, aliquotaIss.multiply(fatorReducao))
                : ZERO;
            final BigDecimal valorPisCofins = ano <= 2026
                ? percentualDe(base, regimePis.getAliquotaTotal())
                : ZERO;
            final BigDecimal valorIbsCbs = escala2(ibsCbs.cbs().add(ibsCbs.ibsUf()).add(ibsCbs.ibsMun()));
            final BigDecimal totalTributos = escala2(valorIcms.add(valorIss).add(valorPisCofins).add(valorIbsCbs));

            final boolean creditoIbsCbs = regimePagadora.isAproveitaCredito() && ano >= 2027;
            final BigDecimal creditoIbsCbsValor = creditoIbsCbs ? valorIbsCbs : ZERO;
            final BigDecimal custoNaoRecuperavel = escala2(totalTributos
                .subtract(creditoIbsCbsValor)
                .subtract(faseTeste ? valorIbsCbs : ZERO));

            final boolean splitPayment = ano >= 2027;
            final BigDecimal valorSplit = splitPayment ? valorIbsCbs : ZERO;

            comparativo.add(AnoComparativoCte.builder()
                .ano(ano)
                .rotulo(parametros.getRotulo())
                .fase(parametros.getFase().name())
                .valorDocumento(base)
                .percentualCbs(parametros.getCbs())
                .percentualIbsUf(parametros.getIbsUf())
                .percentualIbsMun(parametros.getIbsMun())
                .percentualIcms(escala4(municipal ? ZERO : aliquotaIcms.multiply(fatorReducao)))
                .percentualPisCofins(ano <= 2026 ? escala4(regimePis.getAliquotaTotal()) : escala4(ZERO))
                .valorIbsCbs(valorIbsCbs)
                .valorCbs(ibsCbs.cbs())
                .valorIbs(escala2(ibsCbs.ibsUf().add(ibsCbs.ibsMun())))
                .valorIcms(valorIcms)
                .valorPisCofins(valorPisCofins)
                .totalTributos(totalTributos)
                .percentualTotal(percentualDeTotal(totalTributos, base))
                .creditoIbsCbs(creditoIbsCbsValor)
                .custoNaoRecuperavel(custoNaoRecuperavel)
                .splitPayment(splitPayment)
                .valorSplitPayment(valorSplit)
                .liquidoTransportador(escala2(base.subtract(valorSplit).subtract(totalRetencoes)))
                .observacao(observacaoComparativo(ano, faseTeste, valorSplit))
                .build());
        }

        return comparativo;
    }

    private String observacaoComparativo(int ano, boolean faseTeste, BigDecimal valorSplit) {
        if (faseTeste) {
            return "Ano de teste: o IBS e a CBS são destacados, mas compensados pelo transportador. "
                + "O pagamento é o mesmo de 2025 e nenhum valor é segregado.";
        }
        return switch (ano) {
            case 2027 -> "PIS/COFINS extintos: a CBS entra integral e o ICMS segue cheio. "
                + "A partir daqui o pagamento sofre segregação de " + moeda(valorSplit)
                + " (split payment) e o transportador recebe líquido.";
            case 2029 -> "O IBS começa a subir e o ICMS cai 10% ao ano; o split payment passa a "
                + "segregar " + moeda(valorSplit) + " do documento.";
            default -> "Regime pleno: ICMS extinto, IBS e CBS integrais. Split payment de "
                + moeda(valorSplit) + " no pagamento.";
        };
    }

    private List<ConferenciaCte> conferencias(String chaveAcesso, BigDecimal base,
            int ano, boolean faseTeste, IbsCbsFreteService.ResultadoIbsCbs ibsCbs, String ufOrigem, String ufDestino,
            BigDecimal aliquotaIcms, BigDecimal valePedagio) {

        final List<ConferenciaCte> conferencias = new ArrayList<>();

        final boolean chaveValida = chaveAcesso != null && chaveAcesso.length() == 44
            && chaveAcesso.chars().allMatch(Character::isDigit);
        final boolean dvValido = chaveValida && dv(chaveAcesso.substring(0, 43))
            == Character.getNumericValue(chaveAcesso.charAt(43));

        conferencias.add(conferencia("Chave de acesso", dvValido ? "OK" : "ATENCAO",
            dvValido
                ? "44 dígitos com dígito verificador válido."
                : "Chave informada inválida; a chave do documento deve ter 44 dígitos e DV correto.",
            "CALCULO"));

        conferencias.add(conferencia("Base de cálculo", "OK",
            "Parcelas do frete somam " + moeda(base) + ", iguais ao valor da prestação.", "CALCULO"));

        conferencias.add(conferencia("Destaque de IBS/CBS", ibsCbs.cbs().signum() > 0 ? "OK" : "ATENCAO",
            "CST 000 e cClassTrib 000001 com CBS de " + formatar(ibsCbs.percentualCbs())
                + "% e IBS de " + formatar(nz(ibsCbs.percentualIbsUf()).add(nz(ibsCbs.percentualIbsMun()))) + "%.", 
            "CALCULO"));

        if (ufOrigem != null && ufDestino != null) {
            final BigDecimal oficial = icmsInterestadualService.aliquota(ufOrigem, ufDestino);
            conferencias.add(conferencia("ICMS interestadual", oficial.compareTo(aliquotaIcms) == 0 ? "OK" : "ATENCAO",
                "Tabela oficial " + ufOrigem + " → " + ufDestino + ": " + formatar(oficial)
                    + "%; documento: " + formatar(aliquotaIcms) + "%.", "CALCULO"));
        }

        conferencias.add(conferencia("Vale-pedágio", valePedagio.signum() > 0 ? "OK" : "ATENCAO",
            valePedagio.signum() > 0
                ? "Antecipado pela pagadora e fora da remuneração do frete (Lei 10.209/2001)."
                : "Nenhum vale-pedágio declarado: confirme se a rota tem praças de pedágio.",
            "CALCULO"));

        conferencias.add(conferencia("Retenções do contrato", "MANUAL",
            "IRRF, INSS e SEST/SENAT conferidos com a cláusula de retenções do contrato de transporte.",
            "CONTRATO"));

        conferencias.add(conferencia("MDF-e e autorização do CT-e", "PENDENTE",
            "Depende de integração com a SEFAZ e com o MDF-e para confirmar autorização e vínculo.",
            "INTEGRACAO"));

        conferencias.add(conferencia("RNTRC e CIOT", "PENDENTE",
            "Consulta ao RNTRC do emitente e ao CIOT (piso mínimo ANTT) ainda não integrada.", "INTEGRACAO"));

        conferencias.add(conferencia("Split payment", faseTeste ? "NAO_APLICAVEL" : "PENDENTE",
            faseTeste
                ? "Não se aplica em 2026: o destaque é compensado na apuração do transportador."
                : "A partir de 2027 o valor de IBS/CBS é segregado no pagamento; falta integração bancária.",
            "INTEGRACAO"));

        conferencias.add(conferencia("Conciliação com a tabela de frete", "PENDENTE",
            "Comparação parcela a parcela com a tabela contratada ainda é manual.", "CONTRATO"));

        return conferencias;
    }

    private ConferenciaCte conferencia(String item, String situacao, String detalhe, String origem) {
        return ConferenciaCte.builder()
                .item(item)
                .situacao(situacao)
                .detalhe(detalhe)
                .origem(origem)
                .build();
    }

    private List<String> premissas(int ano, TipoOperacaoFrete tipo, TipoTransportador transportador,
            RegimePagadora regimePagadora, RegimePisCofins regimePis, String ufOrigem, String ufDestino) {

        final List<String> premissas = new ArrayList<>();

        premissas.add("Pagamento simulado em " + ano + ": os tributos são os vigentes na data, não os do ano de "
            + "referência da projeção.");
        premissas.add("O valor da prestação é a base do ICMS, do PIS/COFINS e do IBS/CBS; os tributos são "
            + "embutidos no preço (cobrados \"por dentro\"), não acrescidos por fora.");
        premissas.add("Tipo de operação " + tipo.getRotulo().toLowerCase() + ": "
            + (tipo == TipoOperacaoFrete.MUNICIPAL
                ? "o ISS substitui o ICMS e não gera crédito para o tomador."
                : "ICMS conforme a legislação estadual e a tabela interestadual oficial."));
        if (ufOrigem != null && ufDestino != null && tipo == TipoOperacaoFrete.INTERESTADUAL) {
            premissas.add("Rota " + ufOrigem + " → " + ufDestino + " com ICMS de "
                + formatar(icmsInterestadualService.aliquota(ufOrigem, ufDestino))
                + "% (Resolução do Senado Federal nº 22/1989).");
        }
        premissas.add("Transportador " + transportador.getRotulo() + ": "
            + (transportador == TipoTransportador.TAC
                ? "além do IRRF, a pagadora retém INSS de 11% e SEST/SENAT de 2,5%."
                : "a pagadora retém apenas o IRRF de 1,5%; INSS e SEST/SENAT são recolhidos pela transportadora."));
        premissas.add("Pagadora no " + regimePagadora.getRotulo() + ": "
            + (regimePagadora.isAproveitaCredito()
                ? "aproveita ICMS e PIS/COFINS em 2026 e IBS/CBS a partir de 2027."
                : "não aproveita crédito, de modo que a carga embutida vira custo."));
        premissas.add("PIS/COFINS do transportador no regime " + regimePis.getRotulo().toLowerCase()
            + " (" + formatar(regimePis.getAliquotaTotal()) + "% sobre o frete).");
        premissas.add("Retenções calculadas sobre o valor total da prestação, sem considerar dispensas por valor "
            + "mínimo nem benefícios previstos em convenção coletiva.");
        premissas.add("Não estão modelados ICMS de 4% para importados (Resolução nº 13/2012), FECP, pedágio "
            + "dentro da base do ICMS nem créditos de entradas da pagadora.");
        premissas.add("O split payment é tratado como segregação do IBS/CBS no momento do pagamento a partir de "
            + "2027, conforme a regulamentação da LC 214/2025.");

        return premissas;
    }

    private RetencaoCte retencao(String codigo, String nome, BigDecimal base, BigDecimal aliquota,
            String fundamento, String recolhimento) {

        return RetencaoCte.builder()
                .codigo(codigo)
                .nome(nome)
                .baseCalculo(base)
                .aliquota(aliquota)
                .valor(percentualDe(base, aliquota))
                .fundamento(fundamento)
                .recolhimento(recolhimento)
                .build();
    }

    /**
     * Monta a chave de acesso do CT-e quando ela não é informada: cUF, AAMM, CNPJ,
     * modelo 57, série, número, tipo de emissão, código e dígito verificador.
     */
    private String chaveAcesso(CtePagamentoInput entrada, LocalDate emissao, String uf) {
        final String informada = entrada.getChaveAcesso() == null
            ? null
            : entrada.getChaveAcesso().replaceAll("\\D", "");

        if (informada != null && !informada.isBlank()) {
            return informada;
        }

        final String cuf = String.format("%02d", codigoUf(uf));
        final String aamm = emissao.format(DateTimeFormatter.ofPattern("yyMM"));
        final String cnpj = padLeft(digitos(entrada.getEmitenteCnpj()), 14);
        final String serie = padLeft(digitos(entrada.getSerie()), 3);
        final String numero = padLeft(digitos(entrada.getNumeroCte()), 9);

        final String base = cuf + aamm + cnpj + IbsCbsFreteService.TIPO_DOCUMENTO_CTE + serie + numero + "1"
            + "10000000";

        return base + dv(base);
    }

    private int codigoUf(String uf) {
        try {
            final Long capital = icmsInterestadualService.capitalDe(uf);
            return capital == null ? 35 : (int) (capital / 100000);
        } catch (RuntimeException e) {
            return 35;
        }
    }

    private int dv(String base) {
        int soma = 0;
        int peso = 2;
        for (int i = base.length() - 1; i >= 0; i--) {
            soma += Character.getNumericValue(base.charAt(i)) * peso;
            peso = peso == 9 ? 2 : peso + 1;
        }
        final int resto = soma % 11;
        final int digito = 11 - resto;
        return digito >= 10 ? 0 : digito;
    }

    private String digitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }

    private String padLeft(String valor, int tamanho) {
        final String limpo = valor == null ? "" : valor;
        if (limpo.length() >= tamanho) {
            return limpo.substring(limpo.length() - tamanho);
        }
        return "0".repeat(tamanho - limpo.length()) + limpo;
    }

    private String descricaoNbs(String nbs, int ano) {
        try {
            return freteCatalogoService.descrever(nbs, LocalDate.of(ano, 1, 1));
        } catch (RuntimeException e) {
            log.debug("Descrição do NBS indisponível: {}", e.getMessage());
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

    private String normalizarUf(String uf, String padrao) {
        return uf == null || uf.isBlank() ? padrao : uf.trim().toUpperCase();
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

    private BigDecimal nz(BigDecimal valor) {
        return valor != null ? valor : ZERO;
    }

    private BigDecimal escala2(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal escala4(BigDecimal valor) {
        return valor.setScale(4, RoundingMode.HALF_UP);
    }

    private String formatar(BigDecimal valor) {
        return nz(valor).setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private String moeda(BigDecimal valor) {
        return MOEDA_BR.format(nz(valor).setScale(2, RoundingMode.HALF_UP)).replace('\u00A0', ' ');
    }

    private String versaoBaseDados() {
        try {
            return versaoBaseDadosService.getUltimaVersao().getNumeroVersao();
        } catch (RuntimeException e) {
            log.debug("Versão da base de dados indisponível: {}", e.getMessage());
            return null;
        }
    }

}
