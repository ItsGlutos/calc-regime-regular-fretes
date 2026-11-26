// Verificação de runtime da interface Frete Líquido usando o Chrome DevTools Protocol.
// Uso: node scripts/verificar-app.mjs [url]
// Requer um navegador headless com --remote-debugging-port=9333 (Edge ou Chrome).
import { writeFileSync } from 'node:fs'

const url = process.argv[2] || 'http://127.0.0.1:5180/'
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9333)
const destino = process.env.SCREENSHOT || 'tmp-frete-app.png'
const movel = process.env.MOBILE === '1'
const largura = movel ? 390 : 1440
const altura = movel ? 844 : 1200

const lista = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
const paginas = lista.filter((t) => t.type === 'page')
const pagina =
  paginas.find((t) => t.url.startsWith('http://127.0.0.1') || t.url === 'about:blank') ?? paginas[0]
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
    erros.push(msg.params?.exceptionDetails?.text ?? 'exceção de runtime')
  }
  if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
    const entrada = msg.params.entry
    // Fontes externas bloqueadas no headless não são erro da aplicação.
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
    throw new Error(resposta.result.exceptionDetails.text)
  }
  return resposta.result?.result?.value
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function aguardar(expressao, limiteMs = 30000) {
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    if (await avaliar(expressao)) return true
    await esperar(300)
  }
  return false
}

await enviar('Runtime.enable')
await enviar('Log.enable')
await enviar('Page.enable')
await enviar('Network.enable')
await enviar('Network.setCacheDisabled', { cacheDisabled: true })
await enviar('Emulation.setDeviceMetricsOverride', {
  width: largura,
  height: altura,
  deviceScaleFactor: 1,
  mobile: movel,
})
await enviar('Page.navigate', { url })

const carregou = await aguardar("document.querySelector('#resultado .result__head')")
const comparou = await aguardar("document.querySelector('#comparacao .ranking')")
await esperar(500)

const inicial = await avaliar(`(() => ({
  titulo: document.title,
  perfilOpcoes: [...document.querySelectorAll('#perfil option')].map((o) => o.textContent.trim()),
  simplesVisivel: !document.querySelector('#simplesWrap').hidden,
  atividade: document.querySelector('#atividade')?.value,
  motor: document.querySelector('#engineVersion')?.textContent.trim(),
  liquido: document.querySelector('#resultado .net__val')?.textContent.trim(),
  chips: [...document.querySelectorAll('#resultado .chips .chip')].map((c) => c.textContent.trim()),
  ranking: document.querySelector('#comparacao .ranking__resumo')?.textContent.trim()
}))()`)

await avaliar("document.querySelector('#cenarioAceite').click()")
const cenario = await aguardar(
  "[...document.querySelectorAll('#resultado .chip--best')].some((c) => c.textContent.includes('PGDAS'))",
)
await esperar(600)

const aposCenario = await avaliar(`(() => ({
  simplesFonte: document.querySelector('#simplesFonte')?.textContent.trim(),
  badge: (() => {
    const el = document.querySelector('#simplesFonte');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { width: r.width, scrollWidth: el.scrollWidth, whiteSpace: cs.whiteSpace, flex: cs.flex, fontSize: cs.fontSize, fontFamily: cs.fontFamily };
  })(),
  aliquotaCbs: document.querySelector('#aliquotaCbs')?.value,
  aliquotaIbs: document.querySelector('#aliquotaIbs')?.value,
  liquido: document.querySelector('#resultado .net__val')?.textContent.trim(),
  chips: [...document.querySelectorAll('#resultado .chips .chip')].map((c) => c.textContent.trim()),
  ranking: document.querySelector('#comparacao .ranking__resumo')?.textContent.trim(),
  linhas: [...document.querySelectorAll('#comparacao .ranking tbody tr:not(.audit-row)')].map((tr) => ({
    nome: tr.querySelector('.cell-name strong')?.textContent.trim(),
    liquido: tr.querySelector('.cell-net')?.textContent.trim(),
  }))
}))()`)

// Linha do tempo: a projeção anual consulta o motor e pode levar mais tempo que o resultado.
const linhaTempoCarregou = await aguardar("document.querySelector('#linhaDoTempoConteudo .timeline__kpis')", 60000)
await esperar(300)

const linhaTempo = await avaliar(`(() => ({
  chips: [...document.querySelectorAll('#timelineChips .chip')].map((c) => c.textContent.trim()),
  kpis: [...document.querySelectorAll('.timeline__kpis .kpi')].map((k) => k.textContent.replace(/\\s+/g, ' ').trim()),
  linhas: document.querySelectorAll('.table--timeline tbody tr').length,
  colunas: [...document.querySelectorAll('.table--timeline thead th')].map((th) => th.textContent.replace(/\\s+/g, ' ').trim()),
  metricas: [...document.querySelectorAll('#timelineMetrica button')].map((b) => b.innerText.trim()),
  grafico: Boolean(document.querySelector('.timeline__chart svg')),
  fonte: document.querySelector('#timelineFonte')?.textContent.trim(),
  avisos: [...document.querySelectorAll('.callout--aviso p')].map((p) => p.textContent.trim()),
  marcos: document.querySelectorAll('.marco').length,
  stale: !document.querySelector('#timelineStale')?.hidden
}))()`)

