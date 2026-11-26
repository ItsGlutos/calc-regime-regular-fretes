// Verificação de runtime da seção "Perfis de transportadores" (CDP).
// Uso: node scripts/verificar-perfis.mjs [url]
// Requer o app no ar e um navegador headless com --remote-debugging-port=9333.
import { writeFileSync } from 'node:fs'

const url = process.argv[2] || 'http://127.0.0.1:5180/'
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9333)
const PASTA = process.env.SCREENSHOT_DIR || 'app/docs'

const lista = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
const paginas = lista.filter((t) => t.type === 'page')
const pagina = paginas.find((t) => t.url.startsWith('http://127.0.0.1') || t.url === 'about:blank') ?? paginas[0]
if (!pagina) throw new Error('Nenhuma página aberta no navegador headless.')

const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

let id = 0
const pendentes = new Map()
const erros = []
ws.addEventListener('message', (evento) => {
  const msg = JSON.parse(evento.data)
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg)
    pendentes.delete(msg.id)
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    erros.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text ?? 'exceção')
  }
  if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
    const entrada = msg.params.entry
    if (!/fonts\.(googleapis|gstatic)\.com/.test(entrada.url ?? '')) {
      erros.push(`${entrada.text} ${entrada.url ?? ''}`)
    }
  }
})

const enviar = (method, params = {}) =>
  new Promise((resolve) => {
    const meuId = ++id
    pendentes.set(meuId, resolve)
    ws.send(JSON.stringify({ id: meuId, method, params }))
  })

const avaliar = async (expressao) => {
  const resposta = await enviar('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true,
  })
  if (resposta.result?.exceptionDetails) {
    throw new Error(resposta.result.exceptionDetails.exception?.description ?? resposta.result.exceptionDetails.text)
  }
  return resposta.result?.result?.value
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function aguardar(expressao, limiteMs = 30000) {
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    try {
      if (await avaliar(expressao)) return true
    } catch {
      // página ainda navegando
    }
    await esperar(250)
  }
  return false
}

const falhas = []
function conferir(nome, condicao, detalhe = '') {
  const ok = Boolean(condicao)
  if (!ok) falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  console.log(`${ok ? 'ok  ' : 'FALHA'}  ${nome}${detalhe ? `  (${detalhe})` : ''}`)
}

/** Dias úteis (seg–sex) menos feriados nacionais fixos, em UTC. */
function diasUteis(ano, mes) {
  const fixos = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'])
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  let total = 0
  for (let dia = 1; dia <= ultimo; dia += 1) {
    const data = new Date(Date.UTC(ano, mes - 1, dia))
    const semana = data.getUTCDay()
    const chave = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (semana >= 1 && semana <= 5 && !fixos.has(chave)) total += 1
  }
  return total
}

const brlNumero = (texto) =>
  Number(
    String(texto ?? '')
      .replace(/[R$\s.]/g, '')
      .replace(',', '.'),
  )

async function capturar(nome, seletor) {
  const rect = await avaliar(`(() => {
    const el = document.querySelector('${seletor}')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }
  })()`)
  if (!rect) return null
  const resposta = await enviar('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, rect.x - 8),
      y: Math.max(0, rect.y - 8),
      width: Math.ceil(rect.width + 16),
      height: Math.ceil(rect.height + 16),
      scale: 1,
    },
  })
  const arquivo = `${PASTA}/${nome}`
  writeFileSync(arquivo, Buffer.from(resposta.result.data, 'base64'))
  return arquivo
}

await enviar('Runtime.enable')
await enviar('Log.enable')
await enviar('Page.enable')
await enviar('Network.enable')
await enviar('Network.setCacheDisabled', { cacheDisabled: true })
await enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })
await enviar('Page.navigate', { url })

const carregou = await aguardar("document.querySelector('#perfisCards .perfil-card') && document.querySelector('#perfilResultado .perfil-res')")
conferir('seção de perfis carregou', carregou)
if (!carregou) {
  console.log(JSON.stringify({ erros }, null, 2))
  process.exit(1)
}
await esperar(600)
await aguardar("document.querySelectorAll('.table--perfis-rank tbody tr').length >= 3", 30000)

