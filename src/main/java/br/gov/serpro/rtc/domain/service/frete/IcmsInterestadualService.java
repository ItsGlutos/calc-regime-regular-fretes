package br.gov.serpro.rtc.domain.service.frete;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.OpcaoFrete;
import br.gov.serpro.rtc.api.model.frete.TabelaIcmsLinha;
import br.gov.serpro.rtc.domain.model.enumeration.RegiaoIcms;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;

/**
 * Alíquotas do ICMS nas operações interestaduais, conforme a Resolução do Senado
 * Federal nº 22/1989.
 *
 * <p>A regra é binária:</p>
 * <ul>
 *   <li><b>7%</b> nas operações originadas no Sul ou no Sudeste (exceto Espírito
 *       Santo) com destino às regiões Norte, Nordeste, Centro-Oeste ou ao próprio
 *       Espírito Santo;</li>
 *   <li><b>12%</b> em todas as demais combinações, inclusive dentro da mesma
 *       região.</li>
 * </ul>
 *
 * <p>Não estão incluídas a alíquota de 4% para mercadorias importadas
 * (Resolução nº 13/2012) nem o adicional do FECP, que variam por estado.</p>
 */
@Service
public class IcmsInterestadualService {

    private static final BigDecimal SETE = new BigDecimal("7.00");
    private static final BigDecimal DOZE = new BigDecimal("12.00");

    private static final Map<String, RegiaoIcms> UF_REGIAO = new LinkedHashMap<>();
    private static final Map<String, String> UF_NOME = new LinkedHashMap<>();
    private static final Map<String, Long> UF_CAPITAL = new LinkedHashMap<>();

    static {
        registrar("AC", "Acre", RegiaoIcms.NORTE, 1200401L);
        registrar("AP", "Amapá", RegiaoIcms.NORTE, 1600303L);
        registrar("AM", "Amazonas", RegiaoIcms.NORTE, 1302603L);
        registrar("PA", "Pará", RegiaoIcms.NORTE, 1501402L);
        registrar("RO", "Rondônia", RegiaoIcms.NORTE, 1100205L);
        registrar("RR", "Roraima", RegiaoIcms.NORTE, 1400100L);
        registrar("TO", "Tocantins", RegiaoIcms.NORTE, 1721000L);

        registrar("AL", "Alagoas", RegiaoIcms.NORDESTE, 2704302L);
        registrar("BA", "Bahia", RegiaoIcms.NORDESTE, 2927408L);
        registrar("CE", "Ceará", RegiaoIcms.NORDESTE, 2304400L);
        registrar("MA", "Maranhão", RegiaoIcms.NORDESTE, 2111300L);
        registrar("PB", "Paraíba", RegiaoIcms.NORDESTE, 2507507L);
        registrar("PE", "Pernambuco", RegiaoIcms.NORDESTE, 2611606L);
        registrar("PI", "Piauí", RegiaoIcms.NORDESTE, 2211001L);
        registrar("RN", "Rio Grande do Norte", RegiaoIcms.NORDESTE, 2408102L);
        registrar("SE", "Sergipe", RegiaoIcms.NORDESTE, 2800308L);

        registrar("DF", "Distrito Federal", RegiaoIcms.CENTRO_OESTE, 5300108L);
        registrar("GO", "Goiás", RegiaoIcms.CENTRO_OESTE, 5208707L);
        registrar("MT", "Mato Grosso", RegiaoIcms.CENTRO_OESTE, 5103403L);
        registrar("MS", "Mato Grosso do Sul", RegiaoIcms.CENTRO_OESTE, 5002704L);

        registrar("MG", "Minas Gerais", RegiaoIcms.SUDESTE_EXCETO_ES, 3106200L);
        registrar("RJ", "Rio de Janeiro", RegiaoIcms.SUDESTE_EXCETO_ES, 3304557L);
        registrar("SP", "São Paulo", RegiaoIcms.SUDESTE_EXCETO_ES, 3550308L);

        registrar("ES", "Espírito Santo", RegiaoIcms.ESPIRITO_SANTO, 3205309L);

        registrar("PR", "Paraná", RegiaoIcms.SUL, 4106902L);
        registrar("RS", "Rio Grande do Sul", RegiaoIcms.SUL, 4314902L);
        registrar("SC", "Santa Catarina", RegiaoIcms.SUL, 4205407L);
    }

    private static void registrar(String uf, String nome, RegiaoIcms regiao, Long capital) {
        UF_REGIAO.put(uf, regiao);
        UF_NOME.put(uf, nome);
        UF_CAPITAL.put(uf, capital);
    }

    /**
     * Alíquota interestadual entre a UF de origem e a UF de destino.
     */
    public BigDecimal aliquota(String ufOrigem, String ufDestino) {
        final RegiaoIcms origem = regiaoDe(ufOrigem);
        final RegiaoIcms destino = regiaoDe(ufDestino);
        return aliquota(origem, destino);
    }

    public BigDecimal aliquota(RegiaoIcms origem, RegiaoIcms destino) {
        if (origem == null || destino == null) {
            return DOZE;
        }
        final boolean destinoReduzido = destino == RegiaoIcms.NORTE
            || destino == RegiaoIcms.NORDESTE
            || destino == RegiaoIcms.CENTRO_OESTE
            || destino == RegiaoIcms.ESPIRITO_SANTO;

        return origem.isOrigemSulSudeste() && destinoReduzido ? SETE : DOZE;
    }

    public RegiaoIcms regiaoDe(String uf) {
        final String sigla = normalizar(uf);
        final RegiaoIcms regiao = UF_REGIAO.get(sigla);
        if (regiao == null) {
            throw new CampoInvalidoException(
                "UF inválida: " + uf + ". Informe a sigla de uma UF brasileira (ex.: SP, RJ, BA).");
        }
        return regiao;
    }

    /**
     * Código IBGE do município da capital da UF, usado como local da operação na
     * calculadora oficial quando o usuário informa apenas a UF.
     */
    public Long capitalDe(String uf) {
        regiaoDe(uf);
        return UF_CAPITAL.get(normalizar(uf));
    }

    /**
     * Matriz completa de alíquotas por par de regiões (36 combinações).
     */
    public List<TabelaIcmsLinha> tabela() {
        final List<TabelaIcmsLinha> linhas = new ArrayList<>();

        for (RegiaoIcms origem : RegiaoIcms.values()) {
            for (RegiaoIcms destino : RegiaoIcms.values()) {
                linhas.add(TabelaIcmsLinha.builder()
                        .origem(origem.getRotulo())
                        .destino(destino.getRotulo())
                        .aliquota(aliquota(origem, destino))
                        .build());
            }
        }
        return linhas;
    }

    /**
     * UFs disponíveis para seleção, com a região entre parênteses.
     */
    public List<OpcaoFrete> listarUfs() {
        return UF_REGIAO.entrySet().stream()
                .map(entrada -> OpcaoFrete.builder()
                        .valor(entrada.getKey())
                        .rotulo(entrada.getKey() + " — " + UF_NOME.get(entrada.getKey()))
                        .descricao(entrada.getValue().getRotulo())
                        .build())
                .toList();
    }

    private String normalizar(String uf) {
        return uf == null ? "" : uf.trim().toUpperCase();
    }

}
