# Exemplo funcional — a indústria que paga R$ 10.000/mês de frete

**Por:** Especialista Fiscal · **Revisão 2:** 24/11/2026, 21h — rodada contra o build com o crédito total
**Executável:** `scripts/exemplo-pagador.mjs` (Node 20+; roda contra os serviços no ar, sem instalar nada)
**Saída completa desta execução:** [exemplo-execucao.md](exemplo-execucao.md) — gerada pelo script, com todas as chamadas listadas.

```powershell
# com os três serviços no ar (5180, 8080, 8082):
node scripts/exemplo-pagador.mjs                 # imprime o relatório
node scripts/exemplo-pagador.mjs --arquivo       # grava docs/especialista-fiscal/exemplo-execucao.md
```

O script **não digita nenhum número fiscal**: chama `/api/simular`, `/api/reforma`, `/api/comparar` e `/api/pagador` no app, `POST /frete/projecao` e os endpoints de CT-e no motor, e faz a aritmética de forma independente. A coluna "divergência" da seção 3 compara as duas contas: **todas zeradas** nesta rodada.

## O que mudou nesta rodada (e o que segue igual)

| Item | Revisão 1 (20h39) | Revisão 2 (21h) |
|---|---|---|
| Crédito do regime regular | só CBS/IBS (8,50% em 2027) | **ICMS + PIS/COFINS + CBS/IBS (15,50%)** — confere com o cálculo independente em todos os anos |
| Custo líquido de 2025/2026 | R$ 1.000,00 (crédito zero) | **R$ 837,50** (16,25%) |
| Comparador | empatava híbrido e regular em R$ 9.150,00 | **regular R$ 8.450,00 · híbrido R$ 9.150,00 · Simples/DAS R$ 9.761,49** |
| CBS/IBS em 2026 | creditava 1,00% (e 2,39% no Simples) | **zero** para todos os perfis (art. 348, I e III, "c") |
| Hoje → amanhã / preço-teto / repasse | não existia | **`POST /api/pagador`** — 9.911,24 de repasse em 2027 e teto de 8.656,47, batendo com o cálculo independente |
| MEI e Simples/DAS sem PGDAS | faixas 1,8%–4% e 0,92%–4% | **iguais** — segue sem base legal (ver seção 12) |
## 1. A pagadora e o contrato

- **Indústria de Alimentos Bom Sabor S.A.** (CNPJ 98.765.432/0001-10), indústria de alimentos em SP, **Lucro Real**, operação **B2B**.
- Frete rodoviário **SP → BA**, NBS `105011220`, **R$ 10.000,00 por mês**, 40 carretas/mês (R$ 250,00 por CT-e médio).
- Contrato: reajuste anual em janeiro, preço único por rota.
- Transportadoras:

| Transportadora | Regime | Preço nominal |
|---|---|---:|
| Rota Sul Logística | Simples Nacional — CBS/IBS dentro do DAS | R$ 10.000,00 |
| Via Brasil Transportes | Simples Nacional — híbrido (CBS/IBS no regime regular) | R$ 10.000,00 |
| Serra Azul Cargas | Regime regular (Lucro Real) | R$ 10.000,00 |

## 2. O que o motor oficial apura para o frete (projeção)

`POST /api/calculadora/frete/projecao` — R$ 10.000,00 mensais, novembro, SP → BA, PIS/COFINS não cumulativo.

