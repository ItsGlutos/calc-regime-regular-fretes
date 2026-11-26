/**
 * Horizonte do pagador de frete: o gasto de hoje e o de amanhã.
 *
 * Este módulo NÃO apura tributo. Ele recebe os percentuais da projeção oficial
 * do motor (valor do tributo ÷ valor do frete) e responde a três perguntas:
 *
 *   1. quanto eu pago hoje e quanto vou pagar em cada ano (desembolso e custo
 *      líquido depois do crédito total: ICMS + PIS/COFINS + CBS/IBS);
 *   2. quanto eu DEVERIA pagar — o benchmark do regime regular no mesmo valor
 *      e o preço-teto do regime atual que empata com ele;
 *   3. como me ajustar — as ações com número em cada ano.
 *
 * A conta do crédito é fiscal e está em `creditosDoPagador` (domain.js); aqui
 * ficam só a aritmética, os cenários e o texto.
 */
import { PERFIS, arredondar, creditosDoPagador, formatarNumero, rotuloAnoReforma } from './domain.js'

export const ANOS_HORIZONTE = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

const brl = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0)

const pct = (valor, casas = 2) => `${formatarNumero(valor, casas)}%`

const quatro = (valor) => Number((Number(valor) || 0).toFixed(4))

const perfilRegular = PERFIS.find((perfil) => perfil.id === 'REGIME_REGULAR')

/** Fator de repasse integral: o preço que preserva a receita líquida do transportador. */
export function fatorRepasse(cargaHoje, cargaAno) {
  const de = 1 - (Number(cargaHoje) || 0) / 100
  const para = 1 - (Number(cargaAno) || 0) / 100
  if (de <= 0 || para <= 0) return null
  return de / para
}

function resumoLinha(linha) {
  return linha?.disponivel ? linha : null
}

