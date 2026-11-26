/**
 * Frete Líquido — backend local.
 *
 * Serve a página única e expõe a API que conversa com o motor oficial da Receita.
 * Toda a apuração de CBS/IBS acontece no motor; aqui ficam apenas a validação de
 * entrada, a regra de crédito por regime e a montagem da memória de cálculo.
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ANO_REFERENCIA_REFORMA,
  ANOS,
  ANO_INICIO_SIMPLES,
  ANOS_REFORMA,
  ATIVIDADES_SIMPLES,
  NBS_FRETE,
  PERFIS,
  REGIMES,
  REGIMES_PAGADORA,
  TIPOS_OPERACAO,
  TABELA_TRANSICAO,
  UFS,
  atividadePorId,
  anoDaTabela,
  arredondar,
  avaliarCredito,
  faixaTexto,
  formatarNumero,
  perfilPorId,
  regimePagadoraPorId,
  rotuloAnoReforma,
  rotuloFase,
  ufPorSigla,
} from './domain.js'
import { construirHorizonte } from './pagador.js'
import {
  ANOS_PERFIL,
  LIMITES,
  MODOS_DIAS,
  REFERENCIA_DIARIA,
  TIPOS_VEICULO,
  PerfilInvalidoError,
  calcularPerfil,
  normalizarPerfil as normalizarPerfilTransportador,
  resumoDoPerfil,
  tipoVeiculoPorId,
} from './perfis.js'
import {
  atualizar as atualizarPerfil,
  criar as criarPerfil,
  listar as listarPerfis,
  obter as obterPerfil,
  remover as removerPerfil,
  restaurarExemplos,
  todos as todosOsPerfis,
} from './perfis-store.js'
import {
  MOTOR_URL,
  MOTOR_SIMPLES_URL,
  MotorError,
  calcularFrete,
  calcularFreteSimples,
  projetarFrete,
  taxasDoFretePorAno,
  verificarMotor,
  verificarMotorSimples,
} from './engine.js'

const PORTA = Number(process.env.PORT ?? 5180)
const HOST = process.env.HOST ?? '127.0.0.1'
const RAIZ = fileURLToPath(new URL('./', import.meta.url))
const PUBLICO = path.join(RAIZ, 'public')

const estado = {
  tabela: null,
  fonteAliquotas: 'tabela-local',
  motor: { online: false, url: MOTOR_URL },
  motorSimples: { online: false, url: MOTOR_SIMPLES_URL },
  desde: new Date(),
}

class HttpError extends Error {
  constructor(status, mensagem, detalhe = null) {
    super(mensagem)
    this.status = status
    this.detalhe = detalhe
  }
}

/* ------------------------------------------------------------------ */
/* Formatação e validação                                              */
/* ------------------------------------------------------------------ */

const brl = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0)

const pct = (valor, casas = 2) => `${formatarNumero(valor, casas)}%`

function numeroDeTexto(valor) {
  if (typeof valor === 'number') return valor
  let texto = String(valor ?? '').trim()
  if (!texto) return Number.NaN
  texto = texto.replace(/[R$\s]/g, '')
  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '')
  }
  return Number(texto)
}

function normalizarValor(valor, campo = 'valor do frete') {
  const n = numeroDeTexto(valor)
  if (!Number.isFinite(n) || n <= 0) {
    throw new HttpError(400, `Informe um ${campo} maior que zero.`)
  }
  if (n > 50_000_000) {
    throw new HttpError(400, `O ${campo} máximo aceito nesta simulação é R$ 50.000.000,00.`)
  }
  return arredondar(n)
}

function normalizarPercentual(valor, campo) {
  // A linha do PGDAS pode ter mais de 4 casas; preservamos o texto informado em
  // vez de arredondar, porque o motor do Simples usa todas as casas.
  const texto = String(valor ?? '')
    .trim()
    .replace(/[R$\s]/g, '')
    .replace(',', '.')
  const n = Number(texto)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new HttpError(400, `Informe ${campo} entre 0% e 100%.`)
  }
  return texto
}

function percentualOpcional(valor, campo, { min = 0, max = 100 } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null
  const texto = normalizarPercentual(valor, campo)
  const n = Number(texto)
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new HttpError(400, `Informe ${campo} entre ${min}% e ${max}%.`)
  }
  return n
}

function normalizarEntrada(entrada) {
  if (!entrada || typeof entrada !== 'object') {
    throw new HttpError(400, 'Envie os dados da simulação em JSON.')
  }

  const valorFrete = normalizarValor(entrada.valorFrete)
  const ano = Number(entrada.ano ?? 2033)
  if (!Number.isInteger(ano) || !anoDaTabela(ano)) {
    throw new HttpError(400, `Ano de referência inválido. Use ${ANOS.join(', ')}.`)
  }

  const perfil = perfilPorId(entrada.perfil ?? entrada.perfilTransportador)
  if (!perfil) {
    throw new HttpError(400, `Perfil de transportador desconhecido. Use ${PERFIS.map((p) => p.id).join(', ')}.`)
  }

  const regimePagadora = regimePagadoraPorId(entrada.regimePagadora ?? REGIMES_PAGADORA[0].id)
  if (!regimePagadora) {
    throw new HttpError(
      400,
      `Regime da pagadora desconhecido. Use ${REGIMES_PAGADORA.map((regime) => regime.id).join(', ')}.`,
    )
  }

  const tipoOperacao = String(entrada.tipoOperacao ?? 'B2B').trim().toUpperCase()
  if (!['B2B', 'B2C'].includes(tipoOperacao)) {
    throw new HttpError(400, 'Tipo de operação inválido. Use B2B ou B2C.')
  }

  const ufOrigem = ufPorSigla(entrada.ufOrigem ?? 'SP')
  if (!ufOrigem) throw new HttpError(400, 'UF de origem inválida.')
  const ufDestino = ufPorSigla(entrada.ufDestino ?? ufOrigem.sigla)
  if (!ufDestino) throw new HttpError(400, 'UF de destino inválida.')

  const atividade = atividadePorId(entrada.atividade ?? ATIVIDADES_SIMPLES[0].id)
  if (!atividade) {
    throw new HttpError(
      400,
      `Atividade do Simples inválida. Use ${ATIVIDADES_SIMPLES.map((item) => item.id).join(', ')}.`,
    )
  }

  const aliquotaCbsBruta = entrada.aliquotaCbs ?? entrada.aliquotasEfetivas?.cbs
  const aliquotaIbsBruta = entrada.aliquotaIbs ?? entrada.aliquotasEfetivas?.ibs
  const informouCbs = aliquotaCbsBruta !== undefined && aliquotaCbsBruta !== null && String(aliquotaCbsBruta).trim() !== ''
  const informouIbs = aliquotaIbsBruta !== undefined && aliquotaIbsBruta !== null && String(aliquotaIbsBruta).trim() !== ''

  if (informouCbs !== informouIbs) {
    throw new HttpError(400, 'Informe as duas alíquotas efetivas do PGDAS (CBS e IBS) ou deixe as duas em branco.')
  }

  const aliquotaCbs = informouCbs ? normalizarPercentual(aliquotaCbsBruta, 'a alíquota efetiva da CBS') : null
  const aliquotaIbs = informouIbs ? normalizarPercentual(aliquotaIbsBruta, 'a alíquota efetiva do IBS') : null

  // Dados opcionais do Simples para estimar o piso do transportador (margem
  // preservada). Sem eles, o horizonte mostra só o equilíbrio do pagador.
  const dasTotal = percentualOpcional(entrada.dasTotal, 'o DAS total', { min: 0, max: 30 })
  const insumos = percentualOpcional(entrada.insumos, 'a parcela de insumos', { min: 0, max: 100 })

  const avisos = []
  let fonteCredito = 'integral'

  if (perfil.id === 'SIMPLES_DAS') {
    if (informouCbs && ano >= ANO_INICIO_SIMPLES) {
      fonteCredito = 'simples'
    } else {
      fonteCredito = 'estimativa'
      if (informouCbs && ano < ANO_INICIO_SIMPLES) {
        avisos.push(
          `O motor do Simples Nacional só tem tabelas a partir de ${ANO_INICIO_SIMPLES}; em ${ano} o crédito usa a faixa setorial estimada.`,
        )
      } else if (!informouCbs) {
        avisos.push(
          'Sem as alíquotas efetivas do PGDAS, o crédito do Simples/DAS usa a faixa setorial estimada. Informe CBS e IBS para o cálculo real.',
        )
      }
    }
  } else if (perfil.id === 'AUTONOMO_MEI') {
    fonteCredito = 'estimativa'
  }

  let taxaCredito = null
  if (
    fonteCredito === 'estimativa' &&
    entrada.taxaCredito !== undefined &&
    entrada.taxaCredito !== null &&
    entrada.taxaCredito !== ''
  ) {
    taxaCredito = numeroDeTexto(entrada.taxaCredito)
    if (!Number.isFinite(taxaCredito)) {
      throw new HttpError(400, 'Taxa de crédito inválida.')
    }
  }

  return {
    valorFrete,
    ano,
    perfil,
    regimePagadora,
    tipoOperacao,
    ufOrigem,
    ufDestino,
    taxaCredito,
    aliquotaCbs,
    aliquotaIbs,
    dasTotal,
    insumos,
    atividade,
    fonteCredito,
    avisos,
  }
}

/* ------------------------------------------------------------------ */
/* Alíquotas de transição (fonte: motor, com fallback local)           */
/* ------------------------------------------------------------------ */

async function carregarTabela({ forcar = false } = {}) {
  if (estado.tabela && !forcar) return estado.tabela

  const [motor, motorSimples] = await Promise.all([verificarMotor(), verificarMotorSimples()])
  const tabela = structuredClone(TABELA_TRANSICAO)
  let fonte = 'tabela-local'

  if (motor.online && Array.isArray(motor.parametrosTransicao) && motor.parametrosTransicao.length > 0) {
    for (const parametro of motor.parametrosTransicao) {
      if (tabela[parametro.ano]) {
        tabela[parametro.ano] = {
          ...tabela[parametro.ano],
          cbs: Number(parametro.cbs),
          ibsUf: Number(parametro.ibsUf),
          ibsMun: Number(parametro.ibsMun),
          fase: parametro.fase ?? tabela[parametro.ano].fase,
          rotulo: parametro.rotulo ?? tabela[parametro.ano].rotulo,
        }
      }
    }
    fonte = 'motor'
  }

  estado.tabela = tabela
  estado.fonteAliquotas = fonte
  estado.motor = motor
  estado.motorSimples = motorSimples
  return tabela
}

/* ------------------------------------------------------------------ */
/* Simulação                                                           */
/* ------------------------------------------------------------------ */

