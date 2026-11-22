package br.gov.serpro.rtc.api.model.frete;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonInclude;

import br.gov.serpro.rtc.api.model.SerializationVisibility;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Parâmetros de alíquotas aplicáveis a um ano da transição.
 *
 * <p>Os valores de 2026 vêm da tabela oficial de alíquotas de referência da base
 * de dados. A partir de 2027 as alíquotas de referência do IBS e da CBS são
 * definidas anualmente, de modo que a projeção usa uma tabela de referência
 * editável pelo usuário.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ParametrosTransicaoAno implements SerializationVisibility {

    @Schema(description = "Ano de vigência dos parâmetros", example = "2027")
    private Integer ano;

    @Schema(description = "Alíquota nominal da CBS (%)", example = "8.40")
    private BigDecimal cbs;

    @Schema(description = "Alíquota nominal do IBS da UF (%)", example = "0.05")
    private BigDecimal ibsUf;

    @Schema(description = "Alíquota nominal do IBS do município (%)", example = "0.05")
    private BigDecimal ibsMun;

    @Schema(description = "Redução da alíquota de ICMS/ISS na transição (%)", example = "10.00")
    private BigDecimal reducaoIcmsIss;

    @Schema(description = "Fase da transição")
    private FaseTransicao fase;

    @Schema(description = "Rótulo da fase para exibição")
    private String rotulo;

    @Schema(description = "Descrição da fase para exibição")
    private String descricao;

    public static ParametrosTransicaoAno of(int ano, String cbs, String ibsUf, String ibsMun,
            String reducaoIcmsIss, FaseTransicao fase) {
        return ParametrosTransicaoAno.builder()
                .ano(ano)
                .cbs(new BigDecimal(cbs))
                .ibsUf(new BigDecimal(ibsUf))
                .ibsMun(new BigDecimal(ibsMun))
                .reducaoIcmsIss(new BigDecimal(reducaoIcmsIss))
                .fase(fase)
                .rotulo(fase.getRotulo())
                .descricao(fase.getDescricao())
                .build();
    }

    public ParametrosTransicaoAno copiar() {
        return ParametrosTransicaoAno.builder()
                .ano(ano)
                .cbs(cbs)
                .ibsUf(ibsUf)
                .ibsMun(ibsMun)
                .reducaoIcmsIss(reducaoIcmsIss)
                .fase(fase)
                .rotulo(rotulo)
                .descricao(descricao)
                .build();
    }

}
