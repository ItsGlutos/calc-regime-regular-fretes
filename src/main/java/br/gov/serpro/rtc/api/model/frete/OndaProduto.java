package br.gov.serpro.rtc.api.model.frete;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Onda de evolução do produto, com objetivo e entregas.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class OndaProduto implements SerializationVisibility {

    @Schema(description = "Número da onda", example = "1")
    private Integer numero;

    @Schema(description = "Título da onda", example = "Fechar o ciclo do documento")
    private String titulo;

    @Schema(description = "Objetivo da onda")
    private String objetivo;

    @Schema(description = "Prazo estimado", example = "12 a 16 semanas")
    private String prazo;

    @Schema(description = "Entregas da onda")
    private List<String> entregas;

}
