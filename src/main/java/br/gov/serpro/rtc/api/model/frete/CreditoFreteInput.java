package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Consulta do IBS/CBS destacado em uma prestação de frete, para o pagador
 * calcular o crédito que pode aproveitar.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CreditoFreteInput implements SerializationVisibility {

    @Schema(description = "Valor do frete, base do IBS e da CBS", example = "1000.00")
    private BigDecimal valorFrete;

    @Schema(description = "Ano do fato gerador; quando ausente usa o ano corrente", example = "2033")
    private Integer ano;

    @Schema(description = "UF do local da prestação", example = "SP")
    private String uf;

    @Schema(description = "Código IBGE do município; quando ausente usa a capital da UF", example = "3550308")
    private Long municipio;

    @Schema(description = "Código NBS do serviço de transporte", example = "105011220")
    private String nbs;

}
