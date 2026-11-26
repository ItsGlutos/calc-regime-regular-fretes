using System.Text.Json;
using FreteLiquido.Core.Modelos;
using FreteLiquido.Core.Servicos;
using Xunit;

namespace FreteLiquido.Core.Testes;

/// <summary>
/// Trava os números documentados do Frete Líquido: R$ 1.000,00 de frete,
/// 16,25% de crédito em 2026 e 27,00% em 2033. Se a regra mudar, o teste cai
/// antes da interface mentir.
/// </summary>
public sealed class SimuladorTestes
{
    private readonly SimuladorDemonstracao _simulador = new();

    private static EntradaSimulacao Entrada(
        int ano,
        string modalidade = ModalidadeOpcao.RegimeRegular,
        decimal valor = 1000m,
        string tipo = TipoOperacaoOpcao.B2B,
        string pagadora = RegimePagadoraOpcao.NaoCumulativo) =>
        new(valor, modalidade, tipo, "SP", "RJ", ano, pagadora);

    [Theory]
    [InlineData(2025, 837.50, 16.25)]
    [InlineData(2026, 837.50, 16.25)]
    [InlineData(2027, 845.00, 15.50)]
    [InlineData(2029, 833.50, 16.65)]
    [InlineData(2033, 730.00, 27.00)]
    public void Regime_regular_segue_o_cronograma_documentado(int ano, double custo, double percentualCredito)
    {
        var resultado = _simulador.Simular(Entrada(ano));

        Assert.Equal((decimal)custo, resultado.CustoLiquido);
        Assert.Equal((decimal)percentualCredito, resultado.PercentualCredito);
        Assert.Equal(100m - (decimal)percentualCredito, resultado.PercentualCusto);
    }

    [Fact]
    public void Carga_destacada_soma_icms_pis_cofins_cbs_e_ibs()
    {
        var resultado = _simulador.Simular(Entrada(2026));

        Assert.Equal(17.25m, resultado.PercentualCarga);
        Assert.Equal(172.50m, resultado.Carga);
    }

    [Fact]
    public void Simples_por_dentro_credita_apenas_o_destaque_do_pgdas()
    {
        var resultado = _simulador.Simular(Entrada(2027, ModalidadeOpcao.SimplesDas));

        Assert.Equal(2.39m, resultado.PercentualCredito);
        Assert.Equal(23.85m, resultado.CreditoCbsIbs);
        Assert.Equal(0m, resultado.CreditoAntigos);
        Assert.Equal(976.15m, resultado.CustoLiquido);
        Assert.True(resultado.CreditoBaixo);
        Assert.Equal(0m, resultado.Carga); // o DAS não destaca tributo no CT-e
    }

    [Fact]
    public void Simples_hibrido_transfere_credito_integral_e_destaca_carga()
    {
        var resultado = _simulador.Simular(Entrada(2027, ModalidadeOpcao.SimplesHibrido));

        Assert.Equal(8.50m, resultado.PercentualCredito);
        Assert.Equal(85m, resultado.CreditoCbsIbs);
        Assert.Equal(915m, resultado.CustoLiquido);
        Assert.Equal(8.50m, resultado.PercentualCarga);
    }

    [Fact]
    public void Autonomo_mei_soma_a_faixa_estimada_ao_icms_do_destaque()
    {
        // Comportamento atual do motor de demonstração: o MEI está no regime
        // regular, então recebe o ICMS do CT-e (7,00% em 2027) e soma a faixa
        // setorial estimada de 1,80% para o CBS/IBS.
        var resultado = _simulador.Simular(Entrada(2027, ModalidadeOpcao.AutonomoMei));

        Assert.Equal(8.80m, resultado.PercentualCredito);
        Assert.Equal(88m, resultado.CreditoTotal);
        Assert.Equal(912m, resultado.CustoLiquido);
        Assert.Contains(resultado.Avisos, a => a.Titulo == "Crédito estimado");
    }

    [Fact]
    public void B2C_nao_aproveita_credito()
    {
        var resultado = _simulador.Simular(Entrada(2027, tipo: TipoOperacaoOpcao.B2C));

        Assert.Equal(0m, resultado.CreditoTotal);
        Assert.Equal(1000m, resultado.CustoLiquido);
        Assert.Contains(resultado.Avisos, a => a.Titulo == "Operação B2C");
    }

    [Fact]
    public void Lucro_presumido_nao_credita_pis_cofins()
    {
        var resultado = _simulador.Simular(Entrada(2026, pagadora: RegimePagadoraOpcao.Cumulativo));

        Assert.Equal(70m, resultado.CreditoAntigos);
        Assert.Equal(930m, resultado.CustoLiquido);
    }

    [Fact]
    public void Variacao_compara_com_2026_e_e_zero_no_ano_base()
    {
        var base2026 = _simulador.Simular(Entrada(2026));
        var ano2027 = _simulador.Simular(Entrada(2027));

        Assert.Equal(0m, base2026.VariacaoValor);
        Assert.Equal(0m, base2026.VariacaoPercentual);
        Assert.Equal(2026, SimuladorDemonstracao.AnoBase);
        Assert.Equal(837.50m, ano2027.CustoBase);
        Assert.Equal(7.50m, ano2027.VariacaoValor);
        Assert.Equal(0.90m, ano2027.VariacaoPercentual);
    }

