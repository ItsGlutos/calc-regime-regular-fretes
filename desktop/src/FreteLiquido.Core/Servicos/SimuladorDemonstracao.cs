using System.Globalization;
using System.Text.Json;
using FreteLiquido.Core.Modelos;

namespace FreteLiquido.Core.Servicos;

/// <summary>Contrato do simulador usado pela interface.</summary>
public interface ISimuladorFrete
{
    ResultadoSimulacao Simular(EntradaSimulacao entrada);

    IReadOnlyList<AnoReforma> Serie(EntradaSimulacao entrada);

    IReadOnlyList<TransportadoraAvaliada> Comparar(EntradaSimulacao entrada, IReadOnlyList<TransportadoraEntrada> transportadoras);
}

/// <summary>Transportadora do comparador: preço relativo ao frete de referência.</summary>
public sealed record TransportadoraEntrada(string Nome, string ModalidadeId, decimal FatorPreco);

/// <summary>
/// Simulador de demonstração.
///
/// Reproduz a leitura documentada do Frete Líquido — regime regular de
/// R$ 1.000,00 saindo de 16,25% de crédito em 2026 para 27,00% em 2033, com o
/// custo acima de hoje em 2027 — a partir de um cronograma fixo de alíquotas.
/// Nenhuma chamada é feita aos motores oficiais: substituir esta classe por um
/// cliente HTTP é o único trabalho de integração previsto.
/// </summary>
public sealed class SimuladorDemonstracao : ISimuladorFrete
{
    private const decimal PercentualSimplesDas = 2.385m; // CBS 2,3591 + IBS 0,0260 (PGDAS)
    private const decimal PercentualAutonomoMei = 1.80m;

    /// <summary>Ano de comparação ("hoje"): primeiro ano do cronograma com crédito de CBS/IBS.</summary>
    public const int AnoBase = 2026;

    private sealed record Marco(
        int Ano,
        string Fase,
        string Rotulo,
        decimal Icms,
        decimal PisCofins,
        decimal Cbs,
        decimal Ibs);

    private static readonly Marco[] Cronograma =
    {
        new(2025, "Regime anterior", "ICMS + PIS/COFINS", 7.00m, 9.25m, 0m, 0m),
        new(2026, "Fase de teste", "CBS/IBS 1,00% sem crédito", 7.00m, 9.25m, 0.90m, 0.10m),
        new(2027, "CBS cheia", "IBS em teste", 7.00m, 0m, 8.40m, 0.10m),
        new(2028, "CBS cheia", "IBS em teste", 7.00m, 0m, 8.40m, 0.10m),
        new(2029, "Transição do IBS", "ICMS −1/9 ao ano", 6.30m, 0m, 8.50m, 1.85m),
        new(2030, "Transição do IBS", "ICMS −2/9", 5.60m, 0m, 8.50m, 3.70m),
        new(2031, "Transição do IBS", "ICMS −3/9", 4.90m, 0m, 8.50m, 5.55m),
        new(2032, "Transição do IBS", "ICMS −4/9", 4.20m, 0m, 8.50m, 7.40m),
        new(2033, "Regime pleno", "CBS 8,50 + IBS 18,50", 0m, 0m, 8.50m, 18.50m),
    };

    private static Marco MarcoDe(int ano) =>
        Cronograma.FirstOrDefault(m => m.Ano == ano) ?? Cronograma[^1];

    public ResultadoSimulacao Simular(EntradaSimulacao entrada)
    {
        var resultado = Calcular(entrada, entrada.Ano);
        var baseCalculo = entrada.Ano == AnoBase
            ? resultado
            : Calcular(entrada, AnoBase);

        var variacaoValor = Arredondar(resultado.CustoLiquido - baseCalculo.CustoLiquido);
        var variacaoPercentual = baseCalculo.CustoLiquido > 0m
            ? Arredondar(variacaoValor / baseCalculo.CustoLiquido * 100m)
            : 0m;

        return resultado with
        {
            CustoBase = baseCalculo.CustoLiquido,
            VariacaoValor = variacaoValor,
            VariacaoPercentual = variacaoPercentual,
        };
    }