export function construirHorizonte({
  valorFrete,
  perfil,
  regimePagadora,
  tipoOperacao,
  anoHoje,
  serie,
  taxaSimples,
  dados = {},
}) {
  const base = arredondar(valorFrete)
  const anoBase = Number(anoHoje)
  const porAno = new Map(serie.map((linha) => [Number(linha.ano), linha]))
  const linhaBase = porAno.get(anoBase)
  const cargaHoje = linhaBase?.carga ?? 0
  const creditoBase = linhaBase
    ? creditosDoPagador({
        perfil,
        regimePagadora,
        tipoOperacao,
        ano: anoBase,
        percentuais: linhaBase.percentuais,
        taxaSimples: taxaSimples(anoBase),
      })
    : null
  const creditoHoje = (creditoBase?.percentual ?? 0) / 100
  const anos = ANOS_HORIZONTE.filter((ano) => ano >= anoBase)
  const linhas = []

  for (const ano of anos) {
    const bruta = porAno.get(ano)
    if (!bruta) {
      linhas.push({ ano, rotulo: rotuloAnoReforma(ano), disponivel: false })
      continue
    }

    const credito = creditosDoPagador({
      perfil,
      regimePagadora,
      tipoOperacao,
      ano,
      percentuais: bruta.percentuais,
      taxaSimples: taxaSimples(ano),
    })
    const creditoValor = arredondar((base * credito.total) / 100)
    const liquido = arredondar(base - creditoValor)

    const creditoRegular = creditosDoPagador({
      perfil: perfilRegular,
      regimePagadora,
      tipoOperacao,
      ano,
      percentuais: bruta.percentuais,
      taxaSimples: 0,
    })
    const creditoRegularValor = arredondar((base * creditoRegular.total) / 100)
    const liquidoRegular = arredondar(base - creditoRegularValor)

    const fator = fatorRepasse(cargaHoje, bruta.carga)
    const brutoRepasse = fator ? arredondar(base * fator) : base
    const creditoRepasse = arredondar((brutoRepasse * credito.total) / 100)
    const liquidoRepasse = arredondar(brutoRepasse - creditoRepasse)

    const taxaCredito = credito.total / 100
    const precoEquivalente = taxaCredito < 1 ? arredondar(liquidoRegular / (1 - taxaCredito)) : null
    const economia = arredondar(liquido - liquidoRegular)

    // Preço de equilíbrio do pagador: mantém o custo líquido de hoje, não a
    // receita do transportador. É a leitura "quanto eu preciso pagar para não
    // sentir a reforma no meu resultado".
    const precoEquilibrio =
      taxaCredito < 1 ? arredondar((base * (1 - creditoHoje)) / (1 - taxaCredito)) : null
    const creditoEquilibrio =
      precoEquilibrio === null ? null : arredondar((precoEquilibrio * credito.percentual) / 100)
    const liquidoEquilibrio =
      precoEquilibrio === null ? null : arredondar(precoEquilibrio - creditoEquilibrio)

    // Piso do transportador: o repasse de receita líquida já calculado. Só é
    // publicado para regimes em que a carga do documento é a carga do
    // transportador. No Simples/DAS, se o pagador informar o DAS total e a
    // parcela de insumos, estimamos o piso pela margem; sem esses dados, não
    // publicamos um piso de 27%, que seria pior que não publicar.
    const temPiso = perfil.id === 'REGIME_REGULAR' || perfil.id === 'SIMPLES_HIBRIDO'
    const dadosSimples =
      perfil.id === 'SIMPLES_DAS' &&
      dados.dasTotal !== null &&
      dados.dasTotal !== undefined &&
      dados.insumos !== null &&
      dados.insumos !== undefined &&
      Number.isFinite(Number(dados.dasTotal)) &&
      Number.isFinite(Number(dados.insumos)) &&
      Number(dados.dasTotal) > 0 &&
      Number(dados.dasTotal) < 100
    let piso = null
    if (temPiso) {
      piso = {
        preco: brutoRepasse,
        credito: creditoRepasse,
        liquido: liquidoRepasse,
        variacaoPreco: quatro((brutoRepasse / base - 1) * 100),
        estimado: perfil.id === 'SIMPLES_HIBRIDO',
        fonte: 'carga',
      }
    } else if (dadosSimples) {
      const fatorInsumos = fator ?? 1
      const das = Number(dados.dasTotal) / 100
      const insumos = Number(dados.insumos) / 100
      // custos = insumos × fator + demais custos; a margem é o resíduo e se
      // cancela: P = (1 − DAS + insumos × (fator − 1)) ÷ (1 − DAS).
      const preco = arredondar((base * (1 - das + insumos * (fatorInsumos - 1))) / (1 - das))
      const creditoPiso = arredondar((preco * credito.percentual) / 100)
      const liquidoPiso = arredondar(preco - creditoPiso)
      piso = {
        preco,
        credito: creditoPiso,
        liquido: liquidoPiso,
        variacaoPreco: quatro((preco / base - 1) * 100),
        estimado: true,
        fonte: 'margem',
      }
    }
    const conflito =
      piso && precoEquilibrio !== null ? arredondar(piso.preco - precoEquilibrio) : null
    const percentualCargaTransportador =
      perfil.id === 'SIMPLES_DAS' &&
      dados.dasTotal !== null &&
      dados.dasTotal !== undefined &&
      Number.isFinite(Number(dados.dasTotal))
        ? Number(dados.dasTotal)
        : bruta.carga

    linhas.push({
      ano,
      rotulo: rotuloAnoReforma(ano),
      disponivel: true,
      bruto: base,
      carga: arredondar((base * bruta.carga) / 100),
      percentualCarga: quatro(bruta.carga),
      percentualCargaTransportador: quatro(percentualCargaTransportador),
      credito: {
        icms: arredondar((base * credito.icms) / 100),
        pisCofins: arredondar((base * credito.pisCofins) / 100),
        cbsIbs: arredondar((base * credito.cbsIbs) / 100),
        total: creditoValor,
        percentual: quatro(credito.percentual),
        percentualIcms: quatro(credito.icms),
        percentualPisCofins: quatro(credito.pisCofins),
        percentualCbsIbs: quatro(credito.cbsIbs),
        notas: credito.notas,
      },
      liquido,
      percentualLiquido: quatro((liquido / base) * 100),
      equilibrio: {
        preco: precoEquilibrio,
        credito: creditoEquilibrio,
        liquido: liquidoEquilibrio,
        percentualCredito: quatro(credito.percentual),
        variacaoPreco:
          precoEquilibrio === null ? null : quatro((precoEquilibrio / base - 1) * 100),
        variacaoLiquido: liquidoEquilibrio === null ? null : arredondar(liquidoEquilibrio - liquido),
      },
      piso,
      conflito,
      repasse: {
        fator: fator ? Number(fator.toFixed(6)) : null,
        bruto: brutoRepasse,
        credito: creditoRepasse,
        liquido: liquidoRepasse,
        variacaoDesembolso: arredondar(brutoRepasse - base),
        variacaoLiquido: arredondar(liquidoRepasse - liquido),
      },
      benchmark: {
        rotulo: 'Regime regular',
        bruto: base,
        credito: creditoRegularValor,
        percentualCredito: quatro(creditoRegular.total),
        liquido: liquidoRegular,
      },
      equivalente: {
        preco: precoEquivalente,
        percentualPreco: precoEquivalente === null ? null : quatro((precoEquivalente / base) * 100),
        economia,
        percentualEconomia: quatro((economia / base) * 100),
        empata: precoEquivalente !== null && Math.abs(economia) < 0.005,
      },
    })
  }

  const hoje = linhas.find((linha) => linha.ano === anoBase && linha.disponivel) ?? null

  // Variações contra hoje (o primeiro ano da janela é a referência).
  for (const linha of linhas) {
    if (!linha.disponivel || !hoje) continue
    linha.variacao = {
      liquido: arredondar(linha.liquido - hoje.liquido),
      percentualLiquido: quatro(linha.percentualLiquido - hoje.percentualLiquido),
      liquidoRepasse: arredondar(linha.repasse.liquido - hoje.liquido),
      desembolsoRepasse: arredondar(linha.repasse.bruto - hoje.bruto),
      credito: arredondar(linha.credito.total - hoje.credito.total),
      carga: arredondar(linha.percentualCarga - hoje.percentualCarga),
    }
    if (linha.piso) {
      linha.piso.variacaoLiquido = arredondar(linha.piso.liquido - hoje.liquido)
    }
  }

  const pleno = linhas.find((linha) => linha.ano === 2033 && linha.disponivel) ?? null
  const proximoAno = anoBase < 2027 ? 2027 : anoBase < 2029 ? 2029 : null
  const proximoMarco = proximoAno ? (linhas.find((linha) => linha.ano === proximoAno) ?? null) : null

  const primeiroAumento = linhas.find(
    (linha) =>
      linha.disponivel &&
      linha.ano > anoBase &&
      linha.percentualCarga > (hoje?.percentualCarga ?? 0) + 0.005,
  )

  const resumo = hoje && {
    hoje: resumoLinha(hoje),
    proximo: resumoLinha(proximoMarco),
    pleno: resumoLinha(pleno),
    primeiroAumentoCarga: primeiroAumento?.ano ?? null,
    equilibrio: pleno
      ? {
          preco: pleno.equilibrio.preco,
          liquido: pleno.equilibrio.liquido,
          variacaoPreco: pleno.equilibrio.variacaoPreco,
          piso: pleno.piso,
          conflito: pleno.conflito,
        }
      : null,
    variacoes: pleno && {
      desembolsoRepasse: arredondar(pleno.repasse.bruto - hoje.bruto),
      percentualDesembolsoRepasse: quatro(
        ((pleno.repasse.bruto - hoje.bruto) / hoje.bruto) * 100,
      ),
      liquidoCongelado: arredondar(pleno.liquido - hoje.liquido),
      percentualLiquidoCongelado: quatro(
        ((pleno.liquido - hoje.liquido) / hoje.liquido) * 100,
      ),
      liquidoRepasse: arredondar(pleno.repasse.liquido - hoje.liquido),
      credito: arredondar(pleno.credito.total - hoje.credito.total),
      cargaPontos: arredondar(pleno.percentualCarga - hoje.percentualCarga),
    },
  }

  const deveria = montarDeveria({ perfil, hoje, pleno })

  return {
    hoje: resumoLinha(hoje),
    anos: linhas,
    resumo,
    deveria,
    ajustes: montarAjustes({ perfil, regimePagadora, tipoOperacao, base, hoje, pleno, linhas, primeiroAumento }),
  }
}

