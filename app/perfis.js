/**
 * Perfis de transportadores: diária → faturamento do mês → custo líquido.
 *
 * Um perfil guarda o que o pagador sabe do transportador antes de contratar:
 * nome, rota, regime e quanto ele cobra por DIÁRIA. O app transforma a diária em
 * faturamento mensal — e o mês tem 28, 29, 30 ou 31 dias, com 20 a 23 dias úteis
 * dependendo do calendário — e aplica a mesma regra de crédito da simulação.
 *
 * Este módulo é puro: não lê arquivo, não chama motor. Recebe os percentuais por
 * ano (`taxasDoFretePorAno`) e devolve a conta pronta para a interface.
 */
import {
  PERFIS,
  arredondar,
  creditosDoPagador,
  formatarNumero,
  perfilPorId,
  regimePagadoraPorId,
  rotuloAnoReforma,
  ufPorSigla,
} from './domain.js'

export const ANOS_PERFIL = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

/** Como os dias faturáveis do mês são contados. */
export const MODOS_DIAS = [
  {
    id: 'UTEIS',
    rotulo: 'Dias úteis (seg–sex, sem feriados)',
    curto: 'dias úteis',
    descricao:
      'Conta segunda a sexta e desconta os feriados nacionais. É o padrão de operação administrativa e rodoviária.',
  },
  {
    id: 'UTEIS_EFETIVOS',
    rotulo: 'Dias úteis efetivos (sem Carnaval e Paixão)',
    curto: 'dias úteis efetivos',
    descricao:
      'Além dos feriados nacionais, desconta Carnaval e Sexta-feira da Paixão — dias em que boa parte da operação para.',
  },
  {
    id: 'UTEIS_SABADO',
    rotulo: 'Segunda a sábado (sem feriados)',
    curto: 'seg–sáb',
    descricao:
      'Conta segunda a sábado e desconta os feriados nacionais. A escala 6×1 está em extinção para motorista empregado (EC 141/2026); use para autônomo ou contrato antigo.',
  },
  {
    id: 'CORRIDOS',
    rotulo: 'Todos os dias do mês',
    curto: 'dias corridos',
    descricao: 'Conta todos os dias do calendário, inclusive domingos e feriados.',
  },
  {
    id: 'FIXO',
    rotulo: 'Dias fixos por mês',
    curto: 'dias fixos',
    descricao: 'Você informa quantos dias por mês, igual em todos os meses (ex.: 22).',
  },
]

/**
 * Feriados nacionais por ano.
 *
 * Fixos: Lei 662/1949 (com a redação da Lei 10.607/2002), Lei 6.802/1980
 * (12/10) e Lei 14.759/2023 (20/11). Móveis: Carnaval e Sexta-feira da Paixão
 * entram só no modo "efetivo", porque são ponto facultativo/religioso e param a
 * operação sem serem feriado nacional.
 */
const FERIADOS_FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
const UM_DIA = 86_400_000

/** Páscoa (Meeus/Jones/Butcher), em milissegundos UTC. */
function pascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(ano, mes - 1, dia)
}

const cacheFeriados = new Map()

