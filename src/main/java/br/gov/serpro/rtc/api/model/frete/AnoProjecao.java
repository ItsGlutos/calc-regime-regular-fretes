package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Linha da projeção: os tributos incidentes sobre o frete em determinado ano da
 * transição.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class AnoProjecao implements SerializationVisibility {

    @Schema(description = "Ano de referência", example = "2029")
    private Integer ano;

    @Schema(description = "Rótulo da fase da transição", example = "Transição do IBS")
    private String rotulo;

    @Schema(description = "Fase da transição")
    private FaseTransicao fase;

    @Schema(description = "Dias úteis que compõem o período faturado no ano", example = "21")
    private Integer diasUteis;

    @Schema(description = "Valor do frete no período do ano, em reais", example = "10000.00")
    private BigDecimal valorFretePeriodo;

    @Schema(description = "Valor do frete por dia útil, em reais", example = "434.78")
    private BigDecimal valorFreteDiario;

    @Schema(description = "Alíquota nominal da CBS (%)", example = "8.50")
    private BigDecimal percentualCbs;

    @Schema(description = "Alíquota nominal do IBS da UF (%)", example = "1.60")
    private BigDecimal percentualIbsUf;

    @Schema(description = "Alíquota nominal do IBS do município (%)", example = "0.25")
    private BigDecimal percentualIbsMun;

    @Schema(description = "Alíquota de ICMS aplicada no ano (%)", example = "10.80")
    private BigDecimal percentualIcms;

    @Schema(description = "Alíquota de PIS aplicada no ano (%)", example = "1.65")
    private BigDecimal percentualPis;

    @Schema(description = "Alíquota de COFINS aplicada no ano (%)", example = "7.60")
    private BigDecimal percentualCofins;

    @Schema(description = "Alíquota de ISS aplicada no ano (%)", example = "0.00")
    private BigDecimal percentualIss;

    @Schema(description = "Valor da CBS", example = "850.00")
    private BigDecimal valorCbs;

    @Schema(description = "Valor do IBS da UF", example = "160.00")
    private BigDecimal valorIbsUf;

    @Schema(description = "Valor do IBS do município", example = "25.00")
    private BigDecimal valorIbsMun;

    @Schema(description = "Valor do ICMS", example = "1080.00")
    private BigDecimal valorIcms;

    @Schema(description = "Valor do PIS", example = "165.00")
    private BigDecimal valorPis;

    @Schema(description = "Valor da COFINS", example = "760.00")
    private BigDecimal valorCofins;

    @Schema(description = "Valor do ISS", example = "0.00")
    private BigDecimal valorIss;

    @Schema(description = "Total de tributos destacados na operação", example = "2115.00")
    private BigDecimal totalDestacado;

    @Schema(description = "Total de tributos após as compensações previstas na fase de teste", example = "2115.00")
    private BigDecimal totalEfetivo;

    @Schema(description = "Carga efetiva como percentual do valor do frete", example = "21.15")
    private BigDecimal percentualTotal;

    @Schema(description = "Variação absoluta da carga efetiva em relação ao ano de referência", example = "-10.00")
    private BigDecimal variacaoAbsoluta;

    @Schema(description = "Variação da carga efetiva em pontos percentuais em relação ao ano de referência", example = "-0.10")
    private BigDecimal variacaoPontosPercentuais;

    @Schema(description = "Variação relativa da carga efetiva em relação ao ano de referência (%)", example = "-0.47")
    private BigDecimal variacaoRelativa;

    @Schema(description = "Variação da carga efetiva em relação ao ano anterior, em reais", example = "-75.00")
    private BigDecimal variacaoAnoAnteriorAbsoluta;

    @Schema(description = "Variação da carga efetiva em relação ao ano anterior, em pontos percentuais", example = "-0.75")
    private BigDecimal variacaoAnoAnteriorPontosPercentuais;

    @Schema(description = "Variação da carga efetiva em relação ao ano anterior, em percentual", example = "-3.53")
    private BigDecimal variacaoAnoAnteriorRelativa;

    @Schema(description = "Observação sobre a apuração do ano")
    private String observacao;

    @Schema(description = "Memória de cálculo da CBS, do IBS da UF e do IBS do município")
    private MemoriaCalculoFrete memoriaCalculo;

}
