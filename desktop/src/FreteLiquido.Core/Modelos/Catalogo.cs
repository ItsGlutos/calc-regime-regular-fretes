namespace FreteLiquido.Core.Modelos;

/// <summary>
/// Agrupamento visual do transportador: Simples Nacional ou regime regular.
/// O regime é uma modalidade, não um detalhe do perfil.
/// </summary>
public sealed record RegimeOpcao(string Id, string Rotulo, string Sub, string Descricao)
{
    public const string Simples = "SIMPLES";
    public const string Regular = "REGULAR";
}

/// <summary>Modalidade do transportador (o perfil que o motor oficial entende).</summary>
public sealed record ModalidadeOpcao(
    string Id,
    string Rotulo,
    string Curto,
    string RegimeId,
    string Descricao,
    string Fonte,
    bool Estimativa)
{
    public const string SimplesDas = "SIMPLES_DAS";
    public const string SimplesHibrido = "SIMPLES_HIBRIDO";
    public const string RegimeRegular = "REGIME_REGULAR";
    public const string AutonomoMei = "AUTONOMO_MEI";
}

/// <summary>Venda a contribuinte (B2B) ou ao consumidor final (B2C).</summary>
public sealed record TipoOperacaoOpcao(string Id, string Rotulo, string Descricao)
{
    public const string B2B = "B2B";
    public const string B2C = "B2C";
}

/// <summary>Regime de crédito da empresa que paga o frete.</summary>
public sealed record RegimePagadoraOpcao(string Id, string Rotulo, string Curto, string Descricao, bool CreditaPisCofins)
{
    public const string NaoCumulativo = "NAO_CUMULATIVO";
    public const string Cumulativo = "CUMULATIVO";
}

/// <summary>Unidade federativa da rota.</summary>
public sealed record UfOpcao(string Sigla, string Nome, string Regiao)
{
    public string Rotulo => $"{Sigla} — {Nome}";
}

/// <summary>Ano de referência oferecido na calculadora.</summary>
public sealed record AnoOpcao(int Ano, string Rotulo, string Fase);

/// <summary>Item de navegação entre a calculadora e as abas secundárias.</summary>
public sealed record AbaNavegacao(string Id, string Rotulo, string Descricao, string Icone)
{
    public const string Calculadora = "calculadora";
    public const string Comparador = "comparador";
    public const string Horizonte = "horizonte";
    public const string Memoria = "memoria";
}

/// <summary>
/// Catálogo fixo desta prévia. Quando o app passar a falar com os motores
/// oficiais, este catálogo vira a resposta de <c>GET /api/opcoes</c>.
/// </summary>
public static class Catalogo
{
    public static IReadOnlyList<RegimeOpcao> Regimes { get; } = new[]
    {
        new RegimeOpcao(
            RegimeOpcao.Simples,
            "Simples Nacional",
            "DAS com PGDAS ou híbrido",
            "Optante do Simples: o CBS/IBS pode ser recolhido dentro do DAS (alíquotas efetivas do PGDAS) ou no regime regular, na opção híbrida."),
        new RegimeOpcao(
            RegimeOpcao.Regular,
            "Regime regular",
            "Lucro Real/Presumido ou MEI",
            "Não optante do Simples: o CT-e destaca CBS/IBS no regime regular e o crédito é integral. Autônomo e MEI usam a faixa setorial estimada."),
    };

    public static IReadOnlyList<ModalidadeOpcao> Modalidades { get; } = new[]
    {
        new ModalidadeOpcao(
            ModalidadeOpcao.SimplesDas,
            "Simples Nacional — CBS/IBS dentro do DAS",
            "Simples/DAS",
            RegimeOpcao.Simples,
            "Recolhe CBS/IBS dentro do DAS. O crédito é o destaque apurado com as alíquotas efetivas do PGDAS (atividade 05, Anexo III).",
            "Destaque do Simples · 2,39% no exemplo",
            true),
        new ModalidadeOpcao(
            ModalidadeOpcao.SimplesHibrido,
            "Simples Nacional — híbrido (CBS/IBS no regime regular)",
            "Simples híbrido",
            RegimeOpcao.Simples,
            "Opta por recolher CBS/IBS no regime regular, fora do DAS. O CT-e destaca o tributo cheio e o crédito é integral.",
            "Crédito integral do destaque",
            false),
        new ModalidadeOpcao(
            ModalidadeOpcao.RegimeRegular,
            "Regime regular (Lucro Real/Presumido)",
            "Regime regular",
            RegimeOpcao.Regular,
            "Destaca CBS/IBS no CT-e e transfere o crédito integral ao tomador, somado ao ICMS enquanto ele existir.",
            "Crédito integral apurado no destaque",
            false),
        new ModalidadeOpcao(
            ModalidadeOpcao.AutonomoMei,
            "Autônomo / MEI",
            "Autônomo/MEI",
            RegimeOpcao.Regular,
            "Crédito residual, próximo do que o DAS embute no preço.",
            "Faixa setorial estimada de 1,8%",
            true),
    };

