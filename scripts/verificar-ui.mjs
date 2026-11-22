// Verificação de runtime da interface do simulador usando o Chrome DevTools Protocol.
// Uso: node scripts/verificar-ui.mjs [url]
const url = process.argv[2] || 'http://localhost:8080/api/frete/index.html';
const DEBUG_PORT = 9333;

const alvo = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const alvos = await r.json();
      const pagina = alvos.find((t) => t.type === 'page');
      if (pagina) return pagina;
    } catch (e) { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Não foi possível conectar ao navegador headless.');
};

const pagina = await alvo();
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let id = 0;
const pendentes = new Map();
const eventos = [];

ws.addEventListener('message', (evento) => {
  const msg = JSON.parse(evento.data);
  if (msg.id && pendentes.has(msg.id)) {
    pendentes.get(msg.id)(msg);
    pendentes.delete(msg.id);
  } else if (msg.method) {
    eventos.push(msg);
  }
});

const enviar = (method, params = {}) => new Promise((resolve) => {
  const meuId = ++id;
  pendentes.set(meuId, resolve);
  ws.send(JSON.stringify({ id: meuId, method, params }));
});

const avaliar = async (expressao) => {
  const resposta = await enviar('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true
  });
  if (resposta.result?.exceptionDetails) {
    return { erro: resposta.result.exceptionDetails.text };
  }
  return resposta.result?.result?.value;
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await enviar('Runtime.enable');
await enviar('Log.enable');
await enviar('Page.enable');
await enviar('Page.navigate', { url });

async function aguardarPor(expressao, limiteMs = 25000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const valor = await avaliar(expressao);
    if (valor) return true;
    await esperar(300);
  }
  return false;
}

await aguardarPor("document.querySelectorAll('#tabela-evolucao tbody tr').length > 0");
await esperar(600);

const estrutura = await avaliar(`(() => ({
  kpis: document.querySelectorAll('#kpis .kpi').length,
  barras: document.querySelectorAll('#grafico svg rect.barra').length,
  linhaEvolucao: document.querySelectorAll('#tabela-evolucao tbody tr').length,
  linhaComposicao: document.querySelectorAll('#tabela-composicao tbody tr').length,
  notas: document.querySelectorAll('#notas-etapa .nota').length,
  icmsLinhas: document.querySelectorAll('#tabela-icms tbody tr').length,
  icmsColunas: document.querySelectorAll('#tabela-icms thead th').length,
  icmsDestaque: document.querySelectorAll('#tabela-icms .is-selecionado').length,
  segmentos: document.querySelectorAll('.segmented__item').length,
  valorLabel: document.getElementById('label-valor').textContent,
  icmsHint: document.getElementById('hint-icms').textContent,
  colunasEvolucao: document.querySelectorAll('#tabela-evolucao thead th').length
}))()`);

const clique2029 = await avaliar(`(() => {
  const tr = document.querySelector('#tabela-evolucao tbody tr[data-ano="2029"]');
  if (!tr) return { erro: 'linha 2029 ausente' };
  tr.click();
  const memoria = document.getElementById('memoria');
  return {
    selecionada: tr.classList.contains('is-selecionado'),
    selecionadaComposicao: document.querySelector('#tabela-composicao tbody tr[data-ano="2029"]').classList.contains('is-selecionado'),
    memoriaVisivel: memoria.hidden === false,
    titulo: document.getElementById('memoria-titulo').textContent,
    itens: document.querySelectorAll('#memoria-lista div').length
  };
})()`);

const trocaPeriodicidade = await avaliar(`(async () => {
  const botao = document.querySelector('.segmented__item[data-periodicidade="DIARIO"]');
  botao.click();
  await new Promise((r) => setTimeout(r, 2500));
  const tr = document.querySelector('#tabela-evolucao tbody tr[data-ano="2025"]');
  return {
    label: document.getElementById('label-valor').textContent,
    ariaPressed: botao.getAttribute('aria-pressed'),
    diasUteis: tr.children[2].textContent.trim(),
    valorPeriodo: tr.children[3].textContent.trim(),
    carga2025: tr.children[4].textContent.trim(),
    kpi: document.querySelector('#kpis .kpi__valor').textContent
  };
})()`);

