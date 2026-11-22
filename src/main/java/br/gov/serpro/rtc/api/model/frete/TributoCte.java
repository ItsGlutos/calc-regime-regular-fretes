package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Tributo destacado no CT-e, com a indicação de quem o apura e se ele gera
 * crédito para a empresa pagadora.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class TributoCte implements SerializationVisibility {

    @Schema(description = "Código do tributo", example = "ICMS")
    private String codigo;

    @Schema(description = "Nome do tributo", example = "ICMS")
    private String nome;

    @Schema(description = "Base de cálculo", example = "5955.00")
    private BigDecimal baseCalculo;

    @Schema(description = "Alíquota aplicada (%)", example = "7.00")
    private BigDecimal aliquota;

    @Schema(description = "Valor do tributo", example = "416.85")
    private BigDecimal valor;

    @Schema(description = "Quem apura e recolhe o tributo")
    private String apuracao;

    @Schema(description = "O tributo gera crédito para a pagadora", example = "true")
    private Boolean creditoPagadora;

    @Schema(description = "Fundamento normativo")
    private String fundamento;

    @Schema(description = "Observação sobre o destaque")
    private String observacao;

}
