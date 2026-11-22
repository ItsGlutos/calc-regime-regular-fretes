package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * O mesmo CT-e projetado em outro ano da transição, para mostrar o que muda no
 * pagamento do documento quando a reforma avança.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class AnoComparativoCte implements SerializationVisibility {

    @Schema(description = "Ano do comparativo", example = "2027")
    private Integer ano;

    @Schema(description = "Rótulo da fase da transição", example = "CBS plena")
    private String rotulo;

    @Schema(description = "Fase da transição", example = "CBS_PLENA")
    private String fase;

    @Schema(description = "Valor do documento, mantido constante no comparativo", example = "5955.00")
    private BigDecimal valorDocumento;

    @Schema(description = "Alíquota da CBS (%)", example = "8.40")
    private BigDecimal percentualCbs;

    @Schema(description = "Alíquota do IBS estadual (%)", example = "0.05")
    private BigDecimal percentualIbsUf;

    @Schema(description = "Alíquota do IBS municipal (%)", example = "0.05")
    private BigDecimal percentualIbsMun;

    @Schema(description = "Alíquota do ICMS (%)", example = "7.00")
    private BigDecimal percentualIcms;

    @Schema(description = "Alíquota de PIS/COFINS (%)", example = "0.00")
    private BigDecimal percentualPisCofins;

    @Schema(description = "Valor do IBS e da CBS", example = "506.18")
    private BigDecimal valorIbsCbs;

    @Schema(description = "Valor da CBS", example = "500.22")
    private BigDecimal valorCbs;

    @Schema(description = "Valor do IBS (estadual + municipal)", example = "5.96")
    private BigDecimal valorIbs;

    @Schema(description = "Valor do ICMS", example = "416.85")
    private BigDecimal valorIcms;

    @Schema(description = "Valor de PIS/COFINS", example = "0.00")
    private BigDecimal valorPisCofins;

    @Schema(description = "Total de tributos embutidos no documento", example = "923.03")
    private BigDecimal totalTributos;

    @Schema(description = "Percentual de tributos embutidos no documento (%)", example = "15.50")
    private BigDecimal percentualTotal;

    @Schema(description = "Crédito de IBS/CBS apropriável pela pagadora", example = "506.18")
    private BigDecimal creditoIbsCbs;

    @Schema(description = "Tributo embutido que não se recupera por crédito ou compensação", example = "0.00")
    private BigDecimal custoNaoRecuperavel;

    @Schema(description = "O pagamento sofre segregação (split payment) do IBS/CBS", example = "true")
    private Boolean splitPayment;

    @Schema(description = "Valor segregado no pagamento (split payment)", example = "506.18")
    private BigDecimal valorSplitPayment;

    @Schema(description = "Valor líquido recebido pelo transportador", example = "5459.49")
    private BigDecimal liquidoTransportador;

    @Schema(description = "Observação sobre o ano")
    private String observacao;

}