const inicial = await avaliar(`(() => ({
  cards: [...document.querySelectorAll('#perfisCards .perfil-card')].map((c) => ({
    nome: c.querySelector('.perfil-card__nome')?.textContent.trim(),
    ativo: c.classList.contains('is-active'),
    diaria: c.querySelector('.perfil-card__diaria')?.textContent.trim(),
  })),
  contagem: document.querySelector('#perfisContagem')?.textContent.trim(),
  status: document.querySelector('#perfilStatus')?.textContent.trim(),
  nome: document.querySelector('#perfilNome')?.value,
  diaria: document.querySelector('#perfilDiaria')?.value,
  tipoVeiculo: document.querySelector('#perfilTipoVeiculo')?.value,
  veiculoHint: document.querySelector('#perfilVeiculoHint')?.textContent.trim(),
  kpis: [...document.querySelectorAll('#perfilResultado .kpi')].map((k) => ({
    rotulo: k.querySelector('.kpi__label')?.textContent.trim(),
    valor: k.querySelector('.kpi__valor')?.textContent.trim(),
    sub: k.querySelector('.kpi__sub')?.textContent.trim(),
  })),
  meses: [...document.querySelectorAll('#perfilResultado .table--perfil')][0]
    ? [...document.querySelectorAll('#perfilResultado .table--perfil')][0].querySelectorAll('tbody tr').length
    : 0,
  mesAtual: document.querySelector('[data-perfil-mes]')?.value,
  anoAtual: document.querySelector('[data-perfil-ano]')?.value,
  ranking: [...document.querySelectorAll('.table--perfis-rank tbody tr:not(.is-grupo)')].map((tr) => ({
    pos: tr.querySelector('.rank')?.textContent.trim(),
    nome: tr.querySelector('.cell-perfil')?.textContent.trim().split('\\n')[0].trim(),
    melhor: tr.classList.contains('is-best'),
  })),
}))()`)

conferir('quatro perfis de exemplo', inicial.cards.length === 4, `veio ${inicial.cards.length}`)
conferir('contador da lista', inicial.contagem === '4', inicial.contagem)
conferir('primeiro perfil ativo', inicial.cards[0]?.ativo === true)
conferir('formulário preenchido com o perfil ativo', inicial.nome === 'Carreta dedicada · SP → BA', inicial.nome)
conferir('tipo de veículo do perfil', inicial.tipoVeiculo === 'CARRETA', inicial.tipoVeiculo)
conferir(
  'faixa de referência na ajuda',
  /R\$ 2\.820,00 a R\$ 4\.300,00/.test(inicial.veiculoHint),
  inicial.veiculoHint,
)
conferir('status "salvo"', inicial.status === 'salvo', inicial.status)
conferir('mês de referência é o atual', inicial.mesAtual === String(new Date().getMonth() + 1), inicial.mesAtual)
conferir('ano de referência é o corrente', inicial.anoAtual === String(Math.min(2033, Math.max(2026, new Date().getFullYear()))), inicial.anoAtual)
conferir('ranking com quatro linhas', inicial.ranking.length === 4, `veio ${inicial.ranking.length}`)
conferir('melhor perfil marcado', inicial.ranking[0]?.melhor === true)

// Conta esperada para o perfil 1 (SP → BA, regime regular, 2026, dias úteis).
const DIARIA_CARRETA = 3500
const anoRef = Number(inicial.anoAtual)
const mesRef = Number(inicial.mesAtual)
const diasMes = diasUteis(anoRef, mesRef)
const brutoEsperado = DIARIA_CARRETA * diasMes
const creditoEsperado = Math.round(brutoEsperado * 0.1625 * 100) / 100
const liquidoEsperado = brutoEsperado - creditoEsperado
const kpi = (rotulo) => inicial.kpis.find((k) => k.rotulo === rotulo)
conferir(
  'KPI faturamento bruto do mês',
  brlNumero(kpi('Faturamento bruto')?.valor) === brutoEsperado,
  `${kpi('Faturamento bruto')?.valor} vs ${brutoEsperado} (${diasMes} dias úteis)`,
)
conferir(
  'KPI crédito do mês',
  brlNumero(kpi('Crédito')?.valor) === creditoEsperado,
  `${kpi('Crédito')?.valor} vs ${creditoEsperado}`,
)
conferir(
  'KPI custo líquido do mês',
  brlNumero(kpi('Custo líquido')?.valor) === liquidoEsperado,
  `${kpi('Custo líquido')?.valor} vs ${liquidoEsperado}`,
)
conferir('tabela mês a mês com 13 linhas (12 + total)', inicial.meses === 13, `veio ${inicial.meses}`)

