using Avalonia.Media;
using FreteLiquido.Core.Modelos;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>Item do menu principal (calculadora + abas secundárias).</summary>
public sealed record ItemNavegacao(string Id, string Rotulo, string Descricao, Geometry Icone, bool Principal = false);

/// <summary>Linha de detalhe do resultado (rótulo, valor e nota).</summary>
public sealed record DetalheLinha(string Rotulo, string Valor, string? Nota = null, bool Forte = false)
{
    public bool TemNota => !string.IsNullOrWhiteSpace(Nota);
}

/// <summary>Aviso já traduzido para a interface.</summary>
public sealed record AvisoTela(string Simbolo, string Titulo, string Texto, IBrush Fundo, IBrush Borda, IBrush Cor);

/// <summary>Coluna da mini-série "antes e depois" da calculadora.</summary>
public sealed record ItemSerie(
    string Ano,
    string Marco,
    string Valor,
    string Delta,
    IBrush CorDelta,
    double Altura,
    IBrush Fundo,
    bool Destaque);

/// <summary>Cartão de KPI do horizonte.</summary>
public sealed record ItemKpi(string Rotulo, string Valor, string Detalhe, IBrush Cor);

/// <summary>Coluna do gráfico de barras do horizonte.</summary>
public sealed record BarraAno(
    string Ano,
    string Fase,
    string Valor,
    string Percentual,
    double Altura,
    IBrush Fundo,
    bool Destaque,
    bool AntesDaReforma);

/// <summary>Linha da tabela ano a ano.</summary>
public sealed record LinhaAno(
    string Ano,
    string Fase,
    string Bruto,
    string Credito,
    string Liquido,
    string Variacao,
    IBrush CorVariacao,
    bool Antes);

/// <summary>Cartão de transportadora no comparador.</summary>
public sealed record CartaoTransportadora(
    string Posicao,
    string Nome,
    string Regime,
    string Preco,
    string Credito,
    string Percentual,
    string Custo,
    string Diferenca,
    bool Melhor,
    double Barra,
    IBrush Fundo,
    IBrush Borda,
    IBrush CorDestino);

/// <summary>Grupo da memória de cálculo.</summary>
public sealed record GrupoMemoria(string Titulo, IReadOnlyList<LinhaMemoria> Itens);

/// <summary>Premissa assumida na simulação.</summary>
public sealed record Premissa(string Texto);
