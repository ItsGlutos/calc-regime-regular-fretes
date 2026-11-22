/**
 * Cliente do motor oficial da Receita:
 * https://github.com/ReceitaFederal/calculadora-rtc-regime-regular
 *
 * Nenhuma alíquota de CBS/IBS é calculada neste arquivo. Toda a apuração do
 * tributo é feita pelo motor; aqui só montamos a operação de CT-e e lemos a
 * resposta bruta que fica disponível para auditoria na interface.
 */

export const MOTOR_URL = String(process.env.MOTOR_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '')

export const TIMEOUT_PADRAO = Number(process.env.MOTOR_TIMEOUT_MS ?? 20000)

export class MotorError extends Error {
  constructor(mensagem, { status = null, corpo = null, causa = null } = {}) {
    super(mensagem)
    this.name = 'MotorError'
    this.status = status
    this.corpo = corpo
    this.causa = causa
  }
}

async function requisitar(caminho, { metodo = 'GET', corpo, timeout = TIMEOUT_PADRAO } = {}) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), timeout)

  try {
    const resposta = await fetch(`${MOTOR_URL}${caminho}`, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controlador.signal,
    })

    const texto = await resposta.text()
    let json = null
    try {
      json = JSON.parse(texto)
    } catch {
      json = null
    }

    if (!resposta.ok) {
      const detalhe =
        (json && (json.detail || json.title || (Array.isArray(json.erros) ? json.erros[0]?.detail : null))) ||
        texto.slice(0, 400) ||
        `HTTP ${resposta.status}`
      throw new MotorError(`Motor oficial respondeu HTTP ${resposta.status}: ${detalhe}`, {
        status: resposta.status,
        corpo: json ?? texto,
      })
    }

    return { status: resposta.status, headers: Object.fromEntries(resposta.headers), texto, json }
  } catch (erro) {
    if (erro instanceof MotorError) throw erro
    if (erro?.name === 'AbortError') {
      throw new MotorError(`Motor oficial não respondeu em ${Math.round(timeout / 1000)}s (${MOTOR_URL}).`, {
        causa: erro,
      })
    }
    throw new MotorError(
      `Não foi possível falar com o motor oficial em ${MOTOR_URL}. Suba o serviço e tente de novo. (${erro?.message ?? erro})`,
      { causa: erro },
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Monta a operação de CT-e de transporte de carga: um item, NBS de frete
 * rodoviário, CST 000 e cClassTrib 000001 (tributação integral).
 */
export function montarOperacao({ valorFrete, ano, uf, municipio, aliquotas }) {
  const item = {
    numero: 1,
    nbs: '105011220',
    cst: '000',
    cClassTrib: '000001',
    baseCalculo: Number(valorFrete),
  }

  // A partir de 2027 o motor exige as alíquotas nominais do ano; em 2026 elas
  // são proibidas e o motor usa o destaque da fase de teste (0,90% + 0,10%).
  if (Number(ano) >= 2027 && aliquotas) {
    item.aliquotasNominais = {
      cbs: Number(aliquotas.cbs),
      ibsEstadual: Number(aliquotas.ibsUf),
      ibsMunicipal: Number(aliquotas.ibsMun),
    }
  }

  return {
    id: `frete-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`,
    versao: '1.0.0',
    dhFatoGerador: `${ano}-06-15T10:00:00-03:00`,
    municipio: Number(municipio),
    uf,
    itens: [item],
  }
}

/** Lê o grupo IBS/CBS do item e devolve o destaque e a memória do motor. */
export function interpretarResposta(resposta) {
  const objeto = Array.isArray(resposta?.objetos) ? resposta.objetos[0] : null
  const grupo = objeto?.tribCalc?.IBSCBS ?? null
  const ibscbs = grupo?.gIBSCBS ?? null

  if (!ibscbs) {
    const erro = objeto?.erros?.[0]?.detail ?? 'resposta sem o grupo IBS/CBS'
    throw new MotorError(`O motor não apurou CBS/IBS para a operação: ${erro}.`)
  }

  const numero = (valor) => {
    const n = Number(valor)
    return Number.isFinite(n) ? n : 0
  }

  const vCbs = numero(ibscbs.gCBS?.vCBS)
  const vIbsUf = numero(ibscbs.gIBSUF?.vIBSUF)
  const vIbsMun = numero(ibscbs.gIBSMun?.vIBSMun)
  const vIbs = ibscbs.vIBS !== undefined ? numero(ibscbs.vIBS) : vIbsUf + vIbsMun

  const total = resposta?.total?.tribCalc?.IBSCBSTot ?? {}
  const creditoPresumido = numero(total?.gIBS?.vCredPres) + numero(total?.gCBS?.vCredPres)

  return {
    vBC: numero(ibscbs.vBC),
    vCBS: vCbs,
    vIBS: vIbs,
    vIBSUf: vIbsUf,
    vIBSMun: vIbsMun,
    destaque: vCbs + vIbs,
    aliquotaCbs: numero(ibscbs.gCBS?.pCBS),
    aliquotaIbsUf: numero(ibscbs.gIBSUF?.pIBSUF),
    aliquotaIbsMun: numero(ibscbs.gIBSMun?.pIBSMun),
    reducao: {
      cbs: ibscbs.gCBS?.gRed?.pRedAliq ?? null,
      ibsUf: ibscbs.gIBSUF?.gRed?.pRedAliq ?? null,
      ibsMun: ibscbs.gIBSMun?.gRed?.pRedAliq ?? null,
    },
    creditoPresumido,
    calculoSimulado: objeto?.calculoSimulado === true,
    memoriaCalculo: grupo?.memoriaCalculo ?? null,
    estado: objeto?.estadoItem ?? null,
  }
}

/** Uma apuração de CBS/IBS para o frete, com a resposta bruta preservada. */
export async function calcularFrete({ valorFrete, ano, uf, municipio, aliquotas }) {
  const operacao = montarOperacao({ valorFrete, ano, uf, municipio, aliquotas })
  const { status, headers, texto, json } = await requisitar('/api/calculadora/regime-geral', {
    metodo: 'POST',
    corpo: operacao,
  })

  // O endpoint de cálculo carrega os headers de versão; os endpoints de catálogo
  // não. Guardamos a última versão vista para o selo da interface.
  if (headers['x-calc-app-version']) versaoObservada = headers['x-calc-app-version']
  if (headers['x-calc-db-version']) baseObservada = headers['x-calc-db-version']

  return {
    operacao,
    status,
    headers: {
      aplicacao: headers['x-calc-app-version'] ?? null,
      baseDados: headers['x-calc-db-version'] ?? null,
      avisoSimulado: headers['x-warning-dados-simulados'] ?? null,
    },
    resposta: json,
    texto,
    ...interpretarResposta(json),
  }
}

let versaoObservada = null
let baseObservada = null

let cacheParametros = { em: 0, dados: null }

/**
 * Catálogo de transição do motor (alíquotas por ano). Se o motor em execução
 * expuser esse endpoint, ele é a fonte das alíquotas nominais; senão a interface
 * cai na tabela local da LC 214/2025.
 */
export async function parametrosMotor({ forcar = false } = {}) {
  const agora = Date.now()
  if (!forcar && cacheParametros.dados && agora - cacheParametros.em < 60_000) {
    return cacheParametros.dados
  }

  const { headers, json } = await requisitar('/api/calculadora/frete/parametros', { timeout: 8000 })
  cacheParametros = { em: agora, dados: { ...json, _headers: headers } }
  return cacheParametros.dados
}

/** Versão do motor e data da base, para o selo da interface. */
export async function verificarMotor() {
  try {
    const parametros = await parametrosMotor()
    const headers = parametros._headers ?? {}
    return {
      online: true,
      url: MOTOR_URL,
      versao: headers['x-calc-app-version'] ?? versaoObservada,
      baseDados: parametros.versaoBaseDados ?? headers['x-calc-db-version'] ?? baseObservada,
      fonteAliquotas: 'motor',
      parametrosTransicao: parametros.parametrosTransicao ?? null,
    }
  } catch (erro) {
    // Um motor oficial “puro” (sem o catálogo de transição) continua sendo um
    // motor válido: testamos o endpoint de cálculo antes de dizer que está fora.
    if (await motorOperacional()) {
      return {
        online: true,
        url: MOTOR_URL,
        versao: versaoObservada,
        baseDados: baseObservada,
        fonteAliquotas: 'tabela-local',
        parametrosTransicao: null,
        aviso: 'Catálogo de transição indisponível; alíquotas do cronograma local (LC 214/2025).',
      }
    }
    return {
      online: false,
      url: MOTOR_URL,
      versao: null,
      baseDados: null,
      fonteAliquotas: 'tabela-local',
      erro: erro?.message ?? String(erro),
      parametrosTransicao: null,
    }
  }
}

/** Teste leve do endpoint oficial de cálculo, usado quando o catálogo falha. */
async function motorOperacional() {
  try {
    const { json } = await requisitar('/api/calculadora/regime-geral', {
      metodo: 'POST',
      timeout: 8000,
      corpo: montarOperacao({ valorFrete: 1, ano: 2026, uf: 'SP', municipio: 3550308, aliquotas: null }),
    })
    return Boolean(json?.objetos?.[0]?.tribCalc?.IBSCBS)
  } catch {
    return false
  }
}