const trocaMetrica = await avaliar(`(() => {
  const rotulo = () => document.querySelector('.table--timeline thead th:last-child')?.textContent.replace(/\\s+/g, ' ').trim();
  const lidos = { inicial: rotulo() };
  document.querySelector('#timelineMetrica [data-metrica="carga"]')?.click();
  lidos.carga = rotulo();
  document.querySelector('#timelineMetrica [data-metrica="credito"]')?.click();
  lidos.credito = rotulo();
  document.querySelector('#timelineMetrica [data-metrica="custo"]')?.click();
  lidos.volta = rotulo();
  return lidos;
})()`)

const captura = await enviar('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: await avaliar(`(() => {
    const alturaPagina = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return { x: 0, y: 0, width: ${largura}, height: Math.min(alturaPagina, 3200), scale: 1 };
  })()`),
})
writeFileSync(destino, Buffer.from(captura.result.data, 'base64'))

const estados = await avaliar(`(() => {
  const ano = document.querySelector('#ano');
  ano.value = '2026';
  ano.dispatchEvent(new Event('change', { bubbles: true }));
  const badge2026 = document.querySelector('#simplesFonte')?.textContent.trim();
  const taxa2026 = !document.querySelector('#taxaWrap').hidden;

  ano.value = '2027';
  ano.dispatchEvent(new Event('change', { bubbles: true }));
  const perfil = document.querySelector('#perfil');
  perfil.value = 'SIMPLES_HIBRIDO';
  perfil.dispatchEvent(new Event('change', { bubbles: true }));
  return {
    badge2026,
    taxa2026,
    simplesOcultoNoHibrido: document.querySelector('#simplesWrap').hidden,
    taxaOcultaNoHibrido: document.querySelector('#taxaWrap').hidden,
  };
})()`)

// Regime regular: a mesma linha do tempo precisa trocar de regime sem recarregar a página.
await avaliar(`(() => {
  document.querySelector('#regime [data-regime="REGULAR"]')?.click();
  const perfil = document.querySelector('#perfil');
  perfil.value = 'REGIME_REGULAR';
  perfil.dispatchEvent(new Event('change', { bubbles: true }));
  const ano = document.querySelector('#ano');
  ano.value = '2033';
  ano.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#calcular')?.click();
  return true;
})()`)
const regularCarregou = await aguardar(
  "document.querySelector('#timelineChips')?.textContent.includes('Regime regular') && document.querySelector('.timeline__kpis')?.textContent.includes('162,50') && document.querySelector('#resultado .net__val')?.textContent.trim() === '730,00'",
  60000,
)
await esperar(300)

const regular = await avaliar(`(() => {
  const celula = (seletor) => document.querySelector(seletor)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  return {
    chips: [...document.querySelectorAll('#timelineChips .chip')].map((c) => c.textContent.trim()),
    regimeAtivo: document.querySelector('#regime [data-regime="REGULAR"]')?.getAttribute('aria-checked'),
    kpis: [...document.querySelectorAll('.timeline__kpis .kpi')].map((k) => k.textContent.replace(/\\s+/g, ' ').trim()),
    linhas: document.querySelectorAll('.table--timeline tbody tr').length,
    antigos2025: celula('.table--timeline tbody tr:first-child td:nth-child(3)'),
    carga2033: celula('.table--timeline tbody tr:last-child td:nth-child(5)'),
    liquido2033: celula('.table--timeline tbody tr:last-child td:nth-child(7)'),
    liquidoResultado: document.querySelector('#resultado .net__val')?.textContent.trim() ?? null,
    erro: celula('.comparison-error'),
  };
})()`)

console.log(
  JSON.stringify(
    {
      url,
      carregou,
      comparou,
      inicial,
      cenario,
      aposCenario,
      linhaTempoCarregou,
      linhaTempo,
      trocaMetrica,
      estados,
      regularCarregou,
      regular,
      erros,
      captura: destino,
    },
    null,
    2,
  ),
)

ws.close()
if (
  !carregou ||
  !comparou ||
  !cenario ||
  !linhaTempoCarregou ||
  !regularCarregou ||
  erros.length ||
  linhaTempo?.linhas !== 9 ||
  !linhaTempo?.grafico ||
  linhaTempo?.stale ||
  !trocaMetrica?.carga?.includes('Carga') ||
  !trocaMetrica?.credito?.includes('Crédito') ||
  !String(estados?.badge2026 || '').includes('estimativa em 2026') ||
  !estados?.taxa2026 ||
  !estados?.simplesOcultoNoHibrido ||
  !estados?.taxaOcultaNoHibrido ||
  regular?.regimeAtivo !== 'true' ||
  regular?.linhas !== 9 ||
  !regular?.antigos2025?.includes('R$ 162,50') ||
  !regular?.antigos2025?.includes('ICMS R$ 70,00') ||
  !regular?.antigos2025?.includes('PIS/COFINS R$ 92,50') ||
  regular?.liquido2033 !== 'R$ 730,00' ||
  regular?.liquidoResultado !== '730,00' ||
  regular?.erro
) {
  process.exitCode = 1
}