const trocaUf = await avaliar(`(async () => {
  const tipo = document.getElementById('tipoOperacao');
  tipo.value = 'INTERESTADUAL';
  tipo.dispatchEvent(new Event('change'));
  const origem = document.getElementById('ufOrigem');
  const destino = document.getElementById('ufDestino');
  origem.value = 'SP'; origem.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 1500));
  destino.value = 'SP'; destino.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 2500));
  const tr = document.querySelector('#tabela-evolucao tbody tr[data-ano="2025"]');
  return {
    hint: document.getElementById('hint-icms').textContent,
    camposUfsVisiveis: document.getElementById('campo-ufs').hidden === false,
    aliquotaOculta: document.getElementById('campo-aliquota').hidden === true,
    carga2025: tr.children[4].textContent.trim(),
    icmsDestacado: document.querySelector('#tabela-icms .is-selecionado') !== null
  };
})()`);

const municipal = await avaliar(`(async () => {
  const tipo = document.getElementById('tipoOperacao');
  tipo.value = 'MUNICIPAL';
  tipo.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 2500));
  const tr = document.querySelector('#tabela-evolucao tbody tr[data-ano="2025"]');
  return {
    labelAliquota: document.getElementById('label-aliquota').textContent,
    aliquota: document.getElementById('aliquota').value,
    campoUfsOculto: document.getElementById('campo-ufs').hidden === true,
    carga2025: tr.children[4].textContent.trim(),
    status: document.getElementById('form-status').textContent
  };
})()`);

/* ------------------------------------------------------------------ aba 2 · CT-e */

async function esperarPor(expressao, limiteMs = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (await avaliar(expressao)) return true;
    await esperar(250);
  }
  return false;
}

await avaliar("document.getElementById('tab-cte').click()");
const carregouCte = await esperarPor("document.querySelectorAll('#cte-kpis .kpi').length === 4");

const cte = await avaliar(`(() => {
  const kpis = Array.from(document.querySelectorAll('#cte-kpis .kpi__valor')).map((e) => e.textContent.trim());
  const rotulos = Array.from(document.querySelectorAll('#cte-kpis .kpi__label')).map((e) => e.textContent.trim());
  const comparativo = Array.from(document.querySelectorAll('#cte-comparativo tbody tr')).map((tr) => ({
    ano: tr.children[0].textContent.trim(),
    total: tr.children[4].textContent.trim(),
    percentual: tr.children[5].textContent.trim(),
    split: tr.children[6].textContent.trim()
  }));
  const badges = {};
  document.querySelectorAll('#cte-conferencias .badge').forEach((b) => {
    badges[b.className] = (badges[b.className] || 0) + 1;
  });
  return {
    painelVisivel: document.getElementById('painel-cte').hidden === false,
    painelProjecaoOculto: document.getElementById('painel-projecao').hidden === true,
    ariaSelecionada: document.getElementById('tab-cte').getAttribute('aria-selected'),
    kpis,
    rotulos,
    documentoLinhas: document.querySelectorAll('#cte-identificacao dl > div').length,
    chave: (document.getElementById('cte-identificacao').textContent.match(/\\d{4}/g) || []).length,
    componentes: document.querySelectorAll('#cte-componentes tbody tr').length,
    tributos: document.querySelectorAll('#cte-tributos tbody tr').length,
    pagamentoLinhas: document.querySelectorAll('#cte-pagamento tbody tr').length,
    comparativo,
    conferencias: document.querySelectorAll('#cte-conferencias .conferencia').length,
    badges,
    premissas: document.querySelectorAll('#cte-premissas li').length,
    status: document.getElementById('cte-status').textContent
  };
})()`);

await avaliar(`(() => {
  const select = document.getElementById('cteTransportador');
  select.value = 'TAC';
  select.dispatchEvent(new Event('change'));
})()`);
await esperarPor("document.getElementById('cte-pagamento').textContent.includes('INSS')");

