// Verificação de runtime da visão "Hoje → amanhã" (Frete Líquido) via CDP.
// Uso: node scripts/verificar-horizonte.mjs [url]
// Requer navegador headless com --remote-debugging-port=9333.
import { writeFileSync } from 'node:fs'

const url = process.argv[2] || 'http://127.0.0.1:5180/'
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9333)

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

await enviar('Runtime.enable')
await enviar('Log.enable')
await enviar('Page.enable')
await enviar('Network.enable')
await enviar('Network.setCacheDisabled', { cacheDisabled: true })
await enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })
await enviar('Page.navigate', { url })

// Espera o app carregar as opções e concluir a simulação inicial antes de manipular o formulário.
for (let i = 0; i < 120; i++) {
  const pronto = await avaliar(
    "!!(document.querySelector('#perfil')?.options.length && document.querySelector('#regimePagadora')?.options.length && document.querySelector('#resultado .result__head') && document.querySelector('#horizonteConteudo .horizonte__frase'))",
  )
  if (pronto) break
  await esperar(250)
}

// Cenário: transportador do regime regular, R$ 10.000,00, pagadora no Lucro Real, SP → BA.
const aplicarCenario = () => avaliar(`(() => {
  document.querySelector('[data-regime="REGULAR"]')?.click();
  const perfil = document.querySelector('#perfil');
  if (perfil) { perfil.value = 'REGIME_REGULAR'; perfil.dispatchEvent(new Event('change', { bubbles: true })); }
  const pagadora = document.querySelector('#regimePagadora');
  if (pagadora) { pagadora.value = 'NAO_CUMULATIVO'; pagadora.dispatchEvent(new Event('change', { bubbles: true })); }
  const valor = document.querySelector('#valor');
  valor.value = '10.000,00';
  valor.dispatchEvent(new Event('input', { bubbles: true }));
  const ano = document.querySelector('#ano');
  ano.value = '2026';
  ano.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#form').requestSubmit();
  return {
    perfil: document.querySelector('#perfil')?.value,
    valor: document.querySelector('#valor')?.value,
    ano: document.querySelector('#ano')?.value,
  };
})()`)

let cenario = await aplicarCenario()
for (let i = 0; i < 20; i++) {
  if (cenario?.perfil === 'REGIME_REGULAR' && cenario?.valor === '10.000,00') break
  await esperar(300)
  cenario = await aplicarCenario()
}
if (cenario?.perfil !== 'REGIME_REGULAR') {
  throw new Error(`Não foi possível aplicar o cenário: ${JSON.stringify(cenario)}`)
}

for (let i = 0; i < 120; i++) {
  const pronto = await avaliar("!!document.querySelector('#horizonteConteudo .horizonte__frase')")
  if (pronto) break
  await esperar(300)
}
for (let i = 0; i < 80; i++) {
  const regularPronto = await avaliar(`(() => {
    const valor = document.querySelector('#valor')?.value;
    const liquido = document.querySelector('#resultado .net__val')?.textContent ?? '';
    const primeiraLinha = document.querySelector('.table--horizonte tbody tr')?.children[2]?.textContent ?? '';
    return valor === '10.000,00' && liquido.includes('8.375,00') && primeiraLinha.includes('10.000,00');
  })()`)
  if (regularPronto) break
  await esperar(250)
}
await esperar(500)

const leitura = await avaliar(`(() => {
  const texto = (sel) => document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
  const linhas = [...document.querySelectorAll('.table--horizonte tbody tr')].map((tr) => ({
    ano: tr.children[0]?.textContent?.trim(),
    bruto: tr.children[2]?.textContent?.trim(),
    credito: tr.children[3]?.textContent?.trim(),
    liquido: tr.children[4]?.textContent?.trim(),
    variacao: tr.children[5]?.textContent?.trim(),
  }));
  const kpis = [...document.querySelectorAll('.horizonte__kpis .kpi')].map((kpi) => kpi.textContent.replace(/\\s+/g, ' ').trim());
  return {
    titulo: texto('#horizonteTitulo'),
    frase: texto('.horizonte__frase'),
    deveria: texto('.deveria__veredito'),
    teto: texto('.deveria__grid .is-alerta strong, .deveria__grid .is-ok strong'),
    kpis,
    linhas,
    ajustes: [...document.querySelectorAll('.ajuste')].map((li) => li.querySelector('strong')?.textContent),
    resultado: texto('.result__main'),
    metricas: texto('.metrics'),
    alerta: texto('.result .alert strong'),
    notasAno: document.querySelectorAll('.notas-ano li').length,
    erro: texto('.comparison-error'),
  };
})()`)

