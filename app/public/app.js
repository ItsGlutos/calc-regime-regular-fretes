/* Frete Líquido — interface nova. Sem framework, sem build: DOM na mão. */

const $ = (seletor, raiz = document) => raiz.querySelector(seletor)
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)]

const esc = (valor) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere],
  )

const nfBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl = (valor) => nfBRL.format(Number(valor) || 0).replace(/\u00a0/g, ' ')
const numero = (valor, casas = 2) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(
    Number(valor) || 0,
  )
const pct = (valor, casas = 2) => `${numero(valor, casas)}%`

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

const MESES = [
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

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const PAGINAS = {
  calculadora: { titulo: 'Calculadora', rotulo: 'Calculadora' },
  horizonte: { titulo: 'Horizonte', rotulo: 'Horizonte' },
  comparador: { titulo: 'Comparador', rotulo: 'Comparador' },
  memoria: { titulo: 'Memória', rotulo: 'Memória' },
}

const estado = {
  opcoes: null,
  perfis: [],
  perfilSalvoId: null,
  detalhe: null,
  simulacao: null,
  comparador: null,
  comparadorChave: null,
  memoriaChave: null,
  pagina: 'calculadora',
  sujo: false,
  seq: 0,
  comparadorSeq: 0,
  memoriaSeq: 0,
}

const rotuloDias = (modo) =>
  ({
    UTEIS: 'dias úteis',
    UTEIS_EFETIVOS: 'dias úteis efetivos',
    UTEIS_SABADO: 'dias seg–sáb',
    CORRIDOS: 'dias corridos',
    FIXO: 'dias fixos',
  })[modo] ?? 'dias'

const rotuloModoDias = (modo) =>
  ({
    UTEIS: 'Dias úteis',
    UTEIS_EFETIVOS: 'Dias úteis efetivos',
    UTEIS_SABADO: 'Seg–sáb',
    CORRIDOS: 'Dias corridos',
    FIXO: 'Dias fixos',
  })[modo] ?? 'Dias úteis'

const valorGrande = (valor) => {
  const [inteiro, decimal] = numero(valor).split(',')
  return `<span class="cur">R$</span><span class="int">${inteiro}</span><span class="dec">,${decimal}</span>`
}

const valorPercentualGrande = (valor) =>
  `<span class="int">${numero(valor)}</span><span class="dec">%</span>`

const brlCurto = (valor) => {
  const n = Number(valor) || 0
  if (n >= 1_000_000) return `${numero(n / 1_000_000, 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return numero(n, 0)
}

const brlEixo = (valor) => brlCurto(Math.round((Number(valor) || 0) / 5_000) * 5_000)

const dataDeHoje = () => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())

function valorOuNulo(valor) {
  const texto = String(valor ?? '').trim()
  return texto ? texto : null
}

function lerPreferencia(chave) {
  try {
    return localStorage.getItem(`frete-liquido:${chave}`)
  } catch {
    return null
  }
}

function gravarPreferencia(chave, valor) {
  try {
    localStorage.setItem(`frete-liquido:${chave}`, valor)
  } catch {
    /* armazenamento indisponível: a interface segue sem lembrar preferências */
  }
}

async function getJSON(url) {
  let resposta
  try {
    resposta = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('Não foi possível conectar ao servidor local. Verifique se o app está rodando em http://127.0.0.1:5180.')
  }
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = new Error(dados.erro || `O servidor respondeu HTTP ${resposta.status}.`)
    erro.campo = dados.campo
    throw erro
  }
  return dados
}

async function enviarJSON(url, corpo, metodo = 'POST') {
  let resposta
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor local. Verifique se o app está rodando em http://127.0.0.1:5180.')
  }
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = new Error(dados.erro || `O servidor respondeu HTTP ${resposta.status}.`)
    erro.campo = dados.campo
    throw erro
  }
  return dados
}

/* ------------------------------------------------------------------ */
/* Início                                                              */
/* ------------------------------------------------------------------ */

async function iniciar() {
  configurarEventos()
  try {
    const opcoes = await getJSON('/api/opcoes')
    estado.opcoes = opcoes
    preencherSelects()
    atualizarMotor()
  } catch (erro) {
    mostrarErroCalculo(
      `Não foi possível carregar as opções do simulador. ${erro.message} Se o servidor estiver no ar, recarregue a página.`,
    )
    return
  }

  try {
    const resposta = await getJSON('/api/perfis')
    estado.perfis = Array.isArray(resposta.perfis) ? resposta.perfis : []
  } catch {
    estado.perfis = []
  }
  renderizarPerfilOptions()

  const salvoId = lerPreferencia('perfil')
  const salvo = estado.perfis.find((perfil) => perfil.id === salvoId) ?? estado.perfis[0]
  if (salvo) {
    await carregarPerfilSalvo(salvo.id, { calcular: false })
  } else {
    preencherPadrao()
  }

  const pagina = location.hash.replace('#', '') || lerPreferencia('pagina') || 'calculadora'
  navegar(pagina, { inicial: true, push: false })
  await calcular()
}

function preencherSelects() {
  const opcoes = estado.opcoes

  $('#regime').innerHTML = opcoes.perfis
    .map((perfil) => `<option value="${esc(perfil.id)}">${esc(perfil.varianteRotulo)}</option>`)
    .join('')

  $('#mes').innerHTML = MESES.map(
    (nome, indice) => `<option value="${indice + 1}">${esc(nome)}</option>`,
  ).join('')

  $('#ano').innerHTML = (opcoes.anos ?? [])
    .map((item) => `<option value="${item.ano}">${item.ano}</option>`)
    .join('')

  $('#modoDias').innerHTML = (opcoes.modosDias ?? [])
    .map((modo) => `<option value="${esc(modo.id)}">${esc(rotuloModoDias(modo.id))}</option>`)
    .join('')

  const regioes = [...new Set((opcoes.ufs ?? []).map((uf) => uf.regiao))]
  const ufs = regioes
    .map(
      (regiao) => `<optgroup label="${esc(regiao)}">${(opcoes.ufs ?? [])
        .filter((uf) => uf.regiao === regiao)
        .map((uf) => `<option value="${esc(uf.sigla)}">${esc(uf.sigla)} — ${esc(uf.nome)}</option>`)
        .join('')}</optgroup>`,
    )
    .join('')
  $('#ufOrigem').innerHTML = ufs
  $('#ufDestino').innerHTML = ufs

  $('#regimePagadora').innerHTML = (opcoes.regimesPagadora ?? [])
    .map((regime) => `<option value="${esc(regime.id)}">${esc(regime.rotulo)}</option>`)
    .join('')

  $('#tipoVeiculo').innerHTML = [
    '<option value="">Não informado</option>',
    ...(opcoes.tiposVeiculo ?? []).map(
      (tipo) => `<option value="${esc(tipo.id)}">${esc(tipo.rotulo)} · base ${brl(tipo.base)}</option>`,
    ),
  ].join('')

  $('#mes').value = '11'
  $('#ano').value = '2026'
  $('#modoDias').value = 'UTEIS'
  $('#regime').value = 'REGIME_REGULAR'
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
  $('#regimePagadora').value = 'NAO_CUMULATIVO'
  $('#tipoVeiculo').value = 'CARRETA'
  $('#diaria').value = '3.500,00'

  atualizarCampos()
}

function renderizarPerfilOptions() {
  $('#perfilSalvo').innerHTML = [
    '<option value="">Novo cenário</option>',
    ...estado.perfis.map((perfil) => `<option value="${esc(perfil.id)}">${esc(perfil.nome)}</option>`),
  ].join('')
  $('#perfilSalvo').value = estado.perfilSalvoId ?? ''
}

async function carregarPerfilSalvo(id, { calcular: deveCalcular = true } = {}) {
  const perfil = estado.perfis.find((item) => item.id === id)
  if (!perfil) return

  estado.perfilSalvoId = perfil.id
  estado.sujo = false
  $('#perfilSalvo').value = perfil.id
  $('#diaria').value = numero(perfil.diaria)
  $('#regime').value = perfil.perfil
  $('#modoDias').value = perfil.modoDias
  $('#diasFixo').value = String(perfil.diasFixos ?? 22)
  $('#ufOrigem').value = perfil.ufOrigem
  $('#ufDestino').value = perfil.ufDestino
  $('#tipoVeiculo').value = perfil.tipoVeiculo ?? ''
  $('#aliquotaCbs').value =
    perfil.aliquotaCbs === null || perfil.aliquotaCbs === undefined ? '' : numero(perfil.aliquotaCbs, 4)
  $('#aliquotaIbs').value =
    perfil.aliquotaIbs === null || perfil.aliquotaIbs === undefined ? '' : numero(perfil.aliquotaIbs, 4)
  $('#dasTotal').value =
    perfil.dasTotal === null || perfil.dasTotal === undefined ? '' : numero(perfil.dasTotal)
  $('#nomeCenario').value = perfil.nome
  const operacao = perfil.tipoOperacao ?? 'B2B'
  $$('input[name="operacao"]').forEach((radio) => {
    radio.checked = radio.value === operacao
  })

  atualizarCampos()
  atualizarStatus()
  gravarPreferencia('perfil', perfil.id)

  if (deveCalcular) await calcular()
}

function preencherPadrao() {
  estado.perfilSalvoId = null
  estado.sujo = false
  $('#perfilSalvo').value = ''
  $('#diaria').value = '3.500,00'
  $('#regime').value = 'REGIME_REGULAR'
  $('#modoDias').value = 'UTEIS'
  $('#diasFixo').value = '22'
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
  $('#tipoVeiculo').value = 'CARRETA'
  $('#aliquotaCbs').value = ''
  $('#aliquotaIbs').value = ''
  $('#dasTotal').value = ''
  $('#nomeCenario').value = ''
  $$('input[name="operacao"]').forEach((radio) => {
    radio.checked = radio.value === 'B2B'
  })
  atualizarCampos()
  atualizarStatus()
}

function novoCenario() {
  estado.perfilSalvoId = null
  estado.sujo = false
  $('#perfilSalvo').value = ''
  $('#nomeCenario').value = ''
  $('#diaria').value = '3.500,00'
  $('#regime').value = 'REGIME_REGULAR'
  $('#modoDias').value = 'UTEIS'
  $('#diasFixo').value = '22'
  $('#ufOrigem').value = 'SP'
  $('#ufDestino').value = 'BA'
  $('#tipoVeiculo').value = 'CARRETA'
  $('#aliquotaCbs').value = ''
  $('#aliquotaIbs').value = ''
  $('#dasTotal').value = ''
  $$('input[name="operacao"]').forEach((radio) => {
    radio.checked = radio.value === 'B2B'
  })
  atualizarCampos()
  atualizarStatus()
  $('#perfilSalvo').focus()
}

/* ------------------------------------------------------------------ */
/* Formulário                                                          */
/* ------------------------------------------------------------------ */

function lerFormulario() {
  const regime = $('#regime').value
  const simples = regime === 'SIMPLES_DAS'
  const operacao = $('input[name="operacao"]:checked')?.value ?? 'B2B'
  const perfil = {
    nome: $('#nomeCenario').value.trim() || 'Cenário atual',
    diaria: numeroDeTexto($('#diaria').value),
    ufOrigem: $('#ufOrigem').value,
    ufDestino: $('#ufDestino').value,
    perfil: regime,
    tipoVeiculo: valorOuNulo($('#tipoVeiculo').value),
    modoDias: $('#modoDias').value,
    diasFixo: Number($('#diasFixo').value) || 22,
    aliquotaCbs: simples ? valorOuNulo($('#aliquotaCbs').value) : null,
    aliquotaIbs: simples ? valorOuNulo($('#aliquotaIbs').value) : null,
    dasTotal: simples ? valorOuNulo($('#dasTotal').value) : null,
    tipoOperacao: operacao,
  }
  return {
    perfil,
    ano: Number($('#ano').value) || 2026,
    mes: Number($('#mes').value) || 11,
    regimePagadora: $('#regimePagadora').value,
    tipoOperacao: operacao,
  }
}

function validarEntrada(entrada) {
  const diaria = entrada.perfil.diaria
  if (!Number.isFinite(diaria) || diaria <= 0) {
    mostrarFormErro('Informe a diária em reais, maior que zero.', 'diaria')
    return false
  }
  if (entrada.perfil.perfil === 'SIMPLES_DAS') {
    const cbs = String($('#aliquotaCbs').value ?? '').trim()
    const ibs = String($('#aliquotaIbs').value ?? '').trim()
    if (Boolean(cbs) !== Boolean(ibs)) {
      mostrarFormErro('Informe as duas alíquotas efetivas do PGDAS (CBS e IBS) ou deixe as duas em branco.', 'aliquotaCbs')
      return false
    }
  }
  esconderFormErro()
  return true
}

function atualizarCampos() {
  const modo = $('#modoDias').value
  const regime = $('#regime').value
  $('#diasFixoWrap').hidden = modo !== 'FIXO'
  $('#simplesCampos').hidden = regime !== 'SIMPLES_DAS'

  const tipo = (estado.opcoes?.tiposVeiculo ?? []).find((item) => item.id === $('#tipoVeiculo').value)
  $('#tipoVeiculoHint').textContent = tipo
    ? `Referência para ${tipo.rotulo}: ${brl(tipo.min)} a ${brl(tipo.max)} por dia. Derivada do piso ANTT; não é cotação de mercado.`
    : 'Referência de diária derivada do piso ANTT; não é cotação de mercado.'

  atualizarPremResumo()
}

function atualizarPremResumo() {
  const regime = (estado.opcoes?.perfis ?? []).find((perfil) => perfil.id === $('#regime').value)
  const operacao = $('input[name="operacao"]:checked')?.value ?? 'B2B'
  const rota = `${$('#ufOrigem').value} → ${$('#ufDestino').value}`
  $('#premResumo').textContent = `${regime?.curto ?? 'Regime'} · ${operacao} · ${rota}`
}

function atualizarStatus() {
  const status = estado.sujo ? 'alterado' : estado.perfilSalvoId ? 'salvo' : 'novo'
  $('#formStatus').textContent = status
  $('#excluirCenario').hidden = !estado.perfilSalvoId
  $('#perfilSalvo').value = estado.perfilSalvoId ?? ''
}

function marcarSujo() {
  if (!estado.opcoes) return
  estado.sujo = true
  $('#formStatus').textContent = 'alterado'
  esconderFormErro()
}

function mostrarFormErro(mensagem, campo) {
  const alvo = $('#formErro')
  alvo.innerHTML = `<strong>${esc(mensagem)}</strong>`
  alvo.hidden = false
  const mapa = {
    diaria: '#diaria',
    aliquotaCbs: '#aliquotaCbs',
    aliquotaIbs: '#aliquotaIbs',
    nome: '#nomeCenario',
    ufOrigem: '#ufOrigem',
    ufDestino: '#ufDestino',
    perfil: '#regime',
    modoDias: '#modoDias',
  }
  const elemento = campo ? $(mapa[campo] ?? '') : null
  if (elemento) {
    if (elemento.closest('details')) elemento.closest('details').open = true
    elemento.focus()
  }
}

function esconderFormErro() {
  $('#formErro').hidden = true
  $('#formErro').textContent = ''
}

function mostrarErroCalculo(mensagem) {
  const alvo = $('#calcErro')
  alvo.innerHTML = `<div><strong>Não foi possível calcular.</strong><p>${esc(mensagem)}</p></div>`
  alvo.hidden = false
}

function esconderErroCalculo() {
  $('#calcErro').hidden = true
  $('#calcErro').innerHTML = ''
}

function definirCalculando(ativo) {
  const botao = $('#calcular')
  botao.disabled = ativo
  botao.textContent = ativo ? 'Calculando…' : 'Calcular custo líquido'
  $('#page-calculadora').setAttribute('aria-busy', String(ativo))
}

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

async function calcular() {
  if (!estado.opcoes) return
  const entrada = lerFormulario()
  if (!validarEntrada(entrada)) return

  const seq = ++estado.seq
  definirCalculando(true)
  esconderErroCalculo()

  try {
    const detalhe = await enviarJSON('/api/perfis/calcular', entrada)
    if (seq !== estado.seq) return
    estado.detalhe = detalhe
    estado.comparador = null
    estado.comparadorChave = null
    estado.simulacao = null
    estado.memoriaChave = null

    if (detalhe.fonte?.baseDados) {
      estado.opcoes.motor.baseDados = detalhe.fonte.baseDados
      estado.opcoes.motor.online = true
    }
    atualizarMotor()
    renderizarCalculadora()
    renderizarHorizonte()

    if (estado.pagina === 'comparador') await carregarComparador()
    if (estado.pagina === 'memoria') {
      renderizarMemoria()
      await carregarMemoria()
    }
  } catch (erro) {
    if (seq !== estado.seq) return
    mostrarErroCalculo(erro.message)
  } finally {
    if (seq === estado.seq) definirCalculando(false)
  }
}

function renderizarCalculadora() {
  const dados = estado.detalhe
  if (!dados) return
  const mes = dados.meses.find((item) => item.mes === dados.contexto.mesReferencia) ?? dados.meses[0]
  if (!mes) return
  const ano = dados.contexto.anoReferencia
  const rota = dados.perfil.rota
  const regime = dados.perfil.perfilCurto
  const operacao = dados.contexto.tipoOperacao
  const base = dados.fonte?.baseDados ?? estado.opcoes?.motor?.baseDados ?? '—'

  $('#heroLabel').textContent = `Custo líquido · ${mes.nome.toLowerCase()} de ${ano}`
  $('#heroValue').innerHTML = valorGrande(mes.liquido)
  $('#heroMeta').innerHTML =
    `<span><b>${mes.dias} ${rotuloDias(dados.perfil.modoDias)}</b></span>` +
    `<span><b>${brl(dados.perfil.diaria)}</b> por dia</span>` +
    `<span>${esc(rota)}</span>`

  const liquidoPct = mes.bruto > 0 ? (mes.liquido / mes.bruto) * 100 : 0
  const creditoPct = mes.bruto > 0 ? (mes.credito / mes.bruto) * 100 : 0
  $('#compBruto').textContent = `Bruto ${brl(mes.bruto)}`
  $('#compCredito').textContent = `Crédito ${pct(mes.percentualCredito)}`
  $('#compNet').style.width = `${Math.max(0, Math.min(100, liquidoPct))}%`
  $('#compCredit').style.width = `${Math.max(0, Math.min(100, creditoPct))}%`

  const composicao = mes.composicao ?? { icms: 0, pisCofins: 0, cbsIbs: 0 }
  const taxaDeCredito = (valor) => (mes.bruto > 0 ? (valor / mes.bruto) * 100 : 0)
  $('#breakdown').innerHTML = `
    <div><dt>ICMS${composicao.icms > 0 ? ` · ${pct(taxaDeCredito(composicao.icms))}` : ''}</dt><dd>${brl(composicao.icms)}</dd></div>
    <div><dt>PIS/COFINS${composicao.pisCofins > 0 ? ` · ${pct(taxaDeCredito(composicao.pisCofins))}` : ''}</dt><dd>${brl(composicao.pisCofins)}</dd></div>
    <div><dt>CBS/IBS${composicao.cbsIbs > 0 ? ` · ${pct(taxaDeCredito(composicao.cbsIbs))}` : ''}</dt><dd>${brl(composicao.cbsIbs)}</dd></div>
    <div class="total"><dt>Crédito</dt><dd>${brl(mes.credito)}</dd></div>`

  const maxBruto = Math.max(...dados.meses.map((item) => item.bruto), 1)
  const escala = maxBruto
  $('#chartNote').textContent = `${ano} · a diferença entre as barras é o crédito`
  $('#chartPlot').innerHTML = dados.meses
    .map((item) => {
      const alturaBruto = Math.max(0.5, (item.bruto / escala) * 100)
      const alturaLiquido = item.bruto > 0 ? (item.liquido / item.bruto) * 100 : 0
      const atual = item.mes === mes.mes
      return `<div class="bar${atual ? ' is-current' : ''}" title="${esc(item.nome)}: bruto ${brl(item.bruto)} · líquido ${brl(item.liquido)}">
        <div class="bar-track" style="height:${alturaBruto}%"><div class="bar-fill" style="height:${alturaLiquido}%"></div></div>
        <span class="bar-label">${esc(item.curto)}</span>
      </div>`
    })
    .join('')
  $('#chartAxis').innerHTML = [escala, escala * 0.75, escala * 0.5, escala * 0.25, 0]
    .map((valor) => `<span>${brlEixo(valor)}</span>`)
    .join('')
  $('#chartMensal').setAttribute(
    'aria-label',
    `Gráfico de barras do frete bruto e líquido em ${ano}. ${mes.nome}: bruto de ${brl(mes.bruto)} e líquido de ${brl(mes.liquido)}.`,
  )

  const percentual = mes.percentualCredito
  $('#chartInsight').innerHTML =
    percentual > 0
      ? `A cada R$ 100 de frete, <b>R$ ${numero(percentual)}</b> voltam como crédito. O líquido fica em <b>R$ ${numero(100 - percentual)}</b>.`
      : operacao === 'B2C'
        ? 'Operação B2C: o pagador é o consumidor final e não aproveita crédito.'
        : 'Neste cenário não há crédito: o líquido é o frete bruto.'

  $('#premResumo').textContent = `${regime} · ${operacao} · ${rota}`
  $('#formNote').textContent = `LC 214/2025 · motor ${estado.opcoes?.motor?.versao || 'oficial'} · base ${base}`

  $('#sideCenarioNome').textContent = dados.perfil.nome || 'Cenário atual'
  $('#sideCenarioMeta').innerHTML = `${esc(rota)} · ${mes.curto} ${ano}<br>${esc(regime)} · ${esc(operacao)}`
  $('#mobileDate').textContent = `${mes.curto} ${ano}`

  $('#footerCalc').textContent = `LC 214/2025 · motor oficial · base ${base}`
  $('#footerData').textContent = `Atualizado em ${dataDeHoje()}`
  $('#hFooterData').textContent = `Atualizado em ${dataDeHoje()}`
  $('#compFooterData').textContent = `Atualizado em ${dataDeHoje()}`
  $('#memFooterData').textContent = `Base ${base} · motor ${estado.opcoes?.motor?.versao || 'oficial'}`

  atualizarStatus()
}

/* ------------------------------------------------------------------ */
/* Horizonte                                                           */
/* ------------------------------------------------------------------ */

function renderizarHorizonte() {
  const dados = estado.detalhe
  if (!dados || !dados.anos?.length) return
  const anos = dados.anos
  const achar = (ano) => anos.find((item) => item.ano === ano) ?? anos[0]
  const inicio = achar(2026)
  const cheio = achar(2033)
  const marcos = [achar(2026), achar(2027), achar(2029), achar(2033)]

  $('#hValue').innerHTML = valorPercentualGrande(cheio.percentualCredito)
  $('#hKicker').textContent = `De ${pct(inicio.percentualCredito)} para ${pct(cheio.percentualCredito)}`
  const delta = cheio.percentualCredito - inicio.percentualCredito
  $('#hDelta').textContent = `${delta >= 0 ? '+' : '−'}${numero(Math.abs(delta))} p.p. até o regime pleno`
  $('#hNote').textContent =
    delta >= 0
      ? 'O crédito efetivo cresce a cada marco. O custo líquido depende de como o frete acompanha essa transição.'
      : 'O crédito efetivo cai neste regime. O custo líquido depende de como o frete acompanha essa transição.'

  const maximo = Math.max(5, Math.ceil(Math.max(...marcos.map((item) => item.percentualCredito), 1) / 5) * 5)
  const posicoes = [6, 18, 44, 90]
  $('#hAxis').innerHTML = [maximo, Math.round((maximo * 2) / 3), Math.round(maximo / 3), 0]
    .map((valor) => `<span>${valor}%</span>`)
    .join('')
    .replace('<span>0%</span>', '<span>0</span>')
  $('#hPlot').innerHTML = marcos
    .map((item, indice) => {
      const altura = Math.max(1, Math.round((item.percentualCredito / maximo) * 240))
      const classe = item.ano === 2026 ? ' start' : item.ano === 2033 ? ' final' : ''
      return `<div class="rate-bar${classe}" style="left:${posicoes[indice]}%;height:${altura}px"><span class="val">${pct(item.percentualCredito)}</span><span class="yr">${item.ano}</span></div>`
    })
    .join('')
  $('#hRate').setAttribute(
    'aria-label',
    `Crédito efetivo por marco: ${marcos.map((item) => `${pct(item.percentualCredito)} em ${item.ano}`).join(', ')}.`,
  )

  const por100 = (item) => 100_000 - item.percentualCredito * 1_000
  const base100 = por100(inicio)
  $('#hTable tbody').innerHTML = marcos
    .map((item) => {
      const liquido = por100(item)
      const variacao = liquido - base100
      const texto =
        item.ano === 2026
          ? '—'
          : variacao > 0.004
            ? `+ ${brl(variacao)}`
            : variacao < -0.004
              ? `− ${brl(Math.abs(variacao))}`
              : '= 2026'
      return `<tr class="${item.ano === 2033 ? 'final' : ''}">
        <th scope="row">${item.ano}</th>
        <td>${pct(item.percentualCredito)}</td>
        <td>${brl(liquido)}</td>
        <td>${texto}</td>
      </tr>`
    })
    .join('')

  const diferenca = base100 - por100(cheio)
  const sentido = diferenca > 0.004 ? 'cai' : diferenca < -0.004 ? 'sobe' : 'fica estável'
  const valorDiferenca = diferenca > 0.004 ? brl(diferenca) : diferenca < -0.004 ? brl(Math.abs(diferenca)) : ''
  $('#hInsight').innerHTML =
    diferenca === 0
      ? `O custo líquido <b>fica estável</b> a cada R$ 100 mil de frete entre 2026 e 2033.`
      : `O custo líquido <b>${sentido} ${valorDiferenca}</b> a cada R$ 100 mil de frete entre 2026 e 2033 — mas o custo absoluto só melhora se o valor do frete não subir na mesma proporção.`
  $('#hFooterData').textContent = `Atualizado em ${dataDeHoje()}`
}

/* ------------------------------------------------------------------ */
/* Comparador                                                          */
/* ------------------------------------------------------------------ */

const CARREGADORES = [
  { nome: 'Carreta dedicada', diaria: 3500, perfil: 'REGIME_REGULAR', aliquotaCbs: null, aliquotaIbs: null },
  { nome: 'Carreta híbrida', diaria: 3280, perfil: 'SIMPLES_HIBRIDO', aliquotaCbs: null, aliquotaIbs: null },
  { nome: 'Carreta parceira', diaria: 3300, perfil: 'SIMPLES_DAS', aliquotaCbs: '2.3591', aliquotaIbs: '0.0260' },
]

function dadosComparador() {
  const dados = estado.detalhe
  if (!dados) return null
  const ano = dados.contexto.anoReferencia
  const dias = dados.anos.find((item) => item.ano === ano)?.dias ?? 253
  return {
    ano,
    dias,
    transportadoras: CARREGADORES.map((item) => ({
      nome: item.nome,
      diaria: item.diaria,
      perfil: item.perfil,
      aliquotaCbs: item.perfil === 'SIMPLES_DAS' ? item.aliquotaCbs : undefined,
      aliquotaIbs: item.perfil === 'SIMPLES_DAS' ? item.aliquotaIbs : undefined,
      atividade: item.perfil === 'SIMPLES_DAS' ? '05' : undefined,
      preco: item.diaria * dias,
    })),
    tipoOperacao: dados.contexto.tipoOperacao,
    regimePagadora: dados.contexto.regimePagadora.id,
    ufOrigem: dados.perfil.ufOrigem,
    ufDestino: dados.perfil.ufDestino,
    rota: dados.perfil.rota,
  }
}

async function carregarComparador() {
  if (!estado.detalhe) return
  const cenario = dadosComparador()
  if (!cenario) return
  const chave = JSON.stringify(cenario)
  if (estado.comparadorChave === chave && estado.comparador) {
    renderizarComparador()
    return
  }

  const seq = ++estado.comparadorSeq
  const alvo = $('#comparadorList')
  alvo.innerHTML = '<div class="loading-block">Comparando os três regimes no mesmo trecho…</div>'
  $('#compInsight').textContent = 'Calculando o ranking pelo custo líquido…'
  $('#compFooter').textContent = `${cenario.dias} dias faturáveis em ${cenario.ano} · ${cenario.rota} · ${cenario.tipoOperacao}`

  try {
    const dados = await enviarJSON('/api/comparar', {
      transportadoras: cenario.transportadoras.map((item) => ({
        nome: item.nome,
        preco: item.preco,
        perfil: item.perfil,
        aliquotaCbs: item.aliquotaCbs,
        aliquotaIbs: item.aliquotaIbs,
        atividade: item.atividade,
      })),
      ano: cenario.ano,
      tipoOperacao: cenario.tipoOperacao,
      regimePagadora: cenario.regimePagadora,
      ufOrigem: cenario.ufOrigem,
      ufDestino: cenario.ufDestino,
    })
    if (seq !== estado.comparadorSeq) return
    estado.comparador = { ...dados, cenario }
    estado.comparadorChave = chave
    renderizarComparador()
  } catch (erro) {
    if (seq !== estado.comparadorSeq) return
    alvo.innerHTML = `<div class="callout callout--erro"><div><strong>Não foi possível comparar.</strong><p>${esc(erro.message)}</p></div></div>`
    $('#compInsight').textContent = 'O comparativo depende do motor oficial.'
  }
}

function renderizarComparador() {
  const dados = estado.comparador
  if (!dados) return
  const { ranking, cenario } = dados
  if (!ranking?.length) return
  const maxBruto = Math.max(...ranking.map((item) => item.valorFrete), 1)
  const melhor = ranking[0]

  $('#comparadorList').innerHTML = ranking
    .map((item, indice) => {
      const carrier = cenario.transportadoras.find((carga) => carga.nome === item.nome) ?? cenario.transportadoras[indice]
      const trilho = Math.max(0, Math.min(100, (item.valorFrete / maxBruto) * 100))
      const preenchimento = item.valorFrete > 0 ? Math.max(0, Math.min(100, (item.custoTotal / item.valorFrete) * 100)) : 0
      const delta =
        indice === 0
          ? 'referência'
          : item.diferencaParaMelhor <= 0.004
            ? '= melhor'
            : `+${brl(item.diferencaParaMelhor)} · +${pct((item.diferencaParaMelhor / melhor.custoTotal) * 100, 1)}`
      const credito =
        item.percentualCreditoTotal > 0
          ? `crédito ${pct(item.percentualCreditoTotal)}`
          : 'sem crédito no ano'
      return `<article class="comp-row${indice === 0 ? ' is-best' : ''}">
        <div class="comp-id">
          <div class="comp-name">${esc(item.nome)}</div>
          <div class="comp-sub">${esc(item.perfil.curto)} · ${brl(carrier?.diaria ?? item.valorFrete / cenario.dias)}/dia · ${esc(credito)}</div>
          ${indice === 0 ? '<span class="best">Melhor líquido</span>' : ''}
        </div>
        <div class="net-bar" aria-hidden="true">
          <div class="net-track" style="width:${trilho}%"><div class="net-fill" style="width:${preenchimento}%"></div></div>
        </div>
        <div class="comp-net">
          <div class="comp-net-value">${brl(item.custoTotal)}</div>
          <div class="comp-delta">${delta}</div>
        </div>
      </article>`
    })
    .join('')

  const menorBruto = [...ranking].sort((a, b) => a.valorFrete - b.valorFrete)[0]
  if (menorBruto && menorBruto.nome !== melhor.nome) {
    const brutoDiferenca = melhor.valorFrete - menorBruto.valorFrete
    const liquidoDiferenca = menorBruto.custoTotal - melhor.custoTotal
    $('#compInsight').innerHTML =
      `A diária mais barata (<b>${esc(menorBruto.nome)}</b>) economiza <b>${brl(brutoDiferenca)}</b> no bruto do ano, mas custa <b>${brl(liquidoDiferenca)}</b> a mais no líquido.`
  } else {
    $('#compInsight').innerHTML = `<b>${esc(melhor.nome)}</b> tem o menor bruto e o menor líquido neste cenário.`
  }

  $('#compFooter').textContent = `${cenario.dias} dias faturáveis em ${cenario.ano} · ${cenario.rota} · ${cenario.tipoOperacao}`
  $('#compFooterData').textContent = `Atualizado em ${dataDeHoje()}`
}

/* ------------------------------------------------------------------ */
/* Memória                                                             */
/* ------------------------------------------------------------------ */

function mesSelecionado() {
  const dados = estado.detalhe
  if (!dados) return null
  return dados.meses.find((item) => item.mes === dados.contexto.mesReferencia) ?? dados.meses[0] ?? null
}

function renderizarMemoria() {
  const dados = estado.detalhe
  const mes = mesSelecionado()
  if (!dados || !mes) return
  const ano = dados.contexto.anoReferencia
  const composicao = mes.composicao ?? { icms: 0, pisCofins: 0, cbsIbs: 0 }
  const taxas = dados.carga?.percentuais ?? { icms: 0, pisCofins: 0, cbsIbs: 0 }
  const base = dados.fonte?.baseDados ?? estado.opcoes?.motor?.baseDados ?? '—'
  const regimeId = dados.perfil.perfil
  const simples = regimeId === 'SIMPLES_DAS' || regimeId === 'SIMPLES_HIBRIDO'
  const auto = regimeId === 'AUTONOMO_MEI'
  const estimado = auto || (regimeId === 'SIMPLES_DAS' && (!dados.perfil.aliquotaCbs || !dados.perfil.aliquotaIbs))
  const taxaDe = (valor) => (mes.bruto > 0 ? (valor / mes.bruto) * 100 : 0)
  const teste = ano === 2026 && composicao.cbsIbs <= 0 ? (mes.bruto * taxas.cbsIbs) / 100 : 0

  const linhasCredito = []
  if (regimeId === 'REGIME_REGULAR') {
    if (composicao.icms > 0) {
      linhasCredito.push(
        `<div class="rec-line"><dt>ICMS <span class="tax-rate">${pct(taxaDe(composicao.icms))}</span></dt><dd>${brl(composicao.icms)}</dd></div>`,
      )
    }
    if (composicao.pisCofins > 0) {
      linhasCredito.push(
        `<div class="rec-line"><dt>PIS/COFINS <span class="tax-rate">${pct(taxaDe(composicao.pisCofins))}</span></dt><dd>${brl(composicao.pisCofins)}</dd></div>`,
      )
    }
  }
  if (composicao.cbsIbs > 0) {
    if (estimado) {
      linhasCredito.push(
        `<div class="rec-line"><dt>Crédito estimado <span class="tax-rate">${pct(mes.percentualCredito)}</span></dt><dd>${brl(mes.credito)}</dd></div>`,
      )
    } else {
      linhasCredito.push(
        `<div class="rec-line"><dt>CBS/IBS <span class="tax-rate">${pct(taxaDe(composicao.cbsIbs))}</span></dt><dd>${brl(composicao.cbsIbs)}</dd></div>`,
      )
    }
  }
  if (!linhasCredito.length) {
    linhasCredito.push(
      `<div class="rec-line rec-info"><dt>Sem crédito neste ano</dt><dd>${brl(0)}</dd></div>`,
    )
  }

  $('#memReceipt').innerHTML = `
    <div class="receipt-head">
      <div>
        <div class="receipt-title" id="memReceiptTitle">${esc(mes.nome)} de ${ano}</div>
        <div class="receipt-sub">${mes.dias} ${rotuloDias(dados.perfil.modoDias)} · ${brl(dados.perfil.diaria)}/dia</div>
      </div>
      <span class="receipt-tag">Recibo</span>
    </div>

    <dl class="rec-body">
      <div class="rec-line rec-gross"><dt>Faturamento bruto</dt><dd>${brl(mes.bruto)}</dd></div>
    </dl>

    <p class="rec-label">${estimado ? 'Crédito estimado' : 'Crédito recuperável'}</p>
    <dl class="rec-body">
      ${linhasCredito.join('')}
      <div class="rec-line rec-subtotal"><dt>Crédito</dt><dd>${brl(mes.credito)}</dd></div>
    </dl>

    ${
      teste > 0
        ? `<p class="rec-label">Fase de teste · sem crédito</p>
          <dl class="rec-body">
            <div class="rec-line rec-info"><dt>CBS/IBS <span class="tax-rate">${pct(taxas.cbsIbs)}</span></dt><dd>${brl(teste)}</dd></div>
          </dl>`
        : ''
    }

    <dl class="rec-total"><dt>Custo líquido</dt><dd>${brl(mes.liquido)}</dd></dl>
    <p class="rec-note">${
      mes.credito > 0
        ? `Crédito de ${pct(mes.percentualCredito)} sobre o faturamento bruto.`
        : 'Sem crédito recuperável neste mês.'
    }</p>`

  const alerta =
    dados.contexto.tipoOperacao === 'B2C'
      ? 'Operação B2C: o pagador é o consumidor final; o crédito é zero e o custo é o preço cheio.'
      : simples
        ? `No Simples, ICMS e PIS/COFINS ficam no DAS e não geram crédito ao pagador.${ano === 2026 ? ' O CBS/IBS de 2026 é fase de teste e também não é creditado.' : ''}${estimado ? ' O crédito exibido é a faixa setorial estimada; informe as alíquotas do PGDAS para o cálculo real.' : ''}`
        : auto
          ? ano === 2026
            ? 'Autônomo/MEI: em 2026 não há crédito de CBS/IBS; a estimativa setorial aparece a partir de 2027.'
            : 'Autônomo/MEI: o crédito exibido é uma estimativa setorial, não o destaque cheio do regime regular.'
          : ano === 2026
            ? 'CBS e IBS de 2026 estão em fase de teste e não entram no crédito nem no custo líquido.'
            : 'Cálculo apoiado na LC 214/2025; a apuração é do motor oficial, não desta interface.'

  $('#memPremises').innerHTML = `
    <h2 class="prem-title" id="memPremTitle">Premissas</h2>
    <dl class="prem-list">
      <div class="premise-line"><dt>Competência</dt><dd>${esc(mes.nome)} de ${ano}</dd></div>
      <div class="premise-line"><dt>Dias</dt><dd>${mes.dias} ${rotuloDias(dados.perfil.modoDias)}</dd></div>
      <div class="premise-line"><dt>Diária</dt><dd>${brl(dados.perfil.diaria)}</dd></div>
      <div class="premise-line"><dt>Rota</dt><dd>${esc(dados.perfil.rota)}</dd></div>
      <div class="premise-line"><dt>Regime</dt><dd>${esc(dados.perfil.perfilCurto)}</dd></div>
      <div class="premise-line"><dt>Operação</dt><dd>${esc(dados.contexto.tipoOperacao)}</dd></div>
      <div class="premise-line"><dt>Pagadora</dt><dd>${esc(dados.contexto.regimePagadora.curto)}</dd></div>
    </dl>
    <div class="mem-alert"><span class="dot" aria-hidden="true"></span><p>${esc(alerta)}</p></div>
    <p class="mem-base">Base ${esc(base)} · motor ${esc(estado.opcoes?.motor?.versao || 'oficial')} · LC 214/2025</p>`

  $('#memFooter').textContent = `Cálculo pela LC 214/2025 · ${mes.dias} ${rotuloDias(dados.perfil.modoDias)} em ${mes.nome.toLowerCase()} de ${ano}`
  $('#memFooterData').textContent = `Base ${base} · motor ${estado.opcoes?.motor?.versao || 'oficial'}`

  const chave = chaveMemoria()
  if (estado.simulacao && estado.memoriaChave === chave) {
    renderizarMotor()
  } else {
    $('#memMotorMeta').textContent = 'aguardando cálculo'
    $('#memSteps').innerHTML = ''
    $('#memJson').textContent = '—'
    $('#memMotorOrigem').textContent = '—'
  }
}

function chaveMemoria() {
  const dados = estado.detalhe
  const mes = mesSelecionado()
  if (!dados || !mes) return null
  return JSON.stringify({
    ano: dados.contexto.anoReferencia,
    mes: mes.mes,
    bruto: mes.bruto,
    perfil: dados.perfil.perfil,
    operacao: dados.contexto.tipoOperacao,
    regimePagadora: dados.contexto.regimePagadora.id,
    rota: dados.perfil.rota,
    aliquotaCbs: dados.perfil.aliquotaCbs,
    aliquotaIbs: dados.perfil.aliquotaIbs,
  })
}

async function carregarMemoria() {
  const dados = estado.detalhe
  const mes = mesSelecionado()
  if (!dados || !mes) return
  const chave = chaveMemoria()
  if (estado.memoriaChave === chave && estado.simulacao) {
    renderizarMotor()
    return
  }

  const seq = ++estado.memoriaSeq
  $('#memMotorMeta').textContent = 'consultando o motor…'
  $('#memSteps').innerHTML = '<div class="loading-block">Buscando a memória oficial…</div>'
  $('#memJson').textContent = '—'
  $('#memMotorOrigem').textContent = '—'

  const simples = dados.perfil.perfil === 'SIMPLES_DAS'
  const corpo = {
    valorFrete: mes.bruto,
    perfil: dados.perfil.perfil,
    regimePagadora: dados.contexto.regimePagadora.id,
    tipoOperacao: dados.contexto.tipoOperacao,
    ufOrigem: dados.perfil.ufOrigem,
    ufDestino: dados.perfil.ufDestino,
    ano: dados.contexto.anoReferencia,
    aliquotaCbs: simples ? dados.perfil.aliquotaCbs : undefined,
    aliquotaIbs: simples ? dados.perfil.aliquotaIbs : undefined,
    dasTotal: simples ? dados.perfil.dasTotal : undefined,
    atividade: simples ? '05' : undefined,
  }

  try {
    const simulacao = await enviarJSON('/api/simular', corpo)
    if (seq !== estado.memoriaSeq) return
    estado.simulacao = simulacao
    estado.memoriaChave = chave
    renderizarMotor()
  } catch (erro) {
    if (seq !== estado.memoriaSeq) return
    $('#memMotorMeta').textContent = 'indisponível'
    $('#memSteps').innerHTML = `<div class="callout callout--erro"><div><strong>Não foi possível abrir a memória do motor.</strong><p>${esc(erro.message)}</p></div></div>`
    $('#memJson').textContent = '—'
  }
}

function renderizarMotor() {
  const dados = estado.simulacao
  if (!dados) return
  const passos = dados.memoria ?? []
  $('#memSteps').innerHTML = passos
    .map(
      (passo) => `<div class="step${passo.destaque ? ' step--total' : ''}">
        <dt>${esc(passo.rotulo)}</dt>
        <dd>${esc(passo.valor)}</dd>
        <p>${esc(passo.nota)}</p>
      </div>`,
    )
    .join('')
  $('#memJson').textContent = JSON.stringify(dados.motor.resposta, null, 2)
  $('#memMotorMeta').textContent = `HTTP ${dados.motor.status} · API ${dados.motor.versao || '—'} · base ${dados.motor.baseDados ?? '—'}`
  $('#memMotorOrigem').textContent = `${dados.motor.nome ?? 'motor oficial'} · ${dados.entrada.rota} · ${dados.entrada.ano}`
  if (dados.motor.versao && dados.motor.fonte === 'regime-regular') {
    estado.opcoes.motor.versao = dados.motor.versao
    atualizarMotor()
  }
}

/* ------------------------------------------------------------------ */
/* Salvar, excluir, exportar                                           */
/* ------------------------------------------------------------------ */

async function salvarCenario() {
  const entrada = lerFormulario()
  const nome = String($('#nomeCenario').value ?? '').trim()
  if (nome.length < 2) {
    mostrarFormErro('Dê um nome ao cenário com pelo menos 2 caracteres.', 'nome')
    return
  }
  if (!validarEntrada(entrada)) return

  const botao = $('#salvarCenario')
  botao.disabled = true
  const anterior = botao.textContent
  botao.textContent = 'Salvando…'
  esconderFormErro()

  const corpo = {
    nome,
    diaria: entrada.perfil.diaria,
    ufOrigem: entrada.perfil.ufOrigem,
    ufDestino: entrada.perfil.ufDestino,
    perfil: entrada.perfil.perfil,
    tipoVeiculo: entrada.perfil.tipoVeiculo,
    modoDias: entrada.perfil.modoDias,
    diasFixo: entrada.perfil.diasFixo,
    aliquotaCbs: entrada.perfil.aliquotaCbs,
    aliquotaIbs: entrada.perfil.aliquotaIbs,
    dasTotal: entrada.perfil.dasTotal,
    tipoOperacao: entrada.perfil.tipoOperacao,
  }

  try {
    const resposta = estado.perfilSalvoId
      ? await enviarJSON(`/api/perfis/${encodeURIComponent(estado.perfilSalvoId)}`, corpo, 'PUT')
      : await enviarJSON('/api/perfis', corpo)
    const resumo = await getJSON('/api/perfis')
    estado.perfis = Array.isArray(resumo.perfis) ? resumo.perfis : []
    estado.perfilSalvoId = resposta.perfil?.id ?? estado.perfilSalvoId
    estado.sujo = false
    renderizarPerfilOptions()
    atualizarStatus()
    gravarPreferencia('perfil', estado.perfilSalvoId ?? '')
    await carregarPerfilSalvo(estado.perfilSalvoId, { calcular: false })
    await calcular()
  } catch (erro) {
    mostrarFormErro(erro.message, erro.campo)
  } finally {
    botao.disabled = false
    botao.textContent = anterior
  }
}

async function excluirCenario() {
  if (!estado.perfilSalvoId) return
  const perfil = estado.perfis.find((item) => item.id === estado.perfilSalvoId)
  if (!perfil) return
  if (!window.confirm(`Excluir o cenário “${perfil.nome}”? Esta ação não pode ser desfeita.`)) return

  try {
    await enviarJSON(`/api/perfis/${encodeURIComponent(perfil.id)}`, null, 'DELETE')
    const resposta = await getJSON('/api/perfis')
    estado.perfis = Array.isArray(resposta.perfis) ? resposta.perfis : []
    estado.perfilSalvoId = null
    renderizarPerfilOptions()
    const proximo = estado.perfis[0]
    if (proximo) {
      await carregarPerfilSalvo(proximo.id, { calcular: false })
      await calcular()
    } else {
      preencherPadrao()
      await calcular()
    }
  } catch (erro) {
    mostrarFormErro(erro.message)
  }
}

function exportar() {
  if (!estado.detalhe) {
    mostrarErroCalculo('Calcule um cenário antes de exportar.')
    return
  }
  const dados = {
    geradoEm: new Date().toISOString(),
    cenario: estado.detalhe,
    comparador: estado.comparador ?? null,
    memoria: estado.simulacao ?? null,
  }
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const mes = mesSelecionado()
  link.href = url
  link.download = `frete-liquido-${estado.detalhe.contexto.anoReferencia}-${String(mes?.mes ?? 1).padStart(2, '0')}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function copiarJson() {
  if (!estado.simulacao) {
    await carregarMemoria()
  }
  if (!estado.simulacao) return
  const texto = JSON.stringify(estado.simulacao.motor.resposta, null, 2)
  const botao = $('#copiarJson')
  const anterior = botao.textContent
  try {
    await navigator.clipboard.writeText(texto)
    botao.textContent = 'Copiado'
  } catch {
    botao.textContent = 'Selecione e copie'
  }
  setTimeout(() => {
    botao.textContent = anterior
  }, 2000)
}

/* ------------------------------------------------------------------ */
/* Motor e navegação                                                   */
/* ------------------------------------------------------------------ */

function atualizarMotor() {
  if (!estado.opcoes) return
  const regular = estado.opcoes.motor ?? {}
  const simples = estado.opcoes.motorSimples ?? {}
  const online = Boolean(regular.online) && Boolean(simples.online)
  $('#engineDot').classList.toggle('is-offline', !online)
  $('#engineVersion').textContent = `${regular.online ? regular.versao || 'online' : 'regular offline'} · ${simples.online ? simples.versao || 'Simples' : 'SN offline'}`
  $('#engineBase').textContent = `Base ${regular.baseDados ?? '—'} · ${online ? 'conectados' : 'verifique os motores'}`
}

function navegar(pagina, { inicial = false, push = true } = {}) {
  const alvo = PAGINAS[pagina] ? pagina : 'calculadora'
  estado.pagina = alvo

  $$('.page').forEach((secao) => {
    secao.hidden = secao.dataset.page !== alvo
  })
  $$('.nav-item[data-page-link], .m-tab[data-page-link]').forEach((link) => {
    const ativo = link.dataset.pageLink === alvo
    link.classList.toggle('is-active', ativo)
    if (ativo) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  $('#crumbPage').textContent = PAGINAS[alvo].titulo
  document.title = `Frete Líquido — ${PAGINAS[alvo].titulo}`
  gravarPreferencia('pagina', alvo)

  if (push && location.hash !== `#${alvo}`) {
    history.pushState(null, '', `#${alvo}`)
  }

  if (!inicial) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const titulo = $(`#page-${alvo} h1`)
    if (titulo) setTimeout(() => titulo.focus({ preventScroll: true }), 0)
  }

  if (alvo === 'comparador' && estado.detalhe) {
    carregarComparador()
  }
  if (alvo === 'memoria' && estado.detalhe) {
    renderizarMemoria()
    carregarMemoria()
  }
}

function configurarEventos() {
  document.addEventListener('click', (evento) => {
    const link = evento.target.closest('[data-page-link]')
    if (!link) return
    evento.preventDefault()
    navegar(link.dataset.pageLink)
  })

  window.addEventListener('popstate', () => {
    navegar(location.hash.replace('#', '') || 'calculadora', { push: false })
  })

  $('#formSimulacao').addEventListener('submit', (evento) => {
    evento.preventDefault()
    calcular()
  })

  $('#perfilSalvo').addEventListener('change', (evento) => {
    const id = evento.target.value
    if (id) carregarPerfilSalvo(id)
    else novoCenario()
  })

  $('#formSimulacao').addEventListener('input', (evento) => {
    if (evento.target.id === 'perfilSalvo') return
    marcarSujo()
  })
  $('#formSimulacao').addEventListener('change', (evento) => {
    if (evento.target.id === 'perfilSalvo') return
    atualizarCampos()
    marcarSujo()
  })

  $('#regime').addEventListener('change', () => {
    atualizarCampos()
  })
  $('#modoDias').addEventListener('change', () => {
    atualizarCampos()
  })
  $('#tipoVeiculo').addEventListener('change', () => {
    atualizarCampos()
  })

  $('#salvarCenario').addEventListener('click', salvarCenario)
  $('#novoCenario').addEventListener('click', novoCenario)
  $('#excluirCenario').addEventListener('click', excluirCenario)
  $('#exportar').addEventListener('click', exportar)
  $('#copiarJson').addEventListener('click', copiarJson)

  $('#memMotorDetalhe').addEventListener('toggle', () => {
    if ($('#memMotorDetalhe').open) carregarMemoria()
  })

  $('#editarCenario').addEventListener('click', () => {
    $('#premissasDetalhe').open = true
    setTimeout(() => $('#perfilSalvo').focus(), 60)
  })
}

iniciar()
