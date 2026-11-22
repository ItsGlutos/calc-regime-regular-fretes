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
    erros.push(msg.params.entry.text)
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
  linhas: [...document.querySelectorAll('#comparacao tbody tr:not(.audit-row)')].map((tr) => ({
    nome: tr.querySelector('.cell-name strong')?.textContent.trim(),
    liquido: tr.querySelector('.cell-net')?.textContent.trim(),
  }))
}))()`)

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

console.log(
  JSON.stringify(
    {
      url,
      carregou,
      comparou,
      inicial,
      cenario,
      aposCenario,
      estados,
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
  erros.length ||
  !String(estados?.badge2026 || '').includes('estimativa em 2026') ||
  !estados?.taxa2026 ||
  !estados?.simplesOcultoNoHibrido ||
  !estados?.taxaOcultaNoHibrido
) {
  process.exitCode = 1
}
