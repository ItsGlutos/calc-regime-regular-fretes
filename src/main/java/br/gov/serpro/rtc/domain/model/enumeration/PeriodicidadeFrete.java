package br.gov.serpro.rtc.domain.model.enumeration;

import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Periodicidade do faturamento do frete.
 *
 * <p>A projeção trabalha sempre com dias úteis (segunda a sexta), sem considerar
 * feriados: a quantidade de dias úteis de cada mês varia de ano para ano e é o
 * que faz o valor do período mudar mesmo com o preço por dia útil constante.</p>
 */
public enum PeriodicidadeFrete {

    DIARIO("Diário", "Valor de um dia útil de operação.", 1),

    QUINZENAL("Quinzenal", "Valor de meia quinzena: metade dos dias úteis do mês.", 2),

    MENSAL("Mensal", "Valor de um mês cheio de operação: todos os dias úteis do mês.", 0);

    private final String rotulo;
    private final String descricao;
    private final int divisorDiasUteis;

    PeriodicidadeFrete(String rotulo, String descricao, int divisorDiasUteis) {
        this.rotulo = rotulo;
        this.descricao = descricao;
        this.divisorDiasUteis = divisorDiasUteis;
    }

    public String getRotulo() {
        return rotulo;
    }

    public String getDescricao() {
        return descricao;
    }

    public int getDivisorDiasUteis() {
        return divisorDiasUteis;
    }

    public static PeriodicidadeFrete from(String valor) {
        if (valor == null || valor.isBlank()) {
            return MENSAL;
        }
        try {
            return valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new CampoInvalidoException(
                "Periodicidade inválida: " + valor + ". Valores aceitos: DIARIO, QUINZENAL, MENSAL.");
        }
    }

}
