package br.gov.serpro.rtc.api.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Atalho de acesso à interface do simulador de frete.
 *
 * <p>Os arquivos estáticos ficam em {@code static/frete}; este mapeamento apenas
 * redireciona {@code /frete} para a página inicial da interface.</p>
 */
@Controller
public class FreteUiController {

    @GetMapping("frete")
    public String frete() {
        return "redirect:/frete/index.html";
    }

}
