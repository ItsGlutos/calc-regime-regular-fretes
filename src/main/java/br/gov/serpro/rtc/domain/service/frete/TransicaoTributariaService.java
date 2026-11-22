package br.gov.serpro.rtc.domain.service.frete;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.ParametrosTransicaoAno;
import br.gov.serpro.rtc.domain.model.enumeration.FaseTransicao;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Cronograma de alíquotas da transição da reforma tributária do consumo
 * (LC 214/2025) usado na projeção do frete.
 *
 * <p>Apenas 2026 está definido em lei e consta da base oficial de alíquotas de
 * referência (CBS 0,90%, IBS UF 0,10% e IBS município 0,00%). A partir de 2027 as
 * alíquotas de referência são fixadas anualmente por resolução, portanto os
 * valores abaixo são a referência disponível na base oficial do projeto e podem
 * ser sobrescritos a cada requisição, ano a ano.</p>
 *
 * <p>A redução de ICMS e ISS acompanha a entrada do IBS: 10% em 2029, 20% em
 * 2030, 30% em 2031, 40% em 2032 e extinção em 2033.</p>
 */
@Service
public class TransicaoTributariaService {

    public static final int ANO_REFERENCIA = 2025;
    public static final int ANO_INICIAL = 2026;
    public static final int ANO_REGIME_PLENO = 2033;
    public static final int ANO_FINAL = 2034;

    private static final List<ParametrosTransicaoAno> TABELA_PADRAO = List.of(
        ParametrosTransicaoAno.of(2026, "0.90", "0.10", "0.00", "0.00", FaseTransicao.TESTE),
        ParametrosTransicaoAno.of(2027, "8.40", "0.05", "0.05", "0.00", FaseTransicao.CBS_PLENA),
        ParametrosTransicaoAno.of(2028, "8.40", "0.05", "0.05", "0.00", FaseTransicao.CBS_PLENA),
        ParametrosTransicaoAno.of(2029, "8.50", "1.60", "0.25", "10.00", FaseTransicao.TRANSICAO_IBS),
        ParametrosTransicaoAno.of(2030, "8.50", "3.20", "0.50", "20.00", FaseTransicao.TRANSICAO_IBS),
        ParametrosTransicaoAno.of(2031, "8.50", "4.80", "0.75", "30.00", FaseTransicao.TRANSICAO_IBS),
        ParametrosTransicaoAno.of(2032, "8.50", "6.40", "1.00", "40.00", FaseTransicao.TRANSICAO_IBS),
        ParametrosTransicaoAno.of(2033, "8.50", "16.00", "2.50", "100.00", FaseTransicao.REGIME_PLENO),
        ParametrosTransicaoAno.of(2034, "8.50", "16.00", "2.50", "100.00", FaseTransicao.REGIME_PLENO)
    );

    /**
     * Monta o cronograma efetivo da projeção, aplicando as sobrescritas
     * informadas pelo usuário.
     *
     * @param sobrescritas parâmetros que substituem a tabela padrão
     * @return cronograma ordenado do primeiro ao último ano projetado
     */
    public List<ParametrosTransicaoAno> montarTabela(List<ParametrosTransicaoAno> sobrescritas) {
        final List<ParametrosTransicaoAno> tabela = TABELA_PADRAO.stream()
                .map(ParametrosTransicaoAno::copiar)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        if (sobrescritas == null || sobrescritas.isEmpty()) {
            return tabela;
        }

        for (ParametrosTransicaoAno sobrescrita : sobrescritas) {
            if (sobrescrita == null || sobrescrita.getAno() == null) {
                continue;
            }
            final int ano = sobrescrita.getAno();
            if (ano <= 2026 || ano > ANO_FINAL) {
                throw new CampoInvalidoException(
                    "Só é possível sobrescrever as alíquotas de referência entre 2027 e " + ANO_FINAL
                        + " (2026 está definido em lei). Ano informado: " + ano + ".");
            }
            tabela.stream()
                    .filter(p -> p.getAno() == ano)
                    .findFirst()
                    .ifPresent(p -> aplicarSobrescrita(p, sobrescrita));
        }

        return tabela;
    }

    public List<ParametrosTransicaoAno> tabelaPadrao() {
        return TABELA_PADRAO.stream().map(ParametrosTransicaoAno::copiar).toList();
    }

    private void aplicarSobrescrita(ParametrosTransicaoAno destino, ParametrosTransicaoAno origem) {
        validarAliquota(origem.getCbs(), "cbs", origem.getAno());
        validarAliquota(origem.getIbsUf(), "ibsUf", origem.getAno());
        validarAliquota(origem.getIbsMun(), "ibsMun", origem.getAno());
        validarAliquota(origem.getReducaoIcmsIss(), "reducaoIcmsIss", origem.getAno());

        if (origem.getCbs() != null) {
            destino.setCbs(origem.getCbs());
        }
        if (origem.getIbsUf() != null) {
            destino.setIbsUf(origem.getIbsUf());
        }
        if (origem.getIbsMun() != null) {
            destino.setIbsMun(origem.getIbsMun());
        }
        if (origem.getReducaoIcmsIss() != null) {
            destino.setReducaoIcmsIss(origem.getReducaoIcmsIss());
        }
    }

    private void validarAliquota(java.math.BigDecimal valor, String campo, int ano) {
        if (valor == null) {
            return;
        }
        if (valor.signum() < 0 || valor.compareTo(new java.math.BigDecimal("100")) > 0) {
            throw new CampoInvalidoException(
                "Alíquota de " + campo + " inválida para o ano " + ano + ": " + valor.toPlainString()
                    + " (deve estar entre 0 e 100).");
        }
    }

}
