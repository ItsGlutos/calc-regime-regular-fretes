/**
 * Regras de negócio do simulador do pagador de frete.
 *
 * O CBS/IBS NUNCA é calculado aqui: o destaque vem do motor oficial da Receita
 * (calculadora-rtc-regime-regular). Este módulo só decide quanto do destaque o
 * pagador consegue virar crédito, conforme o regime do transportador.
 */

/** NBS do transporte rodoviário de carga unitizada (item de CT-e). */
export const NBS_FRETE = '105011220'

/** Primeiro ano com tabelas do Simples Nacional no motor (NT 2026.005). */
export const ANO_INICIO_SIMPLES = 2027

/** Atividades do Simples Nacional aceitas para o CT-e de transporte. */
export const ATIVIDADES_SIMPLES = [
  {
    id: '05',
    rotulo: '05 — Transporte de carga intermunicipal/interestadual (Anexo III)',
    anexo: 'III',
  },
]

/**
 * Modalidades de regime mostradas na interface.
 *
 * O perfil do transportador continua sendo a unidade que o motor entende; o
 * regime é só o agrupamento visual que deixa explícito que o Simples Nacional
 * é uma modalidade própria, e não um detalhe do regime regular.
 */
export const REGIMES = [
  {
    id: 'SIMPLES',
    rotulo: 'Simples Nacional',
    sub: 'DAS com PGDAS ou híbrido',
    descricao:
      'Optante do Simples: o CBS/IBS pode ser recolhido dentro do DAS (com as alíquotas efetivas do PGDAS) ou no regime regular, na opção híbrida.',
  },
  {
    id: 'REGULAR',
    rotulo: 'Regime regular',
    sub: 'Lucro Real/Presumido ou MEI',
    descricao:
      'Não optante do Simples: o CT-e destaca CBS/IBS no regime regular e o crédito é integral. Autônomo e MEI usam a faixa setorial estimada.',
  },
]

/** Primeiro ano da série histórica: 2025 é o regime anterior à reforma. */
export const ANO_REFERENCIA_REFORMA = 2025

/** Horizonte do comparativo antes/depois (LC 214/2025). */
export const ANOS_REFORMA = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

/**
 * Perfis de transportador.
 *
 * `motor` diz qual calculadora apura o CBS/IBS: o regime regular ou o Simples
 * Nacional. `requerAliquotas` marca o perfil que só tem cálculo real quando o
 * pagador informa a linha de alíquotas efetivas do PGDAS; sem ela, o perfil cai
 * na faixa setorial (`estimativa: true`).
 */
export const PERFIS = [
  {
    id: 'SIMPLES_DAS',
    rotulo: 'Simples Nacional — CBS/IBS dentro do DAS',
    curto: 'Simples/DAS',
    regime: 'SIMPLES',
    variante: 'DAS',
    varianteRotulo: 'CBS/IBS dentro do DAS (PGDAS)',
    varianteHint: 'O transportador é optante e recolhe o CBS/IBS dentro do DAS.',
    min: 0.92,
    max: 4,
    ref: 2,
    estimativa: true,
    motor: 'simples',
    requerAliquotas: true,
    descricao:
      'Recolhe CBS/IBS dentro do DAS. O crédito é o destaque apurado pelo motor do Simples com as alíquotas efetivas do PGDAS.',
    fonte:
      'Destaque do motor do Simples (atividade 05, Anexo III). Sem as alíquotas do PGDAS, faixa setorial de 0,92% a 4% do frete.',
  },
  {
    id: 'SIMPLES_HIBRIDO',
    rotulo: 'Simples Nacional — híbrido (CBS/IBS no regime regular)',
    curto: 'Simples híbrido',
    regime: 'SIMPLES',
    variante: 'HIBRIDO',
    varianteRotulo: 'CBS/IBS no regime regular (híbrido)',
    varianteHint: 'O optante escolheu recolher o CBS/IBS fora do DAS, no regime regular.',
    min: null,
    max: null,
    ref: null,
    estimativa: false,
    motor: 'regular',
    requerAliquotas: false,
    descricao:
      'Opta por recolher CBS/IBS no regime regular, fora do DAS. O CT-e destaca o tributo cheio e o crédito é integral.',
    fonte: 'Crédito integral do destaque apurado pelo regime regular.',
  },
  {
    id: 'REGIME_REGULAR',
    rotulo: 'Regime regular (Lucro Real/Presumido)',
    curto: 'Regime regular',
    regime: 'REGULAR',
    variante: 'REGULAR',
    varianteRotulo: 'Regime regular · crédito integral',
    varianteHint: 'Destaca CBS/IBS no CT-e e transfere o crédito integral ao tomador.',
    min: null,
    max: null,
    ref: null,
    estimativa: false,
    motor: 'regular',
    requerAliquotas: false,
    descricao: 'Destaca CBS/IBS no CT-e e transfere o crédito integral ao tomador.',
    fonte: 'Crédito integral apurado pelo motor oficial.',
  },
  {
    id: 'AUTONOMO_MEI',
    rotulo: 'Autônomo / MEI',
    curto: 'Autônomo/MEI',
    regime: 'REGULAR',
    variante: 'MEI',
    varianteRotulo: 'Autônomo / MEI · estimativa setorial',
    varianteHint: 'O crédito é uma estimativa setorial, não o destaque cheio do regime regular.',
    min: 1.8,
    max: 4,
    ref: 1.8,
    estimativa: true,
    motor: 'regular',
    requerAliquotas: false,
    descricao: 'Crédito residual, próximo do que o DAS embute no preço.',
    fonte: 'Faixa setorial de 1,8% a 4% do frete.',
  },
]

