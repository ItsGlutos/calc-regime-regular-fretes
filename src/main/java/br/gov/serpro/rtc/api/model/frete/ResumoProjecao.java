package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Resumo comparativo da projeção: carga tributária do frete antes da reforma,
 * no regime pleno e a diferença entre os dois cenários.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ResumoProjecao implements SerializationVisibility {

    @Schema(description = "Ano de referência (antes da reforma)", example = "2025")
    private Integer anoReferencia;

    @Schema(description = "Carga tributária efetiva no ano de referência", example = "2125.00")
    private BigDecimal cargaReferencia;

    @Schema(description = "Carga tributária efetiva no ano de referência (%)", example = "21.25")
    private BigDecimal percentualReferencia;

    @Schema(description = "Primeiro ano do regime pleno", example = "2033")
    private Integer anoRegimePleno;

    @Schema(description = "Carga tributária efetiva no regime pleno", example = "2700.00")
    private BigDecimal cargaRegimePleno;

    @Schema(description = "Carga tributária efetiva no regime pleno (%)", example = "27.00")
    private BigDecimal percentualRegimePleno;

    @Schema(description = "Diferença absoluta entre o regime pleno e o ano de referência", example = "575.00")
    private BigDecimal diferencaAbsoluta;

    @Schema(description = "Diferença em pontos percentuais entre o regime pleno e o ano de referência", example = "5.75")
    private BigDecimal diferencaPontosPercentuais;

    @Schema(description = "Variação relativa entre o regime pleno e o ano de referência (%)", example = "27.06")
    private BigDecimal variacaoRelativa;

    @Schema(description = "Primeiro ano em que a carga efetiva supera a do ano de referência", example = "2030")
    private Integer anoPrimeiroAumento;

    @Schema(description = "Ano de maior carga efetiva na série", example = "2033")
    private Integer anoMaiorCarga;

    @Schema(description = "Maior carga efetiva da série", example = "2700.00")
    private BigDecimal maiorCarga;

    @Schema(description = "Carga tributária média ponderada por ano civil da série", example = "2359.44")
    private BigDecimal cargaMediaAnual;

}
