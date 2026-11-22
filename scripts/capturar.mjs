// Captura uma região da página (por seletor) usando o Chrome DevTools Protocol.
// Uso: node scripts/capturar.mjs "#tabela-icms" saida.png [url]
import { writeFileSync } from 'node:fs';

const seletor = process.argv[2] || '#tabela-icms';
const destino = process.argv[3] || 'tmp-secao.png';
const url = process.argv[4] || 'http://localhost:8080/api/frete/index.html';
const DEBUG_PORT = 9333;

const lista = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
const pagina = lista.find((t) => t.type === 'page');
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pendentes = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg);
    pendentes.delete(msg.id);
  }
});

const enviar = (method, params = {}) => new Promise((resolve) => {
  const meuId = ++id;
  pendentes.set(meuId, resolve);
  ws.send(JSON.stringify({ id: meuId, method, params }));
});

const avaliar = async (expression) => {
  const r = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await enviar('Runtime.enable');
await enviar('Page.enable');
await enviar('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false
});
await enviar('Page.navigate', { url });

for (let i = 0; i < 60; i++) {
  if (await avaliar("document.querySelectorAll('#tabela-evolucao tbody tr').length > 0")) break;
  await new Promise((r) => setTimeout(r, 300));
}

const caixa = await avaliar(`(() => {
  const alvo = document.querySelector('${seletor}');
  if (!alvo) return null;
  alvo.scrollIntoView({ block: 'center' });
  const r = alvo.getBoundingClientRect();
  return {
    x: Math.max(0, r.left + window.scrollX - 24),
    y: Math.max(0, r.top + window.scrollY - 90),
    width: Math.min(window.innerWidth, r.width + 48),
    height: r.height + 120
  };
})()`);

if (!caixa) {
  console.log('Seletor não encontrado:', seletor);
  process.exit(1);
}

const captura = await enviar('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { ...caixa, scale: 1 }
});

writeFileSync(destino, Buffer.from(captura.result.data, 'base64'));
console.log('Captura salva:', destino, JSON.stringify(caixa));
ws.close();
