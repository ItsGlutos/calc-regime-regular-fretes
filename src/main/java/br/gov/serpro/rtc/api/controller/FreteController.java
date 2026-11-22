package br.gov.serpro.rtc.api.controller;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.gov.serpro.rtc.api.model.frete.CreditoFreteInput;
import br.gov.serpro.rtc.api.model.frete.CreditoFreteOutput;
import br.gov.serpro.rtc.api.model.frete.FreteProjecaoInput;
import br.gov.serpro.rtc.api.model.frete.FreteProjecaoOutput;
import br.gov.serpro.rtc.api.model.frete.ParametrosFreteOutput;
import br.gov.serpro.rtc.api.model.frete.ProdutoOutput;
import br.gov.serpro.rtc.domain.service.VersaoBaseDadosService;
import br.gov.serpro.rtc.domain.service.frete.CreditoFreteService;
import br.gov.serpro.rtc.domain.service.frete.FreteCatalogoService;
import br.gov.serpro.rtc.domain.service.frete.FreteProjecaoService;
import br.gov.serpro.rtc.domain.service.frete.IcmsInterestadualService;
import br.gov.serpro.rtc.domain.service.frete.ProdutoFreteService;
import br.gov.serpro.rtc.domain.service.frete.TransicaoTributariaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Endpoints do simulador de frete da reforma tributária.
 *
 * <p>Expõe os parâmetros de referência (catálogo de serviços, cronograma de
 * alíquotas e notas metodológicas) e a projeção da carga tributária do frete
 * ano a ano, do regime anterior ao regime pleno.</p>
 */
@Tag(name = "Frete", description = "Projeção da carga tributária do frete na transição da reforma tributária")
@RequiredArgsConstructor
@RestController
@RequestMapping("calculadora/frete")
public class FreteController {

    private static final String MOEDA = "BRL";

    private final FreteProjecaoService freteProjecaoService;
    private final FreteCatalogoService freteCatalogoService;
    private final TransicaoTributariaService transicaoTributariaService;
    private final IcmsInterestadualService icmsInterestadualService;
    private final CreditoFreteService creditoFreteService;
    private final ProdutoFreteService produtoFreteService;
    private final VersaoBaseDadosService versaoBaseDadosService;

    @Operation(summary = "Parâmetros de referência do simulador de frete")
    @GetMapping(value = "parametros", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<ParametrosFreteOutput> parametros() {
        return ResponseEntity.ok(ParametrosFreteOutput.builder()
                .anoReferencia(TransicaoTributariaService.ANO_REFERENCIA)
                .anoInicial(TransicaoTributariaService.ANO_INICIAL)
                .anoFinal(TransicaoTributariaService.ANO_FINAL)
                .anoRegimePleno(TransicaoTributariaService.ANO_REGIME_PLENO)
                .moeda(MOEDA)
                .versaoBaseDados(versaoBaseDados())
                .servicosFrete(freteCatalogoService.listarServicos())
                .periodicidades(freteCatalogoService.listarPeriodicidades())
                .ufs(icmsInterestadualService.listarUfs())
                .tabelaIcmsInterestadual(icmsInterestadualService.tabela())
                .tiposOperacao(freteCatalogoService.listarTiposOperacao())
                .regimesPisCofins(freteCatalogoService.listarRegimesPisCofins())
                .parametrosTransicao(transicaoTributariaService.tabelaPadrao())
                .notas(notasMetodologicas())
                .build());
    }

    @Operation(summary = "Projeta a carga tributária do frete ao longo da transição")
    @PostMapping(value = "projecao", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<FreteProjecaoOutput> projetar(@RequestBody @Valid FreteProjecaoInput entrada) {
        return ResponseEntity.ok(freteProjecaoService.projetar(entrada));
    }

    @Operation(summary = "IBS e CBS destacados no frete, base do crédito do pagador")
    @PostMapping(value = "credito", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<CreditoFreteOutput> credito(@RequestBody CreditoFreteInput entrada) {
        return ResponseEntity.ok(creditoFreteService.calcular(entrada));
    }

    @Operation(summary = "Diagnóstico das lacunas para transformar o simulador em produto")
    @GetMapping(value = "produto", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<ProdutoOutput> produto() {
        return ResponseEntity.ok(produtoFreteService.produto());
    }

    @Operation(summary = "Anexo tributário do contrato de transporte em markdown")
    @GetMapping(value = "produto/anexo", produces = "text/markdown;charset=UTF-8")
    public ResponseEntity<String> anexoContratual() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"anexo-tributario-frete.md\"")
                .contentType(MediaType.valueOf("text/markdown;charset=UTF-8"))
                .body(produtoFreteService.anexoMarkdown());
    }

    private List<String> notasMetodologicas() {
        return List.of(
            "O transporte de cargas é tributado integralmente pelo IBS e pela CBS (cClassTrib 000001), "
                + "sem redução de alíquota.",
            "O IBS e a CBS de cada ano são calculados pela calculadora oficial do regime regular, "
                + "com item de CT-e (modelo 57).",
            "O valor informado é diário, quinzenal ou mensal; a projeção conta apenas dias úteis "
                + "(segunda a sexta, sem feriados) e mantém o preço por dia útil em todos os anos.",
            "A alíquota do ICMS interestadual segue a Resolução do Senado Federal nº 22/1989: 7% do Sul e "
                + "Sudeste (exceto ES) para Norte, Nordeste, Centro-Oeste e ES; 12% nas demais combinações.",
            "2026 é a fase de teste: CBS de 0,90% e IBS de 0,10% são compensáveis com PIS/COFINS e ICMS, "
                + "de modo que a carga econômica do ano equivale à do regime anterior.",
            "A partir de 2027 as alíquotas de referência são definidas anualmente; os valores apresentados "
                + "são os de referência da base oficial e podem ser ajustados ano a ano.",
            "A redução do ICMS e do ISS acompanha a entrada do IBS: 10% em 2029, 20% em 2030, 30% em 2031, "
                + "40% em 2032 e extinção em 2033.",
            "A projeção considera apenas os tributos destacados sobre o valor do frete, sem créditos de "
                + "entradas, retenções ou benefícios fiscais."
        );
    }

    private String versaoBaseDados() {
        try {
            return versaoBaseDadosService.getUltimaVersao().getNumeroVersao();
        } catch (RuntimeException e) {
            return null;
        }
    }

}
