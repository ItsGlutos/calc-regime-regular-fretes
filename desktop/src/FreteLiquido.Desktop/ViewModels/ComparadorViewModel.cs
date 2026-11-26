using System.Collections.ObjectModel;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>
/// Aba secundária: o mesmo trecho, preços e regimes diferentes. O ranking é por
/// custo líquido total — nunca pelo preço nominal.
/// </summary>
public sealed class ComparadorViewModel : ObservableObject
{
    private readonly ISimuladorFrete _simulador;
    private readonly List<TransportadoraEntrada> _extras = new();

    private EntradaSimulacao? _entrada;
    private string _resumo = string.Empty;
    private string _contexto = string.Empty;

    public ComparadorViewModel(ISimuladorFrete simulador)
    {
        _simulador = simulador;
        AdicionarCommand = new RelayCommand(Adicionar);
    }

    public ObservableCollection<CartaoTransportadora> Cartoes { get; } = new();

    public RelayCommand AdicionarCommand { get; }

    public string Resumo
    {
        get => _resumo;
        private set => Definir(ref _resumo, value);
    }

    public string Contexto
    {
        get => _contexto;
        private set => Definir(ref _contexto, value);
    }

    public void Atualizar(EntradaSimulacao entrada)
    {
        _entrada = entrada;
        Recalcular();
    }

    private IReadOnlyList<TransportadoraEntrada> Entradas()
    {
        var lista = new List<TransportadoraEntrada>
        {
            new("Serra Oliva Logística", ModalidadeOpcao.RegimeRegular, 1.00m),
            new("Via Brasil Transportes", ModalidadeOpcao.SimplesHibrido, 1.00m),
            new("Rota Sul Logística", ModalidadeOpcao.SimplesDas, 1.00m),
        };

        lista.AddRange(_extras);
        return lista;
    }

    private void Adicionar()
    {
        var indice = _extras.Count + 1;
        var modalidade = indice % 2 == 0
            ? ModalidadeOpcao.SimplesHibrido
            : ModalidadeOpcao.SimplesDas;

        _extras.Add(new TransportadoraEntrada(
            $"Transportadora {indice + 3}",
            modalidade,
            1.00m + 0.04m * indice));

        Recalcular();
    }

    private void Recalcular()
    {
        if (_entrada is null)
        {
            return;
        }

        var avaliadas = _simulador.Comparar(_entrada, Entradas());
        var maximo = avaliadas.Count > 0 ? avaliadas.Max(t => t.CustoTotal) : 0m;

        Cartoes.Clear();
        for (var i = 0; i < avaliadas.Count; i++)
        {
            var t = avaliadas[i];
            var melhor = t.MelhorCusto;
            var barra = maximo > 0m ? (double)(t.CustoTotal / maximo) : 0d;

            Cartoes.Add(new CartaoTransportadora(
                $"{i + 1}º",
                t.Nome,
                t.Regime,
                Formatador.Moeda(t.Preco),
                Formatador.Moeda(t.Credito),
                Formatador.Percentual(t.PercentualCredito),
                Formatador.Moeda(t.CustoTotal),
                melhor
                    ? "melhor custo líquido"
                    : $"+{Formatador.Moeda(t.DiferencaParaMelhor)} vs. melhor",
                melhor,
                barra,
                melhor ? Paleta.Oliva050 : Paleta.SuperficieSuave,
                melhor ? Paleta.Oliva200 : Paleta.Linha,
                melhor ? Paleta.Oliva : Paleta.Texto));
        }

        var primeiro = avaliadas.FirstOrDefault();
        var ultimo = avaliadas.LastOrDefault();
        var economia = primeiro is not null && ultimo is not null
            ? ultimo.CustoTotal - primeiro.CustoTotal
            : 0m;

        Resumo = primeiro is null
            ? string.Empty
            : $"{avaliadas.Count} transportadoras para {Formatador.Moeda(_entrada.ValorFrete)} em {_entrada.Ano}. " +
              $"A diferença entre a melhor e a pior é de {Formatador.Moeda(economia)} — {Formatador.Percentual(_entrada.ValorFrete > 0m ? economia / _entrada.ValorFrete * 100m : 0m)} do frete.";

        Contexto = $"{_entrada.Ano} · {_entrada.Rota} · {_entrada.TipoOperacao} · {_entrada.Pagadora.Curto}";
    }
}
