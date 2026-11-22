package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Parcela que compõe o valor da prestação do serviço de transporte no CT-e.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ComponenteCte implements SerializationVisibility {

    @Schema(description = "Código da parcela", example = "FRETE_PESO")
    private String codigo;

    @Schema(description = "Descrição da parcela", example = "Frete-peso")
    private String descricao;

    @Schema(description = "Valor da parcela em reais", example = "4200.00")
    private BigDecimal valor;

    @Schema(description = "Participação da parcela no valor do documento (%)", example = "70.53")
    private BigDecimal percentual;

    @Schema(description = "A parcela integra a base de cálculo dos tributos", example = "true")
    private Boolean incideTributos;

    @Schema(description = "Observação sobre a parcela")
    private String observacao;

}
