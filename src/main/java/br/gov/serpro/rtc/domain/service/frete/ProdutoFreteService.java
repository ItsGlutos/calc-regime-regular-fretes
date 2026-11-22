package br.gov.serpro.rtc.domain.service.frete;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.api.model.frete.ClausulaContrato;
import br.gov.serpro.rtc.api.model.frete.LacunaProduto;
import br.gov.serpro.rtc.api.model.frete.OndaProduto;
import br.gov.serpro.rtc.api.model.frete.ParametrosTransicaoAno;
import br.gov.serpro.rtc.api.model.frete.ProdutoOutput;
import lombok.RequiredArgsConstructor;

/**
 * Diagnóstico de prontidão do simulador de frete como produto de uso contínuo em
 * uma empresa pagadora de frete.
 *
 * <p>Organiza o que já está pronto, o que está parcial e o que falta, por
 * dimensão (fiscal, documentos, contrato, financeiro e produto), e mantém as
 * minutas de cláusulas do anexo tributário do contrato de transporte — o mesmo
 * texto que a interface exibe e que pode ser baixado em markdown.</p>
 */
@RequiredArgsConstructor
@Service
public class ProdutoFreteService {

    private final TransicaoTributariaService transicaoTributariaService;

    /**
     * Monta o diagnóstico de prontidão do produto.
     *
     * @return lacunas, cláusulas, ondas e resumo de cobertura
     */
    public ProdutoOutput produto() {
        final List<LacunaProduto> lacunas = lacunas();
        final long prontos = lacunas.stream().filter(l -> "PRONTO".equals(l.getSituacao())).count();
        final long parciais = lacunas.stream().filter(l -> "PARCIAL".equals(l.getSituacao())).count();
        final long faltantes = lacunas.stream().filter(l -> "FALTA".equals(l.getSituacao())).count();

        return ProdutoOutput.builder()
                .total(lacunas.size())
                .prontos((int) prontos)
                .parciais((int) parciais)
                .faltantes((int) faltantes)
                .cobertura(percentual(prontos, lacunas.size()))
                .lacunas(lacunas)
                .clausulas(clausulas())
                .ondas(ondas())
                .avisos(List.of(
                    "Diagnóstico de produto, não parecer fiscal ou jurídico: as minutas de cláusulas devem ser "
                        + "validadas pelo jurídico e pelo fiscal da empresa antes de uso.",
                    "As estimativas de prazo são em semanas de um time pequeno (2 a 4 pessoas) e consideram "
                        + "integração com sistemas de terceiros.",
                    "Os itens marcados como PRONTO já estão implementados nesta versão e são demonstráveis na "
                        + "aba de projeção e na aba do CT-e."))
                .build();
    }

    /**
     * Gera o anexo tributário em markdown, pronto para anexar ao contrato de
     * transporte.
     *
     * @return texto do anexo
     */
    public String anexoMarkdown() {
        final StringBuilder texto = new StringBuilder();

        texto.append("# Anexo tributário — contrato de transporte de cargas\n\n");
        texto.append("**Contratante (pagadora):** [razão social] — CNPJ [nº]\n\n");
        texto.append("**Contratada (transportadora):** [razão social] — CNPJ [nº] — RNTRC [nº]\n\n");
        texto.append("Este anexo integra o contrato de prestação de serviços de transporte e disciplina o "
            + "destaque, a retenção e a liquidação dos tributos na transição da reforma tributária do consumo "
            + "(LC 214/2025 e ADCT, EC 132/2023).\n\n");

        texto.append("## Cláusulas\n\n");
        for (ClausulaContrato clausula : clausulas()) {
            texto.append("### ").append(clausula.getNumero()).append(". ").append(clausula.getTitulo())
                .append("\n\n");
            texto.append(clausula.getTexto()).append("\n\n");
            texto.append("> **Por que importa:** ").append(clausula.getPorque()).append("\n>\n");
            texto.append("> **Base:** ").append(clausula.getBase()).append("\n\n");
        }

        texto.append("## Anexo I — Cronograma de alíquotas da transição\n\n");
        texto.append("| Ano | CBS | IBS UF | IBS município | Redução de ICMS/ISS |\n");
        texto.append("|---|---|---|---|---|\n");
        for (ParametrosTransicaoAno p : transicaoTributariaService.tabelaPadrao()) {
            texto.append("| ").append(p.getAno())
                .append(" | ").append(formatar(p.getCbs())).append("%")
                .append(" | ").append(formatar(p.getIbsUf())).append("%")
                .append(" | ").append(formatar(p.getIbsMun())).append("%")
                .append(" | ").append(formatar(p.getReducaoIcmsIss())).append("%")
                .append(" |\n");
        }
        texto.append("\n");
        texto.append("> Alíquotas de 2026 definidas em lei (ano de teste). A partir de 2027, os valores de "
            + "referência são fixados anualmente e prevalecem sobre esta tabela quando divergirem.\n");

        return texto.toString();
    }

