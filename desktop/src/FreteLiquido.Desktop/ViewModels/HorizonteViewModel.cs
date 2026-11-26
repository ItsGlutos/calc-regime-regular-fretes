using System.Collections.ObjectModel;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>
/// Aba secundária: o mesmo frete ano a ano, com três leituras — custo líquido,
/// crédito e carga — e dois cenários de preço (contrato congelado ou repasse).
/// </summary>
public sealed class HorizonteViewModel : ObservableObject
{
    private readonly ISimuladorFrete _simulador;

    private EntradaSimulacao? _entrada;
    private IReadOnlyList<AnoReforma> _serie = Array.Empty<AnoReforma>();
    private bool _comRepasse;
    private string _metrica = MetricaLiquido;
    private string _nota = string.Empty;

    public const string MetricaLiquido = "liquido";
    public const string MetricaCredito = "credito";
    public const string MetricaCarga = "carga";

    public HorizonteViewModel(ISimuladorFrete simulador)
    {
        _simulador = simulador;
    }

    public ObservableCollection<BarraAno> Barras { get; } = new();

    public ObservableCollection<ItemKpi> Kpis { get; } = new();

    public ObservableCollection<LinhaAno> Linhas { get; } = new();

    public string Nota
    {
        get => _nota;
        private set => Definir(ref _nota, value);
    }

    public string TituloMetrica => _metrica switch
    {
        MetricaCredito => "Crédito total",
        MetricaCarga => "Carga destacada",
        _ => "Custo líquido",
    };

    public bool PrecoDeHoje
    {
        get => !_comRepasse;
        set
        {
            if (value)
            {
                DefinirCenario(comRepasse: false);
            }
        }
    }

    public bool ComRepasse
    {
        get => _comRepasse;
        set
        {
            if (value)
            {
                DefinirCenario(comRepasse: true);
            }
        }
    }

    public bool MetricaLiquidoSelecionada
    {
        get => _metrica == MetricaLiquido;
        set
        {
            if (value)
            {
                DefinirMetrica(MetricaLiquido);
            }
        }
    }

    public bool MetricaCreditoSelecionada
    {
        get => _metrica == MetricaCredito;
        set
        {
            if (value)
            {
                DefinirMetrica(MetricaCredito);
            }
        }
    }

    public bool MetricaCargaSelecionada
    {
        get => _metrica == MetricaCarga;
        set
        {
            if (value)
            {
                DefinirMetrica(MetricaCarga);
            }
        }
    }

    public string RotuloCenario => _comRepasse
        ? "Preço com repasse integral da carga"
        : "Preço de contrato congelado";

    public void Atualizar(EntradaSimulacao entrada)
    {
        _entrada = entrada;
        _serie = _simulador.Serie(entrada);
        Recalcular();
    }

    private void DefinirCenario(bool comRepasse)
    {
        if (_comRepasse == comRepasse)
        {
            return;
        }

        _comRepasse = comRepasse;
        Notificar(nameof(ComRepasse), nameof(PrecoDeHoje), nameof(RotuloCenario));
        Recalcular();
    }

    private void DefinirMetrica(string metrica)
    {
        if (_metrica == metrica)
        {
            return;
        }

        _metrica = metrica;
        Notificar(
            nameof(MetricaLiquidoSelecionada),
            nameof(MetricaCreditoSelecionada),
            nameof(MetricaCargaSelecionada),
            nameof(TituloMetrica));
        Recalcular();
    }

    private decimal ValorDe(AnoReforma ano) => _metrica switch
    {
        MetricaCredito => ano.Credito,
        MetricaCarga => ano.Carga,
        _ => _comRepasse ? ano.LiquidoComRepasse : ano.CustoLiquido,
    };