function montarDeveria({ perfil, hoje, pleno }) {
  if (!hoje) return null

  const detalhar = (linha) => ({
    ano: linha.ano,
    bruto: linha.bruto,
    credito: linha.credito.total,
    percentualCredito: linha.credito.percentual,
    liquido: linha.liquido,
    benchmark: linha.benchmark,
    precoEquivalente: linha.equivalente.preco,
    percentualPreco: linha.equivalente.percentualPreco,
    economia: linha.equivalente.economia,
    percentualEconomia: linha.equivalente.percentualEconomia,
    veredito: vereditoDeveria(perfil, linha),
  })

  return {
    regra:
      'O benchmark é o mesmo frete, no mesmo valor, com um transportador do regime regular: ' +
      'todo o CBS/IBS destacado vira crédito. O preço-teto é o valor que o regime atual pode cobrar ' +
      'para empatar com esse benchmark.',
    formula:
      'preço-teto = custo líquido do regime regular ÷ (1 − crédito % do regime atual); ' +
      'economia = seu custo líquido − custo líquido do regime regular.',
    hoje: detalhar(hoje),
    pleno: pleno ? detalhar(pleno) : null,
  }
}

function vereditoDeveria(perfil, linha) {
  const economia = linha.equivalente.economia
  if (perfil.id === 'REGIME_REGULAR') {
    return 'Você já está no regime que destaca e transfere todo o crédito ao tomador: hoje o crédito é ICMS + PIS/COFINS; de 2027 em diante, CBS/IBS integral. Não há crédito a recuperar — o que resta é negociar o preço do serviço.'
  }
  if (Math.abs(economia) < 0.005) {
    return `Seu custo líquido é o do regime regular: o preço de ${brl(linha.bruto)} está justo pelo crédito que o regime transfere.`
  }
  if (economia > 0) {
    return `No mesmo valor de ${brl(linha.bruto)}, o regime regular custaria ${brl(linha.benchmark.liquido)} líquidos — ${brl(economia)} a menos. Para empatar, este regime deveria cobrar até ${brl(linha.equivalente.preco)}.`
  }
  return `Este regime sai ${brl(Math.abs(economia))} mais barato que o regime regular no mesmo valor nominal.`
}

