/* ==========================================================================
   Navegação por abas do simulador de frete.
   Mantém aria-selected, esconde os painéis e inicializa cada aba sob demanda.
   ========================================================================== */

(function () {
  'use strict';

  const abas = Array.from(document.querySelectorAll('[role="tab"]'));

  if (abas.length === 0) return;

  const paineis = {};
  abas.forEach((aba) => {
    paineis[aba.dataset.painel] = document.getElementById(aba.getAttribute('aria-controls'));
  });

  function ativar(nome, atualizarHash) {
    if (!paineis[nome]) return;

    abas.forEach((aba) => {
      const ativa = aba.dataset.painel === nome;
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      aba.classList.toggle('is-active', ativa);
      aba.tabIndex = ativa ? 0 : -1;
    });

    Object.keys(paineis).forEach((chave) => {
      paineis[chave].hidden = chave !== nome;
    });

    if (nome === 'cte' && window.CtePainel) window.CtePainel.iniciar();
    if (nome === 'produto' && window.ProdutoPainel) window.ProdutoPainel.iniciar();

    if (atualizarHash) {
      window.history.replaceState(null, '', '#' + nome);
    }

    if (nome === 'projecao') {
      // O gráfico é desenhado com a largura do contêiner: redesenha ao reexibir.
      window.dispatchEvent(new Event('resize'));
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  abas.forEach((aba) => {
    aba.addEventListener('click', () => ativar(aba.dataset.painel, true));

    aba.addEventListener('keydown', (evento) => {
      const indice = abas.indexOf(aba);
      let destino = null;

      if (evento.key === 'ArrowRight') destino = (indice + 1) % abas.length;
      if (evento.key === 'ArrowLeft') destino = (indice - 1 + abas.length) % abas.length;
      if (evento.key === 'Home') destino = 0;
      if (evento.key === 'End') destino = abas.length - 1;

      if (destino === null) return;
      evento.preventDefault();
      abas[destino].focus();
      ativar(abas[destino].dataset.painel, true);
    });
  });

  const inicial = (window.location.hash || '').replace('#', '');
  ativar(paineis[inicial] ? inicial : 'projecao', false);
})();
