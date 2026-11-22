package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Opção selecionável em formulários (tipo de operação, regime de PIS/COFINS).
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class OpcaoFrete implements SerializationVisibility {

    @Schema(description = "Valor da opção", example = "INTERESTADUAL")
    private String valor;

    @Schema(description = "Rótulo da opção", example = "Interestadual / intermunicipal (ICMS)")
    private String rotulo;

    @Schema(description = "Descrição da opção")
    private String descricao;

    @Schema(description = "Alíquota sugerida para a opção (%)", example = "12.00")
    private BigDecimal aliquota;

}