    private ResultadoSimulacao Calcular(EntradaSimulacao entrada, int ano)
    {
        var marco = MarcoDe(ano);
        var modalidade = entrada.Modalidade;
        var valor = entrada.ValorFrete;

        var ehSimples = modalidade.RegimeId == RegimeOpcao.Simples;
        var creditaAntigos = !ehSimples && !entrada.EhB2C;
        var percentualAntigos = creditaAntigos
            ? marco.Icms + (entrada.Pagadora.CreditaPisCofins ? marco.PisCofins : 0m)
            : 0m;

        var percentualCbsIbs = PercentualCreditoCbsIbs(entrada, marco);
        var creditoAntigos = Arredondar(percentualAntigos / 100m * valor);
        var creditoCbsIbs = Arredondar(percentualCbsIbs / 100m * valor);
        var creditoTotal = creditoAntigos + creditoCbsIbs;

        var percentualCarga = PercentualCarga(entrada, marco);
        var carga = Arredondar(percentualCarga / 100m * valor);

        var custo = Arredondar(valor - creditoTotal);
        var percentualCredito = valor > 0m ? Arredondar(creditoTotal / valor * 100m) : 0m;
        var percentualCusto = Arredondar(100m - percentualCredito);

        var memoria = MontarMemoria(entrada, marco, percentualAntigos, percentualCbsIbs, creditoAntigos, creditoCbsIbs, creditoTotal, custo, carga);
        var avisos = MontarAvisos(entrada, marco, percentualCredito, creditoTotal);

        return new ResultadoSimulacao(
            entrada,
            ano,
            carga,
            percentualCarga,
            creditoCbsIbs,
            creditoAntigos,
            creditoTotal,
            percentualCredito,
            custo,
            percentualCusto,
            custo,
            0m,
            0m,
            memoria,
            avisos,
            modalidade.Estimativa ? "Estimativa setorial · demonstração" : "Destaque simulado · demonstração",
            MontarJson(entrada, marco, creditoCbsIbs, creditoAntigos, creditoTotal, custo));
    }

    /// <summary>Percentual do frete que volta como crédito de CBS/IBS.</summary>
    private static decimal PercentualCreditoCbsIbs(EntradaSimulacao entrada, Marco marco)
    {
        if (entrada.EhB2C)
        {
            return 0m;
        }

        return entrada.Modalidade.Id switch
        {
            // O optante do Simples tem CBS/IBS dentro do DAS: o que o CT-e
            // transfere é o destaque do PGDAS, não a alíquota cheia.
            ModalidadeOpcao.SimplesDas => marco.Ano <= 2026 ? 0m : PercentualSimplesDas,
            ModalidadeOpcao.AutonomoMei => marco.Ano <= 2026 ? 0m : PercentualAutonomoMei,
            ModalidadeOpcao.SimplesHibrido => marco.Ano <= 2026 ? 0m : marco.Cbs + marco.Ibs,
            _ => marco.Ano <= 2026 ? 0m : marco.Cbs + marco.Ibs,
        };
    }

    /// <summary>Tributos destacados no documento (carga), em % do frete.</summary>
    private static decimal PercentualCarga(EntradaSimulacao entrada, Marco marco)
    {
        if (entrada.Modalidade.Id == ModalidadeOpcao.SimplesHibrido)
        {
            return marco.Cbs + marco.Ibs;
        }

        if (entrada.Modalidade.RegimeId == RegimeOpcao.Simples ||
            entrada.Modalidade.Id == ModalidadeOpcao.AutonomoMei)
        {
            return 0m; // DAS não destaca tributo no CT-e
        }

        return marco.Icms + marco.PisCofins + marco.Cbs + marco.Ibs;
    }

