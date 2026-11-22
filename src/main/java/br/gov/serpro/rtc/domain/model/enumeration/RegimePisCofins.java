package br.gov.serpro.rtc.domain.model.enumeration;

import java.math.BigDecimal;

import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Regime de apuração do PIS/COFINS aplicável ao transportador no regime
 * anterior à reforma, usado para dimensionar a carga substituída pela CBS.
 */
public enum RegimePisCofins {

    NAO_CUMULATIVO("Não cumulativo (Lucro Real)", new BigDecimal("1.65"), new BigDecimal("7.60")),
    CUMULATIVO("Cumulativo (Lucro Presumido)", new BigDecimal("0.65"), new BigDecimal("3.00"));

    private final String rotulo;
    private final BigDecimal aliquotaPis;
    private final BigDecimal aliquotaCofins;

    RegimePisCofins(String rotulo, BigDecimal aliquotaPis, BigDecimal aliquotaCofins) {
        this.rotulo = rotulo;
        this.aliquotaPis = aliquotaPis;
        this.aliquotaCofins = aliquotaCofins;
    }

    public String getRotulo() {
        return rotulo;
    }

    public BigDecimal getAliquotaPis() {
        return aliquotaPis;
    }

    public BigDecimal getAliquotaCofins() {
        return aliquotaCofins;
    }

    public BigDecimal getAliquotaTotal() {
        return aliquotaPis.add(aliquotaCofins);
    }

    public static RegimePisCofins from(String valor) {
        if (valor == null || valor.isBlank()) {
            return NAO_CUMULATIVO;
        }
        try {
            return valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CampoInvalidoException(
                "Regime de PIS/COFINS inválido: " + valor + ". Valores aceitos: NAO_CUMULATIVO, CUMULATIVO.");
        }
    }

}
