package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * IBS e CBS destacados em uma prestação de frete, com a memória de cálculo
 * devolvida pelo motor oficial da Receita.
 *
 * <p>É a base do crédito do pagador: o valor aqui apurado é o teto do crédito
 * que o tomador pode aproveitar, independentemente do regime do transportador.</p>
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CreditoFreteOutput implements SerializationVisibility {

    @Schema(description = "Valor do frete", example = "1000.00")
    private BigDecimal valorFrete;

    @Schema(description = "Ano do fato gerador", example = "2033")
    private Integer ano;

    @Schema(description = "Fase da transição", example = "REGIME_PLENO")
    private String fase;

    @Schema(description = "Valor da CBS", example = "85.00")
    private BigDecimal cbs;

    @Schema(description = "Valor do IBS estadual", example = "160.00")
    private BigDecimal ibsUf;

    @Schema(description = "Valor do IBS municipal", example = "25.00")
    private BigDecimal ibsMun;

    @Schema(description = "Total de IBS e CBS", example = "270.00")
    private BigDecimal total;

    @Schema(description = "Percentual efetivo sobre o frete (%)", example = "27.00")
    private BigDecimal percentual;

    @Schema(description = "Alíquota nominal da CBS (%)", example = "8.50")
    private BigDecimal aliquotaCbs;

    @Schema(description = "Alíquota nominal do IBS estadual (%)", example = "16.00")
    private BigDecimal aliquotaIbsUf;

    @Schema(description = "Alíquota nominal do IBS municipal (%)", example = "2.50")
    private BigDecimal aliquotaIbsMun;

    @Schema(description = "Memória de cálculo devolvida pelo motor oficial")
    private MemoriaCalculoFrete memoriaCalculo;

    @Schema(description = "Versão da base de dados de referência", example = "V0073")
    private String versaoBaseDados;

    @Schema(description = "Data e hora do cálculo")
    private OffsetDateTime geradoEm;

}