    public static IReadOnlyList<TipoOperacaoOpcao> TiposOperacao { get; } = new[]
    {
        new TipoOperacaoOpcao(TipoOperacaoOpcao.B2B, "B2B", "Venda a contribuinte: o crédito do frete entra na apuração."),
        new TipoOperacaoOpcao(TipoOperacaoOpcao.B2C, "B2C", "Venda ao consumidor final: o crédito não é aproveitável pelo pagador."),
    };

    public static IReadOnlyList<RegimePagadoraOpcao> RegimesPagadora { get; } = new[]
    {
        new RegimePagadoraOpcao(
            RegimePagadoraOpcao.NaoCumulativo,
            "Lucro Real — não cumulativo",
            "Lucro Real",
            "Credita ICMS, PIS/COFINS (enquanto existirem) e CBS/IBS destacados no CT-e.",
            true),
        new RegimePagadoraOpcao(
            RegimePagadoraOpcao.Cumulativo,
            "Lucro Presumido — cumulativo",
            "Lucro Presumido",
            "Credita ICMS e CBS/IBS; o PIS/COFINS cumulativo não gera crédito sobre o frete.",
            false),
    };

    public static IReadOnlyList<AnoOpcao> Anos { get; } = new[]
    {
        new AnoOpcao(2026, "2026 — ano de teste", "Fase de teste: CBS/IBS de 1,00% sem crédito ao adquirente"),
        new AnoOpcao(2027, "2027 — CBS cheia", "CBS cheia e IBS em teste: primeiro ano com custo acima de hoje"),
        new AnoOpcao(2029, "2029 — transição do IBS", "ICMS caindo 1/9 ao ano e IBS subindo"),
        new AnoOpcao(2033, "2033 — regime pleno", "CBS 8,50% + IBS 18,50%: ICMS e PIS/COFINS extintos"),
    };

    /// <summary>Horizonte completo do comparativo antes/depois (LC 214/2025).</summary>
    public static IReadOnlyList<int> SerieCompleta { get; } = new[] { 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033 };

    public static IReadOnlyList<UfOpcao> Ufs { get; } = new[]
    {
        new UfOpcao("AC", "Acre", "Norte"),
        new UfOpcao("AL", "Alagoas", "Nordeste"),
        new UfOpcao("AP", "Amapá", "Norte"),
        new UfOpcao("AM", "Amazonas", "Norte"),
        new UfOpcao("BA", "Bahia", "Nordeste"),
        new UfOpcao("CE", "Ceará", "Nordeste"),
        new UfOpcao("DF", "Distrito Federal", "Centro-Oeste"),
        new UfOpcao("ES", "Espírito Santo", "Sudeste"),
        new UfOpcao("GO", "Goiás", "Centro-Oeste"),
        new UfOpcao("MA", "Maranhão", "Nordeste"),
        new UfOpcao("MT", "Mato Grosso", "Centro-Oeste"),
        new UfOpcao("MS", "Mato Grosso do Sul", "Centro-Oeste"),
        new UfOpcao("MG", "Minas Gerais", "Sudeste"),
        new UfOpcao("PA", "Pará", "Norte"),
        new UfOpcao("PB", "Paraíba", "Nordeste"),
        new UfOpcao("PR", "Paraná", "Sul"),
        new UfOpcao("PE", "Pernambuco", "Nordeste"),
        new UfOpcao("PI", "Piauí", "Nordeste"),
        new UfOpcao("RJ", "Rio de Janeiro", "Sudeste"),
        new UfOpcao("RN", "Rio Grande do Norte", "Nordeste"),
        new UfOpcao("RS", "Rio Grande do Sul", "Sul"),
        new UfOpcao("RO", "Rondônia", "Norte"),
        new UfOpcao("RR", "Roraima", "Norte"),
        new UfOpcao("SC", "Santa Catarina", "Sul"),
        new UfOpcao("SP", "São Paulo", "Sudeste"),
        new UfOpcao("SE", "Sergipe", "Nordeste"),
        new UfOpcao("TO", "Tocantins", "Norte"),
    };

    public static ModalidadeOpcao Modalidade(string id) =>
        Modalidades.FirstOrDefault(m => m.Id == id) ?? Modalidades[2];

    public static RegimePagadoraOpcao RegimeDaPagadora(string id) =>
        RegimesPagadora.FirstOrDefault(r => r.Id == id) ?? RegimesPagadora[0];

    public static IReadOnlyList<ModalidadeOpcao> ModalidadesDoRegime(string regimeId) =>
        Modalidades.Where(m => m.RegimeId == regimeId).ToArray();
}
