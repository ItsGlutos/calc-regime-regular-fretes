using System.Globalization;
using Avalonia;

namespace FreteLiquido.Desktop;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var cultura = CultureInfo.GetCultureInfo("pt-BR");
        CultureInfo.DefaultThreadCurrentCulture = cultura;
        CultureInfo.DefaultThreadCurrentUICulture = cultura;

        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    // Referenciado pelo previewer do Avalonia — não remover.
    public static AppBuilder BuildAvaloniaApp() =>
        AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();
}
