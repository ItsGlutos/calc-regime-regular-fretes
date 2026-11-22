package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Linha da tabela de alíquotas do ICMS interestadual (Resolução do Senado Federal
 * nº 22/1989), com origem e destino agrupados por região.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class TabelaIcmsLinha implements SerializationVisibility {

    @Schema(description = "Região de origem", example = "Sudeste (exceto ES)")
    private String origem;

    @Schema(description = "Região de destino", example = "Nordeste")
    private String destino;

    @Schema(description = "Alíquota interestadual (%)", example = "7.00")
    private BigDecimal aliquota;

}