function chaveData(ano, mes, dia) {
  return `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Conjuntos de feriados do ano: `fixos` e `efetivos` (fixos + Carnaval + Paixão). */
export function feriadosDoAno(ano) {
  const chave = Number(ano)
  if (cacheFeriados.has(chave)) return cacheFeriados.get(chave)

  const p = pascoa(chave)
  const carnaval = new Date(p - 47 * UM_DIA)
  const paixao = new Date(p - 2 * UM_DIA)
  const moveis = [
    chaveData(chave, carnaval.getUTCMonth() + 1, carnaval.getUTCDate()),
    chaveData(chave, paixao.getUTCMonth() + 1, paixao.getUTCDate()),
  ]

  const dados = {
    ano: chave,
    fixos: new Set(FERIADOS_FIXOS),
    efetivos: new Set([...FERIADOS_FIXOS, ...moveis]),
    carnaval: moveis[0],
    paixao: moveis[1],
  }
  cacheFeriados.set(chave, dados)
  return dados
}

export const MESES = [
  { mes: 1, nome: 'Janeiro', curto: 'jan' },
  { mes: 2, nome: 'Fevereiro', curto: 'fev' },
  { mes: 3, nome: 'Março', curto: 'mar' },
  { mes: 4, nome: 'Abril', curto: 'abr' },
  { mes: 5, nome: 'Maio', curto: 'mai' },
  { mes: 6, nome: 'Junho', curto: 'jun' },
  { mes: 7, nome: 'Julho', curto: 'jul' },
  { mes: 8, nome: 'Agosto', curto: 'ago' },
  { mes: 9, nome: 'Setembro', curto: 'set' },
  { mes: 10, nome: 'Outubro', curto: 'out' },
  { mes: 11, nome: 'Novembro', curto: 'nov' },
  { mes: 12, nome: 'Dezembro', curto: 'dez' },
]

export const LIMITES = {
  diaria: { min: 1, max: 100_000 },
  diasFixo: { min: 1, max: 31 },
  nome: { min: 2, max: 60 },
  aliquota: { min: 0, max: 30 },
  dasTotal: { min: 0, max: 40 },
  perfis: 30,
}

/**
 * Faixas de referência de diária por tipo de veículo.
 *
 * Derivadas do piso mínimo da ANTT (carga geral, 6 eixos, tabela de 16/07/2026:
 * R$ 8,80/km a 400 km/dia) e da escala de capacidade `(t/27)^0,55`, detalhada
 * em `docs/especialista-custos-transportes/03-diarias-de-mercado.md`. Não são
 * cotações de mercado: são referência para default e para aviso de faixa.
 */
export const TIPOS_VEICULO = [
  { id: '3/4', rotulo: '3/4 · 2 eixos · 3,5 t', eixos: 2, capacidade: 3.5, kmDia: 250, min: 550, base: 720, max: 900 },
  { id: 'TOCO', rotulo: 'Toco · 2 eixos · 6 t', eixos: 2, capacidade: 6, kmDia: 280, min: 860, base: 1080, max: 1350 },
  { id: 'TRUCK', rotulo: 'Truck · 3 eixos · 12 t', eixos: 3, capacidade: 12, kmDia: 320, min: 1440, base: 1800, max: 2200 },
  {
    id: 'CARRETA',
    rotulo: 'Carreta · 5–6 eixos · 27 t',
    eixos: 6,
    capacidade: 27,
    kmDia: 400,
    min: 2820,
    base: 3500,
    max: 4300,
  },
  { id: 'BITREM', rotulo: 'Bitrem · 7 eixos · 38 t', eixos: 7, capacidade: 38, kmDia: 450, min: 3820, base: 4800, max: 5850 },
]

export const REFERENCIA_DIARIA = {
  fonte: 'Piso ANTT de 16/07/2026 (carga geral, 6 eixos, R$ 8,80/km × 400 km) + escala de capacidade',
  documento: 'docs/especialista-custos-transportes/03-diarias-de-mercado.md',
  atualizadoEm: '2026-07-16',
  natureza: 'derivado',
}

export function tipoVeiculoPorId(id) {
  const normalizado = String(id ?? '')
    .trim()
    .toUpperCase()
  return TIPOS_VEICULO.find((tipo) => tipo.id.toUpperCase() === normalizado) ?? null
}

export class PerfilInvalidoError extends Error {
  constructor(campo, mensagem) {
    super(mensagem)
    this.name = 'PerfilInvalidoError'
    this.campo = campo
  }
}

function inteiro(valor) {
  const n = Number(String(valor ?? '').replace(',', '.'))
  return Number.isInteger(n) ? n : null
}

function numero(valor) {
  const texto = String(valor ?? '')
    .trim()
    .replace(/[R$\s]/g, '')
  if (!texto) return Number.NaN
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  return Number(normalizado)
}

function texto(valor) {
  return String(valor ?? '').trim()
}

/** Percentual opcional (CBS/IBS do PGDAS): vazio vira null. */
function percentualDoPerfil(valor, campo) {
  if (valor === undefined || valor === null || texto(valor) === '') return null
  const n = numero(valor)
  if (!Number.isFinite(n) || n < LIMITES.aliquota.min || n > LIMITES.aliquota.max) {
    throw new PerfilInvalidoError(
      campo.includes('CBS') ? 'aliquotaCbs' : 'aliquotaIbs',
      `Informe ${campo} entre 0% e 30%.`,
    )
  }
  return Number(n.toFixed(4))
}

/** Total do PGDAS de um perfil (null quando nenhuma das duas foi informada). */
export function creditoDoSimples(perfil) {
  const cbs = Number(perfil?.aliquotaCbs)
  const ibs = Number(perfil?.aliquotaIbs)
  const temCbs = Number.isFinite(cbs)
  const temIbs = Number.isFinite(ibs)
  if (!temCbs && !temIbs) return null
  return Number(((temCbs ? cbs : 0) + (temIbs ? ibs : 0)).toFixed(4))
}

/** Remove acentos e caixa para comparar nomes de perfil. */
export function chaveDoNome(nome) {
  return texto(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Valida e normaliza os campos de um perfil. `parcial` é usado em PUT: só os
 * campos enviados são validados, e os demais ficam como estão.
 */
export function normalizarPerfil(entrada, { parcial = false } = {}) {
  const dados = entrada && typeof entrada === 'object' ? entrada : {}
  const resultado = {}

  const tem = (campo) => Object.prototype.hasOwnProperty.call(dados, campo)

  if (!parcial || tem('nome')) {
    const nome = texto(dados.nome).replace(/\s+/g, ' ')
    if (nome.length < LIMITES.nome.min) {
      throw new PerfilInvalidoError('nome', 'Dê um nome ao perfil com pelo menos 2 caracteres.')
    }
    if (nome.length > LIMITES.nome.max) {
      throw new PerfilInvalidoError('nome', `O nome do perfil deve ter até ${LIMITES.nome.max} caracteres.`)
    }
    resultado.nome = nome
  }

  if (!parcial || tem('diaria')) {
    const diaria = numero(dados.diaria)
    if (!Number.isFinite(diaria) || diaria < LIMITES.diaria.min) {
      throw new PerfilInvalidoError('diaria', 'Informe a diária em reais, maior que zero.')
    }
    if (diaria > LIMITES.diaria.max) {
      throw new PerfilInvalidoError(
        'diaria',
        `A diária máxima aceita é R$ ${formatarNumero(LIMITES.diaria.max)}.`,
      )
    }
    resultado.diaria = arredondar(diaria)
  }

  if (!parcial || tem('ufOrigem')) {
    const uf = ufPorSigla(dados.ufOrigem)
    if (!uf) throw new PerfilInvalidoError('ufOrigem', 'UF de origem inválida.')
    resultado.ufOrigem = uf.sigla
  }

  if (!parcial || tem('ufDestino')) {
    const uf = ufPorSigla(dados.ufDestino ?? dados.ufOrigem)
    if (!uf) throw new PerfilInvalidoError('ufDestino', 'UF de destino inválida.')
    resultado.ufDestino = uf.sigla
  }

  if (!parcial || tem('perfil')) {
    const perfil = perfilPorId(dados.perfil ?? dados.perfilId)
    if (!perfil) {
      throw new PerfilInvalidoError(
        'perfil',
        `Regime do transportador inválido. Use ${PERFIS.map((item) => item.id).join(', ')}.`,
      )
    }
    resultado.perfil = perfil.id
  }

  if (!parcial || tem('tipoVeiculo')) {
    if (dados.tipoVeiculo === undefined || dados.tipoVeiculo === null || texto(dados.tipoVeiculo) === '') {
      resultado.tipoVeiculo = null
    } else {
      const tipo = tipoVeiculoPorId(dados.tipoVeiculo)
      if (!tipo) throw new PerfilInvalidoError('tipoVeiculo', 'Tipo de veículo inválido.')
      resultado.tipoVeiculo = tipo.id
    }
  }

  if (!parcial || tem('modoDias')) {
    const modo = MODOS_DIAS.find((item) => item.id === texto(dados.modoDias).toUpperCase())
    if (!modo) {
      throw new PerfilInvalidoError(
        'modoDias',
        `Modo de dias inválido. Use ${MODOS_DIAS.map((item) => item.id).join(', ')}.`,
      )
    }
    resultado.modoDias = modo.id
  }

  if (!parcial || tem('diasFixo')) {
    if ((resultado.modoDias ?? texto(dados.modoDias).toUpperCase()) === 'FIXO') {
      const dias = inteiro(dados.diasFixo ?? 22)
      if (dias === null || dias < LIMITES.diasFixo.min || dias > LIMITES.diasFixo.max) {
        throw new PerfilInvalidoError('diasFixo', 'Informe de 1 a 31 dias fixos por mês.')
      }
      resultado.diasFixo = dias
    } else {
      resultado.diasFixo = 22
    }
  }

  if (!parcial || tem('aliquotaCbs')) {
    resultado.aliquotaCbs = percentualDoPerfil(dados.aliquotaCbs, 'a alíquota efetiva da CBS')
  }

  if (!parcial || tem('aliquotaIbs')) {
    resultado.aliquotaIbs = percentualDoPerfil(dados.aliquotaIbs, 'a alíquota efetiva do IBS')
  }

  if (!parcial || tem('dasTotal')) {
    if (dados.dasTotal === undefined || dados.dasTotal === null || texto(dados.dasTotal) === '') {
      resultado.dasTotal = null
    } else {
      const das = numero(dados.dasTotal)
      if (!Number.isFinite(das) || das < LIMITES.dasTotal.min || das > LIMITES.dasTotal.max) {
        throw new PerfilInvalidoError('dasTotal', 'Informe o DAS total entre 0% e 40%.')
      }
      resultado.dasTotal = Number(das.toFixed(2))
    }
  }

  if (!parcial || tem('tipoOperacao')) {
    const tipo = texto(dados.tipoOperacao ?? 'B2B').toUpperCase()
    if (!['B2B', 'B2C'].includes(tipo)) {
      throw new PerfilInvalidoError('tipoOperacao', 'Tipo de operação inválido. Use B2B ou B2C.')
    }
    resultado.tipoOperacao = tipo
  }

  if (!parcial || tem('observacao')) {
    const observacao = texto(dados.observacao)
    if (observacao.length > 240) {
      throw new PerfilInvalidoError('observacao', 'A observação deve ter até 240 caracteres.')
    }
    resultado.observacao = observacao
  }

  return resultado
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function ultimoDia(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Quantos dias o mês tem no modo escolhido. Tudo em UTC para não depender do
 * fuso do servidor: 1º de março de 2026 é domingo em qualquer lugar.
 */
export function diasNoMes(ano, mes, modoDias, diasFixo = 22) {
  if (modoDias === 'FIXO') {
    const n = Number(diasFixo)
    return Number.isInteger(n) ? Math.min(31, Math.max(1, n)) : 22
  }
  if (modoDias === 'CORRIDOS') return ultimoDia(ano, mes)

  const feriados = feriadosDoAno(ano)
  const conjunto = modoDias === 'UTEIS_EFETIVOS' ? feriados.efetivos : feriados.fixos
  const limite = modoDias === 'UTEIS_SABADO' ? 6 : 5
  let dias = 0
  for (let dia = 1; dia <= ultimoDia(ano, mes); dia += 1) {
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
    if (semana >= 1 && semana <= limite && !conjunto.has(chaveData(ano, mes, dia))) dias += 1
  }
  return dias
}

/** O ano inteiro, mês a mês, no modo escolhido. */
export function calendarioDoAno(ano, modoDias, diasFixo = 22) {
  const meses = MESES.map(({ mes, nome, curto }) => {
    const dias = diasNoMes(ano, mes, modoDias, diasFixo)
    return {
      mes,
      nome,
      curto,
      dias,
      diasUteis: diasNoMes(ano, mes, 'UTEIS'),
      diasCorridos: ultimoDia(ano, mes),
    }
  })
  return {
    ano: Number(ano),
    modo: modoDias,
    meses,
    totalDias: meses.reduce((soma, mes) => soma + mes.dias, 0),
    mediaMensal: arredondar(meses.reduce((soma, mes) => soma + mes.dias, 0) / 12),
  }
}

/* ------------------------------------------------------------------ */
/* Crédito por ano                                                     */
/* ------------------------------------------------------------------ */

/**
 * Percentual de crédito do pagador para o perfil em um ano.
 *
 * Reaproveita `creditosDoPagador` (a mesma regra da simulação): ICMS +
 * PIS/COFINS + CBS/IBS no regime regular; só CBS/IBS no híbrido; a alíquota do
 * DAS no Simples/MEI; zero em B2C e zero de CBS/IBS em 2026.
 */
export function creditoDoAno({ perfil, regimePagadora, tipoOperacao, ano, taxas, creditoSimples }) {
  const perfilTransportador = perfilPorId(perfil)
  if (!perfilTransportador) throw new PerfilInvalidoError('perfil', 'Regime do transportador inválido.')

  const linha = taxas ?? { icms: 0, pis: 0, cofins: 0, cbs: 0, ibs: 0 }
  const taxaSimples =
    creditoSimples === null || creditoSimples === undefined
      ? (perfilTransportador.ref ?? 0)
      : Number(creditoSimples)

  return creditosDoPagador({
    perfil: perfilTransportador,
    regimePagadora,
    tipoOperacao,
    ano,
    percentuais: linha,
    taxaSimples,
  })
}

function composicao(credito, bruto) {
  return {
    icms: arredondar((bruto * (credito.icms ?? 0)) / 100),
    pisCofins: arredondar((bruto * (credito.pisCofins ?? 0)) / 100),
    cbsIbs: arredondar((bruto * (credito.cbsIbs ?? 0)) / 100),
  }
}

/* ------------------------------------------------------------------ */
/* A conta do perfil                                                   */
/* ------------------------------------------------------------------ */

const quatro = (valor) => Number((Number(valor) || 0).toFixed(4))

function descricaoDoPerfil(perfil) {
  const item = perfilPorId(perfil)
  return {
    id: item.id,
    rotulo: item.rotulo,
    curto: item.curto,
    regime: item.regime,
    estimativa: Boolean(item.estimativa),
  }
}

/**
 * Monta a visão completa de um perfil: calendário, mês a mês, totais do ano e
 * a série 2026–2033 com o mesmo preço por diária.
 *
 * @param {object} opcoes
 * @param {object} opcoes.perfil perfil já normalizado
 * @param {object} opcoes.taxas `{ porAno: Map, versaoBaseDados }` de `taxasDoFretePorAno`
 * @param {object} opcoes.regimePagadora regime de crédito da empresa que paga
 * @param {number} opcoes.anoReferencia ano da tabela mês a mês
 * @param {number} opcoes.anoHoje ano corrente
 * @param {number} [opcoes.mesReferencia] mês destacado na tabela (1–12)
 * @param {number} [opcoes.mesAtual] mês corrente de verdade (1–12)
 */
export function calcularPerfil({
  perfil,
  taxas,
  regimePagadora,
  anoReferencia = 2026,
  anoHoje = 2026,
  mesReferencia = 1,
  mesAtual = 1,
}) {
  const regime = regimePagadoraPorId(regimePagadora) ?? regimePagadoraPorId('NAO_CUMULATIVO')
  const tipoOperacao = perfil.tipoOperacao ?? 'B2B'
  const perfilInfo = descricaoDoPerfil(perfil.perfil)
  const creditoSimples = creditoDoSimples(perfil)
  const tipoVeiculo = tipoVeiculoPorId(perfil.tipoVeiculo)

  const taxaDoAno = (ano) => taxas?.porAno?.get?.(Number(ano)) ?? null
  const creditoDe = (ano) => {
    const linha = taxaDoAno(ano)
    const credito = creditoDoAno({
      perfil: perfil.perfil,
      regimePagadora: regime,
      tipoOperacao,
      ano,
      taxas: linha,
      creditoSimples,
    })
    return { credito, linha }
  }

  const calendario = calendarioDoAno(anoReferencia, perfil.modoDias, perfil.diasFixo)
  const { credito: creditoRef, linha: linhaRef } = creditoDe(anoReferencia)
  const percentualCredito = creditoRef.percentual

  const meses = calendario.meses.map(({ mes, nome, curto, dias, diasUteis, diasCorridos }) => {
    const bruto = arredondar(perfil.diaria * dias)
    const partes = composicao(creditoRef, bruto)
    const credito = arredondar((bruto * percentualCredito) / 100)
    const liquido = arredondar(bruto - credito)
    const das =
      perfil.dasTotal !== null && perfil.dasTotal !== undefined
        ? arredondar((bruto * perfil.dasTotal) / 100)
        : null
    return {
      mes,
      nome,
      curto,
      dias,
      diasUteis,
      diasCorridos,
      bruto,
      credito,
      percentualCredito: quatro(percentualCredito),
      composicao: partes,
      liquido,
      liquidoTransportador: das === null ? null : arredondar(bruto - das),
      das,
      atual: Number(anoReferencia) === Number(anoHoje) && mes === Number(mesAtual),    }
  })

  const somar = (campo) => arredondar(meses.reduce((soma, mes) => soma + (mes[campo] ?? 0), 0))
  const totais = {
    dias: calendario.totalDias,
    bruto: somar('bruto'),
    credito: somar('credito'),
    liquido: somar('liquido'),
    das: somar('das'),
    liquidoTransportador:
      perfil.dasTotal === null || perfil.dasTotal === undefined ? null : somar('liquidoTransportador'),
    mediaMensalBruto: null,
    mediaMensalLiquido: null,
  }
  totais.mediaMensalBruto = arredondar(totais.bruto / 12)
  totais.mediaMensalLiquido = arredondar(totais.liquido / 12)
  totais.percentualCredito = totais.bruto > 0 ? quatro((totais.credito / totais.bruto) * 100) : 0

  // Série anual: o preço da diária é o mesmo em todos os anos (preço travado);
  // o que muda é o calendário e a carga tributária.
  const anos = ANOS_PERFIL.filter((ano) => ano >= Math.min(anoHoje, anoReferencia)).map((ano) => {
    const calendarioAno = calendarioDoAno(ano, perfil.modoDias, perfil.diasFixo)
    const { credito } = creditoDe(ano)
    // Soma mês a mês: cada documento é arredondado no centavo, então o total do
    // ano tem de sair da soma dos meses — e não de uma alíquota aplicada ao
    // bruto anual, que daria alguns centavos de diferença.
    let bruto = 0
    let valorCredito = 0
    for (const mes of calendarioAno.meses) {
      const brutoMes = arredondar(perfil.diaria * mes.dias)
      bruto = arredondar(bruto + brutoMes)
      valorCredito = arredondar(valorCredito + arredondar((brutoMes * credito.percentual) / 100))
    }
    const liquido = arredondar(bruto - valorCredito)
    return {
      ano,
      rotulo: rotuloAnoReforma(ano),
      dias: calendarioAno.totalDias,
      mediaMensalDias: calendarioAno.mediaMensal,
      bruto,
      credito: valorCredito,
      percentualCredito: quatro(credito.percentual),
      composicao: composicao(credito, bruto),
      liquido,
      mediaMensalBruto: arredondar(bruto / 12),
      mediaMensalLiquido: arredondar(liquido / 12),
      percentualLiquido: bruto > 0 ? quatro((liquido / bruto) * 100) : 0,
      notas: credito.notas ?? [],
    }
  })

  const anoBase = anos.find((linha) => linha.ano === Number(anoReferencia)) ?? anos[0] ?? null
  for (const linha of anos) {
    linha.variacaoLiquido = anoBase ? arredondar(linha.liquido - anoBase.liquido) : 0
    linha.variacaoPercentual =
      anoBase && anoBase.liquido > 0 ? quatro(((linha.liquido - anoBase.liquido) / anoBase.liquido) * 100) : 0
  }

  // Quanto o pagador DEVERIA pagar por diária para empatar com um transportador
  // do regime regular no mesmo serviço. Só faz sentido fora do regime regular.
  const deveria = montarDeveria({
    perfil,
    perfilInfo,
    anos,
    meses,
    regime,
    tipoOperacao,
    anoReferencia,
    taxas,
  })

  const rota = `${perfil.ufOrigem} → ${perfil.ufDestino}`
  const interna = perfil.ufOrigem === perfil.ufDestino

  return {
    perfil: {
      id: perfil.id ?? null,
      nome: perfil.nome,
      diaria: perfil.diaria,
      ufOrigem: perfil.ufOrigem,
      ufDestino: perfil.ufDestino,
      rota,
      tipoRota: interna ? 'INTERNA' : 'INTERESTADUAL',
      tipoRotaRotulo: interna ? 'Operação interna' : 'Operação interestadual',
      perfil: perfil.perfil,
      perfilRotulo: perfilInfo.rotulo,
      perfilCurto: perfilInfo.curto,
      regime: perfilInfo.regime,
      modoDias: perfil.modoDias,
      modoDiasRotulo: MODOS_DIAS.find((modo) => modo.id === perfil.modoDias)?.rotulo ?? perfil.modoDias,
      diasFixo: perfil.diasFixo,
      tipoVeiculo: tipoVeiculo?.id ?? null,
      tipoVeiculoRotulo: tipoVeiculo?.rotulo ?? null,
      referenciaDiaria: tipoVeiculo
        ? { min: tipoVeiculo.min, base: tipoVeiculo.base, max: tipoVeiculo.max, kmDia: tipoVeiculo.kmDia }
        : null,
      aliquotaCbs: perfil.aliquotaCbs ?? null,
      aliquotaIbs: perfil.aliquotaIbs ?? null,
      creditoSimples,
      dasTotal: perfil.dasTotal,
      tipoOperacao,
      observacao: perfil.observacao ?? '',
      criadoEm: perfil.criadoEm ?? null,
      atualizadoEm: perfil.atualizadoEm ?? null,
    },
    contexto: {
      regimePagadora: {
        id: regime.id,
        rotulo: regime.rotulo,
        curto: regime.curto,
        creditaPisCofins: Boolean(regime.creditaPisCofins),
      },
      tipoOperacao,
      anoReferencia: Number(anoReferencia),
      anoHoje: Number(anoHoje),
      mesReferencia: Number(mesReferencia),
      mesAtual: Number(mesAtual),
    },
    calendario,
    meses,
    totais,
    anos,
    deveria,
    alertas: montarAlertas({ perfil, perfilInfo, anoBase, tipoVeiculo }),
    carga: {
      percentual: quatro(linhaRef?.carga ?? 0),
      percentuais: {
        icms: quatro(linhaRef?.icms ?? 0),
        pisCofins: quatro((linhaRef?.pis ?? 0) + (linhaRef?.cofins ?? 0)),
        cbsIbs: quatro((linhaRef?.cbs ?? 0) + (linhaRef?.ibs ?? 0)),
      },
    },
    notas: montarNotas({ perfil, perfilInfo, tipoOperacao, regime, anos, deveria }),
    fonte: taxas?.versaoBaseDados
      ? { baseDados: taxas.versaoBaseDados, projecao: true }
      : { baseDados: null, projecao: Boolean(taxas) },
  }
}

function montarDeveria({ perfil, perfilInfo, anos, meses, regime, tipoOperacao, anoReferencia, taxas }) {
  if (!taxas?.porAno) return null
  if (tipoOperacao === 'B2C') {
    return {
      disponivel: false,
      motivo: 'B2C: o pagador é o consumidor final e não aproveita crédito; a comparação é de preço, não de regime.',
    }
  }

  const linha = anos.find((item) => item.ano === Number(anoReferencia)) ?? anos[0] ?? null
  if (!linha) return null

  const regular = perfilPorId('REGIME_REGULAR')
  const creditoRegular = creditoDoAno({
    perfil: regular.id,
    regimePagadora: regime,
    tipoOperacao,
    ano: linha.ano,
    taxas: taxas.porAno.get(Number(linha.ano)),
    creditoSimples: null,
  })
  const calendarioAno = calendarioDoAno(linha.ano, perfil.modoDias, perfil.diasFixo)
  let liquidoRegular = 0
  for (const mes of calendarioAno.meses) {
    const brutoMes = arredondar(perfil.diaria * mes.dias)
    const creditoMes = arredondar((brutoMes * creditoRegular.percentual) / 100)
    liquidoRegular = arredondar(liquidoRegular + brutoMes - creditoMes)
  }
  const dias = linha.dias
  const creditoAtual = linha.percentualCredito

  const jaRegular = perfil.perfil === 'REGIME_REGULAR'
  if (jaRegular) {
    return {
      disponivel: true,
      jaRegular: true,
      ano: linha.ano,
      diariaAtual: perfil.diaria,
      diariaTeto: null,
      economiaMensal: 0,
      economiaAnual: 0,
      liquidoRegular,
      percentualCreditoRegular: quatro(creditoRegular.percentual),
      veredito:
        'Você já está no regime que transfere todo o crédito. Aqui o trabalho é negociar a diária, não trocar de regime.',
    }
  }

  const fator = creditoAtual >= 100 ? null : 100 / (100 - creditoAtual)
  const diariaTeto = fator === null || dias <= 0 ? null : arredondar((liquidoRegular / dias) * fator)
  const economiaAnual = arredondar(linha.liquido - liquidoRegular)
  const economiaMensal = arredondar(economiaAnual / 12)

  const mesesComEconomia = meses.map((mes) => {
    const creditoReg = arredondar((mes.bruto * creditoRegular.percentual) / 100)
    const liquidoReg = arredondar(mes.bruto - creditoReg)
    return {
      mes: mes.mes,
      curto: mes.curto,
      economia: arredondar(mes.liquido - liquidoReg),
    }
  })

  const maisBarato = economiaAnual <= 0.005
  return {
    disponivel: true,
    jaRegular: false,
    ano: linha.ano,
    diariaAtual: perfil.diaria,
    diariaTeto,
    percentualTeto: diariaTeto === null ? null : quatro((diariaTeto / perfil.diaria) * 100),
    economiaMensal,
    economiaAnual,
    liquidoRegular,
    percentualCreditoRegular: quatro(creditoRegular.percentual),
    percentualCreditoAtual: quatro(creditoAtual),
    meses: mesesComEconomia,
    veredito:
      diariaTeto === null
        ? 'Sem crédito neste regime, não há diária que empate com o regime regular.'
        : maisBarato
          ? 'Nesta diária, o seu custo já é menor que o de um transportador do regime regular no mesmo serviço.'
          : `No mesmo serviço, um transportador do regime regular custaria ${brlTexto(economiaMensal)} a menos por mês. Para empatar, a diária deveria cair para ${brlTexto(diariaTeto)}.`,
  }
}

function brlTexto(valor) {
  return `R$ ${formatarNumero(Number(valor) || 0)}`
}

function montarAlertas({ perfil, perfilInfo, anoBase, tipoVeiculo }) {
  const alertas = []

  if (tipoVeiculo) {
    const { min, base, max } = tipoVeiculo
    if (perfil.diaria < base * 0.4) {
      alertas.push({
        nivel: 'alto',
        titulo: 'Diária muito abaixo da referência',
        texto: `${brlTexto(perfil.diaria)} por dia é menos de 40% da referência de ${tipoVeiculo.rotulo} (${brlTexto(base)}). Se você digitou a diária de viagem do motorista ou o frete mensal, corrija antes de decidir.`,
      })
    } else if (perfil.diaria < min) {
      alertas.push({
        nivel: 'medio',
        titulo: 'Diária abaixo da faixa de referência',
        texto: `A faixa de ${tipoVeiculo.rotulo} é ${brlTexto(min)} a ${brlTexto(max)} por dia. O cálculo segue, mas confira se a diária inclui motorista, combustível e pedágio.`,
      })
    } else if (perfil.diaria > max) {
      alertas.push({
        nivel: 'medio',
        titulo: 'Diária acima da faixa de referência',
        texto: `A faixa de ${tipoVeiculo.rotulo} é ${brlTexto(min)} a ${brlTexto(max)} por dia. Valores altos são comuns em carga especial, exclusividade ou região com retorno escasso.`,
      })
    }
  }

  if (perfil.modoDias === 'FIXO' && Number(perfil.diasFixo) > 26 && perfilInfo.id !== 'AUTONOMO_MEI') {
    alertas.push({
      nivel: 'medio',
      titulo: '26 dias ou mais por mês',
      texto:
        'Com dois dias de repouso semanal (EC 141/2026, a partir de 16/12/2026), a semana útil do motorista empregado passa a ter 5 dias — o teto fica perto de 22 dias por mês. Use "dias úteis" ou confirme que o transportador é autônomo/MEI.',
    })
  }

  if (perfilInfo.id === 'AUTONOMO_MEI' && anoBase && anoBase.bruto > 251_600) {
    alertas.push({
      nivel: 'alto',
      titulo: 'Faturamento acima do limite do MEI',
      texto: `O faturamento anual do perfil é ${brlTexto(anoBase.bruto)}, acima do limite do MEI caminhoneiro (R$ 251.600,00 por ano, LC 123/2006, art. 18-F). Nesse volume o transportador não pode ser MEI: use Simples ou regime regular.`,
    })
  }

  return alertas
}

function montarNotas({ perfil, perfilInfo, tipoOperacao, regime, anos, deveria }) {
  const notas = [
    'A diária é o preço do dia: o mesmo valor por dia rende mais em meses com mais dias úteis.',
    'Feriados nacionais são descontados do calendário (Leis 662/1949, 6.802/1980 e 14.759/2023). Feriados estaduais, municipais e pontos facultativos não entram, exceto Carnaval e Sexta da Paixão no modo efetivo.',
  ]

  if (perfil.modoDias === 'CORRIDOS') {
    notas.push('Dias corridos incluem domingos e feriados: é o modo certo para diária de veículo parado ou contrato dedicado.')
  }
  if (perfil.ufOrigem === perfil.ufDestino) {
    notas.push('Operação interna: a projeção do regime anterior usa a alíquota interna padrão de 18% do motor; o ICMS interno varia por UF.')
  }
  if (perfilInfo.id === 'SIMPLES_DAS') {
    notas.push(
      creditoDoSimples(perfil) === null
        ? 'Simples/DAS sem a alíquota do PGDAS: o crédito usa a faixa setorial estimada, não o destaque real do DAS.'
        : 'Simples/DAS: o crédito é a alíquota efetiva do PGDAS, aplicada ao faturamento de cada mês.',
    )
  }
  if (perfilInfo.id === 'AUTONOMO_MEI') {
    notas.push('Autônomo/MEI: o crédito é uma faixa setorial estimada; o crédito presumido será definido em ato conjunto (art. 169 da LC 214/2025).')
  }
  if (perfilInfo.id === 'SIMPLES_HIBRIDO') {
    notas.push('Simples híbrido: só o CBS/IBS destacado no regime regular vira crédito; ICMS e PIS/COFINS ficam no DAS.')
  }
  if (regime && !regime.creditaPisCofins && perfilInfo.id === 'REGIME_REGULAR') {
    notas.push('Lucro Presumido: o PIS/COFINS cumulativo não gera crédito sobre o frete; o crédito é ICMS + CBS/IBS.')
  }
  if (tipoOperacao === 'B2C') {
    notas.push('B2C: sem crédito, o custo é o faturamento cheio em todos os meses.')
  }
  const primeiro = anos.find((linha) => linha.ano === 2026)
  if (primeiro && primeiro.percentualCredito === 0 && perfilInfo.regime === 'SIMPLES') {
    notas.push('Em 2026 não há crédito de CBS/IBS para optante do Simples (art. 348, III, "c", da LC 214/2025).')
  }
  if (deveria?.disponivel && !deveria.jaRegular && deveria.diariaTeto !== null) {
    notas.push(
      `A diária-teto (${formatarNumero(deveria.percentualTeto)}% da atual) empata o seu custo com o de um transportador do regime regular no mesmo serviço.`,
    )
  }
  return notas
}

/* ------------------------------------------------------------------ */
/* Resumo para a lista e para o comparador                             */
/* ------------------------------------------------------------------ */

/** Cartão curto do perfil, para a lista lateral (sem depender de motor). */
export function resumoDoPerfil(perfil) {
  const calendario = calendarioDoAno(2026, perfil.modoDias, perfil.diasFixo)
  return {
    id: perfil.id,
    nome: perfil.nome,
    diaria: perfil.diaria,
    ufOrigem: perfil.ufOrigem,
    ufDestino: perfil.ufDestino,
    rota: `${perfil.ufOrigem} → ${perfil.ufDestino}`,
    tipoRota: perfil.ufOrigem === perfil.ufDestino ? 'INTERNA' : 'INTERESTADUAL',
    perfil: perfil.perfil,
    perfilCurto: perfilPorId(perfil.perfil)?.curto ?? perfil.perfil,
    tipoVeiculo: perfil.tipoVeiculo ?? null,
    modoDias: perfil.modoDias,
    diasFixos: perfil.diasFixo,
    aliquotaCbs: perfil.aliquotaCbs ?? null,
    aliquotaIbs: perfil.aliquotaIbs ?? null,
    creditoSimples: creditoDoSimples(perfil),
    dasTotal: perfil.dasTotal ?? null,
    tipoOperacao: perfil.tipoOperacao ?? 'B2B',
    diasMedios: calendario.mediaMensal,
    brutoMensal: arredondar((perfil.diaria * calendario.totalDias) / 12),
    atualizadoEm: perfil.atualizadoEm ?? null,
    observacao: perfil.observacao ?? '',
  }
}
