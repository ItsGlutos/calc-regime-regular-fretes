package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Bloco de notação de uma etapa da transição: o que muda em relação ao ano
 * anterior, como o método antigo tributava o frete e qual é o efeito na carga.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class NotaEtapa implements SerializationVisibility {

    @Schema(description = "Ano da etapa", example = "2027")
    private Integer ano;

    @Schema(description = "Rótulo da etapa", example = "CBS cheia, IBS em teste")
    private String rotulo;

    @Schema(description = "Fase da transição")
    private FaseTransicao fase;

    @Schema(description = "Resumo do efeito no ano", example = "De R$ 2.125,00 para R$ 2.050,00: -R$ 75,00 (-0,75 p.p.)")
    private String resumo;

    @Schema(description = "Mudanças tributo a tributo em relação ao ano anterior")
    private List<String> mudancas;

    @Schema(description = "Comparação com o método de tributação anterior à reforma")
    private String comparacaoMetodoAnterior;

    @Schema(description = "Efeito absoluto na carga do período", example = "-75.00")
    private BigDecimal efeitoAbsoluto;

    @Schema(description = "Efeito em pontos percentuais sobre o frete", example = "-0.75")
    private BigDecimal efeitoPontosPercentuais;

    @Schema(description = "Efeito relativo em relação ao ano anterior (%)", example = "-3.53")
    private BigDecimal efeitoRelativo;

    @Schema(description = "Fundamento normativo da etapa", example = "ADCT (EC 132/2023), arts. 125 a 129")
    private String fundamento;

}
