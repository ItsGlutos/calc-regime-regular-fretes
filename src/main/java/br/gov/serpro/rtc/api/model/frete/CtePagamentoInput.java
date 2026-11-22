package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entrada da simulação de pagamento de um CT-e na data de referência.
 *
 * <p>Representa o documento que a empresa pagadora recebe do transportador: a
 * composição do frete, os dados de emissão e as escolhas de apuração da
 * pagadora (retenções e créditos).</p>
 */
@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class CtePagamentoInput implements SerializationVisibility {

    @Schema(description = "Número do CT-e", example = "458")
    private String numeroCte;

    @Schema(description = "Série do CT-e", example = "1")
    private String serie;

    @Schema(description = "Chave de acesso com 44 dígitos; quando ausente é calculada a partir dos dados do documento")
    private String chaveAcesso;

    @Schema(description = "Data de emissão do CT-e", example = "2026-11-05")
    private LocalDate dataEmissao;

    @Schema(description = "Data de pagamento do CT-e", example = "2026-11-20")
    private LocalDate dataPagamento;

    @Schema(description = "Razão social do transportador emitente", example = "Transportes Vale do Rio Ltda.")
    private String emitenteNome;

    @Schema(description = "CNPJ do transportador emitente", example = "12.345.678/0001-90")
    private String emitenteCnpj;

    @Schema(description = "Registro Nacional de Transportadores Rodoviários de Cargas", example = "12345678")
    private String emitenteRntrc;

    @Schema(description = "Razão social da empresa pagadora (tomadora do serviço)")
    private String tomadorNome;

    @Schema(description = "CNPJ da empresa pagadora")
    private String tomadorCnpj;

    @Schema(description = "UF de origem da prestação", example = "SP")
    private String ufOrigem;

    @Schema(description = "UF de destino da prestação", example = "BA")
    private String ufDestino;

    @Schema(description = "Código IBGE do município da prestação; quando ausente usa a capital da UF de destino")
    private Long municipio;

    @Schema(description = "Código NBS do serviço de transporte", example = "105011220")
    private String nbs;

    @Schema(description = "Tipo de operação: INTERESTADUAL, INTERNA ou MUNICIPAL", example = "INTERESTADUAL")
    private String tipoOperacao;

    @Schema(description = "Regime de PIS/COFINS do transportador", example = "NAO_CUMULATIVO")
    private String regimePisCofins;

    @Schema(description = "Tipo de transportador: TDE (empresa) ou TAC (autônomo)", example = "TDE")
    private String tipoTransportador;

    @Schema(description = "Regime da pagadora: REGIME_REGULAR ou SIMPLES", example = "REGIME_REGULAR")
    private String regimePagadora;

    @Schema(description = "Valor da mercadoria transportada, base do frete-valor e do GRIS", example = "350000.00")
    private BigDecimal valorMercadoria;

    @Schema(description = "Frete-peso (parcela pelo peso/volume)", example = "4200.00")
    private BigDecimal fretePeso;

    @Schema(description = "Frete-valor (ad valorem sobre o valor da mercadoria)", example = "1050.00")
    private BigDecimal freteValor;

    @Schema(description = "GRIS — gerenciamento de risco", example = "525.00")
    private BigDecimal gris;

    @Schema(description = "Pedágio cobrado na composição do frete", example = "0.00")
    private BigDecimal pedagio;

    @Schema(description = "Taxas de coleta e entrega", example = "180.00")
    private BigDecimal taxas;

    @Schema(description = "Outros serviços (estadia, diária, agendamento)", example = "0.00")
    private BigDecimal outros;

    @Schema(description = "Desconto comercial concedido", example = "0.00")
    private BigDecimal desconto;

    @Schema(description = "Vale-pedágio obrigatório, antecipado pela pagadora e fora da remuneração do frete",
            example = "320.00")
    private BigDecimal valePedagio;

    @Schema(description = "Alíquota de ICMS (%); quando ausente usa a tabela interestadual oficial", example = "7.00")
    private BigDecimal aliquotaIcms;

    @Schema(description = "Alíquota de ISS (%) para operação municipal", example = "5.00")
    private BigDecimal aliquotaIss;

    @Schema(description = "Alíquota de IRRF (%)", example = "1.50")
    private BigDecimal aliquotaIrrf;

    @Schema(description = "Alíquota de INSS retido (%)", example = "11.00")
    private BigDecimal aliquotaInss;

    @Schema(description = "Alíquota de SEST/SENAT (%)", example = "2.50")
    private BigDecimal aliquotaSestSenat;

    @Schema(description = "Retém IRRF sobre o frete", example = "true")
    private Boolean reterIrrf;

    @Schema(description = "Retém INSS sobre o frete", example = "false")
    private Boolean reterInss;

    @Schema(description = "Retém SEST/SENAT sobre o frete", example = "false")
    private Boolean reterSestSenat;

    @Schema(description = "A pagadora toma crédito de ICMS sobre o frete", example = "true")
    private Boolean tomaCreditoIcms;

    @Schema(description = "A pagadora toma crédito de PIS/COFINS sobre o frete", example = "true")
    private Boolean tomaCreditoPisCofins;

}
