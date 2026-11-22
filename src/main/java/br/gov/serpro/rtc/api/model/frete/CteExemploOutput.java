package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Exemplo completo de CT-e: a entrada usada no simulador e o resultado do
 * pagamento. Permite que a interface carregue o documento e o altere sem
 * reconstruir os dados manualmente.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CteExemploOutput implements SerializationVisibility {

    @Schema(description = "Entrada do exemplo, reutilizável em novas simulações")
    private CtePagamentoInput entrada;

    @Schema(description = "Resultado do pagamento do exemplo")
    private CtePagamentoOutput resultado;

}