// Cenário com repasse: o líquido do regime regular deve ficar igual ao de hoje.
await avaliar("document.querySelector('[data-cenario=\"equilibrio\"]').click()")
await esperar(400)

const equilibrio = await avaliar(`(() => {
  const linhas = [...document.querySelectorAll('.table--horizonte tbody tr')].map((tr) => ({
    ano: tr.children[0]?.textContent?.trim(),
    bruto: tr.children[2]?.textContent?.trim(),
    liquido: tr.children[4]?.textContent?.trim(),
  }));
  return { linhas };
})()`)

await avaliar("document.querySelector('[data-cenario=\"repasse\"]').click()")
await esperar(400)

const repasse = await avaliar(`(() => {
  const linhas = [...document.querySelectorAll('.table--horizonte tbody tr')].map((tr) => ({
    ano: tr.children[0]?.textContent?.trim(),
    bruto: tr.children[2]?.textContent?.trim(),
    liquido: tr.children[4]?.textContent?.trim(),
    variacao: tr.children[5]?.textContent?.trim(),
  }));
  const nota = document.querySelector('.horizonte__fonte')?.textContent?.trim();
  return { linhas, nota };
})()`)

await avaliar("document.querySelector('[data-cenario=\"congelado\"]').click()")
await esperar(300)

const captura = async (seletor, destino) => {
  const caixa = await avaliar(`(() => {
    const el = document.querySelector(${JSON.stringify(seletor)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.left + scrollX), y: Math.max(0, r.top + scrollY), width: Math.min(innerWidth, r.width), height: r.height, scale: 1 };
  })()`)
  if (!caixa) throw new Error(`Seletor não encontrado: ${seletor}`)
  const imagem = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: caixa })
  writeFileSync(destino, Buffer.from(imagem.result.data, 'base64'))
}

await captura('.horizonte', process.env.SCREENSHOT || 'tmp-horizonte.png')
await captura('.workspace', 'tmp-workspace.png')

await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await esperar(600)
await captura('.horizonte', 'tmp-horizonte-mobile.png')
await enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false })

console.log('Título:', leitura.titulo)
console.log('Frase:', leitura.frase)
console.log('Deveria:', leitura.deveria)
console.log('Teto:', leitura.teto)
console.log('KPIs:', leitura.kpis)
console.log('Linhas:')
for (const linha of leitura.linhas) console.log(' ', JSON.stringify(linha))
console.log('Ajustes:', leitura.ajustes)
console.log('Resultado:', leitura.resultado)
console.log('Métricas:', leitura.metricas)
console.log('Alerta do resultado:', leitura.alerta)
console.log('Notas do motor:', leitura.notasAno)
console.log('Erro na tela:', leitura.erro)
console.log('Com repasse:', repasse.nota)
for (const linha of repasse.linhas) console.log(' ', JSON.stringify(linha))
console.log('Erros de console:', erros.length ? erros : 'nenhum')

const falhas = []
if (leitura.erro) falhas.push(`a visão mostrou erro: ${leitura.erro}`)
if (!leitura.linhas.length) falhas.push('a tabela não renderizou')
if (leitura.linhas[0]?.liquido !== 'R$ 8.375,00') falhas.push(`hoje deveria ser R$ 8.375,00, veio ${leitura.linhas[0]?.liquido}`)
if (repasse.linhas.at(-1)?.liquido !== 'R$ 8.375,00') {
  falhas.push(`com repasse o líquido de 2033 deveria ser R$ 8.375,00, veio ${repasse.linhas.at(-1)?.liquido}`)
}
if (repasse.linhas.at(-1)?.bruto !== 'R$ 11.472,60') {
  falhas.push(`com repasse o bruto de 2033 deveria ser R$ 11.472,60, veio ${repasse.linhas.at(-1)?.bruto}`)
}
if (equilibrio.linhas.at(-1)?.bruto !== 'R$ 11.472,60' || equilibrio.linhas.at(-1)?.liquido !== 'R$ 8.375,00') {
  falhas.push(
    `preço de equilíbrio em 2033 deveria ser R$ 11.472,60 com líquido R$ 8.375,00; veio ${equilibrio.linhas.at(-1)?.bruto} / ${equilibrio.linhas.at(-1)?.liquido}`,
  )
}
if (erros.length) falhas.push(`erros de console: ${erros.length}`)

if (falhas.length) {
  console.log('FALHAS:')
  for (const falha of falhas) console.log(' -', falha)
  process.exitCode = 1
} else {
  console.log('OK: visão de hoje até 2033 consistente (crédito total, repasse e benchmark).')
}

ws.close()
