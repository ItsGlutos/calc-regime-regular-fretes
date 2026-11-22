package br.gov.serpro.rtc.api.model.frete;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Opções de enquadramento usadas na simulação de pagamento de CT-e.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CteParametrosOutput implements SerializationVisibility {

    @Schema(description = "Tipos de transportador disponíveis")
    private List<OpcaoFrete> tiposTransportador;

    @Schema(description = "Regimes da empresa pagadora")
    private List<OpcaoFrete> regimesPagadora;

    @Schema(description = "Anos cobertos pelo simulador de CT-e")
    private List<Integer> anosDisponiveis;

    @Schema(description = "Data de referência usada no exemplo", example = "2026-11-20")
    private LocalDate dataReferencia;

}
