# 06 — Validação cruzada

Onde as fontes divergem mais de 20%, qual número foi adotado e por quê. Também onde divergem **menos** de 20% mas a diferença importa para o produto.

Critério de leitura: "divergência" = `(maior − menor) / menor`.

---

## 1. Painel das divergências

| # | Item | Fonte A | Fonte B | Divergência | Adotado | Por quê |
|---|---|---|---:|---:|---|---|
| 1 | **Valor da estadia** | R$ 1,38/t·h (Lei 11.442/2007, art. 11, § 5º, redação de 2015) | R$ 2,84/t·h (valor reajustado pelo INPC, referência 2026) | **+105,8%** | **R$ 2,84** | a lei fixa o valor-base e determina reajuste anual pelo INPC; usar R$ 1,38 seria aplicar um valor de 11 anos atrás. O R$ 2,41 da série intermediária confirma a trajetória (1,38 → 2,41 → 2,84) |
| 2 | **Dias faturáveis** | 19–20 (mês curto: fev e nov de 2026) | 25–26 (escala 6×1) | **+36,8%** (26 vs 19) | **22 base**, faixa 20–24 | 26 deixou de ser constitucional em 16/12/2026 (2 DSR + 42 h). 19 é o piso do pior mês, não a média. 22 = 5 dias × 4,333 semanas |
| 3 | **R$/km da carreta** | 7,21 (SP→Belém, longa distância) | 8,99 (SP→Curitiba, curta distância) | **+24,7%** | **8,80** | a diária é **um dia de trabalho** (~400 km), não uma viagem de 3.000 km. O componente fixo (carga, descarga, mobilização) pesa no dia e se dilui na longa distância — usar o R$/km de longa distância subestimaria a diária em 18% |
| 4 | **Crédito do pagador no Simples** | 0,92% (piso da faixa setorial) | 4,00% (teto da faixa setorial) | **+334,8%** | **2,385%** (PGDAS 2027) com banda 0,92%–4,00% | 2,385% é o número apurado pelo motor do Simples para 2027 e o que o app já usa; os extremos são limites de sensibilidade, não estimativa central |
| 5 | **Percentual de custo fixo** | 35–45% (longa distância, carreta) | 50–60% (distribuição urbana) | **+37,5%** (médias 40 vs 55) | **faixa, não ponto** | não há fonte pública acessível; a divergência é real e depende do tipo de operação. O produto deve tratar como parâmetro do usuário |
| 6 | **Limite do MEI** | R$ 81.000/ano (regra geral, art. 18-A) | R$ 251.600/ano (MEI caminhoneiro, art. 18-F) | **+210,6%** | **R$ 251.600** para transporte de cargas | não é divergência: é regra especial. O erro seria aplicar a regra geral ao TAC |
| 7 | **km/dia** | 336 (cálculo: 8 h × 70% × 60 km/h) | 450 (bitrem, longa distância) | **+33,9%** | **por tipo**: 250 a 450 | 336 é o dia "puro" de direção; bitrem opera com 2 motoristas ou 12×36 e roda mais. Usar um número só para todos os tipos erraria 34% em um dos extremos |
| 8 | **Diária de composição especial** | R$ 15.000 (conjunto superpesado, 20+ eixos) | R$ 3.500 (carreta 6 eixos) | **+328,6%** | **excluído do modelo** | é outro produto (carga indivisível, projeto, escolta, batedores). Misturar contaminaria a faixa da carreta |
| 9 | **Fator regional** | 1,00 (Sudeste, referência) | 1,18 (Norte, estimativa) | **+18,0%** | **1,18 como teto** | abaixo do corte de 20%, mas é o maior número sem medição do pacote. Marcado como estimativa e limitado a "ajuste sugerido" |

---

## 2. Divergências abaixo de 20% que ainda importam

| Item | A | B | Divergência | Decisão |
|---|---:|---:|---:|---|
| Dias úteis 2026 | 253 (só feriados fixos) | 251 (com Carnaval e Paixão) | −0,8% | usar **253** como "dias úteis civis" e tratar Carnaval/Paixão como ajuste do usuário |
| Dias úteis 2026 × 2027 | 253 | 255 | +0,8% | média de 21,08 e 21,25 → default **21** |
| Úteis (21) × faturáveis base (22) | 21 | 22 | +4,8% | coerente: 21 é o calendário; 22 é a capacidade 5×2 **antes** de descontar feriados |
| Divisor da hora | 220 h (CLT art. 64, prática) | 230 h (convenção do CHP) | +4,5% | usar **230** no custo hora parada (fonte setorial) e **220/210/200** só para folha |
| Diária carreta: modelo × piso | R$ 3.500 (modelo) | R$ 3.687 (piso SP–Curitiba) | +5,3% | adotar o modelo, que replica o piso a −2,1% no R$/km e arredonda para baixo |
| Diária toco: modelo × capacidade declarada | 6 t (fonte 14) | 8 t (prática de mercado) | +33% em capacidade | manter **6 t** (fonte citável) e registrar a sensibilidade |
| Estadia carreta (27 t) × diária | R$ 613/dia | R$ 3.500/dia | −82,5% | **não é divergência**: estadia indeniza tempo, diária remunera serviço. O app mostra as duas lado a lado |