| Ano | Valor do período | ICMS | PIS | COFINS | CBS | IBS UF | IBS mun. | Total destacado | Total efetivo | % efetivo |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | R$ 10.000,00 | 700,00 | 165,00 | 760,00 | 0,00 | 0,00 | 0,00 | 1.625,00 | 1.625,00 | 16,25% |
| 2026 | R$ 10.500,00 | 735,00 | 173,25 | 798,00 | 94,50 | 10,50 | 0,00 | 1.811,25 | 1.706,25 | 16,25% |
| 2027 | R$ 11.000,00 | 770,00 | 0,00 | 0,00 | 924,00 | 5,50 | 5,50 | 1.705,00 | 1.705,00 | 15,50% |
| 2028 | R$ 11.000,00 | 770,00 | 0,00 | 0,00 | 924,00 | 5,50 | 5,50 | 1.705,00 | 1.705,00 | 15,50% |
| 2029 | R$ 11.000,00 | 693,00 | 0,00 | 0,00 | 935,00 | 176,00 | 27,50 | 1.831,50 | 1.831,50 | 16,65% |
| 2030 | R$ 10.500,00 | 588,00 | 0,00 | 0,00 | 892,50 | 336,00 | 52,50 | 1.869,00 | 1.869,00 | 17,80% |
| 2031 | R$ 10.000,00 | 490,00 | 0,00 | 0,00 | 850,00 | 480,00 | 75,00 | 1.895,00 | 1.895,00 | 18,95% |
| 2032 | R$ 11.000,00 | 462,00 | 0,00 | 0,00 | 935,00 | 704,00 | 110,00 | 2.211,00 | 2.211,00 | 20,10% |
| 2033 | R$ 11.000,00 | 0,00 | 0,00 | 0,00 | 935,00 | 1.760,00 | 275,00 | 2.970,00 | 2.970,00 | 27,00% |

O valor do período muda porque o motor conta os dias úteis de cada ano (20 em 2025). Para comparar **o mesmo frete nominal**, as tabelas seguintes aplicam o **percentual** do motor sobre R$ 10.000,00: `tributo = 10.000 × percentual / 100`.


## 3. O app × o cálculo independente (a divergência deve ser zero)

Coluna "app": `creditoTotal` e `custoTotal` devolvidos por `POST /api/simular`. Coluna "independente": `ICMS + PIS + COFINS + CBS + IBS` calculado neste script a partir da projeção do motor. "Divergência" = app − independente.

| Ano | app · crédito | app · % | app · custo | independente · crédito | % | custo | divergência crédito | divergência custo |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026 | R$ 1.625,00 | 16,25% | R$ 8.375,00 | R$ 1.625,00 | 16,25% | R$ 8.375,00 | R$ 0,00 | R$ 0,00 |
| 2027 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | R$ 0,00 | R$ 0,00 |
| 2028 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | R$ 0,00 | R$ 0,00 |
| 2029 | R$ 1.665,00 | 16,65% | R$ 8.335,00 | R$ 1.665,00 | 16,65% | R$ 8.335,00 | R$ 0,00 | R$ 0,00 |
| 2030 | R$ 1.780,00 | 17,80% | R$ 8.220,00 | R$ 1.780,00 | 17,80% | R$ 8.220,00 | R$ 0,00 | R$ 0,00 |
| 2031 | R$ 1.895,00 | 18,95% | R$ 8.105,00 | R$ 1.895,00 | 18,95% | R$ 8.105,00 | R$ 0,00 | R$ 0,00 |
| 2032 | R$ 2.010,00 | 20,10% | R$ 7.990,00 | R$ 2.010,00 | 20,10% | R$ 7.990,00 | R$ 0,00 | R$ 0,00 |
| 2033 | R$ 2.700,00 | 27,00% | R$ 7.300,00 | R$ 2.700,00 | 27,00% | R$ 7.300,00 | R$ 0,00 | R$ 0,00 |

**Divergência máxima em todo o horizonte: R$ 0,00 (convergência total).** O app passou a somar ICMS e PIS/COFINS ao crédito e a zerar o CBS/IBS de 2026: os dois lados batem ano a ano.

Ressalva de API: `/api/simular` mantém os campos legados `credito` e `custoLiquido` com o valor **só de CBS/IBS** (R$ 850,00 e R$ 9.150,00 em 2027), ao lado de `creditoTotal`/`custoTotal` (R$ 1.550,00 e R$ 8.450,00). Em `/api/reforma`, os mesmos nomes `credito`/`custoLiquido` já valem o total. Quem consumir a API precisa saber qual campo está lendo.


## 4. Crédito total apropriável (ICMS + PIS/COFINS + CBS/IBS)

Composição do crédito e efeito no custo, com o preço congelado em R$ 10.000,00.

