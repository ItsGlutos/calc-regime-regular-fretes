using System.Collections.ObjectModel;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>
/// A calculadora é a tela principal: o formulário e o custo líquido vivem aqui,
/// e cada alteração recalcula na hora (o botão continua existindo como ação
/// explícita de recálculo).
/// </summary>
public sealed class CalculadoraViewModel : ObservableObject
{
    private readonly ISimuladorFrete _simulador;
    private readonly Action<string> _navegar;
    private readonly Action<EntradaSimulacao, ResultadoSimulacao>? _aoCalcular;

    private string _valorFreteTexto = "1.000,00";
    private string? _erroValor;
    private bool _ehSimples;
    private ModalidadeOpcao? _modalidadeSelecionada;
    private bool _ehB2B = true;
    private UfOpcao? _ufOrigem;
    private UfOpcao? _ufDestino;
    private AnoOpcao? _anoSelecionado;
    private RegimePagadoraOpcao? _pagadora;
    private ResultadoTela _resultado = null!;

    public CalculadoraViewModel(
        ISimuladorFrete simulador,
        Action<string> navegar,
        Action<EntradaSimulacao, ResultadoSimulacao>? aoCalcular = null)
    {
        _simulador = simulador;
        _navegar = navegar;
        _aoCalcular = aoCalcular;

        Regimes = Catalogo.Regimes;
        Ufs = Catalogo.Ufs;
        Anos = Catalogo.Anos;
        RegimesPagadora = Catalogo.RegimesPagadora;

        _ufOrigem = Ufs.First(u => u.Sigla == "SP");
        _ufDestino = Ufs.First(u => u.Sigla == "BA");
        _anoSelecionado = Anos.First(a => a.Ano == 2027);
        _pagadora = RegimesPagadora[0];

        AtualizarModalidades(inicial: true);

        CalcularCommand = new RelayCommand(Recalcular);
        RestaurarCommand = new RelayCommand(Restaurar);
        IrParaMemoriaCommand = new RelayCommand(() => _navegar(AbaNavegacao.Memoria));
        IrParaHorizonteCommand = new RelayCommand(() => _navegar(AbaNavegacao.Horizonte));

        Recalcular();
    }

    public IReadOnlyList<RegimeOpcao> Regimes { get; }

    public IReadOnlyList<UfOpcao> Ufs { get; }

    public IReadOnlyList<AnoOpcao> Anos { get; }

    public IReadOnlyList<RegimePagadoraOpcao> RegimesPagadora { get; }

    public ObservableCollection<ModalidadeOpcao> Modalidades { get; } = new();

    public RelayCommand CalcularCommand { get; }

    public RelayCommand RestaurarCommand { get; }

    public RelayCommand IrParaMemoriaCommand { get; }

    public RelayCommand IrParaHorizonteCommand { get; }

    public ResultadoTela Resultado
    {
        get => _resultado;
        private set => Definir(ref _resultado, value);
    }

    public string ValorFreteTexto
    {
        get => _valorFreteTexto;
        set
        {
            if (Definir(ref _valorFreteTexto, value))
            {
                Recalcular();
            }
        }
    }

    public string? ErroValor
    {
        get => _erroValor;
        private set
        {
            if (Definir(ref _erroValor, value))
            {
                Notificar(nameof(TemErroValor));
            }
        }
    }

    public bool TemErroValor => !string.IsNullOrEmpty(ErroValor);

    public bool EhSimples
    {
        get => _ehSimples;
        set
        {
            if (value)
            {
                DefinirRegime(simples: true);
            }
        }
    }

    public bool EhRegular
    {
        get => !_ehSimples;
        set
        {
            if (value)
            {
                DefinirRegime(simples: false);
            }
        }
    }

    public string RegimeDescricao => _ehSimples ? Regimes[0].Descricao : Regimes[1].Descricao;

    public ModalidadeOpcao? ModalidadeSelecionada
    {
        get => _modalidadeSelecionada;
        set
        {
            if (value is not null && Definir(ref _modalidadeSelecionada, value))
            {
                Notificar(nameof(ModalidadeDescricao), nameof(ModalidadeFonte));
                Recalcular();
            }
        }
    }

    public string ModalidadeDescricao => _modalidadeSelecionada?.Descricao ?? string.Empty;

    public string ModalidadeFonte => _modalidadeSelecionada?.Fonte ?? string.Empty;

    public bool EhB2B
    {
        get => _ehB2B;
        set
        {
            if (value)
            {
                DefinirOperacao(b2b: true);
            }
        }
    }

    public bool EhB2C
    {
        get => !_ehB2B;
        set
        {
            if (value)
            {
                DefinirOperacao(b2b: false);
            }
        }
    }

    public string OperacaoDescricao => _ehB2B
        ? Catalogo.TiposOperacao[0].Descricao
        : Catalogo.TiposOperacao[1].Descricao;