---

## 3. Onde a divergência é estrutural, não numérica

### 3.1 "Diária" tem cinco definições

O maior risco deste pacote não é um número errado: é o usuário chamar de "diária" uma coisa diferente da que o modelo calcula. As cinco acepções estão em `03-diarias-de-mercado.md` §1, e a mais perigosa é a **diária de viagem do motorista** (ajuda de custo, tipicamente dezenas de reais por dia) contra a **diária do veículo** (milhares). A razão entre elas é de **~20×** — nenhuma validação numérica resolve isso; só rótulo e texto de ajuda resolvem.

### 3.2 Piso × preço

O piso da ANTT é **mínimo legal**, não preço de equilíbrio. O preço de mercado pode estar acima (retorno escasso, urgência) ou — infelizmente — abaixo (concorrência predatória, o que é ilícito). O modelo usa o piso como **âncora de custo**, e a faixa máxima como **prêmio de mercado**. Quando o usuário digitar diária abaixo do piso implícito, o app deve avisar — não bloquear, porque o piso só se aplica a **carga lotação** (critérios do Ofício SEI 20899/2026).

### 3.3 Ano de referência

A carga tributária muda em 2027 (PIS/COFINS sai, CBS entra) e em 2033 (regime pleno). Comparar diárias de anos diferentes sem comparar o regime é comparar preços de moedas diferentes. O simulador já trata o ano; o perfil do transportador **não pode** ficar sem ano de referência.

---

## 4. Testes de consistência que eu rodei

| Teste | Resultado | Veredito |
|---|---|---|
| Piso SP–Curitiba ÷ distância = R$/km? | 3.687 ÷ 410 = 8,99 | ok |
| Modelo carreta × 400 km = piso aproximado? | 8,80 × 400 = 3.520 vs 3.687 | −4,5%; aceitável para rota de 400 km |
| Modelo 3/4 × 250 km cabe no MEI? | 720 × 22 × 12 = 190.080 < 251.600 | ok |
| Modelo toco × 22 dias cabe no MEI? | 1.080 × 22 × 12 = 285.120 > 251.600 | **não cabe** — vira aviso de produto |
| Estadia carreta 8 h ÷ diária | 613 ÷ 3.500 = 17,5% | coerente com a noção de que estadia não paga o dia |
| Faturamento bruto × 12 vs limite MEI | 77.000 × 12 = 924.000 | carreta nunca é MEI — o app deve impedir |
| Soma `T + L = B` no exemplo do regular | 12.512,50 + 64.487,50 = 77.000,00 | ok |
| Soma `K + C = B` no exemplo do Simples | 1.836,45 + 75.163,55 = 77.000,00 | ok |

---

## 5. Incertezas residuais, em ordem de impacto

| # | Incerteza | Impacto potencial | Mitigação no produto |
|---|---|---|---|
| 1 | **Expoente 0,55** da escala de R$/km por capacidade | ±15% na diária de 3/4, toco, truck e bitrem | expor o R$/km como campo avançado; calibrar com dados reais |
| 2 | **Falta de cotação de mercado** | a faixa pode estar 20–30% fora da realidade local | rotular como "referência"; coletar diárias reais (item 9 de `05`) |
| 3 | **Percentual de custo fixo** | erro no alerta de viabilidade | tratar como parâmetro do usuário, nunca como default fixo |
| 4 | **Crédito do Simples em 2033** | o "líquido do pagador" pode mudar de sinal | manter banda 0,92%–4% e o aviso de estimativa |
| 5 | **Regime regional não medido** | 0% a 18% no preço | fator explícito, editável, marcado como estimativa |
| 6 | **CCT / piso salarial 2026** | muda o custo fixo, não a diária diretamente | pendência declarada; consultar SETCESP/CCT na revisão anual |
| 7 | **Diesel de 26/11/2026** | ±10% no custo variável | parâmetro atualizável; não entra no default de diária |

---

## 6. O que eu mudaria se tivesse buscador

1. **Coletar 30–50 diárias reais** por tipo (frete, grupos de WhatsApp do setor, propostas comerciais) e substituir a faixa derivada pela mediana — mantendo a derivação como documentação.
2. **Ler a planilha de coeficientes da ANTT** (Resolução 5.867/2020, anexo) para derivar R$/km por número de eixos **sem** o expoente 0,55. Isso eliminaria a maior incerteza do pacote.
3. **Obter o Manual de Custos do NTC&Logística** e substituir a estimativa de 35–60% de custo fixo por percentual medido.
4. **Ler a CCT do SETCESP vigente** para separar a diária de viagem do motorista (que hoje está fora do modelo) do piso salarial.
5. **Ler a série do diesel da ANP** para transformar o custo variável em default atualizado em vez de parâmetro manual.

Nenhum desses cinco itens muda a **estrutura** do modelo — muda a precisão dos números dentro dela. É por isso que a estrutura pode ser implementada agora e os números calibrados depois.
