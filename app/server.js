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
  ANOS,
  NBS_FRETE,
  PERFIS,
  TIPOS_OPERACAO,
  TABELA_TRANSICAO,
  UFS,
  anoDaTabela,
  arredondar,
  avaliarCredito,
  faixaTexto,
  formatarNumero,
  perfilPorId,
  rotuloFase,
  ufPorSigla,
} from './domain.js'
import { MOTOR_URL, MotorError, calcularFrete, verificarMotor } from './engine.js'

const PORTA = Number(process.env.PORT ?? 5180)
const HOST = process.env.HOST ?? '127.0.0.1'
const RAIZ = fileURLToPath(new URL('./', import.meta.url))
const PUBLICO = path.join(RAIZ, 'public')

const estado = {
  tabela: null,
  fonteAliquotas: 'tabela-local',
  motor: { online: false, url: MOTOR_URL },
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

  const tipoOperacao = String(entrada.tipoOperacao ?? 'B2B').trim().toUpperCase()
  if (!['B2B', 'B2C'].includes(tipoOperacao)) {
    throw new HttpError(400, 'Tipo de operação inválido. Use B2B ou B2C.')
  }

  const ufOrigem = ufPorSigla(entrada.ufOrigem ?? 'SP')
  if (!ufOrigem) throw new HttpError(400, 'UF de origem inválida.')
  const ufDestino = ufPorSigla(entrada.ufDestino ?? ufOrigem.sigla)
  if (!ufDestino) throw new HttpError(400, 'UF de destino inválida.')

  let taxaCredito = null
  if (perfil.estimativa && entrada.taxaCredito !== undefined && entrada.taxaCredito !== null && entrada.taxaCredito !== '') {
    taxaCredito = numeroDeTexto(entrada.taxaCredito)
    if (!Number.isFinite(taxaCredito)) {
      throw new HttpError(400, 'Taxa de crédito inválida.')
    }
  }

  return { valorFrete, ano, perfil, tipoOperacao, ufOrigem, ufDestino, taxaCredito }
}

/* ------------------------------------------------------------------ */
/* Alíquotas de transição (fonte: motor, com fallback local)           */
/* ------------------------------------------------------------------ */

async function carregarTabela({ forcar = false } = {}) {
  if (estado.tabela && !forcar) return estado.tabela

  const motor = await verificarMotor()
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
  return tabela
}

/* ------------------------------------------------------------------ */
/* Simulação                                                           */
/* ------------------------------------------------------------------ */

async function simular(entrada) {
  const dados = normalizarEntrada(entrada)
  const tabela = await carregarTabela()
  const aliquotas = tabela[dados.ano]

  const motor = await calcularFrete({
    valorFrete: dados.valorFrete,
    ano: dados.ano,
    uf: dados.ufDestino.sigla,
    municipio: dados.ufDestino.municipio,
    aliquotas,
  })

  let avaliacao
  try {
    avaliacao = avaliarCredito({
      valorFrete: dados.valorFrete,
      perfil: dados.perfil,
      destaque: motor.destaque,
      tipoOperacao: dados.tipoOperacao,
      taxaInformada: dados.taxaCredito,
    })
  } catch (erro) {
    throw new HttpError(400, erro.message)
  }

  if (motor.headers.aplicacao) {
    estado.motor.versao = motor.headers.aplicacao
    estado.motor.baseDados = motor.headers.baseDados ?? estado.motor.baseDados
  }

  const percentualDestaque = (motor.destaque / dados.valorFrete) * 100

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
        faixa: faixaTexto(dados.perfil),
        descricao: dados.perfil.descricao,
      },
      tipoOperacao: dados.tipoOperacao,
      ufOrigem: dados.ufOrigem.sigla,
      ufDestino: dados.ufDestino.sigla,
      ufDestinoNome: dados.ufDestino.nome,
      municipioDestino: dados.ufDestino.municipio,
      taxaCredito: avaliacao.taxaAplicada,
      rota: `${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}`,
    },
    motor: {
      url: MOTOR_URL,
      status: motor.status,
      versao: motor.headers.aplicacao,
      baseDados: motor.headers.baseDados,
      avisoSimulado: motor.headers.avisoSimulado,
      calculoSimulado: motor.calculoSimulado,
      requisicao: motor.operacao,
      resposta: motor.resposta,
      textoBruto: motor.texto,
      memoriaCalculo: motor.memoriaCalculo,
      aliquota: {
        cbs: motor.aliquotaCbs,
        ibsUf: motor.aliquotaIbsUf,
        ibsMun: motor.aliquotaIbsMun,
        total: motor.aliquotaCbs + motor.aliquotaIbsUf + motor.aliquotaIbsMun,
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
      credito: avaliacao.credito,
      percentualCredito: avaliacao.percentualCredito,
      custoLiquido: avaliacao.custoLiquido,
      creditoPerdido: avaliacao.creditoPerdido,
      limitadoAoTeto: avaliacao.limitadoAoTeto,
      faixa: avaliacao.faixa,
      alerta: avaliacao.alerta,
    },
    memoria: montarMemoria({ dados, motor, avaliacao, aliquotas, percentualDestaque }),
    premissas: montarPremissas({ dados, motor, aliquotas, avaliacao }),
  }
}

