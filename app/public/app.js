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
  perfil: 'SIMPLES_DAS',
  operacao: 'B2B',
  cargas: [
    { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS' },
    { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO' },
  ],
  ultimaSimulacao: null,
  ultimaComparacao: null,
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

function renderizarPerfis() {
  const alvo = $('#perfil')
  alvo.innerHTML = estado.opcoes.perfis
    .map(
      (perfil) =>
        `<option value="${perfil.id}">${esc(perfil.curto)} · ${esc(perfil.estimativa ? perfil.faixa : 'crédito integral')}</option>`,
    )
    .join('')
  alvo.value = estado.perfil
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

  $('#perfilHint').textContent = perfil.estimativa
    ? `${perfil.descricao} Faixa de ${perfil.faixa} do frete — ajuste abaixo.`
    : perfil.descricao

  const envoltorio = $('#taxaWrap')
  envoltorio.hidden = !perfil.estimativa
  if (!perfil.estimativa) return

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

function atualizarAno() {
  const ano = Number($('#ano').value)
  const item = estado.opcoes.anos.find((entrada) => entrada.ano === ano)
  if (!item) return

  $('#headDestaque').textContent = pct(item.aliquota.total)
  $('#headDestaqueSub').textContent = `CBS ${numero(item.aliquota.cbs)} + IBS ${numero(item.aliquota.ibsUf + item.aliquota.ibsMun)}`

  const dicas = {
    TESTE: 'Fase de teste: 1% destacado e compensável. Os regimes ainda não se diferenciam no crédito.',
    CBS_PLENA: 'CBS cheia e IBS ainda em teste. A diferença entre regimes começa a aparecer.',
    TRANSICAO_IBS: 'IBS cresce e o ICMS cai na mesma proporção. O crédito do frete aumenta ano a ano.',
    REGIME_PLENO: 'Regime pleno: CBS 8,50% + IBS 18,50%. É o cenário que compara de verdade os regimes.',
  }
  $('#anoHint').textContent = dicas[item.fase] ?? ''
}

function atualizarMotor(motor) {
  const pilula = $('#enginePill')
  const offline = !motor.online
  pilula.classList.toggle('is-offline', offline)
  $('#engineVersion').textContent = offline
    ? 'offline'
    : `${motor.versao ?? 'online'} · ${motor.baseDados ?? 'sem base'}`
  pilula.title = offline
    ? `Motor indisponível em ${motor.url}`
    : `Motor oficial em ${motor.url} · alíquotas de transição: ${motor.fonteAliquotas}${motor.aviso ? ` · ${motor.aviso}` : ''}`

  const alerta = $('#motorAlert')
  if (offline) {
    alerta.hidden = false
    alerta.innerHTML = `${ICONE.motor.replace('width="18" height="18"', 'width="18" height="18" style="flex:none;margin-top:1px"')}
      <div>
        <strong>O motor oficial não está respondendo.</strong>
        Suba o serviço em <code>${esc(motor.url)}</code> e recarregue:
        <br /><code>java -Dspring.profiles.active=offline -jar target\\api-regime-geral.jar</code>
        ${motor.erro ? `<br /><span style="opacity:.8">${esc(motor.erro)}</span>` : ''}
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
  return {
    valorFrete: $('#valor').value,
    perfil: estado.perfil,
    tipoOperacao: estado.operacao,
    ufOrigem: $('#ufOrigem').value,
    ufDestino: $('#ufDestino').value,
    ano: Number($('#ano').value),
    taxaCredito: perfil?.estimativa ? Number($('#taxaRange').value) : undefined,
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

  botao.classList.add('is-loading')
  botao.disabled = true
  painel.setAttribute('aria-busy', 'true')
  painel.classList.add('is-loading')

  if (!painel.querySelector('.result__head')) mostrarEsqueleto(painel)

  try {
    const dados = await post('/api/simular', lerEntrada())
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
    <p>Confira se o motor oficial está no ar em <code>http://127.0.0.1:8080</code>. O cálculo de CBS/IBS não é refeito aqui — sem o motor, não há simulação.</p>
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
    estado.opcoes.motor.versao = motor.versao
    estado.opcoes.motor.baseDados = motor.baseDados ?? estado.opcoes.motor.baseDados
    atualizarMotor(estado.opcoes.motor)
  }

  const niveis = { atencao: 'warn', ok: 'ok', neutro: 'neutral' }
  const icone = resultado.alerta.nivel === 'atencao' ? ICONE.alerta : resultado.alerta.nivel === 'ok' ? ICONE.ok : ICONE.neutro
  const cobertura = Math.max(0, Math.min(100, resultado.percentualCredito))
  const creditoPerdido = resultado.creditoPerdido

  painel.className = 'card result'
  painel.innerHTML = `
    <div class="result__head">
      <span class="eyebrow-sm">Resultado · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      <div class="chips">
        <span class="chip">${esc(entrada.perfil.curto)}</span>
        <span class="chip">${esc(entrada.tipoOperacao)}</span>
        <span class="chip">${esc(entrada.rota)}</span>
        <span class="chip chip--year">${entrada.ano} · ${esc(motor.faseRotulo)}</span>
        ${entrada.perfil.estimativa ? '<span class="chip chip--best">crédito estimado</span>' : ''}
      </div>
    </div>

    <div class="result__main">
      <div>
        <span class="result__label">Custo líquido pós-crédito</span>
        <div class="net">
          <span class="net__cur">R$</span>
          <span class="net__val">${numero(resultado.custoLiquido)}</span>
        </div>
        <p class="result__sub">
          de <b>${brl(entrada.valorFrete)}</b> nominais · crédito de <b>${brl(resultado.credito)}</b>
          ${resultado.limitadoAoTeto ? ' · limitado ao destaque do ano' : ''}
        </p>
      </div>
      <dl class="metrics">
        <div><dt>Crédito aproveitável</dt><dd>${brl(resultado.credito)} <span class="metric-pct">${pct(resultado.percentualCredito)}</span></dd></div>
        <div><dt>CBS/IBS destacado</dt><dd>${brl(motor.destaque)}</dd></div>
        <div><dt>Crédito não aproveitado</dt><dd class="${creditoPerdido > 0 ? 'neg' : ''}">${brl(creditoPerdido)}</dd></div>
      </dl>
    </div>

    <div class="split">
      <div class="split__bar" role="img" aria-label="${pct(cobertura)} do frete volta como crédito">
        ${cobertura > 0 ? `<span style="width:${cobertura}%"></span>` : ''}
      </div>
      <div class="split__legend">
        <span>${cobertura > 0 ? `${pct(cobertura)} volta como crédito` : 'sem crédito nesta operação'}</span>
        <span>${pct(100 - cobertura)} fica no custo</span>
      </div>
    </div>

    <div class="alert alert--${niveis[resultado.alerta.nivel] ?? 'neutral'}" role="status">
      ${icone}
      <div>
        <strong>${esc(resultado.alerta.titulo)}</strong>
        <p>${esc(resultado.alerta.texto)}</p>
      </div>
    </div>

    <div class="audit">
      <div class="audit__head">
        <h3>Memória de cálculo</h3>
        <span class="tag">motor oficial</span>
      </div>
      <dl class="steps">${passosHTML(dados)}</dl>

      <details class="raw" open>
        <summary>
          Resposta bruta do motor
          <span class="raw__meta">HTTP ${motor.status} · API ${esc(motor.versao ?? '—')} · base ${esc(motor.baseDados ?? '—')}</span>
        </summary>
        <pre>${esc(JSON.stringify(motor.resposta, null, 2))}</pre>
        <div class="raw__bar">
          <span>NBS 105011220 · CST 000 · cClassTrib 000001${motor.calculoSimulado ? ' · cálculo simulado' : ''}</span>
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
      })),
      ano: Number($('#ano').value),
      tipoOperacao: estado.operacao,
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
          <small class="cell-meta"><span>${esc(item.perfil.curto)}</span><span>${brl(item.valorFrete)} nominais</span></small>
          ${indice === 0 ? '<span class="best-chip">melhor no líquido</span>' : ''}
        </td>
        <td>${esc(item.perfil.curto)}</td>
        <td class="num">${brl(item.valorFrete)}</td>
        <td class="num">
          ${item.alerta.nivel === 'atencao' ? `<span class="alert-dot" title="Crédito de ${pct(item.percentualCredito)}, abaixo de 4%"></span>` : ''}
          ${pct(item.percentualCredito)}
        </td>
        <td class="num cell-net">${brl(item.custoLiquido)}</td>
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

  const observacoes = []
  if (precoIgual && economia > 0) {
    observacoes.push(`
      <div class="callout">
        ${ICONE.info}
        <p><strong>Mesmo preço nominal de ${brl(campeao.valorFrete)}.</strong> A diferença de ${brl(economia)} no líquido vem só do crédito do regime: ${esc(campeao.nome)} transfere ${pct(campeao.percentualCredito)} contra ${pct(ranking[ranking.length - 1].percentualCredito)} de ${esc(ranking[ranking.length - 1].nome)}.</p>
      </div>`)
  }
  if (menorPreco.nome !== campeao.nome) {
    observacoes.push(`
      <div class="callout">
        ${ICONE.info}
        <p><strong>O menor preço nominal não é o menor custo líquido.</strong> ${esc(menorPreco.nome)} cobra ${brl(menorPreco.valorFrete)}, mas ${esc(campeao.nome)} custa ${brl(menorPreco.custoLiquido - campeao.custoLiquido)} menos depois do crédito.</p>
      </div>`)
  }

  $('#comparacao').innerHTML = `
    <div class="ranking">
      <div class="ranking__head">
        <div>
          <span class="eyebrow-sm">Ranking por custo líquido</span>
          <p class="ranking__resumo">${esc(resumo)}</p>
        </div>
        <span class="chip chip--best">vencedor · ${esc(vencedor)}</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <caption class="sr-only">Transportadoras ordenadas por custo líquido pós-crédito</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Transportadora</th>
              <th scope="col">Regime</th>
              <th scope="col" class="num">Preço nominal</th>
              <th scope="col" class="num">Crédito</th>
              <th scope="col" class="num">Custo líquido</th>
              <th scope="col" class="num">Δ</th>
              <th scope="col"><span class="sr-only">Auditoria</span></th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <p class="table-note">Crédito por faixa setorial (estimativa) em Simples, Simples híbrido e autônomo/MEI. No regime regular, o destaque integral do motor vira crédito.</p>
      ${observacoes.join('')}
    </div>`
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
  })

  $('#operacao').addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-valor]')
    if (!botao) return
    estado.operacao = botao.dataset.valor
    renderizarOperacao()
    marcarDesatualizado(true)
  })

  $('#taxaRange').addEventListener('input', (evento) => {
    const valor = Number(evento.target.value)
    $('#taxaOut').textContent = pct(valor)
    evento.target.setAttribute('aria-valuetext', `${numero(valor)}% do frete`)
  })

  $('#valor').addEventListener('blur', (evento) => {
    const valor = numeroDeTexto(evento.target.value)
    if (Number.isFinite(valor) && valor > 0) evento.target.value = numero(valor)
  })

  $('#valor').addEventListener('focus', (evento) => evento.target.select())

  $('#ano').addEventListener('change', () => {
    atualizarAno()
    marcarDesatualizado(true)
  })

  $('#ufOrigem').addEventListener('change', () => marcarDesatualizado(true))
  $('#ufDestino').addEventListener('change', () => marcarDesatualizado(true))

  $('#reset').addEventListener('click', restaurar)

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
    marcarDesatualizado(true)
  })

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

  $('#cenarioAceite').addEventListener('click', () => {
    estado.cargas = [
      { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS' },
      { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO' },
    ]
    $('#valor').value = '1.000,00'
    estado.perfil = 'SIMPLES_DAS'
    renderizarPerfis()
    atualizarPerfil()
    renderizarCargas()
    comparar()
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
  estado.perfil = 'SIMPLES_DAS'
  estado.operacao = 'B2B'
  estado.cargas = [
    { nome: 'Rota Sul Logística', preco: '1.000,00', perfil: 'SIMPLES_DAS' },
    { nome: 'Via Brasil Transportes', preco: '1.000,00', perfil: 'SIMPLES_HIBRIDO' },
  ]

  $('#valor').value = '1.000,00'
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
  $('#ano').value = '2033'

  renderizarPerfis()
  renderizarOperacao()
  renderizarCargas()
  atualizarPerfil()
  atualizarAno()
  marcarDesatualizado(false)

  simular()
  comparar()
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

async function iniciar() {
  try {
    estado.opcoes = await carregarOpcoes()
    atualizarMotor(estado.opcoes.motor)
    renderizarPerfis()
    renderizarOperacao()
    renderizarUfs()
    renderizarAnos()
    renderizarCargas()
    atualizarPerfil()
    atualizarAno()
    ligarEventos()

    await Promise.allSettled([simular(), comparar()])
  } catch (erro) {
    mostrarErro($('#resultado'), `Falha ao iniciar a interface: ${erro.message}`)
  }
}

iniciar()
