package br.gov.serpro.rtc.domain.model.enumeration;

/**
 * Fases da transição da reforma tributária do consumo (LC 214/2025) usadas na
 * projeção de carga tributária do frete.
 *
 * <p>Cada fase indica qual conjunto de tributos incide na operação naquele ano:
 * o regime anterior (ICMS/PIS/COFINS/ISS), a fase de teste de 2026, a CBS plena
 * com IBS em alíquota reduzida, a transição gradual do IBS ou o regime pleno.</p>
 */
public enum FaseTransicao {

    REFERENCIA("Antes da reforma", "Regime anterior: ICMS, PIS/COFINS e ISS."),
    TESTE("Fase de teste", "CBS de 0,90% e IBS de 0,10% destacados, compensáveis com PIS/COFINS e ICMS."),
    CBS_PLENA("CBS cheia, IBS em teste", "PIS/COFINS extintos; CBS integral e IBS de 0,10% (0,05% UF + 0,05% município)."),
    TRANSICAO_IBS("Transição do IBS", "IBS cresce em frações da alíquota de referência e ICMS/ISS caem na mesma proporção."),
    REGIME_PLENO("Regime pleno", "ICMS e ISS extintos; CBS e IBS integrais.");

    private final String rotulo;
    private final String descricao;

    FaseTransicao(String rotulo, String descricao) {
        this.rotulo = rotulo;
        this.descricao = descricao;
    }

    public String getRotulo() {
        return rotulo;
    }

    public String getDescricao() {
        return descricao;
    }

}
