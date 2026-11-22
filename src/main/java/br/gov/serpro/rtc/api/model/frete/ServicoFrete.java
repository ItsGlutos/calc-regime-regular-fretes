package br.gov.serpro.rtc.api.model.frete;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Serviço de transporte de cargas disponível para simulação, identificado pelo
 * código NBS.
 */
@Getter
@Setter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ServicoFrete implements SerializationVisibility {

    @Schema(description = "Código NBS", example = "105011220")
    private String nbs;

    @Schema(description = "Descrição do serviço", example = "Transporte rodoviário de carga unitizada")
    private String descricao;

    @Schema(description = "Modal de transporte", example = "RODOVIARIO")
    private String modal;

}
