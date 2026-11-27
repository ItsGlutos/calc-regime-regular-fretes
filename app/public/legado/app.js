/* Frete Líquido — interface. Sem framework, sem build: DOM na mão. */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor)

const esc = (valor) =>
  String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere])

const nfBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const nfNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const brl = (valor) => nfBRL.format(Number(valor) || 0).replace(/\u00a0/g, ' ')
const numero = (valor, casas = 2) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(Number(valor) || 0)
const pct = (valor, casas = 2) => `${numero(valor, casas)}%`

const ICONE = {
  alerta: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M12 8v5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.1" fill="currentColor"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m8.2 12.3 2.6 2.6 5-5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  neutro: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/></svg>`,
  lixeira: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"><path d="M4 7h16M9.5 7V4.8h5V7M7 7l.8 12.2h8.4L17 7M10 11v4.5M14 11v4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  motor: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3.8" stroke="currentColor" stroke-width="1.8"/></svg>`,
  auditar: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M6 3.5h7.5L18 8v12.5H6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.5 3.5V8H18M9 12h6M9 15.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

const estado = {
  opcoes: null,
  regime: 'SIMPLES',
  perfil: 'SIMPLES_DAS',
  operacao: 'B2B',
  regimePagadora: 'NAO_CUMULATIVO',
  cargas: [
    { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS', pCbs: '', pIbs: '' },
    { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO', pCbs: '', pIbs: '' },
  ],
  ultimaSimulacao: null,
  ultimaComparacao: null,
  timeline: null,
  timelineMetrica: 'custo',
  timelineSeq: 0,
  horizonte: null,
  horizonteCenario: 'congelado',
  horizonteSeq: 0,
  perfis: {
    lista: [],
    atualId: null,
    detalhe: null,
    ano: Math.min(2033, Math.max(2026, new Date().getFullYear())),
    mes: new Date().getMonth() + 1,
    seq: 0,
    comparacaoSeq: 0,
    timer: null,
    sujo: false,
  },
}

/* ------------------------------------------------------------------ */
/* Formatação de dinheiro                                              */
/* ------------------------------------------------------------------ */

function numeroDeTexto(valor) {
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

/* ------------------------------------------------------------------ */
/* Opções                                                              */
/* ------------------------------------------------------------------ */

async function carregarOpcoes() {
  const resposta = await fetch('/api/opcoes')
  if (!resposta.ok) throw new Error('Não foi possível carregar as opções do simulador.')
  return resposta.json()
}

function renderizarRegimes() {
  const alvo = $('#regime')
  if (!alvo) return
  alvo.innerHTML = estado.opcoes.regimes
    .map(
      (regime) => `
      <button
        type="button"
        role="radio"
        class="regime__option"
        data-regime="${regime.id}"
        aria-checked="${regime.id === estado.regime}"
      >
        <span class="regime__title">${esc(regime.rotulo)}</span>
        <span class="regime__sub">${esc(regime.sub)}</span>
      </button>`,
    )
    .join('')

  const atual = estado.opcoes.regimes.find((regime) => regime.id === estado.regime)
  $('#regimeHint').textContent = atual?.descricao ?? ''
}

function renderizarPerfis() {
  const alvo = $('#perfil')
  const perfis = estado.opcoes.perfis.filter((perfil) => perfil.regime === estado.regime)

  alvo.innerHTML = perfis
    .map((perfil) => `<option value="${perfil.id}">${esc(perfil.varianteRotulo)}</option>`)
    .join('')

  if (!perfis.some((perfil) => perfil.id === estado.perfil)) {
    estado.perfil = perfis[0]?.id ?? estado.perfil
  }
  alvo.value = estado.perfil
}

function renderizarAtividades() {
  const alvo = $('#atividade')
  alvo.innerHTML = estado.opcoes.atividadesSimples
    .map((atividade) => `<option value="${atividade.id}">${esc(atividade.rotulo)}</option>`)
    .join('')
  alvo.value = estado.opcoes.atividadesSimples[0]?.id ?? '05'
}

function renderizarOperacao() {
  $('#operacao').innerHTML = estado.opcoes.tiposOperacao
    .map(
      (tipo) => `
      <button type="button" role="radio" aria-checked="${tipo.id === estado.operacao}" data-valor="${tipo.id}">
        ${esc(tipo.rotulo)}
      </button>`,
    )
    .join('')
  const atual = estado.opcoes.tiposOperacao.find((tipo) => tipo.id === estado.operacao)
  $('#operacaoHint').textContent = atual?.descricao ?? ''
  atualizarPagadora()
}

function renderizarRegimePagadora() {
  const alvo = $('#regimePagadora')
  if (!alvo || !estado.opcoes.regimesPagadora) return
  alvo.innerHTML = estado.opcoes.regimesPagadora
    .map((regime) => `<option value="${regime.id}">${esc(regime.rotulo)}</option>`)
    .join('')
  alvo.value = estado.regimePagadora
  atualizarPagadora()
}

function atualizarPagadora() {
  const alvo = $('#regimePagadora')
  const dica = $('#regimePagadoraHint')
  if (!alvo) return
  const regime = estado.opcoes?.regimesPagadora?.find((item) => item.id === estado.regimePagadora)
  const b2c = estado.operacao === 'B2C'
  alvo.disabled = b2c
  alvo.value = estado.regimePagadora
  dica.textContent = b2c
    ? 'Operação B2C: o pagador é o consumidor final e não aproveita crédito. O regime da sua empresa não muda o custo.'
    : (regime?.descricao ?? '') + ' Define o crédito total que você recupera do CT-e.'
}

function renderizarUfs() {
  const regioes = [...new Set(estado.opcoes.ufs.map((uf) => uf.regiao))]
  const opcoes = regioes
    .map(
      (regiao) => `
      <optgroup label="${esc(regiao)}">
        ${estado.opcoes.ufs
          .filter((uf) => uf.regiao === regiao)
          .map((uf) => `<option value="${uf.sigla}">${uf.sigla} — ${esc(uf.nome)}</option>`)
          .join('')}
      </optgroup>`,
    )
    .join('')

  $('#ufOrigem').innerHTML = opcoes
  $('#ufDestino').innerHTML = opcoes
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
}

function renderizarAnos() {
  $('#ano').innerHTML = estado.opcoes.anos
    .map((item) => `<option value="${item.ano}">${item.ano} — ${esc(item.rotulo)}</option>`)
    .join('')
  $('#ano').value = '2033'
}

function atualizarPerfil() {
  const perfil = estado.opcoes.perfis.find((item) => item.id === estado.perfil)
  if (!perfil) return

  const regime = estado.opcoes.regimes.find((item) => item.id === estado.regime)
  $('#regimeHint').textContent = regime?.descricao ?? ''

  const ehSimples = perfil.id === 'SIMPLES_DAS'
  $('#simplesWrap').hidden = !ehSimples

  $('#perfilHint').textContent = ehSimples
    ? `${perfil.varianteHint} Informe as alíquotas do PGDAS abaixo para o cálculo real; sem elas, vale a faixa estimada.`
    : perfil.varianteHint

  const ano = Number($('#ano')?.value ?? 2033)
  const anoInicio = estado.opcoes?.anoInicioSimples ?? 2027
  const temReal = ehSimples && temAliquotasSimples() && ano >= anoInicio
  const usaEstimativa = ehSimples ? !temReal : perfil.estimativa
  const envoltorio = $('#taxaWrap')
  envoltorio.hidden = !usaEstimativa

  if (ehSimples) {
    atualizarFonteSimples()
  }

  if (!usaEstimativa) return

  const slider = $('#taxaRange')
  slider.min = String(perfil.min)
  slider.max = String(perfil.max)
  slider.step = '0.01'
  slider.value = String(perfil.ref)
  slider.setAttribute('aria-valuetext', `${numero(perfil.ref)}% do frete`)
  $('#taxaMin').textContent = pct(perfil.min)
  $('#taxaMax').textContent = pct(perfil.max)
  $('#taxaOut').textContent = pct(perfil.ref)
}

function temAliquotasSimples() {
  return Boolean($('#aliquotaCbs')?.value.trim() && $('#aliquotaIbs')?.value.trim())
}

function atualizarTotalSimples() {
  const caixa = $('#simplesTotal')
  if (!caixa) return
  const cbs = numeroDeTexto($('#aliquotaCbs')?.value)
  const ibs = numeroDeTexto($('#aliquotaIbs')?.value)
  const preenchidas = Number(Number.isFinite(cbs)) + Number(Number.isFinite(ibs))

  if (preenchidas === 2) {
    caixa.hidden = false
    $('#simplesTotalValor').textContent = pct(cbs + ibs, 4)
    $('#simplesTotalHint').textContent = `CBS ${pct(cbs, 4)} + IBS ${pct(ibs, 4)}`
  } else {
    caixa.hidden = true
    $('#simplesTotalHint').textContent = 'Alíquotas efetivas do PGDAS'
  }
}

function atualizarFonteSimples() {
  const cbs = $('#aliquotaCbs').value.trim()
  const ibs = $('#aliquotaIbs').value.trim()
  const preenchidas = Number(Boolean(cbs)) + Number(Boolean(ibs))
  const ano = Number($('#ano')?.value ?? 2033)
  const anoInicio = estado.opcoes?.anoInicioSimples ?? 2027
  const real = preenchidas === 2 && ano >= anoInicio

  $('#simplesFonte').textContent =
    preenchidas === 2 && ano < anoInicio
      ? `estimativa em ${ano}`
      : preenchidas === 2
        ? 'cálculo real'
        : preenchidas === 1
          ? 'preencha as duas'
          : 'estimativa'
  $('#taxaWrap').hidden = real
  atualizarTotalSimples()

  if (!real) {
    const perfil = estado.opcoes?.perfis.find((item) => item.id === 'SIMPLES_DAS')
    if (perfil) {
      const slider = $('#taxaRange')
      slider.min = String(perfil.min)
      slider.max = String(perfil.max)
      slider.step = '0.01'
      slider.value = String(perfil.ref)
      slider.setAttribute('aria-valuetext', `${numero(perfil.ref)}% do frete`)
      $('#taxaMin').textContent = pct(perfil.min)
      $('#taxaMax').textContent = pct(perfil.max)
      $('#taxaOut').textContent = pct(perfil.ref)
    }
  }
}

function atualizarAno() {
  const ano = Number($('#ano').value)
  const item = estado.opcoes.anos.find((entrada) => entrada.ano === ano)
  if (!item) return

  $('#headDestaque').textContent = pct(item.aliquota.total)
  $('#headDestaqueSub').textContent = `CBS ${numero(item.aliquota.cbs)} + IBS ${numero(item.aliquota.ibsUf + item.aliquota.ibsMun)}${ano >= 2027 ? ' · premissa' : ''}`

  const dicas = {
    TESTE:
      'Fase de teste: 1% destacado no CT-e e compensado pelo transportador; não há crédito de CBS/IBS. O crédito do ano é ICMS + PIS/COFINS.',
    CBS_PLENA:
      'CBS cheia e IBS ainda em teste. A diferença entre regimes começa a aparecer. Alíquotas de referência (premissa): o Senado fixa a alíquota a cada ano.',
    TRANSICAO_IBS:
      'IBS cresce e o ICMS cai na mesma proporção. O crédito do frete aumenta ano a ano. Alíquotas de referência (premissa).',
    REGIME_PLENO:
      'Regime pleno: CBS 8,50% + IBS 18,50% (premissa de referência). É o cenário que compara de verdade os regimes.',
  }
  const simplesIndisponivel =
    estado.perfil === 'SIMPLES_DAS' && ano < estado.opcoes.anoInicioSimples
      ? ` O Motor do Simples só tem tabelas a partir de ${estado.opcoes.anoInicioSimples}; neste ano não há crédito de CBS/IBS do Simples (LC 214/2025, art. 348, III, "c").`
      : ''
  $('#anoHint').textContent = `${dicas[item.fase] ?? ''}${simplesIndisponivel}`
  if (estado.perfil === 'SIMPLES_DAS') atualizarFonteSimples()
}

function atualizarMotor() {
  const regular = estado.opcoes.motor
  const simples = estado.opcoes.motorSimples
  const pilula = $('#enginePill')
  const offline = !regular.online || !simples.online
  pilula.classList.toggle('is-offline', offline)

  const rotuloRegular = regular.online ? `${regular.versao ?? 'online'}` : 'regular offline'
  const rotuloSimples = simples.online ? `${simples.versao ?? 'online'}` : 'SN offline'
  $('#engineVersion').textContent = `${rotuloRegular} · ${rotuloSimples}`
  pilula.title = `Regime regular: ${regular.url} (${regular.online ? 'online' : 'offline'}) · Simples Nacional: ${simples.url} (${simples.online ? 'online' : 'offline'})`

  const alerta = $('#motorAlert')
  if (offline) {
    alerta.hidden = false
    const linhas = []
    if (!regular.online) {
      linhas.push(
        `<li>Regime regular (<code>${esc(regular.url)}</code>): offline. ${regular.erro ? esc(regular.erro) : ''}</li>`,
      )
    }
    if (!simples.online) {
      linhas.push(
        `<li>Simples Nacional (<code>${esc(simples.url)}</code>): offline. ${simples.erro ? esc(simples.erro) : ''}</li>`,
      )
    }
    alerta.innerHTML = `${ICONE.motor.replace('width="18" height="18"', 'width="18" height="18" style="flex:none;margin-top:1px"')}
      <div>
        <strong>Um dos motores oficiais não está respondendo.</strong>
        <ul style="margin:8px 0 0;padding-left:18px">${linhas.join('')}</ul>
        Suba os dois serviços com <code>.\\run.ps1</code> e recarregue.
      </div>`
  } else {
    alerta.hidden = true
    alerta.innerHTML = ''
  }
}

/* ------------------------------------------------------------------ */
/* Simulação                                                           */
/* ------------------------------------------------------------------ */

function lerEntrada() {
  const perfil = estado.opcoes.perfis.find((item) => item.id === estado.perfil)
  const ehSimples = perfil?.id === 'SIMPLES_DAS'
  const ano = Number($('#ano').value)
  const anoInicio = estado.opcoes.anoInicioSimples ?? 2027
  const usaReal = ehSimples && temAliquotasSimples() && ano >= anoInicio
  return {
    valorFrete: $('#valor').value,
    perfil: estado.perfil,
    regimePagadora: estado.regimePagadora,
    tipoOperacao: estado.operacao,
    ufOrigem: $('#ufOrigem').value,
    ufDestino: $('#ufDestino').value,
    ano,
    taxaCredito: perfil?.estimativa && !usaReal ? Number($('#taxaRange').value) : undefined,
    aliquotaCbs: ehSimples ? $('#aliquotaCbs').value.trim() : undefined,
    aliquotaIbs: ehSimples ? $('#aliquotaIbs').value.trim() : undefined,
    dasTotal: ehSimples ? $('#dasTotal').value.trim() : undefined,
    insumos: ehSimples ? $('#insumos').value.trim() : undefined,
    atividade: ehSimples ? $('#atividade').value : undefined,
  }
}

async function post(url, corpo) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro || `O servidor respondeu HTTP ${resposta.status}.`)
  return dados
}

async function simular() {
  const botao = $('#calcular')
  const painel = $('#resultado')
  const entrada = lerEntrada()

  botao.classList.add('is-loading')
  botao.disabled = true
  painel.setAttribute('aria-busy', 'true')
  painel.classList.add('is-loading')

  if (!painel.querySelector('.result__head')) mostrarEsqueleto(painel)

  carregarTimeline(entrada)
  carregarHorizonte(entrada)

  try {
    const dados = await post('/api/simular', entrada)
    estado.ultimaSimulacao = dados
    renderizarResultado(dados)
  } catch (erro) {
    mostrarErro(painel, erro.message)
  } finally {
    botao.classList.remove('is-loading')
    botao.disabled = false
    painel.setAttribute('aria-busy', 'false')
    painel.classList.remove('is-loading')
  }
}

function mostrarEsqueleto(painel) {
  painel.className = 'card result'
  painel.innerHTML = `
    <div class="skeleton-wrap" aria-hidden="true">
      <div class="skeleton skeleton--line w-30"></div>
      <div class="skeleton skeleton--hero"></div>
      <div class="skeleton skeleton--line w-60"></div>
      <div class="skeleton skeleton--bar"></div>
      <div class="skeleton skeleton--block"></div>
    </div>`
}

function mostrarErro(painel, mensagem) {
  painel.className = 'card result result--error'
  painel.innerHTML = `
    <div class="error-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.4" r="1.15" fill="currentColor"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>
    </div>
    <h2>Não foi possível calcular</h2>
    <p>${esc(mensagem)}</p>
    <p>Confira se os dois motores estão no ar: regime regular em <code>http://127.0.0.1:8080</code> e Simples Nacional em <code>http://127.0.0.1:8082</code>. O cálculo de CBS/IBS não é refeito aqui — sem o motor do regime escolhido, não há simulação.</p>
    <button class="btn btn--ghost" type="button" id="tentarNovamente">Tentar de novo</button>`

  $('#tentarNovamente')?.addEventListener('click', () => simular())
}

function passosHTML(simulacao) {
  return simulacao.memoria
    .map(
      (passo) => `
      <div class="step ${passo.destaque ? 'step--total' : ''}">
        <dt>${esc(passo.rotulo)}</dt>
        <dd>${esc(passo.valor)}</dd>
        <p>${esc(passo.nota)}</p>
      </div>`,
    )
    .join('')
}

function renderizarResultado(dados) {
  const painel = $('#resultado')
  const { entrada, motor, resultado } = dados

  if (motor.versao) {
    const alvo = motor.fonte === 'simples-nacional' ? estado.opcoes.motorSimples : estado.opcoes.motor
    alvo.online = true
    alvo.versao = motor.versao
    alvo.baseDados = motor.baseDados ?? alvo.baseDados
    atualizarMotor()
  }

  const niveis = { atencao: 'warn', ok: 'ok', neutro: 'neutral' }
  const icone = resultado.alerta.nivel === 'atencao' ? ICONE.alerta : resultado.alerta.nivel === 'ok' ? ICONE.ok : ICONE.neutro
  const coberturaTotal = Math.max(0, Math.min(100, resultado.percentualCreditoTotal))
  const creditoPerdido = resultado.creditoPerdido
  const fonte = entrada.perfil.fonteCredito
  const chipFonte =
    fonte === 'simples'
      ? '<span class="chip chip--best">motor do Simples · PGDAS</span>'
      : fonte === 'integral' && entrada.perfil.id === 'SIMPLES_HIBRIDO'
        ? '<span class="chip chip--best">regime regular</span>'
        : fonte === 'estimativa'
          ? '<span class="chip chip--best">crédito estimado</span>'
          : ''
  const avisos = Array.isArray(dados.avisos) && dados.avisos.length
    ? `<div class="callout">${ICONE.info}<div>${dados.avisos.map((aviso) => `<p>${esc(aviso)}</p>`).join('')}</div></div>`
    : ''

  painel.className = 'card result'
  painel.innerHTML = `
    <div class="result__head">
      <span class="eyebrow-sm">Resultado · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      <div class="chips">
        <span class="chip">${esc(entrada.perfil.curto)}</span>
        <span class="chip">${esc(entrada.tipoOperacao)}</span>
        <span class="chip">${esc(entrada.rota)}</span>
        <span class="chip chip--year">${entrada.ano} · ${esc(motor.faseRotulo)}</span>
        ${chipFonte}
      </div>
    </div>

    <div class="result__main">
      <div>
        <span class="result__label">Custo líquido total</span>
        <div class="net">
          <span class="net__cur">R$</span>
          <span class="net__val">${numero(resultado.custoTotal)}</span>
        </div>
        <p class="result__sub">
          de <b>${brl(entrada.valorFrete)}</b> nominais · crédito de <b>${brl(resultado.creditoTotal)}</b>
          (CBS/IBS ${brl(resultado.creditoCbsIbs)}${resultado.creditoAntigos.total > 0 ? ` + ICMS/PIS/COFINS ${brl(resultado.creditoAntigos.total)}` : ''})
        </p>
        <p class="result__nota">
          Soma ICMS, PIS/COFINS e CBS/IBS creditados no ano. A trajetória até 2033 e o preço que você deveria
          pagar estão em <a href="#hojeAmanha">Seu frete ao longo da reforma</a>.
        </p>
      </div>
      <dl class="metrics">
        <div><dt>Crédito total</dt><dd>${brl(resultado.creditoTotal)} <span class="metric-pct">${pct(resultado.percentualCreditoTotal)}</span></dd></div>
        <div><dt>CBS/IBS destacado</dt><dd>${brl(motor.destaque)}</dd></div>
        <div><dt>ICMS + PIS/COFINS</dt><dd>${brl(resultado.creditoAntigos.total)}</dd></div>
      </dl>
    </div>

    <div class="split">
      <div class="split__bar" role="img" aria-label="${pct(coberturaTotal)} do frete volta como crédito">
        ${coberturaTotal > 0 ? `<span style="width:${coberturaTotal}%"></span>` : ''}
      </div>
      <div class="split__legend">
        <span>${coberturaTotal > 0 ? `${pct(coberturaTotal)} volta como crédito` : 'sem crédito nesta operação'}</span>
        <span>${pct(100 - coberturaTotal)} fica no custo</span>
      </div>
    </div>

    <div class="alert alert--${niveis[resultado.alerta.nivel] ?? 'neutral'}" role="status">
      ${icone}
      <div>
        <strong>${esc(resultado.alerta.titulo)}</strong>
        <p>${esc(resultado.alerta.texto)}</p>
      </div>
    </div>

    ${avisos}

    <div class="audit">
      <div class="audit__head">
        <h3>Memória de cálculo</h3>
        <span class="tag">${esc(motor.nome ?? 'motor oficial')}</span>
      </div>
      <dl class="steps">${passosHTML(dados)}</dl>

      <details class="raw" open>
        <summary>
          Resposta bruta do motor
          <span class="raw__meta">HTTP ${motor.status} · API ${esc(motor.versao ?? '—')} · base ${esc(motor.baseDados ?? '—')}</span>
        </summary>
        <pre>${esc(JSON.stringify(motor.resposta, null, 2))}</pre>
        <div class="raw__bar">
          <span>${esc(motor.rotuloOperacao)}${motor.calculoSimulado ? ' · cálculo simulado' : ''}</span>
          <button class="btn btn--tiny" type="button" data-copiar-sim>Copiar JSON</button>
        </div>
      </details>

      <details class="premissas">
        <summary>Premissas e limites da simulação</summary>
        <ul>${dados.premissas.map((premissa) => `<li>${esc(premissa)}</li>`).join('')}</ul>
      </details>
    </div>`
}

/* ------------------------------------------------------------------ */
/* Comparador                                                          */
/* ------------------------------------------------------------------ */

function renderizarCargas() {
  const perfis = estado.opcoes.perfis
  const letras = 'ABC'

  $('#carriers').innerHTML = estado.cargas
    .map(
      (carga, indice) => `
      <div class="carrier" data-indice="${indice}">
        <div class="carrier__id" aria-hidden="true">${letras[indice]}</div>
        <div class="carrier__field carrier__field--name">
          <label for="nome-${indice}">Transportadora</label>
          <input id="nome-${indice}" data-campo="nome" type="text" maxlength="80" value="${esc(carga.nome)}" placeholder="Nome da transportadora" />
        </div>
        <div class="carrier__field carrier__field--price">
          <label for="preco-${indice}">Preço nominal</label>
          <div class="input-prefix">
            <span aria-hidden="true">R$</span>
            <input id="preco-${indice}" data-campo="preco" type="text" inputmode="decimal" value="${esc(carga.preco)}" />
          </div>
        </div>
        <div class="carrier__field carrier__field--regime">
          <label for="regime-${indice}">Regime tributário</label>
          <select id="regime-${indice}" data-campo="perfil">
            ${perfis
              .map(
                (perfil) =>
                  `<option value="${perfil.id}" ${perfil.id === carga.perfil ? 'selected' : ''}>${esc(perfil.curto)}</option>`,
              )
              .join('')}
          </select>
        </div>
        <button class="icon-btn carrier__remove" type="button" data-remover="${indice}" aria-label="Remover ${esc(carga.nome) || `transportadora ${letras[indice]}`}" ${estado.cargas.length <= 2 ? 'disabled' : ''}>
          ${ICONE.lixeira}
        </button>
        <div class="carrier__rates" ${carga.perfil === 'SIMPLES_DAS' ? '' : 'hidden'}>
          <div class="carrier__field">
            <label for="cbs-${indice}">CBS % (PGDAS)</label>
            <input id="cbs-${indice}" data-campo="pCbs" type="text" inputmode="decimal" value="${esc(carga.pCbs ?? '')}" placeholder="2,3591" />
          </div>
          <div class="carrier__field">
            <label for="ibs-${indice}">IBS % (PGDAS)</label>
            <input id="ibs-${indice}" data-campo="pIbs" type="text" inputmode="decimal" value="${esc(carga.pIbs ?? '')}" placeholder="0,0260" />
          </div>
        </div>
      </div>`,
    )
    .join('')

  $('#adicionar').disabled = estado.cargas.length >= 3
  $('#adicionar').style.opacity = estado.cargas.length >= 3 ? '.5' : '1'
}

function marcarDesatualizado(desatualizado) {
  const nota = $('#staleNote')
  const alvo = $('#comparacao')
  if (!nota) return
  nota.hidden = !desatualizado
  alvo?.classList.toggle('is-stale', Boolean(desatualizado))
  if (desatualizado) marcarTimelineDesatualizado(true)
  marcarHorizonteDesatualizado(desatualizado)
}

async function comparar() {
  const botao = $('#comparar')
  const alvo = $('#comparacao')

  botao.classList.add('is-loading')
  botao.disabled = true
  alvo.setAttribute('aria-busy', 'true')

  try {
    const dados = await post('/api/comparar', {
      transportadoras: estado.cargas.map((carga) => ({
        nome: carga.nome,
        preco: carga.preco,
        perfil: carga.perfil,
        aliquotaCbs: carga.perfil === 'SIMPLES_DAS' ? carga.pCbs : undefined,
        aliquotaIbs: carga.perfil === 'SIMPLES_DAS' ? carga.pIbs : undefined,
        atividade: carga.perfil === 'SIMPLES_DAS' ? '05' : undefined,
      })),
      ano: Number($('#ano').value),
      tipoOperacao: estado.operacao,
      regimePagadora: estado.regimePagadora,
      ufOrigem: $('#ufOrigem').value,
      ufDestino: $('#ufDestino').value,
    })
    estado.ultimaComparacao = dados
    renderizarComparacao(dados)
    marcarDesatualizado(false)
  } catch (erro) {
    alvo.innerHTML = `<div class="comparison-error">${esc(erro.message)}</div>`
  } finally {
    botao.classList.remove('is-loading')
    botao.disabled = false
    alvo.setAttribute('aria-busy', 'false')
  }
}

function renderizarComparacao(dados) {
  const { ranking, resumo, economia, precoIgual, vencedor } = dados
  const menorPreco = [...ranking].sort((a, b) => a.valorFrete - b.valorFrete)[0]
  const campeao = ranking[0]

  const linhas = ranking
    .map(
      (item, indice) => `
      <tr class="${indice === 0 ? 'is-best' : ''}">
        <td><span class="rank">${indice + 1}</span></td>
        <td class="cell-name">
          <strong>${esc(item.nome)}</strong>
          <small class="cell-meta"><span>${esc(item.perfil.curto)}${item.perfil.fonteCredito === 'simples' ? ' · PGDAS' : item.perfil.fonteCredito === 'estimativa' ? ' · estimado' : ''}</span><span>${brl(item.valorFrete)} nominais</span></small>
          ${indice === 0 ? '<span class="best-chip">melhor no líquido</span>' : ''}
        </td>
        <td>${esc(item.perfil.curto)}</td>
        <td class="num">${brl(item.valorFrete)}</td>
        <td class="num">
          ${item.alerta.nivel === 'atencao' ? `<span class="alert-dot" title="Crédito de CBS/IBS abaixo de 4% do frete"></span>` : ''}
          ${pct(item.percentualCreditoTotal)}
        </td>
        <td class="num cell-net">${brl(item.custoTotal)}</td>
        <td class="num delta">${indice === 0 ? '—' : `+ ${brl(item.diferencaParaMelhor)}`}</td>
        <td>
          <button class="audit-toggle" type="button" data-auditar="${indice}" aria-expanded="false" aria-label="Auditar ${esc(item.nome)}" title="Ver memória de cálculo">
            <span class="audit-label">Auditar</span>
            ${ICONE.auditar}
          </button>
        </td>
      </tr>
      <tr class="audit-row" hidden>
        <td colspan="8">
          <div class="audit-cell">
            <dl class="steps">${passosHTML(item.simulacao)}</dl>
            <pre>${esc(JSON.stringify(item.simulacao.motor.resposta, null, 2))}</pre>
            <div class="raw__bar">
              <span>${esc(item.nome)} · ${esc(item.simulacao.entrada.perfil.curto)} · ${esc(item.simulacao.entrada.rota)} · ${item.simulacao.entrada.ano}</span>
              <button class="btn btn--tiny" type="button" data-copiar-linha="${indice}">Copiar JSON</button>
            </div>
          </div>
        </td>
      </tr>`,
    )
    .join('')

  const ano = dados.entrada?.ano ?? 2033
  const anoHoje = dados.entrada?.anoHoje ?? 2026
  const linhasCaminhos = ranking
    .map(
      (item) => `
      <tr>
        <td class="cell-name" data-rotulo="Transportadora"><strong>${esc(item.nome)}</strong><small class="cell-meta">${esc(item.perfil.curto)}</small></td>
        <td class="num" data-rotulo="Líquido hoje">${brl(item.hoje?.liquido ?? item.liquidoEquilibrio)}</td>
        <td class="num" data-rotulo="Líquido em ${ano} · preço travado">${brl(item.liquidoTravado)}${typeof item.variacaoLiquidoTravado === 'number' ? `<small>${sinalPercentual(item.variacaoLiquidoTravado)}</small>` : ''}</td>
        <td class="num cell-equilibrio" data-rotulo="Preço de equilíbrio">${item.precoEquilibrio === null || item.precoEquilibrio === undefined ? '—' : brl(item.precoEquilibrio)}${typeof item.variacaoPreco === 'number' ? `<small>${sinalPercentual(item.variacaoPreco)}</small>` : ''}</td>
        <td class="num" data-rotulo="Seu líquido mantido">${brl(item.liquidoEquilibrio ?? item.hoje?.liquido)}</td>
      </tr>`,
    )
    .join('')

  const tabelaCaminhosComparador = `
    <div class="comparator__caminhos">
      <div class="horizonte__tabela-head">
        <h3>Seu líquido: hoje × ${ano}</h3>
        <span class="horizonte__fonte">Preço travado = nominal contratado. Preço de equilíbrio = preço que mantém o seu líquido de hoje em ${ano}.</span>
      </div>
      <div class="table-wrap">
        <table class="table table--caminhos" aria-label="Líquido hoje e preço de equilíbrio por transportadora">
          <thead>
            <tr>
              <th>Transportadora</th>
              <th class="num">Líquido hoje</th>
              <th class="num">Líquido em ${ano}<small>preço travado</small></th>
              <th class="num">Preço de equilíbrio<small>para manter hoje</small></th>
              <th class="num">Seu líquido mantido</th>
            </tr>
          </thead>
          <tbody>${linhasCaminhos}</tbody>
        </table>
      </div>
      <p class="table-note">O ranking acima continua sendo pelo custo líquido no preço nominal. Esta tabela mostra o outro lado: quanto o preço precisaria mudar em ${ano} para o seu líquido ficar no nível de ${anoHoje}. No Simples/MEI o preço de equilíbrio é o do seu líquido, não o piso do transportador.</p>
    </div>`

  const observacoes = []
  if (precoIgual && economia > 0) {
    observacoes.push(`
      <div class="callout">
        ${ICONE.info}
        <p><strong>Mesmo preço nominal de ${brl(campeao.valorFrete)}.</strong> A diferença de ${brl(economia)} no líquido vem do crédito total do regime: ${esc(campeao.nome)} credita ${pct(campeao.percentualCreditoTotal)} (CBS/IBS ${pct(campeao.percentualCreditoCbsIbs ?? 0)} + ICMS/PIS/COFINS) contra ${pct(ranking[ranking.length - 1].percentualCreditoTotal)} de ${esc(ranking[ranking.length - 1].nome)}.</p>
      </div>`)
  }
  if (menorPreco.nome !== campeao.nome) {
    observacoes.push(`
      <div class="callout">
        ${ICONE.info}
        <p><strong>O menor preço nominal não é o menor custo líquido.</strong> ${esc(menorPreco.nome)} cobra ${brl(menorPreco.valorFrete)}, mas ${esc(campeao.nome)} custa ${brl(menorPreco.custoTotal - campeao.custoTotal)} menos depois do crédito.</p>
      </div>`)
  }

  $('#comparacao').innerHTML = `
    <div class="ranking">
      <div class="ranking__head">
        <div>
          <span class="eyebrow-sm">Ranking por custo líquido total</span>
          <p class="ranking__resumo">${esc(resumo)}</p>
        </div>
        <span class="chip chip--best">vencedor · ${esc(vencedor)}</span>
      </div>

      <div class="table-wrap">
        <table class="table table--ranking">
          <caption class="sr-only">Transportadoras ordenadas por custo líquido depois do crédito total</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Transportadora</th>
              <th scope="col">Regime</th>
              <th scope="col" class="num">Preço nominal</th>
              <th scope="col" class="num">Crédito total</th>
              <th scope="col" class="num">Custo líquido</th>
              <th scope="col" class="num">Δ</th>
              <th scope="col"><span class="sr-only">Auditoria</span></th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <p class="table-note">Crédito total = CBS/IBS do destaque + ICMS e PIS/COFINS quando o transportador os destaca no CT-e (só o regime regular). Simples/DAS: cálculo real pelo Motor do Simples quando as alíquotas do PGDAS são informadas; sem elas, faixa setorial estimada. Simples híbrido: só o CBS/IBS destacado no regime regular vira crédito — o ICMS fica no DAS.</p>
      ${tabelaCaminhosComparador}
      ${observacoes.join('')}
    </div>`
}

/* ------------------------------------------------------------------ */
/* Antes e depois da reforma                                           */
/* ------------------------------------------------------------------ */

const sinalNumero = (valor, formatador = (v) => brl(v)) => {
  const n = Number(valor) || 0
  if (Math.abs(n) < 0.005) return formatador(0)
  return `${n > 0 ? '+' : '−'} ${formatador(Math.abs(n))}`
}

const sinalPontos = (valor) => {
  const n = Number(valor) || 0
  if (Math.abs(n) < 0.00005) return '0,00 p.p.'
  return `${n > 0 ? '+' : '−'} ${numero(Math.abs(n))} p.p.`
}

const METRICAS = [
  {
    id: 'custo',
    rotulo: 'Custo líquido total',
    curto: 'Custo',
    valor: (linha) => linha.custoLiquido,
    percentual: false,
  },
  {
    id: 'credito',
    rotulo: 'Crédito total',
    curto: 'Crédito',
    valor: (linha) => linha.credito,
    percentual: true,
  },
  {
    id: 'carga',
    rotulo: 'Carga tributária',
    curto: 'Carga',
    valor: (linha) => linha.carga,
    percentual: true,
  },
]

const metricaAtual = () =>
  METRICAS.find((metrica) => metrica.id === estado.timelineMetrica) ?? METRICAS[0]

function renderizarMetricaTimeline() {
  const alvo = $('#timelineMetrica')
  if (!alvo) return
  alvo.innerHTML = METRICAS.map(
    (metrica) =>
      `<button type="button" role="radio" aria-checked="${metrica.id === estado.timelineMetrica}" data-metrica="${metrica.id}" title="${metrica.rotulo}"><span class="metrica__longa">${metrica.rotulo}</span><span class="metrica__curta">${metrica.curto}</span></button>`,
  ).join('')
}

async function carregarTimeline(entrada = lerEntrada()) {
  const painel = $('#linhaDoTempo')
  if (!painel) return
  const seq = ++estado.timelineSeq
  painel.setAttribute('aria-busy', 'true')
  painel.classList.add('is-loading')

  try {
    const dados = await post('/api/reforma', entrada)
    if (seq !== estado.timelineSeq) return
    estado.timeline = dados
    renderizarTimeline(dados)
    marcarTimelineDesatualizado(false)
  } catch (erro) {
    if (seq !== estado.timelineSeq) return
    estado.timeline = null
    renderizarTimelineErro(erro)
  } finally {
    if (seq === estado.timelineSeq) {
      painel.setAttribute('aria-busy', 'false')
      painel.classList.remove('is-loading')
    }
  }
}

function renderizarTimelineErro(erro) {
  const conteudo = $('#linhaDoTempoConteudo')
  if (!conteudo) return
  $('#timelineChips').innerHTML = ''
  $('#timelineFonte').textContent = 'sem dados'
  conteudo.innerHTML = `
    <div class="comparison-error">
      <strong>Não foi possível montar a linha do tempo.</strong>
      <p>${esc(erro.message)}</p>
      <button class="btn btn--ghost" type="button" data-retry-timeline>Tentar de novo</button>
    </div>`
}

function renderizarTimeline(dados) {
  const conteudo = $('#linhaDoTempoConteudo')
  if (!conteudo) return
  const metrica = metricaAtual()
  const { entrada } = dados

  $('#timelineChips').innerHTML = `
    <span class="chip">${esc(entrada.regime.rotulo)}</span>
    <span class="chip">${esc(entrada.perfil.varianteRotulo ?? entrada.perfil.curto)}</span>
    <span class="chip">${esc(entrada.tipoOperacao)}</span>
    <span class="chip chip--year">${esc(entrada.rota)}</span>`

  const partes = [dados.fonte.projecao ? 'projeção oficial do frete' : 'motor oficial ano a ano']
  if (dados.fonte.motorSimples) partes.push('motor do Simples')
  if (dados.fonte.versaoBaseDados) partes.push(`base ${dados.fonte.versaoBaseDados}`)
  $('#timelineFonte').textContent = partes.join(' · ')

  conteudo.innerHTML = `
    ${kpisTimeline(dados)}
    <div class="timeline__chart-head">
      ${legendaTimeline(dados, metrica)}
      <span class="timeline__eixo">${metrica.id === 'custo' ? 'R$ do frete' : '% do frete'}</span>
    </div>
    <div class="timeline__chart-wrap">
      <div class="timeline__chart">${grafico(dados, metrica)}</div>
    </div>
    <p class="timeline__scroll">Deslize o gráfico para o lado para ver todos os anos.</p>
    ${tabelaTimeline(dados, metrica)}
    ${avisosTimeline(dados)}
    ${notasTimeline(dados)}
    <div class="timeline__foot">
      <p class="table-note">
        Crédito total = CBS/IBS destacado (2027 em diante) + ICMS e PIS/COFINS do documento no regime regular. A
        carga soma todos os tributos do documento e serve de contexto.
      </p>
      ${
        entrada.perfil.modelo === 'regular'
          ? ''
          : '<p class="table-note">No Simples, o CBS/IBS da coluna é a parcela destacada no DAS; o ICMS e o PIS/COFINS ficam dentro do DAS e não aparecem decompostos.</p>'
      }
      ${premissasTimeline(dados)}
    </div>`
}

function kpisTimeline(dados) {
  const { resumo, benchmark, entrada } = dados
  const referencia = resumo.referencia
  const pleno = resumo.regimePleno
  const benchPleno = benchmark?.anos?.find((linha) => linha.ano === pleno.ano)
  const referenciaDisponivel = dados.anos[0]?.disponivel !== false
  const delta = resumo.variacaoCarga
  const tom = !delta ? 'neutral' : delta.absoluta > 0 ? 'up' : delta.absoluta < 0 ? 'down' : 'neutral'
  const ehRegular = entrada?.perfil?.modelo === 'regular'
  const rotuloCarga = ehRegular ? 'Carga' : 'CBS/IBS'
  const creditoSub =
    benchPleno && benchPleno.percentualCredito !== null
      ? `${pct(pleno.percentualCredito)} do frete · regular ${pct(benchPleno.percentualCredito)}`
      : `${pct(pleno.percentualCredito)} do frete`

  return `<div class="timeline__kpis">
    <div class="kpi">
      <span class="kpi__label">${rotuloCarga} em ${referencia.ano}</span>
      <strong class="kpi__valor">${referenciaDisponivel ? brl(referencia.carga) : '—'}</strong>
      <span class="kpi__sub">${referenciaDisponivel ? `${pct(referencia.percentualCarga)} do frete` : 'sem projeção'} · antes da reforma</span>
    </div>
    <div class="kpi">
      <span class="kpi__label">${rotuloCarga} em ${pleno.ano}</span>
      <strong class="kpi__valor">${brl(pleno.carga)}</strong>
      <span class="kpi__sub">${pct(pleno.percentualCarga)} do frete · regime pleno</span>
    </div>
    <div class="kpi kpi--${tom}">
      <span class="kpi__label">Variação do ${rotuloCarga.toLowerCase()}</span>
      <strong class="kpi__valor">${delta ? sinalNumero(delta.absoluta) : '—'}</strong>
      <span class="kpi__sub">${delta ? `${sinalPontos(delta.pontos)}${delta.relativa !== null ? ` · ${sinalNumero(delta.relativa, (valor) => `${numero(valor)}%`)}` : ''}` : 'sem projeção de 2025'}</span>
    </div>
    <div class="kpi kpi--credit">
      <span class="kpi__label">Crédito total em ${pleno.ano}</span>
      <strong class="kpi__valor">${brl(pleno.credito)}</strong>
      <span class="kpi__sub">${creditoSub}</span>
    </div>
  </div>`
}

function legendaTimeline(dados, metrica) {
  const itens = []
  if (metrica.id === 'carga') {
    if (dados.entrada.perfil.modelo === 'regular') {
      itens.push({ cor: '#b9c4d4', rotulo: 'Tributos antigos' })
    }
    itens.push({ cor: '#0b5fa5', rotulo: 'CBS/IBS' })
    if ((dados.anos[0]?.percentualCarga ?? 0) > 0) {
      itens.push({ traco: 'ref', rotulo: 'carga em 2025' })
    }
  } else if (metrica.id === 'credito') {
    itens.push({ cor: '#0f7a55', rotulo: 'Seu regime' })
  } else {
    itens.push({ cor: '#0f172a', rotulo: 'Seu regime' })
    itens.push({ traco: 'ref', rotulo: 'preço de 2025' })
  }
  const temBenchmark =
    Boolean(dados.benchmark) &&
    (metrica.id !== 'carga' || dados.benchmark.anos.some((linha) => typeof linha.percentualCarga === 'number'))
  if (temBenchmark) itens.push({ traco: 'benchmark', rotulo: 'Regime regular' })

  return `<div class="timeline__legend">${itens
    .map(
      (item) =>
        `<span class="legenda"><i class="${item.traco ? `legenda__traco legenda__traco--${item.traco}` : ''}" ${item.cor ? `style="background:${item.cor}"` : ''}></i>${item.rotulo}</span>`,
    )
    .join('')}</div>`
}

function escalaPercentual(maximo) {
  if (maximo <= 2) return { max: 2, passo: 0.5 }
  if (maximo <= 3) return { max: 3, passo: 1 }
  if (maximo <= 4) return { max: 4, passo: 1 }
  if (maximo <= 5) return { max: 5, passo: 1 }
  if (maximo <= 10) return { max: 10, passo: 2 }
  if (maximo <= 15) return { max: 15, passo: 5 }
  if (maximo <= 30) return { max: 30, passo: 10 }
  return { max: Math.ceil(maximo / 10) * 10, passo: 10 }
}

function passoBonito(valor) {
  const base = 10 ** Math.floor(Math.log10(Math.max(valor, 1)))
  for (const fator of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (valor <= base * fator) return base * fator
  }
  return base * 10
}

function grafico(dados, metrica) {
  const largura = 940
  const altura = 320
  const margem = { topo: 48, direita: 20, baixo: 54, esquerda: 64 }
  const anos = dados.anos
  const n = anos.length
  const larguraPlot = largura - margem.esquerda - margem.direita
  const alturaPlot = altura - margem.topo - margem.baixo
  const passo = larguraPlot / n
  const cx = (indice) => margem.esquerda + passo * (indice + 0.5)
  const valorDe = (linha) =>
    metrica.id === 'carga'
      ? linha.percentualCarga
      : metrica.id === 'credito'
        ? linha.percentualCredito
        : linha.custoLiquido

  const valores = anos.map(valorDe)
  const benchmark = (dados.benchmark?.anos ?? [])
    .map((linha) =>
      metrica.id === 'carga'
        ? linha.percentualCarga
        : metrica.id === 'credito'
          ? linha.percentualCredito
          : linha.custoLiquido,
    )
    .filter((valor) => typeof valor === 'number' && Number.isFinite(valor))
  const teto = Math.max(0, ...valores, ...benchmark, metrica.id === 'custo' ? dados.entrada.valorFrete : 0)
  const escala =
    metrica.id === 'custo'
      ? (() => {
          const p = passoBonito(teto / 4)
          return { max: p * 4, passo: p }
        })()
      : escalaPercentual(teto)
  const y = (valor) => margem.topo + alturaPlot - (valor / escala.max) * alturaPlot

  const ticks = []
  for (let valor = 0; valor <= escala.max + 1e-9; valor += escala.passo) {
    ticks.push(Number(valor.toFixed(4)))
  }
  const rotuloTick = (valor) =>
    metrica.id === 'custo' ? `R$ ${numero(valor, 0)}` : `${numero(valor, escala.passo < 1 ? 1 : 0)}%`

  const grade = ticks
    .map(
      (valor) => `
      <line x1="${margem.esquerda}" y1="${y(valor)}" x2="${largura - margem.direita}" y2="${y(valor)}" stroke="#e9edf3" stroke-width="1"/>
      <text x="${margem.esquerda - 12}" y="${y(valor) + 4}" text-anchor="end" class="chart__tick">${esc(rotuloTick(valor))}</text>`,
    )
    .join('')

  const xAntes = margem.esquerda
  const xDepois = cx(1) - passo / 2
  const faixas = `
      <rect x="${xAntes}" y="${margem.topo}" width="${xDepois - xAntes}" height="${alturaPlot}" fill="#f1f3f7"/>
      <rect x="${xDepois}" y="${margem.topo}" width="${largura - margem.direita - xDepois}" height="${alturaPlot}" fill="rgba(11,95,165,.04)"/>
      <text x="${xAntes + 7}" y="${margem.topo - 26}" class="chart__banda">antes</text>
      <text x="${xDepois + 8}" y="${margem.topo - 26}" class="chart__banda chart__banda--depois">depois da reforma</text>`

  const eixoAnos = anos
    .map((linha, indice) => {
      const atual = linha.ano === dados.entrada.ano
      return `
      <text x="${cx(indice)}" y="${altura - 26}" text-anchor="middle" class="chart__ano ${linha.ano === 2025 ? 'is-antes' : ''} ${atual ? 'is-atual' : ''}">${linha.ano}</text>
      ${linha.ano === 2025 ? `<text x="${cx(indice)}" y="${altura - 12}" text-anchor="middle" class="chart__sub">antes</text>` : ''}
      ${linha.ano === 2033 ? `<text x="${cx(indice)}" y="${altura - 12}" text-anchor="middle" class="chart__sub">pleno</text>` : ''}
      ${atual && linha.ano !== 2025 ? `<circle cx="${cx(indice)}" cy="${altura - 8}" r="2" fill="#0b5fa5"/>` : ''}`
    })
    .join('')

  let referencia = ''
  if (metrica.id === 'carga') {
    const valor = anos[0].percentualCarga
    referencia = `<line x1="${margem.esquerda}" y1="${y(valor)}" x2="${largura - margem.direita}" y2="${y(valor)}" stroke="#9aa6b8" stroke-width="1" stroke-dasharray="4 4"/>`
  } else if (metrica.id === 'custo') {
    const valor = anos[0].custoLiquido
    referencia = `<line x1="${margem.esquerda}" y1="${y(valor)}" x2="${largura - margem.direita}" y2="${y(valor)}" stroke="#9aa6b8" stroke-width="1" stroke-dasharray="4 4"/>`
  }

  const tooltip = (linha) =>
    `${linha.ano} · carga ${brl(linha.carga)} (${pct(linha.percentualCarga)}) · CBS/IBS ${brl(linha.cbsIbs)} · crédito total ${brl(linha.credito)} (CBS/IBS ${brl(linha.creditoCbsIbs ?? 0)}${linha.creditoAntigos?.total > 0 ? ` + ICMS/PIS/COFINS ${brl(linha.creditoAntigos.total)}` : ''}) · líquido ${brl(linha.custoLiquido)}`

  let serie = ''
  if (metrica.id === 'carga') {
    const barras = anos
      .map((linha, indice) => {
        if (!linha.disponivel) return ''
        const antigos = ((linha.antigos?.total ?? 0) / linha.valorFrete) * 100
        const cbs = ((linha.cbsIbsEfetivo ?? 0) / linha.valorFrete) * 100
        const larguraBarra = Math.min(48, passo * 0.52)
        const base = y(0)
        const alturaAntigos = (antigos / escala.max) * alturaPlot
        const alturaCbs = (cbs / escala.max) * alturaPlot
        return `<g>
        <rect x="${cx(indice) - larguraBarra / 2}" y="${base - alturaAntigos}" width="${larguraBarra}" height="${alturaAntigos}" rx="3" fill="#b9c4d4"><title>${esc(tooltip(linha))}</title></rect>
        <rect x="${cx(indice) - larguraBarra / 2}" y="${base - alturaAntigos - alturaCbs}" width="${larguraBarra}" height="${alturaCbs}" rx="3" fill="#0b5fa5"><title>${esc(tooltip(linha))}</title></rect>
        <text x="${cx(indice)}" y="${base - alturaAntigos - alturaCbs - 7}" text-anchor="middle" class="chart__valor">${pct(linha.percentualCarga)}</text>
        ${linha.compensado > 0 ? `<text x="${cx(indice)}" y="${base - alturaAntigos - alturaCbs - 20}" text-anchor="middle" class="chart__nota">1% compensável</text>` : ''}
      </g>`
      })
      .join('')

    const pontosBenchmark = (dados.benchmark?.anos ?? [])
      .map((linha, indice) =>
        linha.percentualCarga === null || linha.percentualCarga === undefined
          ? null
          : `${cx(indice)},${y(linha.percentualCarga)}`,
      )
      .filter(Boolean)
    const linhaBenchmark = pontosBenchmark.length
      ? `<polyline points="${pontosBenchmark.join(' ')}" fill="none" stroke="#0b5fa5" stroke-width="2" stroke-dasharray="5 5" opacity=".55"/>`
      : ''
    serie = `${barras}${linhaBenchmark}`
  } else {
    const cor = metrica.id === 'credito' ? '#0f7a55' : '#0f172a'
    const pontos = anos
      .map((linha, indice) => (linha.disponivel ? `${cx(indice)},${y(valorDe(linha))}` : null))
      .filter(Boolean)
    const marcadores = anos
      .map((linha, indice) => {
        if (!linha.disponivel) return ''
        return `
      <circle cx="${cx(indice)}" cy="${y(valorDe(linha))}" r="4" fill="#fff" stroke="${cor}" stroke-width="2.4"><title>${esc(tooltip(linha))}</title></circle>
      <text x="${cx(indice)}" y="${y(valorDe(linha)) - 11}" text-anchor="middle" class="chart__valor">${metrica.id === 'custo' ? numero(valorDe(linha), 0) : pct(valorDe(linha), 2)}</text>`
      })
      .join('')
    const pontosBenchmark = (dados.benchmark?.anos ?? [])
      .map((linha, indice) => {
        const valor = metrica.id === 'credito' ? linha.percentualCredito : linha.custoLiquido
        return valor === null || valor === undefined ? null : `${cx(indice)},${y(valor)}`
      })
      .filter(Boolean)
    const linhaBenchmark = pontosBenchmark.length
      ? `<polyline points="${pontosBenchmark.join(' ')}" fill="none" stroke="#0b5fa5" stroke-width="2" stroke-dasharray="5 5" opacity=".55"/>`
      : ''
    serie = `<polyline points="${pontos.join(' ')}" fill="none" stroke="${cor}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${marcadores}${linhaBenchmark}`
  }

  const formatarExtremo = (linha) =>
    !linha.disponivel
      ? 'sem projeção'
      : metrica.id === 'custo'
        ? brl(valorDe(linha))
        : `${pct(valorDe(linha))} do frete`
  const aria = `Linha do tempo de ${metrica.rotulo.toLowerCase()} do frete de ${brl(dados.entrada.valorFrete)}: de ${anos[0].ano} (${formatarExtremo(anos[0])}) a ${anos[anos.length - 1].ano} (${formatarExtremo(anos[anos.length - 1])}). A tabela abaixo traz todos os anos.`

  return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${esc(aria)}" class="chart">
      <title>${esc(metrica.rotulo)} do frete de ${anos[0].ano} a ${anos[anos.length - 1].ano}</title>
      <desc>${esc(aria)}</desc>
      ${faixas}${grade}${referencia}${serie}${eixoAnos}
    </svg>`
}

function tabelaTimeline(dados, metrica) {
  const { anos, entrada } = dados
  const referencia = anos[0]
  const modelo = entrada.perfil.modelo
  const referenciaDisponivel = referencia.disponivel !== false

  const linhas = anos
    .map((linha) => {
      const indisponivel = !linha.disponivel
      const dash = '<span class="cell-dash">—</span>'
      const delta = metrica.valor(linha) - metrica.valor(referencia)
      const deltaPercentual =
        metrica.id === 'carga'
          ? linha.percentualCarga - referencia.percentualCarga
          : linha.percentualCredito - referencia.percentualCredito
      const deltaTexto =
        indisponivel || !referenciaDisponivel || linha.ano === referencia.ano
          ? dash
          : `${sinalNumero(delta)}${metrica.percentual ? `<small>${sinalPontos(deltaPercentual)}</small>` : ''}`

      let antigos
      if (indisponivel) {
        antigos = dash
      } else if (modelo === 'regular') {
        if (!linha.antigos) antigos = dash
        else if (linha.antigos.total <= 0) antigos = `${dash}<small>extintos</small>`
        else
          antigos = `${brl(linha.antigos.total)}<small>ICMS ${brl(linha.antigos.icms)} + PIS/COFINS ${brl(linha.antigos.pis + linha.antigos.cofins)}</small>`
      } else if (modelo === 'hibrido') {
        antigos = `${dash}<small>ICMS no DAS</small>`
      } else {
        antigos = `${dash}<small>no DAS</small>`
      }

      const cbs = indisponivel
        ? dash
        : linha.compensado > 0
          ? `${brl(linha.cbsIbs)}<small class="cell-tag">${pct(linha.percentualCompensado)} compensável</small>`
          : `${brl(linha.cbsIbs)}<small>${pct((linha.cbsIbs / linha.valorFrete) * 100)}</small>`

      const credito = indisponivel
        ? dash
        : `${brl(linha.credito)}<small>${pct(linha.percentualCredito)}${linha.creditoAntigos?.total > 0 ? ` · ICMS/PIS/COFINS ${brl(linha.creditoAntigos.total)}` : ''}</small>`

      return `<tr class="${linha.ano === 2025 ? 'is-reference' : ''} ${linha.ano === entrada.ano ? 'is-current' : ''} ${indisponivel ? 'is-unavailable' : ''}"${linha.observacao ? ` title="${esc(linha.observacao)}"` : ''}>
      <th scope="row" class="cell-ano">${linha.ano}${linha.ano === 2025 ? '<small>antes</small>' : ''}</th>
      <td class="col-fase">${esc(linha.rotulo)}</td>
      <td class="num col-antigos">${antigos}</td>
      <td class="num col-cbs">${cbs}</td>
      <td class="num col-carga">${indisponivel ? dash : `${brl(linha.carga)}<small>${pct(linha.percentualCarga)}</small>`}</td>
      <td class="num col-credito">${credito}</td>
      <td class="num cell-net">${indisponivel ? dash : brl(linha.custoLiquido)}</td>
      <td class="num col-delta">${deltaTexto}</td>
    </tr>`
    })
    .join('')

  return `<div class="table-wrap">
    <table class="table table--timeline">
      <caption class="sr-only">
        Carga tributária, crédito total e custo líquido do frete por ano, de ${anos[0].ano} a
        ${anos[anos.length - 1].ano}.
      </caption>
      <thead>
        <tr>
          <th scope="col">Ano</th>
          <th scope="col" class="col-fase">Fase</th>
          <th scope="col" class="num col-antigos">Tributos antigos</th>
          <th scope="col" class="num col-cbs">CBS/IBS</th>
          <th scope="col" class="num col-carga">Carga</th>
          <th scope="col" class="num col-credito">Crédito total</th>
          <th scope="col" class="num">Custo líquido</th>
          <th scope="col" class="num col-delta">Δ ${metrica.curto} vs ${referencia.ano}</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`
}

function avisosTimeline(dados) {
  if (!Array.isArray(dados.avisos) || !dados.avisos.length) return ''
  return `<div class="callout callout--aviso">
    ${ICONE.info}
    <div>
      <strong>Como ler esta série</strong>
      ${dados.avisos.map((aviso) => `<p>${esc(aviso)}</p>`).join('')}
    </div>
  </div>`
}

function notasTimeline(dados) {
  if (!Array.isArray(dados.notas) || !dados.notas.length) return ''
  return `<div class="timeline__marcos">
    <h3 class="timeline__subtitulo">Marcos da transição</h3>
    <div class="marcos">
      ${dados.notas
        .map(
          (nota) => `
        <article class="marco">
          <span class="marco__ano">${nota.ano}</span>
          <h4>${esc(nota.titulo)}</h4>
          <p>${esc(nota.texto)}</p>
          ${nota.comparacao ? `<details><summary>Comparação com 2025</summary><p>${esc(nota.comparacao)}</p></details>` : ''}
          ${nota.detalhe ? `<details><summary>O que muda no ano</summary><ul>${nota.detalhe.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}
          ${nota.fundamento ? `<p class="marco__base">${esc(nota.fundamento)}</p>` : ''}
        </article>`,
        )
        .join('')}
    </div>
  </div>`
}

function premissasTimeline(dados) {
  return `<details class="premissas">
    <summary>Premissas e limites da linha do tempo</summary>
    <ul>${dados.premissas.map((premissa) => `<li>${esc(premissa)}</li>`).join('')}</ul>
  </details>`
}

function marcarTimelineDesatualizado(desatualizado) {
  const nota = $('#timelineStale')
  const conteudo = $('#linhaDoTempoConteudo')
  if (!nota) return
  nota.hidden = !desatualizado
  conteudo?.classList.toggle('is-stale', Boolean(desatualizado))
}

/* ------------------------------------------------------------------ */
/* Hoje → amanhã: o horizonte do pagador                               */
/* ------------------------------------------------------------------ */

const CENARIOS = {
  congelado: {
    rotulo: 'Preço travado',
    nota: 'O preço do contrato não muda: o que varia é a alíquota e o crédito que você aproveita.',
  },
  equilibrio: {
    rotulo: 'Preço de equilíbrio',
    nota: 'O preço sobe (ou cai) o suficiente para o seu custo líquido ficar igual ao de hoje: preço = líquido_de_hoje ÷ (1 − crédito_do_ano).',
  },
  repasse: {
    rotulo: 'Piso do transportador',
    nota: 'O preço preserva a margem do transportador: preço_novo = preço_hoje × (1 − carga_hoje) ÷ (1 − carga_ano) no regime regular; no Simples, a conta usa o DAS e os insumos informados.',
  },
}

function cenarioDaLinha(linha, cenario) {
  if (!linha?.disponivel) return null
  if (cenario === 'equilibrio') {
    return {
      bruto: linha.equilibrio?.preco ?? linha.bruto,
      credito: linha.equilibrio?.credito ?? linha.credito.total,
      liquido: linha.equilibrio?.liquido ?? linha.liquido,
      variacao: 0,
    }
  }
  if (cenario === 'repasse') {
    const piso = linha.piso
    if (piso) {
      return {
        bruto: piso.preco,
        credito: piso.credito,
        liquido: piso.liquido,
        variacao: piso.variacaoLiquido ?? 0,
      }
    }
    return {
      bruto: linha.repasse.bruto,
      credito: linha.repasse.credito,
      liquido: linha.repasse.liquido,
      variacao: linha.variacao?.liquidoRepasse ?? 0,
    }
  }
  return {
    bruto: linha.bruto,
    credito: linha.credito.total,
    liquido: linha.liquido,
    variacao: linha.variacao?.liquido ?? 0,
  }
}

function composicaoCredito(linha, cenario) {
  const base =
    cenario === 'equilibrio'
      ? (linha.equilibrio?.preco ?? linha.bruto)
      : cenario === 'repasse'
        ? (linha.piso?.preco ?? linha.repasse.bruto)
        : linha.bruto
  const partes = []
  if (linha.credito.percentualIcms > 0) partes.push(`ICMS ${brl((base * linha.credito.percentualIcms) / 100)}`)
  if (linha.credito.percentualPisCofins > 0) {
    partes.push(`PIS/COFINS ${brl((base * linha.credito.percentualPisCofins) / 100)}`)
  }
  if (linha.credito.percentualCbsIbs > 0) {
    partes.push(`CBS/IBS ${brl((base * linha.credito.percentualCbsIbs) / 100)}`)
  }
  return partes
}

function textoVariacao(valor) {
  const n = Number(valor) || 0
  if (Math.abs(n) < 0.005) return 'igual a hoje'
  return `${sinalNumero(n)} vs hoje`
}

function sinalPercentual(valor, casas = 2) {
  const n = Number(valor) || 0
  if (Math.abs(n) < 0.005) return '0,00%'
  return `${n > 0 ? '+' : '−'}${numero(Math.abs(n), casas)}%`
}

function brlCurto(valor) {
  return `R$ ${numero(Number(valor) || 0, 0)}`
}

/**
 * Cartões "Preço travado × Preço de equilíbrio × Piso do transportador".
 * A pergunta do pagador é simples: quanto sobra hoje, quanto sobra se eu não
 * mexer no preço e quanto preciso pagar para preservar o que sobra hoje.
 */
function caminhosHorizonte(dados) {
  const { hoje, resumo, anos, entrada } = dados
  const pleno = anos.find((linha) => linha.ano === 2033 && linha.disponivel) ?? resumo?.pleno ?? null
  if (!hoje || !pleno?.equilibrio) return ''

  const variacaoTravado =
    hoje.liquido > 0 ? ((pleno.liquido - hoje.liquido) / hoje.liquido) * 100 : null
  const eq = pleno.equilibrio
  const piso = pleno.piso
  const conflito = pleno.conflito
  const perfilSimples = entrada.perfil.id === 'SIMPLES_DAS' || entrada.perfil.id === 'AUTONOMO_MEI'
  const pisoCoincide = piso && conflito !== null && Math.abs(conflito) < 0.005

  const cardTravado = `
    <article class="caminho caminho--travado">
      <span class="caminho__tag">Preço travado</span>
      <strong class="caminho__valor">${brl(hoje.bruto)}</strong>
      <p>Em 2033, o líquido cai para <b>${brl(pleno.liquido)}</b>${variacaoTravado === null ? '' : ` <span class="${variacaoTravado < -0.005 ? 'is-baixa' : 'is-alta'}">${sinalPercentual(variacaoTravado)}</span>`}.</p>
    </article>`

  const cardEquilibrio = `
    <article class="caminho caminho--ok">
      <span class="caminho__tag">Preço de equilíbrio</span>
      <strong class="caminho__valor">${brl(eq.preco)}</strong>
      <p>${sinalPercentual(eq.variacaoPreco)} no bruto para o seu líquido ficar em <b>${brl(eq.liquido)}</b> — o de hoje.</p>
      ${pisoCoincide ? '<small class="caminho__nota">Com crédito integral, o piso do transportador coincide com este preço.</small>' : ''}
    </article>`

  const cardPiso =
    piso && !pisoCoincide
      ? `
    <article class="caminho ${conflito > 0 ? 'caminho--alerta' : 'caminho--piso'}">
      <span class="caminho__tag">Piso do transportador${piso.estimado ? ' · estimado' : ''}</span>
      <strong class="caminho__valor">${brl(piso.preco)}</strong>
      <p>${sinalPercentual(piso.variacaoPreco)} no bruto. Fica <b>${conflito > 0 ? 'acima' : 'abaixo'}</b> do seu equilíbrio em ${brl(Math.abs(conflito))}.</p>
    </article>`
      : ''

  const avisoPiso = (() => {
    if (perfilSimples && !piso) {
      return `
        <div class="callout callout--aviso">
          ${ICONE.alerta}
          <div><p><strong>No Simples/MEI o app ainda não calcula o piso do transportador.</strong> Informe o DAS total e a parcela de insumos na modalidade para estimar; sem isso, o preço de equilíbrio acima é o do <em>seu</em> líquido e pode não ser suficiente para o transportador.</p></div>
        </div>`
    }
    if (piso && conflito > 0.005) {
      return `
        <div class="callout callout--aviso">
          ${ICONE.alerta}
          <div><p><strong>Há um conflito de ${brl(conflito)} por período.</strong> O piso do transportador (${brl(piso.preco)}) fica acima do preço que preserva o seu líquido (${brl(eq.preco)}). O contrato precisa decidir quem absorve essa diferença.</p></div>
        </div>`
    }
    if (piso && conflito < -0.005) {
      return `
        <div class="callout">
          ${ICONE.info}
          <div><p><strong>Há espaço de negociação de ${brl(Math.abs(conflito))} por período.</strong> O piso do transportador (${brl(piso.preco)}) fica abaixo do preço que preserva o seu líquido (${brl(eq.preco)}).</p></div>
        </div>`
    }
    return ''
  })()

  return `
    <div class="horizonte__caminhos">
      ${cardTravado}
      ${cardEquilibrio}
      ${cardPiso}
    </div>
    ${avisoPiso}`
}

function graficoHorizonte(dados) {
  const linhas = (dados.anos ?? []).filter((linha) => linha.disponivel && linha.equilibrio)
  if (linhas.length < 2) return ''

  const series = [
    {
      id: 'travado',
      rotulo: 'Preço travado',
      cor: '#9a5b06',
      valores: linhas.map((linha) => linha.liquido),
    },
    {
      id: 'equilibrio',
      rotulo: 'Preço de equilíbrio',
      cor: '#0f7a55',
      valores: linhas.map((linha) => linha.equilibrio.liquido),
    },
  ]

  const piso = linhas.map((linha) => linha.piso?.liquido ?? null)
  const pisoCompleto = piso.every((valor) => Number.isFinite(valor))
  const pisoDiferente =
    pisoCompleto && piso.some((valor, indice) => Math.abs(valor - linhas[indice].equilibrio.liquido) > 0.005)
  if (pisoDiferente) {
    series.push({
      id: 'piso',
      rotulo: 'Seu líquido no piso',
      cor: '#0b5fa5',
      tracejado: true,
      valores: piso,
    })
  }

  const largura = 760
  const altura = 250
  const margem = { topo: 26, direita: 18, baixo: 34, esquerda: 64 }
  const todos = series.flatMap((serie) => serie.valores.filter((valor) => Number.isFinite(valor)))
  const minimo = Math.min(...todos)
  const maximo = Math.max(...todos)
  const folga = Math.max(20, (maximo - minimo) * 0.14)
  const yMin = Math.max(0, Math.floor((minimo - folga) / 50) * 50)
  const yMax = Math.ceil((maximo + folga) / 50) * 50
  const x = (indice) =>
    margem.esquerda + (indice * (largura - margem.esquerda - margem.direita)) / Math.max(1, linhas.length - 1)
  const y = (valor) =>
    margem.topo + ((yMax - valor) / Math.max(1, yMax - yMin)) * (altura - margem.topo - margem.baixo)

  const grade = Array.from({ length: 5 }, (_, indice) => {
    const valor = yMin + ((yMax - yMin) * indice) / 4
    const yy = y(valor)
    return `<line x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${yy}" y2="${yy}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 5" />
      <text x="${margem.esquerda - 10}" y="${yy + 3.5}" text-anchor="end" class="chart__tick">${brlCurto(valor)}</text>`
  }).join('')

  const anos = linhas
    .map(
      (linha, indice) => `
      <text x="${x(indice)}" y="${altura - 10}" text-anchor="middle" class="chart__ano ${linha.ano === 2026 ? 'is-atual' : ''}">${linha.ano}</text>`,
    )
    .join('')

  const caminhos = series
    .map((serie, indiceSerie) => {
      const pontos = serie.valores
        .map((valor, indice) => `${x(indice)},${y(valor)}`)
        .join(' ')
      const ultimo = serie.valores.at(-1)
      const ultimoY = y(ultimo)
      const marcadores = serie.valores
        .map(
          (valor, indice) =>
            `<circle cx="${x(indice)}" cy="${y(valor)}" r="2.8" fill="#fff" stroke="${serie.cor}" stroke-width="2" />`,
        )
        .join('')
      return `
        <polyline points="${pontos}" fill="none" stroke="${serie.cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" ${serie.tracejado ? 'stroke-dasharray="6 5"' : ''} />
        ${marcadores}
        <text x="${largura - margem.direita}" y="${ultimoY - 8 - indiceSerie * 13}" text-anchor="end" class="chart__valor">${brlCurto(ultimo)}</text>`
    })
    .join('')

  const legenda = series
    .map(
      (serie) =>
        `<span><i style="background:${serie.cor}"></i>${serie.rotulo}</span>`,
    )
    .join('')

  return `
    <div class="horizonte__chart-wrap">
      <div class="horizonte__chart">
        <svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Custo líquido do frete por ano com preço travado, preço de equilíbrio e piso do transportador" class="chart">
          ${grade}
          ${anos}
          ${caminhos}
        </svg>
      </div>
      <div class="horizonte__legenda">${legenda}</div>
    </div>`
}

function tabelaCaminhos(dados) {
  const linhas = (dados.anos ?? [])
    .filter((linha) => linha.disponivel && linha.equilibrio)
    .map(
      (linha) => `
      <tr class="${linha.ano === 2026 ? 'is-current' : ''}">
        <td class="cell-ano" data-rotulo="Ano">${linha.ano}</td>
        <td class="num" data-rotulo="Preço travado">${brl(linha.bruto)}</td>
        <td class="num" data-rotulo="Líquido com preço travado">${brl(linha.liquido)}</td>
        <td class="num" data-rotulo="Preço de equilíbrio">${brl(linha.equilibrio.preco)}</td>
        <td class="num cell-equilibrio" data-rotulo="Líquido mantido">${brl(linha.equilibrio.liquido)}</td>
        <td class="num" data-rotulo="Variação do preço">${sinalPercentual(linha.equilibrio.variacaoPreco)}</td>
      </tr>`,
    )
    .join('')

  return `
    <div class="horizonte__tabela-head">
      <h3>Os dois caminhos, ano a ano</h3>
      <span class="horizonte__fonte">Preço travado = nominal do contrato. Preço de equilíbrio = preço que mantém o seu líquido de hoje.</span>
    </div>
    <div class="table-wrap">
      <table class="table table--caminhos" aria-label="Preço travado e preço de equilíbrio, com o líquido do pagador em cada ano">
        <thead>
          <tr>
            <th>Ano</th>
            <th class="num">Preço travado</th>
            <th class="num">Seu líquido com preço travado</th>
            <th class="num">Preço de equilíbrio</th>
            <th class="num">Seu líquido mantido</th>
            <th class="num">Δ do preço</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <p class="table-note">O líquido mantido é constante por definição: o preço de equilíbrio é recalculado a cada ano para compensar a variação do crédito. No Simples/MEI, ele não incorpora o DAS total nem o custo não creditável do transportador — é o seu equilíbrio, não uma proposta de contrato.</p>`
}

async function carregarHorizonte(entrada = lerEntrada()) {
  const painel = $('#hojeAmanha')
  if (!painel) return
  const seq = ++estado.horizonteSeq
  painel.setAttribute('aria-busy', 'true')
  painel.classList.add('is-loading')

  try {
    const dados = await post('/api/pagador', entrada)
    if (seq !== estado.horizonteSeq) return
    estado.horizonte = dados
    renderizarHorizonte(dados)
  } catch (erro) {
    if (seq !== estado.horizonteSeq) return
    estado.horizonte = null
    renderizarHorizonteErro(erro)
  } finally {
    if (seq === estado.horizonteSeq) {
      painel.setAttribute('aria-busy', 'false')
      painel.classList.remove('is-loading')
    }
  }
}

function renderizarHorizonteErro(erro) {
  const conteudo = $('#horizonteConteudo')
  if (!conteudo) return
  conteudo.innerHTML = `
    <div class="comparison-error">
      <strong>Não foi possível montar a visão de hoje até 2033.</strong>
      <p>${esc(erro.message)}</p>
      <button class="btn btn--ghost" type="button" data-retry-horizonte>Tentar de novo</button>
    </div>`
}

function renderizarHorizonte(dados) {
  const conteudo = $('#horizonteConteudo')
  if (!conteudo) return
  const { entrada, hoje, resumo, deveria } = dados
  if (!hoje) {
    renderizarHorizonteErro({ message: 'O ano de hoje não está na projeção do motor.' })
    return
  }

  let cenario = estado.horizonteCenario
  const pleno = resumo?.pleno ?? null
  if (cenario === 'repasse' && !pleno?.piso) {
    cenario = 'equilibrio'
    estado.horizonteCenario = 'equilibrio'
  }
  const proximo = resumo?.proximo ?? null
  const anual = entrada.anual ?? 12
  const cenarioHoje = cenarioDaLinha(hoje, cenario)
  const cenarioPleno = pleno ? cenarioDaLinha(pleno, cenario) : null
  const cenarioProximo = proximo ? cenarioDaLinha(proximo, cenario) : null
  const caminhosHTML = caminhosHorizonte(dados)
  const graficoHTML = graficoHorizonte(dados)
  const tabelaCaminhosHTML = tabelaCaminhos(dados)

  const fonte = [
    'projeção oficial do frete',
    dados.fonte?.versaoBaseDados ? `base ${dados.fonte.versaoBaseDados}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const kpi = (rotulo, linha, cenarioLinha, sub) => `
    <div class="kpi">
      <span class="kpi__label">${esc(rotulo)}</span>
      <span class="kpi__valor">${brl(cenarioLinha.liquido)}</span>
      <span class="kpi__sub">${sub}</span>
    </div>`

  const deltaClasse = (valor) => (valor > 0.005 ? 'is-alta' : valor < -0.005 ? 'is-baixa' : '')

  const fraseHoje = composicaoCredito(hoje, cenario)
  const fraseCredito = fraseHoje.length ? `de crédito (${fraseHoje.join(' + ')})` : 'sem crédito'
  const fraseRecupera =
    hoje.credito.total > 0
      ? `e recupera <b>${brl(hoje.credito.total)}</b> ${fraseCredito}`
      : 'e não recupera crédito'

  const fraseCenario = (() => {
    if (!pleno) return 'a série não chega ao regime pleno.'
    if (cenario === 'equilibrio') {
      return `Em 2033, para manter o seu líquido de hoje, o preço de equilíbrio é <b>${brl(pleno.equilibrio.preco)}</b> (${sinalPercentual(pleno.equilibrio.variacaoPreco)}) e o líquido fica em <b>${brl(pleno.equilibrio.liquido)}</b>.`
    }
    if (cenario === 'repasse') {
      return pleno.piso
        ? `Em 2033, o piso do transportador é <b>${brl(pleno.piso.preco)}</b> (${sinalPercentual(pleno.piso.variacaoPreco)}) e o seu líquido fica em <b>${brl(pleno.piso.liquido)}</b>.`
        : 'Em 2033, o app não calcula o piso do transportador para este regime.'
    }
    return `Em 2033, com o preço travado, o crédito chega a ${pct(pleno.credito.percentual)} e o líquido a <b>${brl(pleno.liquido)}</b>.`
  })()

  const linhasTabela = dados.anos
    .filter((linha) => linha.disponivel)
    .map((linha) => {
      const c = cenarioDaLinha(linha, cenario)
      const composicao = composicaoCredito(linha, cenario)
      const marcos = []
      if (linha.ano === hoje.ano) marcos.push('hoje')
      if (linha.ano === 2027) marcos.push('CBS cheia')
      if (linha.ano === resumo?.primeiroAumentoCarga) marcos.push('1º aumento')
      if (linha.ano === 2033) marcos.push('regime pleno')
      const classes = [
        linha.ano === hoje.ano ? 'is-current' : '',
        linha.ano === 2027 || linha.ano === 2029 || linha.ano === 2033 ? 'is-marco' : '',
      ]
        .filter(Boolean)
        .join(' ')
      const variacao =
        linha.ano === hoje.ano
          ? '<span class="cell-dash">—</span>'
          : Math.abs(c.variacao) < 0.005
            ? '<span class="cell-dash">= hoje</span>'
            : `<span class="${deltaClasse(c.variacao)}">${sinalNumero(c.variacao)}</span>`
      return `
        <tr class="${classes}">
          <td class="cell-ano" data-rotulo="Ano">${linha.ano}<small>${esc(marcos.join(' · '))}</small></td>
          <td class="num" data-rotulo="Carga do serviço">${pct(linha.percentualCargaTransportador ?? linha.percentualCarga)}${entrada.perfil.id === 'SIMPLES_DAS' && Number(entrada.dasTotal) > 0 ? '<small>DAS</small>' : ''}</td>
          <td class="num" data-rotulo="Bruto">${brl(c.bruto)}</td>
          <td class="num cell-credito" data-rotulo="Crédito">${brl(c.credito)}${composicao.length ? `<small>${esc(composicao.join(' · '))}</small>` : ''}</td>
          <td class="num cell-net" data-rotulo="Custo líquido">${brl(c.liquido)}</td>
          <td class="num" data-rotulo="vs hoje (líquido)">${variacao}</td>
        </tr>`
    })
    .join('')

  const kpiProximo = proximo && cenarioProximo
    ? kpi(
        `${proximo.ano} · ${proximo.rotulo}`,
        proximo,
        cenarioProximo,
        `crédito de ${pct(proximo.credito.percentual)} · ${textoVariacao(cenarioProximo.variacao)}`,
      )
    : ''

  const kpiPleno = pleno && cenarioPleno
    ? kpi(
        `2033 · regime pleno`,
        pleno,
        cenarioPleno,
        `crédito de ${pct(pleno.credito.percentual)} · ${textoVariacao(cenarioPleno.variacao)}`,
      )
    : ''

  const deveriaHTML = (() => {
    const d = deveria?.hoje
    if (!d) return ''
    const teto = d.precoEquivalente
    const gap = d.economia
    const pior = gap > 0.005
    const ehRegular = entrada.perfil.id === 'REGIME_REGULAR'
    const grade = ehRegular
      ? `
        <div>
          <span>Custo líquido hoje</span>
          <strong>${brl(hoje.liquido)}</strong>
          <small>crédito de ${pct(hoje.credito.percentual)}</small>
        </div>
        <div>
          <span>Em 2033 · preço de hoje</span>
          <strong>${brl(pleno.liquido)}</strong>
          <small>crédito de ${pct(pleno.credito.percentual)}</small>
        </div>
        <div class="is-ok">
          <span>Em 2033 · piso do transportador</span>
          <strong>${brl(pleno.repasse.liquido)}</strong>
          <small>desembolso de ${brl(pleno.repasse.bruto)}</small>
        </div>`
      : `
        <div>
          <span>Seu custo líquido</span>
          <strong>${brl(d.liquido)}</strong>
          <small>crédito de ${pct(d.percentualCredito)}</small>
        </div>
        <div>
          <span>Regime regular, mesmo valor</span>
          <strong>${brl(d.benchmark.liquido)}</strong>
          <small>crédito de ${pct(d.benchmark.percentualCredito)}</small>
        </div>
        <div class="${pior ? 'is-alerta' : 'is-ok'}">
          <span>Preço-teto vs. regime regular</span>
          <strong>${teto === null ? '—' : brl(teto)}</strong>
          <small>${d.percentualPreco === null ? 'sem crédito' : `${pct(d.percentualPreco)} do valor atual`}</small>
        </div>`
    return `
      <div class="deveria ${pior ? 'deveria--alerta' : 'deveria--ok'}">
        <div class="deveria__head">
          <div>
            <p class="eyebrow-sm">Quanto vale a pena pagar · benchmark do regime regular</p>
            <p class="deveria__veredito">${esc(d.veredito)}</p>
          </div>
          <span class="chip chip--soft">${d.ano}</span>
        </div>
        <div class="deveria__grid">${grade}</div>
        <p class="deveria__nota">Este bloco compara com o <b>regime regular</b>. O <b>preço de equilíbrio</b> da seção acima é outro: ele mantém o seu líquido atual, não empata com o benchmark.</p>
        ${
          !ehRegular && deveria.pleno && deveria.pleno.precoEquivalente !== null
            ? `<p class="deveria__nota">Em 2033 o preço-teto cai para <b>${brl(deveria.pleno.precoEquivalente)}</b> (${pct(deveria.pleno.percentualPreco)} do valor atual): o crédito do seu regime não acompanha a alta da carga.</p>`
            : ''
        }
        <details class="deveria__regra">
          <summary>Como o teto é calculado</summary>
          <p>${esc(deveria.formula)}</p>
          <p>${esc(deveria.regra)}</p>
        </details>
      </div>`
  })()

  const ajustesHTML = (dados.ajustes ?? [])
    .map(
      (ajuste) => `
      <li class="ajuste">
        <span class="ajuste__tag ajuste__tag--${esc(ajuste.tipo)}">${esc(rotuloAjuste(ajuste.tipo))}</span>
        <div class="ajuste__corpo">
          <strong>${esc(ajuste.titulo)}</strong>
          <p>${esc(ajuste.texto)}</p>
          ${
            ajuste.impacto
              ? `<span class="ajuste__impacto">${brl(ajuste.impacto.valor)} · ${esc(ajuste.impacto.rotulo)} · ${brl(ajuste.impacto.anual)} por ano</span>`
              : ''
          }
        </div>
      </li>`,
    )
    .join('')

  const notasHTML = (dados.notas ?? [])
    .map(
      (nota) => `
      <li>
        <strong>${nota.ano} · ${esc(nota.titulo)}</strong>
        <p>${esc(nota.resumo ?? '')}</p>
        ${nota.fundamento ? `<span class="fonte-nota">${esc(nota.fundamento)}</span>` : ''}
      </li>`,
    )
    .join('')

  conteudo.innerHTML = `
    <div class="horizonte__chips">
      <span class="chip">${esc(entrada.perfil.curto)}</span>
      <span class="chip">${esc(entrada.regimePagadora.curto)}</span>
      <span class="chip">${esc(entrada.tipoOperacao)}</span>
      <span class="chip chip--year">${esc(entrada.rota)}</span>
      ${entrada.perfil.estimativa ? '<span class="chip">crédito estimado</span>' : ''}
      ${entrada.perfil.id === 'SIMPLES_DAS' && Number(entrada.dasTotal) > 0 && entrada.insumos !== null ? `<span class="chip">DAS ${pct(entrada.dasTotal)} · insumos ${pct(entrada.insumos)}</span>` : ''}
      <span class="chip chip--soft">${esc(fonte)}</span>
    </div>

    <p class="horizonte__frase">
      Hoje você paga <b>${brl(hoje.bruto)}</b> ${fraseRecupera}:
      o custo líquido é <b>${brl(hoje.liquido)}</b> (${pct(hoje.percentualLiquido)} do preço).
      ${fraseCenario}
    </p>

    ${caminhosHTML}
    ${graficoHTML}
    ${tabelaCaminhosHTML}

    <div class="horizonte__kpis">
      ${kpi(`Hoje · ${hoje.ano}`, hoje, cenarioHoje, `bruto ${brl(cenarioHoje.bruto)} · crédito ${brl(cenarioHoje.credito)}`)}
      ${kpiProximo}
      ${kpiPleno}
    </div>

    ${deveriaHTML}

    <details class="horizonte__detalhe">
      <summary>Crédito e carga ano a ano — detalhe do cenário</summary>
      <div class="horizonte__tabela-head">
        <h3>Ano a ano · ${esc(CENARIOS[cenario].rotulo)}</h3>
        <span class="horizonte__fonte">${esc(CENARIOS[cenario].nota)}</span>
      </div>
      <div class="table-wrap">
        <table class="table table--horizonte" aria-label="Desembolso, crédito e custo líquido do frete por ano">
          <thead>
            <tr>
              <th>Ano</th>
              <th class="num">Carga do serviço</th>
              <th class="num">Bruto</th>
              <th class="num">Crédito</th>
              <th class="num">Custo líquido</th>
              <th class="num">vs hoje (líquido)</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>
      </div>
      <p class="table-note">
        Carga do serviço = DAS total informado no Simples (quando informado); nos demais regimes e sem DAS,
        ICMS/PIS/COFINS + CBS/IBS.
        No Simples/DAS, o crédito é só a parcela de CBS/IBS do DAS; a diferença entre DAS e crédito é custo do
        transportador. Crédito = ICMS + PIS/COFINS (até 2026) + CBS/IBS (2027 em diante), conforme o regime do
        transportador e o da pagadora. Anual = ${anual} × o valor do período.
      </p>
    </details>

    ${
      ajustesHTML
        ? `<div class="ajustes">
            <div class="ajustes__head">
              <h3>Como se ajustar</h3>
              <span class="chip chip--soft">${dados.ajustes.length} ${dados.ajustes.length === 1 ? 'ação' : 'ações'}</span>
            </div>
            <ul class="ajustes__lista">${ajustesHTML}</ul>
          </div>`
        : ''
    }

    ${
      notasHTML
        ? `<details class="horizonte__detalhe">
            <summary>O que muda em cada ano — leitura do motor</summary>
            <ul class="notas-ano">${notasHTML}</ul>
          </details>`
        : ''
    }

    <details class="horizonte__detalhe">
      <summary>Premissas e limites desta leitura</summary>
      <ul>${(dados.premissas ?? []).map((premissa) => `<li>${esc(premissa)}</li>`).join('')}</ul>
    </details>

    ${
      (dados.avisos ?? []).length
        ? `<div class="callout callout--aviso">${ICONE.alerta}<div>${dados.avisos
            .map((aviso) => `<p>${esc(aviso)}</p>`)
            .join('')}</div></div>`
        : ''
    }

    <div class="horizonte__rodape">
      <span>Fonte: ${esc(fonte)}</span>
      <span>${cenario === 'repasse' ? 'Desembolso com o piso do transportador' : cenario === 'equilibrio' ? 'Desembolso com o preço de equilíbrio' : 'Desembolso com o preço travado'} · anual = ${anual} períodos</span>
    </div>`

  marcarHorizonteDesatualizado(false)
  atualizarCenarioHorizonte()
}

function rotuloAjuste(tipo) {
  return (
    {
      renegociar: 'Renegociar',
      caixa: 'Caixa',
      contrato: 'Contrato',
      regime: 'Regime',
      calendario: 'Calendário',
      b2c: 'Sem crédito',
    }[tipo] ?? 'Ajuste'
  )
}

function atualizarCenarioHorizonte() {
  const alvo = $('#horizonteCenario')
  if (!alvo) return
  const pleno = estado.horizonte?.resumo?.pleno ?? null
  const temPiso = Boolean(pleno?.piso)
  alvo.querySelectorAll('[data-cenario]').forEach((botao) => {
    botao.setAttribute('aria-checked', String(botao.dataset.cenario === estado.horizonteCenario))
    if (botao.dataset.cenario === 'repasse') {
      botao.disabled = Boolean(estado.horizonte) && !temPiso
      botao.title = temPiso
        ? 'O preço que preserva a margem do transportador'
        : 'O app não calcula o piso do transportador para este regime'
    }
  })
}

function marcarHorizonteDesatualizado(desatualizado) {
  const nota = $('#horizonteStale')
  if (!nota) return
  nota.hidden = !desatualizado
}

/* ------------------------------------------------------------------ */
/* Perfis de transportadores                                           */
/* ------------------------------------------------------------------ */

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const PERFIL_VAZIO = () => ({
  nome: '',
  diaria: '',
  tipoVeiculo: '',
  ufOrigem: $('#ufOrigem')?.value || 'SP',
  ufDestino: $('#ufDestino')?.value || 'BA',
  perfil: 'REGIME_REGULAR',
  modoDias: 'UTEIS',
  diasFixo: 22,
  aliquotaCbs: '',
  aliquotaIbs: '',
  dasTotal: '',
})

function perfilAtual() {
  return estado.perfis.lista.find((item) => item.id === estado.perfis.atualId) ?? null
}

function renderizarSelectsPerfil() {
  $('#perfilModoDias').innerHTML = (estado.opcoes.modosDias ?? [])
    .map((modo) => `<option value="${modo.id}">${esc(modo.rotulo)}</option>`)
    .join('')

  $('#perfilRegime').innerHTML = estado.opcoes.perfis
    .map((perfil) => `<option value="${perfil.id}">${esc(perfil.varianteRotulo)}</option>`)
    .join('')

  $('#perfilTipoVeiculo').innerHTML = [
    '<option value="">Não informado</option>',
    ...(estado.opcoes.tiposVeiculo ?? []).map(
      (tipo) => `<option value="${tipo.id}">${esc(tipo.rotulo)} · base ${brl(tipo.base)}</option>`,
    ),
  ].join('')

  const regioes = [...new Set(estado.opcoes.ufs.map((uf) => uf.regiao))]
  const opcoes = regioes
    .map(
      (regiao) => `
      <optgroup label="${esc(regiao)}">
        ${estado.opcoes.ufs
          .filter((uf) => uf.regiao === regiao)
          .map((uf) => `<option value="${uf.sigla}">${uf.sigla} — ${esc(uf.nome)}</option>`)
          .join('')}
      </optgroup>`,
    )
    .join('')

  $('#perfilUfOrigem').innerHTML = opcoes
  $('#perfilUfDestino').innerHTML = opcoes
}

function preencherFormulario(perfil) {
  $('#perfilNome').value = perfil.nome ?? ''
  $('#perfilDiaria').value = perfil.diaria ? numero(perfil.diaria) : ''
  $('#perfilModoDias').value = perfil.modoDias ?? 'UTEIS'
  $('#perfilDiasFixo').value = perfil.diasFixo ?? 22
  $('#perfilUfOrigem').value = perfil.ufOrigem ?? 'SP'
  $('#perfilUfDestino').value = perfil.ufDestino ?? 'BA'
  $('#perfilRegime').value = perfil.perfil ?? 'REGIME_REGULAR'
  $('#perfilTipoVeiculo').value = perfil.tipoVeiculo ?? ''
  $('#perfilAliquotaCbs').value =
    perfil.aliquotaCbs === null || perfil.aliquotaCbs === undefined ? '' : numero(perfil.aliquotaCbs, 4)
  $('#perfilAliquotaIbs').value =
    perfil.aliquotaIbs === null || perfil.aliquotaIbs === undefined ? '' : numero(perfil.aliquotaIbs, 4)
  $('#perfilDas').value =
    perfil.dasTotal === null || perfil.dasTotal === undefined ? '' : numero(perfil.dasTotal)
  atualizarCamposPerfil()
}

function atualizarStatusPerfil() {
  const chip = $('#perfilStatus')
  if (!chip) return
  const salvo = Boolean(estado.perfis.atualId)
  chip.textContent = !salvo ? 'não salvo' : estado.perfis.sujo ? 'alterações não salvas' : 'salvo'
  chip.classList.toggle('chip--best', salvo && !estado.perfis.sujo)
}

function atualizarCamposPerfil() {
  const modo = $('#perfilModoDias').value
  $('#perfilDiasFixoWrap').hidden = modo !== 'FIXO'
  $('#perfilFormTitulo').textContent = estado.perfis.atualId ? 'Editar perfil' : 'Novo perfil'

  const perfilId = $('#perfilRegime').value
  const meta = estado.opcoes.perfis.find((item) => item.id === perfilId)
  $('#perfilRegimeHint').textContent = meta?.descricao ?? ''

  const simples = perfilId === 'SIMPLES_DAS'
  $('#perfilSimplesWrap').hidden = !simples
  $('#perfilSimplesHint').hidden = !simples

  const tipo = (estado.opcoes.tiposVeiculo ?? []).find((item) => item.id === $('#perfilTipoVeiculo').value)
  $('#perfilVeiculoHint').textContent = tipo
    ? `Referência para ${tipo.rotulo}: ${brl(tipo.min)} a ${brl(tipo.max)} por dia, base ${brl(tipo.base)}. Derivada do piso ANTT de 16/07/2026 — não é cotação de mercado.`
    : 'Selecione para ver a faixa de referência da diária (derivada do piso mínimo da ANTT).'

  const interna = $('#perfilUfOrigem').value === $('#perfilUfDestino').value
  $('#perfilRotaHint').textContent = interna
    ? 'Operação interna (mesma UF): a projeção do regime anterior usa a alíquota interna padrão de 18% do motor.'
    : 'Operação interestadual: ICMS de 12% (7% para Norte, Nordeste, Centro-Oeste e ES) na projeção do regime anterior.'

  const regime = estado.opcoes.regimesPagadora.find((item) => item.id === estado.regimePagadora)
  $('#perfilContextoHint').innerHTML = `Crédito calculado como <b>${esc(regime?.curto ?? 'Lucro Real')}</b> e operação <b>${esc(estado.operacao)}</b> — muda no formulário acima.`

  $('#perfilExcluir').hidden = !estado.perfis.atualId
  atualizarStatusPerfil()
}

function lerCamposPerfil() {
  return {
    nome: $('#perfilNome').value.trim(),
    diaria: $('#perfilDiaria').value,
    ufOrigem: $('#perfilUfOrigem').value,
    ufDestino: $('#perfilUfDestino').value,
    perfil: $('#perfilRegime').value,
    tipoVeiculo: $('#perfilTipoVeiculo').value,
    modoDias: $('#perfilModoDias').value,
    diasFixo: $('#perfilDiasFixo').value,
    aliquotaCbs: $('#perfilAliquotaCbs').value,
    aliquotaIbs: $('#perfilAliquotaIbs').value,
    dasTotal: $('#perfilDas').value,
  }
}

function perfilDoFormulario() {
  return { ...lerCamposPerfil(), tipoOperacao: estado.operacao }
}

async function enviarJson(url, metodo, corpo) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = new Error(dados.erro || `O servidor respondeu HTTP ${resposta.status}.`)
    erro.campo = dados.campo ?? null
    throw erro
  }
  return dados
}

function agendarPrevia() {
  clearTimeout(estado.perfis.timer)
  estado.perfis.timer = setTimeout(calcularPrevia, 320)
}

async function calcularPrevia() {
  const campos = perfilDoFormulario()
  const diaria = numeroDeTexto(campos.diaria)
  if (!Number.isFinite(diaria) || diaria <= 0) {
    renderizarPerfilVazio('Informe a diária para ver o mês fechar')
    return
  }

  const seq = ++estado.perfis.seq
  try {
    const dados = await post('/api/perfis/calcular', {
      perfil: { ...campos, nome: campos.nome || 'Prévia' },
      regimePagadora: estado.regimePagadora,
      tipoOperacao: estado.operacao,
      ano: estado.perfis.ano,
      mes: estado.perfis.mes,
    })
    if (seq !== estado.perfis.seq) return
    estado.perfis.detalhe = dados
    renderizarPerfilResultado(dados)
  } catch (erro) {
    if (seq !== estado.perfis.seq) return
    renderizarPerfilErro(erro.message)
  }
}

async function carregarListaPerfis() {
  const dados = await fetch('/api/perfis').then((resposta) => resposta.json())
  estado.perfis.lista = Array.isArray(dados.perfis) ? dados.perfis : []
  renderizarCardsPerfis()
}

function renderizarCardsPerfis() {
  const alvo = $('#perfisCards')
  const lista = estado.perfis.lista
  $('#perfisContagem').textContent = String(lista.length)

  if (!lista.length) {
    alvo.innerHTML = `
      <div class="perfis__vazio">
        <strong>Nenhum perfil salvo</strong>
        <p>Cadastre a primeira diária para ver o faturamento do mês e o custo líquido.</p>
      </div>`
    return
  }

  alvo.innerHTML = lista
    .map(
      (perfil) => `
      <button
        type="button"
        class="perfil-card ${perfil.id === estado.perfis.atualId ? 'is-active' : ''}"
        data-perfil-id="${esc(perfil.id)}"
        aria-pressed="${perfil.id === estado.perfis.atualId}"
      >
        <span class="perfil-card__nome">${esc(perfil.nome)}</span>
        <span class="perfil-card__meta">
          <span>${esc(perfil.rota)}</span>
          <span>${esc(perfil.perfilCurto)}</span>
          <span>${numero(perfil.diasMedios, 1)} dias/mês</span>
        </span>
        <span class="perfil-card__valores">
          <span class="perfil-card__diaria">${brl(perfil.diaria)} <small>/dia</small></span>
          <span class="perfil-card__bruto">${brl(perfil.brutoMensal)}/mês</span>
        </span>
      </button>`,
    )
    .join('')
}

async function selecionarPerfil(id) {
  const perfil = estado.perfis.lista.find((item) => item.id === id)
  if (!perfil) return
  estado.perfis.atualId = id
  estado.perfis.sujo = false
  estado.perfis.erro = null
  preencherFormulario(perfil)
  renderizarCardsPerfis()
  $('#perfilFormErro').hidden = true
  await carregarDetalhePerfil()
}

function novoPerfil() {
  estado.perfis.atualId = null
  estado.perfis.sujo = false
  estado.perfis.detalhe = null
  preencherFormulario(PERFIL_VAZIO())
  renderizarCardsPerfis()
  $('#perfilFormErro').hidden = true
  $('#perfilResultado').innerHTML = ''
  renderizarPerfilVazio('Preencha a diária e o regime para ver o mês fechar')
  $('#perfilNome').focus()
}

async function carregarDetalhePerfil() {
  if (!estado.perfis.atualId) return
  const seq = ++estado.perfis.seq
  const parametros = new URLSearchParams({
    ano: String(estado.perfis.ano),
    mes: String(estado.perfis.mes),
    regimePagadora: estado.regimePagadora,
    tipoOperacao: estado.operacao,
  })

  try {
    const resposta = await fetch(`/api/perfis/${estado.perfis.atualId}?${parametros}`)
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.erro || `O servidor respondeu HTTP ${resposta.status}.`)
    if (seq !== estado.perfis.seq) return
    estado.perfis.detalhe = dados
    renderizarPerfilResultado(dados)
  } catch (erro) {
    if (seq !== estado.perfis.seq) return
    renderizarPerfilErro(erro.message)
  }
}

async function carregarComparacaoPerfis() {
  if (!estado.perfis.lista.length) {
    $('#perfisComparacao').innerHTML = ''
    return
  }
  const seq = ++estado.perfis.comparacaoSeq
  try {
    const dados = await enviarJson('/api/perfis/comparar', 'POST', {
      ano: estado.perfis.ano,
      regimePagadora: estado.regimePagadora,
      tipoOperacao: estado.operacao,
    })
    if (seq !== estado.perfis.comparacaoSeq) return
    renderizarComparacaoPerfis(dados)
  } catch (erro) {
    if (seq !== estado.perfis.comparacaoSeq) return
    $('#perfisComparacao').innerHTML = `
      <div class="callout callout--aviso">${ICONE.alerta}<div><p><strong>Não foi possível comparar os perfis.</strong> ${esc(erro.message)}</p></div></div>`
  }
}

function renderizarPerfilVazio(mensagem) {
  $('#perfilResultado').innerHTML = `
    <div class="perfis__vazio-painel">
      <strong>${esc(mensagem)}</strong>
      <p class="hint">A diária é o preço do dia. O app multiplica pelos dias do mês e mostra o crédito e o custo líquido de cada mês.</p>
    </div>`
}

function renderizarPerfilErro(mensagem) {
  $('#perfilResultado').innerHTML = `
    <div class="callout callout--aviso">
      ${ICONE.alerta}
      <div>
        <p><strong>Não foi possível calcular este perfil.</strong> ${esc(mensagem)}</p>
      </div>
    </div>`
}

function opcoesAnoPerfil() {
  return (estado.opcoes.anosPerfil ?? []).map((ano) => {
    const meta = estado.opcoes.anos.find((item) => item.ano === ano)
    return `<option value="${ano}"${ano === estado.perfis.ano ? ' selected' : ''}>${ano}${meta ? ` — ${esc(meta.rotulo)}` : ''}</option>`
  })
}

function opcoesMesPerfil() {
  return NOMES_MESES.map(
    (nome, indice) =>
      `<option value="${indice + 1}"${indice + 1 === estado.perfis.mes ? ' selected' : ''}>${esc(nome)}</option>`,
  )
}

function composicaoDoMes(mes) {
  const partes = []
  if (mes.composicao?.icms > 0) partes.push(`ICMS ${brl(mes.composicao.icms)}`)
  if (mes.composicao?.pisCofins > 0) partes.push(`PIS/COFINS ${brl(mes.composicao.pisCofins)}`)
  if (mes.composicao?.cbsIbs > 0) partes.push(`CBS/IBS ${brl(mes.composicao.cbsIbs)}`)
  return partes.join(' · ')
}

function rotuloDias(perfil) {
  if (perfil.modoDias === 'CORRIDOS') return 'dias corridos'
  if (perfil.modoDias === 'FIXO') return 'dias fixos'
  if (perfil.modoDias === 'UTEIS_SABADO') return 'dias (seg–sáb)'
  return 'dias úteis'
}

function renderizarPerfilResultado(dados) {
  const alvo = $('#perfilResultado')
  const { perfil, meses, totais, anos, deveria, contexto } = dados
  const mes = meses.find((item) => item.mes === contexto.mesReferencia) ?? meses[0]
  const rotulo = rotuloDias(perfil)
  const composicao = composicaoDoMes(mes)
  const creditoHtml =
    mes.credito > 0
      ? `${pct(mes.percentualCredito)}${composicao ? ` · ${esc(composicao)}` : ''}`
      : `sem crédito em ${contexto.anoReferencia}`

  const frase =
    `Em <b>${esc(mes.nome.toLowerCase())}</b>, ${mes.dias} ${rotulo} × ${brl(perfil.diaria)} = ` +
    `<b>${brl(mes.bruto)}</b> de faturamento. ` +
    (mes.credito > 0
      ? `Desse valor, <b>${brl(mes.credito)}</b> voltam como crédito e o seu custo líquido fica em <b>${brl(mes.liquido)}</b>.`
      : `Não há crédito neste regime/ano: o seu custo líquido é o faturamento cheio, <b>${brl(mes.liquido)}</b>.`)

  const linhasMes = meses
    .map(
      (item) => `
      <tr class="${item.mes === mes.mes ? 'is-current' : ''}">
        <td class="cell-mes" data-rotulo="Mês">${esc(item.nome)}${item.atual ? ' <span class="chip chip--year">atual</span>' : ''}</td>
        <td class="num" data-rotulo="Dias">${item.dias}</td>
        <td class="num" data-rotulo="Bruto">${brl(item.bruto)}</td>
        <td class="num" data-rotulo="Crédito">${brl(item.credito)}</td>
        <td class="num cell-net" data-rotulo="Custo líquido">${brl(item.liquido)}</td>
      </tr>`,
    )
    .join('')

  const linhasAno = anos
    .map((item) => {
      const variacao =
        item.ano === contexto.anoReferencia
          ? '<span class="cell-dash">—</span>'
          : Math.abs(item.variacaoLiquido) < 0.005
            ? '<span class="cell-dash">=</span>'
            : `<span class="${item.variacaoLiquido > 0 ? 'is-alta' : 'is-baixa'}">${sinalNumero(item.variacaoLiquido)}</span>`
      return `
      <tr class="${item.ano === contexto.anoReferencia ? 'is-current' : ''}">
        <td class="cell-mes" data-rotulo="Ano">${item.ano}<small>${esc(item.rotulo)}</small></td>
        <td class="num" data-rotulo="Dias">${item.dias}</td>
        <td class="num" data-rotulo="Bruto">${brl(item.bruto)}</td>
        <td class="num" data-rotulo="Crédito">${pct(item.percentualCredito)}<small>${brl(item.credito)}</small></td>
        <td class="num cell-net" data-rotulo="Custo líquido">${brl(item.liquido)}</td>
        <td class="num cell-variacao" data-rotulo="vs ${contexto.anoReferencia}">${variacao}</td>
      </tr>`
    })
    .join('')

  const deveriaHTML = (() => {
    if (!deveria) return ''
    if (deveria.disponivel === false) {
      return `<div class="callout">${ICONE.info}<div><p>${esc(deveria.motivo)}</p></div></div>`
    }
    if (deveria.jaRegular) {
      return `
        <div class="callout">
          ${ICONE.ok}
          <div>
            <p><strong>Você já captura todo o crédito deste perfil.</strong> ${esc(deveria.veredito)}</p>
          </div>
        </div>`
    }

    const pior = deveria.economiaAnual > 0.005
    return `
      <div class="deveria ${pior ? 'deveria--alerta' : 'deveria--ok'}">
        <div class="deveria__head">
          <div>
            <p class="eyebrow-sm">Quanto deveria ser a diária · benchmark do regime regular</p>
            <p class="deveria__veredito">${esc(deveria.veredito)}</p>
          </div>
          <span class="chip chip--soft">${deveria.ano}</span>
        </div>
        <div class="deveria__grid">
          <div>
            <span>Sua diária</span>
            <strong>${brl(perfil.diaria)}</strong>
            <small>crédito de ${pct(deveria.percentualCreditoAtual)}</small>
          </div>
          <div>
            <span>Diária-teto</span>
            <strong>${deveria.diariaTeto === null ? '—' : brl(deveria.diariaTeto)}</strong>
            <small>${deveria.percentualTeto === null ? 'sem crédito' : `${pct(deveria.percentualTeto)} da atual`}</small>
          </div>
          <div class="${pior ? 'is-alerta' : 'is-ok'}">
            <span>Diferença no ano</span>
            <strong>${brl(Math.abs(deveria.economiaAnual))}</strong>
            <small>${pior ? 'você paga a mais' : 'você paga a menos'}</small>
          </div>
        </div>
        <p class="deveria__nota">
          O benchmark é o mesmo serviço com um transportador do regime regular, que transfere
          ${pct(deveria.percentualCreditoRegular)} de crédito. A diária-teto é a diária que empata o seu custo líquido com esse benchmark.
        </p>
      </div>`
  })()

  const notaDas =
    perfil.dasTotal !== null && perfil.dasTotal !== undefined
      ? `<p class="perfil-res__nota">DAS estimado em ${brl(mes.das)} no mês e ${brl(totais.das)} no ano; a receita líquida do transportador fica em ${brl(mes.liquidoTransportador)} no mês.</p>`
      : ''

  const alertasHTML = (dados.alertas ?? [])
    .map(
      (alerta) => `
      <div class="callout ${alerta.nivel === 'alto' ? 'callout--aviso' : ''}">
        ${alerta.nivel === 'alto' ? ICONE.alerta : ICONE.info}
        <div><p><strong>${esc(alerta.titulo)}.</strong> ${esc(alerta.texto)}</p></div>
      </div>`,
    )
    .join('')

  alvo.innerHTML = `
    <div class="perfil-res">
      <div class="perfil-res__head">
        <div>
          <p class="eyebrow-sm">${esc(perfil.nome)} · ${esc(perfil.rota)} · ${esc(perfil.perfilCurto)}</p>
          <p class="perfil-res__frase">${frase}</p>
        </div>
        <div class="perfil-res__controles">
          <label for="perfilAno">Ano
            <select id="perfilAno" data-perfil-ano>${opcoesAnoPerfil()}</select>
          </label>
          <label for="perfilMes">Mês
            <select id="perfilMes" data-perfil-mes>${opcoesMesPerfil()}</select>
          </label>
        </div>
      </div>

      ${alertasHTML}

      <div class="perfil-res__kpis">
        <div class="kpi">
          <span class="kpi__label">Diária</span>
          <strong class="kpi__valor">${brl(perfil.diaria)}</strong>
          <span class="kpi__sub">${mes.dias} ${rotulo} em ${esc(mes.nome.toLowerCase())}</span>
        </div>
        <div class="kpi">
          <span class="kpi__label">Faturamento bruto</span>
          <strong class="kpi__valor">${brl(mes.bruto)}</strong>
          <span class="kpi__sub">média do ano ${brl(totais.mediaMensalBruto)}</span>
        </div>
        <div class="kpi ${mes.credito > 0 ? 'kpi--credit' : ''}">
          <span class="kpi__label">Crédito</span>
          <strong class="kpi__valor">${brl(mes.credito)}</strong>
          <span class="kpi__sub">${creditoHtml}</span>
        </div>
        <div class="kpi">
          <span class="kpi__label">Custo líquido</span>
          <strong class="kpi__valor">${brl(mes.liquido)}</strong>
          <span class="kpi__sub">no ano ${brl(totais.liquido)}</span>
        </div>
      </div>

      <div class="perfil-res__secao">
        <div class="perfil-res__secao-head">
          <h4>Mês a mês · ${contexto.anoReferencia}</h4>
          <span>${totais.dias} ${rotulo} no ano · média de ${numero(totais.mediaMensalBruto)} por mês</span>
        </div>
        <div class="table-wrap">
          <table class="table table--perfil">
            <thead>
              <tr>
                <th>Mês</th>
                <th class="num">Dias</th>
                <th class="num">Bruto</th>
                <th class="num">Crédito</th>
                <th class="num">Custo líquido</th>
              </tr>
            </thead>
            <tbody>
              ${linhasMes}
              <tr class="is-total">
                <td class="cell-mes">Ano</td>
                <td class="num cell-dias-total" data-rotulo="Dias">${totais.dias}</td>
                <td class="num" data-rotulo="Bruto">${brl(totais.bruto)}</td>
                <td class="num" data-rotulo="Crédito">${brl(totais.credito)}</td>
                <td class="num cell-net" data-rotulo="Custo líquido">${brl(totais.liquido)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${notaDas}
      </div>

      <div class="perfil-res__secao">
        <div class="perfil-res__secao-head">
          <h4>Ano a ano · diária travada</h4>
          <span>o que muda é o calendário e a carga tributária</span>
        </div>
        <div class="table-wrap">
          <table class="table table--perfil">
            <thead>
              <tr>
                <th>Ano</th>
                <th class="num">Dias</th>
                <th class="num">Bruto</th>
                <th class="num">Crédito</th>
                <th class="num">Custo líquido</th>
                <th class="num">vs ${contexto.anoReferencia}</th>
              </tr>
            </thead>
            <tbody>${linhasAno}</tbody>
          </table>
        </div>
      </div>

      ${deveriaHTML}
    </div>`

  const notas = (dados.notas ?? []).slice(0, 6)
  if (notas.length) {
    alvo.querySelector('.perfil-res')?.insertAdjacentHTML(
      'beforeend',
      `<ul class="perfil-res__notas">${notas.map((nota) => `<li>${esc(nota)}</li>`).join('')}</ul>`,
    )
  }
}

function renderizarComparacaoPerfis(dados) {
  const alvo = $('#perfisComparacao')
  if (!dados?.linhas?.length) {
    alvo.innerHTML = ''
    return
  }

  const linhaHTML = (linha) => `
      <tr class="${linha.melhor ? 'is-best' : ''}">
        <td class="rank" data-rotulo="#">${linha.posicao}º</td>
        <td class="cell-perfil" data-rotulo="Perfil">
          ${esc(linha.nome)}
          <small>${esc(linha.rota)} · ${esc(linha.perfilCurto)} · ${esc(linha.tipoOperacao)}</small>
        </td>
        <td class="num" data-rotulo="Diária">${brl(linha.diaria)}</td>
        <td class="num cell-vazio" data-rotulo="Dias/ano">${linha.diasNoAno}</td>
        <td class="num" data-rotulo="Bruto anual">${brl(linha.brutoAnual)}<small>${brl(linha.brutoMensal)}/mês</small></td>
        <td class="num" data-rotulo="Crédito">${pct(linha.percentualCredito)}<small>${brl(linha.creditoAnual)}/ano</small></td>
        <td class="num cell-net" data-rotulo="Custo líquido/ano">${brl(linha.liquidoAnual)}<small>${brl(linha.liquidoMensal)}/mês</small></td>
        <td class="num" data-rotulo="vs melhor">
          ${linha.melhor ? '<span class="chip chip--best">melhor</span>' : `${brl(linha.diferencaAnual)}<small>${pct(linha.percentualDiferenca)}</small>`}
        </td>
      </tr>`

  const grupos = dados.grupos?.length ? dados.grupos : [{ rotulo: null, linhas: dados.linhas }]
  const corpo = grupos
    .map(
      (grupo) => `
      <tbody>
        ${grupo.rotulo ? `<tr class="is-grupo"><th colspan="8">${esc(grupo.rotulo)}</th></tr>` : ''}
        ${grupo.linhas.map(linhaHTML).join('')}
      </tbody>`,
    )
    .join('')

  alvo.innerHTML = `
    <div class="perfis__comparacao-head">
      <div>
        <p class="eyebrow-sm">Ranking · ${dados.ano} · ${esc(dados.contexto.regimePagadora.curto)} · ${esc(dados.contexto.tipoOperacao ?? 'B2B')}</p>
        <h3>Qual perfil custa menos no ano</h3>
      </div>
      <span class="chip chip--soft">custo líquido anual · diária travada</span>
    </div>
    <div class="table-wrap">
      <table class="table table--perfis-rank">
        <thead>
          <tr>
            <th>#</th>
            <th>Perfil</th>
            <th class="num">Diária</th>
            <th class="num">Dias/ano</th>
            <th class="num">Bruto anual</th>
            <th class="num">Crédito</th>
            <th class="num">Custo líquido</th>
            <th class="num">vs melhor</th>
          </tr>
        </thead>
        ${corpo}
      </table>
    </div>
    <p class="perfil-res__nota">
      ${dados.economiaEntreExtremos > 0 ? `Dentro do mesmo tipo de veículo, a diferença entre o melhor e o pior perfil chega a ${brl(dados.economiaEntreExtremos)} por ano.` : 'Crie outro perfil do mesmo tipo de veículo para comparar dois transportadores.'}
      A comparação é sempre dentro do mesmo tipo: uma carreta e um toco não disputam o mesmo serviço.${
        dados.ano === 2026
          ? ' Em 2026 o optante do Simples não gera crédito de CBS/IBS (art. 348, III, "c", da LC 214/2025): o custo desses perfis é o faturamento cheio.'
          : ''
      }
    </p>`
}

async function iniciarPerfis() {
  renderizarSelectsPerfil()
  try {
    await carregarListaPerfis()
    if (estado.perfis.lista.length) {
      await selecionarPerfil(estado.perfis.lista[0].id)
    } else {
      novoPerfil()
    }
    await carregarComparacaoPerfis()
  } catch (erro) {
    renderizarPerfilErro(erro.message)
  }
}

async function salvarPerfil() {
  const campos = perfilDoFormulario()
  const erroEl = $('#perfilFormErro')
  erroEl.hidden = true

  if (campos.nome.length < 2) {
    erroEl.hidden = false
    erroEl.textContent = 'Dê um nome ao perfil com pelo menos 2 caracteres.'
    $('#perfilNome').focus()
    return
  }
  const diaria = numeroDeTexto(campos.diaria)
  if (!Number.isFinite(diaria) || diaria <= 0) {
    erroEl.hidden = false
    erroEl.textContent = 'Informe a diária em reais, maior que zero.'
    $('#perfilDiaria').focus()
    return
  }

  const botao = $('#perfilSalvar')
  botao.classList.add('is-loading')
  botao.disabled = true
  try {
    if (estado.perfis.atualId) {
      await enviarJson(`/api/perfis/${estado.perfis.atualId}`, 'PUT', campos)
    } else {
      const criado = await enviarJson('/api/perfis', 'POST', campos)
      estado.perfis.atualId = criado.perfil.id
    }
    estado.perfis.sujo = false
    await carregarListaPerfis()
    const perfil = perfilAtual()
    if (perfil) preencherFormulario(perfil)
    renderizarCardsPerfis()
    await carregarDetalhePerfil()
    await carregarComparacaoPerfis()
  } catch (erro) {
    erroEl.hidden = false
    erroEl.textContent = erro.message
  } finally {
    botao.classList.remove('is-loading')
    botao.disabled = false
  }
}

async function excluirPerfil() {
  const botao = $('#perfilExcluir')
  if (!estado.perfis.atualId) return

  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1'
    botao.textContent = 'Confirmar exclusão'
    setTimeout(() => {
      delete botao.dataset.confirmar
      botao.textContent = 'Excluir'
    }, 4000)
    return
  }
  delete botao.dataset.confirmar
  botao.textContent = 'Excluir'

  try {
    await enviarJson(`/api/perfis/${estado.perfis.atualId}`, 'DELETE')
    estado.perfis.atualId = null
    estado.perfis.detalhe = null
    await carregarListaPerfis()
    if (estado.perfis.lista.length) await selecionarPerfil(estado.perfis.lista[0].id)
    else novoPerfil()
    await carregarComparacaoPerfis()
  } catch (erro) {
    const erroEl = $('#perfilFormErro')
    erroEl.hidden = false
    erroEl.textContent = erro.message
  }
}

async function restaurarExemplosPerfis() {
  const botao = $('#perfisExemplos')
  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1'
    botao.textContent = 'Confirmar restauração'
    setTimeout(() => {
      delete botao.dataset.confirmar
      botao.textContent = 'Restaurar exemplos'
    }, 4000)
    return
  }
  delete botao.dataset.confirmar
  botao.textContent = 'Restaurar exemplos'

  try {
    const dados = await enviarJson('/api/perfis/exemplos', 'POST')
    estado.perfis.lista = dados.perfis ?? []
    estado.perfis.atualId = null
    renderizarCardsPerfis()
    if (estado.perfis.lista.length) await selecionarPerfil(estado.perfis.lista[0].id)
    else novoPerfil()
    await carregarComparacaoPerfis()
  } catch (erro) {
    const erroEl = $('#perfilFormErro')
    erroEl.hidden = false
    erroEl.textContent = erro.message
  }
}

async function usarPerfilNaSimulacao() {
  const dados = estado.perfis.detalhe
  if (!dados?.perfil) return
  const mes = dados.meses.find((item) => item.mes === estado.perfis.mes) ?? dados.meses[0]
  const perfil = dados.perfil

  $('#valor').value = numero(mes.bruto)
  $('#ufOrigem').value = perfil.ufOrigem
  $('#ufDestino').value = perfil.ufDestino
  $('#ano').value = String(dados.contexto.anoReferencia)

  const meta = estado.opcoes.perfis.find((item) => item.id === perfil.perfil)
  if (meta) estado.regime = meta.regime
  estado.perfil = perfil.perfil

  if (perfil.perfil === 'SIMPLES_DAS') {
    if (perfil.aliquotaCbs !== null && perfil.aliquotaCbs !== undefined) {
      $('#aliquotaCbs').value = numero(perfil.aliquotaCbs, 4)
    }
    if (perfil.aliquotaIbs !== null && perfil.aliquotaIbs !== undefined) {
      $('#aliquotaIbs').value = numero(perfil.aliquotaIbs, 4)
    }
    if (perfil.dasTotal !== null && perfil.dasTotal !== undefined) {
      $('#dasTotal').value = numero(perfil.dasTotal)
    }
  }

  renderizarRegimes()
  renderizarPerfis()
  atualizarPerfil()
  atualizarAno()
  marcarDesatualizado(true)
  await simular()
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** Recalcula o perfil aberto quando o contexto da pagadora muda. */
function atualizarContextoPerfis() {
  if (estado.perfis.detalhe) {
    const id = estado.perfis.atualId
    if (id) carregarDetalhePerfil()
    else agendarPrevia()
  }
  if (estado.perfis.lista.length) carregarComparacaoPerfis()
}

function ligarEventosPerfis() {
  $('#perfisCards').addEventListener('click', (evento) => {
    const cartao = evento.target.closest('[data-perfil-id]')
    if (cartao) selecionarPerfil(cartao.dataset.perfilId)
  })

  $('#perfilNovo').addEventListener('click', novoPerfil)
  $('#perfilForm').addEventListener('submit', (evento) => {
    evento.preventDefault()
    salvarPerfil()
  })
  $('#perfilExcluir').addEventListener('click', excluirPerfil)
  $('#perfisExemplos').addEventListener('click', restaurarExemplosPerfis)
  $('#perfilUsar').addEventListener('click', usarPerfilNaSimulacao)

  $('#perfilForm').addEventListener('input', (evento) => {
    if (evento.target.closest('[data-perfil-ano], [data-perfil-mes]')) return
    estado.perfis.sujo = true
    atualizarStatusPerfil()
    atualizarCamposPerfil()
    agendarPrevia()
  })

  $('#perfilForm').addEventListener('change', (evento) => {
    estado.perfis.sujo = true
    atualizarStatusPerfil()
    atualizarCamposPerfil()
    if (evento.target.id === 'perfilTipoVeiculo') {
      const tipo = (estado.opcoes.tiposVeiculo ?? []).find((item) => item.id === evento.target.value)
      const diaria = numeroDeTexto($('#perfilDiaria').value)
      if (tipo && !(Number.isFinite(diaria) && diaria > 0)) {
        $('#perfilDiaria').value = numero(tipo.base)
      }
    }
    agendarPrevia()
  })

  $('#perfilResultado').addEventListener('change', (evento) => {
    const alvo = evento.target
    if (alvo.matches('[data-perfil-ano]')) {
      estado.perfis.ano = Number(alvo.value)
      carregarDetalhePerfil()
      carregarComparacaoPerfis()
    } else if (alvo.matches('[data-perfil-mes]')) {
      estado.perfis.mes = Number(alvo.value)
      carregarDetalhePerfil()
    }
  })
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

function ligarEventos() {
  $('#form').addEventListener('submit', (evento) => {
    evento.preventDefault()
    simular()
  })

  $('#perfil').addEventListener('change', (evento) => {
    estado.perfil = evento.target.value
    atualizarPerfil()
    marcarDesatualizado(true)
  })

  $('#regime').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-regime]')
    if (!botao || botao.dataset.regime === estado.regime) return
    estado.regime = botao.dataset.regime
    const primeiro = estado.opcoes.perfis.find((perfil) => perfil.regime === estado.regime)
    if (primeiro) estado.perfil = primeiro.id
    renderizarRegimes()
    renderizarPerfis()
    atualizarPerfil()
    atualizarAno()
    marcarDesatualizado(true)
  })

  $('#operacao').addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-valor]')
    if (!botao) return
    estado.operacao = botao.dataset.valor
    renderizarOperacao()
    marcarDesatualizado(true)
    atualizarContextoPerfis()
  })

  $('#taxaRange').addEventListener('input', (evento) => {
    const valor = Number(evento.target.value)
    $('#taxaOut').textContent = pct(valor)
    evento.target.setAttribute('aria-valuetext', `${numero(valor)}% do frete`)
    marcarDesatualizado(true)
  })

  $('#valor').addEventListener('input', () => marcarDesatualizado(true))
  $('#dasTotal')?.addEventListener('input', () => marcarDesatualizado(true))
  $('#insumos')?.addEventListener('input', () => marcarDesatualizado(true))

  $('#valor').addEventListener('blur', (evento) => {
    const valor = numeroDeTexto(evento.target.value)
    if (Number.isFinite(valor) && valor > 0) evento.target.value = numero(valor)
  })

  $('#valor').addEventListener('focus', (evento) => evento.target.select())

  $('#ano').addEventListener('change', () => {
    atualizarAno()
    marcarDesatualizado(true)
  })

  $('#regimePagadora').addEventListener('change', (evento) => {
    estado.regimePagadora = evento.target.value
    marcarDesatualizado(true)
    atualizarContextoPerfis()
  })

  $('#horizonteCenario').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-cenario]')
    if (!botao || botao.dataset.cenario === estado.horizonteCenario) return
    estado.horizonteCenario = botao.dataset.cenario
    atualizarCenarioHorizonte()
    if (estado.horizonte) renderizarHorizonte(estado.horizonte)
  })

  $('#ufOrigem').addEventListener('change', () => marcarDesatualizado(true))
  $('#ufDestino').addEventListener('change', () => marcarDesatualizado(true))

  $('#reset').addEventListener('click', restaurar)

  ligarEventosPerfis()

  $('#carriers').addEventListener('input', (evento) => {
    const campo = evento.target.dataset.campo
    if (!campo) return
    const indice = Number(evento.target.closest('.carrier')?.dataset.indice)
    if (!Number.isInteger(indice)) return
    estado.cargas[indice][campo] = evento.target.value
    marcarDesatualizado(true)
  })

  $('#carriers').addEventListener('change', (evento) => {
    const campo = evento.target.dataset.campo
    if (!campo) return
    const indice = Number(evento.target.closest('.carrier')?.dataset.indice)
    if (!Number.isInteger(indice)) return
    estado.cargas[indice][campo] = evento.target.value
    if (campo === 'perfil') renderizarCargas()
    marcarDesatualizado(true)
  })

  for (const seletor of ['#aliquotaCbs', '#aliquotaIbs']) {
    $(seletor).addEventListener('input', () => {
      atualizarFonteSimples()
      marcarDesatualizado(true)
    })
  }

  $('#atividade').addEventListener('change', () => marcarDesatualizado(true))

  $('#carriers').addEventListener('click', (evento) => {
    const remover = evento.target.closest('[data-remover]')
    if (!remover || remover.disabled) return
    estado.cargas.splice(Number(remover.dataset.remover), 1)
    renderizarCargas()
    marcarDesatualizado(true)
  })

  $('#adicionar').addEventListener('click', () => {
    if (estado.cargas.length >= 3) return
    const letras = ['A', 'B', 'C']
    estado.cargas.push({
      nome: `Transportadora ${letras[estado.cargas.length]}`,
      preco: '1.000,00',
      perfil: 'REGIME_REGULAR',
    })
    renderizarCargas()
    marcarDesatualizado(true)
  })

  $('#comparar').addEventListener('click', comparar)

  $('#timelineMetrica').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-metrica]')
    if (!botao) return
    estado.timelineMetrica = botao.dataset.metrica
    renderizarMetricaTimeline()
    if (estado.timeline) renderizarTimeline(estado.timeline)
  })

  $('#cenarioAceite').addEventListener('click', () => {
    estado.cargas = [
      { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS', pCbs: '2,3591', pIbs: '0,0260' },
      { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO', pCbs: '', pIbs: '' },
    ]
    $('#valor').value = '1.000,00'
    $('#ano').value = '2027'
    estado.regime = 'SIMPLES'
    estado.perfil = 'SIMPLES_DAS'
    $('#aliquotaCbs').value = '2,3591'
    $('#aliquotaIbs').value = '0,0260'
    renderizarRegimes()
    renderizarPerfis()
    atualizarPerfil()
    atualizarAno()
    renderizarCargas()
    comparar()
    simular()
  })

  $('#comparacao').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-auditar]')
    if (!botao) return
    const linha = botao.closest('tr')
    const auditoria = linha?.nextElementSibling
    if (!auditoria?.classList.contains('audit-row')) return
    const abrir = auditoria.hidden
    auditoria.hidden = !abrir
    botao.setAttribute('aria-expanded', String(abrir))
    const rotulo = botao.querySelector('.audit-label')
    if (rotulo) rotulo.textContent = abrir ? 'Fechar' : 'Auditar'
    botao.title = abrir ? 'Fechar memória de cálculo' : 'Ver memória de cálculo'
  })

  document.addEventListener('click', (evento) => {
    const retryTimeline = evento.target.closest('[data-retry-timeline]')
    if (retryTimeline) {
      carregarTimeline()
      return
    }

    const retryHorizonte = evento.target.closest('[data-retry-horizonte]')
    if (retryHorizonte) {
      carregarHorizonte()
      return
    }

    const copiarSim = evento.target.closest('[data-copiar-sim]')
    if (copiarSim && estado.ultimaSimulacao) {
      copiarTexto(JSON.stringify(estado.ultimaSimulacao.motor.resposta, null, 2), copiarSim)
      return
    }
    const copiarLinha = evento.target.closest('[data-copiar-linha]')
    if (copiarLinha && estado.ultimaComparacao) {
      const item = estado.ultimaComparacao.ranking[Number(copiarLinha.dataset.copiarLinha)]
      if (item) copiarTexto(JSON.stringify(item.simulacao.motor.resposta, null, 2), copiarLinha)
    }
  })
}

async function copiarTexto(texto, botao) {
  const rotulo = botao.textContent
  try {
    await navigator.clipboard.writeText(texto)
    botao.textContent = 'Copiado'
  } catch {
    botao.textContent = 'Falhou'
  }
  setTimeout(() => {
    botao.textContent = rotulo
  }, 1600)
}

function restaurar() {
  estado.regime = 'SIMPLES'
  estado.perfil = 'SIMPLES_DAS'
  estado.operacao = 'B2B'
  estado.regimePagadora = 'NAO_CUMULATIVO'
  estado.horizonteCenario = 'congelado'
  estado.cargas = [
    { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS', pCbs: '', pIbs: '' },
    { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO', pCbs: '', pIbs: '' },
  ]

  $('#valor').value = '1.000,00'
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
  $('#ano').value = '2033'
  $('#aliquotaCbs').value = ''
  $('#aliquotaIbs').value = ''
  $('#dasTotal').value = '12'
  $('#insumos').value = '60'

  renderizarRegimes()
  renderizarPerfis()
  renderizarOperacao()
  renderizarRegimePagadora()
  renderizarCargas()
  atualizarPerfil()
  atualizarAno()
  atualizarCenarioHorizonte()
  marcarDesatualizado(false)
  marcarTimelineDesatualizado(false)
  marcarHorizonteDesatualizado(false)

  simular()
  comparar()
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

async function iniciar() {
  try {
    estado.opcoes = await carregarOpcoes()
    atualizarMotor()
    renderizarRegimes()
    renderizarPerfis()
    renderizarOperacao()
    renderizarRegimePagadora()
    renderizarAtividades()
    renderizarUfs()
    renderizarAnos()
    renderizarCargas()
    renderizarMetricaTimeline()
    atualizarPerfil()
    atualizarAno()
    ligarEventos()

    await Promise.allSettled([simular(), comparar(), iniciarPerfis()])
  } catch (erro) {
    mostrarErro($('#resultado'), `Falha ao iniciar a interface: ${erro.message}`)
  }
}

iniciar()