async function simular(entrada) {
  const dados = normalizarEntrada(entrada)
  const tabela = await carregarTabela()
  const aliquotas = tabela[dados.ano]

  let motor
  if (dados.fonteCredito === 'simples') {
    motor = await calcularFreteSimples({
      valorFrete: dados.valorFrete,
      ano: dados.ano,
      atividade: dados.atividade.id,
      aliquotaCbs: dados.aliquotaCbs,
      aliquotaIbs: dados.aliquotaIbs,
    })
    motor.fonte = 'simples-nacional'
    motor.nome = 'Motor do Simples Nacional'
    motor.url = MOTOR_SIMPLES_URL
    motor.rotuloOperacao = `CT-e tpDoc 57 · CRT 1 · atividade ${dados.atividade.id} · cClassTrib 000001 · NBS ${NBS_FRETE}`
  } else {
    motor = await calcularFrete({
      valorFrete: dados.valorFrete,
      ano: dados.ano,
      uf: dados.ufDestino.sigla,
      municipio: dados.ufDestino.municipio,
      aliquotas,
    })
    motor.fonte = 'regime-regular'
    motor.nome = 'Motor oficial (regime regular)'
    motor.url = MOTOR_URL
    motor.rotuloOperacao = `CT-e NBS ${NBS_FRETE} · CST 000 · cClassTrib 000001`
  }

  let avaliacao
  try {
    avaliacao = avaliarCredito({
      valorFrete: dados.valorFrete,
      perfil: dados.perfil,
      destaque: motor.destaque,
      tipoOperacao: dados.tipoOperacao,
      taxaInformada: dados.taxaCredito,
      ano: dados.ano,
      fonteCredito: dados.fonteCredito,
    })
  } catch (erro) {
    throw new HttpError(400, erro.message)
  }

  if (motor.headers.aplicacao) {
    if (motor.fonte === 'simples-nacional') {
      estado.motorSimples.online = true
      estado.motorSimples.versao = motor.headers.aplicacao
      estado.motorSimples.baseDados = motor.headers.baseDados ?? estado.motorSimples.baseDados
    } else {
      estado.motor.online = true
      estado.motor.versao = motor.headers.aplicacao
      estado.motor.baseDados = motor.headers.baseDados ?? estado.motor.baseDados
    }
  }

  const percentualDestaque = (motor.destaque / dados.valorFrete) * 100
  const aliquotaIbs =
    motor.fonte === 'simples-nacional' ? motor.aliquotaIbs : motor.aliquotaIbsUf + motor.aliquotaIbsMun
  const aliquotaTotal = motor.aliquotaCbs + aliquotaIbs

  // Crédito dos tributos do regime anterior (ICMS e PIS/COFINS) que o pagador
  // ainda credita no ano. Só existe no regime regular e em B2B: o transportador
  // optante do Simples recolhe ICMS/PIS/COFINS no DAS e não os destaca no CT-e.
  const tipoOperacaoFrete = dados.ufOrigem.sigla === dados.ufDestino.sigla ? 'INTERNA' : 'INTERESTADUAL'
  let creditoIcms = 0
  let creditoPisCofins = 0
  let fonteAntigos = null
  if (dados.perfil.id === 'REGIME_REGULAR' && dados.tipoOperacao === 'B2B') {
    try {
      const taxas = await taxasDoFretePorAno({
        ufOrigem: dados.ufOrigem.sigla,
        ufDestino: dados.ufDestino.sigla,
        tipoOperacao: tipoOperacaoFrete,
      })
      const doAno = taxas.porAno.get(dados.ano)
      if (doAno) {
        fonteAntigos = taxas.versaoBaseDados ?? null
        creditoIcms = arredondar((dados.valorFrete * doAno.icms) / 100)
        creditoPisCofins = dados.regimePagadora.creditaPisCofins
          ? arredondar((dados.valorFrete * (doAno.pis + doAno.cofins)) / 100)
          : 0
      }
    } catch (erro) {
      dados.avisos.push(
        `Não foi possível somar o crédito de ICMS/PIS/COFINS da projeção do frete (${erro.message}); o cartão mostra só o CBS/IBS.`,
      )
    }
  }
  const creditoAntigos = arredondar(creditoIcms + creditoPisCofins)
  const creditoTotal = arredondar(avaliacao.credito + creditoAntigos)
  const custoTotal = arredondar(dados.valorFrete - creditoTotal)
  const percentualCreditoTotal = dados.valorFrete ? Number(((creditoTotal / dados.valorFrete) * 100).toFixed(4)) : 0
  const percentualCustoTotal = dados.valorFrete ? Number(((custoTotal / dados.valorFrete) * 100).toFixed(4)) : 0

  return {
    entrada: {
      valorFrete: dados.valorFrete,
      ano: dados.ano,
      fase: aliquotas.fase,
      perfil: {
        id: dados.perfil.id,
        rotulo: dados.perfil.rotulo,
        curto: dados.perfil.curto,
        estimativa: dados.perfil.estimativa,
        fonteCredito: avaliacao.fonteCredito,
        requerAliquotas: Boolean(dados.perfil.requerAliquotas),
        faixa:
          avaliacao.fonteCredito === 'estimativa' ? faixaTexto(dados.perfil) : 'crédito integral do destaque',
        descricao: dados.perfil.descricao,
      },
      tipoOperacao: dados.tipoOperacao,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      ufDestinoNome: dados.ufDestino.nome,
      municipioDestino: dados.ufDestino.municipio,
      taxaCredito: avaliacao.taxaAplicada,
      aliquotaCbs: dados.aliquotaCbs,
      aliquotaIbs: dados.aliquotaIbs,
      atividade: dados.atividade.id,
      atividadeRotulo: dados.atividade.rotulo,
      rota: `${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}`,
    },
    motor: {
      fonte: motor.fonte,
      nome: motor.nome,
      url: motor.url,
      rotuloOperacao: motor.rotuloOperacao,
      status: motor.status,
      versao: motor.headers.aplicacao,
      baseDados: motor.headers.baseDados,
      avisoSimulado: motor.headers.avisoSimulado,
      calculoSimulado: motor.calculoSimulado,
      requisicao: motor.operacao,
      resposta: motor.resposta,
      textoBruto: motor.texto,
      memoriaCalculo: motor.memoriaCalculo,
      resolucaoAliquotas: motor.resolucaoAliquotas ?? null,
      aliquota: {
        cbs: motor.aliquotaCbs,
        ibs: aliquotaIbs,
        ibsUf: motor.aliquotaIbsUf,
        ibsMun: motor.aliquotaIbsMun,
        total: aliquotaTotal,
      },
      reducao: motor.reducao,
      vBC: motor.vBC,
      vCBS: motor.vCBS,
      vIBS: motor.vIBS,
      vIBSUf: motor.vIBSUf,
      vIBSMun: motor.vIBSMun,
      destaque: motor.destaque,
      percentualDestaque: Number(percentualDestaque.toFixed(4)),
      creditoPresumido: motor.creditoPresumido,
      fase: aliquotas.fase,
      faseRotulo: aliquotas.rotulo,
      parametros: {
        cbs: aliquotas.cbs,
        ibsUf: aliquotas.ibsUf,
        ibsMun: aliquotas.ibsMun,
        fonte: estado.fonteAliquotas,
      },
    },
    resultado: {
      credito: creditoTotal,
      creditoCbsIbs: avaliacao.credito,
      creditoAntigos: {
        icms: creditoIcms,
        pisCofins: creditoPisCofins,
        total: creditoAntigos,
        fonte: fonteAntigos,
      },
      creditoTotal,
      percentualCreditoTotal,
      percentualCreditoCbsIbs: avaliacao.percentualCredito,
      custoTotal,
      percentualCustoTotal,
      percentualCredito: percentualCreditoTotal,
      custoLiquido: custoTotal,
      custoLiquidoCbsIbs: avaliacao.custoLiquido,
      creditoPerdido: avaliacao.creditoPerdido,
      limitadoAoTeto: avaliacao.limitadoAoTeto,
      fonteCredito: avaliacao.fonteCredito,
      creditoIntegral: avaliacao.creditoIntegral,
      faixa: avaliacao.faixa,
      alerta: avaliacao.alerta,
      notas: avaliacao.notas,
    },
    memoria: montarMemoria({
      dados,
      motor,
      avaliacao,
      aliquotas,
      percentualDestaque,
      aliquotaIbs,
      creditoIcms,
      creditoPisCofins,
      creditoTotal,
      custoTotal,
    }),
    premissas: montarPremissas({ dados, motor, aliquotas, avaliacao }),
    avisos: dados.avisos,
  }
}

function montarMemoria({
  dados,
  motor,
  avaliacao,
  aliquotas,
  percentualDestaque,
  aliquotaIbs,
  creditoIcms = 0,
  creditoPisCofins = 0,
  creditoTotal = 0,
  custoTotal = 0,
}) {
  const passos = [
    {
      rotulo: 'Preço nominal do frete',
      valor: brl(dados.valorFrete),
      nota: 'O valor cobrado pela transportadora, sem considerar crédito.',
    },
  ]

  if (motor.fonte === 'simples-nacional') {
    passos.push({
      rotulo: `CBS/IBS do Simples · ${dados.ano}`,
      valor: brl(motor.destaque),
      nota: `${pct(percentualDestaque)} do frete — CBS ${brl(motor.vCBS)} (${pct(motor.aliquotaCbs)}) + IBS ${brl(motor.vIBS)} (${pct(motor.aliquotaIbs)}). Alíquotas efetivas do PGDAS, atividade ${dados.atividade.id} (Anexo III).`,
    })
  } else {
    passos.push({
      rotulo: `CBS/IBS destacado pelo motor · ${dados.ano}`,
      valor: brl(motor.destaque),
      nota: `${pct(percentualDestaque)} do frete — CBS ${brl(motor.vCBS)} (${pct(motor.aliquotaCbs)}) + IBS ${brl(motor.vIBS)} (${pct(aliquotaIbs)}). ${rotuloFase(aliquotas.fase).replace(/^./, (letra) => letra.toUpperCase())}.`,
    })
  }

  const creditoTeorico =
    avaliacao.fonteCredito === 'estimativa'
      ? Math.min(arredondar((dados.valorFrete * (avaliacao.taxaAplicada ?? 0)) / 100), motor.destaque)
      : motor.destaque
  const percentualTeorico = avaliacao.fonteCredito === 'estimativa' ? avaliacao.taxaAplicada : percentualDestaque

  if (dados.tipoOperacao === 'B2C') {
    passos.push({
      rotulo: 'Crédito aproveitável em B2C',
      valor: brl(0),
      nota: `O regime geraria ${brl(creditoTeorico)} de crédito (${pct(percentualTeorico)} do frete), mas o pagador é o consumidor final e não aproveita CBS/IBS.`,
    })
  } else if (avaliacao.fonteCredito === 'simples') {
    passos.push({
      rotulo: 'Crédito do Simples Nacional',
      valor: brl(avaliacao.credito),
      nota: 'O destaque apurado pelo motor do Simples com as alíquotas do PGDAS é transferido integralmente ao tomador.',
    })
  } else if (avaliacao.fonteCredito === 'integral' && dados.perfil.id === 'SIMPLES_HIBRIDO') {
    passos.push({
      rotulo: 'Crédito do Simples híbrido',
      valor: brl(avaliacao.credito),
      nota:
        Number(dados.ano) === 2026
          ? 'Em 2026 o destaque de 1,00% é compensado pelo transportador e não gera crédito ao adquirente (art. 348 da LC 214/2025); o ICMS e o PIS/COFINS do optante ficam no DAS.'
          : 'O transportador optou por recolher CBS/IBS no regime regular; o destaque cheio do CT-e é creditado integralmente. O ICMS e o PIS/COFINS ficam no DAS.',
    })
  } else if (avaliacao.fonteCredito === 'integral') {
    passos.push({
      rotulo: 'Crédito do regime regular',
      valor: brl(avaliacao.credito),
      nota:
        Number(dados.ano) === 2026
          ? 'Em 2026 o CBS/IBS de 1,00% é compensado pelo transportador e não gera crédito ao adquirente (art. 348 da LC 214/2025); o crédito do ano é ICMS + PIS/COFINS.'
          : 'O destaque do motor é transferido integralmente ao tomador.',
    })
  } else {
    passos.push({
      rotulo: `Crédito do regime · ${pct(avaliacao.taxaAplicada)} do frete`,
      valor: brl(avaliacao.credito),
      nota: avaliacao.limitadoAoTeto
        ? `Estimativa limitada ao destaque do ano: ${brl(motor.destaque)}.`
        : `Estimativa dentro da faixa de ${faixaTexto(dados.perfil)} do frete, abaixo do destaque de ${brl(motor.destaque)}.`,
    })
  }

  passos.push({
    rotulo: 'Crédito não aproveitado',
    valor: brl(avaliacao.creditoPerdido),
    nota:
      dados.tipoOperacao === 'B2C'
        ? 'Todo o destaque fica no custo: em B2C não há crédito para o adquirente.'
        : avaliacao.creditoPerdido > 0
          ? 'Parte do CBS/IBS destacado fica no custo: o transportador não transfere esse crédito.'
          : 'Todo o destaque do documento é aproveitado pelo pagador.',
  })

  if (creditoIcms > 0 || creditoPisCofins > 0) {
    passos.push({
      rotulo: `Crédito de ICMS e PIS/COFINS · ${dados.ano}`,
      valor: brl(arredondar(creditoIcms + creditoPisCofins)),
      nota: `${creditoIcms > 0 ? `ICMS ${brl(creditoIcms)}` : ''}${creditoIcms > 0 && creditoPisCofins > 0 ? ' + ' : ''}${creditoPisCofins > 0 ? `PIS/COFINS ${brl(creditoPisCofins)}` : ''} — tributos do regime anterior destacados no CT-e e creditados pelo pagador. ${dados.regimePagadora.id === 'CUMULATIVO' ? 'No Lucro Presumido não há crédito de PIS/COFINS.' : 'PIS/COFINS não cumulativo (1,65% + 7,60%).'}`,
    })
  }

  passos.push({
    rotulo: 'Custo líquido total',
    valor: brl(custoTotal),
    nota: `${brl(dados.valorFrete)} − ${brl(creditoTotal)} de crédito total (CBS/IBS ${brl(avaliacao.credito)}${creditoIcms > 0 || creditoPisCofins > 0 ? ` + ICMS/PIS/COFINS ${brl(arredondar(creditoIcms + creditoPisCofins))}` : ''}). É o número que compara transportadoras.`,
    destaque: true,
  })

  return passos
}

