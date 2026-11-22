package br.gov.serpro.rtc.domain.model.enumeration;

import java.math.BigDecimal;

import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Tipo de operação de frete, usado para definir os tributos do regime anterior
 * que incidem sobre o serviço.
 *
 * <p>O transporte rodoviário de cargas intermunicipal e interestadual é
 * tributado pelo ICMS; o transporte estritamente municipal é tributado pelo
 * ISS. O transporte de cargas não possui redução de alíquota no IBS/CBS, sendo
 * tributado integralmente (cClassTrib 000001).</p>
 */
public enum TipoOperacaoFrete {

    INTERESTADUAL(
        "Interestadual / intermunicipal (ICMS)",
        "Tributado pelo ICMS interestadual ou intermunicipal.",
        new BigDecimal("12.00"),
        BigDecimal.ZERO),

    INTERNA(
        "Interna no estado (ICMS)",
        "Tributado pelo ICMS interno do estado de origem.",
        new BigDecimal("18.00"),
        BigDecimal.ZERO),

    MUNICIPAL(
        "Municipal (ISS)",
        "Transporte realizado dentro do município, tributado pelo ISS.",
        BigDecimal.ZERO,
        new BigDecimal("5.00"));

    private final String rotulo;
    private final String descricao;
    private final BigDecimal aliquotaIcmsPadrao;
    private final BigDecimal aliquotaIssPadrao;

    TipoOperacaoFrete(String rotulo, String descricao, BigDecimal aliquotaIcmsPadrao, BigDecimal aliquotaIssPadrao) {
        this.rotulo = rotulo;
        this.descricao = descricao;
        this.aliquotaIcmsPadrao = aliquotaIcmsPadrao;
        this.aliquotaIssPadrao = aliquotaIssPadrao;
    }

    public String getRotulo() {
        return rotulo;
    }

    public String getDescricao() {
        return descricao;
    }

    public BigDecimal getAliquotaIcmsPadrao() {
        return aliquotaIcmsPadrao;
    }

    public BigDecimal getAliquotaIssPadrao() {
        return aliquotaIssPadrao;
    }

    public static TipoOperacaoFrete from(String valor) {
        if (valor == null || valor.isBlank()) {
            return INTERESTADUAL;
        }
        try {
            return valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CampoInvalidoException(
                "Tipo de operação inválido: " + valor + ". Valores aceitos: INTERESTADUAL, INTERNA, MUNICIPAL.");
        }
    }

}
