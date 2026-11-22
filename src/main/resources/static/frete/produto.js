/* ==========================================================================
   Aba 3 · Produto & contrato
   Consome:
     GET ../calculadora/frete/produto
     GET ../calculadora/frete/produto/anexo   (download do anexo em markdown)
   ========================================================================== */

(function () {
  'use strict';

  const API = new URL('../calculadora/frete/', window.location.href);
  const UI = window.SimuladorFrete;

  const estado = {
    dados: null,
    filtro: 'TODAS',
    iniciado: false
  };

  const el = {
    alerta: document.getElementById('produto-alerta'),
    kpis: document.getElementById('produto-kpis'),
    filtros: document.getElementById('produto-filtros'),
    tabela: document.getElementById('produto-lacunas'),
    ondas: document.getElementById('produto-ondas'),
    clausulas: document.getElementById('produto-clausulas'),
    avisos: document.getElementById('produto-avisos')
  };

  const CLASSE_SITUACAO = { PRONTO: 'ok', PARCIAL: 'atencao', FALTA: 'falta' };
  const TEXTO_SITUACAO = { PRONTO: 'Pronto', PARCIAL: 'Parcial', FALTA: 'Falta' };

  function mostrarErro(mensagem) {
    el.alerta.textContent = mensagem;
    el.alerta.hidden = !mensagem;
  }

  function renderKpis(dados) {
    const cartoes = [
      { rotulo: 'Itens avaliados', valor: String(dados.total), meta: 'cinco dimensões do produto' },
      {
        rotulo: 'Prontos para demonstrar',
        valor: String(dados.prontos),
        meta: UI.numero(dados.cobertura) + '% do total',
        destaque: true
      },
      { rotulo: 'Parciais', valor: String(dados.parciais), meta: 'dependem de integração ou ajuste' },
      { rotulo: 'Lacunas', valor: String(dados.faltantes), meta: 'entram nas ondas 1 a 3' }
    ];

    el.kpis.innerHTML = cartoes.map((cartao) =>
      '<article class="kpi' + (cartao.destaque ? ' kpi--destaque' : '') + '">' +
      '<p class="kpi__label">' + UI.sanitizar(cartao.rotulo) + '</p>' +
      '<p class="kpi__valor">' + UI.sanitizar(cartao.valor) + '</p>' +
      '<p class="kpi__meta"><span>' + UI.sanitizar(cartao.meta) + '</span></p>' +
      '</article>'
    ).join('');
  }

  function renderFiltros(dados) {
    const dimensoes = ['TODAS'].concat(
      Array.from(new Set(dados.lacunas.map((l) => l.dimensao)))
    );

    el.filtros.innerHTML = dimensoes.map((dimensao) => {
      const rotulo = dimensao === 'TODAS' ? 'Todas' : dimensao;
      const ativo = estado.filtro === dimensao;
      return '<button type="button" class="chip' + (ativo ? ' is-ativo' : '') + '"' +
        ' data-dimensao="' + UI.sanitizar(dimensao) + '"' +
        ' aria-pressed="' + (ativo ? 'true' : 'false') + '">' + UI.sanitizar(rotulo) + '</button>';
    }).join('');
  }

  function renderTabela(dados) {
    const linhas = dados.lacunas
      .filter((l) => estado.filtro === 'TODAS' || l.dimensao === estado.filtro)
      .map((l) => {
        const classe = CLASSE_SITUACAO[l.situacao] || 'na';
        const onda = l.onda ? 'Onda ' + l.onda + ' · esforço ' + (l.esforco || '—') : '—';
        return '<tr>' +
          '<td>' + UI.sanitizar(l.dimensao) + '</td>' +
          '<td><strong>' + UI.sanitizar(l.item) + '</strong></td>' +
          '<td><span class="badge badge--' + classe + '">' + UI.sanitizar(TEXTO_SITUACAO[l.situacao] || l.situacao) + '</span></td>' +
          '<td>' + UI.sanitizar(l.impacto) + '</td>' +
          '<td>' + UI.sanitizar(l.proximoPasso) + '</td>' +
          '<td class="celula--onda">' + UI.sanitizar(onda) + '</td>' +
          '</tr>';
      }).join('');

    el.tabela.querySelector('tbody').innerHTML = linhas ||
      '<tr><td colspan="6" class="celula--vazia">Nenhum item nesta dimensão.</td></tr>';
  }

  function renderOndas(dados) {
    el.ondas.innerHTML = (dados.ondas || []).map((onda) =>
      '<li class="onda">' +
      '<div class="onda__cabeca">' +
      '<span class="onda__numero">' + UI.sanitizar(String(onda.numero)) + '</span>' +
      '<div>' +
      '<h4 class="onda__titulo">' + UI.sanitizar(onda.titulo) + '</h4>' +
      '<p class="onda__objetivo">' + UI.sanitizar(onda.objetivo) + '</p>' +
      '</div>' +
      '<span class="onda__prazo">' + UI.sanitizar(onda.prazo || '') + '</span>' +
      '</div>' +
      '<ul class="onda__entregas">' + (onda.entregas || []).map((entrega) =>
        '<li>' + UI.sanitizar(entrega) + '</li>').join('') + '</ul>' +
      '</li>'
    ).join('');
  }

  function renderClausulas(dados) {
    el.clausulas.innerHTML = (dados.clausulas || []).map((clausula) =>
      '<details class="clausula">' +
      '<summary>' +
      '<span class="clausula__numero">' + UI.sanitizar(String(clausula.numero)) + '</span>' +
      '<span class="clausula__titulo">' + UI.sanitizar(clausula.titulo) + '</span>' +
      '<span class="clausula__base">' + UI.sanitizar(clausula.base || '') + '</span>' +
      '</summary>' +
      '<div class="clausula__corpo">' +
      '<p class="clausula__texto">' + UI.sanitizar(clausula.texto) + '</p>' +
      '<p class="clausula__porque"><strong>Por que importa:</strong> ' + UI.sanitizar(clausula.porque) + '</p>' +
      '<p class="clausula__fonte"><strong>Base:</strong> ' + UI.sanitizar(clausula.base || '') + '</p>' +
      '</div>' +
      '</details>'
    ).join('');
  }

  function renderAvisos(dados) {
    el.avisos.innerHTML = (dados.avisos || []).map((aviso) => UI.sanitizar(aviso)).join(' ');
  }

  function renderTudo() {
    const dados = estado.dados;
    renderKpis(dados);
    renderFiltros(dados);
    renderTabela(dados);
    renderOndas(dados);
    renderClausulas(dados);
    renderAvisos(dados);
  }

  function trocarFiltro(dimensao) {
    estado.filtro = dimensao;
    renderFiltros(estado.dados);
    renderTabela(estado.dados);
  }

  el.filtros.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-dimensao]');
    if (!botao) return;
    trocarFiltro(botao.dataset.dimensao);
  });

  async function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;

    try {
      const resposta = await fetch(new URL('produto', API));
      if (!resposta.ok) throw new Error('Não foi possível carregar o diagnóstico do produto.');
      estado.dados = await resposta.json();
      renderTudo();
    } catch (erro) {
      mostrarErro(erro.message);
    }
  }

  window.ProdutoPainel = { iniciar };
})();