    [Fact]
    public void Invariantes_do_resultado_se_mantem()
    {
        foreach (var modalidade in Catalogo.Modalidades)
        {
            foreach (var ano in Catalogo.SerieCompleta)
            {
                var resultado = _simulador.Simular(Entrada(ano, modalidade.Id));

                Assert.Equal(
                    resultado.Entrada.ValorFrete,
                    resultado.CreditoTotal + resultado.CustoLiquido);
                Assert.InRange(resultado.PercentualCredito, 0m, 100m);
            }
        }
    }

    [Fact]
    public void Serie_cobre_todo_o_horizonte_e_marca_o_antes_da_reforma()
    {
        var serie = _simulador.Serie(Entrada(2027));

        Assert.Equal(Catalogo.SerieCompleta.Count, serie.Count);
        Assert.Equal(Catalogo.SerieCompleta, serie.Select(a => a.Ano).ToArray());
        Assert.True(serie.Single(a => a.Ano == 2025).AntesDaReforma);
        Assert.True(serie.Single(a => a.Ano == 2026).AntesDaReforma);
        Assert.False(serie.Single(a => a.Ano == 2027).AntesDaReforma);
        Assert.Equal(0m, serie.Single(a => a.Ano == 2026).VariacaoValor);
        Assert.Equal(7.50m, serie.Single(a => a.Ano == 2027).VariacaoValor);
        Assert.Equal(27.00m, serie.Single(a => a.Ano == 2033).PercentualCredito);
    }

    [Fact]
    public void Comparador_ordena_pelo_custo_e_mede_a_diferenca()
    {
        var transportadoras = new[]
        {
            new TransportadoraEntrada("Alfa", ModalidadeOpcao.RegimeRegular, 1.00m),
            new TransportadoraEntrada("Beta", ModalidadeOpcao.SimplesDas, 1.02m),
            new TransportadoraEntrada("Gama", ModalidadeOpcao.RegimeRegular, 1.05m),
        };

        var avaliadas = _simulador.Comparar(Entrada(2027), transportadoras);

        Assert.Equal(3, avaliadas.Count);
        Assert.Equal("Alfa", avaliadas[0].Nome);
        Assert.True(avaliadas[0].MelhorCusto);
        Assert.Equal(0m, avaliadas[0].DiferencaParaMelhor);
        Assert.All(avaliadas.Skip(1), t => Assert.True(t.DiferencaParaMelhor > 0m));
        Assert.Equal(
            avaliadas.Select(t => t.CustoTotal).OrderBy(c => c),
            avaliadas.Select(t => t.CustoTotal));
    }

    [Fact]
    public void Comparador_credita_o_mesmo_valor_da_calculadora()
    {
        // Regressão: o comparador reescalava o percentual já arredondado (2,39%),
        // mostrando R$ 23,90 de crédito e R$ 976,10 de custo para o mesmo frete
        // que a calculadora resolve com R$ 23,85 e R$ 976,15.
        var avaliada = _simulador.Comparar(
            Entrada(2027),
            new[] { new TransportadoraEntrada("Simples", ModalidadeOpcao.SimplesDas, 1.00m) })[0];
        var calculo = _simulador.Simular(Entrada(2027, ModalidadeOpcao.SimplesDas));

        Assert.Equal(23.85m, avaliada.Credito);
        Assert.Equal(976.15m, avaliada.CustoTotal);
        Assert.Equal(calculo.CustoLiquido, avaliada.CustoTotal);
        Assert.Equal(calculo.PercentualCredito, avaliada.PercentualCredito);
    }

    [Fact]
    public void Json_bruto_e_serializavel_e_identifica_a_fonte()
    {
        var resultado = _simulador.Simular(Entrada(2027));

        using var documento = JsonDocument.Parse(resultado.JsonBruto);
        var raiz = documento.RootElement;

        Assert.Equal("demonstracao", raiz.GetProperty("fonte").GetString());
        Assert.Equal(1000m, raiz.GetProperty("itens")[0].GetProperty("vItem").GetDecimal());
        Assert.Equal(845m, raiz.GetProperty("resultado").GetProperty("vCusto").GetDecimal());
        Assert.Contains("demonstração", resultado.Fonte);
    }

    [Fact]
    public void Memoria_fecha_a_conta_em_linhas_destacadas()
    {
        var resultado = _simulador.Simular(Entrada(2026));

        Assert.Contains(resultado.Memoria, l => l.Grupo == "Entrada");
        Assert.Contains(resultado.Memoria, l => l.Grupo == "Documento");
        Assert.Contains(resultado.Memoria, l => l.Titulo == "Crédito total do pagador" && l.Destaque);
        Assert.Contains(resultado.Memoria, l => l.Titulo == "Custo líquido total" && l.Destaque);
        Assert.All(resultado.Memoria, l => Assert.False(string.IsNullOrWhiteSpace(l.Valor)));
    }
}