    private static IReadOnlyList<LinhaMemoria> MontarMemoria(
        EntradaSimulacao entrada,
        Marco marco,
        decimal percentualAntigos,
        decimal percentualCbsIbs,
        decimal creditoAntigos,
        decimal creditoCbsIbs,
        decimal creditoTotal,
        decimal custo,
        decimal carga)
    {
        var linhas = new List<LinhaMemoria>
        {
            new(
                "Entrada",
                "Preço nominal do frete",
                "Valor cobrado pela transportadora, sem considerar crédito.",
                Formatador.Moeda(entrada.ValorFrete)),
        };

        if (entrada.Modalidade.RegimeId == RegimeOpcao.Simples &&
            entrada.Modalidade.Id == ModalidadeOpcao.SimplesDas)
        {
            linhas.Add(new LinhaMemoria(
                "Crédito",
                $"CBS/IBS no Simples · {marco.Ano}",
                $"{Formatador.Percentual(percentualCbsIbs)} do frete — CBS 2,3591% + IBS 0,0260% (PGDAS, Anexo III).",
                Formatador.Moeda(creditoCbsIbs)));
        }
        else if (percentualCbsIbs > 0m)
        {
            linhas.Add(new LinhaMemoria(
                "Crédito",
                $"CBS/IBS destacado · {marco.Ano}",
                $"CBS {Formatador.Percentual(marco.Cbs)} ({Formatador.Moeda(Arredondar(marco.Cbs / 100m * entrada.ValorFrete))}) + IBS {Formatador.Percentual(marco.Ibs)} ({Formatador.Moeda(Arredondar(marco.Ibs / 100m * entrada.ValorFrete))}).",
                Formatador.Moeda(creditoCbsIbs)));
        }

        if (percentualAntigos > 0m)
        {
            linhas.Add(new LinhaMemoria(
                "Crédito",
                "ICMS + PIS/COFINS creditáveis",
                $"ICMS {Formatador.Percentual(marco.Icms)} + PIS/COFINS {Formatador.Percentual(entrada.Pagadora.CreditaPisCofins ? marco.PisCofins : 0m)} sobre o frete.",
                Formatador.Moeda(creditoAntigos)));
        }

        linhas.Add(new LinhaMemoria(
            "Crédito",
            "Crédito total do pagador",
            $"CBS/IBS {Formatador.Moeda(creditoCbsIbs)} + antigos {Formatador.Moeda(creditoAntigos)}.",
            Formatador.Moeda(creditoTotal),
            true));

        if (carga > 0m)
        {
            linhas.Add(new LinhaMemoria(
                "Documento",
                "Carga tributária destacada",
                $"{Formatador.Percentual(marco.Icms + marco.PisCofins + marco.Cbs + marco.Ibs)} do frete em tributos no CT-e.",
                Formatador.Moeda(carga)));
        }

        linhas.Add(new LinhaMemoria(
            "Resultado",
            "Custo líquido total",
            $"{Formatador.Moeda(entrada.ValorFrete)} − {Formatador.Moeda(creditoTotal)} de crédito total.",
            Formatador.Moeda(custo),
            true));

        return linhas;
    }

    private static IReadOnlyList<Aviso> MontarAvisos(
        EntradaSimulacao entrada,
        Marco marco,
        decimal percentualCredito,
        decimal creditoTotal)
    {
        var avisos = new List<Aviso>
        {
            new(
                "Prévia com dados de demonstração",
                "Esta build não consulta os motores oficiais da Receita: as alíquotas vêm de um cronograma fixo da LC 214/2025.",
                Aviso.Informativo),
        };

        if (entrada.EhB2C)
        {
            avisos.Add(new Aviso(
                "Operação B2C",
                "O pagador é o consumidor final: o crédito do frete não é aproveitável e o custo é o preço cheio.",
                Aviso.Atencao));
        }

        if (marco.Ano == 2026)
        {
            avisos.Add(new Aviso(
                "2026 é ano de teste",
                "O CBS/IBS de 1,00% é destacado mas não gera crédito ao adquirente (LC 214/2025, art. 348).",
                Aviso.Informativo));
        }

        if (entrada.Modalidade.Estimativa)
        {
            avisos.Add(new Aviso(
                "Crédito estimado",
                $"{entrada.Modalidade.Fonte}. Informe as alíquotas efetivas do PGDAS para o cálculo real.",
                Aviso.Atencao));
        }

        if (percentualCredito < 4m && creditoTotal >= 0m && !entrada.EhB2C)
        {
            avisos.Add(new Aviso(
                "Crédito efetivo abaixo de 4%",
                $"O regime transfere apenas {Formatador.Percentual(percentualCredito)} do frete. Um transportador que transfere mais crédito pode sair mais barato mesmo cobrando mais no nominal.",
                Aviso.Atencao));
        }

        return avisos;
    }

