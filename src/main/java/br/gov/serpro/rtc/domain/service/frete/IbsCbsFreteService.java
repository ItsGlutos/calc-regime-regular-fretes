package br.gov.serpro.rtc.domain.service.frete;

import static java.math.BigDecimal.ZERO;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.MemoriaCalculoFrete;
import br.gov.serpro.rtc.api.model.input.AliquotasNominaisInput;
import br.gov.serpro.rtc.api.model.input.ItemOperacaoInput;
import br.gov.serpro.rtc.api.model.input.OperacaoInput;
import br.gov.serpro.rtc.api.model.roc.GrupoIBSCBSDomain;
import br.gov.serpro.rtc.api.model.roc.MemoriaCalculoDomain;
import br.gov.serpro.rtc.api.model.roc.ObjetoDomain;
import br.gov.serpro.rtc.api.model.roc.ROCDomain;
import br.gov.serpro.rtc.domain.service.CalculadoraService;
import br.gov.serpro.rtc.domain.service.exception.CampoInvalidoException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Calcula o IBS e a CBS de uma prestação de serviço de transporte pela
 * calculadora oficial do regime regular.
 *
 * <p>Centraliza o item de CT-e (modelo 57, CST 000, cClassTrib 000001) para que
 * a projeção anual e o recorte de um documento único usem exatamente a mesma
 * regra de negócio da base oficial.</p>
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class IbsCbsFreteService {

    /** CST de tributação integral pelo IBS e pela CBS. */
    public static final String CST_INTEGRAL = "000";
    /** Classificação tributária de tributação integral, usada no transporte de cargas. */
    public static final String CCLASS_TRIB_INTEGRAL = "000001";
    /** Modelo do Conhecimento de Transporte Eletrônico. */
    public static final int TIPO_DOCUMENTO_CTE = 57;

    private static final int ESCOPO_CALCULO = 6;

    private final CalculadoraService calculadoraService;

    /**
     * Calcula IBS e CBS de um serviço de transporte em um ano da transição.
     *
     * @param ano          ano do fato gerador
     * @param base         base de cálculo (valor da prestação)
     * @param mes          mês do fato gerador, usado para vigência das alíquotas
     * @param nbs          código NBS do serviço de transporte
     * @param municipio    município do local da prestação (IBGE)
     * @param uf           UF do local da prestação
     * @param aliquotaCbs  alíquota nominal da CBS no ano (%)
     * @param aliquotaIbsUf alíquota nominal do IBS estadual no ano (%)
     * @param aliquotaIbsMun alíquota nominal do IBS municipal no ano (%)
     * @return valores e percentuais efetivos do IBS e da CBS
     */
    public ResultadoIbsCbs calcular(int ano, BigDecimal base, int mes, String nbs, Long municipio, String uf,
            BigDecimal aliquotaCbs, BigDecimal aliquotaIbsUf, BigDecimal aliquotaIbsMun) {

        final ItemOperacaoInput item = new ItemOperacaoInput();
        item.setNumero(1);
        item.setNbs(nbs);
        item.setCst(CST_INTEGRAL);
        item.setCClassTrib(CCLASS_TRIB_INTEGRAL);
        item.setBaseCalculo(base);

        if (ano >= 2027) {
            final AliquotasNominaisInput aliquotas = new AliquotasNominaisInput();
            aliquotas.setCbs(aliquotaCbs);
            aliquotas.setIbsEstadual(aliquotaIbsUf);
            aliquotas.setIbsMunicipal(aliquotaIbsMun);
            item.setAliquotasNominais(aliquotas);
        }

        final OperacaoInput operacao = new OperacaoInput();
        operacao.setId("frete-" + ano);
        operacao.setVersao("1.0.0");
        operacao.setDhFatoGerador(OffsetDateTime.of(ano, mes, 15, 12, 0, 0, 0, ZoneOffset.ofHours(-3)));
        operacao.setMunicipio(municipio);
        operacao.setUf(uf);
        operacao.setTpDoc(TIPO_DOCUMENTO_CTE);
        operacao.setItens(List.of(item));

        try {
            final ROCDomain roc = calculadoraService.calcularTributos(operacao);
            return extrair(roc, aliquotaCbs, aliquotaIbsUf, aliquotaIbsMun);
        } catch (RuntimeException e) {
            log.warn("Falha ao calcular o frete para o ano {}: {}", ano, e.getMessage());
            throw new CampoInvalidoException(
                "Não foi possível calcular o IBS/CBS do frete para o ano " + ano + ": " + e.getMessage());
        }
    }

    private ResultadoIbsCbs extrair(ROCDomain roc, BigDecimal aliquotaCbs, BigDecimal aliquotaIbsUf,
            BigDecimal aliquotaIbsMun) {

        final ObjetoDomain objeto = roc.getObjetos() == null || roc.getObjetos().isEmpty()
            ? null
            : roc.getObjetos().getFirst();

        final GrupoIBSCBSDomain grupo = objeto == null || objeto.getTribCalc() == null
            ? null
            : objeto.getTribCalc().getGrupoIBSCBS();

        if (grupo == null) {
            throw new CampoInvalidoException("A calculadora não retornou os grupos de IBS e CBS para o frete.");
        }

        final BigDecimal cbs = grupo.getGCBS() != null ? nuloParaZero(grupo.getGCBS().getVCBS()) : ZERO;
        final BigDecimal ibsUf = grupo.getGIBSUF() != null ? nuloParaZero(grupo.getGIBSUF().getVIBSUF()) : ZERO;
        final BigDecimal ibsMun = grupo.getGIBSMun() != null ? nuloParaZero(grupo.getGIBSMun().getVIBSMun()) : ZERO;

        final MemoriaCalculoDomain memoria = objeto.getTribCalc().getIBSCBS() != null
            ? objeto.getTribCalc().getIBSCBS().getMemoriaCalculo()
            : null;

        return new ResultadoIbsCbs(
            escala2(cbs),
            escala2(ibsUf),
            escala2(ibsMun),
            escala4(aliquotaCbs),
            escala4(aliquotaIbsUf),
            escala4(aliquotaIbsMun),
            memoria == null ? null : MemoriaCalculoFrete.builder()
                .cbs(memoria.getCbs())
                .ibsUf(memoria.getIbsUF())
                .ibsMun(memoria.getIbsMun())
                .build());
    }

    private static BigDecimal nuloParaZero(BigDecimal valor) {
        return valor == null ? ZERO : valor;
    }

    private static BigDecimal escala2(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal escala4(BigDecimal valor) {
        return valor == null ? null : valor.setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Resultado do IBS e da CBS de uma prestação de transporte.
     *
     * @param cbs              valor da CBS
     * @param ibsUf            valor do IBS estadual
     * @param ibsMun           valor do IBS municipal
     * @param percentualCbs    alíquota efetiva da CBS (%)
     * @param percentualIbsUf  alíquota efetiva do IBS estadual (%)
     * @param percentualIbsMun alíquota efetiva do IBS municipal (%)
     * @param memoria          memória de cálculo devolvida pela calculadora
     */
    public record ResultadoIbsCbs(BigDecimal cbs, BigDecimal ibsUf, BigDecimal ibsMun,
            BigDecimal percentualCbs, BigDecimal percentualIbsUf, BigDecimal percentualIbsMun,
            MemoriaCalculoFrete memoria) {
    }

}