export const TIPOS_OPERACAO = [
  {
    id: 'B2B',
    rotulo: 'B2B',
    descricao: 'Venda a contribuinte: o crédito do frete entra na apuração.',
  },
  {
    id: 'B2C',
    rotulo: 'B2C',
    descricao: 'Venda ao consumidor final: o crédito não é aproveitável pelo pagador.',
  },
]

/**
 * Cronograma de referência (LC 214/2025) usado como fallback caso o catálogo de
 * transição do motor não esteja disponível. As alíquotas são informadas ao motor
 * como nominais — a base, as reduções e os valores continuam sendo dele.
 */
export const TABELA_TRANSICAO = {
  2026: { cbs: 0.9, ibsUf: 0.1, ibsMun: 0, fase: 'TESTE', rotulo: 'Fase de teste' },
  2027: { cbs: 8.4, ibsUf: 0.05, ibsMun: 0.05, fase: 'CBS_PLENA', rotulo: 'CBS cheia, IBS em teste' },
  2028: { cbs: 8.4, ibsUf: 0.05, ibsMun: 0.05, fase: 'CBS_PLENA', rotulo: 'CBS cheia, IBS em teste' },
  2029: { cbs: 8.5, ibsUf: 1.6, ibsMun: 0.25, fase: 'TRANSICAO_IBS', rotulo: 'Transição do IBS' },
  2030: { cbs: 8.5, ibsUf: 3.2, ibsMun: 0.5, fase: 'TRANSICAO_IBS', rotulo: 'Transição do IBS' },
  2031: { cbs: 8.5, ibsUf: 4.8, ibsMun: 0.75, fase: 'TRANSICAO_IBS', rotulo: 'Transição do IBS' },
  2032: { cbs: 8.5, ibsUf: 6.4, ibsMun: 1, fase: 'TRANSICAO_IBS', rotulo: 'Transição do IBS' },
  2033: { cbs: 8.5, ibsUf: 16, ibsMun: 2.5, fase: 'REGIME_PLENO', rotulo: 'Regime pleno' },
  2034: { cbs: 8.5, ibsUf: 16, ibsMun: 2.5, fase: 'REGIME_PLENO', rotulo: 'Regime pleno' },
}

/** Anos oferecidos na interface. */
export const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