    public IReadOnlyList<AnoReforma> Serie(EntradaSimulacao entrada)
    {
        var baseCalculo = Calcular(entrada, AnoBase);
        var cargaBase = entrada.ValorFrete > 0m ? baseCalculo.Carga / entrada.ValorFrete : 0m;
        var lista = new List<AnoReforma>();

        foreach (var ano in Catalogo.SerieCompleta)
        {
            var marco = MarcoDe(ano);
            var resultado = Calcular(entrada, ano);
            var cargaAno = entrada.ValorFrete > 0m ? resultado.Carga / entrada.ValorFrete : 0m;

            var brutoRepasse = entrada.ValorFrete;
            if (1m - cargaAno > 0.01m)
            {
                brutoRepasse = Arredondar(entrada.ValorFrete * (1m - cargaBase) / (1m - cargaAno));
            }

            var creditoRepasse = Arredondar(resultado.PercentualCredito / 100m * brutoRepasse);
            var liquidoRepasse = Arredondar(brutoRepasse - creditoRepasse);
            var variacao = Arredondar(resultado.CustoLiquido - baseCalculo.CustoLiquido);
            var variacaoPercentual = baseCalculo.CustoLiquido > 0m
                ? Arredondar(variacao / baseCalculo.CustoLiquido * 100m)
                : 0m;

            lista.Add(new AnoReforma(
                ano,
                marco.Fase,
                marco.Rotulo,
                resultado.Carga,
                resultado.PercentualCarga,
                Arredondar(resultado.CreditoCbsIbs + 0m),
                marco.Cbs,
                marco.Ibs,
                resultado.CreditoAntigos,
                resultado.CreditoTotal,
                resultado.PercentualCredito,
                resultado.CustoLiquido,
                variacao,
                variacaoPercentual,
                brutoRepasse,
                liquidoRepasse));
        }

        return lista;
    }

    public IReadOnlyList<TransportadoraAvaliada> Comparar(
        EntradaSimulacao entrada,
        IReadOnlyList<TransportadoraEntrada> transportadoras)
    {
        var avaliadas = transportadoras
            .Select(t =>
            {
                var preco = Arredondar(entrada.ValorFrete * t.FatorPreco);
                var simulacao = Calcular(entrada with { ModalidadeId = t.ModalidadeId }, entrada.Ano);
                var percentual = preco > 0m ? Arredondar(simulacao.PercentualCredito) : 0m;
                var credito = Arredondar(percentual / 100m * preco);
                return new TransportadoraAvaliada(
                    t.Nome,
                    Catalogo.Modalidade(t.ModalidadeId).Curto,
                    t.ModalidadeId,
                    preco,
                    credito,
                    percentual,
                    Arredondar(preco - credito));
            })
            .OrderBy(t => t.CustoTotal)
            .ToList();

        var melhor = avaliadas[0].CustoTotal;

        return avaliadas
            .Select(t => t with
            {
                MelhorCusto = t.CustoTotal == melhor,
                DiferencaParaMelhor = Arredondar(t.CustoTotal - melhor),
            })
            .ToList();
    }

    private static decimal Arredondar(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);

    private static string MontarJson(
        EntradaSimulacao entrada,
        Marco marco,
        decimal creditoCbsIbs,
        decimal creditoAntigos,
        decimal creditoTotal,
        decimal custo)
    {
        var modalidade = entrada.Modalidade;
        var crt = modalidade.RegimeId == RegimeOpcao.Simples ? "1" : "3";

        var resposta = new
        {
            oper = new
            {
                data = DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                tpDoc = "57",
                CRT = crt,
                regimeApuracao = modalidade.Id == ModalidadeOpcao.SimplesDas ? "SN_PLENO" : "REGIME_REGULAR",
                indSubLimite = false,
            },
            itens = new[]
            {
                new
                {
                    numero = 1,
                    NBS = "105011220",
                    cClassTrib = "000001",
                    vItem = entrada.ValorFrete,
                    ufOrigem = entrada.UfOrigem,
                    ufDestino = entrada.UfDestino,
                },
            },
            tributos = new
            {
                cbs = marco.Cbs,
                ibs = marco.Ibs,
                icms = marco.Icms,
                pisCofins = marco.PisCofins,
            },
            resultado = new
            {
                vCBS = Arredondar(marco.Cbs / 100m * entrada.ValorFrete),
                vIBS = Arredondar(marco.Ibs / 100m * entrada.ValorFrete),
                vCreditoCbsIbs = creditoCbsIbs,
                vCreditoAntigos = creditoAntigos,
                vCreditoTotal = creditoTotal,
                vCusto = custo,
            },
            fonte = "demonstracao",
        };

        return JsonSerializer.Serialize(
            resposta,
            new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            });
    }
}
