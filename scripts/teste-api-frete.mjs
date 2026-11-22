// Testes de contrato do simulador de frete (executado contra a aplicação local).
const BASE = 'http://localhost:8080/api/calculadora/frete';

async function postar(corpo) {
  const resposta = await fetch(BASE + '/projecao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  const texto = await resposta.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { /* corpo não-JSON */ }
  return { status: resposta.status, json, texto };
}

function resumir(rotulo, resultado) {
  if (resultado.json && resultado.json.anos) {
    const referencia = resultado.json.anos[0];
    const pleno = resultado.json.anos.find((a) => a.fase === 'REGIME_PLENO');
    console.log(
      `${rotulo}: HTTP ${resultado.status} · ${referencia.ano}: ${referencia.totalEfetivo} (${referencia.percentualTotal}%)`
      + ` · ${pleno.ano}: ${pleno.totalEfetivo} (${pleno.percentualTotal}%)`
      + ` · dias ref ${resultado.json.diasUteisReferencia}`
    );
    return;
  }
  const detalhe = resultado.json
    ? (resultado.json.detail || resultado.json.title || JSON.stringify(resultado.json))
    : resultado.texto;
  console.log(`${rotulo}: HTTP ${resultado.status} · ${detalhe}`);
}

(async () => {
  resumir('1 mensal nov SP->BA', await postar({
    valorFrete: 10000, periodicidade: 'MENSAL', mesReferencia: 11,
    tipoOperacao: 'INTERESTADUAL', ufOrigem: 'SP', ufDestino: 'BA', nbs: '105011220'
  }));
  resumir('2 diário', await postar({ valorFrete: 500, periodicidade: 'DIARIO', ufOrigem: 'SP', ufDestino: 'BA' }));
  resumir('3 quinzenal', await postar({ valorFrete: 5000, periodicidade: 'QUINZENAL', ufOrigem: 'SP', ufDestino: 'BA' }));
  resumir('4 mensal fev', await postar({ valorFrete: 10000, periodicidade: 'MENSAL', mesReferencia: 2, ufOrigem: 'SP', ufDestino: 'BA' }));
  resumir('5 interna', await postar({ valorFrete: 10000, tipoOperacao: 'INTERNA', aliquotaIcms: 18, uf: 'MG' }));
  resumir('6 municipal', await postar({ valorFrete: 10000, tipoOperacao: 'MUNICIPAL', aliquotaIss: 5, uf: 'SP' }));
  resumir('7 NBS inexistente', await postar({ valorFrete: 1000, nbs: '999999999' }));
  resumir('8 valor zero', await postar({ valorFrete: 0 }));
  resumir('9 UF inválida', await postar({ valorFrete: 1000, ufOrigem: 'XX', ufDestino: 'BA' }));
  resumir('10 sobrescrita 2033', await postar({
    valorFrete: 1000,
    parametrosTransicao: [{ ano: 2033, cbs: 10, ibsUf: 18, ibsMun: 3, reducaoIcmsIss: 100 }]
  }));
  resumir('11 sobrescrita 2026', await postar({ valorFrete: 1000, parametrosTransicao: [{ ano: 2026, cbs: 1 }] }));
  resumir('12 tipo inválido', await postar({ valorFrete: 1000, tipoOperacao: 'ESPACIAL' }));
  resumir('13 periodicidade inválida', await postar({ valorFrete: 1000, periodicidade: 'SEMANAL' }));

  const mensal = await postar({
    valorFrete: 10000, periodicidade: 'MENSAL', mesReferencia: 11,
    tipoOperacao: 'INTERESTADUAL', ufOrigem: 'SP', ufDestino: 'BA', incluirMemoriaCalculo: true
  });
  const anos = mensal.json.anos;
  console.log('\n14 série mensal (SP->BA):');
  anos.forEach((a) => {
    console.log(
      `   ${a.ano} | ${a.diasUteis} du | base ${a.valorFretePeriodo} | ICMS ${a.valorIcms}`
      + ` | CBS ${a.valorCbs} | IBS ${Number(a.valorIbsUf) + Number(a.valorIbsMun)}`
      + ` | efetiva ${a.totalEfetivo} (${a.percentualTotal}%)`
      + ` | vs ano anterior ${a.variacaoAnoAnteriorAbsoluta} / ${a.variacaoAnoAnteriorPontosPercentuais} p.p.`
    );
  });

  console.log('\n15 notas por etapa:', mensal.json.notasEtapa.length);
  mensal.json.notasEtapa.slice(0, 2).forEach((n) => {
    console.log(`   ${n.ano} ${n.rotulo}: ${n.resumo}`);
    console.log('     mudanças:', n.mudancas.length, '| fundamento:', n.fundamento);
  });

  console.log('\n16 memória de cálculo 2029:',
    mensal.json.anos.find((a) => a.ano === 2029).memoriaCalculo ? 'presente' : 'ausente');
  console.log('17 resumo:', JSON.stringify(mensal.json.resumo));
  console.log('18 avisos:', mensal.json.avisos.length);

  const parametros = await (await fetch(BASE + '/parametros')).json();
  console.log('19 parametros:', JSON.stringify({
    servicos: parametros.servicosFrete.length,
    periodicidades: parametros.periodicidades.length,
    ufs: parametros.ufs.length,
    tabelaIcms: parametros.tabelaIcmsInterestadual.length,
    transicao: parametros.parametrosTransicao.length,
    notas: parametros.notas.length
  }));

  const sete = parametros.tabelaIcmsInterestadual.filter((l) => Number(l.aliquota) === 7).length;
  const doze = parametros.tabelaIcmsInterestadual.filter((l) => Number(l.aliquota) === 12).length;
  console.log('20 tabela ICMS: 7% em', sete, 'combinações e 12% em', doze, 'combinações');

  /* ------------------------------------------------------------------ CT-e */

  const CTE = BASE + '/cte';

  async function pagar(corpo) {
    const resposta = await fetch(CTE + '/pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    const texto = await resposta.text();
    let json = null;
    try { json = JSON.parse(texto); } catch (e) { /* corpo não-JSON */ }
    return { status: resposta.status, json, texto };
  }

  const cteParametros = await (await fetch(CTE + '/parametros')).json();
  console.log('21 parâmetros do CT-e:', JSON.stringify({
    transportadores: cteParametros.tiposTransportador.length,
    regimes: cteParametros.regimesPagadora.length,
    anos: cteParametros.anosDisponiveis.length,
    referencia: cteParametros.dataReferencia
  }));

  const exemplo = await (await fetch(CTE + '/exemplo')).json();
  const r = exemplo.resultado;
  console.log('22 exemplo de CT-e:', JSON.stringify({
    base: r.baseCalculo,
    tributos: r.totalTributos,
    percentual: r.percentualTributos,
    creditos: r.creditoTotal,
    liquido: r.liquidoTransportador,
    desembolso: r.desembolsoTotal,
    chave: r.chaveAcesso.length,
    conferencias: r.conferencias.length,
    comparativo: r.comparativo.map((a) => `${a.ano}:${a.percentualTotal}%`)
  }));

  const tac = await pagar({ ...exemplo.entrada, tipoTransportador: 'TAC', dataPagamento: '2026-11-20' });
  console.log('23 TAC 2026:', JSON.stringify({
    retencoes: tac.json.retencoes.map((x) => `${x.codigo}:${x.valor}`),
    total: tac.json.totalRetencoes,
    liquido: tac.json.liquidoTransportador
  }));

  const em2027 = await pagar({ ...exemplo.entrada, dataPagamento: '2027-06-15' });
  console.log('24 pagamento em 2027:', JSON.stringify({
    tributos: em2027.json.totalTributos,
    percentual: em2027.json.percentualTributos,
    creditoIbsCbs: em2027.json.creditoIbsCbs,
    custoNaoRecuperavel: em2027.json.custoNaoRecuperavel,
    split: em2027.json.comparativo[1].valorSplitPayment
  }));

  const simples = await pagar({ ...exemplo.entrada, regimePagadora: 'SIMPLES' });
  console.log('25 pagadora no Simples:', JSON.stringify({
    creditos: simples.json.creditoTotal,
    custoNaoRecuperavel: simples.json.custoNaoRecuperavel
  }));

  const dataInvalida = await pagar({ fretePeso: 1000, dataPagamento: '2025-06-15' });
  console.log('26 data fora da cobertura: HTTP', dataInvalida.status, '·', dataInvalida.json?.detail || '');
  const baseZero = await pagar({ fretePeso: 0, freteValor: 0 });
  console.log('27 base zero: HTTP', baseZero.status, '·', baseZero.json?.detail || '');

  /* --------------------------------------------------------------- produto */

  const produto = await (await fetch(BASE + '/produto')).json();
  console.log('28 produto:', JSON.stringify({
    total: produto.total,
    prontos: produto.prontos,
    parciais: produto.parciais,
    faltantes: produto.faltantes,
    cobertura: produto.cobertura,
    ondas: produto.ondas.length,
    clausulas: produto.clausulas.length,
    dimensoes: [...new Set(produto.lacunas.map((l) => l.dimensao))]
  }));

  const anexo = await fetch(BASE + '/produto/anexo');
  const textoAnexo = await anexo.text();
  console.log('29 anexo:', JSON.stringify({
    status: anexo.status,
    tipo: anexo.headers.get('content-type'),
    bytes: textoAnexo.length,
    clausulas: (textoAnexo.match(/^### \d+\./gm) || []).length,
    temCronograma: textoAnexo.includes('Anexo I')
  }));
})();
