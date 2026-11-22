package br.gov.serpro.rtc.domain.service.frete;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.OpcaoFrete;
import br.gov.serpro.rtc.api.model.frete.ServicoFrete;
import br.gov.serpro.rtc.domain.model.enumeration.PeriodicidadeFrete;
import br.gov.serpro.rtc.domain.model.enumeration.RegimePisCofins;
import br.gov.serpro.rtc.domain.model.enumeration.TipoOperacaoFrete;
import br.gov.serpro.rtc.domain.repository.NbsRepository;
import lombok.RequiredArgsConstructor;

/**
 * Catálogo de serviços de transporte de cargas do simulador de frete.
 *
 * <p>Os códigos NBS foram extraídos da tabela oficial de NBS da base de dados e
 * validados contra a calculadora do regime geral (cClassTrib 000001 e CT-e).
 * Todos pertencem ao grupo 105 - Serviços de transporte de cargas - e não
 * possuem redução de alíquota no IBS/CBS.</p>
 */
@RequiredArgsConstructor
@Service
public class FreteCatalogoService {

    public static final String NBS_PADRAO = "105011220";

    private final NbsRepository nbsRepository;

    private static final List<ServicoFrete> SERVICOS = List.of(
        servico("105011220", "Rodoviário · carga unitizada", "RODOVIARIO"),
        servico("105011210", "Rodoviário · carga solta, não unitizada", "RODOVIARIO"),
        servico("105011110", "Rodoviário · granel sólido", "RODOVIARIO"),
        servico("105011120", "Rodoviário · granel líquido ou liquefeito", "RODOVIARIO"),
        servico("105011130", "Rodoviário · granel gasoso", "RODOVIARIO"),
        servico("105011230", "Rodoviário · carga frigorificada ou climatizada", "RODOVIARIO"),
        servico("105011320", "Rodoviário · carga em contêineres", "RODOVIARIO"),
        servico("105011410", "Rodoviário · cargas vivas", "RODOVIARIO"),
        servico("105011430", "Rodoviário · cargas de grande porte", "RODOVIARIO"),
        servico("105011440", "Rodoviário · veículos", "RODOVIARIO"),
        servico("105011451", "Rodoviário · combustíveis, lubrificantes e GLP", "RODOVIARIO"),
        servico("105011452", "Rodoviário · produtos químicos perigosos", "RODOVIARIO"),
        servico("105011500", "Rodoviário · cargas postais e malotes", "RODOVIARIO"),
        servico("105011900", "Rodoviário · outras cargas", "RODOVIARIO"),
        servico("105012220", "Ferroviário · carga unitizada", "FERROVIARIO"),
        servico("105012320", "Ferroviário · carga em contêineres", "FERROVIARIO"),
        servico("105012421", "Ferroviário · combustíveis, lubrificantes e GLP", "FERROVIARIO"),
        servico("105012900", "Ferroviário · outras cargas", "FERROVIARIO"),
        servico("105021900", "Aquaviário de navegação interior · outras cargas", "AQUAVIARIO"),
        servico("105022900", "Aquaviário costeiro · outras cargas", "AQUAVIARIO"),
        servico("105039000", "Aéreo · outras cargas", "AEREO"),
        servico("105042200", "Multimodal · carga unitizada", "MULTIMODAL"),
        servico("105049000", "Multimodal · outras cargas", "MULTIMODAL"),
        servico("106070000", "Agenciamento de transporte de cargas", "OUTROS")
    );

    private static ServicoFrete servico(String nbs, String descricao, String modal) {
        return ServicoFrete.builder().nbs(nbs).descricao(descricao).modal(modal).build();
    }

    public List<ServicoFrete> listarServicos() {
        return SERVICOS;
    }

    public boolean ehServicoDeFrete(String nbs) {
        return SERVICOS.stream().anyMatch(s -> s.getNbs().equals(nbs));
    }

    /**
     * Resolve a descrição oficial do NBS, do código mais específico para o mais
     * genérico. Retorna {@code null} quando o código não existe na base.
     */
    public String descrever(String nbs, LocalDate data) {
        for (int limite : new int[] { 9, 6, 3 }) {
            if (nbs.length() < limite) {
                continue;
            }
            Optional<String> descricao = nbsRepository.buscarDescricaoNbs(nbs, limite, data);
            if (descricao.isPresent()) {
                return descricao.get();
            }
        }
        return SERVICOS.stream()
                .filter(s -> s.getNbs().equals(nbs))
                .map(ServicoFrete::getDescricao)
                .findFirst()
                .orElse(null);
    }

    public List<OpcaoFrete> listarTiposOperacao() {
        return List.of(
            OpcaoFrete.builder()
                .valor(TipoOperacaoFrete.INTERESTADUAL.name())
                .rotulo(TipoOperacaoFrete.INTERESTADUAL.getRotulo())
                .descricao(TipoOperacaoFrete.INTERESTADUAL.getDescricao())
                .aliquota(TipoOperacaoFrete.INTERESTADUAL.getAliquotaIcmsPadrao())
                .build(),
            OpcaoFrete.builder()
                .valor(TipoOperacaoFrete.INTERNA.name())
                .rotulo(TipoOperacaoFrete.INTERNA.getRotulo())
                .descricao(TipoOperacaoFrete.INTERNA.getDescricao())
                .aliquota(TipoOperacaoFrete.INTERNA.getAliquotaIcmsPadrao())
                .build(),
            OpcaoFrete.builder()
                .valor(TipoOperacaoFrete.MUNICIPAL.name())
                .rotulo(TipoOperacaoFrete.MUNICIPAL.getRotulo())
                .descricao(TipoOperacaoFrete.MUNICIPAL.getDescricao())
                .aliquota(TipoOperacaoFrete.MUNICIPAL.getAliquotaIssPadrao())
                .build()
        );
    }

    public List<OpcaoFrete> listarRegimesPisCofins() {
        return List.of(
            OpcaoFrete.builder()
                .valor(RegimePisCofins.NAO_CUMULATIVO.name())
                .rotulo(RegimePisCofins.NAO_CUMULATIVO.getRotulo())
                .descricao("PIS 1,65% + COFINS 7,60%")
                .aliquota(RegimePisCofins.NAO_CUMULATIVO.getAliquotaTotal())
                .build(),
            OpcaoFrete.builder()
                .valor(RegimePisCofins.CUMULATIVO.name())
                .rotulo(RegimePisCofins.CUMULATIVO.getRotulo())
                .descricao("PIS 0,65% + COFINS 3,00%")
                .aliquota(RegimePisCofins.CUMULATIVO.getAliquotaTotal())
                .build()
        );
    }

    public List<OpcaoFrete> listarPeriodicidades() {
        return List.of(
            OpcaoFrete.builder()
                .valor(PeriodicidadeFrete.DIARIO.name())
                .rotulo(PeriodicidadeFrete.DIARIO.getRotulo())
                .descricao(PeriodicidadeFrete.DIARIO.getDescricao())
                .build(),
            OpcaoFrete.builder()
                .valor(PeriodicidadeFrete.QUINZENAL.name())
                .rotulo(PeriodicidadeFrete.QUINZENAL.getRotulo())
                .descricao(PeriodicidadeFrete.QUINZENAL.getDescricao())
                .build(),
            OpcaoFrete.builder()
                .valor(PeriodicidadeFrete.MENSAL.name())
                .rotulo(PeriodicidadeFrete.MENSAL.getRotulo())
                .descricao(PeriodicidadeFrete.MENSAL.getDescricao())
                .build()
        );
    }

}