function montarPremissas({ dados, motor, aliquotas, avaliacao }) {
  const lista = []

  if (motor.fonte === 'simples-nacional') {
    lista.push(
      `CBS/IBS apurados pelo Motor do Simples Nacional (calculadora-rtc-simples-nacional): CT-e tpDoc 57, CRT 1, atividade ${dados.atividade.id}, cClassTrib 000001, NBS ${NBS_FRETE}, competência ${dados.ano}-06.`,
    )
    lista.push(
      `Alíquotas efetivas do PGDAS informadas: CBS ${pct(motor.aliquotaCbs)} e IBS ${pct(motor.aliquotaIbs)}. O motor aplica o par do Anexo III e apura base, reduções e valores.`,
    )
  } else {
    lista.push(
      `Cálculo de CBS/IBS feito pelo motor oficial da Receita (regime regular): item de CT-e NBS ${NBS_FRETE}, CST 000, cClassTrib 000001, competência ${dados.ano}-06.`,
    )
    lista.push(
      `Alíquotas nominais de ${dados.ano} (CBS ${pct(aliquotas.cbs)}, IBS UF ${pct(aliquotas.ibsUf)}, IBS município ${pct(aliquotas.ibsMun)}) informadas ao motor, que apura base, reduções e valores.`,
    )
  }

  lista.push(
    `Rota ${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}; o IBS municipal usa o município de referência ${dados.ufDestino.nome} (IBGE ${dados.ufDestino.municipio}).`,
  )
  lista.push(
    'Crédito do pagador = CBS/IBS destacado (a partir de 2027) + ICMS e PIS/COFINS do documento no regime regular; cada parcela é limitada ao tributo destacado.',
  )
  if (Number(dados.ano) === 2026) {
    lista.push(
      'Em 2026 o CBS/IBS de 1,00% é compensado pelo transportador e não gera crédito ao adquirente (LC 214/2025, art. 348, I); o crédito do ano é ICMS + PIS/COFINS.',
    )
  }

  if (avaliacao.fonteCredito === 'estimativa') {
    lista.push(
      'A regra de crédito do regime (faixa setorial) é uma estimativa e está sinalizada como tal — não substitui a apuração fiscal.',
    )
  }
  if (avaliacao.fonteCredito === 'simples') {
    lista.push('O crédito do Simples é o destaque apurado pelo motor, sem estimativa setorial.')
  }
  if (dados.perfil.id === 'SIMPLES_HIBRIDO') {
    lista.push(
      'Simples híbrido: o transportador optou por recolher CBS/IBS no regime regular; o destaque cheio do CT-e é integralmente creditado.',
    )
  }
  if (dados.tipoOperacao === 'B2C') {
    lista.push('B2C: o pagador é o consumidor final e não aproveita o crédito; o custo líquido é o preço.')
  }
  if (avaliacao.limitadoAoTeto) {
    lista.push('O crédito estimado do regime excedeu o destaque do ano e foi truncado no teto apurado pelo motor.')
  }
  if (estado.motor.online) {
    lista.push(`Motor regular em ${MOTOR_URL} · API ${estado.motor.versao ?? '—'} · base ${estado.motor.baseDados ?? '—'}.`)
  }
  if (estado.motorSimples.online) {
    lista.push(
      `Motor do Simples em ${MOTOR_SIMPLES_URL} · API ${estado.motorSimples.versao ?? '—'} · base ${estado.motorSimples.baseDados ?? '—'}.`,
    )
  }

  return lista
}

/* ------------------------------------------------------------------ */
/* Comparador                                                          */
/* ------------------------------------------------------------------ */

async function comparar(entrada) {
  const cenarios = entrada?.transportadoras ?? entrada?.cenarios
  if (!Array.isArray(cenarios) || cenarios.length < 2) {
    throw new HttpError(400, 'Informe pelo menos duas transportadoras para comparar.')
  }
  if (cenarios.length > 3) {
    throw new HttpError(400, 'A comparação aceita no máximo três transportadoras.')
  }

  const base = {
    ano: entrada.ano ?? 2033,
    tipoOperacao: entrada.tipoOperacao ?? 'B2B',
    regimePagadora: entrada.regimePagadora ?? REGIMES_PAGADORA[0].id,
    ufOrigem: entrada.ufOrigem ?? 'SP',
    ufDestino: entrada.ufDestino ?? 'BA',
  }
  const anoHoje = Math.min(2033, Math.max(2026, new Date().getFullYear()))

  const avaliadas = await Promise.all(
    cenarios.map(async (cenario, indice) => {
      const nome = String(cenario?.nome ?? '').trim().slice(0, 80) || `Transportadora ${indice + 1}`
      const comum = {
        ...base,
        valorFrete: cenario?.preco ?? cenario?.valorFrete,
        perfil: cenario?.perfil ?? cenario?.perfilTransportador,
        taxaCredito: cenario?.taxaCredito,
        aliquotaCbs: cenario?.aliquotaCbs ?? cenario?.aliquotasEfetivas?.cbs,
        aliquotaIbs: cenario?.aliquotaIbs ?? cenario?.aliquotasEfetivas?.ibs,
        atividade: cenario?.atividade,
      }
      const [simulacao, simulacaoHoje] = await Promise.all([
        simular(comum),
        simular({ ...comum, ano: anoHoje }),
      ])
      return { nome, simulacao, simulacaoHoje }
    }),
  )

  const ordenadas = [...avaliadas].sort((a, b) => {
    const diferenca = a.simulacao.resultado.custoTotal - b.simulacao.resultado.custoTotal
    if (Math.abs(diferenca) > 0.005) return diferenca
    return a.simulacao.entrada.valorFrete - b.simulacao.entrada.valorFrete
  })

  const menorLiquido = ordenadas[0].simulacao.resultado.custoTotal
  const maiorLiquido = ordenadas[ordenadas.length - 1].simulacao.resultado.custoTotal

  const ranking = ordenadas.map((item, indice) => {
    const simulacao = item.simulacao
    const resultado = simulacao.resultado
    const resultadoHoje = item.simulacaoHoje.resultado
    const liquidoHoje = resultadoHoje.custoTotal
    const creditoHoje = resultadoHoje.percentualCreditoTotal
    const creditoAno = resultado.percentualCreditoTotal
    const precoEquilibrio =
      creditoAno < 100 ? arredondar(liquidoHoje / (1 - creditoAno / 100)) : null
    return {
      posicao: indice + 1,
      nome: item.nome,
      perfil: simulacao.entrada.perfil,
      valorFrete: simulacao.entrada.valorFrete,
      credito: resultado.credito,
      percentualCredito: resultado.percentualCredito,
      creditoTotal: resultado.creditoTotal,
      percentualCreditoTotal: resultado.percentualCreditoTotal,
      percentualCreditoCbsIbs: resultado.percentualCreditoCbsIbs,
      creditoAntigos: resultado.creditoAntigos,
      custoLiquido: resultado.custoLiquido,
      custoTotal: resultado.custoTotal,
      diferencaParaMelhor: arredondar(resultado.custoTotal - menorLiquido),
      fonteCredito: resultado.fonteCredito,
      creditoIntegral: resultado.creditoIntegral,
      alerta: resultado.alerta,
      simulacao,
      // Leitura "hoje → ano escolhido": o preço travado é o nominal que a
      // transportadora já cobra; o preço de equilíbrio é o que manteria o
      // líquido de hoje com o crédito do ano escolhido.
      hoje: {
        bruto: item.simulacaoHoje.entrada.valorFrete,
        credito: resultadoHoje.creditoTotal,
        percentualCredito: creditoHoje,
        liquido: liquidoHoje,
      },
      precoTravado: simulacao.entrada.valorFrete,
      liquidoTravado: resultado.custoTotal,
      precoEquilibrio,
      liquidoEquilibrio: liquidoHoje,
      variacaoPreco:
        precoEquilibrio === null
          ? null
          : Number((((precoEquilibrio - simulacao.entrada.valorFrete) / simulacao.entrada.valorFrete) * 100).toFixed(2)),
      variacaoLiquidoTravado:
        liquidoHoje > 0 ? Number((((resultado.custoTotal - liquidoHoje) / liquidoHoje) * 100).toFixed(2)) : null,
    }
  })

  const precos = ranking.map((item) => item.valorFrete)
  const precoIgual = precos.every((preco) => Math.abs(preco - precos[0]) < 0.005)
  const vencedor = ranking[0]
  const economia = arredondar(maiorLiquido - menorLiquido)

  const menorPreco = [...ranking].sort((a, b) => a.valorFrete - b.valorFrete)[0]
  const inverteOrdem = menorPreco.nome !== vencedor.nome

  let resumo
  if (precoIgual) {
    resumo = `Os ${ranking.length} fretes custam ${brl(precos[0])} no nominal. Depois de todo o crédito (ICMS, PIS/COFINS e CBS/IBS), ${vencedor.nome} sai por ${brl(vencedor.custoTotal)} — ${brl(economia)} a menos que ${ranking[ranking.length - 1].nome}.`
  } else {
    resumo = `${vencedor.nome} tem o menor custo líquido total: ${brl(vencedor.custoTotal)}, ${brl(economia)} abaixo do pior cenário.`
  }

  return {
    entrada: {
      ano: ranking[0].simulacao.entrada.ano,
      anoHoje,
      tipoOperacao: ranking[0].simulacao.entrada.tipoOperacao,
      ufOrigem: ranking[0].simulacao.entrada.ufOrigem,
      ufDestino: ranking[0].simulacao.entrada.ufDestino,
      rota: ranking[0].simulacao.entrada.rota,
    },
    ranking,
    vencedor: vencedor.nome,
    economia,
    precoIgual,
    inverteOrdem,
    resumo,
    aviso:
      'A ordem usa o custo líquido pós-crédito, não o preço nominal. Um frete mais caro pode ser mais barato depois do crédito.',
  }
}

