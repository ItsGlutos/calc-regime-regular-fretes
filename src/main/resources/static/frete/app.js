/* ==========================================================================
   Simulador de frete · Reforma Tributária
   Consome a API oficial da calculadora do regime regular:
     GET  ../calculadora/frete/parametros
     POST ../calculadora/frete/projecao
   ========================================================================== */

(function () {
  'use strict';

  const API = new URL('../calculadora/frete/', window.location.href);

  const SERIES = [
    { chave: 'icms', rotulo: 'ICMS', cor: 'var(--serie-icms)' },
    { chave: 'pisCofins', rotulo: 'PIS/COFINS', cor: 'var(--serie-pis)' },
    { chave: 'iss', rotulo: 'ISS', cor: 'var(--serie-iss)' },
    { chave: 'cbs', rotulo: 'CBS', cor: 'var(--serie-cbs)' },
    { chave: 'ibsUf', rotulo: 'IBS UF', cor: 'var(--serie-ibs-uf)' },
    { chave: 'ibsMun', rotulo: 'IBS Município', cor: 'var(--serie-ibs-mun)' }
  ];

  const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const REGIOES_REDUZIDAS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Espírito Santo'];
  const REGIOES_ORIGEM_REDUZIDA = ['Sudeste (exceto ES)', 'Sul'];

  const REGIAO_CURTA = {
    'Norte': 'Norte',
    'Nordeste': 'Nordeste',
    'Centro-Oeste': 'C.-Oeste',
    'Sudeste (exceto ES)': 'Sudeste*',
    'Espírito Santo': 'ES',
    'Sul': 'Sul'
  };

  const estado = {
    parametros: null,
    projecao: null,
    periodicidade: 'MENSAL',
    mesReferencia: new Date().getMonth() + 1,
    anoSelecionado: null
  };

  const el = {
    form: document.getElementById('form-simulacao'),
    valorFrete: document.getElementById('valorFrete'),
    labelValor: document.getElementById('label-valor'),
    hintValor: document.getElementById('hint-valor'),
    segmented: document.querySelector('.segmented'),
    hintPeriodicidade: document.getElementById('hint-periodicidade'),
    mesReferencia: document.getElementById('mesReferencia'),
    tipoOperacao: document.getElementById('tipoOperacao'),
    campoUfs: document.getElementById('campo-ufs'),
    campoAliquota: document.getElementById('campo-aliquota'),
    ufOrigem: document.getElementById('ufOrigem'),
    ufDestino: document.getElementById('ufDestino'),
    hintIcms: document.getElementById('hint-icms'),
    aliquota: document.getElementById('aliquota'),
    labelAliquota: document.getElementById('label-aliquota'),
    hintAliquota: document.getElementById('hint-aliquota'),
    regime: document.getElementById('regimePisCofins'),
    servico: document.getElementById('servico'),
    btnSimular: document.getElementById('btn-simular'),
    btnRestaurar: document.getElementById('btn-restaurar'),
    status: document.getElementById('form-status'),
    alerta: document.getElementById('alerta-erro'),
    kpis: document.getElementById('kpis'),
    grafico: document.getElementById('grafico'),
    legenda: document.getElementById('legenda'),
    notaGrafico: document.getElementById('nota-grafico'),
    tabelaEvolucao: document.getElementById('tabela-evolucao'),
    tabelaComposicao: document.getElementById('tabela-composicao'),
    notaEvolucao: document.getElementById('nota-evolucao'),
    tabelaParams: document.getElementById('tabela-parametros'),
    notasEtapa: document.getElementById('notas-etapa'),
    tabelaIcms: document.getElementById('tabela-icms'),
    memoria: document.getElementById('memoria'),
    memoriaTitulo: document.getElementById('memoria-titulo'),
    memoriaLista: document.getElementById('memoria-lista'),
    btnFecharMemoria: document.getElementById('btn-fechar-memoria'),
    avisos: document.getElementById('lista-avisos'),
    versaoBase: document.getElementById('versao-base'),
    versaoApp: document.getElementById('versao-app'),
    btnCsv: document.getElementById('btn-csv'),
    subtituloGrafico: document.getElementById('subtitulo-grafico')
  };

  /* ----------------------------------------------------------- formatação */

  const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEixo = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmtCurto = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const moeda = (v) => fmtMoeda.format(Number(v || 0));
  const numero = (v) => fmtNumero.format(Number(v || 0));
  const percentual = (v) => numero(v) + '%';
  const percentualCurto = (v) => fmtCurto.format(Number(v || 0)) + '%';

  function pontos(v) {
    const n = Number(v || 0);
    return (n > 0 ? '+' : '') + numero(n) + ' p.p.';
  }

  function pontosTabela(v) {
    const n = Number(v || 0);
    return (n > 0 ? '+' : '') + numero(n);
  }

  function moedaSinal(v) {
    const n = Number(v || 0);
    return (n > 0 ? '+' : n < 0 ? '-' : '') + moeda(Math.abs(n));
  }

  function periodoRotulo(periodicidade) {
    return { DIARIO: 'diário', QUINZENAL: 'quinzenal', MENSAL: 'mensal' }[periodicidade] || 'mensal';
  }

  function passoEscala(bruto) {
    if (!Number.isFinite(bruto) || bruto <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(bruto)));
    for (const candidato of [1, 2, 2.5, 5, 10]) {
      if (bruto <= candidato * magnitude) return candidato * magnitude;
    }
    return 10 * magnitude;
  }

  function parseValor(texto) {
    if (typeof texto === 'number') return texto;
    const limpo = String(texto || '').replace(/[^\d.,-]/g, '').trim();
    if (!limpo) return NaN;

    const temVirgula = limpo.includes(',');
    const temPonto = limpo.includes('.');

    if (temVirgula && temPonto) {
      return Number(limpo.replace(/\./g, '').replace(',', '.'));
    }
    if (temVirgula) {
      return Number(limpo.replace(/\./g, '').replace(',', '.'));
    }
    if (temPonto) {
      const milhar = /^-?\d{1,3}(\.\d{3})+$/.test(limpo);
      return Number(milhar ? limpo.replace(/\./g, '') : limpo);
    }
    return Number(limpo);
  }

  function sanitizar(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* -------------------------------------------------------------- selects */

  function montarSelects(parametros) {
    el.tipoOperacao.innerHTML = parametros.tiposOperacao
      .map((t) => '<option value="' + sanitizar(t.valor) + '">' + sanitizar(t.rotulo) + '</option>')
      .join('');

    el.regime.innerHTML = parametros.regimesPisCofins
      .map((r) => '<option value="' + sanitizar(r.valor) + '">' + sanitizar(r.rotulo) + '</option>')
      .join('');

    el.mesReferencia.innerHTML = MESES
      .map((nome, indice) => {
        const valor = indice + 1;
        const selecionado = valor === estado.mesReferencia ? ' selected' : '';
        return '<option value="' + valor + '"' + selecionado + '>' + nome + '</option>';
      })
      .join('');

    const ufs = parametros.ufs || [];
    const opcoesUf = ufs
      .map((uf) => '<option value="' + sanitizar(uf.valor) + '">' + sanitizar(uf.rotulo) + '</option>')
      .join('');
    el.ufOrigem.innerHTML = opcoesUf;
    el.ufDestino.innerHTML = opcoesUf;
    el.ufOrigem.value = 'SP';
    el.ufDestino.value = 'BA';

    const grupos = new Map();
    parametros.servicosFrete.forEach((s) => {
      if (!grupos.has(s.modal)) grupos.set(s.modal, []);
      grupos.get(s.modal).push(s);
    });

    const rotulosModal = {
      RODOVIARIO: 'Rodoviário',
      FERROVIARIO: 'Ferroviário',
      AQUAVIARIO: 'Aquaviário',
      AEREO: 'Aéreo',
      MULTIMODAL: 'Multimodal',
      OUTROS: 'Outros serviços'
    };

    let html = '';
    grupos.forEach((servicos, modal) => {
      html += '<optgroup label="' + sanitizar(rotulosModal[modal] || modal) + '">';
      servicos.forEach((s) => {
        const selecionado = s.nbs === parametros.servicosFrete[0].nbs ? ' selected' : '';
        html += '<option value="' + sanitizar(s.nbs) + '"' + selecionado + '>' +
          sanitizar(s.descricao) + ' · ' + sanitizar(s.nbs) + '</option>';
      });
      html += '</optgroup>';
    });
    el.servico.innerHTML = html;
  }

  function aliquotaInterestadual(origem, destino) {
    const ufOrigem = (estado.parametros.ufs || []).find((uf) => uf.valor === origem);
    const ufDestino = (estado.parametros.ufs || []).find((uf) => uf.valor === destino);
    if (!ufOrigem || !ufDestino) return 12;

    const origemReduzida = REGIOES_ORIGEM_REDUZIDA.includes(ufOrigem.descricao);
    const destinoReduzido = REGIOES_REDUZIDAS.includes(ufDestino.descricao);
    return origemReduzida && destinoReduzido ? 7 : 12;
  }

  function atualizarHintIcms() {
    if (!estado.parametros) return;
    if (el.tipoOperacao.value !== 'INTERESTADUAL') return;

    const aliquota = aliquotaInterestadual(el.ufOrigem.value, el.ufDestino.value);
    el.hintIcms.textContent = 'ICMS interestadual de ' + el.ufOrigem.value + ' para ' + el.ufDestino.value +
      ': ' + numero(aliquota) + '% (Resolução do Senado Federal nº 22/1989).';
  }

  function sincronizarTipoOperacao() {
    const tipo = estado.parametros.tiposOperacao.find((t) => t.valor === el.tipoOperacao.value);
    if (!tipo) return;

    const interestadual = tipo.valor === 'INTERESTADUAL';
    const municipal = tipo.valor === 'MUNICIPAL';

    el.campoUfs.hidden = !interestadual;
    el.campoAliquota.hidden = interestadual;

    if (interestadual) {
      atualizarHintIcms();
      return;
    }

    el.labelAliquota.textContent = municipal ? 'ISS' : 'ICMS';
    el.hintAliquota.textContent = municipal
      ? 'Alíquota municipal aplicada ao frete no regime anterior.'
      : 'Alíquota interna do estado, aplicada ao frete no regime anterior.';
    el.aliquota.value = numero(tipo.aliquota).replace(/\./g, '').replace(',', '.');
  }

  function sincronizarPeriodicidade() {
    const rotulo = periodoRotulo(estado.periodicidade);
    const descricoes = {
      DIARIO: 'Valor de um dia útil de operação.',
      QUINZENAL: 'Valor de meia quinzena: metade dos dias úteis do mês.',
      MENSAL: 'Valor de um mês de operação: todos os dias úteis do mês.'
    };

    el.labelValor.textContent = 'Valor do frete ' + rotulo;
    el.hintValor.textContent = descricoes[estado.periodicidade];
    el.hintPeriodicidade.textContent = descricoes[estado.periodicidade];

    el.segmented.querySelectorAll('[data-periodicidade]').forEach((botao) => {
      botao.setAttribute('aria-pressed', String(botao.dataset.periodicidade === estado.periodicidade));
    });
  }

  function montarTabelaParametros(parametros) {
    const corpo = el.tabelaParams.querySelector('tbody');
    corpo.innerHTML = parametros.parametrosTransicao
      .map((p) => {
        const fixo = p.ano <= 2026;
        const disabled = fixo ? ' disabled' : '';
        const nota = fixo ? ' <span class="hint">(lei)</span>' : '';
        return (
          '<tr data-ano="' + p.ano + '">' +
          '<th scope="row">' + p.ano + nota + '</th>' +
          '<td><input type="number" step="0.01" min="0" max="100" data-campo="cbs" value="' + p.cbs + '"' + disabled + ' aria-label="CBS ' + p.ano + '"></td>' +
          '<td><input type="number" step="0.01" min="0" max="100" data-campo="ibsUf" value="' + p.ibsUf + '"' + disabled + ' aria-label="IBS UF ' + p.ano + '"></td>' +
          '<td><input type="number" step="0.01" min="0" max="100" data-campo="ibsMun" value="' + p.ibsMun + '"' + disabled + ' aria-label="IBS município ' + p.ano + '"></td>' +
          '<td><input type="number" step="0.01" min="0" max="100" data-campo="reducaoIcmsIss" value="' + p.reducaoIcmsIss + '"' + disabled + ' aria-label="Redução de ICMS e ISS ' + p.ano + '"></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function coletarParametrosTransicao() {
    const linhas = Array.from(el.tabelaParams.querySelectorAll('tbody tr'));
    return linhas
      .filter((linha) => Number(linha.dataset.ano) > 2026)
      .map((linha) => {
        const valor = (campo) => {
          const input = linha.querySelector('[data-campo="' + campo + '"]');
          const numeroCampo = parseValor(input.value);
          return Number.isFinite(numeroCampo) ? numeroCampo : 0;
        };
        return {
          ano: Number(linha.dataset.ano),
          cbs: valor('cbs'),
          ibsUf: valor('ibsUf'),
          ibsMun: valor('ibsMun'),
          reducaoIcmsIss: valor('reducaoIcmsIss')
        };
      });
  }

  /* ------------------------------------------------------------- requisições */

  async function carregarParametros() {
    const resposta = await fetch(new URL('parametros', API), { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw new Error('Não foi possível carregar os parâmetros da calculadora.');
    return resposta.json();
  }

  async function calcular(payload) {
    const resposta = await fetch(new URL('projecao', API), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resposta.ok) {
      let mensagem = 'Não foi possível calcular a projeção.';
      try {
        const problema = await resposta.json();
        mensagem = problema.detail || problema.title || mensagem;
      } catch (e) {
        /* resposta sem corpo JSON */
      }
      throw new Error(mensagem);
    }
    return resposta.json();
  }

  /* ------------------------------------------------------------------ KPIs */

  function renderKpis(projecao) {
    const resumo = projecao.resumo;
    const delta = Number(resumo.diferencaPontosPercentuais || 0);
    const deltaAbsoluto = Number(resumo.diferencaAbsoluta || 0);
    const classePill = delta > 0 ? '' : delta < 0 ? 'pill--baixa' : 'pill--neutro';
    const rotulo = periodoRotulo(projecao.periodicidade);

    el.kpis.innerHTML =
      '<article class="kpi">' +
      '<p class="kpi__label">Hoje pagamos · ' + resumo.anoReferencia + ' · ' + rotulo + '</p>' +
      '<p class="kpi__valor">' + moeda(resumo.cargaReferencia) + '</p>' +
      '<p class="kpi__meta"><span>' + percentual(resumo.percentualReferencia) + ' do frete</span>' +
      '<span class="pill pill--neutro">' + projecao.diasUteisReferencia + ' dias úteis</span></p>' +
      '</article>' +

      '<article class="kpi kpi--destaque">' +
      '<p class="kpi__label">Em ' + resumo.anoRegimePleno + ' passamos a pagar</p>' +
      '<p class="kpi__valor">' + moeda(resumo.cargaRegimePleno) + '</p>' +
      '<p class="kpi__meta"><span>' + percentual(resumo.percentualRegimePleno) + ' do frete</span>' +
      '<span class="pill ' + classePill + '">' + moedaSinal(deltaAbsoluto) + ' · ' + pontos(delta) + '</span></p>' +
      '</article>' +

      '<article class="kpi">' +
      '<p class="kpi__label">Ponto de virada</p>' +
      '<p class="kpi__valor">' + (resumo.anoPrimeiroAumento || 'Sem alta') + '</p>' +
      '<p class="kpi__meta"><span>' + (resumo.anoPrimeiroAumento
        ? 'Primeiro ano em que a carga supera a de hoje.'
        : 'A carga projetada não supera a de hoje.') + '</span></p>' +
      '<p class="kpi__meta"><span>Média anual no período: ' + moeda(resumo.cargaMediaAnual) + '</span></p>' +
      '</article>';
  }

  /* ---------------------------------------------------------------- gráfico */

  function renderLegenda() {
    el.legenda.innerHTML = SERIES.map(
      (s) => '<li><span class="amostra" style="background:' + s.cor + '"></span>' + s.rotulo + '</li>'
    ).join('');
  }

  function valorSerie(ano, chave) {
    if (chave === 'pisCofins') return Number(ano.valorPis || 0) + Number(ano.valorCofins || 0);
    if (chave === 'ibsUf') return Number(ano.valorIbsUf || 0);
    if (chave === 'ibsMun') return Number(ano.valorIbsMun || 0);
    return Number(ano[('valor' + chave.charAt(0).toUpperCase() + chave.slice(1))] || 0);
  }

  function renderGrafico(projecao) {
    const anos = projecao.anos;

    const larguraContainer = Math.floor(el.grafico.clientWidth || 760);
    const compacto = larguraContainer < 560;
    const largura = Math.max(300, larguraContainer);
    const altura = compacto ? 290 : 320;
    const margem = {
      topo: 28,
      direita: compacto ? 6 : 10,
      baixo: 34,
      esquerda: compacto ? 40 : 62
    };
    const larguraPlot = largura - margem.esquerda - margem.direita;
    const alturaPlot = altura - margem.topo - margem.baixo;

    const maximo = Math.max(...anos.map((a) => Number(a.totalEfetivo || 0)), 1);
    const passo = passoEscala(maximo / (compacto ? 3 : 4));
    const escalaMax = Math.max(passo, Math.ceil(maximo / passo) * passo);

    const passoX = larguraPlot / anos.length;
    const larguraBarra = Math.max(8, Math.min(46, passoX * 0.58));

    const y = (valor) => margem.topo + alturaPlot - (valor / escalaMax) * alturaPlot;

    const ticks = [];
    for (let valor = 0; valor <= escalaMax + passo / 2; valor += passo) {
      ticks.push(valor);
    }

    let svg = '<svg viewBox="0 0 ' + largura + ' ' + altura + '" class="' + (compacto ? 'grafico-svg grafico-svg--compacto' : 'grafico-svg') +
      '" role="presentation" focusable="false" aria-hidden="true">';

    ticks.forEach((tick) => {
      const posicao = y(tick);
      svg += '<line class="grade" x1="' + margem.esquerda + '" y1="' + posicao + '" x2="' +
        (largura - margem.direita) + '" y2="' + posicao + '"></line>';
      svg += '<text class="eixo-texto" x="' + (margem.esquerda - 6) + '" y="' + (posicao + 4) +
        '" text-anchor="end">' + fmtEixo.format(tick) + '</text>';
    });

    anos.forEach((ano, indice) => {
      const centro = margem.esquerda + passoX * (indice + 0.5);
      const esquerda = centro - larguraBarra / 2;

      const compensado = ano.fase === 'TESTE';
      const seriesDoAno = compensado
        ? SERIES.filter((serie) => serie.chave !== 'cbs' && serie.chave !== 'ibsUf' && serie.chave !== 'ibsMun')
        : SERIES;

      const segmentos = seriesDoAno
        .map((serie) => ({ serie: serie, valor: valorSerie(ano, serie.chave) }))
        .filter((segmento) => segmento.valor > 0);

      let acumulado = 0;
      const titulo = sanitizar(
        ano.ano + ' · ' + moeda(ano.totalEfetivo) + ' (' + percentual(ano.percentualTotal) + ') · ' +
        ano.diasUteis + ' dias úteis' + (compensado ? ' · CBS e IBS compensados neste ano' : '') + ' · ' +
        segmentos.map((s) => s.serie.rotulo + ': ' + moeda(s.valor)).join(' · ')
      );

      svg += '<g class="coluna"><title>' + titulo + '</title>';

      segmentos.forEach((segmento) => {
        const alturaBarra = (segmento.valor / escalaMax) * alturaPlot;
        const posicao = y(acumulado + segmento.valor);
        acumulado += segmento.valor;
        svg += '<rect class="barra" x="' + esquerda + '" y="' + posicao + '" width="' + larguraBarra +
          '" height="' + Math.max(alturaBarra, 0.6) + '" fill="' + segmento.serie.cor + '" rx="1.5"></rect>';
      });

      const mostrarTotal = !compacto || indice % 2 === 0;
      if (mostrarTotal) {
        svg += '<text class="rotulo-total" x="' + centro + '" y="' + (y(Number(ano.totalEfetivo)) - 7) +
          '" text-anchor="middle">' + (compacto ? fmtEixo.format(Number(ano.percentualTotal)) + '%' : percentualCurto(ano.percentualTotal)) + '</text>';
      }

      const destaque = ano.fase === 'REFERENCIA' || ano.fase === 'REGIME_PLENO';
      svg += '<text class="rotulo-ano" x="' + centro + '" y="' + (altura - margem.baixo + 17) +
        '" text-anchor="middle"' + (destaque ? ' font-weight="700"' : '') + '>' + ano.ano + '</text>';

      svg += '</g>';
    });

    svg += '</svg>';
    el.grafico.innerHTML = svg;

    el.grafico.setAttribute(
      'aria-label',
      'Carga efetiva sobre o frete por ano: ' + anos.map((a) => a.ano + ': ' + percentual(a.percentualTotal)).join('; ') + '.'
    );

    el.notaGrafico.textContent =
      '2026 aparece com a carga do regime anterior porque a CBS e o IBS do ano são compensáveis. ' +
      'A partir de 2027 a carga cresce até o regime pleno. O valor do período varia com a quantidade de dias úteis de cada ano.';
  }

  /* ------------------------------------------------------------------ tabelas */

  const FASE_CURTA = {
    REFERENCIA: 'Referência',
    TESTE: 'Fase de teste',
    CBS_PLENA: 'CBS plena',
    TRANSICAO_IBS: 'Transição',
    REGIME_PLENO: 'Regime pleno'
  };

  function classeFase(ano) {
    if (ano.fase === 'TESTE') return 'fase fase--teste';
    if (ano.fase === 'REGIME_PLENO') return 'fase fase--pleno';
    return 'fase';
  }

  function setaDelta(delta) {
    if (delta > 0) {
      return '<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-14z" fill="currentColor"></path></svg>';
    }
    if (delta < 0) {
      return '<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-8h14z" fill="currentColor"></path></svg>';
    }
    return '';
  }

  function deltaClasse(delta) {
    return delta > 0 ? 'delta delta--alta' : delta < 0 ? 'delta delta--baixa' : 'delta delta--neutro';
  }

  function linhasSelecionaveis(container) {
    container.querySelectorAll('tr[data-ano]').forEach((linha) => {
      const abrir = () => selecionarAno(Number(linha.dataset.ano));
      linha.addEventListener('click', abrir);
      linha.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          abrir();
        }
      });
    });
  }

  function renderTabelaEvolucao(projecao) {
    const corpo = el.tabelaEvolucao.querySelector('tbody');
    const rotulo = periodoRotulo(projecao.periodicidade);

    corpo.innerHTML = projecao.anos
      .map((ano) => {
        const deltaAno = Number(ano.variacaoAnoAnteriorAbsoluta || 0);
        const deltaPontos = Number(ano.variacaoAnoAnteriorPontosPercentuais || 0);
        const delta2025 = Number(ano.variacaoPontosPercentuais || 0);

        const classes = [
          '',
          ano.fase === 'REFERENCIA' ? 'is-referencia' : '',
          ano.fase === 'REGIME_PLENO' ? 'is-pleno' : ''
        ].filter(Boolean).join(' ');

        const comparacao = ano.fase === 'REFERENCIA'
          ? '<span class="delta delta--neutro">ano base</span>'
          : '<span class="' + deltaClasse(deltaPontos) + '">' + setaDelta(deltaPontos) +
            moedaSinal(deltaAno) + ' · ' + pontosTabela(deltaPontos) + '</span>';

        return (
          '<tr class="' + classes + '" data-ano="' + ano.ano + '" tabindex="0" aria-label="Ver memória de cálculo de ' + ano.ano + '">' +
          '<th scope="row">' + ano.ano + '</th>' +
          '<td><span class="' + classeFase(ano) + '">' + sanitizar(FASE_CURTA[ano.fase] || ano.rotulo) + '</span></td>' +
          '<td class="num">' + ano.diasUteis + '</td>' +
          '<td class="num">' + numero(ano.valorFretePeriodo) + '</td>' +
          '<td class="num"><strong>' + numero(ano.totalEfetivo) + '</strong></td>' +
          '<td class="num">' + percentual(ano.percentualTotal) + '</td>' +
          '<td class="num">' + comparacao + '</td>' +
          '<td class="num"><span class="' + deltaClasse(delta2025) + '">' + setaDelta(delta2025) +
            pontosTabela(delta2025) + '</span></td>' +
          '</tr>'
        );
      })
      .join('');

    linhasSelecionaveis(el.tabelaEvolucao);

    el.notaEvolucao.textContent =
      'Período ' + rotulo + ' de ' + MESES[projecao.mesReferencia - 1] + ' · ' +
      projecao.diasUteisReferencia + ' dias úteis em 2025. ' +
      'O valor do período é recalculado a cada ano mantendo o preço por dia útil; ' +
      'a coluna "vs ano anterior" mostra o efeito em reais e em pontos percentuais.';
  }

  function renderTabelaComposicao(projecao) {
    const corpo = el.tabelaComposicao.querySelector('tbody');

    corpo.innerHTML = projecao.anos
      .map((ano) => {
        const compensado = ano.fase === 'TESTE';
        const nota = compensado
          ? ' title="Destacado em 2026 e compensável com PIS/COFINS e ICMS; não integra a carga efetiva"'
          : '';
        const marca = compensado ? '<sup aria-hidden="true">1</sup>' : '';
        const classeCelula = compensado ? ' class="num celula-compensada"' : ' class="num"';

        const classes = [
          '',
          ano.fase === 'REFERENCIA' ? 'is-referencia' : '',
          ano.fase === 'REGIME_PLENO' ? 'is-pleno' : ''
        ].filter(Boolean).join(' ');

        return (
          '<tr class="' + classes + '" data-ano="' + ano.ano + '" tabindex="0" aria-label="Ver memória de cálculo de ' + ano.ano + '">' +
          '<th scope="row">' + ano.ano + '</th>' +
          '<td' + classeCelula + nota + '>' + numero(ano.valorCbs) + marca + '</td>' +
          '<td' + classeCelula + nota + '>' + numero(ano.valorIbsUf) + marca + '</td>' +
          '<td' + classeCelula + nota + '>' + numero(ano.valorIbsMun) + marca + '</td>' +
          '<td class="num">' + numero(ano.valorIcms) + '</td>' +
          '<td class="num">' + numero(Number(ano.valorPis || 0) + Number(ano.valorCofins || 0)) + '</td>' +
          '<td class="num">' + numero(ano.valorIss) + '</td>' +
          '<td class="num"><strong>' + numero(ano.totalDestacado) + '</strong></td>' +
          '</tr>'
        );
      })
      .join('');

    linhasSelecionaveis(el.tabelaComposicao);
  }

  function selecionarAno(ano) {
    if (!estado.projecao) return;

    const linha = estado.projecao.anos.find((a) => a.ano === ano);
    if (!linha) return;

    estado.anoSelecionado = ano;

    [el.tabelaEvolucao, el.tabelaComposicao].forEach((tabela) => {
      tabela.querySelectorAll('tbody tr').forEach((tr) => {
        tr.classList.toggle('is-selecionado', Number(tr.dataset.ano) === ano);
      });
    });

    el.memoriaTitulo.textContent = 'Memória de cálculo · ' + ano + ' — ' + linha.rotulo;

    if (!linha.memoriaCalculo) {
      el.memoriaLista.innerHTML =
        '<div><dt>Sem memória de cálculo</dt><dd>' +
        (ano <= 2025
          ? 'O ano de referência é anterior à vigência da CBS e do IBS; a carga é composta apenas pelos tributos do regime anterior.'
          : 'A calculadora não devolveu a memória de cálculo para este ano.') +
        '</dd></div>';
    } else {
      el.memoriaLista.innerHTML =
        '<div><dt>CBS · ' + percentual(linha.percentualCbs) + '</dt><dd>' + sanitizar(linha.memoriaCalculo.cbs) + '</dd></div>' +
        '<div><dt>IBS UF · ' + percentual(linha.percentualIbsUf) + '</dt><dd>' + sanitizar(linha.memoriaCalculo.ibsUf) + '</dd></div>' +
        '<div><dt>IBS Município · ' + percentual(linha.percentualIbsMun) + '</dt><dd>' + sanitizar(linha.memoriaCalculo.ibsMun) + '</dd></div>';
    }

    el.memoria.hidden = false;
    el.memoria.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* --------------------------------------------------------------- notas */

  function renderNotas(projecao) {
    const notas = projecao.notasEtapa || [];

    el.notasEtapa.innerHTML = notas
      .map((nota) => {
        const delta = Number(nota.efeitoPontosPercentuais || 0);
        const efeitoClasse = delta > 0 ? 'delta delta--alta' : delta < 0 ? 'delta delta--baixa' : 'delta delta--neutro';

        return (
          '<li class="nota nota--' + nota.fase.toLowerCase() + '">' +
          '<div class="nota__head">' +
          '<span class="nota__ano">' + nota.ano + '</span>' +
          '<span class="' + (nota.fase === 'TESTE' ? 'fase fase--teste' : nota.fase === 'REGIME_PLENO' ? 'fase fase--pleno' : 'fase') + '">' +
          sanitizar(nota.rotulo) + '</span>' +
          '<span class="' + efeitoClasse + '">' + setaDelta(delta) + moedaSinal(nota.efeitoAbsoluto) +
          ' · ' + pontos(nota.efeitoPontosPercentuais) + '</span>' +
          '</div>' +
          '<p class="nota__resumo">' + sanitizar(nota.resumo) + '</p>' +
          '<ul class="nota__mudancas">' +
          (nota.mudancas || []).map((mudanca) => '<li>' + sanitizar(mudanca) + '</li>').join('') +
          '</ul>' +
          '<p class="nota__comparacao"><strong>Comparação com o método anterior:</strong> ' +
          sanitizar(nota.comparacaoMetodoAnterior) + '</p>' +
          '<p class="nota__fundamento">' + sanitizar(nota.fundamento || '') + '</p>' +
          '</li>'
        );
      })
      .join('');
  }

  /* ------------------------------------------------- tabela de ICMS interestadual */

  function renderTabelaIcms(projecao) {
    const linhas = estado.parametros.tabelaIcmsInterestadual || [];
    if (!linhas.length) {
      el.tabelaIcms.innerHTML = '';
      return;
    }

    const origens = [];
    const destinos = [];
    linhas.forEach((linha) => {
      if (!origens.includes(linha.origem)) origens.push(linha.origem);
      if (!destinos.includes(linha.destino)) destinos.push(linha.destino);
    });

    const selecionada = projecao.tipoOperacao === 'INTERESTADUAL'
      ? {
          origem: (estado.parametros.ufs.find((uf) => uf.valor === projecaoOrigem(projecao)) || {}).descricao,
          destino: (estado.parametros.ufs.find((uf) => uf.valor === projecaoDestino(projecao)) || {}).descricao
        }
      : { origem: null, destino: null };

    let html = '<table class="tabela-icms__table"><caption class="sr-only">Alíquotas de ICMS interestadual por região</caption><thead><tr><th scope="col">Origem · Destino →</th>';
    destinos.forEach((destino) => {
      const destaque = destino === selecionada.destino ? ' class="is-selecionado"' : '';
      html += '<th scope="col"' + destaque + '>' + sanitizar(REGIAO_CURTA[destino] || destino) + '</th>';
    });
    html += '</tr></thead><tbody>';

    origens.forEach((origem) => {
      const destaqueOrigem = origem === selecionada.origem ? ' class="is-selecionado"' : '';
      html += '<tr><th scope="row"' + destaqueOrigem + '>' + sanitizar(REGIAO_CURTA[origem] || origem) + '</th>';

      destinos.forEach((destino) => {
        const linha = linhas.find((l) => l.origem === origem && l.destino === destino);
        const aliquota = linha ? Number(linha.aliquota) : null;
        const destaque = origem === selecionada.origem && destino === selecionada.destino
          ? ' class="is-selecionado"'
          : '';
        html += '<td' + destaque + '>' + (aliquota != null ? numero(aliquota) + '%' : '—') + '</td>';
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    el.tabelaIcms.innerHTML = html;
  }

  function projecaoOrigem(projecao) {
    return (estado.requisicao && estado.requisicao.ufOrigem) || el.ufOrigem.value;
  }

  function projecaoDestino(projecao) {
    return (estado.requisicao && estado.requisicao.ufDestino) || el.ufDestino.value;
  }

  /* ---------------------------------------------------------------- CSV */

  function exportarCsv() {
    if (!estado.projecao) return;

    const projecao = estado.projecao;
    const linhas = [
      ['Ano', 'Fase', 'Dias uteis', 'Valor do periodo', 'CBS', 'IBS UF', 'IBS Mun', 'ICMS',
        'PIS', 'COFINS', 'ISS', 'Total destacado', 'Carga efetiva', '% do frete',
        'Variacao vs ano anterior (R$)', 'Variacao vs ano anterior (p.p.)']
    ];

    projecao.anos.forEach((ano) => {
      linhas.push([
        ano.ano,
        ano.rotulo,
        ano.diasUteis,
        numero(ano.valorFretePeriodo),
        numero(ano.valorCbs),
        numero(ano.valorIbsUf),
        numero(ano.valorIbsMun),
        numero(ano.valorIcms),
        numero(ano.valorPis),
        numero(ano.valorCofins),
        numero(ano.valorIss),
        numero(ano.totalDestacado),
        numero(ano.totalEfetivo),
        numero(ano.percentualTotal),
        numero(ano.variacaoAnoAnteriorAbsoluta),
        numero(ano.variacaoAnoAnteriorPontosPercentuais)
      ]);
    });

    linhas.push([]);
    linhas.push(['Valor informado', numero(projecao.valorFrete)]);
    linhas.push(['Periodicidade', projecao.periodicidade]);
    linhas.push(['Mes de referencia', projecao.mesReferencia]);
    linhas.push(['Dias uteis no periodo (2025)', projecao.diasUteisReferencia]);
    linhas.push(['Valor por dia util', numero(projecao.valorFreteDiario)]);
    linhas.push(['Servico', projecao.descricaoNbs + ' (' + projecao.nbs + ')']);
    linhas.push(['Tipo de operacao', projecao.tipoOperacao]);
    linhas.push(['Aliquota ICMS', numero(projecao.aliquotaIcms)]);
    linhas.push(['Aliquota ISS', numero(projecao.aliquotaIss)]);
    linhas.push(['Regime PIS/COFINS', projecao.regimePisCofins]);
    linhas.push(['Versao da base', projecao.versaoBaseDados || '']);

    linhas.push([]);
    linhas.push(['Notas por etapa']);
    linhas.push(['Ano', 'Resumo', 'Mudancas', 'Comparacao com o metodo anterior', 'Fundamento']);
    (projecao.notasEtapa || []).forEach((nota) => {
      linhas.push([
        nota.ano,
        nota.resumo,
        (nota.mudancas || []).join(' | '),
        nota.comparacaoMetodoAnterior,
        nota.fundamento || ''
      ]);
    });

    const csv = '\ufeff' + linhas.map((linha) => linha.join(';')).join('\r\n');
    const arquivo = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(arquivo);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'projecao-frete-' + projecao.anos[projecao.anos.length - 1].ano + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* --------------------------------------------------------------- estado UI */

  function definirStatus(texto, erro) {
    el.status.textContent = texto || '';
    el.status.dataset.erro = erro ? 'true' : 'false';
  }

  function definirCarregando(carregando) {
    el.btnSimular.disabled = carregando;
    el.btnSimular.textContent = carregando ? 'Calculando…' : 'Calcular projeção';
    el.grafico.setAttribute('aria-busy', carregando ? 'true' : 'false');
  }

  function mostrarErro(mensagem) {
    el.alerta.hidden = false;
    el.alerta.innerHTML = '<strong>Não foi possível concluir a simulação.</strong>' + sanitizar(mensagem);
  }

  function limparErro() {
    el.alerta.hidden = true;
    el.alerta.innerHTML = '';
  }

  /* ------------------------------------------------------------ orquestração */

  function payload() {
    const valor = parseValor(el.valorFrete.value);
    const tipo = el.tipoOperacao.value;
    const aliquota = parseValor(el.aliquota.value);

    const corpo = {
      valorFrete: Number.isFinite(valor) ? valor : 0,
      periodicidade: estado.periodicidade,
      mesReferencia: Number(el.mesReferencia.value),
      nbs: el.servico.value,
      tipoOperacao: tipo,
      regimePisCofins: el.regime.value,
      incluirMemoriaCalculo: true,
      parametrosTransicao: coletarParametrosTransicao()
    };

    if (tipo === 'INTERESTADUAL') {
      corpo.ufOrigem = el.ufOrigem.value;
      corpo.ufDestino = el.ufDestino.value;
    } else if (tipo === 'MUNICIPAL') {
      corpo.uf = el.ufDestino.value;
      corpo.aliquotaIss = Number.isFinite(aliquota) ? aliquota : 5;
    } else {
      corpo.uf = el.ufDestino.value;
      corpo.aliquotaIcms = Number.isFinite(aliquota) ? aliquota : 18;
    }

    return corpo;
  }

  async function simular() {
    limparErro();

    const valor = parseValor(el.valorFrete.value);
    if (!Number.isFinite(valor) || valor <= 0) {
      mostrarErro('Informe um valor de frete maior que zero.');
      definirStatus('Valor do frete inválido.', true);
      el.valorFrete.focus();
      return;
    }

    definirCarregando(true);
    definirStatus('Consultando a calculadora oficial…', false);

    try {
      const requisicao = payload();
      estado.requisicao = requisicao;
      const projecao = await calcular(requisicao);
      estado.projecao = projecao;
      estado.anoSelecionado = null;
      el.memoria.hidden = true;

      renderKpis(projecao);
      renderGrafico(projecao);
      renderTabelaEvolucao(projecao);
      renderTabelaComposicao(projecao);
      renderNotas(projecao);
      renderTabelaIcms(projecao);
      renderAvisos(projecao);

      el.versaoBase.textContent = projecao.versaoBaseDados || '—';
      el.subtituloGrafico.textContent =
        'Frete ' + periodoRotulo(projecao.periodicidade) + ' de ' + moeda(projecao.valorFrete) + ' · ' +
        (projecao.descricaoNbs || projecao.nbs) + ' · ' + MESES[projecao.mesReferencia - 1];

      definirStatus('Projeção atualizada com a base ' + (projecao.versaoBaseDados || 'oficial') + '.', false);
    } catch (erro) {
      mostrarErro(erro.message);
      definirStatus('Falha ao calcular.', true);
    } finally {
      definirCarregando(false);
    }
  }

  function renderAvisos(projecao) {
    el.avisos.innerHTML = (projecao.avisos || []).map((aviso) => '<li>' + sanitizar(aviso) + '</li>').join('');
  }

  function restaurar() {
    el.valorFrete.value = '10.000,00';
    el.tipoOperacao.value = 'INTERESTADUAL';
    el.regime.value = 'NAO_CUMULATIVO';
    el.servico.value = estado.parametros.servicosFrete[0].nbs;
    el.ufOrigem.value = 'SP';
    el.ufDestino.value = 'BA';
    el.mesReferencia.value = String(estado.mesReferencia);
    estado.periodicidade = 'MENSAL';
    sincronizarPeriodicidade();
    sincronizarTipoOperacao();
    montarTabelaParametros(estado.parametros);
    simular();
  }

  /* ----------------------------------------------------------------- eventos */

  el.form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    simular();
  });

  el.segmented.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-periodicidade]');
    if (!botao) return;

    estado.periodicidade = botao.dataset.periodicidade;
    sincronizarPeriodicidade();
    simular();
  });

  el.mesReferencia.addEventListener('change', () => {
    estado.mesReferencia = Number(el.mesReferencia.value);
    simular();
  });

  el.tipoOperacao.addEventListener('change', () => {
    sincronizarTipoOperacao();
    simular();
  });

  [el.ufOrigem, el.ufDestino].forEach((select) => {
    select.addEventListener('change', () => {
      atualizarHintIcms();
      simular();
    });
  });

  el.valorFrete.addEventListener('blur', () => {
    const valor = parseValor(el.valorFrete.value);
    if (Number.isFinite(valor)) el.valorFrete.value = numero(valor);
  });

  el.btnRestaurar.addEventListener('click', restaurar);
  el.btnCsv.addEventListener('click', exportarCsv);
  el.btnFecharMemoria.addEventListener('click', () => {
    el.memoria.hidden = true;
    estado.anoSelecionado = null;
    [el.tabelaEvolucao, el.tabelaComposicao].forEach((tabela) => {
      tabela.querySelectorAll('tbody tr').forEach((tr) => tr.classList.remove('is-selecionado'));
    });
  });

  let timerRedesenho = null;
  window.addEventListener('resize', () => {
    if (!estado.projecao) return;
    window.clearTimeout(timerRedesenho);
    timerRedesenho = window.setTimeout(() => renderGrafico(estado.projecao), 200);
  });

  /* -------------------------------------------------------- utilitários globais */

  window.SimuladorFrete = {
    API,
    moeda,
    numero,
    percentual,
    percentualCurto,
    pontos,
    moedaSinal,
    sanitizar,
    parseValor
  };

  /* ------------------------------------------------------------------- boot */

  (async function iniciar() {
    renderLegenda();
    definirCarregando(true);
    definirStatus('Carregando parâmetros…', false);

    try {
      estado.parametros = await carregarParametros();
      montarSelects(estado.parametros);
      montarTabelaParametros(estado.parametros);
      sincronizarPeriodicidade();
      sincronizarTipoOperacao();
      await simular();
    } catch (erro) {
      mostrarErro(erro.message);
      definirStatus('Não foi possível carregar o simulador.', true);
      definirCarregando(false);
    }
  })();
})();
