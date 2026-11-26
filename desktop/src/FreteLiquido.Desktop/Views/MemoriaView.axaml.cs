using Avalonia.Controls;
using Avalonia.Interactivity;
using FreteLiquido.Desktop.ViewModels;

namespace FreteLiquido.Desktop.Views;

public partial class MemoriaView : UserControl
{
    public MemoriaView()
    {
        InitializeComponent();
    }

    private async void CopiarJson(object? sender, RoutedEventArgs e)
    {
        if (DataContext is not MemoriaViewModel viewModel)
        {
            return;
        }

        var topo = TopLevel.GetTopLevel(this);
        if (topo?.Clipboard is { } clipboard)
        {
            await clipboard.SetTextAsync(viewModel.Json);
        }
    }
}
