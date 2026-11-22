/* ==========================================================================
   Aba 2 · CT-e de hoje (novembro de 2026)
   Consome:
     GET  ../calculadora/frete/cte/parametros
     GET  ../calculadora/frete/cte/exemplo
     POST ../calculadora/frete/cte/pagamento
   ========================================================================== */

(function () {
  'use strict';

  const API = new URL('../calculadora/frete/cte/', window.location.href);
  const UI = window.SimuladorFrete;

  const estado = {
    exemplo: null,
    resultado: null,
    carregado: false,
    iniciado: false
  };

  const el = {
    form: document.getElementById('form-cte'),
    transportador: document.getElementById('cteTransportador'),
    regime: document.getElementById('cteRegimePagadora'),
    retIrrf: document.getElementById('cteRetIrrf'),
    retInss: document.getElementById('cteRetInss'),
    retSest: document.getElementById('cteRetSest'),
    pagamento: document.getElementById('ctePagamento'),
    btnCalcular: document.getElementById('btn-cte-calcular'),
    btnRestaurar: document.getElementById('btn-cte-restaurar'),
    status: document.getElementById('cte-status'),
    alerta: document.getElementById('cte-alerta'),
    identificacao: document.getElementById('cte-identificacao'),
    kpis: document.getElementById('cte-kpis'),
    componentes: document.getElementById('cte-componentes'),
    notaComposicao: document.getElementById('nota-cte-composicao'),
    tributos: document.getElementById('cte-tributos'),
    notaTributos: document.getElementById('nota-cte-tributos'),
    pagamentoTabela: document.getElementById('cte-pagamento'),
    notaPagamento: document.getElementById('nota-cte-pagamento'),
    comparativo: document.getElementById('cte-comparativo'),
    notaComparativo: document.getElementById('nota-cte-comparativo'),
    conferencias: document.getElementById('cte-conferencias'),
    premissas: document.getElementById('cte-premissas')
  };

  const ROTULO_SITUACAO = {
    OK: 'ok',
    ATENCAO: 'atencao',
    PENDENTE: 'pendente',
    MANUAL: 'manual',
    NAO_APLICAVEL: 'na'
  };

  const TEXTO_ORIGEM = {
    CALCULO: 'Calculado',
    CONTRATO: 'Contrato',
    INTEGRACAO: 'Integração'
  };

  const TEXTO_SITUACAO = {
    OK: 'Ok',
    ATENCAO: 'Atenção',
    PENDENTE: 'Pendente',
    MANUAL: 'Manual',
    NAO_APLICAVEL: 'Não se aplica'
  };

  const fmtData = new Intl.DateTimeFormat('pt-BR');

  function data(valor) {
    if (!valor) return '—';
    const partes = String(valor).split('-');
    if (partes.length !== 3) return valor;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function chaveFormatada(chave) {
    if (!chave) return '—';
    return String(chave).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function definirStatus(mensagem, erro) {
    el.status.textContent = mensagem || '';
    el.status.classList.toggle('is-erro', Boolean(erro));
  }

  function mostrarErro(mensagem) {
    el.alerta.textContent = mensagem;
    el.alerta.hidden = !mensagem;
  }

  /* -------------------------------------------------------------- carregamento */

  async function carregarParametros() {
    const resposta = await fetch(new URL('parametros', API));
    if (!resposta.ok) throw new Error('Não foi possível carregar as opções do CT-e.');
    return resposta.json();
  }

  async function carregarExemplo() {
    const resposta = await fetch(new URL('exemplo', API));
    if (!resposta.ok) throw new Error('Não foi possível carregar o exemplo de CT-e.');
    return resposta.json();
  }

  function preencherOpcoes(parametros) {
    el.transportador.innerHTML = (parametros.tiposTransportador || [])
      .map((o) => '<option value="' + UI.sanitizar(o.valor) + '">' + UI.sanitizar(o.rotulo) + '</option>')
      .join('');

    el.regime.innerHTML = (parametros.regimesPagadora || [])
      .map((o) => '<option value="' + UI.sanitizar(o.valor) + '">' + UI.sanitizar(o.rotulo) + '</option>')
      .join('');
  }

  function aplicarEntrada(entrada) {
    el.transportador.value = entrada.tipoTransportador || 'TDE';
    el.regime.value = entrada.regimePagadora || 'REGIME_REGULAR';
    el.retIrrf.checked = entrada.reterIrrf !== false;
    el.retInss.checked = Boolean(entrada.reterInss);
    el.retSest.checked = Boolean(entrada.reterSestSenat);
    el.pagamento.value = entrada.dataPagamento || '';
  }

  function entradaAtual() {
    const base = Object.assign({}, estado.exemplo.entrada);
    base.tipoTransportador = el.transportador.value;
    base.regimePagadora = el.regime.value;
    base.reterIrrf = el.retIrrf.checked;
    base.reterInss = el.retInss.checked;
    base.reterSestSenat = el.retSest.checked;
    base.dataPagamento = el.pagamento.value || null;
    return base;
  }

  /* ----------------------------------------------------------------- renderização */

  function renderDocumento(r) {
    const linhas = [
      ['CT-e', 'nº ' + (r.numeroCte || '—') + ' · série ' + (r.serie || '—')],
      ['Chave de acesso', chaveFormatada(r.chaveAcesso)],
      ['Emissão', data(r.dataEmissao) + ' · pagamento em ' + data(r.dataPagamento)],
      ['Transportador', (r.emitenteNome || '—') + (r.emitenteRntrc ? ' · RNTRC ' + r.emitenteRntrc : '')],
      ['Pagadora', r.tomadorNome || '—'],
      ['Rota', (r.rota || '—') + ' · ' + (r.tipoOperacao || '')],
      ['Serviço', (r.nbs || '—') + ' · ' + (r.descricaoNbs || '')]
    ];

    el.identificacao.innerHTML = '<dl>' + linhas.map(([rotulo, valor]) =>
      '<div><dt>' + UI.sanitizar(rotulo) + '</dt><dd>' + UI.sanitizar(valor) + '</dd></div>'
    ).join('') + '</dl>';
  }

  function renderKpis(r) {
    const cartoes = [
      {
        rotulo: 'Valor do CT-e',
        valor: UI.moeda(r.baseCalculo),
        meta: 'base de cálculo da prestação'
      },
      {
        rotulo: 'Carga tributária embutida',
        valor: UI.moeda(r.totalTributos),
        meta: UI.percentual(r.percentualTributos) + ' do documento',
        destaque: true
      },
      {
        rotulo: 'Crédito da pagadora',
        valor: UI.moeda(r.creditoTotal),
        meta: 'custo não recuperável: ' + UI.moeda(r.custoNaoRecuperavel)
      },
      {
        rotulo: 'Líquido ao transportador',
        valor: UI.moeda(r.liquidoTransportador),
        meta: 'desembolso total: ' + UI.moeda(r.desembolsoTotal)
      }
    ];

    el.kpis.innerHTML = cartoes.map((cartao) =>
      '<article class="kpi' + (cartao.destaque ? ' kpi--destaque' : '') + '">' +
      '<p class="kpi__label">' + UI.sanitizar(cartao.rotulo) + '</p>' +
      '<p class="kpi__valor">' + UI.sanitizar(cartao.valor) + '</p>' +
      '<p class="kpi__meta"><span>' + UI.sanitizar(cartao.meta) + '</span></p>' +
      '</article>'
    ).join('');
  }

  function renderComponentes(r) {
    const linhas = (r.componentes || []).map((c) =>
      '<tr>' +
      '<td>' + UI.sanitizar(c.descricao) + '<span class="celula__nota">' + UI.sanitizar(c.observacao || '') + '</span></td>' +
      '<td class="num">' + (Number(c.valor) < 0 ? '−' : '') + UI.moeda(Math.abs(Number(c.valor))) + '</td>' +
      '<td class="num">' + UI.percentual(c.percentual) + '</td>' +
      '<td>' + (c.incideTributos ? '<span class="badge badge--ok">Sim</span>' : '<span class="badge badge--na">Não</span>') + '</td>' +
      '</tr>'
    ).join('');

    const total = '<tr class="is-total">' +
      '<td>Valor da prestação</td>' +
      '<td class="num">' + UI.moeda(r.baseCalculo) + '</td>' +
      '<td class="num">100,00%</td>' +
      '<td></td>' +
      '</tr>';

    el.componentes.querySelector('tbody').innerHTML = linhas + total;
    el.notaComposicao.textContent = 'O vale-pedágio de ' + UI.moeda(r.valePedagio)
      + ' é antecipado pela pagadora e fica fora da remuneração do frete: não entra na base dos tributos.';
  }

  function renderTributos(r) {
    const linhas = (r.tributos || []).map((t) =>
      '<tr>' +
      '<td>' + UI.sanitizar(t.nome) +
      '<span class="celula__nota">' + UI.sanitizar(t.observacao || '') + '</span>' +
      '<span class="celula__fonte">' + UI.sanitizar(t.fundamento || '') + '</span></td>' +
      '<td class="num">' + UI.percentual(t.aliquota) + '</td>' +
      '<td class="num">' + UI.moeda(t.valor) + '</td>' +
      '<td>' + UI.sanitizar(t.apuracao) + '</td>' +
      '<td>' + (t.creditoPagadora ? '<span class="badge badge--ok">Sim</span>' : '<span class="badge badge--na">Não</span>') + '</td>' +
      '</tr>'
    ).join('');

    el.tributos.querySelector('tbody').innerHTML = linhas;
    el.tributos.querySelector('tfoot').innerHTML = '<tr class="is-total">' +
      '<td>Total destacado</td>' +
      '<td class="num">' + UI.percentual(r.percentualTributos) + '</td>' +
      '<td class="num">' + UI.moeda(r.totalTributos) + '</td>' +
      '<td colspan="2"></td>' +
      '</tr>';

    el.notaTributos.textContent = r.fase === 'TESTE'
      ? 'Em 2026 o IBS e a CBS são destacados no documento, mas compensados pelo transportador na apuração: '
        + 'não geram crédito para a pagadora nem custo adicional.'
      : 'A partir de 2027 o IBS e a CBS destacados geram crédito para a pagadora no regime regular.';
  }

  function renderPagamento(r) {
    const linhas = [];

    linhas.push(['Valor da prestação (CT-e)', UI.moeda(r.baseCalculo), '']);

    (r.retencoes || []).forEach((retencao) => {
      linhas.push([
        '(−) ' + retencao.nome + ' · ' + UI.percentual(retencao.aliquota),
        '−' + UI.moeda(retencao.valor),
        retencao.recolhimento || ''
      ]);
    });

    if (!r.retencoes || r.retencoes.length === 0) {
      linhas.push(['Nenhuma retenção aplicada', '—', '']);
    }

    linhas.push(['(=) Líquido ao transportador', UI.moeda(r.liquidoTransportador), 'total', 'total']);

    if (Number(r.valePedagio) > 0) {
      linhas.push(['(+) Vale-pedágio antecipado', UI.moeda(r.valePedagio), 'fora da remuneração']);
    }

    linhas.push(['(=) Desembolso da pagadora', UI.moeda(r.desembolsoTotal), 'total', 'total']);

    linhas.push(['Tributos embutidos no valor', UI.moeda(r.totalTributos), 'já pagos dentro do CT-e']);
    linhas.push(['Créditos apropriáveis', UI.moeda(r.creditoTotal), 'ICMS, PIS/COFINS e IBS/CBS']);
    linhas.push(['Custo tributário não recuperável', UI.moeda(r.custoNaoRecuperavel),
      UI.percentual(r.percentualCustoNaoRecuperavel) + ' do documento']);

    el.pagamentoTabela.querySelector('tbody').innerHTML = linhas.map(([rotulo, valor, meta, classe]) =>
      '<tr' + (classe === 'total' ? ' class="is-total"' : '') + '>' +
      '<th scope="row">' + UI.sanitizar(rotulo) + '<span class="celula__nota">' + UI.sanitizar(meta || '') + '</span></th>' +
      '<td class="num">' + UI.sanitizar(valor) + '</td>' +
      '</tr>'
    ).join('');

    el.notaPagamento.textContent = 'Os tributos não são descontados do valor do CT-e: eles já estão embutidos no '
      + 'preço. O desembolso da pagadora é o valor do documento mais o vale-pedágio; os créditos reduzem o custo, '
      + 'não o desembolso.';
  }

  function renderComparativo(r) {
    const linhas = (r.comparativo || []).map((ano) =>
      '<tr>' +
      '<td><strong>' + UI.sanitizar(String(ano.ano)) + '</strong><span class="celula__nota">' + UI.sanitizar(ano.rotulo) + '</span></td>' +
      '<td class="num">' + UI.moeda(ano.valorIcms) + '</td>' +
      '<td class="num">' + UI.moeda(ano.valorPisCofins) + '</td>' +
      '<td class="num">' + UI.moeda(ano.valorIbsCbs) + '</td>' +
      '<td class="num">' + UI.moeda(ano.totalTributos) + '</td>' +
      '<td class="num">' + UI.percentual(ano.percentualTotal) + '</td>' +
      '<td class="num">' + (ano.splitPayment ? UI.moeda(ano.valorSplitPayment) : '—') + '</td>' +
      '<td class="num">' + UI.moeda(ano.liquidoTransportador) + '</td>' +
      '</tr>'
    ).join('');

    el.comparativo.querySelector('tbody').innerHTML = linhas;
    el.notaComparativo.textContent = 'O valor do documento é o mesmo em todos os anos para isolar o efeito das '
      + 'alíquotas. Em 2027 o PIS/COFINS sai e a CBS entra integral, por isso a carga cai; a partir de 2027 o split '
      + 'payment segrega o IBS/CBS no momento do pagamento.';
  }

  function renderConferencias(r) {
    el.conferencias.innerHTML = (r.conferencias || []).map((c) => {
      const classe = ROTULO_SITUACAO[c.situacao] || 'manual';
      return '<li class="conferencia">' +
        '<span class="badge badge--' + classe + '">' + UI.sanitizar(TEXTO_SITUACAO[c.situacao] || c.situacao) + '</span>' +
        '<div><p class="conferencia__item">' + UI.sanitizar(c.item) +
        '<span class="conferencia__origem">' + UI.sanitizar(TEXTO_ORIGEM[c.origem] || c.origem || '') + '</span></p>' +
        '<p class="conferencia__detalhe">' + UI.sanitizar(c.detalhe) + '</p></div>' +
        '</li>';
    }).join('');
  }

  function renderPremissas(r) {
    el.premissas.innerHTML = (r.premissas || []).map((p) => '<li>' + UI.sanitizar(p) + '</li>').join('');
  }

  function renderResultado(r) {
    estado.resultado = r;
    renderDocumento(r);
    renderKpis(r);
    renderComponentes(r);
    renderTributos(r);
    renderPagamento(r);
    renderComparativo(r);
    renderConferencias(r);
    renderPremissas(r);
  }

  /* ------------------------------------------------------------------ ações */

  async function recalcular() {
    mostrarErro('');
    el.btnCalcular.disabled = true;
    definirStatus('Calculando o pagamento…', false);

    try {
      const resposta = await fetch(new URL('pagamento', API), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaAtual())
      });

      if (!resposta.ok) {
        let detalhe = 'Erro ao calcular o pagamento.';
        try {
          const corpo = await resposta.json();
          detalhe = corpo.message || corpo.error || detalhe;
        } catch (e) { /* corpo sem JSON */ }
        throw new Error(detalhe);
      }

      renderResultado(await resposta.json());
      definirStatus('Pagamento calculado.', false);
    } catch (erro) {
      mostrarErro(erro.message);
      definirStatus('Não foi possível calcular o pagamento.', true);
    } finally {
      el.btnCalcular.disabled = false;
    }
  }

  function aplicarPadroesDoTransportador() {
    const autonomo = el.transportador.value === 'TAC';
    el.retInss.checked = autonomo;
    el.retSest.checked = autonomo;
  }

  function restaurar() {
    if (!estado.exemplo) return;
    aplicarEntrada(estado.exemplo.entrada);
    renderResultado(estado.exemplo.resultado);
    mostrarErro('');
    definirStatus('Exemplo restaurado.', false);
  }

  /* -------------------------------------------------------------------- boot */

  async function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;

    definirStatus('Carregando o CT-e de exemplo…', false);

    try {
      const [parametros, exemplo] = await Promise.all([carregarParametros(), carregarExemplo()]);
      estado.exemplo = exemplo;
      preencherOpcoes(parametros);
      aplicarEntrada(exemplo.entrada);
      renderResultado(exemplo.resultado);
      definirStatus('', false);
    } catch (erro) {
      mostrarErro(erro.message);
      definirStatus('Não foi possível carregar o CT-e.', true);
    }
  }

  el.form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    recalcular();
  });

  el.transportador.addEventListener('change', () => {
    aplicarPadroesDoTransportador();
    recalcular();
  });

  el.regime.addEventListener('change', recalcular);

  [el.retIrrf, el.retInss, el.retSest].forEach((caixa) => {
    caixa.addEventListener('change', recalcular);
  });

  el.pagamento.addEventListener('change', () => {
    const valor = el.pagamento.value;
    if (valor) {
      const dataPagamento = new Date(valor + 'T12:00:00');
      dataPagamento.setDate(dataPagamento.getDate() - 15);
      estado.exemplo.entrada.dataEmissao = dataPagamento.toISOString().slice(0, 10);
    }
    recalcular();
  });

  el.btnRestaurar.addEventListener('click', restaurar);

  window.CtePainel = { iniciar, recarregar: recalcular };
})();
