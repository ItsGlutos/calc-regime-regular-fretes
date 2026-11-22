package br.gov.serpro.rtc.domain.model.enumeration;

/**
 * Regiões usadas na tabela de alíquotas do ICMS interestadual.
 *
 * <p>A divisão segue a Resolução do Senado Federal nº 22/1989, que trata o
 * Espírito Santo separadamente do restante do Sudeste e agrupa as regiões Norte,
 * Nordeste e Centro-Oeste como destino das alíquotas reduzidas.</p>
 */
public enum RegiaoIcms {

    NORTE("Norte", false),
    NORDESTE("Nordeste", false),
    CENTRO_OESTE("Centro-Oeste", false),
    SUDESTE_EXCETO_ES("Sudeste (exceto ES)", true),
    ESPIRITO_SANTO("Espírito Santo", false),
    SUL("Sul", true);

    private final String rotulo;
    private final boolean origemSulSudeste;

    RegiaoIcms(String rotulo, boolean origemSulSudeste) {
        this.rotulo = rotulo;
        this.origemSulSudeste = origemSulSudeste;
    }

    public String getRotulo() {
        return rotulo;
    }

    /**
     * Indica se a região é origem da alíquota reduzida de 7% quando o destino está
     * no Norte, Nordeste, Centro-Oeste ou no Espírito Santo.
     */
    public boolean isOrigemSulSudeste() {
        return origemSulSudeste;
    }

}
