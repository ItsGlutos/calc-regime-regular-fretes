namespace FreteLiquido.Core.Modelos;

/// <summary>Entrada da calculadora. Espelha o payload de <c>POST /api/simular</c>.</summary>
public sealed record EntradaSimulacao(
    decimal ValorFrete,
    string ModalidadeId,
    string TipoOperacao,
    string UfOrigem,
    string UfDestino,
    int Ano,
    string RegimePagadoraId = RegimePagadoraOpcao.NaoCumulativo)
{
    public bool EhB2C => TipoOperacao == TipoOperacaoOpcao.B2C;

    public ModalidadeOpcao Modalidade => Catalogo.Modalidade(ModalidadeId);

    public RegimePagadoraOpcao Pagadora => Catalogo.RegimeDaPagadora(RegimePagadoraId);

    public string Rota => $"{UfOrigem} → {UfDestino}";
}

/// <summary>Uma linha da memória de cálculo.</summary>
public sealed record LinhaMemoria(string Grupo, string Titulo, string Detalhe, string Valor, bool Destaque = false);

/// <summary>Aviso exibido junto do resultado.</summary>
public sealed record Aviso(string Titulo, string Texto, string Gravidade)
{
    public const string Informativo = "info";
    public const string Atencao = "atencao";
    public const string Critico = "critico";
}

/// <summary>Resultado de um ano da calculadora.</summary>
public sealed record ResultadoSimulacao(
    EntradaSimulacao Entrada,
    int Ano,
    decimal Carga,
    decimal PercentualCarga,
    decimal CreditoCbsIbs,
    decimal CreditoAntigos,
    decimal CreditoTotal,
    decimal PercentualCredito,
    decimal CustoLiquido,
    decimal PercentualCusto,
    decimal CustoBase,
    decimal VariacaoValor,
    decimal VariacaoPercentual,
    IReadOnlyList<LinhaMemoria> Memoria,
    IReadOnlyList<Aviso> Avisos,
    string Fonte,
    string JsonBruto)
{
    public bool CreditoBaixo => PercentualCredito < 4m;
}

/// <summary>Um ano da série antes/depois da reforma.</summary>
public sealed record AnoReforma(
    int Ano,
    string Fase,
    string Marco,
    decimal Carga,
    decimal PercentualCarga,
    decimal CbsIbs,
    decimal Cbs,
    decimal Ibs,
    decimal Antigos,
    decimal Credito,
    decimal PercentualCredito,
    decimal CustoLiquido,
    decimal VariacaoValor,
    decimal VariacaoPercentual,
    decimal BrutoComRepasse,
    decimal LiquidoComRepasse)
{
    public bool AntesDaReforma => Ano <= 2026;
}

/// <summary>Transportadora do comparador.</summary>
public sealed record TransportadoraAvaliada(
    string Nome,
    string Regime,
    string ModalidadeId,
    decimal Preco,
    decimal Credito,
    decimal PercentualCredito,
    decimal CustoTotal)
{
    public decimal DiferencaParaMelhor { get; init; }
    public bool MelhorCusto { get; init; }
}