/** UFs com região e município de referência (capital) para o IBS municipal. */
export const UFS = [
  { sigla: 'AC', nome: 'Acre', regiao: 'Norte', municipio: 1200401 },
  { sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste', municipio: 2704302 },
  { sigla: 'AP', nome: 'Amapá', regiao: 'Norte', municipio: 1600303 },
  { sigla: 'AM', nome: 'Amazonas', regiao: 'Norte', municipio: 1302603 },
  { sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste', municipio: 2927408 },
  { sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste', municipio: 2304400 },
  { sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste', municipio: 5300108 },
  { sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste', municipio: 3205309 },
  { sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste', municipio: 5208707 },
  { sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste', municipio: 2111300 },
  { sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste', municipio: 5103403 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste', municipio: 5002704 },
  { sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste', municipio: 3106200 },
  { sigla: 'PA', nome: 'Pará', regiao: 'Norte', municipio: 1501402 },
  { sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste', municipio: 2507507 },
  { sigla: 'PR', nome: 'Paraná', regiao: 'Sul', municipio: 4106902 },
  { sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste', municipio: 2611606 },
  { sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste', municipio: 2211001 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste', municipio: 3304557 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste', municipio: 2408102 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul', municipio: 4314902 },
  { sigla: 'RO', nome: 'Rondônia', regiao: 'Norte', municipio: 1100205 },
  { sigla: 'RR', nome: 'Roraima', regiao: 'Norte', municipio: 1400100 },
  { sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul', municipio: 4205407 },
  { sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste', municipio: 3550308 },
  { sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste', municipio: 2800308 },
  { sigla: 'TO', nome: 'Tocantins', regiao: 'Norte', municipio: 1721000 },
]

export function arredondar(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function perfilPorId(id) {
  return PERFIS.find((perfil) => perfil.id === id) ?? null
}

/** Rótulo curto do ano na linha do tempo (2025 é o marco "antes da reforma"). */
export function rotuloAnoReforma(ano) {
  if (Number(ano) === ANO_REFERENCIA_REFORMA) return 'Antes da reforma'
  return TABELA_TRANSICAO[Number(ano)]?.rotulo ?? 'Transição'
}

export function atividadePorId(id) {
  const normalizada = String(id ?? '').trim()
  return ATIVIDADES_SIMPLES.find((atividade) => atividade.id === normalizada) ?? null
}

export function ufPorSigla(sigla) {
  const normalizada = String(sigla ?? '').trim().toUpperCase()
  return UFS.find((uf) => uf.sigla === normalizada) ?? null
}

export function anoDaTabela(ano) {
  return TABELA_TRANSICAO[Number(ano)] ?? null
}

/** Texto da faixa de crédito, para a interface e para a memória de cálculo. */
export function faixaTexto(perfil) {
  if (!perfil.estimativa) return 'crédito integral do destaque'
  return `${formatarNumero(perfil.min)}% a ${formatarNumero(perfil.max)}%`
}

export function formatarNumero(valor, casas = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(valor) || 0)
}

/* ------------------------------------------------------------------ */
/* Crédito total do pagador (ICMS + PIS/COFINS + CBS/IBS)              */
/* ------------------------------------------------------------------ */

/**
 * Regime da empresa que PAGA o frete. O que muda é o crédito de PIS/COFINS:
 * no Lucro Real (não cumulativo) o frete usado na operação gera crédito; no
 * Lucro Presumido (cumulativo) não há crédito de PIS/COFINS sobre o frete.
 * O ICMS e o CBS/IBS são creditáveis nos dois regimes, quando destacados.
 */
export const REGIMES_PAGADORA = [
  {
    id: 'NAO_CUMULATIVO',
    rotulo: 'Lucro Real — não cumulativo',
    curto: 'Lucro Real',
    creditaPisCofins: true,
    descricao:
      'Credita o ICMS, o PIS/COFINS (enquanto existirem) e o CBS/IBS destacados no CT-e, na proporção da operação.',
  },
  {
    id: 'CUMULATIVO',
    rotulo: 'Lucro Presumido — cumulativo',
    curto: 'Lucro Presumido',
    creditaPisCofins: false,
    descricao:
      'Credita o ICMS e o CBS/IBS destacados; o PIS/COFINS cumulativo não gera crédito sobre o frete.',
  },
]

export function regimePagadoraPorId(id) {
  const normalizado = String(id ?? '')
    .trim()
    .toUpperCase()
  return REGIMES_PAGADORA.find((regime) => regime.id === normalizado) ?? null
}

/**
 * Quanto de cada tributo do CT-e vira crédito para o pagador em um ano.
 *
 * A regra combina três coisas:
 * 1. o regime do transportador decide o que é destacado no documento;
 * 2. o regime da pagadora decide o que ela pode creditar;
 * 3. o ano decide quais tributos existem (ICMS/PIS/COFINS saem, CBS/IBS entram).
 *
 * Não há alíquota calculada aqui: os percentuais vêm da projeção oficial do
 * motor (`valor do tributo ÷ valor do frete`).
 *
 * | Transportador | ICMS | PIS/COFINS | CBS/IBS |
 * | regime regular | creditável | creditável se a pagadora é não cumulativa | creditável de 2027 |
 * | Simples híbrido | no DAS, não destacado | no DAS, não destacado | creditável de 2027 |
 * | Simples/DAS | no DAS, não destacado | no DAS, não destacado | transferível na medida estimada |
 * | autônomo/MEI | não destacado | não destacado | faixa estimada |
 *
 * Em 2026 o CBS/IBS de 0,90% + 0,10% é compensado pelo transportador e não é
 * somado ao crédito do pagador: a carga efetiva do ano é a do regime anterior.
 * No Simples o CBS/IBS está dentro do DAS e o crédito é o do DAS, inclusive em
 * 2026 (por isso o percentual próprio, `taxaSimples`).
 */
export function creditosDoPagador({ perfil, regimePagadora, tipoOperacao = 'B2B', ano, percentuais, taxaSimples = 0 }) {
  const pct = (valor) => {
    const n = Number(valor)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const ehRegular = perfil.id === 'REGIME_REGULAR'
  const ehHibrido = perfil.id === 'SIMPLES_HIBRIDO'
  const cbsIbsDestacado = pct(percentuais.cbs) + pct(percentuais.ibs)
  const temCbsIbs = Number(ano) >= 2027

  let icms = 0
  let pisCofins = 0
  let cbsIbs = 0
  const notas = []

  if (ehRegular) {
    icms = pct(percentuais.icms)
    pisCofins = regimePagadora?.creditaPisCofins ? pct(percentuais.pis) + pct(percentuais.cofins) : 0
    cbsIbs = temCbsIbs ? cbsIbsDestacado : 0
    if (!regimePagadora?.creditaPisCofins && pct(percentuais.pis) + pct(percentuais.cofins) > 0) {
      notas.push('PIS/COFINS cumulativo não gera crédito sobre o frete: só ICMS e CBS/IBS entram.')
    }
    if (Number(ano) === 2026) {
      notas.push('O CBS/IBS de 2026 é fase de teste e compensado pelo transportador: não entra no seu crédito.')
    }
  } else if (ehHibrido) {
    cbsIbs = temCbsIbs ? cbsIbsDestacado : 0
    notas.push('Simples híbrido: ICMS e PIS/COFINS ficam no DAS e não são destacados para crédito.')
    if (Number(ano) === 2026) {
      notas.push('Em 2026 o destaque de 1,00% do híbrido é compensado pelo transportador e não gera crédito.')
    }
  } else {
    cbsIbs = pct(taxaSimples)
    notas.push(
      'Simples/DAS e autônomo/MEI não destacam ICMS nem PIS/COFINS: o crédito é só a parcela de CBS/IBS do DAS.',
    )
    if (perfil.id === 'AUTONOMO_MEI') {
      notas.push(
        'No autônomo/MEI o CBS/IBS é crédito presumido, com percentual definido em ato conjunto (art. 169 da LC 214/2025) — a faixa setorial é estimativa do simulador.',
      )
    }
    if (Number(ano) === 2026) {
      cbsIbs = 0
      notas.push(
        'Em 2026 as alíquotas de 0,90% e 0,10% não se aplicam às operações de optante do Simples (art. 348, III, "c"): não há crédito de CBS/IBS no ano.',
      )
    }
  }

  if (Number(ano) <= 2025) {
    icms = ehRegular ? pct(percentuais.icms) : 0
    pisCofins = ehRegular && regimePagadora?.creditaPisCofins ? pct(percentuais.pis) + pct(percentuais.cofins) : 0
    cbsIbs = 0
    notas.push(
      ehRegular
        ? 'Antes da reforma não havia CBS/IBS: o crédito é de ICMS e PIS/COFINS.'
        : 'Antes da reforma o optante recolhia ICMS e PIS/COFINS no DAS, sem destaque para crédito.',
    )
  }

  const total = icms + pisCofins + cbsIbs
  if (tipoOperacao === 'B2C') {
    return {
      icms: 0,
      pisCofins: 0,
      cbsIbs: 0,
      total: 0,
      percentual: 0,
      zeradoPorB2C: true,
      notas: [
        'B2C: o pagador é o consumidor final e não aproveita crédito de nenhum tributo — o custo é o preço cheio.',
      ],
    }
  }

  return {
    icms,
    pisCofins,
    cbsIbs,
    total,
    percentual: Number(total.toFixed(4)),
    zeradoPorB2C: false,
    notas,
  }
}

/**
 * Aplica a regra de crédito do regime ao destaque apurado pelo motor.
 *
 * O destaque é um teto: nenhum regime transfere mais crédito do que o CBS/IBS
 * efetivamente destacado no documento. Em B2C o pagador é o consumidor final e
 * não aproveita nada.
 *
 * `fonteCredito`:
 * - `integral`: regime regular, Simples híbrido e Simples com apuração real —
 *   todo o destaque vira crédito;
 * - `simples`: destaque apurado pelo motor do Simples (também integral);
 * - `estimativa`: faixa setorial aplicada sobre o frete, limitada ao destaque.
 *
 * @param {object} dados
 * @param {number} dados.valorFrete preço nominal do frete
 * @param {object} dados.perfil perfil do transportador
 * @param {number} dados.destaque CBS + IBS apurados pelo motor
 * @param {string} dados.tipoOperacao B2B ou B2C
 * @param {number|null} [dados.taxaInformada] taxa dentro da faixa, para estimativas
 * @param {'integral'|'simples'|'estimativa'} [dados.fonteCredito] origem da regra de crédito
 * @returns {object} crédito, percentual, custo líquido, teto, alerta e notas
 */
export function avaliarCredito({
  valorFrete,
  perfil,
  destaque,
  tipoOperacao,
  taxaInformada,
  ano,
  fonteCredito = perfil.estimativa ? 'estimativa' : 'integral',
}) {
  const bruto = arredondar(valorFrete)
  const teto = arredondar(destaque)
  const tetoPercentual = bruto > 0 ? (teto / bruto) * 100 : 0
  const notas = []

  let taxaAplicada = null
  let creditoIdeal
  let percentualIdeal

  if (fonteCredito === 'estimativa') {
    taxaAplicada = Number(taxaInformada ?? perfil.ref)
    if (!Number.isFinite(taxaAplicada)) {
      throw new Error('Taxa de crédito inválida para o regime estimado.')
    }
    if (taxaAplicada < perfil.min - 1e-9 || taxaAplicada > perfil.max + 1e-9) {
      throw new Error(
        `A taxa de crédito de ${formatarNumero(taxaAplicada)}% está fora da faixa do perfil ${perfil.curto} (${formatarNumero(perfil.min)}% a ${formatarNumero(perfil.max)}%).`,
      )
    }
    creditoIdeal = arredondar((bruto * taxaAplicada) / 100)
    percentualIdeal = taxaAplicada
    notas.push(
      `Crédito estimado pela faixa setorial do regime: ${formatarNumero(perfil.min)}% a ${formatarNumero(perfil.max)}% do frete.`,
    )
  } else {
    creditoIdeal = teto
    percentualIdeal = tetoPercentual
    if (fonteCredito === 'simples') {
      notas.push(
        'O destaque apurado pelo motor do Simples Nacional é transferido integralmente ao tomador — não há estimativa setorial.',
      )
    } else if (perfil.id === 'SIMPLES_HIBRIDO') {
      notas.push(
        'Simples híbrido: o transportador optou por recolher CBS/IBS no regime regular; o destaque cheio do CT-e vira crédito integral.',
      )
    } else {
      notas.push('Regime regular: o destaque de CBS/IBS do motor vira crédito integral, sem estimativa.')
    }
  }

  const limitadoAoTeto = creditoIdeal > teto + 1e-9
  let credito = limitadoAoTeto ? teto : creditoIdeal
  let percentual = bruto > 0 ? (credito / bruto) * 100 : 0

  if (limitadoAoTeto) {
    notas.push(
      `O crédito de ${formatarNumero(percentualIdeal)}% excede o destaque do ano (${formatarNumero(tetoPercentual)}%) e foi limitado a ele.`,
    )
  }

  if (tipoOperacao === 'B2C') {
    credito = 0
    percentual = 0
    notas.push(
      'Operação B2C: o pagador é o consumidor final e não aproveita CBS/IBS. O custo líquido é o preço cheio.',
    )
  }

  // 2026 é fase de teste: o CBS/IBS destacado é compensado pelo próprio
  // transportador (LC 214/2025, art. 348, I) e, nas operações de optante do
  // Simples, as alíquotas nem se aplicam (art. 348, III, "c"). Não há crédito
  // de CBS/IBS para o adquirente nesse ano.
  if (Number(ano) === 2026) {
    if (percentual > 0) {
      notas.push(
        'Em 2026 o CBS/IBS de 1,00% é compensado pelo transportador e não gera crédito ao adquirente (art. 348 da LC 214/2025). O crédito do ano é de ICMS e PIS/COFINS.',
      )
    }
    credito = 0
    percentual = 0
  }

  const custoLiquido = arredondar(bruto - credito)
  const creditoPerdido = Number(ano) === 2026 ? 0 : arredondar(teto - credito)

  return {
    credito,
    percentualCredito: Number(percentual.toFixed(4)),
    custoLiquido,
    destaque: teto,
    percentualDestaque: Number(tetoPercentual.toFixed(4)),
    creditoPerdido,
    limitadoAoTeto,
    taxaAplicada,
    fonteCredito,
    creditoIntegral: fonteCredito !== 'estimativa',
    faixa: fonteCredito === 'estimativa' ? { min: perfil.min, max: perfil.max } : { min: tetoPercentual, max: tetoPercentual },
    alerta: montarAlerta({ percentual, tipoOperacao, perfil, creditoPerdido, bruto, ano }),
    notas,
  }
}

function montarAlerta({ percentual, tipoOperacao, perfil, creditoPerdido, bruto, ano }) {
  if (tipoOperacao === 'B2C') {
    return {
      nivel: 'neutro',
      titulo: 'Sem crédito por definição (B2C)',
      texto:
        'Nesta operação o crédito de CBS/IBS não chega ao pagador. Compare preço e serviço; o regime do transportador não muda o custo líquido.',
    }
  }

  if (Number(ano) === 2026) {
    return {
      nivel: 'neutro',
      titulo: 'Fase de teste: 1,00% de CBS/IBS',
      texto:
        'Em 2026 o CBS/IBS é de 1,00% e compensável pelo transportador com PIS/COFINS e ICMS: o percentual é da fase de teste, não uma comparação entre regimes. O crédito total do pagador neste ano é ICMS + PIS/COFINS — veja em Seu frete ao longo da reforma.',
    }
  }

  if (percentual < 4) {
    const perda = creditoPerdido > 0 ? ` Deixa R$ ${formatarNumero(creditoPerdido)} de crédito na mesa.` : ''
    return {
      nivel: 'atencao',
      titulo: 'Crédito efetivo abaixo de 4%',
      texto: `${perfil.curto} transfere apenas ${formatarNumero(percentual)}% dos R$ ${formatarNumero(bruto)}.${perda} Um transportador que transfira mais crédito pode sair mais barato mesmo cobrando mais no nominal.`,
    }
  }

  return {
    nivel: 'ok',
    titulo: 'Crédito material',
    texto: `O regime transfere ${formatarNumero(percentual)}% do frete em crédito de CBS/IBS. O custo líquido já reflete essa recuperação.`,
  }
}

export function rotuloFase(fase) {
  return (
    {
      TESTE: 'fase de teste (CBS 0,90% + IBS 0,10%)',
      CBS_PLENA: 'CBS cheia, IBS em teste',
      TRANSICAO_IBS: 'transição do IBS',
      REGIME_PLENO: 'regime pleno',
    }[fase] ?? 'transição'
  )
}
