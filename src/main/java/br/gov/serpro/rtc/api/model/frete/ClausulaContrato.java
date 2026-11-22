package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Cláusula do anexo tributário do contrato de transporte de cargas.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ClausulaContrato implements SerializationVisibility {

    @Schema(description = "Número da cláusula", example = "4")
    private Integer numero;

    @Schema(description = "Título da cláusula", example = "Neutralidade tributária")
    private String titulo;

    @Schema(description = "Razão pela qual a cláusula existe")
    private String porque;

    @Schema(description = "Texto sugerido da cláusula")
    private String texto;

    @Schema(description = "Base normativa")
    private String base;

}