const cteTac = await avaliar(`(() => ({
  inssMarcado: document.getElementById('cteRetInss').checked,
  sestMarcado: document.getElementById('cteRetSest').checked,
  retencoes: Array.from(document.querySelectorAll('#cte-pagamento tbody tr th')).map((th) => th.textContent.trim()).filter((t) => t.startsWith('(−)')),
  liquido: document.querySelectorAll('#cte-pagamento tbody tr.is-total td')[0].textContent.trim(),
  kpiLiquido: document.querySelectorAll('#cte-kpis .kpi__valor')[3].textContent.trim()
}))()`);

await avaliar(`(() => {
  const campo = document.getElementById('ctePagamento');
  campo.value = '2027-06-15';
  campo.dispatchEvent(new Event('change'));
})()`);
await esperarPor("document.querySelectorAll('#cte-kpis .kpi__valor')[1].textContent.includes('923')");

const cte2027 = await avaliar(`(() => ({
  status: document.getElementById('cte-status').textContent,
  carga: document.querySelectorAll('#cte-kpis .kpi__valor')[1].textContent.trim(),
  percentual: document.querySelectorAll('#cte-kpis .kpi__meta')[1].textContent.trim(),
  emissao: document.querySelectorAll('#cte-identificacao dd')[2].textContent.trim(),
  comparativo2027: Array.from(document.querySelectorAll('#cte-comparativo tbody tr')).map((tr) => tr.children[6].textContent.trim())[1]
}))()`);

/* --------------------------------------------------------------- aba 3 · produto */

await avaliar("document.getElementById('tab-produto').click()");
const carregouProduto = await esperarPor("document.querySelectorAll('#produto-lacunas tbody tr').length > 0");

const produto = await avaliar(`(() => {
  const linhas = () => document.querySelectorAll('#produto-lacunas tbody tr').length;
  const total = linhas();
  const chips = Array.from(document.querySelectorAll('#produto-filtros .chip'));
  let fiscal = null;
  const chipFiscal = chips.find((c) => c.textContent.trim() === 'Fiscal');
  if (chipFiscal) {
    chipFiscal.click();
    fiscal = linhas();
  }
  return {
    kpis: Array.from(document.querySelectorAll('#produto-kpis .kpi__valor')).map((e) => e.textContent.trim()),
    totalLinhas: total,
    linhasFiscal: fiscal,
    chips: chips.length,
    ondas: document.querySelectorAll('#produto-ondas .onda').length,
    clausulas: document.querySelectorAll('#produto-clausulas .clausula').length,
    anexoHref: document.getElementById('btn-anexo').getAttribute('href')
  };
})()`);

const errosConsole = eventos
  .filter((e) => e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level))
  .map((e) => `${e.params.entry.level}: ${e.params.entry.text}`);

const excecoes = eventos
  .filter((e) => e.method === 'Runtime.exceptionThrown')
  .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);

console.log('estrutura:', JSON.stringify(estrutura, null, 2));
console.log('clique 2029:', JSON.stringify(clique2029, null, 2));
console.log('periodicidade diaria:', JSON.stringify(trocaPeriodicidade, null, 2));
console.log('troca de UF (SP -> SP):', JSON.stringify(trocaUf, null, 2));
console.log('cenario municipal:', JSON.stringify(municipal, null, 2));
console.log('aba CT-e carregada:', carregouCte);
console.log('aba CT-e:', JSON.stringify(cte, null, 2));
console.log('aba CT-e com TAC:', JSON.stringify(cteTac, null, 2));
console.log('aba CT-e pago em 2027:', JSON.stringify(cte2027, null, 2));
console.log('aba produto carregada:', carregouProduto);
console.log('aba produto:', JSON.stringify(produto, null, 2));
console.log('erros de console:', errosConsole.length ? errosConsole : 'nenhum');
console.log('excecoes JS:', excecoes.length ? excecoes : 'nenhuma');

ws.close();
