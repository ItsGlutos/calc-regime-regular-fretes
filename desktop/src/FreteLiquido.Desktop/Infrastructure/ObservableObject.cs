using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;

namespace FreteLiquido.Desktop.Infrastructure;

/// <summary>Base mínima de MVVM, sem dependência de framework externo.</summary>
public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool Definir<T>(ref T campo, T valor, [CallerMemberName] string? propriedade = null)
    {
        if (EqualityComparer<T>.Default.Equals(campo, valor))
        {
            return false;
        }

        campo = valor;
        Notificar(propriedade);
        return true;
    }

    protected void Notificar([CallerMemberName] string? propriedade = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propriedade));

    protected void Notificar(params string[] propriedades)
    {
        foreach (var propriedade in propriedades)
        {
            Notificar(propriedade);
        }
    }
}

/// <summary>Comando síncrono sem parâmetro.</summary>
public sealed class RelayCommand : ICommand
{
    private readonly Action _executar;
    private readonly Func<bool>? _podeExecutar;

    public RelayCommand(Action executar, Func<bool>? podeExecutar = null)
    {
        _executar = executar ?? throw new ArgumentNullException(nameof(executar));
        _podeExecutar = podeExecutar;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => _podeExecutar?.Invoke() ?? true;

    public void Execute(object? parameter) => _executar();

    public void Revalidar() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