| Ano | ICMS | PIS | COFINS | CBS | IBS | Crédito total | % do frete | Custo líquido | Variação vs 2025 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 700,00 | 165,00 | 760,00 | 0,00 | 0,00 | R$ 1.625,00 | 16,25% | R$ 8.375,00 | R$ 0,00 |
| 2026 | 700,00 | 165,00 | 760,00 | 90,00 | 10,00 | R$ 1.625,00 | 16,25% | R$ 8.375,00 | R$ 0,00 |
| 2027 | 700,00 | 0,00 | 0,00 | 840,00 | 10,00 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | +R$ 75,00 |
| 2028 | 700,00 | 0,00 | 0,00 | 840,00 | 10,00 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | +R$ 75,00 |
| 2029 | 630,00 | 0,00 | 0,00 | 850,00 | 185,00 | R$ 1.665,00 | 16,65% | R$ 8.335,00 | -R$ 40,00 |
| 2030 | 560,00 | 0,00 | 0,00 | 850,00 | 370,00 | R$ 1.780,00 | 17,80% | R$ 8.220,00 | -R$ 155,00 |
| 2031 | 490,00 | 0,00 | 0,00 | 850,00 | 555,00 | R$ 1.895,00 | 18,95% | R$ 8.105,00 | -R$ 270,00 |
| 2032 | 420,00 | 0,00 | 0,00 | 850,00 | 740,00 | R$ 2.010,00 | 20,10% | R$ 7.990,00 | -R$ 385,00 |
| 2033 | 0,00 | 0,00 | 0,00 | 850,00 | 1.850,00 | R$ 2.700,00 | 27,00% | R$ 7.300,00 | -R$ 1.075,00 |

Hoje (2025) o custo líquido é **R$ 8.375,00**, não R$ 10.000,00. Com o preço congelado, ele **sobe** em 2027 (R$ 8.450,00) porque o PIS/COFINS de 9,25% é substituído por CBS 8,40% + IBS 0,10% e o ICMS segue cheio. O primeiro ano abaixo de 2025 é 2029; o regime pleno (2033) chega a R$ 7.300,00.


## 5. Cenário de repasse do tributo ao preço

Fórmula: `P_novo = P_velho × (1 − t_velho) / (1 − t_novo)`, com `t` = carga efetiva do frete (percentual do motor).

Por que ela vale: os tributos são cobrados **por dentro** do preço (a base é o valor integral cobrado — LC 214/2025, art. 12); o que sobra para o transportador é `P × (1 − t)`. Para preservar a mesma sobra de hoje: `P_novo × (1 − t_novo) = 10.000 × (1 − 16,25%)`.

| Ano | t novo | Preço de repasse | Repasse no app | Crédito com repasse | Custo líquido com repasse | Custo com preço congelado | Efeito do repasse |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 16,25% | R$ 10.000,00 | — | R$ 1.625,00 | R$ 8.375,00 | R$ 8.375,00 | R$ 0,00 |
| 2026 | 16,25% | R$ 10.000,00 | R$ 10.000,00 | R$ 1.625,00 | R$ 8.375,00 | R$ 8.375,00 | R$ 0,00 |
| 2027 | 15,50% | R$ 9.911,24 | R$ 9.911,24 | R$ 1.536,24 | R$ 8.375,00 | R$ 8.450,00 | -R$ 75,00 |
| 2028 | 15,50% | R$ 9.911,24 | R$ 9.911,24 | R$ 1.536,24 | R$ 8.375,00 | R$ 8.450,00 | -R$ 75,00 |
| 2029 | 16,65% | R$ 10.047,99 | R$ 10.047,99 | R$ 1.672,99 | R$ 8.375,00 | R$ 8.335,00 | +R$ 40,00 |
| 2030 | 17,80% | R$ 10.188,56 | R$ 10.188,56 | R$ 1.813,56 | R$ 8.375,00 | R$ 8.220,00 | +R$ 155,00 |
| 2031 | 18,95% | R$ 10.333,13 | R$ 10.333,13 | R$ 1.958,13 | R$ 8.375,00 | R$ 8.105,00 | +R$ 270,00 |
| 2032 | 20,10% | R$ 10.481,85 | R$ 10.481,85 | R$ 2.106,85 | R$ 8.375,00 | R$ 7.990,00 | +R$ 385,00 |
| 2033 | 27,00% | R$ 11.472,60 | R$ 11.472,60 | R$ 3.097,60 | R$ 8.375,00 | R$ 7.300,00 | +R$ 1.075,00 |