    private List<LacunaProduto> lacunas() {
        final List<LacunaProduto> lacunas = new ArrayList<>();

        // Fiscal
        lacunas.add(lacuna("Fiscal", "Cálculo de IBS e CBS pela calculadora oficial", "PRONTO", 0, "P",
            "A carga do frete é calculada pela API oficial do regime regular, com o item de CT-e.",
            "Nada a fazer: usar como fonte única de cálculo."));
        lacunas.add(lacuna("Fiscal", "ICMS interestadual pela tabela oficial", "PRONTO", 0, "P",
            "A alíquota deixa de ser digitada e passa a vir da Resolução do Senado nº 22/1989.",
            "Nada a fazer."));
        lacunas.add(lacuna("Fiscal", "Cronograma de extinção de PIS/COFINS e ICMS", "PRONTO", 0, "P",
            "A projeção mostra a convivência de tributos antigos e novos de 2026 a 2033.",
            "Nada a fazer; revisar a tabela quando saírem as alíquotas de referência."));
        lacunas.add(lacuna("Fiscal", "Regime da pagadora e aproveitamento de crédito", "PRONTO", 0, "M",
            "Simples e regime regular têm custos diferentes para o mesmo CT-e.",
            "Nada a fazer."));
        lacunas.add(lacuna("Fiscal", "Apuração e escrituração de créditos por documento", "FALTA", 2, "G",
            "Sem escrituração, o crédito de IBS/CBS vira informação contábil e não caixa.",
            "Gerar livro de apuração por CT-e, com conciliação mensal e exportação para o ERP."));
        lacunas.add(lacuna("Fiscal", "Split payment na liquidação", "FALTA", 2, "G",
            "A partir de 2027 o tributo sai do fluxo do transportador e passa a ser segregado no pagamento.",
            "Integrar com o mecanismo do split, conciliar segregação e comprovantes."));
        lacunas.add(lacuna("Fiscal", "Retenções completas por tipo de transportador", "PARCIAL", 1, "M",
            "TAC, TDE e cooperativa têm retenções diferentes; hoje a matriz é simplificada.",
            "Completar a matriz com dispensas por valor, convenção coletiva e cooperativas."));
        lacunas.add(lacuna("Fiscal", "ICMS de 4% para importados, FECP e benefícios estaduais", "FALTA", 3, "M",
            "Rotas com carga importada e estados com fundo de combate à pobreza mudam a conta.",
            "Parametrizar por UF e por natureza da carga."));

        // Documentos
        lacunas.add(lacuna("Documentos", "Composição do CT-e parcela a parcela", "PRONTO", 0, "M",
            "Frete-peso, frete-valor, GRIS, pedágio, taxas e vale-pedágio aparecem separados.",
            "Nada a fazer."));
        lacunas.add(lacuna("Documentos", "Chave de acesso e conferência de formato", "PARCIAL", 1, "P",
            "Hoje valida-se a chave e o dígito verificador, sem consulta à SEFAZ.",
            "Integrar consulta de autorização e de cancelamento."));
        lacunas.add(lacuna("Documentos", "Ingestão do XML do CT-e", "FALTA", 1, "G",
            "Sem importar o XML, o produto depende de digitação e não escala.",
            "Parser do XML, validação de schema e fila de documentos."));
        lacunas.add(lacuna("Documentos", "MDF-e, RNTRC e CIOT / piso ANTT", "FALTA", 1, "G",
            "Documento sem vínculo com MDF-e ou sem CIOT é risco de glosa e de autuação.",
            "Integrar consulta ao MDF-e, ao RNTRC e ao CIOT."));
        lacunas.add(lacuna("Documentos", "Conciliação com a tabela de frete do contrato", "FALTA", 1, "G",
            "A maior parte dos erros de pagamento é de valor, não de tributo.",
            "Importar a tabela contratada e comparar parcela a parcela."));
        lacunas.add(lacuna("Documentos", "Cancelamento, reentrega e devolução", "FALTA", 2, "M",
            "Documento cancelado exige estorno de crédito e ajuste de retenção.",
            "Tratar eventos do CT-e e repercutir no crédito e no contas a pagar."));

        // Contrato
        lacunas.add(lacuna("Contrato", "Anexo tributário do contrato de transporte", "PRONTO", 0, "P",
            "As cláusulas de destaque, retenção e liquidação já estão redigidas e exportáveis.",
            "Validar com o jurídico da empresa e adaptar à minuta padrão."));
        lacunas.add(lacuna("Contrato", "Cláusula de neutralidade tributária (gross-up)", "PRONTO", 0, "M",
            "Sem fórmula de repasse, cada transportadora repassa a reforma a seu modo.",
            "Definir o índice de referência e a periodicidade da revisão."));
        lacunas.add(lacuna("Contrato", "Retenções e documentos obrigatórios", "PRONTO", 0, "P",
            "A cláusula amarra retenção, comprovante e consequência do erro.",
            "Negociar prazo de entrega dos comprovantes."));
        lacunas.add(lacuna("Contrato", "Split payment e liquidação", "PRONTO", 0, "P",
            "Define quem entrega o tributo ao Fisco e o que acontece sem comprovante.",
            "Acompanhar a regulamentação do split antes de assinar."));
        lacunas.add(lacuna("Contrato", "Reajuste, piso ANTT e repactuação anual", "PARCIAL", 2, "M",
            "O piso ANTT muda mais rápido que o IPCA e o contrato precisa refletir isso.",
            "Incluir gatilho do diesel e revisão anual do anexo de alíquotas."));
        lacunas.add(lacuna("Contrato", "SLA, avarias, glosas e auditoria", "FALTA", 3, "M",
            "A conferência do CT-e é onde a reforma gera erro de valor.",
            "Fluxo de glosa motivada, prazo de defesa e trilha de auditoria."));

        // Financeiro
        lacunas.add(lacuna("Financeiro", "Conta a pagar com segregação tributária", "PARCIAL", 2, "G",
            "O pagamento precisa sair com tributo, retenção e vale-pedágio separados.",
            "Gerar títulos com rateio tributário e exportar para o ERP."));
        lacunas.add(lacuna("Financeiro", "Fluxo de caixa do split payment", "FALTA", 2, "M",
            "O split muda o caixa do transportador e o momento do recolhimento.",
            "Projetar caixa por documento, com data de segregação e de repasse."));
        lacunas.add(lacuna("Financeiro", "Rateio por centro de custo, rota e unidade", "FALTA", 3, "M",
            "O custo do frete precisa ser alocado para decisão de preço e de rota.",
            "Parametrizar rateio e relatório por dimensão."));
        lacunas.add(lacuna("Financeiro", "Orçamento anual com índice de reajuste", "FALTA", 3, "M",
            "A reforma muda a alíquota todo ano: o orçamento precisa acompanhar.",
            "Cenário base, conservador e de estresse por ano da transição."));
        lacunas.add(lacuna("Financeiro", "Relatórios gerenciais e trilha de auditoria", "PARCIAL", 2, "M",
            "A diretoria precisa do número fechado e o fiscal, do documento que o sustenta.",
            "Padronizar relatórios e versionar cada cálculo."));

        // Produto
        lacunas.add(lacuna("Produto", "Multiempresa, perfis e permissões", "FALTA", 3, "G",
            "Grupos com várias pagadoras exigem isolamento de dados e alçadas.",
            "Modelo de tenancy, papéis e segregação por CNPJ."));
        lacunas.add(lacuna("Produto", "API pública, webhooks e integração com ERP", "PARCIAL", 2, "M",
            "A API já expõe cálculo e projeção; falta o ciclo do documento.",
            "Publicar contrato OpenAPI, autenticação e eventos de status."));
        lacunas.add(lacuna("Produto", "LGPD, retenção e descarte de dados", "FALTA", 3, "M",
            "O CT-e carrega CPF de motorista e dados de rota.",
            "Política de retenção de 5 anos, registro de operações e resposta a incidentes."));
        lacunas.add(lacuna("Produto", "Observabilidade, SLA e continuidade", "FALTA", 3, "G",
            "Produto de pagamento não pode ficar fora do ar no fechamento.",
            "Métricas, alertas, backup e plano de continuidade."));
        lacunas.add(lacuna("Produto", "Onboarding e importação de contratos", "FALTA", 3, "G",
            "A primeira semana decide a adoção: contrato, tabela e transportadoras.",
            "Assistente de implantação e importação em massa."));
        lacunas.add(lacuna("Produto", "Empacotamento comercial, preço e ROI", "FALTA", 3, "M",
            "O valor está em evitar glosa e recuperar crédito, não em calcular alíquota.",
            "Definir planos por volume de CT-e e calcular ROI com o cliente."));

        return lacunas;
    }

