package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Memória de cálculo textual devolvida pela calculadora do regime geral para o
 * item de frete de um ano.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class MemoriaCalculoFrete implements SerializationVisibility {

    @Schema(description = "Memória de cálculo da CBS")
    private String cbs;

    @Schema(description = "Memória de cálculo do IBS da UF")
    private String ibsUf;

    @Schema(description = "Memória de cálculo do IBS do município")
    private String ibsMun;

}