Com repasse integral e crédito integral, o custo líquido **fica em R$ 8.375,00 em todos os anos** — a reforma é neutra para quem credita tudo e recebe o repasse. O ganho de 2033 (R$ 7.300,00 de custo) só aparece se o preço ficar congelado; com repasse, o preço bruto sobe para R$ 11.472,60 e o desembolso aumenta 14,73%.


## 6. Quanto eu deveria pagar — benchmark e preço de equilíbrio

Benchmark: o **regime regular** no mesmo frete nominal. Equilíbrio: o preço máximo da outra transportadora que empata o custo líquido do benchmark — `P_max = custo_benchmark / (1 − crédito% ÷ 100)`. A coluna "teto no app" vem de `POST /api/pagador` (`anos[].equivalente.preco`).

| Ano | Benchmark regular | Equilíbrio do Simples/DAS | Teto no app (DAS) | Desconto exigido do DAS | Equilíbrio do híbrido | Desconto exigido do híbrido |
|---:|---:|---:|---:|---:|---:|---:|
| 2026 | R$ 8.375,00 | R$ 8.375,00 | R$ 8.375,00 | 16,25% | R$ 8.375,00 | 16,25% |
| 2027 | R$ 8.450,00 | R$ 8.656,47 | R$ 8.656,47 | 13,44% | R$ 9.234,97 | 7,65% |
| 2028 | R$ 8.450,00 | R$ 8.656,47 | R$ 8.656,47 | 13,44% | R$ 9.234,97 | 7,65% |
| 2029 | R$ 8.335,00 | R$ 8.538,66 | R$ 8.538,66 | 14,61% | R$ 9.297,27 | 7,03% |
| 2030 | R$ 8.220,00 | R$ 8.420,85 | R$ 8.420,85 | 15,79% | R$ 9.362,19 | 6,38% |
| 2031 | R$ 8.105,00 | R$ 8.303,04 | R$ 8.303,04 | 16,97% | R$ 9.429,90 | 5,70% |
| 2032 | R$ 7.990,00 | R$ 8.185,23 | R$ 8.185,23 | 18,15% | R$ 9.500,59 | 4,99% |
| 2033 | R$ 7.300,00 | R$ 7.478,37 | R$ 7.478,37 | 25,22% | R$ 10.000,00 | 0,00% |

Em 2027, para empatar com o regime regular (R$ 8.450,00), a Rota Sul (Simples/DAS) teria de cobrar **R$ 8.656,47** — 13,44% abaixo dos R$ 10.000,00. Em 2033 o teto cai para **R$ 7.478,37**. Os dois números batem com o preço-teto devolvido pelo app.


## 7. O comparador do app no mesmo preço nominal (2027)

`POST /api/comparar` — resumo do app: "Os 3 fretes custam R$ 10.000,00 no nominal. Depois de todo o crédito (ICMS, PIS/COFINS e CBS/IBS), Serra Azul Cargas sai por R$ 8.450,00 — R$ 1.311,49 a menos que Rota Sul Logística."

| # | Transportadora | Preço | Crédito total (app) | % | Custo total (app) | Custo independente |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Serra Azul Cargas | R$ 10.000,00 | R$ 1.550,00 | 15,50% | R$ 8.450,00 | R$ 8.450,00 |
| 2 | Via Brasil Transportes | R$ 10.000,00 | R$ 850,00 | 8,50% | R$ 9.150,00 | R$ 9.150,00 |
| 3 | Rota Sul Logística | R$ 10.000,00 | R$ 238,51 | 2,39% | R$ 9.761,49 | R$ 9.761,49 |

O app agora ordena por **custo total** e separa os três regimes: regular R$ 8.450,00, híbrido R$ 9.150,00 e Simples/DAS R$ 9.761,49. A diferença entre regular e híbrido é exatamente o ICMS de 7% (R$ 700,00): o optante do Simples não o destaca.


## 8. O CT-e de novembro de 2026 (documento real do motor)

Documento nº 458/1, SP → BA, NBS 105011220, base de cálculo **R$ 5.955,00** (vale-pedágio de R$ 320,00 fora da base — Lei 10.209/2001).

