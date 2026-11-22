package br.gov.serpro.rtc.domain.model.enumeration;

import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Regime tributário da empresa pagadora, que define quanto da carga embutida no
 * frete ela consegue recuperar por crédito.
 */
public enum RegimePagadora {

    REGIME_REGULAR("Regime regular (crédito integral)", true),
    SIMPLES("Simples Nacional (sem crédito)", false);

    private final String rotulo;
    private final boolean aproveitaCredito;

    RegimePagadora(String rotulo, boolean aproveitaCredito) {
        this.rotulo = rotulo;
        this.aproveitaCredito = aproveitaCredito;
    }

    public String getRotulo() {
        return rotulo;
    }

    public boolean isAproveitaCredito() {
        return aproveitaCredito;
    }

    public static RegimePagadora from(String valor) {
        if (valor == null || valor.isBlank()) {
            return REGIME_REGULAR;
        }
        try {
            return valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CampoInvalidoException(
                "Regime da pagadora inválido: " + valor + ". Valores aceitos: REGIME_REGULAR, SIMPLES.");
        }
    }

}
