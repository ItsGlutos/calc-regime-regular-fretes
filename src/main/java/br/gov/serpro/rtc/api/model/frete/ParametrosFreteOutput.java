package br.gov.serpro.rtc.api.model.frete;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Parâmetros de referência do simulador de frete: horizonte da projeção,
 * catálogo de serviços de transporte, opções de tributação e cronograma de
 * alíquotas da transição.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ParametrosFreteOutput implements SerializationVisibility {

    @Schema(description = "Ano de referência do regime anterior", example = "2025")
    private Integer anoReferencia;

    @Schema(description = "Primeiro ano projetado sob a reforma", example = "2026")
    private Integer anoInicial;

    @Schema(description = "Último ano do horizonte de projeção", example = "2034")
    private Integer anoFinal;

    @Schema(description = "Primeiro ano do regime pleno", example = "2033")
    private Integer anoRegimePleno;

    @Schema(description = "Moeda dos valores", example = "BRL")
    private String moeda;

    @Schema(description = "Versão da base de dados de referência", example = "V0073")
    private String versaoBaseDados;

    @Schema(description = "Serviços de transporte de cargas disponíveis para simulação")
    private List<ServicoFrete> servicosFrete;

    @Schema(description = "Periodicidades de faturamento disponíveis")
    private List<OpcaoFrete> periodicidades;

    @Schema(description = "Unidades federativas para origem e destino")
    private List<OpcaoFrete> ufs;

    @Schema(description = "Tabela de alíquotas do ICMS interestadual (Resolução do Senado Federal nº 22/1989)")
    private List<TabelaIcmsLinha> tabelaIcmsInterestadual;

    @Schema(description = "Tipos de operação disponíveis")
    private List<OpcaoFrete> tiposOperacao;

    @Schema(description = "Regimes de PIS/COFINS disponíveis")
    private List<OpcaoFrete> regimesPisCofins;

    @Schema(description = "Cronograma de alíquotas da transição")
    private List<ParametrosTransicaoAno> parametrosTransicao;

    @Schema(description = "Notas metodológicas da projeção")
    private List<String> notas;

}
