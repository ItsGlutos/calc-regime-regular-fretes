package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Item da conferência do CT-e no momento do pagamento.
 *
 * <p>Separa o que a versão atual já valida sozinha do que ainda depende de
 * integração (SEFAZ, MDF-e, ANTT) ou de conferência manual — é o retrato das
 * lacunas do produto aplicadas a um documento real.</p>
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ConferenciaCte implements SerializationVisibility {

    @Schema(description = "Item conferido", example = "Chave de acesso")
    private String item;

    @Schema(description = "Situação: OK, ATENCAO, PENDENTE ou MANUAL", example = "OK")
    private String situacao;

    @Schema(description = "Detalhe da conferência")
    private String detalhe;

    @Schema(description = "Origem da verificação: CALCULO, INTEGRACAO ou CONTRATO", example = "CALCULO")
    private String origem;

}
