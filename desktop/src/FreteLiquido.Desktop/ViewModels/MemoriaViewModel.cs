using System.Collections.ObjectModel;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using FreteLiquido.Desktop.Infrastructure;

namespace FreteLiquido.Desktop.ViewModels;

/// <summary>
/// Aba secundária: a memória de cálculo linha a linha, a resposta bruta que o
/// motor devolveria e as premissas assumidas na simulação.
/// </summary>
public sealed class MemoriaViewModel : ObservableObject
{
    private string _json = string.Empty;
    private string _fonte = string.Empty;
    private string _resumo = string.Empty;
    private string _ano = "2027";

    public ObservableCollection<GrupoMemoria> Grupos { get; } = new();

    public ObservableCollection<AvisoTela> Avisos { get; } = new();

    public IReadOnlyList<Premissa> Premissas { get; } = new[]
    {
        new Premissa("Cronograma da LC 214/2025: CBS 8,50% e IBS 18,50% no regime pleno de 2033."),
        new Premissa("ICMS interestadual de 7,00% na rota até 2028, com redução de 1/9 ao ano a partir de 2029."),
        new Premissa("PIS/COFINS de 9,25% apenas até 2026 e somente para a pagadora não cumulativa."),
        new Premissa("Simples/DAS: alíquotas efetivas do PGDAS (CBS 2,3591% + IBS 0,0260%) a partir de 2027."),
        new Premissa("Nenhuma alíquota é apurada pelos motores oficiais nesta build de demonstração."),
    };

    public string Json
    {
        get => _json;
        private set => Definir(ref _json, value);
    }

    public string Fonte
    {
        get => _fonte;
        private set => Definir(ref _fonte, value);
    }

    public string Resumo
    {
        get => _resumo;
        private set => Definir(ref _resumo, value);
    }

    public string Ano
    {
        get => _ano;
        private set => Definir(ref _ano, value);
    }

    public void Atualizar(ResultadoSimulacao resultado)
    {
        Grupos.Clear();
        foreach (var grupo in resultado.Memoria.GroupBy(m => m.Grupo))
        {
            Grupos.Add(new GrupoMemoria(grupo.Key, grupo.ToArray()));
        }

        Avisos.Clear();
        foreach (var aviso in resultado.Avisos)
        {
            Avisos.Add(ResultadoTela.ParaTela(aviso));
        }

        Json = resultado.JsonBruto;
        Fonte = resultado.Fonte;
        Ano = resultado.Ano.ToString(Formatador.Brasil);
        Resumo =
            $"Frete de {Formatador.Moeda(resultado.Entrada.ValorFrete)} · " +
            $"{resultado.Entrada.Modalidade.Curto} · {resultado.Entrada.Rota} · " +
            $"{resultado.Entrada.TipoOperacao}";
    }
}
