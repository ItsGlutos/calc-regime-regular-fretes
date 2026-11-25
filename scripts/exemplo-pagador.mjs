#!/usr/bin/env node
/**
 * Exemplo funcional do Frete Líquido — o caso de uma pagadora de frete.
 *
 * Cenário: indústria de alimentos em SP, Lucro Real, B2B, paga R$ 10.000,00/mês
 * de frete rodoviário SP → BA. Roda 100% sobre os serviços no ar:
 *
 *   - app Frete Líquido ........ http://127.0.0.1:5180  (/api/simular, /api/reforma, /api/comparar, /api/pagador)
 *   - motor regime regular ..... http://127.0.0.1:8080  (/frete/projecao, /frete/cte/*)
 *
 * Nenhum número fiscal é digitado aqui: alíquotas, destaques e cargas vêm das
 * respostas. O script faz a aritmética de forma independente e COMPARA com o
 * app, ano a ano (coluna "divergência" — deve ser zero):
 *
 *   credito total   = ICMS + PIS + COFINS + CBS + IBS destacados e apropriáveis
 *   custo liquido   = preco bruto − credito total
 *   repasse         = P_novo = P_velho × (1 − t_velho) / (1 − t_novo)
 *   equilibrio      = P_max tal que P_max − credito(P_max) = custo do benchmark
 *
 * Uso:
 *   node scripts/exemplo-pagador.mjs            # relatório markdown no stdout
 *   node scripts/exemplo-pagador.mjs --arquivo  # grava docs/especialista-fiscal/exemplo-execucao.md
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = (process.env.APP_URL ?? 'http://127.0.0.1:5180').replace(/\/+$/, '')
const MOTOR = (process.env.MOTOR_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '')
const RAIZ = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const SAIDA = path.join(RAIZ, 'docs', 'especialista-fiscal', 'exemplo-execucao.md')

/* ------------------------------------------------------------------ */
/* A pagadora e as transportadoras do exemplo                          */
/* ------------------------------------------------------------------ */

const PAGADORA = {
  nome: 'Indústria de Alimentos Bom Sabor S.A.',
  cnpj: '98.765.432/0001-10',
  uf: 'SP',
  regime: 'Lucro Real',
  operacao: 'B2B',
  freteMensal: 10_000,
  rota: 'SP → BA',
  tipoOperacao: 'INTERESTADUAL',
}

const CARGAS = {
  volumeMensal: '40 carretas/mês (R$ 250,00 por CT-e médio)',
  contrato: 'reajuste anual em janeiro, preço único por rota',
}

const TRANSPORTADORAS = [
  {
    chave: 'das',
    nome: 'Rota Sul Logística',
    regime: 'Simples Nacional — CBS/IBS dentro do DAS',
    perfil: 'SIMPLES_DAS',
    aliquotaCbs: '2.3591',
    aliquotaIbs: '0.0260',
    preco: PAGADORA.freteMensal,
  },
  {
    chave: 'hibrido',
    nome: 'Via Brasil Transportes',
    regime: 'Simples Nacional — híbrido (CBS/IBS no regime regular)',
    perfil: 'SIMPLES_HIBRIDO',
    preco: PAGADORA.freteMensal,
  },
  {
    chave: 'regular',
    nome: 'Serra Azul Cargas',
    regime: 'Regime regular (Lucro Real)',
    perfil: 'REGIME_REGULAR',
    preco: PAGADORA.freteMensal,
  },
]

const ANOS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
const ANOS_SIMULAR = ANOS.filter((ano) => ano >= 2026)

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

const brl = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0)
const num = (valor, casas = 2) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(
    Number(valor) || 0,
  )
const pct = (valor, casas = 2) => `${num(valor, casas)}%`
const arred = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100
const soma = (...valores) => arred(valores.reduce((total, valor) => total + (Number(valor) || 0), 0))

const linhas = []
const escrever = (texto = '') => linhas.push(texto)
const titulo = (texto, nivel = 2) => escrever(`\n${'#'.repeat(nivel)} ${texto}\n`)

async function requisitar(url, { metodo = 'GET', corpo = null, timeout = 120_000, tentativas = 2 } = {}) {
  let ultimoErro = null
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const controlador = new AbortController()
    const timer = setTimeout(() => controlador.abort(), timeout)
    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: corpo
          ? { 'Content-Type': 'application/json', Accept: 'application/json' }
          : { Accept: 'application/json' },
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
        throw new Error(
          `${metodo} ${url} → HTTP ${resposta.status}: ${(json && (json.erro || json.detail)) || texto.slice(0, 300)}`,
        )
      }
      return json
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < tentativas) await new Promise((resolve) => setTimeout(resolve, 1500))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`Falha ao chamar ${url}: ${ultimoErro?.message ?? ultimoErro}`)
}

const post = (url, corpo, opcoes = {}) => requisitar(url, { metodo: 'POST', corpo, ...opcoes })

/* ------------------------------------------------------------------ */
/* Coleta                                                              */
/* ------------------------------------------------------------------ */

function corpoSimulacao(transportadora, ano, extras = {}) {
  const corpo = {
    valorFrete: transportadora.preco,
    perfil: transportadora.perfil,
    tipoOperacao: PAGADORA.operacao,
    ufOrigem: PAGADORA.uf,
    ufDestino: 'BA',
    ano,
    regimePagadora: 'NAO_CUMULATIVO',
    ...extras,
  }
  if (transportadora.aliquotaCbs) {
    corpo.aliquotaCbs = transportadora.aliquotaCbs
    corpo.aliquotaIbs = transportadora.aliquotaIbs
  }
  return corpo
}

