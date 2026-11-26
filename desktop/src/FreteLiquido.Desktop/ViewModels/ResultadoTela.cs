using Avalonia.Media;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>
/// Tudo o que a tela da calculadora precisa mostrar, já formatado.
/// A ViewModel não formata nada: ela troca este objeto a cada cálculo.
/// </summary>
public sealed class ResultadoTela
{
    public string ChipRegime { get; init; } = string.Empty;
    public string ChipOperacao { get; init; } = string.Empty;
    public string ChipRota { get; init; } = string.Empty;
    public string ChipAno { get; init; } = string.Empty;

    public string RotuloAno { get; init; } = string.Empty;
    public string LiquidoInteiro { get; init; } = "0";
    public string LiquidoCentavos { get; init; } = ",00";
    public string SubLiquido { get; init; } = string.Empty;
    public string PercentualCredito { get; init; } = "0,00%";
    public string PercentualCusto { get; init; } = "100,00%";
    public double BarraCredito { get; init; }

    public string BaseRotulo { get; init; } = "2026 · hoje";
    public string BaseValor { get; init; } = string.Empty;
    public string BaseDelta { get; init; } = "—";

    public string AnoRotulo { get; init; } = string.Empty;
    public string AnoValor { get; init; } = string.Empty;
    public string AnoDelta { get; init; } = "—";
    public IBrush AnoCor { get; init; } = Paleta.Verde;

    public string PlenoRotulo { get; init; } = "2033 · pleno";
    public string PlenoValor { get; init; } = string.Empty;
    public string PlenoDelta { get; init; } = "—";
    public IBrush PlenoCor { get; init; } = Paleta.Verde;

    public bool TemInsight { get; init; }
    public string InsightSimbolo { get; init; } = "!";
    public string InsightTitulo { get; init; } = string.Empty;
    public string InsightTexto { get; init; } = string.Empty;
    public IBrush InsightFundo { get; init; } = Paleta.Ambar050;
    public IBrush InsightBorda { get; init; } = Paleta.AmbarLinha;
    public IBrush InsightCor { get; init; } = Paleta.Ambar;

    public IReadOnlyList<DetalheLinha> Detalhes { get; init; } = Array.Empty<DetalheLinha>();
    public IReadOnlyList<ItemSerie> Serie { get; init; } = Array.Empty<ItemSerie>();
    public IReadOnlyList<AvisoTela> Avisos { get; init; } = Array.Empty<AvisoTela>();
    public string Fonte { get; init; } = string.Empty;
    public string NotaFonte { get; init; } = string.Empty;

    private static readonly int[] AnosDaSerie = { 2026, 2027, 2029, 2031, 2033 };

    public static ResultadoTela Criar(ResultadoSimulacao resultado, IReadOnlyList<AnoReforma> serie)
    {
        var entrada = resultado.Entrada;
        var cultura = Formatador.Brasil;
        var numero = resultado.CustoLiquido.ToString("N2", cultura);
        var partes = numero.Split(',');

        var base2026 = serie.FirstOrDefault(a => a.Ano == 2026);
        var pleno2033 = serie.FirstOrDefault(a => a.Ano == 2033);
        var selecionados = AnosDaSerie
            .Select(ano => serie.FirstOrDefault(a => a.Ano == ano))
            .Where(a => a is not null)
            .Select(a => a!)
            .ToArray();

        var minimo = selecionados.Length > 0 ? selecionados.Min(a => a.CustoLiquido) : 0m;
        var maximo = selecionados.Length > 0 ? selecionados.Max(a => a.CustoLiquido) : 0m;

        var itens = selecionados.Select(a =>
        {
            var altura = maximo == minimo
                ? 38d
                : 20d + (double)((a.CustoLiquido - minimo) / (maximo - minimo)) * 44d;

            var corDelta = a.VariacaoValor switch
            {
                < 0m => Paleta.Verde,
                > 0m => Paleta.Ambar,
                _ => Paleta.TextoFraco,
            };

            var fundo = a.Ano <= 2026
                ? Paleta.GradienteBarraAntes
                : a.Ano == resultado.Ano
                    ? Paleta.GradienteBarraDestaque
                    : Paleta.GradienteBarra;

            return new ItemSerie(
                a.Ano.ToString(cultura),
                RotuloCurto(a.Ano),
                Formatador.Moeda(a.CustoLiquido),
                a.Ano == 2026 ? "—" : Formatador.Variacao(a.VariacaoPercentual),
                corDelta,
                altura,
                fundo,
                a.Ano == resultado.Ano);
        }).ToArray();

        var naoAproveitado = Math.Max(0m, resultado.Carga - resultado.CreditoTotal);
        var detalhes = new List<DetalheLinha>
        {
            new(
                "CBS/IBS creditável",
                Formatador.Moeda(resultado.CreditoCbsIbs),
                entrada.Modalidade.Estimativa ? "estimativa setorial" : "destaque do documento"),
            new(
                "ICMS + PIS/COFINS creditáveis",
                Formatador.Moeda(resultado.CreditoAntigos),
                resultado.CreditoAntigos > 0m
                    ? "tributos anteriores ainda creditáveis no ano"
                    : "sem crédito desses tributos neste ano"),
        };

        if (naoAproveitado > 0m)
        {
            detalhes.Add(new DetalheLinha(
                "Crédito não aproveitado",
                Formatador.Moeda(naoAproveitado),
                entrada.EhB2C
                    ? "operação B2C: o crédito não é aproveitável"
                    : "tributo destacado que não vira crédito"));
        }

        var (temInsight, simbolo, titulo, texto, fundo, borda, cor) = MontarInsight(resultado);

        return new ResultadoTela
        {
            ChipRegime = entrada.Modalidade.Curto,
            ChipOperacao = entrada.TipoOperacao,
            ChipRota = entrada.Rota,
            ChipAno = resultado.Ano.ToString(cultura),

            RotuloAno = $"{resultado.Ano} · {RotuloCurto(resultado.Ano)}",
            LiquidoInteiro = partes[0],
            LiquidoCentavos = partes.Length > 1 ? "," + partes[1] : string.Empty,
            SubLiquido = $"de {Formatador.Moeda(entrada.ValorFrete)} nominais · crédito de {Formatador.Moeda(resultado.CreditoTotal)} ({Formatador.Percentual(resultado.PercentualCredito)})",
            PercentualCredito = Formatador.Percentual(resultado.PercentualCredito),
            PercentualCusto = Formatador.Percentual(resultado.PercentualCusto),
            BarraCredito = (double)(resultado.PercentualCredito / 100m),

            BaseRotulo = "2026 · hoje",
            BaseValor = Formatador.Moeda(base2026?.CustoLiquido ?? resultado.CustoBase),
            BaseDelta = "referência",

            AnoRotulo = $"{resultado.Ano} · {RotuloCurto(resultado.Ano)}",
            AnoValor = Formatador.Moeda(resultado.CustoLiquido),
            AnoDelta = resultado.VariacaoValor == 0m
                ? "sem variação"
                : Formatador.Variacao(resultado.VariacaoPercentual),
            AnoCor = resultado.VariacaoValor switch
            {
                < 0m => Paleta.Verde,
                > 0m => Paleta.Ambar,
                _ => Paleta.Texto,
            },

            PlenoRotulo = "2033 · regime pleno",
            PlenoValor = Formatador.Moeda(pleno2033?.CustoLiquido ?? resultado.CustoLiquido),
            PlenoDelta = pleno2033 is null || pleno2033.Ano == 2026
                ? "—"
                : Formatador.Variacao(pleno2033.VariacaoPercentual),
            PlenoCor = (pleno2033?.VariacaoValor ?? 0m) switch
            {
                < 0m => Paleta.Verde,
                > 0m => Paleta.Ambar,
                _ => Paleta.Texto,
            },

            TemInsight = temInsight,
            InsightSimbolo = simbolo,
            InsightTitulo = titulo,
            InsightTexto = texto,
            InsightFundo = fundo,
            InsightBorda = borda,
            InsightCor = cor,

            Detalhes = detalhes,
            Serie = itens,
            Avisos = resultado.Avisos.Select(ParaTela).ToArray(),
            Fonte = resultado.Fonte,
            NotaFonte = entrada.Modalidade.Fonte,
        };
    }