/* ------------------------------------------------------------------ */
/* Antes e depois da reforma (2025–2033)                               */
/* ------------------------------------------------------------------ */

const ANO_FIM_SERIE = 2033

function percentualDe(valor, base) {
  const numerador = Number(valor) || 0
  const denominador = Number(base) || 0
  if (!denominador) return 0
  return Number(((numerador / denominador) * 100).toFixed(4))
}

function arredondarCasas(valor, casas = 2) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  const fator = 10 ** casas
  return Math.round((n + Number.EPSILON) * fator) / fator
}

/**
 * Rede de segurança para motores sem o módulo de projeção: apura o CBS/IBS de
 * cada ano no endpoint oficial de cálculo, sem os tributos do regime anterior.
 */
async function apurarCbsIbsPorAno({ dados, tabela }) {
  const anos = ANOS_REFORMA.filter((ano) => ano >= 2026)
  const resultados = await Promise.allSettled(
    anos.map(async (ano) => {
      const aliquotas = ano >= 2027 ? tabela[ano] : null
      const calculo = await calcularFrete({
        valorFrete: dados.valorFrete,
        ano,
        uf: dados.ufDestino.sigla,
        municipio: dados.ufDestino.municipio,
        aliquotas,
      })
      return { ano, calculo }
    }),
  )

  const porAno = new Map()
  const falhas = []
  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      porAno.set(anos[indice], resultado.value.calculo)
    } else {
      falhas.push(anos[indice])
    }
  })
  return { porAno, falhas }
}

function faseDaSerie(ano, tabela, projecao) {
  if (ano === ANO_REFERENCIA_REFORMA) return 'REFERENCIA'
  return tabela[ano]?.fase ?? projecao?.fase ?? 'TRANSICAO'
}

function rotuloDaSerie(ano, tabela, projecao) {
  if (ano === ANO_REFERENCIA_REFORMA) return 'Antes da reforma'
  return tabela[ano]?.rotulo ?? projecao?.rotulo ?? rotuloAnoReforma(ano)
}

function observacaoDoAno({ ano, modelo, percentualSimples, taxaEstimativa }) {
  if (ano === ANO_REFERENCIA_REFORMA) {
    return modelo === 'simples-motor' || modelo === 'hibrido'
      ? 'Antes da reforma não havia CBS/IBS destacado: o optante recolhia tudo no DAS.'
      : 'Regime anterior: ICMS + PIS/COFINS (não cumulativo) sobre o frete.'
  }
  if (ano === 2026) return 'Fase de teste: CBS 0,90% + IBS 0,10%, compensáveis com PIS/COFINS e ICMS.'
  if (ano === 2027) {
    if (modelo === 'simples-motor') {
      return percentualSimples
        ? `Alíquotas efetivas do PGDAS: ${formatarNumero(percentualSimples, 4)}% do frete.`
        : 'CBS/IBS dentro do DAS com a linha do PGDAS informada.'
    }
    if (modelo === 'estimativa') return `Faixa setorial estimada em ${formatarNumero(taxaEstimativa)}% do frete.`
    if (modelo === 'hibrido') return 'CBS cheia fora do DAS; o ICMS do optante segue no DAS.'
    return 'PIS/COFINS extintos e CBS cheia; o ICMS segue integral até 2028.'
  }
  if (ano === 2033) {
    if (modelo === 'simples-motor') return 'Regime pleno: o CBS/IBS do DAS continua sendo a única parcela transferível.'
    if (modelo === 'estimativa') return 'Regime pleno: a faixa setorial não acompanha os 27,00% do regime regular.'
    if (modelo === 'hibrido') return 'Regime pleno: 27,00% de CBS/IBS, sem ICMS; converge com o regime regular.'
    return 'Regime pleno: CBS 8,50% + IBS 18,50%, sem ICMS/PIS/COFINS.'
  }
  return 'Transição do IBS: o ICMS cai ano a ano e o IBS sobe na mesma proporção.'
}

function notasDaSerie({ modelo, projecao, percentualSimples, taxaEstimativa }) {
  const itemProjecao = (ano) => projecao?.notas?.find((nota) => nota.ano === ano) ?? null

  if (modelo === 'regular') {
    const anos = [2026, 2027, 2029, 2033]
    const notas = anos
      .map((ano) => {
        const item = itemProjecao(ano)
        if (!item?.resumo) return null
        return {
          ano,
          titulo: item.rotulo ?? rotuloAnoReforma(ano),
          texto: item.resumo,
          comparacao: item.comparacaoMetodoAnterior,
          detalhe: item.mudancas?.length ? item.mudancas : null,
          fundamento: item.fundamento,
        }
      })
      .filter(Boolean)
    if (notas.length) return notas

    return [
      {
        ano: 2026,
        titulo: 'Fase de teste',
        texto: 'CBS 0,90% + IBS 0,10%, compensáveis com PIS/COFINS e ICMS: a carga econômica ainda é a do regime anterior.',
        comparacao: null,
        detalhe: null,
        fundamento: 'ADCT (EC 132/2023), art. 125.',
      },
      {
        ano: 2027,
        titulo: 'CBS cheia, IBS em teste',
        texto: 'O PIS/COFINS sai e a CBS entra integral; o ICMS continua sendo cobrado até 2032.',
        comparacao: null,
        detalhe: null,
        fundamento: 'ADCT (EC 132/2023) e LC 214/2025.',
      },
      {
        ano: 2029,
        titulo: 'Transição do IBS',
        texto: 'O IBS sobe ano a ano e o ICMS cai na mesma proporção; no regime pleno só restam CBS e IBS.',
        comparacao: null,
        detalhe: null,
        fundamento: 'ADCT (EC 132/2023), art. 128.',
      },
      {
        ano: 2033,
        titulo: 'Regime pleno',
        texto: 'CBS 8,50% + IBS 18,50% = 27,00% do frete, sem ICMS/PIS/COFINS.',
        comparacao: null,
        detalhe: null,
        fundamento: 'ADCT (EC 132/2023), arts. 128 e 129.',
      },
    ]
  }

  const percentual = percentualSimples ?? taxaEstimativa
  const base =
    modelo === 'hibrido'
      ? [
          {
            ano: 2026,
            titulo: 'Fase de teste',
            texto: 'O CBS/IBS de 1,00% é destacado fora do DAS e compensado com PIS/COFINS e ICMS.',
            fundamento: 'ADCT (EC 132/2023), art. 125.',
          },
          {
            ano: 2027,
            titulo: 'CBS cheia fora do DAS',
            texto: 'O híbrido passa a destacar CBS 8,40% + IBS 0,10% e transfere 100% desse crédito; o ICMS segue no DAS.',
            fundamento: 'LC 214/2025 — opção pelo regime regular do CBS/IBS.',
          },
          {
            ano: 2029,
            titulo: 'Transição do IBS',
            texto: 'O IBS sobe para 1,85% e o ICMS cai 10%; no híbrido, só o CBS/IBS destacado vira crédito.',
            fundamento: 'ADCT (EC 132/2023), art. 128.',
          },
          {
            ano: 2033,
            titulo: 'Regime pleno',
            texto: 'CBS 8,50% + IBS 18,50%: o crédito do híbrido converge com o do regime regular, e o ICMS deixa de existir.',
            fundamento: 'ADCT (EC 132/2023), arts. 128 e 129.',
          },
        ]
      : [
          {
            ano: 2026,
            titulo: 'Fase de teste',
            texto: 'O CBS/IBS dentro do DAS é de 1,00% e compensável com PIS/COFINS e ICMS.',
            fundamento: 'ADCT (EC 132/2023), art. 125.',
          },
          {
            ano: 2027,
            titulo: modelo === 'simples-motor' ? 'Alíquota efetiva do PGDAS' : 'Faixa setorial estimada',
            texto:
              modelo === 'simples-motor'
                ? `O motor do Simples aplica a linha do PGDAS informada: ${formatarNumero(percentual, 4)}% do frete.`
                : `Sem as alíquotas do PGDAS, a linha do tempo usa ${formatarNumero(percentual)}% do frete como faixa setorial estimada.`,
            fundamento: 'LC 123/2006 e LC 214/2025 — CBS/IBS dentro do DAS.',
          },
          {
            ano: 2029,
            titulo: 'Transição do IBS',
            texto: 'O ICMS cai dentro do DAS e o IBS sobe; o CBS/IBS do Simples continua na linha do PGDAS.',
            fundamento: 'ADCT (EC 132/2023), art. 128.',
          },
          {
            ano: 2033,
            titulo: 'Regime pleno',
            texto: `No regime pleno o crédito transferível é o CBS/IBS do DAS (${formatarNumero(percentual, 2)}%), não os 27,00% do regime regular.`,
            fundamento: 'ADCT (EC 132/2023), arts. 128 e 129.',
          },
        ]

  return base.map((nota) => ({
    ...nota,
    comparacao: null,
    detalhe: null,
  }))
}

