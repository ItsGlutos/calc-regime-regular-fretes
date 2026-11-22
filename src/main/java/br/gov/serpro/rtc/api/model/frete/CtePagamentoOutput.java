package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Resultado da simulação de pagamento de um CT-e: composição do documento,
 * tributos destacados, retenções, créditos e o comparativo com os próximos anos
 * da transição.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CtePagamentoOutput implements SerializationVisibility {

    @Schema(description = "Número do CT-e", example = "458")
    private String numeroCte;

    @Schema(description = "Série do CT-e", example = "1")
    private String serie;

    @Schema(description = "Chave de acesso do CT-e", example = "35261112345678000190570010000004581100000007")
    private String chaveAcesso;

    @Schema(description = "Data de emissão", example = "2026-11-05")
    private LocalDate dataEmissao;

    @Schema(description = "Data de pagamento", example = "2026-11-20")
    private LocalDate dataPagamento;

    @Schema(description = "Razão social do transportador", example = "Transportes Vale do Rio Ltda.")
    private String emitenteNome;

    @Schema(description = "CNPJ do transportador", example = "12.345.678/0001-90")
    private String emitenteCnpj;

    @Schema(description = "RNTRC do transportador", example = "12345678")
    private String emitenteRntrc;

    @Schema(description = "Razão social da pagadora")
    private String tomadorNome;

    @Schema(description = "CNPJ da pagadora")
    private String tomadorCnpj;

    @Schema(description = "UF de origem", example = "SP")
    private String ufOrigem;

    @Schema(description = "UF de destino", example = "BA")
    private String ufDestino;

    @Schema(description = "Rota da prestação", example = "SP → BA")
    private String rota;

    @Schema(description = "Tipo da operação", example = "INTERESTADUAL")
    private String tipoOperacao;

    @Schema(description = "Tipo de transportador", example = "TDE")
    private String tipoTransportador;

    @Schema(description = "Regime da pagadora", example = "REGIME_REGULAR")
    private String regimePagadora;

    @Schema(description = "Código NBS do serviço", example = "105011220")
    private String nbs;

    @Schema(description = "Descrição do serviço", example = "Serviços de transporte rodoviário de carga unitizada")
    private String descricaoNbs;

    @Schema(description = "Código IBGE do município da prestação", example = "2927408")
    private Long municipio;

    @Schema(description = "Regime de PIS/COFINS do transportador", example = "NAO_CUMULATIVO")
    private String regimePisCofins;

    @Schema(description = "Ano do fato gerador do pagamento", example = "2026")
    private Integer anoReferencia;

    @Schema(description = "Fase da transição no ano de referência", example = "TESTE")
    private String fase;

    @Schema(description = "Valor da mercadoria transportada", example = "350000.00")
    private BigDecimal valorMercadoria;

    @Schema(description = "Base de cálculo dos tributos (valor da prestação)", example = "5955.00")
    private BigDecimal baseCalculo;

    @Schema(description = "Vale-pedágio antecipado, fora da remuneração do frete", example = "320.00")
    private BigDecimal valePedagio;

    @Schema(description = "Desembolso total da pagadora (documento + vale-pedágio)", example = "6275.00")
    private BigDecimal desembolsoTotal;

    @Schema(description = "Parcelas que compõem o valor do documento")
    private List<ComponenteCte> componentes;

    @Schema(description = "Tributos destacados no documento")
    private List<TributoCte> tributos;

    @Schema(description = "Retenções aplicadas no pagamento")
    private List<RetencaoCte> retencoes;

    @Schema(description = "Total de tributos embutidos no documento", example = "1027.25")
    private BigDecimal totalTributos;

    @Schema(description = "Percentual de tributos embutidos no documento (%)", example = "17.25")
    private BigDecimal percentualTributos;

    @Schema(description = "Total de créditos apropriáveis pela pagadora", example = "967.69")
    private BigDecimal creditoTotal;

    @Schema(description = "Crédito de ICMS", example = "416.85")
    private BigDecimal creditoIcms;

    @Schema(description = "Crédito de PIS/COFINS", example = "550.84")
    private BigDecimal creditoPisCofins;

    @Schema(description = "Crédito de IBS/CBS", example = "0.00")
    private BigDecimal creditoIbsCbs;

    @Schema(description = "Tributo embutido sem crédito nem compensação", example = "0.00")
    private BigDecimal custoNaoRecuperavel;

    @Schema(description = "Percentual do documento sem recuperação tributária (%)", example = "0.00")
    private BigDecimal percentualCustoNaoRecuperavel;

    @Schema(description = "Total de retenções", example = "89.33")
    private BigDecimal totalRetencoes;

    @Schema(description = "Valor líquido pago ao transportador", example = "5865.67")
    private BigDecimal liquidoTransportador;

    @Schema(description = "O mesmo documento nos próximos anos da transição")
    private List<AnoComparativoCte> comparativo;

    @Schema(description = "Conferências aplicadas ao documento")
    private List<ConferenciaCte> conferencias;

    @Schema(description = "Premissas adotadas no cálculo")
    private List<String> premissas;

    @Schema(description = "Versão da base de dados de referência", example = "V0073")
    private String versaoBaseDados;

    @Schema(description = "Data e hora de geração")
    private OffsetDateTime geradoEm;

}