const fevereiro = diasUteis(anoRef, 2)
await avaliar(`(() => {
  const select = document.querySelector('[data-perfil-mes]')
  select.value = '2'
  select.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
const trocouMes = await aguardar(`document.querySelectorAll('#perfilResultado .table--perfil')[0]?.querySelector('tr.is-current .cell-mes')?.textContent.includes('Fevereiro')`)
await esperar(500)
const aposMes = await avaliar(`(() => ({
  kpis: [...document.querySelectorAll('#perfilResultado .kpi')].map((k) => ({
    rotulo: k.querySelector('.kpi__label')?.textContent.trim(),
    valor: k.querySelector('.kpi__valor')?.textContent.trim(),
  })),
}))()`)
const kpiMes = (rotulo) => aposMes.kpis.find((k) => k.rotulo === rotulo)
conferir('troca de mês recalcula', trocouMes)
conferir(
  'fevereiro usa os dias úteis do calendário',
  brlNumero(kpiMes('Faturamento bruto')?.valor) === DIARIA_CARRETA * fevereiro,
  `${kpiMes('Faturamento bruto')?.valor} vs ${DIARIA_CARRETA * fevereiro} (${fevereiro} dias)`,
)

// Cria um perfil novo pela interface.
await avaliar("document.querySelector('#perfilNovo').click()")
await esperar(250)
await avaliar(`(() => {
  const select = document.querySelector('#perfilTipoVeiculo')
  select.value = 'TRUCK'
  select.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await esperar(350)
const diariaPrefill = await avaliar("document.querySelector('#perfilDiaria')?.value")
conferir('tipo de veículo preenche a diária base', diariaPrefill === '1.800,00', diariaPrefill)
await avaliar(`(() => {
  const definir = (seletor, valor, evento = 'input') => {
    const el = document.querySelector(seletor)
    el.value = valor
    el.dispatchEvent(new Event(evento, { bubbles: true }))
  }
  definir('#perfilNome', 'Teste CDP')
  definir('#perfilDiaria', '1.000,00')
  definir('#perfilUfOrigem', 'MG', 'change')
  definir('#perfilUfDestino', 'GO', 'change')
  definir('#perfilRegime', 'SIMPLES_DAS', 'change')
  definir('#perfilModoDias', 'FIXO', 'change')
  definir('#perfilDiasFixo', '20')
  definir('#perfilAliquotaCbs', '2,3591')
  definir('#perfilAliquotaIbs', '0,0260')
})()`)
await esperar(900)
const alertaFaixa = await avaliar(
  "[...document.querySelectorAll('#perfilResultado .callout')].map((c) => c.textContent).join(' ')",
)
conferir(
  'aviso de diária abaixo da faixa',
  /abaixo da faixa de referência/i.test(alertaFaixa),
  alertaFaixa.slice(0, 90),
)
const antesSalvar = await avaliar(`(() => ({
  status: document.querySelector('#perfilStatus')?.textContent.trim(),
  excluirVisivel: !document.querySelector('#perfilExcluir').hidden,
  simulaWrap: !document.querySelector('#perfilSimplesWrap').hidden,
}))()`)
conferir('rascunho não salvo', antesSalvar.status === 'não salvo', antesSalvar.status)
conferir('botão excluir escondido no rascunho', antesSalvar.excluirVisivel === false)
conferir('campos do Simples visíveis', antesSalvar.simulaWrap === true)

await avaliar("document.querySelector('#perfilSalvar').click()")
const salvou = await aguardar("document.querySelectorAll('#perfisCards .perfil-card').length === 5")
await aguardar("document.querySelector('#perfilResultado .eyebrow-sm')?.textContent.includes('Teste CDP')", 30000)
await aguardar("document.querySelectorAll('.table--perfis-rank tbody tr:not(.is-grupo)').length === 5", 30000)
await esperar(400)
const aposSalvar = await avaliar(`(() => ({
  cards: document.querySelectorAll('#perfisCards .perfil-card').length,
  contagem: document.querySelector('#perfisContagem')?.textContent.trim(),
  status: document.querySelector('#perfilStatus')?.textContent.trim(),
  ativo: document.querySelector('#perfisCards .perfil-card.is-active .perfil-card__nome')?.textContent.trim(),
  nome: document.querySelector('#perfilNome')?.value,
  ranking: document.querySelectorAll('.table--perfis-rank tbody tr:not(.is-grupo)').length,
}))()`)
conferir('perfil salvo aparece na lista', salvou && aposSalvar.cards === 5, `veio ${aposSalvar.cards}`)
conferir('perfil salvo fica ativo', aposSalvar.ativo === 'Teste CDP', aposSalvar.ativo)
conferir('status volta para "salvo"', aposSalvar.status === 'salvo', aposSalvar.status)
conferir('ranking acompanha o novo perfil', aposSalvar.ranking === 5, `veio ${aposSalvar.ranking}`)

// Aplica o perfil na simulação principal.
const antesSimulacao = await avaliar(`(() => ({
  bruto: document.querySelectorAll('#perfilResultado .kpi')[1]?.querySelector('.kpi__valor')?.textContent.trim(),
  valor: document.querySelector('#valor')?.value,
}))()`)
const brutoAplicado = brlNumero(antesSimulacao.bruto)
await avaliar("document.querySelector('#perfilUsar').click()")
const aplicou = await aguardar(`(() => {
  const v = document.querySelector('#valor')?.value ?? ''
  const n = Number(v.replace(/\\./g, '').replace(',', '.'))
  return Math.abs(n - ${brutoAplicado}) < 0.01
})()`)
await esperar(900)
const aposAplicar = await avaliar(`(() => ({
  valor: document.querySelector('#valor')?.value,
  ano: document.querySelector('#ano')?.value,
  perfil: document.querySelector('#perfil')?.value,
  ufOrigem: document.querySelector('#ufOrigem')?.value,
  ufDestino: document.querySelector('#ufDestino')?.value,
  resultado: document.querySelector('#resultado .net__val')?.textContent.trim(),
}))()`)
conferir('perfil preenche o valor da simulação', aplicou, `valor ${aposAplicar.valor} vs ${antesSimulacao.bruto}`)
conferir('perfil preenche a rota', aposAplicar.ufOrigem === 'MG' && aposAplicar.ufDestino === 'GO', `${aposAplicar.ufOrigem} → ${aposAplicar.ufDestino}`)
conferir('perfil preenche a modalidade', aposAplicar.perfil === 'SIMPLES_DAS', aposAplicar.perfil)

// Exclui o perfil de teste (confirmação em dois cliques).
await avaliar("document.querySelector('#perfilExcluir').click()")
await esperar(200)
const confirmacao = await avaliar("document.querySelector('#perfilExcluir')?.textContent.trim()")
await avaliar("document.querySelector('#perfilExcluir').click()")
const excluiu = await aguardar("document.querySelectorAll('#perfisCards .perfil-card').length === 4")
await esperar(600)
conferir('exclusão pede confirmação', confirmacao === 'Confirmar exclusão', confirmacao)
conferir('perfil excluído sai da lista', excluiu)

// Volta ao primeiro perfil e ao mês corrente para as capturas.
await avaliar("document.querySelector('#perfisCards .perfil-card').click()")
await aguardar("document.querySelector('#perfilResultado .perfil-res')")
await avaliar(`(() => {
  const select = document.querySelector('[data-perfil-mes]')
  if (!select) return
  select.value = String(${new Date().getMonth() + 1})
  select.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await esperar(700)

const capturaDesktop = await capturar('web-perfis.png', '#perfis', 1440)
conferir('captura desktop', Boolean(capturaDesktop), capturaDesktop)

await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await enviar('Page.reload', { ignoreCache: true })
const carregouMovel = await aguardar("document.querySelector('#perfilResultado .perfil-res')")
await esperar(800)
const capturaMovel = await capturar('web-perfis-mobile.png', '#perfis', 390)
conferir('captura mobile', Boolean(capturaMovel), capturaMovel)

const resultado = {
  ok: falhas.length === 0 && erros.length === 0,
  falhas,
  erros,
  capturas: [capturaDesktop, capturaMovel],
  inicial,
  aposSalvar,
  aposAplicar,
}
console.log(JSON.stringify(resultado, null, 2))
process.exit(resultado.ok ? 0 : 1)