    private void Recalcular()
    {
        if (_entrada is null || _serie.Count == 0)
        {
            return;
        }

        var anoSelecionado = _entrada.Ano;
        var valores = _serie.Select(ValorDe).ToArray();
        var maximo = valores.Length > 0 ? valores.Max() : 0m;

        Barras.Clear();
        foreach (var ano in _serie)
        {
            var valor = ValorDe(ano);
            var altura = maximo <= 0m ? 24d : 26d + (double)(valor / maximo) * 150d;
            var percentual = _metrica switch
            {
                MetricaCredito => Formatador.Percentual(ano.PercentualCredito),
                MetricaCarga => Formatador.Percentual(ano.PercentualCarga),
                _ => Formatador.Percentual(100m - ano.PercentualCredito),
            };

            var fundo = ano.Ano <= 2026
                ? Paleta.GradienteBarraAntes
                : ano.Ano == anoSelecionado
                    ? Paleta.GradienteBarraDestaque
                    : Paleta.GradienteBarra;

            Barras.Add(new BarraAno(
                ano.Ano.ToString(Formatador.Brasil),
                FaseCurta(ano.Ano),
                Formatador.Moeda(valor),
                percentual,
                altura,
                fundo,
                ano.Ano == anoSelecionado,
                ano.Ano <= 2026));
        }

        MontarKpis();
        MontarLinhas();
        Nota = _comRepasse
            ? "Com repasse integral: o transportador reajusta o preço pela carga do ano. O caixa sobe; com crédito integral, o custo líquido não muda."
            : "Preço de hoje: o contrato não muda e a variação aparece toda no custo líquido do pagador.";
    }

    private void MontarKpis()
    {
        var hoje = _serie.FirstOrDefault(a => a.Ano == 2026);
        var primeiro = _serie.FirstOrDefault(a => a.Ano == 2027);
        var pleno = _serie.FirstOrDefault(a => a.Ano == 2033);

        Kpis.Clear();
        Kpis.Add(new ItemKpi("Hoje · 2026", Formatador.Moeda(hoje is null ? 0m : ValorDe(hoje)), RotuloCenario, Paleta.Tinta));
        Kpis.Add(new ItemKpi("2027 · CBS cheia", Formatador.Moeda(primeiro is null ? 0m : ValorDe(primeiro)), "primeiro ano com CBS no lugar do PIS/COFINS", Paleta.Oliva));
        Kpis.Add(new ItemKpi("2033 · regime pleno", Formatador.Moeda(pleno is null ? 0m : ValorDe(pleno)), "CBS 8,50% + IBS 18,50%", Paleta.Tinta));

        if (hoje is not null && pleno is not null && ValorDe(hoje) > 0m)
        {
            var variacao = (ValorDe(pleno) - ValorDe(hoje)) / ValorDe(hoje) * 100m;
            var cor = variacao < 0m ? Paleta.Verde : variacao > 0m ? Paleta.Ambar : Paleta.Texto;
            Kpis.Add(new ItemKpi("Variação 2026 → 2033", Formatador.Variacao(variacao), $"em {TituloMetrica.ToLowerInvariant()}", cor));
        }
    }

    private void MontarLinhas()
    {
        var base2026 = _serie.FirstOrDefault(a => a.Ano == 2026);

        Linhas.Clear();
        foreach (var ano in _serie)
        {
            var liquido = _comRepasse ? ano.LiquidoComRepasse : ano.CustoLiquido;
            var bruto = _comRepasse ? ano.BrutoComRepasse : _entrada!.ValorFrete;
            var variacao = base2026 is null ? 0m : ano.VariacaoPercentual;
            var cor = ano.Ano == 2026
                ? Paleta.TextoFraco
                : variacao < 0m
                    ? Paleta.Verde
                    : variacao > 0m
                        ? Paleta.Ambar
                        : Paleta.Texto;

            Linhas.Add(new LinhaAno(
                ano.Ano.ToString(Formatador.Brasil),
                ano.Fase,
                Formatador.Moeda(bruto),
                Formatador.Moeda(ano.Credito),
                Formatador.Moeda(liquido),
                ano.Ano == 2026 ? "—" : Formatador.Variacao(variacao),
                cor,
                ano.Ano <= 2026));
        }
    }

    private static string FaseCurta(int ano) => ano switch
    {
        2025 => "antes",
        2026 => "teste",
        2027 => "CBS cheia",
        2029 => "transição",
        2030 => "transição",
        2031 => "transição",
        2032 => "transição",
        2033 => "pleno",
        _ => string.Empty,
    };
}