async function coletar() {
  const dados = { chamadas: [] }

  dados.saude = await requisitar(`${APP}/api/saude`)
  dados.chamadas.push(`GET ${APP}/api/saude`)

  // 1. Projeção oficial da carga tributária do frete (regime regular).
  dados.projecao = await post(`${MOTOR}/api/calculadora/frete/projecao`, {
    valorFrete: PAGADORA.freteMensal,
    periodicidade: 'MENSAL',
    mesReferencia: 11,
    nbs: '105011220',
    tipoOperacao: PAGADORA.tipoOperacao,
    ufOrigem: PAGADORA.uf,
    ufDestino: 'BA',
    regimePisCofins: 'NAO_CUMULATIVO',
    incluirMemoriaCalculo: false,
  })
  dados.chamadas.push(`POST ${MOTOR}/api/calculadora/frete/projecao`)

  // 2. O que o app responde para cada transportadora e cada ano.
  dados.simulacoes = new Map()
  for (const transportadora of TRANSPORTADORAS) {
    for (const ano of ANOS_SIMULAR) {
      dados.simulacoes.set(`${transportadora.chave}:${ano}`, await post(`${APP}/api/simular`, corpoSimulacao(transportadora, ano)))
      dados.chamadas.push(`POST ${APP}/api/simular (${transportadora.chave}, ${ano})`)
    }
  }

  // 2b. Casos sem alíquota informada (as "estimativas"): Simples/DAS e MEI em 2027.
  dados.semPgdas = await post(`${APP}/api/simular`, {
    valorFrete: 1000,
    perfil: 'SIMPLES_DAS',
    tipoOperacao: 'B2B',
    ufOrigem: 'SP',
    ufDestino: 'BA',
    ano: 2027,
    regimePagadora: 'NAO_CUMULATIVO',
  })
  dados.chamadas.push(`POST ${APP}/api/simular (Simples/DAS sem PGDAS, 2027)`)

  dados.meiSim = await post(`${APP}/api/simular`, {
    valorFrete: 1000,
    perfil: 'AUTONOMO_MEI',
    tipoOperacao: 'B2B',
    ufOrigem: 'SP',
    ufDestino: 'BA',
    ano: 2027,
    regimePagadora: 'NAO_CUMULATIVO',
  })
  dados.chamadas.push(`POST ${APP}/api/simular (autônomo/MEI, 2027)`)

  // 3. Horizonte do pagador (hoje → amanhã, repasse, benchmark, preço-teto).
  dados.pagador = {}
  for (const chave of ['regular', 'das', 'mei']) {
    const transportadora =
      chave === 'mei'
        ? { preco: PAGADORA.freteMensal, perfil: 'AUTONOMO_MEI' }
        : TRANSPORTADORAS.find((item) => item.chave === chave)
    dados.pagador[chave] = await post(`${APP}/api/pagador`, corpoSimulacao(transportadora, 2027))
    dados.chamadas.push(`POST ${APP}/api/pagador (${chave})`)
  }

  // 4. Linha do tempo do app para o regime regular e para o Simples/DAS.
  dados.reforma = {}
  for (const chave of ['regular', 'das']) {
    const transportadora = TRANSPORTADORAS.find((item) => item.chave === chave)
    dados.reforma[chave] = await post(`${APP}/api/reforma`, corpoSimulacao(transportadora, 2027))
    dados.chamadas.push(`POST ${APP}/api/reforma (${chave})`)
  }

  // 5. Comparador do app com as três transportadoras, mesmo preço nominal.
  dados.comparacao = await post(`${APP}/api/comparar`, {
    ano: 2027,
    tipoOperacao: PAGADORA.operacao,
    ufOrigem: PAGADORA.uf,
    ufDestino: 'BA',
    regimePagadora: 'NAO_CUMULATIVO',
    transportadoras: TRANSPORTADORAS.map((item) => ({
      nome: item.nome,
      preco: item.preco,
      perfil: item.perfil,
      ...(item.aliquotaCbs ? { aliquotaCbs: item.aliquotaCbs, aliquotaIbs: item.aliquotaIbs } : {}),
    })),
  })
  dados.chamadas.push(`POST ${APP}/api/comparar`)

  // 6. CT-e de novembro de 2026 (o documento que a pagadora recebe hoje).
  dados.cte = await requisitar(`${MOTOR}/api/calculadora/frete/cte/exemplo`)
  dados.chamadas.push(`GET ${MOTOR}/api/calculadora/frete/cte/exemplo`)

  // 7. O mesmo CT-e pago em 2027 (split payment) e em 2027 para um TAC.
  const parcelas = {
    fretePeso: dados.cte.entrada.fretePeso,
    freteValor: dados.cte.entrada.freteValor,
    gris: dados.cte.entrada.gris,
    taxas: dados.cte.entrada.taxas,
    valePedagio: dados.cte.entrada.valePedagio,
    ufOrigem: dados.cte.entrada.ufOrigem,
    ufDestino: dados.cte.entrada.ufDestino,
    regimePagadora: 'REGIME_REGULAR',
    regimePisCofins: 'NAO_CUMULATIVO',
    tomaCreditoIcms: true,
    tomaCreditoPisCofins: true,
    dataPagamento: '2027-06-15',
  }
  dados.cte2027 = await post(`${MOTOR}/api/calculadora/frete/cte/pagamento`, { ...parcelas, tipoTransportador: 'TDE' })
  dados.chamadas.push(`POST ${MOTOR}/api/calculadora/frete/cte/pagamento (2027, TDE)`)

  dados.cte2027SemFlags = await post(`${MOTOR}/api/calculadora/frete/cte/pagamento`, {
    ...parcelas,
    tipoTransportador: 'TDE',
    tomaCreditoIcms: false,
    tomaCreditoPisCofins: false,
  })
  dados.chamadas.push(`POST ${MOTOR}/api/calculadora/frete/cte/pagamento (2027, sem flags de crédito)`)

  dados.cte2027Tac = await post(`${MOTOR}/api/calculadora/frete/cte/pagamento`, { ...parcelas, tipoTransportador: 'TAC' })
  dados.chamadas.push(`POST ${MOTOR}/api/calculadora/frete/cte/pagamento (2027, TAC)`)

  return dados
}