function montarMemoria({ dados, motor, avaliacao, aliquotas, percentualDestaque }) {
  const passos = [
    {
      rotulo: 'Preço nominal do frete',
      valor: brl(dados.valorFrete),
      nota: 'O valor cobrado pela transportadora, sem considerar crédito.',
    },
    {
      rotulo: `CBS/IBS destacado pelo motor · ${dados.ano}`,
      valor: brl(motor.destaque),
      nota: `${pct(percentualDestaque)} do frete — CBS ${brl(motor.vCBS)} (${pct(motor.aliquotaCbs)}) + IBS ${brl(motor.vIBS)} (${pct(motor.aliquotaIbsUf + motor.aliquotaIbsMun)}). ${rotuloFase(aliquotas.fase).replace(/^./, (letra) => letra.toUpperCase())}.`,
    },
  ]

  const creditoTeorico = dados.perfil.estimativa
    ? Math.min(arredondar((dados.valorFrete * (avaliacao.taxaAplicada ?? 0)) / 100), motor.destaque)
    : motor.destaque
  const percentualTeorico = dados.perfil.estimativa ? avaliacao.taxaAplicada : percentualDestaque

  if (dados.tipoOperacao === 'B2C') {
    passos.push({
      rotulo: 'Crédito aproveitável em B2C',
      valor: brl(0),
      nota: `O regime geraria ${brl(creditoTeorico)} de crédito (${pct(percentualTeorico)} do frete), mas o pagador é o consumidor final e não aproveita CBS/IBS.`,
    })
  } else if (dados.perfil.estimativa) {
    passos.push({
      rotulo: `Crédito do regime · ${pct(avaliacao.taxaAplicada)} do frete`,
      valor: brl(avaliacao.credito),
      nota: avaliacao.limitadoAoTeto
        ? `Estimativa limitada ao destaque do ano: ${brl(motor.destaque)}.`
        : `Estimativa dentro da faixa de ${faixaTexto(dados.perfil)} do frete, abaixo do destaque de ${brl(motor.destaque)}.`,
    })
  } else {
    passos.push({
      rotulo: 'Crédito do regime regular',
      valor: brl(avaliacao.credito),
      nota: 'O destaque do motor é transferido integralmente ao tomador.',
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

  passos.push({
    rotulo: 'Custo líquido pós-crédito',
    valor: brl(avaliacao.custoLiquido),
    nota: `${brl(dados.valorFrete)} − ${brl(avaliacao.credito)} de crédito. É o número que compara transportadoras.`,
    destaque: true,
  })

  return passos
}

function montarPremissas({ dados, aliquotas, avaliacao }) {
  const lista = [
    `Cálculo de CBS/IBS feito pelo motor oficial da Receita (regime regular): item de CT-e NBS ${NBS_FRETE}, CST 000, cClassTrib 000001, competência ${dados.ano}-06.`,
    `Alíquotas nominais de ${dados.ano} (CBS ${pct(aliquotas.cbs)}, IBS UF ${pct(aliquotas.ibsUf)}, IBS município ${pct(aliquotas.ibsMun)}) informadas ao motor, que apura base, reduções e valores.`,
    `Rota ${dados.ufOrigem.sigla} → ${dados.ufDestino.sigla}; o IBS municipal usa o município de referência ${dados.ufDestino.nome} (IBGE ${dados.ufDestino.municipio}).`,
    'O crédito do pagador é limitado ao CBS/IBS efetivamente destacado no documento: o que excede o destaque não é creditável.',
    'A regra de crédito do regime (faixas de Simples, Simples híbrido e autônomo/MEI) é uma estimativa setorial e está sinalizada como tal.',
  ]

  if (dados.tipoOperacao === 'B2C') {
    lista.push('B2C: o pagador é o consumidor final e não aproveita o crédito; o custo líquido é o preço.')
  }
  if (avaliacao.limitadoAoTeto) {
    lista.push('O crédito estimado do regime excedeu o destaque do ano e foi truncado no teto apurado pelo motor.')
  }
  if (estado.motor.online) {
    lista.push(`Motor em ${MOTOR_URL} · API ${estado.motor.versao ?? '—'} · base ${estado.motor.baseDados ?? '—'}.`)
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
    ufOrigem: entrada.ufOrigem ?? 'SP',
    ufDestino: entrada.ufDestino ?? 'BA',
  }

  const avaliadas = await Promise.all(
    cenarios.map(async (cenario, indice) => {
      const nome = String(cenario?.nome ?? '').trim().slice(0, 80) || `Transportadora ${indice + 1}`
      const simulacao = await simular({
        ...base,
        valorFrete: cenario?.preco ?? cenario?.valorFrete,
        perfil: cenario?.perfil ?? cenario?.perfilTransportador,
        taxaCredito: cenario?.taxaCredito,
      })
      return { nome, simulacao }
    }),
  )

  const ordenadas = [...avaliadas].sort((a, b) => {
    const diferenca = a.simulacao.resultado.custoLiquido - b.simulacao.resultado.custoLiquido
    if (Math.abs(diferenca) > 0.005) return diferenca
    return a.simulacao.entrada.valorFrete - b.simulacao.entrada.valorFrete
  })

  const menorLiquido = ordenadas[0].simulacao.resultado.custoLiquido
  const maiorLiquido = ordenadas[ordenadas.length - 1].simulacao.resultado.custoLiquido

  const ranking = ordenadas.map((item, indice) => {
    const simulacao = item.simulacao
    return {
      posicao: indice + 1,
      nome: item.nome,
      perfil: simulacao.entrada.perfil,
      valorFrete: simulacao.entrada.valorFrete,
      credito: simulacao.resultado.credito,
      percentualCredito: simulacao.resultado.percentualCredito,
      custoLiquido: simulacao.resultado.custoLiquido,
      diferencaParaMelhor: arredondar(simulacao.resultado.custoLiquido - menorLiquido),
      alerta: simulacao.resultado.alerta,
      simulacao,
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
    resumo = `Os ${ranking.length} fretes custam ${brl(precos[0])} no nominal. No líquido, ${vencedor.nome} sai por ${brl(vencedor.custoLiquido)} — ${brl(economia)} a menos que ${ranking[ranking.length - 1].nome}.`
  } else {
    resumo = `${vencedor.nome} tem o menor custo líquido: ${brl(vencedor.custoLiquido)}, ${brl(economia)} abaixo do pior cenário no líquido.`
  }

  return {
    entrada: {
      ano: ranking[0].simulacao.entrada.ano,
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': conteudo.length,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
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

  return {
    perfis: PERFIS.map((perfil) => ({
      ...perfil,
      faixa: faixaTexto(perfil),
    })),
    tiposOperacao: TIPOS_OPERACAO,
    ufs: UFS,
    anos: ANOS.map((ano) => ({
      ano,
      rotulo: tabela[ano].rotulo,
      fase: tabela[ano].fase,
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
      versao: motor.versao ?? null,
      baseDados: motor.baseDados ?? null,
      fonteAliquotas: estado.fonteAliquotas,
      aviso: motor.aviso ?? null,
      erro: motor.online ? null : motor.erro ?? null,
    },
    nbs: NBS_FRETE,
  }
}

const rotas = {
  'GET /api/opcoes': async () => ({ status: 200, corpo: await opcoes() }),

  'GET /api/saude': async () => {
    const motor = await verificarMotor()
    estado.motor = motor
    return {
      status: 200,
      corpo: {
        ok: true,
        motor: { online: motor.online, url: MOTOR_URL, versao: motor.versao, baseDados: motor.baseDados },
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

  'POST /api/comparar': async (req) => {
    const corpo = await lerCorpo(req)
    return { status: 200, corpo: await comparar(corpo) }
  },
}

const servidor = http.createServer(async (req, res) => {
  const inicio = Date.now()
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
  const caminho = decodeURIComponent(url.pathname)

  try {
    if (caminho.startsWith('/api/')) {
      const chave = `${req.method} ${caminho}`
      const rota = rotas[chave]
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
    const status = erro instanceof HttpError ? erro.status : erro instanceof MotorError ? 502 : 500
    const mensagem =
      erro instanceof HttpError || erro instanceof MotorError ? erro.message : 'Erro interno ao processar a simulação.'
    if (status >= 500) console.error(`[erro] ${req.method} ${caminho}`, erro)
    responderJson(res, status, {
      erro: mensagem,
      detalhe: erro?.detalhe ?? erro?.corpo ?? null,
    })
  }
})

servidor.listen(PORTA, HOST, async () => {
  console.log('')
  console.log(`  Frete Líquido · simulador do pagador de frete`)
  console.log(`  Interface  http://${HOST}:${PORTA}`)
  console.log(`  Motor      ${MOTOR_URL}`)

  try {
    const motor = await carregarTabela({ forcar: true })
    const versao = estado.motor.versao ? ` · API ${estado.motor.versao}` : ''
    console.log(
      `  Status     motor ${estado.motor.online ? 'online' : 'OFFLINE'}${versao} · base ${estado.motor.baseDados ?? '—'} · alíquotas: ${estado.fonteAliquotas}`,
    )
    console.log(`  Anos       ${ANOS.join(', ')}`)
    console.log('')
  } catch (erro) {
    console.log(`  Status     motor indisponível: ${erro.message}`)
  }
})
