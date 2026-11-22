package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Retenção praticada pela empresa pagadora no pagamento do CT-e.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class RetencaoCte implements SerializationVisibility {

    @Schema(description = "Código da retenção", example = "IRRF")
    private String codigo;

    @Schema(description = "Nome da retenção", example = "IRRF")
    private String nome;

    @Schema(description = "Base de cálculo da retenção", example = "5955.00")
    private BigDecimal baseCalculo;

    @Schema(description = "Alíquota aplicada (%)", example = "1.50")
    private BigDecimal aliquota;

    @Schema(description = "Valor retido", example = "89.33")
    private BigDecimal valor;

    @Schema(description = "Fundamento normativo")
    private String fundamento;

    @Schema(description = "Quem recolhe o valor retido", example = "Pagadora (DARF)")
    private String recolhimento;

}
