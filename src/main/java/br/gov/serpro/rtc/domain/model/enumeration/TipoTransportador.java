package br.gov.serpro.rtc.domain.model.enumeration;

import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Tipo de transportador contratado, que define quais retenções a empresa
 * pagadora pratica no pagamento do frete.
 *
 * <p>A empresa de transporte (TDE) recolhe as contribuições sobre a própria
 * folha e emite o CT-e com o IRRF retido pelo tomador. O transportador autônomo
 * de cargas (TAC) sofre, além do IRRF, a retenção previdenciária e o desconto
 * das contribuições do SEST/SENAT pela empresa contratante.</p>
 */
public enum TipoTransportador {

    TDE("Empresa de transporte (TDE)", true, false, false),
    TAC("Transportador autônomo (TAC)", true, true, true);

    private final String rotulo;
    private final boolean retemIrrf;
    private final boolean retemInss;
    private final boolean retemSestSenat;

    TipoTransportador(String rotulo, boolean retemIrrf, boolean retemInss, boolean retemSestSenat) {
        this.rotulo = rotulo;
        this.retemIrrf = retemIrrf;
        this.retemInss = retemInss;
        this.retemSestSenat = retemSestSenat;
    }

    public String getRotulo() {
        return rotulo;
    }

    public boolean isRetemIrrf() {
        return retemIrrf;
    }

    public boolean isRetemInss() {
        return retemInss;
    }

    public boolean isRetemSestSenat() {
        return retemSestSenat;
    }

    public static TipoTransportador from(String valor) {
        if (valor == null || valor.isBlank()) {
            return TDE;
        }
        try {
            return valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CampoInvalidoException(
                "Tipo de transportador inválido: " + valor + ". Valores aceitos: TDE, TAC.");
        }
    }

}