    private static (bool Tem, string Simbolo, string Titulo, string Texto, IBrush Fundo, IBrush Borda, IBrush Cor) MontarInsight(
        ResultadoSimulacao resultado)
    {
        if (resultado.CreditoBaixo && !resultado.Entrada.EhB2C)
        {
            return (
                true,
                "!",
                "Crédito efetivo abaixo de 4%",
                $"O regime transfere apenas {Formatador.Percentual(resultado.PercentualCredito)} do frete. " +
                "Um transportador que transfere mais crédito pode sair mais barato mesmo cobrando mais no nominal.",
                Paleta.Ambar050,
                Paleta.AmbarLinha,
                Paleta.Ambar);
        }

        if (resultado.VariacaoValor > 0m)
        {
            return (
                true,
                "↑",
                "Custo acima de hoje",
                $"Em {resultado.Ano} o mesmo frete custa {Formatador.Moeda(resultado.VariacaoValor)} a mais que em 2026 " +
                $"({Formatador.Variacao(resultado.VariacaoPercentual)}). A troca de PIS/COFINS por CBS derruba o crédito " +
                "antes de o IBS entrar cheio.",
                Paleta.Ambar050,
                Paleta.AmbarLinha,
                Paleta.Ambar);
        }

        if (resultado.VariacaoValor < 0m)
        {
            return (
                true,
                "↓",
                "Custo abaixo de hoje",
                $"Em {resultado.Ano} o mesmo frete custa {Formatador.Moeda(Math.Abs(resultado.VariacaoValor))} a menos que em 2026 " +
                $"({Formatador.Variacao(resultado.VariacaoPercentual)}). O crédito de CBS/IBS cresce até o regime pleno.",
                Paleta.Verde050,
                Paleta.VerdeLinha,
                Paleta.Verde);
        }

        return (
            false,
            "=",
            "Mesmo custo de hoje",
            "O crédito do ano compensa exatamente a carga tributária.",
            Paleta.Oliva050,
            Paleta.Oliva200,
            Paleta.Oliva);
    }

    public static AvisoTela ParaTela(Aviso aviso) => aviso.Gravidade switch
    {
        Aviso.Critico => new AvisoTela("×", aviso.Titulo, aviso.Texto, Paleta.Vermelho050, Paleta.Vermelho, Paleta.Vermelho),
        Aviso.Atencao => new AvisoTela("!", aviso.Titulo, aviso.Texto, Paleta.Ambar050, Paleta.AmbarLinha, Paleta.Ambar),
        _ => new AvisoTela("i", aviso.Titulo, aviso.Texto, Paleta.Oliva050, Paleta.Oliva200, Paleta.Oliva),
    };

    private static string RotuloCurto(int ano) => ano switch
    {
        2025 => "antes da reforma",
        2026 => "hoje",
        2027 => "CBS cheia",
        2028 => "IBS em teste",
        2029 => "transição",
        2030 => "transição",
        2031 => "transição",
        2032 => "transição",
        _ => "regime pleno",
    };
}
