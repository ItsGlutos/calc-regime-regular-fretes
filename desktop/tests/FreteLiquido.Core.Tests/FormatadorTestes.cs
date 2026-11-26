using FreteLiquido.Core.Servicos;
using Xunit;

namespace FreteLiquido.Core.Testes;

public sealed class FormatadorTestes
{
    [Theory]
    [InlineData("1000", 1000)]
    [InlineData("1.000,00", 1000)]
    [InlineData("1.234,56", 1234.56)]
    [InlineData("1000.00", 1000)]
    [InlineData("R$ 1.000,00", 1000)]
    [InlineData(" 250,5 ", 250.5)]
    public void TentarLerValor_aceita_os_formatos_do_campo(string texto, double esperado)
    {
        Assert.True(Formatador.TentarLerValor(texto, out var valor));
        Assert.Equal((decimal)esperado, valor);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("abc")]
    [InlineData("-10")]
    public void TentarLerValor_recusa_entrada_invalida(string? texto)
    {
        Assert.False(Formatador.TentarLerValor(texto, out _));
    }

    [Fact]
    public void Moeda_usa_o_padrao_brasileiro()
    {
        Assert.Equal("R$ 1.234,56", Formatador.Moeda(1234.56m));
        Assert.Equal("R$ 0,00", Formatador.Moeda(0m));
    }

    [Fact]
    public void Percentual_e_variacao_tem_sinal_e_casas_fixas()
    {
        Assert.Equal("16,25%", Formatador.Percentual(16.25m));
        Assert.Equal("27,00%", Formatador.Percentual(27m));
        Assert.Equal("+0,90%", Formatador.Variacao(0.90m));
        Assert.Equal("−12,84%", Formatador.Variacao(-12.84m));
        Assert.Equal("0,00%", Formatador.Variacao(0m));
    }

    [Fact]
    public void VariacaoMoeda_usa_menos_tipografico()
    {
        Assert.Equal("−R$ 107,50", Formatador.VariacaoMoeda(-107.50m));
        Assert.Equal("+R$ 7,50", Formatador.VariacaoMoeda(7.50m));
        Assert.Equal("R$ 0,00", Formatador.VariacaoMoeda(0m));
    }
}