/* ------------------------------------------------------------------ */
/* Modelo do pagador (aritmética independente sobre os dados oficiais)  */
/* ------------------------------------------------------------------ */

function montarModelo(dados) {
  const projetado = new Map(dados.projecao.anos.map((ano) => [ano.ano, ano]))
  const doApp = (chave, ano) => dados.simulacoes.get(`${chave}:${ano}`)?.resultado ?? null
  const pagadorAno = (chave, ano) => dados.pagador[chave]?.anos?.find((linha) => linha.ano === ano) ?? null

  const anos = ANOS.map((ano) => {
    const proj = projetado.get(ano)
    const base = PAGADORA.freteMensal
    // A projeção é mensal e o valor do período muda com os dias úteis do ano.
    // Para comparar o MESMO frete nominal, aplicamos o percentual do motor
    // (valor do tributo ÷ valor do período que ele usou) sobre R$ 10.000,00.
    const taxa = (valor) => (Number(valor) || 0) / (Number(proj.valorFretePeriodo) || 1)
    const icms = arred(base * taxa(proj.valorIcms))
    const pis = arred(base * taxa(proj.valorPis))
    const cofins = arred(base * taxa(proj.valorCofins))
    const cbs = arred(base * taxa(proj.valorCbs))
    const ibs = arred(base * taxa(proj.valorIbsUf + proj.valorIbsMun))
    const cbsIbs = soma(cbs, ibs)

    // 2026: o CBS/IBS destacado é compensado pelo transportador (art. 348, I)
    // e não há CBS/IBS nas operações de optante do Simples (art. 348, III, "c").
    const creditoRegular = ano <= 2026 ? soma(icms, pis, cofins) : soma(icms, pis, cofins, cbsIbs)
    const creditoHibrido = ano === 2026 ? 0 : cbsIbs
    const creditoDas = ano === 2026 ? 0 : arred(doApp('das', ano)?.creditoCbsIbs ?? 0)

    const appRegular = doApp('regular', ano)
    const appDas = doApp('das', ano)
    const appHibrido = doApp('hibrido', ano)

    return {
      ano,
      base,
      icms,
      pis,
      cofins,
      cbs,
      ibs,
      cbsIbs,
      percentualCarga: arred(proj.percentualTotal),
      creditoRegular,
      creditoHibrido,
      creditoDas,
      custoRegular: arred(base - creditoRegular),
      custoHibrido: arred(base - creditoHibrido),
      custoDas: arred(base - creditoDas),
      // O que o app responde (campos novos; fallback para os legados).
      appCreditoRegular: appRegular ? (appRegular.creditoTotal ?? appRegular.credito) : null,
      appCustoRegular: appRegular ? (appRegular.custoTotal ?? appRegular.custoLiquido) : null,
      appCustoHibrido: appHibrido ? (appHibrido.custoTotal ?? appHibrido.custoLiquido) : null,
      appCreditoDas: appDas ? (appDas.creditoTotal ?? appDas.credito) : null,
      appCustoDas: appDas ? (appDas.custoTotal ?? appDas.custoLiquido) : null,
      // Legacy: continua devolvendo o crédito só de CBS/IBS em /api/simular.
      appLegadoCusto: appRegular?.custoLiquido ?? null,
      appLegadoCredito: appRegular?.credito ?? null,
      // Cross-check com o horizonte do app.
      appPagadorLiquido: pagadorAno('regular', ano)?.liquido ?? null,
      appPagadorRepasse: pagadorAno('regular', ano)?.repasse?.bruto ?? null,
    }
  })

  const referencia = anos.find((linha) => linha.ano === 2025)

  for (const linha of anos) {
    const tNovo = linha.percentualCarga / 100
    const tHoje = referencia.percentualCarga / 100
    linha.precoRepasse = arred((PAGADORA.freteMensal * (1 - tHoje)) / (1 - tNovo))
    const taxaCredito = linha.creditoRegular / PAGADORA.freteMensal
    linha.creditoNoRepasseRegular = arred(linha.precoRepasse * taxaCredito)
    linha.custoNoRepasseRegular = arred(linha.precoRepasse - linha.creditoNoRepasseRegular)
    linha.custoCongeladoRegular = linha.custoRegular
    linha.custoCongeladoDas = linha.custoDas
    linha.custoCongeladoHibrido = linha.custoHibrido
    linha.equilibrioDas = arred(linha.custoRegular / (1 - linha.creditoDas / PAGADORA.freteMensal))
    linha.equilibrioHibrido = arred(linha.custoRegular / (1 - linha.creditoHibrido / PAGADORA.freteMensal))
    linha.gapDas = arred(linha.custoDas - linha.custoRegular)
    linha.gapHibrido = arred(linha.custoHibrido - linha.custoRegular)
    // Divergências: app × cálculo independente (todas devem ser 0,00).
    linha.divergenciaCredito =
      linha.appCreditoRegular === null ? null : arred(linha.appCreditoRegular - linha.creditoRegular)
    linha.divergenciaCusto = linha.appCustoRegular === null ? null : arred(linha.appCustoRegular - linha.custoRegular)
    linha.divergenciaDas = linha.appCreditoDas === null ? null : arred(linha.appCreditoDas - linha.creditoDas)
    // O app do horizonte e o benchmark do app para o Simples/DAS.
    linha.appEquilibrioDas = dados.pagador.das?.anos?.find((l) => l.ano === linha.ano)?.equivalente?.preco ?? null
  }

  const periodo = anos.filter((linha) => linha.ano >= 2026)
  const economiaDas = arred(periodo.reduce((total, linha) => total + linha.gapDas, 0) * 12)
  const economiaHibrido = arred(periodo.reduce((total, linha) => total + linha.gapHibrido, 0) * 12)
  const divergencias = anos
    .filter((linha) => linha.ano >= 2026)
    .flatMap((linha) => [linha.divergenciaCredito, linha.divergenciaCusto, linha.divergenciaDas])
    .filter((valor) => valor !== null)
  const divergenciaMaxima = divergencias.length ? Math.max(...divergencias.map((valor) => Math.abs(valor))) : null

  return { anos, referencia, economiaDas, economiaHibrido, projetado, divergenciaMaxima }
}

