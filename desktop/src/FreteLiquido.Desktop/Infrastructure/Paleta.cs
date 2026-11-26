using Avalonia.Media;

namespace FreteLiquido.Desktop.Infrastructure;

/// <summary>
/// Espelho em código dos tokens de <c>Temas/Cores.axaml</c>, para os itens de
/// lista que carregam a própria cor (barras do gráfico, deltas e avisos).
/// </summary>
public static class Paleta
{
    public static readonly IBrush Tinta = new SolidColorBrush(Color.Parse("#0B1220"));
    public static readonly IBrush TintaSuave = new SolidColorBrush(Color.Parse("#33405A"));
    public static readonly IBrush Texto = new SolidColorBrush(Color.Parse("#556274"));
    public static readonly IBrush TextoFraco = new SolidColorBrush(Color.Parse("#7E8A9C"));
    public static readonly IBrush Superficie = new SolidColorBrush(Color.Parse("#FFFFFF"));
    public static readonly IBrush SuperficieSuave = new SolidColorBrush(Color.Parse("#F7F9FC"));
    public static readonly IBrush Linha = new SolidColorBrush(Color.Parse("#E4E9F0"));
    public static readonly IBrush Oliva = new SolidColorBrush(Color.Parse("#4D5C36"));
    public static readonly IBrush Oliva050 = new SolidColorBrush(Color.Parse("#F3F5EA"));
    public static readonly IBrush Oliva200 = new SolidColorBrush(Color.Parse("#CDD7AE"));
    public static readonly IBrush Verde = new SolidColorBrush(Color.Parse("#0F7A55"));
    public static readonly IBrush Verde050 = new SolidColorBrush(Color.Parse("#EDF9F3"));
    public static readonly IBrush VerdeLinha = new SolidColorBrush(Color.Parse("#C9EADB"));
    public static readonly IBrush Ambar = new SolidColorBrush(Color.Parse("#9A5B06"));
    public static readonly IBrush Ambar050 = new SolidColorBrush(Color.Parse("#FFF8EA"));
    public static readonly IBrush AmbarLinha = new SolidColorBrush(Color.Parse("#F0D6A4"));
    public static readonly IBrush Vermelho = new SolidColorBrush(Color.Parse("#B42318"));
    public static readonly IBrush Vermelho050 = new SolidColorBrush(Color.Parse("#FDECEA"));
    public static readonly IBrush CinzaBarra = new SolidColorBrush(Color.Parse("#AFBED2"));

    public static readonly IBrush GradienteBarra = CriarGradiente("#5E7240", "#45542F");
    public static readonly IBrush GradienteBarraAntes = CriarGradiente("#C9D5E4", "#A9B9CE");
    public static readonly IBrush GradienteBarraDestaque = CriarGradiente("#6E8247", "#3D4A29");

    private static IBrush CriarGradiente(string inicio, string fim) =>
        new LinearGradientBrush
        {
            StartPoint = new Avalonia.RelativePoint(0, 1, Avalonia.RelativeUnit.Relative),
            EndPoint = new Avalonia.RelativePoint(0, 0, Avalonia.RelativeUnit.Relative),
            GradientStops =
            {
                new GradientStop(Color.Parse(inicio), 0),
                new GradientStop(Color.Parse(fim), 1),
            },
        };
}