    private List<ClausulaContrato> clausulas() {
        final List<ClausulaContrato> clausulas = new ArrayList<>();

        clausulas.add(clausula(1, "Objeto e documentos",
            "Sem esta cláusula a pagadora assume o risco de pagar documento inidôneo e de perder o crédito.",
            "O Transportador obriga-se a emitir o CT-e (modelo 57) para cada prestação, com o MDF-e vinculado "
                + "quando houver carga fracionada, informando o RNTRC válido e, nas contratações sujeitas ao "
                + "regime da Lei 13.703/2018, o CIOT correspondente ao piso mínimo ANTT. A Pagadora não "
                + "liquidará documento sem CT-e autorizado, sem vínculo com o MDF-e ou com RNTRC vencido, "
                + "hipótese em que o prazo de pagamento fica suspenso até a regularização, sem incidência de mora.",
            "Ajuste SINIEF 09/2007 (CT-e); Lei 11.442/2007; Lei 13.703/2018."));

        clausulas.add(clausula(2, "Composição da remuneração",
            "Impede a cobrança de tributo \"por fora\" e o repasse indevido do vale-pedágio.",
            "A remuneração corresponde à soma das parcelas frete-peso, frete-valor, GRIS, pedágio, taxas de "
                + "coleta e entrega e demais serviços previstos no Anexo I, deduzidos os descontos. É vedada a "
                + "cobrança de tributo, taxa ou contribuição não destacada no CT-e e não prevista neste contrato, "
                + "bem como o repasse do vale-pedágio obrigatório, que será antecipado pela Pagadora.",
            "Lei 10.209/2001; Ajuste SINIEF 09/2007."));

        clausulas.add(clausula(3, "Destaque dos tributos",
            "Define quem responde pelo destaque errado e em que prazo ele é corrigido.",
            "O CT-e será emitido com o destaque do ICMS, do PIS, da COFINS, do IBS e da CBS, com CST, "
                + "cClassTrib e código NBS do serviço, conforme a LC 214/2025. O Transportador responde pela "
                + "correção de classificação, alíquota e base de cálculo e deverá emitir carta de correção ou "
                + "CT-e substituto em até 5 (cinco) dias úteis do apontamento da Pagadora; o vencimento original "
                + "só se mantém se a correção não alterar o valor.",
            "LC 214/2025; ADCT (EC 132/2023), art. 125."));

        clausulas.add(clausula(4, "Neutralidade tributária",
            "Evita que cada transportadora repasse a reforma a seu modo e dá previsibilidade ao orçamento.",
            "As alíquotas do IBS e da CBS e o cronograma de redução do ICMS seguirão a legislação vigente. Se a "
                + "carga tributária efetiva do serviço variar por alteração legal posterior à data-base, o preço "
                + "será revisto na mesma proporção, aplicando-se a fórmula: Preço revisado = Preço atual x "
                + "(1 + variação da carga efetiva). A revisão será apurada no mês seguinte à vigência da alteração "
                + "e não retroagirá.",
            "LC 214/2025; ADCT (EC 132/2023), arts. 125 a 129."));

        clausulas.add(clausula(5, "Retenções na fonte",
            "Torna a retenção auditável e cria consequência objetiva para o erro.",
            "A Pagadora reterá o IRRF de 1,5% sobre o valor da prestação e, quando o Transportador for autônomo "
                + "(TAC), o INSS de 11% e o SEST/SENAT de 2,5%. As retenções serão informadas no CT-e e no "
                + "demonstrativo de pagamento, com o comprovante de recolhimento entregue em até 10 (dez) dias do "
                + "vencimento. Retenção indevida será restituída com correção monetária e juros de 1% ao mês.",
            "IN RFB nº 1.234/2012; Lei 8.212/1991, art. 31; Lei 8.706/1993."));

        clausulas.add(clausula(6, "Split payment e liquidação",
            "O split muda quem entrega o tributo ao Fisco e cria dependência do comprovante de segregação.",
            "A partir da vigência do split payment, a Pagadora segregará o valor do IBS e da CBS destacados no "
                + "CT-e e o recolherá na forma regulamentada, pagando ao Transportador o valor líquido. A Pagadora "
                + "fornecerá o comprovante da segregação junto com o comprovante de pagamento; a falta de "
                + "comprovante autoriza o Transportador a suspender novas prestações após notificação.",
            "LC 214/2025 — split payment (regulamentação em curso)."));

        clausulas.add(clausula(7, "Créditos e documentos hábeis",
            "É o ponto em que o frete deixa de ser custo e volta a ser crédito.",
            "O Transportador emitirá documento hábil e regular para que a Pagadora se credite do ICMS, do PIS, "
                + "da COFINS, do IBS e da CBS. Se o crédito for glosado por erro do documento, o Transportador "
                + "indenizará a Pagadora no valor do crédito perdido, acrescido de multa de 10%, em até 30 dias "
                + "da notificação, sem prejuízo da retificação.",
            "LC 214/2025; Lei 10.637/2002; Lei 10.833/2003."));

        clausulas.add(clausula(8, "Vale-pedágio e despesas de viagem",
            "Separa o que é remuneração do que é adiantamento — base de cálculo dos tributos.",
            "O vale-pedágio obrigatório será antecipado pela Pagadora, em valor equivalente às praças da rota, e "
                + "pago diretamente ao transportador ou por meio de tag, vedado o repasse ao preço do frete. "
                + "Despesas de estadia, diária e agendamento somente serão devidas quando comprovadas e "
                + "previamente autorizadas, com limite do Anexo II.",
            "Lei 10.209/2001."));

        clausulas.add(clausula(9, "Reajuste e piso mínimo",
            "O piso ANTT e o diesel mudam mais rápido que o índice geral de preços.",
            "O frete será reajustado anualmente pela variação do IPCA, ou pelo índice setorial substituto, sem "
                + "prejuízo da revisão extraordinária em caso de variação do diesel superior a 5%. O reajuste "
                + "observará o piso mínimo ANTT vigente; se o piso superar o preço contratado, aplica-se o piso, "
                + "com efeito a partir da data de sua publicação.",
            "Lei 13.703/2018; resoluções da ANTT."));

        clausulas.add(clausula(10, "Auditoria, glosas e penalidades",
            "A conferência do CT-e é onde a reforma gera erro de valor: precisa de prazo e de motivação.",
            "A Pagadora terá 10 (dez) dias corridos do recebimento do CT-e para conferir valor, tributos e "
                + "documentos. A glosa somente será aplicada com indicação expressa da parcela, do fundamento e "
                + "do valor; glosa genérica é ineficaz. Documento aprovado e não pago no vencimento sujeita a "
                + "Pagadora a multa de 2% e juros de 1% ao mês.",
            "Lei 11.442/2007; Código Civil, arts. 408 e 409."));

        clausulas.add(clausula(11, "Vigência e transição de 2026 a 2033",
            "O contrato precisa atravessar nove anos de mudança de alíquota sem virar letra morta.",
            "As partes reconhecem o cronograma de transição da LC 214/2025 e revisarão este anexo até 30 de "
                + "novembro de cada ano, de 2026 a 2032, para refletir as alíquotas do ano seguinte. A ausência de "
                + "revisão não altera as alíquotas legais, que prevalecem sobre qualquer tabela desatualizada.",
            "ADCT (EC 132/2023), arts. 125 a 129; LC 214/2025."));

        clausulas.add(clausula(12, "Proteção de dados e sigilo",
            "O CT-e carrega CPF de motorista e dados de rota — e o produto vai armazenar isso.",
            "As partes tratarão os dados pessoais de motoristas e prepostos apenas para a execução do transporte, "
                + "com base legal no cumprimento de obrigação legal e contratual, mantendo registro das operações "
                + "e comunicando incidentes em até 72 horas. Os documentos fiscais serão guardados por 5 anos após "
                + "o último fato gerador a que se referirem.",
            "LGPD (Lei 13.709/2018), arts. 7º, 37 e 48."));

        return clausulas;
    }

