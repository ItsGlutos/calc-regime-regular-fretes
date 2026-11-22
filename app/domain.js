/**
 * Regras de negócio do simulador do pagador de frete.
 *
 * O CBS/IBS NUNCA é calculado aqui: o destaque vem do motor oficial da Receita
 * (calculadora-rtc-regime-regular). Este módulo só decide quanto do destaque o
 * pagador consegue virar crédito, conforme o regime do transportador.
 */

/** NBS do transporte rodoviário de carga unitizada (item de CT-e). */
export const NBS_FRETE = '105011220'

/** Perfis de transportador e a faixa de crédito transferida ao pagador. */
export const PERFIS = [
  {
    id: 'SIMPLES_DAS',
    rotulo: 'Simples Nacional — DAS integral',
    curto: 'Simples/DAS',
    min: 0.92,
    max: 4,
    ref: 2,
    estimativa: true,
    descricao: 'Recolhe CBS/IBS dentro do DAS. Transfere só uma fração do crédito.',
    fonte: 'Faixa setorial de 0,92% a 4% do frete.',
  },
  {
    id: 'SIMPLES_HIBRIDO',
    rotulo: 'Simples Nacional — híbrido (CBS/IBS fora do DAS)',
    curto: 'Simples híbrido',
    min: 9,
    max: 9.3,
    ref: 9.3,
    estimativa: true,
    descricao: 'Opta por recolher CBS/IBS no regime regular. O crédito quase alcança o regime regular.',
    fonte: 'Faixa setorial de 9% a 9,3% do frete.',
  },
  {
    id: 'REGIME_REGULAR',
    rotulo: 'Regime regular (Lucro Real/Presumido)',
    curto: 'Regime regular',
    min: null,
    max: null,
    ref: null,
    estimativa: false,
    descricao: 'Destaca CBS/IBS no CT-e e transfere o crédito integral ao tomador.',
    fonte: 'Crédito integral apurado pelo motor oficial.',
  },
  {
    id: 'AUTONOMO_MEI',
    rotulo: 'Autônomo / MEI',
    curto: 'Autônomo/MEI',
    min: 1.8,
    max: 4,
    ref: 1.8,
    estimativa: true,
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
export const ANOS = [2026, 2027, 2029, 2033]

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

/**
 * Aplica a regra de crédito do regime ao destaque apurado pelo motor.
 *
 * O destaque do motor é um teto: nenhum regime transfere mais crédito do que o
 * CBS/IBS efetivamente destacado no documento. Em B2C o pagador é o consumidor
 * final e não aproveita nada.
 *
 * @param {object} dados
 * @param {number} dados.valorFrete preço nominal do frete
 * @param {object} dados.perfil perfil do transportador
 * @param {number} dados.destaque CBS + IBS apurados pelo motor
 * @param {string} dados.tipoOperacao B2B ou B2C
 * @param {number|null} [dados.taxaInformada] taxa dentro da faixa, para estimativas
 * @returns {object} crédito, percentual, custo líquido, teto, alerta e notas
 */
export function avaliarCredito({ valorFrete, perfil, destaque, tipoOperacao, taxaInformada }) {
  const bruto = arredondar(valorFrete)
  const teto = arredondar(destaque)
  const tetoPercentual = bruto > 0 ? (teto / bruto) * 100 : 0
  const notas = []

  let taxaAplicada
  let creditoIdeal
  let percentualIdeal

  if (perfil.estimativa) {
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
    taxaAplicada = null
    creditoIdeal = teto
    percentualIdeal = tetoPercentual
    notas.push('Regime regular: o destaque de CBS/IBS do motor vira crédito integral, sem estimativa.')
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

  const custoLiquido = arredondar(bruto - credito)
  const creditoPerdido = arredondar(teto - credito)

  return {
    credito,
    percentualCredito: Number(percentual.toFixed(4)),
    custoLiquido,
    destaque: teto,
    percentualDestaque: Number(tetoPercentual.toFixed(4)),
    creditoPerdido,
    limitadoAoTeto,
    taxaAplicada,
    faixa: perfil.estimativa ? { min: perfil.min, max: perfil.max } : { min: tetoPercentual, max: tetoPercentual },
    alerta: montarAlerta({ percentual, tipoOperacao, perfil, creditoPerdido, bruto }),
    notas,
  }
}

function montarAlerta({ percentual, tipoOperacao, perfil, creditoPerdido, bruto }) {
  if (tipoOperacao === 'B2C') {
    return {
      nivel: 'neutro',
      titulo: 'Sem crédito por definição (B2C)',
      texto:
        'Nesta operação o crédito de CBS/IBS não chega ao pagador. Compare preço e serviço; o regime do transportador não muda o custo líquido.',
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
