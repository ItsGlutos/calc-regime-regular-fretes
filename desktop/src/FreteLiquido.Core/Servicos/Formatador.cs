using System.Globalization;

namespace FreteLiquido.Core.Servicos;

/// <summary>Formatação pt-BR usada em toda a interface.</summary>
public static class Formatador
{
    public static CultureInfo Brasil { get; } = CultureInfo.GetCultureInfo("pt-BR");

    /// <summary>R$ 1.234,56</summary>
    public static string Moeda(decimal valor) => "R$ " + valor.ToString("N2", Brasil);

    /// <summary>R$ 1.234,56 — sem o prefixo, quando o layout já mostra "R$".</summary>
    public static string Numero(decimal valor) => valor.ToString("N2", Brasil);

    /// <summary>15,50%</summary>
    public static string Percentual(decimal valor, int casas = 2) =>
        valor.ToString("N" + casas.ToString(CultureInfo.InvariantCulture), Brasil) + "%";

    /// <summary>+0,90% / −12,84% / 0,00%</summary>
    public static string Variacao(decimal valor)
    {
        // Menos tipográfico (−), igual ao VariacaoMoeda: o hífen ASCII fica
        // fino demais ao lado dos números tabulares.
        var sinal = valor > 0 ? "+" : valor < 0 ? "−" : string.Empty;
        return sinal + Math.Abs(valor).ToString("N2", Brasil) + "%";
    }

    /// <summary>−R$ 107,50 / +R$ 7,50</summary>
    public static string VariacaoMoeda(decimal valor)
    {
        var sinal = valor > 0 ? "+" : valor < 0 ? "−" : string.Empty;
        return sinal + Moeda(Math.Abs(valor));
    }

    /// <summary>Aceita "1.000,00", "1000.00", "1000" e "R$ 1.000,00".</summary>
    public static bool TentarLerValor(string? texto, out decimal valor)
    {
        valor = 0m;
        if (string.IsNullOrWhiteSpace(texto))
        {
            return false;
        }

        var limpo = texto
            .Replace("R$", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("\u00A0", string.Empty, StringComparison.Ordinal)
            .Trim();

        if (limpo.Length == 0)
        {
            return false;
        }

        if (limpo.Contains(',', StringComparison.Ordinal))
        {
            limpo = limpo.Replace(".", string.Empty, StringComparison.Ordinal)
                         .Replace(',', '.');
        }

        return decimal.TryParse(
            limpo,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out valor) && valor >= 0m;
    }
}
