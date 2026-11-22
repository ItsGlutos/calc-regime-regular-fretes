// Captura um elemento da interface Frete Líquido via Chrome DevTools Protocol.
// Uso: node scripts/capturar-app.mjs ".workspace" saida.png [url] [largura]
// Requer navegador headless com --remote-debugging-port=9333.
import { writeFileSync } from 'node:fs'

const seletor = process.argv[2] || '.workspace'
const destino = process.argv[3] || 'tmp-workspace.png'
const url = process.argv[4] || 'http://127.0.0.1:5180/'
const largura = Number(process.argv[5] || 1440)
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9333)
const cenario = process.env.CENARIO !== '0'
const alturaMax = Number(process.env.ALTURA_MAX || 0)

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
ws.addEventListener('message', (evento) => {
  const msg = JSON.parse(evento.data)
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg)
    pendentes.delete(msg.id)
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
  return resposta.result?.result?.value
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

await enviar('Runtime.enable')
await enviar('Page.enable')
await enviar('Network.enable')
await enviar('Network.setCacheDisabled', { cacheDisabled: true })
await enviar('Emulation.setDeviceMetricsOverride', {
  width: largura,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: largura <= 480,
})
await enviar('Page.navigate', { url })

for (let i = 0; i < 80; i++) {
  if (await avaliar("document.querySelector('#resultado .result__head')")) break
  await esperar(300)
}

if (cenario) {
  await avaliar("document.querySelector('#cenarioAceite')?.click()")
  for (let i = 0; i < 80; i++) {
    if (
      await avaliar(
        "[...document.querySelectorAll('#resultado .chip--best')].some((c) => c.textContent.includes('PGDAS'))",
      )
    ) {
      break
    }
    await esperar(300)
  }
}

await esperar(600)

const caixa = await avaliar(`(() => {
  const el = document.querySelector(${JSON.stringify(seletor)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.max(0, r.left + window.scrollX),
    y: Math.max(0, r.top + window.scrollY),
    width: Math.min(${largura}, r.width),
    height: ${alturaMax} > 0 ? Math.min(${alturaMax}, r.height) : r.height
  };
})()`)

if (!caixa) {
  console.log('Seletor não encontrado:', seletor)
  process.exit(1)
}

const captura = await enviar('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { ...caixa, scale: 1 },
})

writeFileSync(destino, Buffer.from(captura.result.data, 'base64'))
console.log('Captura salva:', destino, JSON.stringify(caixa))
ws.close()