    public UfOpcao? UfOrigem
    {
        get => _ufOrigem;
        set
        {
            if (value is not null && Definir(ref _ufOrigem, value))
            {
                Recalcular();
            }
        }
    }

    public UfOpcao? UfDestino
    {
        get => _ufDestino;
        set
        {
            if (value is not null && Definir(ref _ufDestino, value))
            {
                Recalcular();
            }
        }
    }

    public AnoOpcao? AnoSelecionado
    {
        get => _anoSelecionado;
        set
        {
            if (value is not null && Definir(ref _anoSelecionado, value))
            {
                Notificar(nameof(AnoFase));
                Recalcular();
            }
        }
    }

    public string AnoFase => _anoSelecionado?.Fase ?? string.Empty;

    public RegimePagadoraOpcao? PagadoraSelecionada
    {
        get => _pagadora;
        set
        {
            if (value is not null && Definir(ref _pagadora, value))
            {
                Notificar(nameof(PagadoraDescricao));
                Recalcular();
            }
        }
    }

    public string PagadoraDescricao => _pagadora?.Descricao ?? string.Empty;

    private void DefinirRegime(bool simples)
    {
        if (_ehSimples == simples)
        {
            return;
        }

        _ehSimples = simples;
        Notificar(nameof(EhSimples), nameof(EhRegular), nameof(RegimeDescricao));
        AtualizarModalidades(inicial: false);
        Recalcular();
    }

    private void DefinirOperacao(bool b2b)
    {
        if (_ehB2B == b2b)
        {
            return;
        }

        _ehB2B = b2b;
        Notificar(nameof(EhB2B), nameof(EhB2C), nameof(OperacaoDescricao));
        Recalcular();
    }

    private void AtualizarModalidades(bool inicial)
    {
        var regimeId = _ehSimples ? RegimeOpcao.Simples : RegimeOpcao.Regular;
        var filtradas = Catalogo.ModalidadesDoRegime(regimeId);

        Modalidades.Clear();
        foreach (var modalidade in filtradas)
        {
            Modalidades.Add(modalidade);
        }

        if (inicial || _modalidadeSelecionada is null || filtradas.All(m => m.Id != _modalidadeSelecionada.Id))
        {
            _modalidadeSelecionada = filtradas[0];
        }

        Notificar(nameof(ModalidadeSelecionada), nameof(ModalidadeDescricao), nameof(ModalidadeFonte));
    }

    private EntradaSimulacao MontarEntrada(decimal valor)
    {
        var modalidade = _modalidadeSelecionada ?? Catalogo.Modalidades[2];
        var ufOrigem = _ufOrigem ?? Ufs.First(u => u.Sigla == "SP");
        var ufDestino = _ufDestino ?? Ufs.First(u => u.Sigla == "BA");
        var ano = _anoSelecionado?.Ano ?? 2027;
        var pagadora = _pagadora ?? RegimesPagadora[0];

        return new EntradaSimulacao(
            valor,
            modalidade.Id,
            _ehB2B ? TipoOperacaoOpcao.B2B : TipoOperacaoOpcao.B2C,
            ufOrigem.Sigla,
            ufDestino.Sigla,
            ano,
            pagadora.Id);
    }

    private void Recalcular()
    {
        if (!Formatador.TentarLerValor(_valorFreteTexto, out var valor) || valor <= 0m)
        {
            ErroValor = "Informe um valor de frete maior que zero.";
            return;
        }

        ErroValor = null;
        var entrada = MontarEntrada(valor);

        try
        {
            var resultado = _simulador.Simular(entrada);
            var serie = _simulador.Serie(entrada);
            Resultado = ResultadoTela.Criar(resultado, serie);
            _aoCalcular?.Invoke(entrada, resultado);
        }
        catch (Exception)
        {
            ErroValor = "Não foi possível calcular com esses dados.";
        }
    }

    private void Restaurar()
    {
        _valorFreteTexto = "1.000,00";
        _ehSimples = false;
        _ehB2B = true;
        _ufOrigem = Ufs.First(u => u.Sigla == "SP");
        _ufDestino = Ufs.First(u => u.Sigla == "BA");
        _anoSelecionado = Anos.First(a => a.Ano == 2027);
        _pagadora = RegimesPagadora[0];

        Notificar(
            nameof(ValorFreteTexto),
            nameof(EhSimples),
            nameof(EhRegular),
            nameof(RegimeDescricao),
            nameof(EhB2B),
            nameof(EhB2C),
            nameof(OperacaoDescricao),
            nameof(UfOrigem),
            nameof(UfDestino),
            nameof(AnoSelecionado),
            nameof(AnoFase),
            nameof(PagadoraSelecionada),
            nameof(PagadoraDescricao));

        AtualizarModalidades(inicial: true);
        Recalcular();
    }
}
