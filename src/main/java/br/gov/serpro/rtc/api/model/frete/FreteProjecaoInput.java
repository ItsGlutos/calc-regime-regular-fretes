package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entrada da projeção de tributos incidentes sobre o frete na transição da
 * reforma tributária.
 *
 * <p>O cálculo do IBS e da CBS de cada ano é delegado à calculadora do regime
 * geral (mesma base oficial, cClassTrib 000001 e CT-e), enquanto os tributos do
 * regime anterior (ICMS, PIS, COFINS e ISS) são compostos a partir das
 * alíquotas informadas e do cronograma de extinção da LC 214/2025.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class FreteProjecaoInput implements SerializationVisibility {

    @NotNull
    @DecimalMin(value = "0.01")
    @DecimalMax(value = "9999999999999.99")
    @Digits(integer = 13, fraction = 2)
    @Schema(description = "Valor do frete no período informado (dia útil, quinzena ou mês), em reais", example = "10000.00")
    private BigDecimal valorFrete;

    @Schema(description = "Periodicidade do valor informado: DIARIO, QUINZENAL ou MENSAL", example = "MENSAL")
    private String periodicidade;

    @Min(1)
    @Max(12)
    @Schema(description = "Mês de referência usado para contar os dias úteis do período", example = "11")
    private Integer mesReferencia;

    @Schema(description = "Código NBS do serviço de transporte de cargas", example = "105011220")
    private String nbs;

    @Schema(description = "Código do município (IBGE) do local da operação", example = "4314902")
    @Min(0)
    @Max(9999999)
    private Long municipio;

    @Size(min = 2, max = 2)
    @Schema(description = "Sigla da UF do local da operação", example = "RS")
    private String uf;

    @Size(min = 2, max = 2)
    @Schema(description = "UF de origem do transporte, usada na tabela de ICMS interestadual", example = "SP")
    private String ufOrigem;

    @Size(min = 2, max = 2)
    @Schema(description = "UF de destino do transporte, usada na tabela de ICMS interestadual", example = "BA")
    private String ufDestino;

    @Schema(description = "Tipo da operação: INTERESTADUAL, INTERNA ou MUNICIPAL", example = "INTERESTADUAL")
    private String tipoOperacao;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    @Digits(integer = 3, fraction = 4)
    @Schema(description = "Alíquota do ICMS aplicável (%). Em operações interestaduais com origem e destino informados, prevalece a tabela oficial", example = "12.00")
    private BigDecimal aliquotaIcms;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    @Digits(integer = 3, fraction = 4)
    @Schema(description = "Alíquota do ISS aplicável (%)", example = "0.00")
    private BigDecimal aliquotaIss;

    @Schema(description = "Regime de PIS/COFINS: NAO_CUMULATIVO ou CUMULATIVO", example = "NAO_CUMULATIVO")
    private String regimePisCofins;

    @Schema(description = "Indica se a memória de cálculo da calculadora deve ser retornada em cada ano", example = "true")
    private Boolean incluirMemoriaCalculo;

    @Valid
    @Schema(description = "Sobrescreve as alíquotas de referência de um ou mais anos (a partir de 2027)")
    private List<ParametrosTransicaoAno> parametrosTransicao;

}
