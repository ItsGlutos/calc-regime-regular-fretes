package br.gov.serpro.rtc.domain.service.frete;

import static java.math.BigDecimal.ZERO;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.CreditoFreteInput;
import br.gov.serpro.rtc.api.model.frete.CreditoFreteOutput;
import br.gov.serpro.rtc.api.model.frete.ParametrosTransicaoAno;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import br.gov.serpro.rtc.domain.service.VersaoBaseDadosService;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Apura o IBS e a CBS destacados em uma prestação de frete, que formam o teto do
 * crédito do pagador.
 *
 * <p>O cálculo é feito pelo mesmo {@link IbsCbsFreteService} usado na projeção e
 * no pagamento de CT-e, com o item de CT-e (modelo 57, CST 000, cClassTrib
 * 000001), de modo que o valor devolvido é idêntico ao da calculadora oficial do
 * regime regular.</p>
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class CreditoFreteService {

    private static final BigDecimal CEM = new BigDecimal("100");
    private static final int ESCOPO_CALCULO = 6;

    private final IbsCbsFreteService ibsCbsFreteService;
    private final TransicaoTributariaService transicaoTributariaService;
    private final IcmsInterestadualService icmsInterestadualService;
    private final FreteCatalogoService freteCatalogoService;
    private final VersaoBaseDadosService versaoBaseDadosService;

    /**
     * Calcula o IBS e a CBS de um frete no ano informado.
     *
     * @param entrada valor do frete, ano, UF, município e NBS
     * @return valores, percentual efetivo, alíquotas e memória de cálculo
     */
    public CreditoFreteOutput calcular(CreditoFreteInput entrada) {
        if (entrada == null || entrada.getValorFrete() == null) {
            throw new CampoInvalidoException("Informe o valor do frete para calcular o crédito.");
        }

        final BigDecimal valorFrete = entrada.getValorFrete().setScale(2, RoundingMode.HALF_UP);
        if (valorFrete.signum() <= 0) {
            throw new CampoInvalidoException("O valor do frete deve ser maior que zero.");
        }

        final int ano = entrada.getAno() != null ? entrada.getAno() : LocalDate.now().getYear();
        if (ano < TransicaoTributariaService.ANO_INICIAL || ano > TransicaoTributariaService.ANO_FINAL) {
            throw new CampoInvalidoException("O ano deve estar entre "
                + TransicaoTributariaService.ANO_INICIAL + " e " + TransicaoTributariaService.ANO_FINAL
                + ". Ano informado: " + ano + ".");
        }

        final String uf = entrada.getUf() == null || entrada.getUf().isBlank()
            ? "SP"
            : entrada.getUf().trim().toUpperCase();
        final Long municipio = entrada.getMunicipio() != null
            ? entrada.getMunicipio()
            : icmsInterestadualService.capitalDe(uf);
        final String nbs = entrada.getNbs() == null || entrada.getNbs().isBlank()
            ? FreteCatalogoService.NBS_PADRAO
            : entrada.getNbs().replaceAll("\\D", "");

        final ParametrosTransicaoAno parametros = parametrosDoAno(ano);

        final IbsCbsFreteService.ResultadoIbsCbs resultado = ibsCbsFreteService.calcular(
            ano, valorFrete, 11, nbs, municipio, uf,
            parametros.getCbs(), parametros.getIbsUf(), parametros.getIbsMun());

        final BigDecimal total = escala2(resultado.cbs().add(resultado.ibsUf()).add(resultado.ibsMun()));
        final BigDecimal percentual = valorFrete.signum() == 0
            ? ZERO
            : escala2(total.multiply(CEM).divide(valorFrete, ESCOPO_CALCULO, RoundingMode.HALF_UP));

        return CreditoFreteOutput.builder()
                .valorFrete(valorFrete)
                .ano(ano)
                .fase(parametros.getFase().name())
                .cbs(resultado.cbs())
                .ibsUf(resultado.ibsUf())
                .ibsMun(resultado.ibsMun())
                .total(total)
                .percentual(percentual)
                .aliquotaCbs(parametros.getCbs())
                .aliquotaIbsUf(parametros.getIbsUf())
                .aliquotaIbsMun(parametros.getIbsMun())
                .memoriaCalculo(resultado.memoria())
                .versaoBaseDados(versaoBaseDados())
                .geradoEm(OffsetDateTime.now())
                .build();
    }

    /**
     * Anos cobertos pelo cálculo do crédito.
     *
     * @return cronograma de parâmetros de referência
     */
    public List<ParametrosTransicaoAno> cronograma() {
        return transicaoTributariaService.tabelaPadrao();
    }

    private ParametrosTransicaoAno parametrosDoAno(int ano) {
        return transicaoTributariaService.tabelaPadrao().stream()
                .filter(p -> p.getAno() != null && p.getAno() == ano)
                .findFirst()
                .orElseThrow(() -> new CampoInvalidoException("Ano sem parâmetros de transição: " + ano + "."));
    }

    private BigDecimal escala2(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
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