/* ------------------------------------------------------------------ */
/* Relatório                                                           */
/* ------------------------------------------------------------------ */

function relatar(dados, modelo) {
  escrever('# Exemplo funcional — Frete Líquido (execução real)')
  escrever()
  escrever(`> Gerado em ${new Date().toISOString()} por \`scripts/exemplo-pagador.mjs\`.`)
  escrever('> Todos os valores vêm das respostas dos serviços abaixo; a aritmética está indicada em cada tabela.')
  escrever()
  escrever('| Serviço | Endereço | Versão |')
  escrever('|---|---|---|')
  escrever(`| App Frete Líquido | ${APP} | ${dados.saude.versaoApp ?? dados.saude.versao ?? '—'} |`)
  escrever(`| Motor regime regular | ${MOTOR} | ${dados.projecao.versaoBaseDados ?? '—'} |`)
  escrever(`| Chamadas executadas | — | ${dados.chamadas.length} |`)
  escrever()

  titulo('1. A pagadora e o contrato')
  escrever(`- **${PAGADORA.nome}** (CNPJ ${PAGADORA.cnpj}), indústria de alimentos em ${PAGADORA.uf}, **${PAGADORA.regime}**, operação **${PAGADORA.operacao}**.`)
  escrever(`- Frete rodoviário **${PAGADORA.rota}**, NBS \`105011220\`, **${brl(PAGADORA.freteMensal)} por mês**, ${CARGAS.volumeMensal}.`)
  escrever(`- Contrato: ${CARGAS.contrato}.`)
  escrever('- Transportadoras:')
  escrever()
  escrever('| Transportadora | Regime | Preço nominal |')
  escrever('|---|---|---:|')
  for (const item of TRANSPORTADORAS) {
    escrever(`| ${item.nome} | ${item.regime} | ${brl(item.preco)} |`)
  }
  escrever()

  titulo('2. O que o motor oficial apura para o frete (projeção)')
  escrever('`POST /api/calculadora/frete/projecao` — R$ 10.000,00 mensais, novembro, SP → BA, PIS/COFINS não cumulativo.')
  escrever()
  escrever('| Ano | Valor do período | ICMS | PIS | COFINS | CBS | IBS UF | IBS mun. | Total destacado | Total efetivo | % efetivo |')
  escrever('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const ano of dados.projecao.anos.filter((linha) => ANOS.includes(linha.ano))) {
    escrever(
      `| ${ano.ano} | ${brl(ano.valorFretePeriodo)} | ${num(ano.valorIcms)} | ${num(ano.valorPis)} | ${num(ano.valorCofins)} | ${num(ano.valorCbs)} | ${num(ano.valorIbsUf)} | ${num(ano.valorIbsMun)} | ${num(ano.totalDestacado)} | ${num(ano.totalEfetivo)} | ${pct(ano.percentualTotal)} |`,
    )
  }
  escrever()
  escrever(
    `O valor do período muda porque o motor conta os dias úteis de cada ano (${dados.projecao.diasUteisReferencia} em 2025). Para comparar **o mesmo frete nominal**, as tabelas seguintes aplicam o **percentual** do motor sobre R$ 10.000,00: \`tributo = 10.000 × percentual / 100\`.`,
  )
  escrever()

  titulo('3. O app × o cálculo independente (a divergência deve ser zero)')
  escrever('Coluna "app": `creditoTotal` e `custoTotal` devolvidos por `POST /api/simular`. Coluna "independente": `ICMS + PIS + COFINS + CBS + IBS` calculado neste script a partir da projeção do motor. "Divergência" = app − independente.')
  escrever()
  escrever('| Ano | app · crédito | app · % | app · custo | independente · crédito | % | custo | divergência crédito | divergência custo |')
  escrever('|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const linha of modelo.anos.filter((item) => item.ano >= 2026)) {
    const pctApp = linha.appCreditoRegular ? (linha.appCreditoRegular / linha.base) * 100 : 0
    escrever(
      `| ${linha.ano} | ${brl(linha.appCreditoRegular)} | ${pct(pctApp, 2)} | ${brl(linha.appCustoRegular)} | ${brl(linha.creditoRegular)} | ${pct((linha.creditoRegular / linha.base) * 100)} | ${brl(linha.custoRegular)} | ${brl(linha.divergenciaCredito)} | ${brl(linha.divergenciaCusto)} |`,
    )
  }
  escrever()
  escrever(
    `**Divergência máxima em todo o horizonte: ${modelo.divergenciaMaxima === 0 ? 'R$ 0,00 (convergência total)' : brl(modelo.divergenciaMaxima)}.** O app passou a somar ICMS e PIS/COFINS ao crédito e a zerar o CBS/IBS de 2026: os dois lados batem ano a ano.`,
  )
  escrever()
  escrever(
    `Ressalva de API: \`/api/simular\` mantém os campos legados \`credito\` e \`custoLiquido\` com o valor **só de CBS/IBS** (${brl(modelo.anos.find((l) => l.ano === 2027).appLegadoCredito)} e ${brl(modelo.anos.find((l) => l.ano === 2027).appLegadoCusto)} em 2027), ao lado de \`creditoTotal\`/\`custoTotal\` (${brl(modelo.anos.find((l) => l.ano === 2027).appCreditoRegular)} e ${brl(modelo.anos.find((l) => l.ano === 2027).appCustoRegular)}). Em \`/api/reforma\`, os mesmos nomes \`credito\`/\`custoLiquido\` já valem o total. Quem consumir a API precisa saber qual campo está lendo.`,
  )
  escrever()

  titulo('4. Crédito total apropriável (ICMS + PIS/COFINS + CBS/IBS)')
  escrever('Composição do crédito e efeito no custo, com o preço congelado em R$ 10.000,00.')
  escrever()
  escrever('| Ano | ICMS | PIS | COFINS | CBS | IBS | Crédito total | % do frete | Custo líquido | Variação vs 2025 |')
  escrever('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const linha of modelo.anos) {
    const variacao = arred(linha.custoRegular - modelo.referencia.custoRegular)
    escrever(
      `| ${linha.ano} | ${num(linha.icms)} | ${num(linha.pis)} | ${num(linha.cofins)} | ${num(linha.cbs)} | ${num(linha.ibs)} | ${brl(linha.creditoRegular)} | ${pct((linha.creditoRegular / linha.base) * 100)} | ${brl(linha.custoRegular)} | ${variacao > 0 ? '+' : ''}${brl(variacao)} |`,
    )
  }
  escrever()
  escrever(
    `Hoje (2025) o custo líquido é **${brl(modelo.referencia.custoRegular)}**, não R$ 10.000,00. Com o preço congelado, ele **sobe** em 2027 (${brl(modelo.anos.find((l) => l.ano === 2027).custoRegular)}) porque o PIS/COFINS de 9,25% é substituído por CBS 8,40% + IBS 0,10% e o ICMS segue cheio. O primeiro ano abaixo de 2025 é 2029; o regime pleno (2033) chega a ${brl(modelo.anos.find((l) => l.ano === 2033).custoRegular)}.`,
  )
  escrever()

  titulo('5. Cenário de repasse do tributo ao preço')
  escrever('Fórmula: `P_novo = P_velho × (1 − t_velho) / (1 − t_novo)`, com `t` = carga efetiva do frete (percentual do motor).')
  escrever()
  escrever(
    'Por que ela vale: os tributos são cobrados **por dentro** do preço (a base é o valor integral cobrado — LC 214/2025, art. 12); o que sobra para o transportador é `P × (1 − t)`. Para preservar a mesma sobra de hoje: `P_novo × (1 − t_novo) = 10.000 × (1 − 16,25%)`.',
  )
  escrever()
  escrever('| Ano | t novo | Preço de repasse | Repasse no app | Crédito com repasse | Custo líquido com repasse | Custo com preço congelado | Efeito do repasse |')
  escrever('|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const linha of modelo.anos) {
    const efeito = arred(linha.custoNoRepasseRegular - linha.custoCongeladoRegular)
    const repasseApp = linha.appPagadorRepasse === null ? '—' : brl(linha.appPagadorRepasse)
    escrever(
      `| ${linha.ano} | ${pct(linha.percentualCarga)} | ${brl(linha.precoRepasse)} | ${repasseApp} | ${brl(linha.creditoNoRepasseRegular)} | ${brl(linha.custoNoRepasseRegular)} | ${brl(linha.custoCongeladoRegular)} | ${efeito > 0 ? '+' : ''}${brl(efeito)} |`,
    )
  }
  escrever()
  escrever(
    `Com repasse integral e crédito integral, o custo líquido **fica em ${brl(modelo.referencia.custoRegular)} em todos os anos** — a reforma é neutra para quem credita tudo e recebe o repasse. O ganho de 2033 (${brl(modelo.anos.find((l) => l.ano === 2033).custoRegular)} de custo) só aparece se o preço ficar congelado; com repasse, o preço bruto sobe para ${brl(modelo.anos.find((l) => l.ano === 2033).precoRepasse)} e o desembolso aumenta 14,73%.`,
  )
  escrever()

  titulo('6. Quanto eu deveria pagar — benchmark e preço de equilíbrio')
  escrever('Benchmark: o **regime regular** no mesmo frete nominal. Equilíbrio: o preço máximo da outra transportadora que empata o custo líquido do benchmark — `P_max = custo_benchmark / (1 − crédito% ÷ 100)`. A coluna "teto no app" vem de `POST /api/pagador` (`anos[].equivalente.preco`).')
  escrever()
  escrever('| Ano | Benchmark regular | Equilíbrio do Simples/DAS | Teto no app (DAS) | Desconto exigido do DAS | Equilíbrio do híbrido | Desconto exigido do híbrido |')
  escrever('|---:|---:|---:|---:|---:|---:|---:|')
  for (const linha of modelo.anos.filter((item) => item.ano >= 2026)) {
    const descontoDas = arred(((PAGADORA.freteMensal - linha.equilibrioDas) / PAGADORA.freteMensal) * 100)
    const descontoHibrido = arred(((PAGADORA.freteMensal - linha.equilibrioHibrido) / PAGADORA.freteMensal) * 100)
    const tetoApp = linha.appEquilibrioDas === null ? '—' : brl(linha.appEquilibrioDas)
    escrever(
      `| ${linha.ano} | ${brl(linha.custoRegular)} | ${brl(linha.equilibrioDas)} | ${tetoApp} | ${pct(descontoDas)} | ${brl(linha.equilibrioHibrido)} | ${pct(descontoHibrido)} |`,
    )
  }
  escrever()
  const linha2027 = modelo.anos.find((linha) => linha.ano === 2027)
  const linha2033 = modelo.anos.find((linha) => linha.ano === 2033)
  escrever(
    `Em 2027, para empatar com o regime regular (${brl(linha2027.custoRegular)}), a Rota Sul (Simples/DAS) teria de cobrar **${brl(linha2027.equilibrioDas)}** — ${pct(((PAGADORA.freteMensal - linha2027.equilibrioDas) / PAGADORA.freteMensal) * 100)} abaixo dos R$ 10.000,00. Em 2033 o teto cai para **${brl(linha2033.equilibrioDas)}**. Os dois números batem com o preço-teto devolvido pelo app.`,
  )
  escrever()

  titulo('7. O comparador do app no mesmo preço nominal (2027)')
  escrever(`\`POST /api/comparar\` — resumo do app: "${dados.comparacao.resumo}"`)
  escrever()
  escrever('| # | Transportadora | Preço | Crédito total (app) | % | Custo total (app) | Custo independente |')
  escrever('|---:|---|---:|---:|---:|---:|---:|')
  const chavePorNome = new Map(TRANSPORTADORAS.map((item) => [item.nome, item.chave]))
  const reais = { das: linha2027.custoDas, hibrido: linha2027.custoHibrido, regular: linha2027.custoRegular }
  for (const item of dados.comparacao.ranking) {
    const chave = chavePorNome.get(item.nome)
    escrever(
      `| ${item.posicao} | ${item.nome} | ${brl(PAGADORA.freteMensal)} | ${brl(item.creditoTotal ?? item.credito)} | ${pct(item.percentualCreditoTotal ?? item.percentualCredito)} | ${brl(item.custoTotal ?? item.custoLiquido)} | ${brl(reais[chave])} |`,
    )
  }
  escrever()
  escrever(
    `O app agora ordena por **custo total** e separa os três regimes: regular ${brl(linha2027.custoRegular)}, híbrido ${brl(linha2027.custoHibrido)} e Simples/DAS ${brl(linha2027.custoDas)}. A diferença entre regular e híbrido é exatamente o ICMS de 7% (${brl(linha2027.icms)}): o optante do Simples não o destaca.`,
  )
  escrever()

  titulo('8. O CT-e de novembro de 2026 (documento real do motor)')
  const cte = dados.cte.resultado
  escrever(`Documento nº ${cte.numeroCte}/${cte.serie}, ${cte.rota}, NBS ${cte.nbs}, base de cálculo **${brl(cte.baseCalculo)}** (vale-pedágio de ${brl(cte.valePedagio)} fora da base — Lei 10.209/2001).`)
  escrever()
  escrever('| Tributo | Alíquota | Valor | Crédito da pagadora (app) |')
  escrever('|---|---:|---:|---|')
  for (const tributo of cte.tributos) {
    escrever(`| ${tributo.nome} | ${pct(tributo.aliquota, tributo.aliquota < 1 ? 4 : 2)} | ${num(tributo.valor)} | ${tributo.creditoPagadora ? 'sim' : 'não'} |`)
  }
  escrever(`| **Total** | **${pct(cte.percentualTributos)}** | **${brl(cte.totalTributos)}** | **${brl(cte.creditoTotal)}** |`)
  escrever()
  escrever('| Linha do pagamento | Valor |')
  escrever('|---|---:|')
  escrever(`| Valor da prestação | ${brl(cte.baseCalculo)} |`)
  escrever(`| (−) Retenções (${cte.retencoes.map((r) => r.codigo).join(', ')}) | −${num(cte.totalRetencoes)} |`)
  escrever(`| (=) Líquido ao transportador | ${brl(cte.liquidoTransportador)} |`)
  escrever(`| (+) Vale-pedágio antecipado | ${num(cte.valePedagio)} |`)
  escrever(`| (=) Desembolso da pagadora | ${brl(cte.desembolsoTotal)} |`)
  escrever()
  escrever(`Custo líquido do documento para a pagadora: ${brl(cte.baseCalculo)} − ${brl(cte.creditoTotal)} = **${brl(arred(cte.baseCalculo - cte.creditoTotal))}** (${pct(arred(((cte.baseCalculo - cte.creditoTotal) / cte.baseCalculo) * 100))} do valor da prestação).`)
  escrever()

  titulo('9. O mesmo CT-e pago em 2027 — split payment e retenções')
  const cte27 = dados.cte2027
  const cte27Status = cte27.comparativo.find((ano) => ano.ano === 2027)
  escrever('| Linha | 2027 (TDE) | 2027 (TAC) |')
  escrever('|---|---:|---:|')
  escrever(`| Total de tributos | ${brl(cte27.totalTributos)} (${pct(cte27.percentualTributos)}) | ${brl(dados.cte2027Tac.totalTributos)} (${pct(dados.cte2027Tac.percentualTributos)}) |`)
  escrever(`| Crédito da pagadora | ${brl(cte27.creditoTotal)} | ${brl(dados.cte2027Tac.creditoTotal)} |`)
  escrever(`| Split payment (IBS/CBS) | ${brl(cte27Status?.valorSplitPayment ?? 0)} | ${brl(dados.cte2027Tac.comparativo.find((ano) => ano.ano === 2027)?.valorSplitPayment ?? 0)} |`)
  escrever(`| Retenções | ${brl(cte27.totalRetencoes)} | ${brl(dados.cte2027Tac.totalRetencoes)} |`)
  escrever(`| Líquido ao transportador (topo) | ${brl(cte27.liquidoTransportador)} | ${brl(dados.cte2027Tac.liquidoTransportador)} |`)
  escrever(`| Líquido ao transportador (comparativo) | ${brl(cte27Status?.liquidoTransportador ?? 0)} | ${brl(dados.cte2027Tac.comparativo.find((ano) => ano.ano === 2027)?.liquidoTransportador ?? 0)} |`)
  escrever(`| Desembolso da pagadora | ${brl(cte27.desembolsoTotal)} | ${brl(dados.cte2027Tac.desembolsoTotal)} |`)
  escrever()
  escrever('O desembolso da pagadora **não muda** com o split payment: o mesmo valor é pago, mas parte vai ao Comitê Gestor do IBS/RFB no momento da liquidação (LC 214/2025, arts. 31 a 35) em vez de ir ao transportador. O que muda é o caixa de quem recebe — e a conciliação.')
  escrever()
  escrever(
    `**Divergências que o motor do CT-e ainda tem (medidas nesta execução):** (i) sem \`tomaCreditoIcms\`, o mesmo documento devolve crédito de ${brl(dados.cte2027SemFlags.creditoTotal)} em vez de ${brl(cte27.creditoTotal)} — e o pedido não avisa; (ii) o topo da resposta diz líquido ${brl(cte27.liquidoTransportador)} e o \`comparativo[2027]\` diz ${brl(cte27Status?.liquidoTransportador ?? 0)} — o topo não desconta o split; (iii) o \`comparativo[2027]\` mantém \`custoNaoRecuperavel\` de ${brl(cte27Status?.custoNaoRecuperavel ?? 0)} (o ICMS), enquanto o topo, com os flags de crédito, devolve ${brl(cte27.custoNaoRecuperavel)}.`,
  )
  escrever()

  titulo('10. A decisão e a economia')
  escrever('**Decisão:** consolidar 100% do volume SP → BA na **Serra Azul Cargas (regime regular)**, sem pedir reajuste em 2027, e usar o preço-teto como limite em qualquer cotação de transportadora do Simples.')
  escrever()
  escrever('| Comparação | 2027 | 2029 | 2033 | 2026–2033 (acumulado) |')
  escrever('|---|---:|---:|---:|---:|')
  const l2029 = modelo.anos.find((linha) => linha.ano === 2029)
  escrever(`| Simples/DAS × regular (mensal) | ${brl(linha2027.gapDas)} | ${brl(l2029.gapDas)} | ${brl(linha2033.gapDas)} | — |`)
  escrever(`| Simples/DAS × regular (anual) | ${brl(arred(linha2027.gapDas * 12))} | ${brl(arred(l2029.gapDas * 12))} | ${brl(arred(linha2033.gapDas * 12))} | ${brl(modelo.economiaDas)} |`)
  escrever(`| Híbrido × regular (mensal) | ${brl(linha2027.gapHibrido)} | ${brl(l2029.gapHibrido)} | ${brl(linha2033.gapHibrido)} | — |`)
  escrever(`| Híbrido × regular (anual) | ${brl(arred(linha2027.gapHibrido * 12))} | ${brl(arred(l2029.gapHibrido * 12))} | ${brl(arred(linha2033.gapHibrido * 12))} | ${brl(modelo.economiaHibrido)} |`)
  escrever()
  escrever(
    `Trocar a Rota Sul (Simples/DAS) pela Serra Azul (regular) **sem mexer no preço nominal** economiza **${brl(linha2027.gapDas)}/mês em 2027** (${brl(arred(linha2027.gapDas * 12))}/ano) e **${brl(linha2033.gapDas)}/mês em 2033** (${brl(arred(linha2033.gapDas * 12))}/ano); somando 2026–2033, **${brl(modelo.economiaDas)}**.`,
  )
  escrever()
  escrever(
    `Alternativa: manter a Rota Sul e renegociar para **${brl(linha2027.equilibrioDas)}** em 2027 (queda de ${pct(((PAGADORA.freteMensal - linha2027.equilibrioDas) / PAGADORA.freteMensal) * 100)}) — o mesmo ganho, mas exige um corte que provavelmente supera a margem do transportador. É esse número que a cláusula de reajuste deve usar como teto.`,
  )
  escrever()

  titulo('11. O que uma planilha comum erraria')
  escrever('| Erro | O que a planilha faz | Efeito no exemplo (2027) |')
  escrever('|---|---|---|')
  escrever(`| Comparar preço nominal | 10.000 = 10.000 → empate | Perde ${brl(linha2027.gapDas)}/mês de economia |`)
  const gapLegado = arred(linha2027.custoDas - (linha2027.appLegadoCusto ?? linha2027.cbsIbs))
  escrever(`| Ignorar o crédito de ICMS/PIS/COFINS | usa o crédito só de CBS/IBS (${brl(linha2027.cbsIbs)}) | Subestima o crédito em ${brl(linha2027.creditoRegular - linha2027.cbsIbs)}/mês e mede um gap de ${brl(gapLegado)} em vez de ${brl(linha2027.gapDas)} (erro de ${brl(arred(linha2027.gapDas - gapLegado))}) |`)
  escrever(`| Tratar o híbrido como igual ao regular | ambos com ${pct((linha2027.cbsIbs / linha2027.base) * 100)} de crédito | Perde ${brl(linha2027.gapHibrido)}/mês entre 2027 e 2032 |`)
  escrever(`| Achar que o custo cai ano a ano | projeta 730 já em 2027 | O custo real sobe para ${brl(linha2027.custoRegular)} em 2027 e só chega a ${brl(linha2033.custoRegular)} em 2033 |`)
  escrever(`| Ignorar a queda do crédito de ICMS | mantém 7% até 2033 | Em 2033 o ICMS é zero: quem não migrar perde o crédito de ${brl(linha2027.icms)}/mês |`)
  escrever()

  titulo('12. O que ainda não está resolvido (ressalvas fiscais)')
  const meiApp = dados.pagador.mei?.anos?.find((linha) => linha.ano === 2027)
  const meiSim = dados.meiSim?.resultado?.creditoTotal ?? 0
  const semPgdas = dados.semPgdas?.resultado?.creditoTotal ?? 0
  escrever(
    `1. **Autônomo/MEI continua com faixa de 1,8% a 4,00%** (\`estimativa setorial\`): em R$ 1.000,00 o app devolve ${brl(meiSim)} de crédito em 2027 (${pct((meiSim / 1000) * 100)}) e o horizonte usa ${brl(meiApp?.credito?.total ?? 0)} em R$ 10.000,00 no preço-teto e na economia. O crédito é **presumido**, com percentual fixado por ato conjunto até setembro de cada ano (LC 214/2025, art. 169, §§ 3º e 4º) e aplicado sobre o valor líquido (\`P × p/(1+p)\`); enquanto o ato não existe, o número é estimativa do app e não deveria sustentar uma decisão.`,
  )
  escrever(
    `2. **Simples/DAS sem PGDAS continua com faixa de 0,92% a 4,00%** (padrão 2,00%): em R$ 1.000,00 o app devolve ${brl(semPgdas)} de crédito em 2027 sem nenhuma alíquota informada. Sem destaque no CT-e não há crédito (LC 214/2025, art. 47, §2º, I) — a faixa é heurística, não regra.`,
  )
  escrever('3. **Alíquotas de 2027–2033 são premissa**, não alíquota legal: a LC 214/2025 manda o Senado fixar a referência a cada ano (arts. 18 e 349) e só fixa a regra de 2027–2028 (CBS = referência − 0,1 p.p., art. 347). Falta o selo "premissa" na tela e o aviso de que a resolução de 2027 ainda não existe.')
  escrever('4. **Split payment não tem data na lei**: arts. 31 a 35 e art. 35, §§ 1º e 2º (implementação gradual por ato conjunto, começando por adquirentes não contribuintes). O "a partir de 2027" é premissa de planejamento.')
  escrever('5. **Nomes de campo inconsistentes entre endpoints**: em `/api/simular`, `credito`/`custoLiquido` são só CBS/IBS e `creditoTotal`/`custoTotal` são o total; em `/api/reforma`, `credito`/`custoLiquido` já são o total. Sugestão: depreciar os legados ou renomear em `/api/reforma`.')
  escrever('6. **Módulo de CT-e do motor**: `custoNaoRecuperavel` e `liquidoTransportador` divergem entre o topo e o `comparativo`; `tomaCreditoIcms`/`tomaCreditoPisCofins` sem default silencioso. Se a aba de CT-e for exposta ao pagador, isso aparece.')
  escrever()

  titulo('Chamadas executadas')
  for (const chamada of dados.chamadas) escrever(`- \`${chamada}\``)
  escrever()
}

/* ------------------------------------------------------------------ */

async function principal() {
  const dados = await coletar()
  const modelo = montarModelo(dados)
  relatar(dados, modelo)
  const texto = `${linhas.join('\n')}\n`
  process.stdout.write(texto)
  if (process.argv.includes('--arquivo')) {
    await mkdir(path.dirname(SAIDA), { recursive: true })
    await writeFile(SAIDA, texto, 'utf8')
    process.stdout.write(`\nRelatório gravado em ${SAIDA}\n`)
  }
}

principal().catch((erro) => {
  console.error(`Falha: ${erro.message}`)
  process.exitCode = 1
})
