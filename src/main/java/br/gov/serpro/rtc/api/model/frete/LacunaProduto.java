package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Lacuna do simulador de frete para virar produto de uso contínuo em uma empresa
 * pagadora de frete.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class LacunaProduto implements SerializationVisibility {

    @Schema(description = "Dimensão da lacuna", example = "Fiscal")
    private String dimensao;

    @Schema(description = "Item avaliado", example = "Apuração de créditos por documento")
    private String item;

    @Schema(description = "Situação: PRONTO, PARCIAL ou FALTA", example = "FALTA")
    private String situacao;

    @Schema(description = "Impacto para a empresa pagadora")
    private String impacto;

    @Schema(description = "Próximo passo para fechar a lacuna")
    private String proximoPasso;

    @Schema(description = "Onda do roadmap", example = "2")
    private Integer onda;

    @Schema(description = "Esforço estimado: P, M ou G", example = "G")
    private String esforco;

}