| Tributo | Alíquota | Valor | Crédito da pagadora (app) |
|---|---:|---:|---|
| ICMS | 7,00% | 416,85 | sim |
| PIS | 1,65% | 98,26 | sim |
| COFINS | 7,60% | 452,58 | sim |
| IBS estadual | 0,1000% | 5,96 | não |
| CBS | 0,9000% | 53,60 | não |
| **Total** | **17,25%** | **R$ 1.027,25** | **R$ 967,69** |

| Linha do pagamento | Valor |
|---|---:|
| Valor da prestação | R$ 5.955,00 |
| (−) Retenções (IRRF) | −89,33 |
| (=) Líquido ao transportador | R$ 5.865,67 |
| (+) Vale-pedágio antecipado | 320,00 |
| (=) Desembolso da pagadora | R$ 6.275,00 |

Custo líquido do documento para a pagadora: R$ 5.955,00 − R$ 967,69 = **R$ 4.987,31** (83,75% do valor da prestação).


## 9. O mesmo CT-e pago em 2027 — split payment e retenções

| Linha | 2027 (TDE) | 2027 (TAC) |
|---|---:|---:|
| Total de tributos | R$ 923,03 (15,50%) | R$ 923,03 (15,50%) |
| Crédito da pagadora | R$ 923,03 | R$ 923,03 |
| Split payment (IBS/CBS) | R$ 506,18 | R$ 506,18 |
| Retenções | R$ 89,33 | R$ 893,26 |
| Líquido ao transportador (topo) | R$ 5.865,67 | R$ 5.061,74 |
| Líquido ao transportador (comparativo) | R$ 5.359,49 | R$ 4.555,56 |
| Desembolso da pagadora | R$ 6.275,00 | R$ 6.275,00 |

O desembolso da pagadora **não muda** com o split payment: o mesmo valor é pago, mas parte vai ao Comitê Gestor do IBS/RFB no momento da liquidação (LC 214/2025, arts. 31 a 35) em vez de ir ao transportador. O que muda é o caixa de quem recebe — e a conciliação.

**Divergências que o motor do CT-e ainda tem (medidas nesta execução):** (i) sem `tomaCreditoIcms`, o mesmo documento devolve crédito de R$ 506,18 em vez de R$ 923,03 — e o pedido não avisa; (ii) o topo da resposta diz líquido R$ 5.865,67 e o `comparativo[2027]` diz R$ 5.359,49 — o topo não desconta o split; (iii) o `comparativo[2027]` mantém `custoNaoRecuperavel` de R$ 416,85 (o ICMS), enquanto o topo, com os flags de crédito, devolve R$ 0,00.


## 10. A decisão e a economia

**Decisão:** consolidar 100% do volume SP → BA na **Serra Azul Cargas (regime regular)**, sem pedir reajuste em 2027, e usar o preço-teto como limite em qualquer cotação de transportadora do Simples.

| Comparação | 2027 | 2029 | 2033 | 2026–2033 (acumulado) |
|---|---:|---:|---:|---:|
| Simples/DAS × regular (mensal) | R$ 1.311,49 | R$ 1.426,49 | R$ 2.461,49 | — |
| Simples/DAS × regular (anual) | R$ 15.737,88 | R$ 17.117,88 | R$ 29.537,88 | R$ 157.265,16 |
| Híbrido × regular (mensal) | R$ 700,00 | R$ 630,00 | R$ 0,00 | — |
| Híbrido × regular (anual) | R$ 8.400,00 | R$ 7.560,00 | R$ 0,00 | R$ 61.500,00 |

Trocar a Rota Sul (Simples/DAS) pela Serra Azul (regular) **sem mexer no preço nominal** economiza **R$ 1.311,49/mês em 2027** (R$ 15.737,88/ano) e **R$ 2.461,49/mês em 2033** (R$ 29.537,88/ano); somando 2026–2033, **R$ 157.265,16**.

Alternativa: manter a Rota Sul e renegociar para **R$ 8.656,47** em 2027 (queda de 13,44%) — o mesmo ganho, mas exige um corte que provavelmente supera a margem do transportador. É esse número que a cláusula de reajuste deve usar como teto.


## 11. O que uma planilha comum erraria

