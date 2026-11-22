package br.gov.serpro.rtc.api.model.frete;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Diagnóstico de prontidão do simulador de frete para uso como produto em uma
 * empresa pagadora: lacunas por dimensão, ondas de evolução e o anexo
 * contratual sugerido para os contratos de transporte.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ProdutoOutput implements SerializationVisibility {

    @Schema(description = "Total de itens avaliados", example = "28")
    private Integer total;

    @Schema(description = "Itens prontos", example = "9")
    private Integer prontos;

    @Schema(description = "Itens parcialmente prontos", example = "7")
    private Integer parciais;

    @Schema(description = "Itens ausentes", example = "12")
    private Integer faltantes;

    @Schema(description = "Percentual de itens prontos (%)", example = "32.14")
    private Double cobertura;

    @Schema(description = "Itens avaliados, agrupados por dimensão")
    private List<LacunaProduto> lacunas;

    @Schema(description = "Cláusulas sugeridas para o anexo tributário do contrato")
    private List<ClausulaContrato> clausulas;

    @Schema(description = "Ondas de evolução do produto")
    private List<OndaProduto> ondas;

    @Schema(description = "Avisos sobre o diagnóstico")
    private List<String> avisos;

}
