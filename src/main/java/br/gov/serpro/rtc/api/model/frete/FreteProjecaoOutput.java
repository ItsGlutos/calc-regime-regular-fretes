package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Resultado da projeção de tributos sobre o frete ao longo da transição da
 * reforma tributária.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class FreteProjecaoOutput implements SerializationVisibility {

    @Schema(description = "Valor do frete utilizado como base de cálculo", example = "10000.00")
    private BigDecimal valorFrete;

    @Schema(description = "Periodicidade do valor informado", example = "MENSAL")
    private String periodicidade;

    @Schema(description = "Mês de referência dos dias úteis", example = "11")
    private Integer mesReferencia;

    @Schema(description = "Dias úteis do período no ano de referência", example = "21")
    private Integer diasUteisReferencia;

    @Schema(description = "Valor do frete por dia útil, em reais", example = "476.19")
    private BigDecimal valorFreteDiario;

    @Schema(description = "Código NBS do serviço de transporte", example = "105011220")
    private String nbs;

    @Schema(description = "Descrição do serviço de transporte", example = "Serviços de transporte rodoviário de carga unitizada")
    private String descricaoNbs;

    @Schema(description = "Código do município do local da operação", example = "4314902")
    private Long municipio;

    @Schema(description = "UF do local da operação", example = "RS")
    private String uf;

    @Schema(description = "Tipo da operação", example = "INTERESTADUAL")
    private String tipoOperacao;

    @Schema(description = "Regime de PIS/COFINS considerado", example = "NAO_CUMULATIVO")
    private String regimePisCofins;

    @Schema(description = "Alíquota de ICMS considerada (%)", example = "12.00")
    private BigDecimal aliquotaIcms;

    @Schema(description = "Alíquota de ISS considerada (%)", example = "0.00")
    private BigDecimal aliquotaIss;

    @Schema(description = "Anos projetados, do ano de referência até o último ano do horizonte")
    private List<AnoProjecao> anos;

    @Schema(description = "Parâmetros de alíquotas usados na projeção")
    private List<ParametrosTransicaoAno> parametros;

    @Schema(description = "Resumo comparativo da projeção")
    private ResumoProjecao resumo;

    @Schema(description = "Blocos de notação por etapa da transição")
    private List<NotaEtapa> notasEtapa;

    @Schema(description = "Avisos sobre premissas adotadas na projeção")
    private List<String> avisos;

    @Schema(description = "Versão da base de dados de referência", example = "V0073")
    private String versaoBaseDados;

    @Schema(description = "Data e hora de geração da projeção")
    private OffsetDateTime geradoEm;

}