    private List<OndaProduto> ondas() {
        return List.of(
            OndaProduto.builder()
                .numero(1)
                .titulo("Fechar o ciclo do documento")
                .objetivo("Sair da simulação e passar a ler o CT-e que a empresa recebe.")
                .prazo("12 a 16 semanas")
                .entregas(List.of(
                    "Importação do XML do CT-e e consulta de autorização na SEFAZ",
                    "Conferência de MDF-e, RNTRC e CIOT / piso ANTT",
                    "Conciliação parcela a parcela com a tabela de frete do contrato",
                    "Matriz completa de retenções por tipo de transportador"))
                .build(),
            OndaProduto.builder()
                .numero(2)
                .titulo("Fechar o ciclo do dinheiro")
                .objetivo("Transformar o cálculo em pagamento correto e crédito aproveitado.")
                .prazo("16 a 20 semanas")
                .entregas(List.of(
                    "Split payment: segregação, conciliação bancária e comprovantes",
                    "Contas a pagar com segregação de tributo, retenção e vale-pedágio",
                    "Apuração e escrituração de créditos por documento",
                    "Fluxo de caixa e relatórios gerenciais da transição"))
                .build(),
            OndaProduto.builder()
                .numero(3)
                .titulo("Escalar como produto")
                .objetivo("Vender para grupos com várias pagadoras, com segurança e preço defensável.")
                .prazo("20 a 24 semanas")
                .entregas(List.of(
                    "Multiempresa, perfis e permissões por CNPJ",
                    "LGPD, retenção de dados e trilha de auditoria",
                    "Observabilidade, SLA e plano de continuidade",
                    "Onboarding, importação de contratos e empacotamento comercial"))
                .build());
    }

    private LacunaProduto lacuna(String dimensao, String item, String situacao, int onda, String esforco,
            String impacto, String proximoPasso) {
        return LacunaProduto.builder()
                .dimensao(dimensao)
                .item(item)
                .situacao(situacao)
                .onda(onda)
                .esforco(esforco)
                .impacto(impacto)
                .proximoPasso(proximoPasso)
                .build();
    }

    private ClausulaContrato clausula(int numero, String titulo, String porque, String texto, String base) {
        return ClausulaContrato.builder()
                .numero(numero)
                .titulo(titulo)
                .porque(porque)
                .texto(texto)
                .base(base)
                .build();
    }

    private Double percentual(long parte, long total) {
        if (total == 0) {
            return 0d;
        }
        return BigDecimal.valueOf(parte * 100d / total).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private String formatar(BigDecimal valor) {
        return valor == null ? "0,00" : valor.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

}
