package br.gov.serpro.rtc.api.controller;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.gov.serpro.rtc.api.model.frete.CteExemploOutput;
import br.gov.serpro.rtc.api.model.frete.CtePagamentoInput;
import br.gov.serpro.rtc.api.model.frete.CtePagamentoOutput;
import br.gov.serpro.rtc.api.model.frete.CteParametrosOutput;
import br.gov.serpro.rtc.api.model.frete.OpcaoFrete;
import br.gov.serpro.rtc.domain.model.enumeration.RegimePagadora;
import br.gov.serpro.rtc.domain.model.enumeration.TipoTransportador;
import br.gov.serpro.rtc.domain.service.frete.CtePagamentoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * Endpoints do pagamento de CT-e: o recorte do documento que a empresa pagadora
 * recebe do transportador.
 *
 * <p>Expõe um exemplo pronto de novembro de 2026, o cálculo de qualquer CT-e na
 * data de pagamento e as opções de enquadramento (tipo de transportador e
 * regime da pagadora).</p>
 */
@Tag(name = "Frete — CT-e", description = "Pagamento de CT-e na transição da reforma tributária")
@RequiredArgsConstructor
@RestController
@RequestMapping("calculadora/frete/cte")
public class CteController {

    private final CtePagamentoService ctePagamentoService;

    @Operation(summary = "Exemplo de CT-e pronto para simulação")
    @GetMapping(value = "exemplo", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<CteExemploOutput> exemplo() {
        return ResponseEntity.ok(ctePagamentoService.exemplo());
    }

    @Operation(summary = "Calcula o pagamento de um CT-e")
    @PostMapping(value = "pagamento", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<CtePagamentoOutput> pagar(@RequestBody CtePagamentoInput entrada) {
        return ResponseEntity.ok(ctePagamentoService.pagar(entrada));
    }

    @Operation(summary = "Opções de enquadramento do pagamento de CT-e")
    @GetMapping(value = "parametros", produces = APPLICATION_JSON_VALUE)
    public ResponseEntity<CteParametrosOutput> parametros() {
        return ResponseEntity.ok(CteParametrosOutput.builder()
                .tiposTransportador(Arrays.stream(TipoTransportador.values())
                    .map(t -> OpcaoFrete.builder().valor(t.name()).rotulo(t.getRotulo()).build())
                    .toList())
                .regimesPagadora(Arrays.stream(RegimePagadora.values())
                    .map(r -> OpcaoFrete.builder().valor(r.name()).rotulo(r.getRotulo()).build())
                    .toList())
                .anosDisponiveis(coberturaDeAnos())
                .dataReferencia(LocalDate.now())
                .build());
    }

    private List<Integer> coberturaDeAnos() {
        return java.util.stream.IntStream
                .rangeClosed(CtePagamentoService.ANO_INICIAL_CTE, CtePagamentoService.ANO_FINAL_CTE)
                .boxed()
                .toList();
    }

}