function montarAjustes({ perfil, regimePagadora, tipoOperacao, base, hoje, pleno, linhas, primeiroAumento }) {
  if (!hoje || tipoOperacao === 'B2C') {
    return [
      {
        tipo: 'b2c',
        titulo: 'Sem crédito: a comparação é de preço',
        texto:
          'Em B2C o pagador é o consumidor final e não aproveita ICMS, PIS/COFINS nem CBS/IBS. ' +
          'Negocie o preço nominal e o prazo: o regime do transportador não muda o seu custo.',
      },
    ]
  }

  const ajustes = []
  const economiaHoje = hoje.equivalente.economia

  if (perfil.id !== 'REGIME_REGULAR' && economiaHoje > 0.005) {
    ajustes.push({
      tipo: 'renegociar',
      titulo: `Renegocie o preço para até ${brl(hoje.equivalente.preco)}`,
      texto:
        `No mesmo frete de ${brl(base)}, o regime regular deixaria seu custo em ${brl(hoje.benchmark.liquido)}; ` +
        `o seu está em ${brl(hoje.liquido)}. Para empatar, ${perfil.curto} deveria cobrar no máximo ` +
        `${brl(hoje.equivalente.preco)} (${pct(hoje.equivalente.percentualPreco)} do valor atual). ` +
        `Acima disso, o regime regular no mesmo valor é mais barato depois do crédito.`,
      impacto: {
        valor: economiaHoje,
        rotulo: 'economia por período, no preço de hoje',
        anual: arredondar(economiaHoje * 12),
      },
    })
  }

  if (perfil.id === 'REGIME_REGULAR') {
    ajustes.push({
      tipo: 'caixa',
      titulo: 'O repasse não muda o seu resultado — muda o seu caixa',
      texto:
        `Com crédito integral, o CBS/IBS que você paga volta como crédito. Se o transportador repassar a carga, ` +
        `o desembolso sobe de ${brl(hoje.bruto)} para ${brl(pleno.repasse.bruto)} em 2033 ` +
        `(${pct(((pleno.repasse.bruto - hoje.bruto) / hoje.bruto) * 100)}), mas o custo líquido fica em ` +
        `${brl(pleno.repasse.liquido)} — praticamente o de hoje (${brl(hoje.liquido)}). ` +
        'Provisione o caixa, não a despesa.',
      impacto: {
        valor: arredondar(pleno.repasse.bruto - hoje.bruto),
        rotulo: 'caixa adicional por período no regime pleno',
        anual: arredondar((pleno.repasse.bruto - hoje.bruto) * 12),
      },
    })
  }

  if (perfil.id === 'REGIME_REGULAR' && regimePagadora && !regimePagadora.creditaPisCofins) {
    const linha2027 = linhas.find((linha) => linha.ano === 2027 && linha.disponivel)
    if (linha2027) {
      ajustes.push({
        tipo: 'regime',
        titulo: 'A extinção do PIS/COFINS em 2027 reduz o seu custo',
        texto:
          `No Lucro Presumido você não credita PIS/COFINS: os 9,25% do frete são custo. ` +
          `Quando o PIS/COFINS sair, em 2027, o seu custo líquido cai de ${brl(hoje.liquido)} para ` +
          `${brl(linha2027.liquido)} no mesmo valor. Não peça desconto por isso — o ganho já está na lei.`,
        impacto: {
          valor: arredondar(hoje.liquido - linha2027.liquido),
          rotulo: 'redução de custo por período em 2027',
          anual: arredondar((hoje.liquido - linha2027.liquido) * 12),
        },
      })
    }
  }

  if (perfil.id === 'SIMPLES_HIBRIDO' && hoje.credito.percentual < 1) {
    const linha2027 = linhas.find((linha) => linha.ano === 2027 && linha.disponivel)
    if (linha2027) {
      ajustes.push({
        tipo: 'regime',
        titulo: 'O híbrido só passa a dar crédito em 2027',
        texto:
          `Hoje o híbrido não destaca ICMS nem PIS/COFINS (ficam no DAS) e o CBS/IBS de 2026 é compensado ` +
          `pelo transportador: o crédito é zero. Em 2027 ele passa a destacar 8,50% e o seu custo líquido cai ` +
          `de ${brl(hoje.liquido)} para ${brl(linha2027.liquido)} no mesmo valor. Vale contratar a partir do ` +
          'ano-calendário de 2027, não antes.',
        impacto: {
          valor: arredondar(hoje.liquido - linha2027.liquido),
          rotulo: 'queda de custo por período em 2027',
          anual: arredondar((hoje.liquido - linha2027.liquido) * 12),
        },
      })
    }
  }

  if (pleno && hoje && pleno.equivalente.economia > economiaHoje + 0.005) {
    ajustes.push({
      tipo: 'contrato',
      titulo: 'O gap cresce até o regime pleno: trave a cláusula agora',
      texto:
        `A diferença contra o regime regular sai de ${brl(hoje.equivalente.economia)} por período hoje e chega ` +
        `a ${brl(pleno.equivalente.economia)} em 2033 (${pct(pleno.percentualCarga)} de carga contra ` +
        `${pct(hoje.percentualCarga)}). Inclua no contrato o direito de revisar o preço quando a alíquota mudar ` +
        'e o prazo de vigência até 2033.',
      impacto: {
        valor: arredondar(pleno.equivalente.economia - hoje.equivalente.economia),
        rotulo: 'aumento do gap por período até 2033',
        anual: arredondar((pleno.equivalente.economia - hoje.equivalente.economia) * 12),
      },
    })
  }

  if (primeiroAumento) {
    const linha2027 = linhas.find((linha) => linha.ano === 2027 && linha.disponivel)
    const sobe2027 = linha2027 ? arredondar(linha2027.liquido - hoje.liquido) : 0
    ajustes.push({
      tipo: 'calendario',
      titulo: `${primeiroAumento.ano}: a carga do serviço supera a de hoje`,
      texto:
        `A carga passa de ${pct(hoje.percentualCarga)} em ${hoje.ano} para ` +
        `${pct(primeiroAumento.percentualCarga)} em ${primeiroAumento.ano}. É o ano de revisar o contrato ` +
        `e o orçamento de frete.` +
        (sobe2027 > 0.005
          ? ` Atenção a 2027: a carga cai (PIS/COFINS extinto), mas o seu crédito cai junto — de ` +
            `${pct(hoje.credito.percentual)} para ${pct(linha2027.credito.percentual)} — e o custo líquido ` +
            `sobe ${brl(sobe2027)} no mesmo preço. É troca de tributo com crédito menor, não aumento de carga.`
          : ''),
      impacto: {
        valor: arredondar((base * (primeiroAumento.percentualCarga - hoje.percentualCarga)) / 100),
        rotulo: 'carga adicional por período no primeiro aumento',
        anual: arredondar((base * (primeiroAumento.percentualCarga - hoje.percentualCarga) * 12) / 100),
      },
    })
  }

  if (perfil.id === 'SIMPLES_DAS' && pleno) {
    ajustes.push({
      tipo: 'regime',
      titulo: 'No Simples o crédito não acompanha o regime pleno',
      texto:
        `O crédito do DAS fica em ${pct(hoje.credito.percentual)} e não sobe com os 27,00% do regime regular. ` +
        `Em 2033, para empatar com o regime regular no mesmo valor, o Simples teria de cobrar até ` +
        `${brl(pleno.equivalente.preco)}. Se o preço não cair nessa direção, o custo líquido continua acima.`,
      impacto: {
        valor: pleno.equivalente.economia,
        rotulo: 'economia por período se renegociar ao teto em 2033',
        anual: arredondar(pleno.equivalente.economia * 12),
      },
    })
  }

  return ajustes
}