async function reforma(entrada) {
  const dados = normalizarEntrada(entrada)
  const tabela = await carregarTabela()
  const avisos = [...dados.avisos]
  const perfil = dados.perfil
  const valor = dados.valorFrete
  const tipoOperacaoFrete = dados.ufOrigem.sigla === dados.ufDestino.sigla ? 'INTERNA' : 'INTERESTADUAL'

  let projecao = null
  let erroProjecao = null
  try {
    projecao = await projetarFrete({
      valorFrete: valor,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      tipoOperacao: tipoOperacaoFrete,
    })
  } catch (erro) {
    erroProjecao = erro
    avisos.push(
      'A projeção anual do frete não está disponível neste motor. A linha do tempo usa o CBS/IBS apurado ano a ano e não decompõe ICMS/PIS/COFINS; suba o motor com .\\run.ps1 para ver a carga completa.',
    )
  }

  const projecaoPorAno = new Map((projecao?.anos ?? []).map((ano) => [ano.ano, ano]))

  let motorPorAno = new Map()
  if (!projecao) {
    const fallback = await apurarCbsIbsPorAno({ dados, tabela })
    motorPorAno = fallback.porAno
    if (fallback.falhas.length) {
      avisos.push(
        `Não foi possível apurar o CBS/IBS em ${fallback.falhas.join(', ')}; esses anos ficam sem valor na linha do tempo.`,
      )
    }
  }

  const temAliquotasSimples = Boolean(dados.aliquotaCbs && dados.aliquotaIbs)
  const usaMotorSimples = perfil.id === 'SIMPLES_DAS' && temAliquotasSimples
  let simples = null
  let erroSimples = null
  if (usaMotorSimples) {
    try {
      const anoMotor = Math.min(ANO_FIM_SERIE, Math.max(ANO_INICIO_SIMPLES, dados.ano))
      simples = await calcularFreteSimples({
        valorFrete: valor,
        ano: anoMotor,
        atividade: dados.atividade.id,
        aliquotaCbs: dados.aliquotaCbs,
        aliquotaIbs: dados.aliquotaIbs,
      })
    } catch (erro) {
      erroSimples = erro
      avisos.push(
        `O motor do Simples não apurou a linha do PGDAS informada; a linha do tempo do Simples usa a faixa setorial estimada. (${erro.message})`,
      )
    }
  }

  const taxaEstimativa = Number(dados.taxaCredito ?? perfil.ref ?? 0)
  const aliquotaInformada = Number(dados.aliquotaCbs) + Number(dados.aliquotaIbs)
  const percentualSimples = simples
    ? Number.isFinite(aliquotaInformada) && aliquotaInformada > 0
      ? arredondarCasas(aliquotaInformada, 4)
      : percentualDe(simples.destaque, valor)
    : null
  const modelo =
    perfil.id === 'REGIME_REGULAR'
      ? 'regular'
      : perfil.id === 'SIMPLES_HIBRIDO'
        ? 'hibrido'
        : usaMotorSimples && simples
          ? 'simples-motor'
          : 'estimativa'

  if (modelo === 'estimativa' && perfil.min !== null && perfil.max !== null) {
    if (taxaEstimativa < perfil.min - 1e-9 || taxaEstimativa > perfil.max + 1e-9) {
      throw new HttpError(
        400,
        `A taxa de crédito de ${formatarNumero(taxaEstimativa)}% está fora da faixa do perfil ${perfil.curto} (${formatarNumero(perfil.min)}% a ${formatarNumero(perfil.max)}%).`,
      )
    }
  }

  const SEM_ANTIGOS = { icms: 0, pis: 0, cofins: 0, iss: 0, total: 0 }

  const anos = ANOS_REFORMA.map((ano) => {
    const proj = projecaoPorAno.get(ano) ?? null
    const calculoMotor = motorPorAno.get(ano) ?? null
    const cbsIbsProjecao = proj ? arredondar(proj.cbs + proj.ibsUf + proj.ibsMun) : null
    const cbsIbsMotor = calculoMotor ? calculoMotor.destaque : null

    let antigos = SEM_ANTIGOS
    let cbsIbs = 0
    let carga = 0
    let compensado = 0
    let disponivel = true
    let fonte = proj ? 'projecao' : 'motor'

    if (modelo === 'regular') {
      if (proj) {
        antigos = {
          icms: proj.icms,
          pis: proj.pis,
          cofins: proj.cofins,
          iss: proj.iss,
          total: arredondar(proj.icms + proj.pis + proj.cofins + proj.iss),
        }
        cbsIbs = cbsIbsProjecao ?? 0
        carga = arredondar(proj.totalEfetivo)
        compensado = ano === 2026 ? arredondar(proj.totalDestacado - proj.totalEfetivo) : 0
      } else if (ano === ANO_REFERENCIA_REFORMA) {
        antigos = null
        disponivel = false
        carga = 0
      } else if (cbsIbsMotor !== null) {
        antigos = null
        cbsIbs = cbsIbsMotor
        carga = cbsIbs
      } else {
        antigos = null
        disponivel = false
        carga = 0
      }
    } else if (modelo === 'hibrido') {
      antigos = SEM_ANTIGOS
      cbsIbs = ano === ANO_REFERENCIA_REFORMA || ano === 2026 ? 0 : (cbsIbsProjecao ?? cbsIbsMotor ?? 0)
      carga = cbsIbs
      disponivel = ano === ANO_REFERENCIA_REFORMA || proj !== null || cbsIbsMotor !== null
    } else if (modelo === 'simples-motor') {
      antigos = SEM_ANTIGOS
      if (ano === ANO_REFERENCIA_REFORMA || ano === 2026) cbsIbs = 0
      else cbsIbs = simples.destaque
      carga = cbsIbs
      fonte = 'motor-simples'
    } else {
      antigos = SEM_ANTIGOS
      if (ano === ANO_REFERENCIA_REFORMA || ano === 2026) cbsIbs = 0
      else cbsIbs = arredondar((taxaEstimativa * valor) / 100)
      carga = cbsIbs
      fonte = 'estimativa'
    }

    cbsIbs = arredondar(cbsIbs)
    carga = arredondar(carga)

    let credito = 0
    if (dados.tipoOperacao === 'B2B') {
      credito =
        modelo === 'estimativa' ? Math.min(arredondar((taxaEstimativa * valor) / 100), cbsIbs) : cbsIbs
    }

    // 2026: o CBS/IBS destacado é compensado pelo transportador (art. 348, I)
    // e, no Simples, as alíquotas nem se aplicam (art. 348, III, "c").
    if (ano === 2026) credito = 0

    // O crédito do pagador soma os tributos do regime anterior que ainda
    // existem no ano — só no regime regular, que é quem os destaca no CT-e.
    let creditoIcms = 0
    let creditoPisCofins = 0
    if (modelo === 'regular' && proj && dados.tipoOperacao === 'B2B') {
      creditoIcms = arredondar((valor * proj.percentualIcms) / 100)
      creditoPisCofins = dados.regimePagadora.creditaPisCofins
        ? arredondar((valor * (proj.percentualPis + proj.percentualCofins)) / 100)
        : 0
    }
    const creditoAntigosTotal = arredondar(creditoIcms + creditoPisCofins)
    const creditoTotal = arredondar(credito + creditoAntigosTotal)

    const custoLiquido = arredondar(valor - creditoTotal)

    return {
      ano,
      fase: faseDaSerie(ano, tabela, proj),
      rotulo: rotuloDaSerie(ano, tabela, proj),
      valorFrete: valor,
      antigos,
      cbsIbs,
      cbsIbsEfetivo: arredondar(cbsIbs - compensado),
      compensado,
      percentualCompensado: percentualDe(compensado, valor),
      carga,
      percentualCarga: percentualDe(carga, valor),
      credito: creditoTotal,
      creditoCbsIbs: credito,
      creditoAntigos: {
        total: creditoAntigosTotal,
        icms: creditoIcms,
        pisCofins: creditoPisCofins,
      },
      percentualCredito: percentualDe(creditoTotal, valor),
      custoLiquido,
      disponivel,
      fonte,
      observacao: observacaoDoAno({ ano, modelo, percentualSimples, taxaEstimativa }),
    }
  })

  const porAno = new Map(anos.map((linha) => [linha.ano, linha]))
  const referencia = porAno.get(ANO_REFERENCIA_REFORMA)
  const pleno = porAno.get(ANO_FIM_SERIE) ?? anos[anos.length - 1]
  const referenciaDisponivel = referencia?.disponivel !== false

  const primeiroAumento = referenciaDisponivel
    ? anos.find(
        (linha) =>
          linha.ano > ANO_REFERENCIA_REFORMA &&
          linha.disponivel &&
          linha.percentualCarga > (referencia?.percentualCarga ?? 0) + 0.005,
      )
    : null
  const maiorCarga = [...anos]
    .filter((linha) => linha.disponivel)
    .sort((a, b) => b.percentualCarga - a.percentualCarga || b.ano - a.ano)[0]
  const variacao = (deValor, paraValor, dePercentual, paraPercentual) => ({
    absoluta: arredondar(paraValor - deValor),
    pontos: arredondarCasas(paraPercentual - dePercentual, 4),
    relativa: deValor ? Number((((paraValor - deValor) / deValor) * 100).toFixed(2)) : null,
  })

  const resumo = {
    referencia: {
      ano: ANO_REFERENCIA_REFORMA,
      carga: referencia?.carga ?? 0,
      percentualCarga: referencia?.percentualCarga ?? 0,
      credito: referencia?.credito ?? 0,
      percentualCredito: referencia?.percentualCredito ?? 0,
      custoLiquido: referencia?.custoLiquido ?? valor,
    },
    regimePleno: {
      ano: pleno.ano,
      carga: pleno.carga,
      percentualCarga: pleno.percentualCarga,
      credito: pleno.credito,
      percentualCredito: pleno.percentualCredito,
      custoLiquido: pleno.custoLiquido,
    },
    primeiroAumentoCarga: primeiroAumento?.ano ?? null,
    maiorCarga: maiorCarga
      ? { ano: maiorCarga.ano, carga: maiorCarga.carga, percentualCarga: maiorCarga.percentualCarga }
      : null,
    variacaoCarga: referenciaDisponivel
      ? variacao(
          referencia?.carga ?? 0,
          pleno.carga,
          referencia?.percentualCarga ?? 0,
          pleno.percentualCarga,
        )
      : null,
    variacaoCredito: referenciaDisponivel
      ? variacao(
          referencia?.credito ?? 0,
          pleno.credito,
          referencia?.percentualCredito ?? 0,
          pleno.percentualCredito,
        )
      : null,
    variacaoCusto: referenciaDisponivel
      ? variacao(
          referencia?.custoLiquido ?? valor,
          pleno.custoLiquido,
          percentualDe(referencia?.custoLiquido ?? valor, valor),
          percentualDe(pleno.custoLiquido, valor),
        )
      : null,
  }

  let benchmark = null
  if (perfil.id !== 'REGIME_REGULAR' && perfil.id !== 'SIMPLES_HIBRIDO' && (projecao || motorPorAno.size)) {
    benchmark = {
      rotulo: 'Regime regular',
      descricao: 'Mesmo frete no regime regular: ICMS + PIS/COFINS + CBS/IBS integral creditável.',
      anos: ANOS_REFORMA.map((ano) => {
        const proj = projecaoPorAno.get(ano) ?? null
        const calculo = motorPorAno.get(ano) ?? null
        const cbsIbs = proj
          ? arredondar(proj.cbs + proj.ibsUf + proj.ibsMun)
          : calculo
            ? calculo.destaque
            : null
        const creditoCbsIbs = ano >= 2027 && cbsIbs !== null ? cbsIbs : 0
        const icms = proj ? arredondar((valor * proj.percentualIcms) / 100) : 0
        const pisCofins =
          proj && dados.regimePagadora.creditaPisCofins
            ? arredondar((valor * (proj.percentualPis + proj.percentualCofins)) / 100)
            : 0
        const credito =
          dados.tipoOperacao === 'B2C' || cbsIbs === null
            ? 0
            : arredondar(creditoCbsIbs + icms + pisCofins)
        return {
          ano,
          cbsIbs: cbsIbs ?? 0,
          percentualCarga: proj ? proj.percentualTotal : null,
          percentualCredito: cbsIbs === null ? null : percentualDe(credito, valor),
          custoLiquido: cbsIbs === null ? null : arredondar(valor - credito),
        }
      }),
    }
  }

  if (tipoOperacaoFrete === 'INTERNA') {
    avisos.push(
      'Operação interna: a projeção do regime anterior usa a alíquota interna padrão de 18% do motor; o ICMS interno varia por UF.',
    )
  }
  if (anos.some((linha) => linha.ano === 2026)) {
    avisos.push(
      'Em 2026 o CBS/IBS de 1,00% é fase de teste e compensado pelo transportador: não entra no crédito do pagador. O crédito de 2026 é ICMS + PIS/COFINS.',
    )
  }
  if (dados.tipoOperacao === 'B2C') {
    avisos.push('Em B2C o pagador é o consumidor final: o crédito é zero e o custo líquido é o preço cheio.')
  }
  if (perfil.id === 'SIMPLES_HIBRIDO') {
    avisos.push(
      'No Simples híbrido o ICMS permanece no DAS e não é destacado para crédito nesta simulação; só o CBS/IBS apurado no regime regular entra.',
    )
  }
  if (perfil.id === 'AUTONOMO_MEI') {
    avisos.push('Autônomo/MEI: a linha do tempo usa a faixa setorial estimada, não o destaque integral do regime regular.')
  }
  if (modelo === 'estimativa' && perfil.id === 'SIMPLES_DAS') {
    avisos.push(
      'Sem as duas alíquotas efetivas do PGDAS, a linha do tempo do Simples/DAS usa a faixa setorial estimada.',
    )
  }
  if (!projecao) {
    avisos.push(
      'Sem a projeção oficial do frete, os tributos do regime anterior (ICMS/PIS/COFINS) não aparecem na linha do tempo.',
    )
  }

  return {
    entrada: {
      valorFrete: valor,
      ano: dados.ano,
      tipoOperacao: dados.tipoOperacao,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      rota: `${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}`,
      regime: {
        id: perfil.regime,
        rotulo: REGIMES.find((item) => item.id === perfil.regime)?.rotulo ?? perfil.regime,
      },
      perfil: {
        id: perfil.id,
        curto: perfil.curto,
        rotulo: perfil.rotulo,
        varianteRotulo: perfil.varianteRotulo,
        estimativa: perfil.estimativa,
        fonteCredito: dados.fonteCredito,
        modelo,
      },
      taxaEstimativa: modelo === 'estimativa' ? taxaEstimativa : null,
      percentualSimples,
      aliquotaCbs: dados.aliquotaCbs,
      aliquotaIbs: dados.aliquotaIbs,
      atividade: dados.atividade.id,
      anoReferencia: ANO_REFERENCIA_REFORMA,
      anoRegimePleno: ANO_FIM_SERIE,
    },
    anos,
    resumo,
    benchmark,
    notas: notasDaSerie({ modelo, projecao, percentualSimples, taxaEstimativa }),
    premissas: [
      projecao
        ? `Carga anual pela projeção oficial do frete (motor do regime regular): item de CT-e NBS ${NBS_FRETE}, CST 000, cClassTrib 000001, competência 06 de cada ano.`
        : 'A projeção anual do frete não está disponível neste motor; a série mostra apenas o CBS/IBS apurado ano a ano e não decompõe ICMS/PIS/COFINS.',
      projecao
        ? `Tributos do regime anterior: ICMS ${tipoOperacaoFrete === 'INTERNA' ? 'interno padrão de 18%' : 'interestadual da Resolução do Senado nº 22/1989'} + PIS/COFINS não cumulativo (1,65% + 7,60%), reduzidos pelo cronograma da LC 214/2025.`
        : 'Os tributos do regime anterior (ICMS/PIS/COFINS) não entram na carga sem a projeção; 2025 fica sem valor.',
      'Crédito do pagador = CBS/IBS (2027 em diante) + ICMS e PIS/COFINS do documento no regime regular; o custo líquido desconta esse total. A carga soma todos os tributos do documento e serve de contexto.',
      'Valor diário (1 dia útil) para isolar o efeito das alíquotas: o mesmo preço nominal atravessa todos os anos, sem o ruído de dias úteis.',
      'Simples/DAS: o CBS/IBS é o destaque do motor do Simples com as alíquotas do PGDAS; sem elas (e para autônomo/MEI), vale a faixa setorial estimada.',
      'As alíquotas de 2027 em diante são as de referência do motor e podem ser fixadas anualmente; a projeção é uma simulação, não a apuração fiscal.',
    ],
    avisos,
    fonte: {
      projecao: Boolean(projecao),
      motorRegular: projecao ? 'projeção oficial do frete' : 'motor oficial ano a ano',
      motorSimples: usaMotorSimples && simples ? 'motor do Simples Nacional' : null,
      versaoBaseDados: projecao?.versaoBaseDados ?? estado.motor.baseDados ?? null,
      versaoApi: projecao?.headers?.aplicacao ?? estado.motor.versao ?? null,
      erroProjecao: erroProjecao?.message ?? null,
      erroSimples: erroSimples?.message ?? null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Horizonte do pagador: hoje → amanhã                                 */
/* ------------------------------------------------------------------ */

const ANO_FIM_HORIZONTE = 2033

/**
 * A pergunta do pagador: "hoje pago X bruto e Y líquido; amanhã, quanto pago,
 * quanto eu deveria pagar e como me ajustar?".
 *
 * A carga e os tributos de cada ano vêm da projeção oficial do frete; o crédito
 * total (ICMS + PIS/COFINS + CBS/IBS) segue a regra de `creditosDoPagador`; o
 * resto é aritmética de cenário (preço congelado × repasse, benchmark e teto).
 */
async function pagador(entrada) {
  const dados = normalizarEntrada(entrada)
  const perfil = dados.perfil
  const valor = dados.valorFrete
  const tipoOperacaoFrete = dados.ufOrigem.sigla === dados.ufDestino.sigla ? 'INTERNA' : 'INTERESTADUAL'
  const avisos = [...dados.avisos]

  let projecao
  try {
    projecao = await projetarFrete({
      valorFrete: valor,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      tipoOperacao: tipoOperacaoFrete,
    })
  } catch (erro) {
    throw new HttpError(
      503,
      `A visão de hoje até 2033 precisa da projeção anual do frete do motor oficial e ela não respondeu (${erro.message}). Suba o motor do regime regular com .\\run.ps1 e tente de novo.`,
    )
  }

  const anoHoje = Math.min(ANO_FIM_HORIZONTE, Math.max(2026, new Date().getFullYear()))

  // A alíquota do Simples/DAS é a do PGDAS informado; sem ela, vale a faixa setorial.
  let taxaSimples2027 = Number(dados.taxaCredito ?? perfil.ref ?? 0)
  if (perfil.id === 'SIMPLES_DAS' && dados.aliquotaCbs && dados.aliquotaIbs) {
    try {
      const simples = await calcularFreteSimples({
        valorFrete: valor,
        ano: Math.max(ANO_INICIO_SIMPLES, anoHoje),
        atividade: dados.atividade.id,
        aliquotaCbs: dados.aliquotaCbs,
        aliquotaIbs: dados.aliquotaIbs,
      })
      taxaSimples2027 = percentualDe(simples.destaque, valor)
    } catch (erro) {
      avisos.push(
        `O motor do Simples não apurou a linha do PGDAS informada; a visão do Simples usa a faixa setorial de ${pct(taxaSimples2027)}. (${erro.message})`,
      )
    }
  }
  if (perfil.id === 'SIMPLES_DAS' && !dados.aliquotaCbs) {
    avisos.push(
      'Sem as alíquotas efetivas do PGDAS, o crédito do Simples/DAS é a faixa setorial estimada — não é o destaque real do DAS.',
    )
  }
  if (perfil.id === 'AUTONOMO_MEI') {
    avisos.push('Autônomo/MEI: o crédito é a faixa setorial estimada, não o destaque do regime regular.')
  }
  if (perfil.id === 'SIMPLES_HIBRIDO') {
    avisos.push(
      'Simples híbrido: ICMS e PIS/COFINS continuam no DAS e não são destacados no CT-e — só o CBS/IBS apurado no regime regular vira crédito.',
    )
  }
  if (dados.regimePagadora.id === 'CUMULATIVO') {
    avisos.push(
      'Lucro Presumido: o PIS/COFINS cumulativo não gera crédito sobre o frete; o crédito total é ICMS + CBS/IBS.',
    )
  }

  const taxaSimples = (ano) => {
    if (perfil.id !== 'SIMPLES_DAS' && perfil.id !== 'AUTONOMO_MEI') return 0
    if (Number(ano) <= 2025) return 0
    if (Number(ano) === 2026) return Math.min(taxaSimples2027, 1)
    return taxaSimples2027
  }

  const serie = projecao.anos
    .filter((ano) => ano.ano >= 2026 && ano.ano <= ANO_FIM_HORIZONTE)
    .map((ano) => ({
      ano: ano.ano,
      carga: ano.percentualTotal,
      percentuais: {
        icms: ano.percentualIcms,
        pis: ano.percentualPis,
        cofins: ano.percentualCofins,
        cbs: ano.percentualCbs,
        ibs: ano.percentualIbs,
      },
    }))

  const horizonte = construirHorizonte({
    valorFrete: valor,
    perfil,
    regimePagadora: dados.regimePagadora,
    tipoOperacao: dados.tipoOperacao,
    anoHoje,
    serie,
    taxaSimples,
    dados: { dasTotal: dados.dasTotal, insumos: dados.insumos },
  })

  if (tipoOperacaoFrete === 'INTERNA') {
    avisos.push(
      'Operação interna: a projeção do regime anterior usa a alíquota interna padrão de 18% do motor; o ICMS interno varia por UF.',
    )
  }
  if (dados.tipoOperacao === 'B2C') {
    avisos.push('B2C: o pagador é o consumidor final; o crédito é zero em todos os anos e o custo é o preço cheio.')
  }
  if (anoHoje < 2027) {
    avisos.push(
      'Em 2026 o CBS/IBS de 1,00% é fase de teste, compensado pelo transportador: ele não entra no crédito do pagador.',
    )
  }

  return {
    entrada: {
      valorFrete: valor,
      anoHoje,
      primeiroAno: anoHoje,
      ultimoAno: ANO_FIM_HORIZONTE,
      perfil: {
        id: perfil.id,
        rotulo: perfil.rotulo,
        curto: perfil.curto,
        regime: perfil.regime,
        estimativa: perfil.estimativa,
      },
      regimePagadora: {
        id: dados.regimePagadora.id,
        rotulo: dados.regimePagadora.rotulo,
        curto: dados.regimePagadora.curto,
        creditaPisCofins: Boolean(dados.regimePagadora.creditaPisCofins),
        descricao: dados.regimePagadora.descricao,
      },
      tipoOperacao: dados.tipoOperacao,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      rota: `${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}`,
      aliquotaCbs: dados.aliquotaCbs,
      aliquotaIbs: dados.aliquotaIbs,
      dasTotal: dados.dasTotal,
      insumos: dados.insumos,
      taxaSimples: perfil.id === 'SIMPLES_DAS' || perfil.id === 'AUTONOMO_MEI' ? taxaSimples2027 : null,
      anual: 12,
    },
    ...horizonte,
    notas: (projecao.notas ?? [])
      .filter((nota) => nota.ano >= anoHoje)
      .map((nota) => ({
        ano: nota.ano,
        titulo: nota.rotulo ?? rotuloAnoReforma(nota.ano),
        resumo: nota.resumo,
        mudancas: nota.mudancas,
        comparacao: nota.comparacaoMetodoAnterior,
        fundamento: nota.fundamento,
      })),
    premissas: [
      'Carga e tributos de cada ano vêm da projeção oficial do frete (motor do regime regular): o CBS/IBS é apurado pela mesma calculadora e o ICMS/PIS/COFINS é composto pelo cronograma da LC 214/2025.',
      'O valor informado é o frete do período (tratado como mês); o volume de serviço é mantido constante, sem o efeito de dias úteis que a projeção aplica ao valor do período.',
      'Crédito total do pagador = ICMS + PIS/COFINS (até 2026) + CBS/IBS (2027 em diante), conforme o regime do transportador e o regime da pagadora.',
      'Repasse integral: preço_novo = preço_hoje × (1 − carga_hoje) ÷ (1 − carga_ano), que preserva a receita líquida do transportador. É um cenário, não uma cláusula contratual.',
      'Benchmark: o mesmo valor nominal com um transportador do regime regular, que transfere 100% do CBS/IBS destacado.',
      perfil.estimativa
        ? 'Perfil estimado: sem o destaque no CT-e, a faixa setorial é uma estimativa do simulador. O crédito real é o tributo destacado (LC 214/2025, art. 47, §2º, I); no autônomo/MEI é crédito presumido a definir em ato conjunto (art. 169).'
        : null,
      'As alíquotas de 2027 a 2033 são as de referência (premissa): a LC 214/2025 manda o Senado fixar a alíquota de referência a cada ano (arts. 18 e 349).',
      'Anual = 12 × o valor do período.',
      'Simulação para planejamento e negociação; não substitui a apuração fiscal.',
    ].filter(Boolean),
    avisos,
    fonte: {
      projecao: true,
      motor: 'projeção oficial do frete (regime regular)',
      versaoBaseDados: projecao.versaoBaseDados ?? estado.motor.baseDados ?? null,
      versaoApi: projecao.headers?.aplicacao ?? estado.motor.versao ?? null,
      aliquotaIcms: projecao.aliquotaIcms,
      geradoEm: new Date().toISOString(),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Perfis de transportadores                                           */
/* ------------------------------------------------------------------ */

const ANO_MINIMO_PERFIL = 2026
const ANO_MAXIMO_PERFIL = 2033

function anoCorrente() {
  return Math.min(ANO_MAXIMO_PERFIL, Math.max(ANO_MINIMO_PERFIL, new Date().getFullYear()))
}

function anoDoPerfil(valor, padrao = anoCorrente()) {
  const ano = Number(valor ?? padrao)
  if (!Number.isInteger(ano) || !ANOS_PERFIL.includes(ano)) {
    throw new HttpError(400, `Ano do perfil inválido. Use ${ANOS_PERFIL.join(', ')}.`)
  }
  return ano
}

function mesDoPerfil(valor, padrao = new Date().getMonth() + 1) {
  const mes = Number(valor ?? padrao)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new HttpError(400, 'Mês inválido. Use 1 a 12.')
  }
  return mes
}

/** A rota do perfil decide a projeção; a mesma chamada é cacheada no motor. */
async function taxasDaRotaPerfil({ ufOrigem, ufDestino }) {
  try {
    return await taxasDoFretePorAno({
      ufOrigem,
      ufDestino,
      tipoOperacao: ufOrigem === ufDestino ? 'INTERNA' : 'INTERESTADUAL',
    })
  } catch (erro) {
    throw new HttpError(
      503,
      `Os perfis precisam da projeção anual do frete do motor oficial e ela não respondeu (${erro.message}). Suba o motor do regime regular com .\\run.ps1 e tente de novo.`,
    )
  }
}

const TAXAS_ZERADAS = {
  porAno: new Map(
    ANOS_PERFIL.map((ano) => [ano, { ano, icms: 0, pis: 0, cofins: 0, cbs: 0, ibs: 0, carga: 0 }]),
  ),
  versaoBaseDados: null,
  disponivel: true,
}

/** Aceita `{ perfil: {...} }` e também os campos soltos no corpo. */
function perfilRecebido(entrada) {
  if (entrada?.perfil && typeof entrada.perfil === 'object' && !Array.isArray(entrada.perfil)) {
    return entrada.perfil
  }
  return entrada ?? {}
}

async function contextoDoPerfil(entrada) {
  const base = perfilRecebido(entrada)
  let perfil

  if (base?.id) {
    perfil = await obterPerfil(String(base.id))
    if (!perfil) throw new HttpError(404, 'Perfil não encontrado.')
  } else {
    perfil = { ...normalizarPerfilTransportador(base), id: null }
  }

  const regimePagadora = regimePagadoraPorId(
    entrada?.regimePagadora ?? perfil.regimePagadora ?? REGIMES_PAGADORA[0].id,
  )
  if (!regimePagadora) {
    throw new HttpError(
      400,
      `Regime da pagadora desconhecido. Use ${REGIMES_PAGADORA.map((regime) => regime.id).join(', ')}.`,
    )
  }

  const tipoOperacao = String(entrada?.tipoOperacao ?? perfil.tipoOperacao ?? 'B2B').toUpperCase()
  if (!['B2B', 'B2C'].includes(tipoOperacao)) {
    throw new HttpError(400, 'Tipo de operação inválido. Use B2B ou B2C.')
  }

  const ano = anoDoPerfil(entrada?.ano)
  const mes = mesDoPerfil(entrada?.mes)
  // Em B2C não há crédito e o motor não é necessário: o perfil abre mesmo offline.
  const taxas =
    tipoOperacao === 'B2C' ? TAXAS_ZERADAS : await taxasDaRotaPerfil(perfil)

  return { perfil, regimePagadora, tipoOperacao, ano, mes, mesAtual: new Date().getMonth() + 1, taxas }
}

async function detalharPerfil(entrada) {
  const contexto = await contextoDoPerfil(entrada)
  const detalhe = calcularPerfil({
    perfil: contexto.perfil,
    taxas: contexto.taxas,
    regimePagadora: contexto.regimePagadora.id,
    anoReferencia: contexto.ano,
    anoHoje: anoCorrente(),
    mesReferencia: contexto.mes,
    mesAtual: contexto.mesAtual,
  })

  return {
    ...detalhe,
    geradoEm: new Date().toISOString(),
  }
}

async function compararPerfis(entrada) {
  const ano = anoDoPerfil(entrada?.ano)
  const mes = mesDoPerfil(entrada?.mes)
  const regimePagadora = regimePagadoraPorId(entrada?.regimePagadora ?? REGIMES_PAGADORA[0].id)
  if (!regimePagadora) {
    throw new HttpError(
      400,
      `Regime da pagadora desconhecido. Use ${REGIMES_PAGADORA.map((regime) => regime.id).join(', ')}.`,
    )
  }

  const tipoForcado = entrada?.tipoOperacao ? String(entrada.tipoOperacao).toUpperCase() : null
  if (tipoForcado && !['B2B', 'B2C'].includes(tipoForcado)) {
    throw new HttpError(400, 'Tipo de operação inválido. Use B2B ou B2C.')
  }

  const ids = Array.isArray(entrada?.ids) ? entrada.ids.map(String) : null
  const todos = await todosOsPerfis()
  const alvo = ids ? todos.filter((perfil) => ids.includes(perfil.id)) : todos
  if (alvo.length === 0) throw new HttpError(400, 'Não há perfis para comparar. Crie um perfil primeiro.')

  const cacheRotas = new Map()
  const taxasDa = async (perfil) => {
    const chave = `${perfil.ufOrigem}|${perfil.ufDestino}`
    if (!cacheRotas.has(chave)) cacheRotas.set(chave, await taxasDaRotaPerfil(perfil))
    return cacheRotas.get(chave)
  }

  const linhas = await Promise.all(
    alvo.map(async (perfil) => {
      const tipoOperacao = tipoForcado ?? perfil.tipoOperacao ?? 'B2B'
      const taxas = tipoOperacao === 'B2C' ? TAXAS_ZERADAS : await taxasDa(perfil)
      const detalhe = calcularPerfil({
        perfil,
        taxas,
        regimePagadora: regimePagadora.id,
        anoReferencia: ano,
        anoHoje: anoCorrente(),
        mesReferencia: mes,
        mesAtual: new Date().getMonth() + 1,
      })
      const base = detalhe.anos.find((item) => item.ano === ano) ?? detalhe.anos[0]
      return {
        id: perfil.id,
        nome: perfil.nome,
        rota: detalhe.perfil.rota,
        tipoRota: detalhe.perfil.tipoRota,
        perfil: perfil.perfil,
        perfilRotulo: detalhe.perfil.perfilRotulo,
        perfilCurto: detalhe.perfil.perfilCurto,
        tipoVeiculo: perfil.tipoVeiculo ?? null,
        diaria: perfil.diaria,
        modoDias: perfil.modoDias,
        tipoOperacao,
        diasNoAno: base.dias,
        brutoAnual: base.bruto,
        brutoMensal: base.mediaMensalBruto,
        percentualCredito: base.percentualCredito,
        creditoAnual: base.credito,
        liquidoAnual: base.liquido,
        liquidoMensal: base.mediaMensalLiquido,
      }
    }),
  )

  linhas.sort((a, b) => a.liquidoAnual - b.liquidoAnual)

  // Comparar carreta com toco não decide nada: o ranking é feito dentro do
  // mesmo tipo de veículo. Perfis sem tipo informado formam um grupo próprio.
  const porTipo = new Map()
  for (const linha of linhas) {
    const chave = linha.tipoVeiculo ?? 'NAO_INFORMADO'
    if (!porTipo.has(chave)) porTipo.set(chave, [])
    porTipo.get(chave).push(linha)
  }

  const grupos = [...porTipo.entries()].map(([tipo, itens]) => {
    itens.sort((a, b) => a.liquidoAnual - b.liquidoAnual)
    const melhorDoGrupo = itens[0]?.liquidoAnual ?? 0
    return {
      tipo,
      rotulo: tipo === 'NAO_INFORMADO' ? 'Sem tipo de veículo' : (tipoVeiculoPorId(tipo)?.rotulo ?? tipo),
      linhas: itens.map((linha, indice) => ({
        ...linha,
        grupo: tipo,
        posicao: indice + 1,
        melhor: indice === 0,
        diferencaAnual: arredondar(linha.liquidoAnual - melhorDoGrupo),
        diferencaMensal: arredondar((linha.liquidoAnual - melhorDoGrupo) / 12),
        percentualDiferenca:
          melhorDoGrupo > 0
            ? Number((((linha.liquidoAnual - melhorDoGrupo) / melhorDoGrupo) * 100).toFixed(2))
            : 0,
      })),
    }
  })

  const ranking = grupos.flatMap((grupo) => grupo.linhas)
  const economias = grupos
    .filter((grupo) => grupo.linhas.length > 1)
    .map((grupo) => arredondar(grupo.linhas[grupo.linhas.length - 1].liquidoAnual - grupo.linhas[0].liquidoAnual))

  return {
    ano,
    mes,
    contexto: {
      regimePagadora: {
        id: regimePagadora.id,
        rotulo: regimePagadora.rotulo,
        curto: regimePagadora.curto,
      },
      tipoOperacao: tipoForcado,
    },
    linhas: ranking,
    grupos,
    melhorId: ranking[0]?.id ?? null,
    economiaEntreExtremos: economias.length ? Math.max(...economias) : 0,
    notas: [
      'O ranking é pelo custo líquido ANUAL depois do crédito, com a diária travada e o calendário de cada perfil.',
      'A comparação é dentro do mesmo tipo de veículo: uma carreta e um toco não disputam o mesmo serviço.',
      'Perfis com tipos de operação diferentes (B2B e B2C) não são comparáveis entre si: o B2C não gera crédito.',
      'Feriados nacionais entram no calendário; estaduais, municipais e pontos facultativos não.',
    ],
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function responderJson(res, status, corpo) {
  const texto = JSON.stringify(corpo)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  })
  res.end(texto)
}

async function lerCorpo(req) {
  const partes = []
  let total = 0
  for await (const parte of req) {
    total += parte.length
    if (total > 200_000) throw new HttpError(413, 'Corpo da requisição grande demais.')
    partes.push(parte)
  }
  const texto = Buffer.concat(partes).toString('utf8')
  if (!texto.trim()) return {}
  try {
    return JSON.parse(texto)
  } catch {
    throw new HttpError(400, 'JSON inválido no corpo da requisição.')
  }
}

async function servirEstatico(req, res, caminho) {
  const arquivo = caminho === '/' ? '/index.html' : caminho
  const alvo = path.resolve(PUBLICO, `.${arquivo}`)
  if (!alvo.startsWith(PUBLICO)) {
    responderJson(res, 403, { erro: 'Acesso negado.' })
    return
  }

  try {
    const conteudo = await readFile(alvo)
    const ext = path.extname(alvo).toLowerCase()
    const semCache = ['.html', '.js', '.css'].includes(ext)
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': conteudo.length,
      'Cache-Control': semCache ? 'no-store' : 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(conteudo)
  } catch {
    responderJson(res, 404, { erro: 'Arquivo não encontrado.' })
  }
}

async function opcoes() {
  const tabela = await carregarTabela()
  const motor = estado.motor
  const motorSimples = estado.motorSimples

  return {
    perfis: PERFIS.map((perfil) => ({
      ...perfil,
      faixa: faixaTexto(perfil),
    })),
    regimes: REGIMES,
    regimesPagadora: REGIMES_PAGADORA,
    tiposOperacao: TIPOS_OPERACAO,
    atividadesSimples: ATIVIDADES_SIMPLES,
    modosDias: MODOS_DIAS,
    anosPerfil: ANOS_PERFIL,
    limitesPerfil: LIMITES,
    tiposVeiculo: TIPOS_VEICULO,
    referenciaDiaria: REFERENCIA_DIARIA,
    anoInicioSimples: ANO_INICIO_SIMPLES,
    anoReferencia: ANO_REFERENCIA_REFORMA,
    anosReforma: ANOS_REFORMA,
    ufs: UFS,
    anos: ANOS.map((ano) => ({
      ano,
      rotulo: tabela[ano].rotulo,
      fase: tabela[ano].fase,
      simples: ano >= ANO_INICIO_SIMPLES,
      aliquota: {
        cbs: tabela[ano].cbs,
        ibsUf: tabela[ano].ibsUf,
        ibsMun: tabela[ano].ibsMun,
        total: arredondar(tabela[ano].cbs + tabela[ano].ibsUf + tabela[ano].ibsMun),
      },
    })),
    motor: {
      online: Boolean(motor.online),
      url: MOTOR_URL,
      nome: 'Regime regular',
      versao: motor.versao ?? null,
      baseDados: motor.baseDados ?? null,
      fonteAliquotas: estado.fonteAliquotas,
      aviso: motor.aviso ?? null,
      erro: motor.online ? null : motor.erro ?? null,
    },
    motorSimples: {
      online: Boolean(motorSimples.online),
      url: MOTOR_SIMPLES_URL,
      nome: 'Simples Nacional',
      versao: motorSimples.versao ?? null,
      baseDados: motorSimples.baseDados ?? null,
      ambiente: motorSimples.ambiente ?? null,
      erro: motorSimples.online ? null : motorSimples.erro ?? null,
    },
    nbs: NBS_FRETE,
  }
}

const rotas = {
  'GET /api/opcoes': async () => ({ status: 200, corpo: await opcoes() }),

  'GET /api/saude': async () => {
    const [motor, motorSimples] = await Promise.all([verificarMotor(), verificarMotorSimples()])
    estado.motor = motor
    estado.motorSimples = motorSimples
    return {
      status: 200,
      corpo: {
        ok: motor.online,
        motor: { online: motor.online, url: MOTOR_URL, versao: motor.versao, baseDados: motor.baseDados },
        motorSimples: {
          online: motorSimples.online,
          url: MOTOR_SIMPLES_URL,
          versao: motorSimples.versao,
          baseDados: motorSimples.baseDados,
          erro: motorSimples.erro,
        },
        fonteAliquotas: estado.fonteAliquotas,
        uptime: Math.round(process.uptime()),
        desde: estado.desde.toISOString(),
      },
    }
  },

  'POST /api/simular': async (req) => {
    const corpo = await lerCorpo(req)
    return { status: 200, corpo: await simular(corpo) }
  },

  'POST /api/reforma': async (req) => {
    const corpo = await lerCorpo(req)
    return { status: 200, corpo: await reforma(corpo) }
  },

  'POST /api/pagador': async (req) => {
    const corpo = await lerCorpo(req)
    return { status: 200, corpo: await pagador(corpo) }
  },

  'POST /api/comparar': async (req) => {
    const corpo = await lerCorpo(req)
    return { status: 200, corpo: await comparar(corpo) }
  },

  'GET /api/perfis': async () => ({ status: 200, corpo: await listarPerfis() }),

  'POST /api/perfis': async (req) => {
    const corpo = await lerCorpo(req)
    const criado = await criarPerfil(corpo)
    return { status: 201, corpo: { perfil: resumoDoPerfil(criado) } }
  },

  'POST /api/perfis/calcular': async (req) => ({
    status: 200,
    corpo: await detalharPerfil(await lerCorpo(req)),
  }),

  'POST /api/perfis/comparar': async (req) => ({
    status: 200,
    corpo: await compararPerfis(await lerCorpo(req)),
  }),

  'POST /api/perfis/exemplos': async () => {
    await restaurarExemplos()
    return { status: 200, corpo: await listarPerfis() }
  },
}

/**
 * Rotas com id no caminho (`/api/perfis/:id`). O dicionário `rotas` cobre as
 * rotas exatas; esta função só é consultada quando não há correspondência.
 */
function rotaComParametro(metodo, caminho) {
  const encontrado = /^\/api\/perfis\/([^/]+)$/.exec(caminho)
  if (!encontrado) return null
  const id = decodeURIComponent(encontrado[1])

  if (metodo === 'GET') {
    return async (req, url) => {
      const consulta = Object.fromEntries(url.searchParams.entries())
      return { status: 200, corpo: await detalharPerfil({ ...consulta, perfil: { id } }) }
    }
  }

  if (metodo === 'PUT') {
    return async (req) => {
      const corpo = await lerCorpo(req)
      const atualizado = await atualizarPerfil(id, corpo)
      if (!atualizado) throw new HttpError(404, 'Perfil não encontrado.')
      return { status: 200, corpo: { perfil: resumoDoPerfil(atualizado) } }
    }
  }

  if (metodo === 'DELETE') {
    return async () => {
      const removido = await removerPerfil(id)
      if (!removido) throw new HttpError(404, 'Perfil não encontrado.')
      return { status: 200, corpo: { ok: true, id } }
    }
  }

  return null
}

const servidor = http.createServer(async (req, res) => {
  const inicio = Date.now()
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
  const caminho = decodeURIComponent(url.pathname)

  try {
    if (caminho.startsWith('/api/')) {
      const chave = `${req.method} ${caminho}`
      const rota = rotas[chave] ?? rotaComParametro(req.method, caminho)
      if (!rota) {
        responderJson(res, 404, { erro: `Rota não encontrada: ${chave}` })
        return
      }
      const { status, corpo } = await rota(req, url)
      responderJson(res, status, corpo)
      console.log(`${chave} ${status} ${Date.now() - inicio}ms`)
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      responderJson(res, 405, { erro: 'Método não permitido.' })
      return
    }

    await servirEstatico(req, res, caminho)
  } catch (erro) {
    const status =
      erro instanceof HttpError
        ? erro.status
        : erro instanceof PerfilInvalidoError
          ? 400
          : erro instanceof MotorError
            ? 502
            : 500
    const mensagem =
      erro instanceof HttpError || erro instanceof PerfilInvalidoError || erro instanceof MotorError
        ? erro.message
        : 'Erro interno ao processar a simulação.'
    if (status >= 500) console.error(`[erro] ${req.method} ${caminho}`, erro)
    responderJson(res, status, {
      erro: mensagem,
      campo: erro?.campo ?? null,
      detalhe: erro?.detalhe ?? erro?.corpo ?? null,
    })
  }
})

servidor.listen(PORTA, HOST, async () => {
  console.log('')
  console.log(`  Frete Líquido · simulador do pagador de frete`)
  console.log(`  Interface  http://${HOST}:${PORTA}`)
  console.log(`  Motor      ${MOTOR_URL} (regime regular)`)
  console.log(`  Motor SN   ${MOTOR_SIMPLES_URL} (Simples Nacional)`)

  try {
    await carregarTabela({ forcar: true })
    const versao = estado.motor.versao ? ` · API ${estado.motor.versao}` : ''
    const versaoSimples = estado.motorSimples.versao ? ` · API ${estado.motorSimples.versao}` : ''
    console.log(
      `  Status     regular ${estado.motor.online ? 'online' : 'OFFLINE'}${versao} · base ${estado.motor.baseDados ?? '—'} · alíquotas: ${estado.fonteAliquotas}`,
    )
    console.log(
      `             simples ${estado.motorSimples.online ? 'online' : 'OFFLINE'}${versaoSimples} · base ${estado.motorSimples.baseDados ?? '—'}`,
    )
    console.log(`  Anos       ${ANOS.join(', ')}`)
    console.log('')
  } catch (erro) {
    console.log(`  Status     motor indisponível: ${erro.message}`)
  }
})
