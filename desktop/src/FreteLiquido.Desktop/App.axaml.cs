using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using FreteLiquido.Desktop.ViewModels;
using FreteLiquido.Desktop.Views;

namespace FreteLiquido.Desktop;

public partial class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow
            {
                DataContext = new PrincipalViewModel(),
            };
        }

        base.OnFrameworkInitializationCompleted();
    }
}