| Erro | O que a planilha faz | Efeito no exemplo (2027) |
|---|---|---|
| Comparar preço nominal | 10.000 = 10.000 → empate | Perde R$ 1.311,49/mês de economia |
| Ignorar o crédito de ICMS/PIS/COFINS | usa o crédito só de CBS/IBS (R$ 850,00) | Subestima o crédito em R$ 700,00/mês e mede um gap de R$ 611,49 em vez de R$ 1.311,49 (erro de R$ 700,00) |
| Tratar o híbrido como igual ao regular | ambos com 8,50% de crédito | Perde R$ 700,00/mês entre 2027 e 2032 |
| Achar que o custo cai ano a ano | projeta 730 já em 2027 | O custo real sobe para R$ 8.450,00 em 2027 e só chega a R$ 7.300,00 em 2033 |
| Ignorar a queda do crédito de ICMS | mantém 7% até 2033 | Em 2033 o ICMS é zero: quem não migrar perde o crédito de R$ 700,00/mês |


## 12. O que ainda não está resolvido (ressalvas fiscais)

1. **Autônomo/MEI continua com faixa de 1,8% a 4,00%** (`estimativa setorial`): em R$ 1.000,00 o app devolve R$ 18,00 de crédito em 2027 (1,80%) e o horizonte usa R$ 180,00 em R$ 10.000,00 no preço-teto e na economia. O crédito é **presumido**, com percentual fixado por ato conjunto até setembro de cada ano (LC 214/2025, art. 169, §§ 3º e 4º) e aplicado sobre o valor líquido (`P × p/(1+p)`); enquanto o ato não existe, o número é estimativa do app e não deveria sustentar uma decisão.
2. **Simples/DAS sem PGDAS continua com faixa de 0,92% a 4,00%** (padrão 2,00%): em R$ 1.000,00 o app devolve R$ 20,00 de crédito em 2027 sem nenhuma alíquota informada. Sem destaque no CT-e não há crédito (LC 214/2025, art. 47, §2º, I) — a faixa é heurística, não regra.
3. **Alíquotas de 2027–2033 são premissa**, não alíquota legal: a LC 214/2025 manda o Senado fixar a referência a cada ano (arts. 18 e 349) e só fixa a regra de 2027–2028 (CBS = referência − 0,1 p.p., art. 347). Falta o selo "premissa" na tela e o aviso de que a resolução de 2027 ainda não existe.
4. **Split payment não tem data na lei**: arts. 31 a 35 e art. 35, §§ 1º e 2º (implementação gradual por ato conjunto, começando por adquirentes não contribuintes). O "a partir de 2027" é premissa de planejamento.
5. **Nomes de campo inconsistentes entre endpoints**: em `/api/simular`, `credito`/`custoLiquido` são só CBS/IBS e `creditoTotal`/`custoTotal` são o total; em `/api/reforma`, `credito`/`custoLiquido` já são o total. Sugestão: depreciar os legados ou renomear em `/api/reforma`.
6. **Módulo de CT-e do motor**: `custoNaoRecuperavel` e `liquidoTransportador` divergem entre o topo e o `comparativo`; `tomaCreditoIcms`/`tomaCreditoPisCofins` sem default silencioso. Se a aba de CT-e for exposta ao pagador, isso aparece.

## 13. Divergências de documentação encontradas nesta revisão

Os números de aceite de `app/README.md` e `docs/frete.md` **conferem** (837,50; 845,00; 833,50; 730,00; 23,85; 845/915/976,15). Restam três frases que descrevem o comportamento antigo:

| Arquivo:linha | Frase | O que é verdade agora |
|---|---|---|
| `app/README.md:97` | "em 2026, o Simples/DAS cai na faixa estimada" | Em 2026 o crédito do Simples é **zero** (art. 348, III, "c") — confirmado no `/api/simular` e no `/api/reforma` |
| `app/README.md:134` | "Custo líquido: preço − crédito de **CBS/IBS** do regime escolhido" | O campo `custoLiquido` do `/api/reforma` passou a ser o **total** (ICMS + PIS/COFINS + CBS/IBS) |
| `docs/frete.md:574` | "crédito e custo líquido consideram **só CBS/IBS**, o mesmo recorte do simulador" | O recorte passou a ser o crédito total; a frase contradiz a tabela da linha 578 |
