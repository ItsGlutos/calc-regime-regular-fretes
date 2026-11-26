using Avalonia.Media;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>Janela principal: navegação, status e as quatro telas.</summary>
public sealed class PrincipalViewModel : ObservableObject
{
    private ItemNavegacao _abaSelecionada;
    private object _paginaAtual;

    public PrincipalViewModel()
    {
        var simulador = new SimuladorDemonstracao();

        Memoria = new MemoriaViewModel();
        Horizonte = new HorizonteViewModel(simulador);
        Comparador = new ComparadorViewModel(simulador);

        Calculadora = new CalculadoraViewModel(
            simulador,
            IrPara,
            (entrada, resultado) =>
            {
                Horizonte.Atualizar(entrada);
                Comparador.Atualizar(entrada);
                Memoria.Atualizar(resultado);
            });

        Abas = new[]
        {
            new ItemNavegacao(
                AbaNavegacao.Calculadora,
                "Calculadora",
                "Custo líquido do frete",
                Geometry.Parse("M4 4.5H20V19.5H4Z M4 8.5H20 M7.5 12H9 M11.5 12H13 M15.5 12H17 M7.5 15.5H9 M11.5 15.5H13 M15.5 15.5H17"),
                Principal: true),
            new ItemNavegacao(
                AbaNavegacao.Comparador,
                "Comparador",
                "Transportadoras lado a lado",
                Geometry.Parse("M4 20V12 M9.3 20V6 M14.6 20V10 M19.9 20V4 M3 21.5H21")),
            new ItemNavegacao(
                AbaNavegacao.Horizonte,
                "Horizonte",
                "2025 a 2033, ano a ano",
                Geometry.Parse("M3.5 18L8.5 11L13 14L20.5 5.5 M3 21.5H21")),
            new ItemNavegacao(
                AbaNavegacao.Memoria,
                "Memória",
                "Cálculo e resposta bruta",
                Geometry.Parse("M6 3.5H14L18.5 8V20.5H6Z M14 3.5V8H18.5 M9 12H15 M9 15.5H15")),
        };

        _abaSelecionada = Abas[0];
        _paginaAtual = Calculadora;
    }

    public IReadOnlyList<ItemNavegacao> Abas { get; }

    public CalculadoraViewModel Calculadora { get; }

    public ComparadorViewModel Comparador { get; }

    public HorizonteViewModel Horizonte { get; }

    public MemoriaViewModel Memoria { get; }

    public string Versao => "0.1.0 · prévia desktop";

    public string StatusDados => "Dados de demonstração";

    public string StatusDetalhe => "Sem conexão com os motores";

    public ItemNavegacao AbaSelecionada
    {
        get => _abaSelecionada;
        private set
        {
            if (!Definir(ref _abaSelecionada, value))
            {
                return;
            }

            PaginaAtual = value.Id switch
            {
                AbaNavegacao.Comparador => Comparador,
                AbaNavegacao.Horizonte => Horizonte,
                AbaNavegacao.Memoria => Memoria,
                _ => (object)Calculadora,
            };

            Notificar(nameof(AbaCalculadora), nameof(AbaComparador), nameof(AbaHorizonte), nameof(AbaMemoria));
        }
    }

    public object PaginaAtual
    {
        get => _paginaAtual;
        private set => Definir(ref _paginaAtual, value);
    }

    public bool AbaCalculadora
    {
        get => _abaSelecionada.Id == AbaNavegacao.Calculadora;
        set
        {
            if (value)
            {
                IrPara(AbaNavegacao.Calculadora);
            }
        }
    }

    public bool AbaComparador
    {
        get => _abaSelecionada.Id == AbaNavegacao.Comparador;
        set
        {
            if (value)
            {
                IrPara(AbaNavegacao.Comparador);
            }
        }
    }

    public bool AbaHorizonte
    {
        get => _abaSelecionada.Id == AbaNavegacao.Horizonte;
        set
        {
            if (value)
            {
                IrPara(AbaNavegacao.Horizonte);
            }
        }
    }

    public bool AbaMemoria
    {
        get => _abaSelecionada.Id == AbaNavegacao.Memoria;
        set
        {
            if (value)
            {
                IrPara(AbaNavegacao.Memoria);
            }
        }
    }

    public void IrPara(string id)
    {
        var aba = Abas.FirstOrDefault(a => a.Id == id);
        if (aba is not null)
        {
            AbaSelecionada = aba;
        }
    }
}
