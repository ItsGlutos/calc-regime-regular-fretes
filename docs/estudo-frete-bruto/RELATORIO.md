# Estudo — variação do frete bruto sob CBS/IBS

**Quanto o bruto precisa subir para preservar o líquido, como projetar isso no ano e como contratar em um cenário que muda todo ano**

| | |
|---|---|
| Versão | 1.0 |
| Data | 25/11/2026 |
| Escopo | Transporte rodoviário de carga (CT-e, NBS `105011220`), rota de referência SP → BA, frete de R$ 100.000,00/mês |
| Natureza | Estudo econômico para decisão e negociação. **Não é parecer tributário** e **não altera o app**. |
| Base de cálculo | Projeção oficial do motor do regime regular (base V0073) + regras de crédito do app + LC 214/2025 |
| Arquivo de apoio | [`modelo-frete-bruto.xlsx`](modelo-frete-bruto.xlsx) — premissas editáveis, cenários e sensibilidade |

> **Leitura em uma frase:** com crédito integral, o bruto sobe mas o líquido do pagador fica parado; com crédito parcial (Simples), o bruto sobe menos e o líquido do pagador sobe — e é aí que a conta dói. O app hoje mede bem o primeiro caso; o segundo exige um modelo que o app ainda não tem.

---

## Sumário executivo

1. **O comparador do app fixa o preço bruto.** Ele responde “quanto custa este frete depois do crédito” com o nominal constante. Na negociação real, o bruto é a variável de ajuste: se o transportador perde líquido, ele repassa. Comparar transportadoras no mesmo nominal é útil para escolher, mas não responde “quanto vou pagar de verdade”. A visão de horizonte já tem um cenário de repasse, mas ele usa a carga do regime regular e não modela a margem do transportador.

2. **Transportador do regime regular + pagador Lucro Real (crédito integral):** o bruto de 2033 sobe **até 14,73%** (teto de repasse integral, sem crédito de insumos do transportador): R$ 100.000,00 → **R$ 114.726,03/mês**; R$ 1,2 mi → **R$ 1.376.712,33/ano**. O líquido do pagador fica **constante** em R$ 83.750,00/mês (R$ 1.005.000,00/ano). Em **2027–2028 o bruto até cai 0,89%**, porque o PIS/COFINS de 9,25% sai e a CBS entra em 8,40% + IBS 0,10%: a carga cai de 16,25% para 15,50%.

3. **Pagador Lucro Presumido:** o crédito novo de CBS/IBS é maior do que o repasse. O transportador precisa de R$ 114.726,03/mês para ficar neutro; o pagador pode pagar até **R$ 127.397,26/mês** e ainda ficar neutro. A diferença — **R$ 12.671,23/mês** (R$ 152.054,76/ano) — é o ganho que a reforma cria e que precisa ser negociado, não perdido.

4. **Transportador Simples/DAS:** no cenário base (DAS 12%, insumos 60% do frete, margem 8%), o bruto sobe **10,04%** (R$ 100.000,00 → R$ 110.040,45/mês) só para preservar a margem; o crédito do pagador é de apenas 2,385%, então o líquido do pagador sobe **7,42%** (R$ 100.000,00 → **R$ 107.415,99/mês**, +R$ 88.991,88/ano). A faixa razoável vai de **+4,3% a +14,3%** no bruto e **+1,8% a +11,6%** no líquido, dependendo da parcela de insumos e do DAS.

5. **O repasse que o app calcula hoje não vale para Simples e híbrido.** Ele usa a carga do regime regular (27% em 2033) para todos os perfis. No Simples, isso dá R$ 114.726,03/mês — **R$ 4.685,58/mês de bruto acima** do necessário para preservar a margem e **R$ 4.573,82/mês de líquido acima** do repasse correto. No híbrido, o app ignora o DAS residual e também subestima o bruto.

6. **A incerteza decisiva é o crédito do Simples em 2033.** Se o crédito acompanhar o DAS (até 12%), o conflito desaparece e o pagador pode até reduzir o líquido; se ficar na faixa de 2,39%, o transportador precisa de +10,0% e o pagador só aceita +2,4% — um **conflito de 7,6% do bruto**. O contrato precisa tratar os dois cenários.

7. **Recomendação:** separar **desembolso bruto** (caixa) de **custo líquido** (resultado); negociar por **margem e crédito**, não por alíquota; usar uma cláusula de repasse com fórmula, *true-up* mensal e reset anual; e priorizar transportadores de crédito integral quando o prêmio do Simples não compensar o custo líquido maior.

---

## 1. O ponto cego: o app mede o preço, a negociação move o preço

O simulador faz uma pergunta importante e responde bem:

> “Com o frete nominal de R$ 1.000,00, quanto sobra de custo depois de todo o crédito?”

Mas a pergunta que decide o orçamento é outra:

> “Quanto eu vou ter que pagar de bruto para o transportador continuar entregando o serviço com a mesma margem?”

São perguntas diferentes porque o preço não é exógeno. O transportador não “absorve” a CBS/IBS: ele forma preço. Se o tributo sobe e o crédito do pagador não acompanha, o bruto sobe; se o bruto não sobe, a margem do transportador cai e ele sai, corta serviço ou pede reajuste depois.

O app tem uma visão de horizonte com um cenário de repasse, mas ele é **regular-centric**: usa a carga do documento (ICMS + PIS/COFINS + CBS/IBS) para qualquer perfil. Para o regime regular com crédito integral, isso funciona. Para o Simples, não: a carga do documento não é o DAS e o crédito do pagador não acompanha. É essa lacuna que o estudo preenche.

O app atual tem duas virtudes que devem ser preservadas:

- **auditabilidade** — o destaque vem do motor oficial, com memória e versão da base;
- **leitura do crédito** — separa ICMS, PIS/COFINS e CBS/IBS e mostra o custo líquido.

O que falta é a outra metade: **um modelo bilateral**, com o líquido do transportador e o líquido do pagador na mesma equação.

### 1.1 Os dois “líquidos” que não são o mesmo

| Conceito | Fórmula | Quem olha | Para que serve |
|---|---|---|---|
| **Bruto** | `P` | contrato, contas a pagar | caixa, orçamento, nota fiscal |
| **Carga tributária** | `T = t × P` | fiscal, compliance | tributo destacado no CT-e |
| **Crédito do pagador** | `K = c × P` | fiscal do pagador | recuperação de tributo |
| **Líquido do pagador** | `C = P − K = P × (1 − c)` | compras / controladoria | custo real da operação |
| **Receita líquida do transportador** | `RL = P − T = P × (1 − t)` | transportador | o que sobra antes dos custos |
| **Margem do transportador** | `M = RL − custos` | transportador | o que decide continuar ou não |
| **Desembolso** | `P` | tesouraria | o que sai do caixa, com ou sem crédito |

A confusão mais comum é tratar “líquido” como se fosse um só. O **líquido do pagador** é `P − crédito`; o **líquido do transportador** é `P − tributo`. Em uma cadeia de crédito integral, os dois coincidem quando as alíquotas são iguais. Em uma cadeia com crédito parcial — o Simples — eles se separam, e é essa separação que produz o conflito.

> **Sobre “renda bruta líquida”:** se a expressão significa `P − tributos`, o número desta seção é a **receita líquida**. Se significa o que sobra depois de todos os custos, o número é a **margem**. O estudo usa as duas porque o transportador decide pela margem, mas negocia pela receita. Confundir as duas é o erro que faz um contrato parecer neutro e quebrar o transportador no ano seguinte.

### 1.2 O tributo é “por dentro”

A LC 214/2025 mantém a cobrança “por dentro”: a base inclui o próprio tributo. Se a alíquota é `t`, o preço bruto `P` já contém `t × P`, e o que sobra é `P × (1 − t)`.

```
T = t × P
RL = P − T = P × (1 − t)
C  = P − c × P = P × (1 − c)
```

Isso explica por que o bruto sobe mais do que a alíquota na cabeça de quem pensa “some 27% ao preço”. Para preservar o líquido, o fator não é `1 + t`, é `1 / (1 − t)`. Em 27%, o fator é `1 / 0,73 = 1,3699`: um aumento de **36,99%** sobre o líquido, ou **14,73%** sobre o bruto atual, porque o bruto atual já embutia 16,25% de carga.

---

## 2. As fórmulas do repasse

### 2.1 Repasse que preserva a receita líquida do transportador

Se o transportador tinha carga `t₀` sobre o preço `P₀` e passa a ter carga `t₁`, o preço `P₁` que preserva a mesma receita líquida é:

```
P₁ = P₀ × (1 − t₀) / (1 − t₁)
```

O fator `f = (1 − t₀) / (1 − t₁)` é o **fator de repasse**. Ele vale para qualquer regime, desde que `t` seja a carga efetiva **do transportador** — não a carga do documento de outro regime.

### 2.2 Repasse que preserva a margem

Receita líquida não é margem. Se os custos do transportador mudam, preservar `RL` pode destruir a margem. A fórmula correta é:

```
P₁ = (custos₁ + margem₀) / (1 − t₁)
```

No regime regular com crédito integral, os custos de insumos são neutros (o crédito recupera o tributo da entrada), então `custos₁ ≈ custos₀` e as duas fórmulas coincidem. No Simples, os insumos não geram crédito: `custos₁ > custos₀`, e a diferença é o **custo não creditável** que precisa entrar no bruto.

### 2.3 O preço que preserva o líquido do pagador

Se o pagador tinha crédito `c₀` e passa a ter `c₁`, o preço máximo que o mantém neutro é:

```
P_C = P₀ × (1 − c₀) / (1 − c₁)
```

### 2.4 A zona de acordo (ou o conflito)

- Se `P_N < P_C`, existe uma **zona de acordo** `[P_N, P_C]`: abaixo de `P_N` o transportador perde; acima de `P_C` o pagador perde. Dentro da zona, o ganho (ou o custo) é repartido.
- Se `P_N > P_C`, **não existe preço que preserve os dois**. A diferença `P_N − P_C` é o custo do desalinhamento — normalmente o tributo não creditável — e alguém tem que absorver, ou o contrato revê volume/serviço.

### 2.5 Anualização

Para um contrato com volume mensal `Q_m` e preço `P_m`:

```
Bruto anual  = Σ (P_m × Q_m)
Crédito anual = Σ (c_m × P_m × Q_m)
Líquido anual = Bruto anual − Crédito anual
```

Se o volume é constante, `anual = 12 × mês`. Se o volume oscila, **não use a média anual para aplicar o fator tributário**: aplique o fator por CT-e e reconcilie o volume separadamente. A seção 5 mostra como.

---

## 3. O que a reforma muda, ano a ano

### 3.1 Cronograma relevante para o frete

A tabela abaixo é a projeção oficial do motor para SP → BA (interestadual), com CBS/IBS de referência. As alíquotas de 2029–2033 são **premissa** do motor (o Senado fixa a referência a cada ano); 2027–2028 seguem a regra legal da LC 214/2025 (CBS = referência − 0,1 p.p., art. 347).

| Ano | Fase | ICMS | PIS/COFINS | CBS | IBS | Carga total | Crédito do regime regular | Observação |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 2025 | Antes da reforma | 7,00% | 9,25% | — | — | **16,25%** | 16,25% | linha de base |
| 2026 | Teste | 7,00% | 9,25% | 0,90% | 0,10% | **16,25%** | 16,25% | CBS/IBS de 1% compensado; não gera crédito ao adquirente (art. 348, I) |
| 2027 | CBS cheia, IBS em teste | 7,00% | — | 8,40% | 0,10% | **15,50%** | 15,50% | PIS/COFINS extintos; primeira queda de carga |
| 2028 | CBS cheia, IBS em teste | 7,00% | — | 8,40% | 0,10% | **15,50%** | 15,50% | ano de transição |
| 2029 | Transição do IBS | 6,30% | — | 8,50% | 1,85% | **16,65%** | 16,65% | IBS começa a subir; ICMS cai |
| 2030 | Transição do IBS | 5,60% | — | 8,50% | 3,70% | **17,80%** | 17,80% | |
| 2031 | Transição do IBS | 4,90% | — | 8,50% | 5,55% | **18,95%** | 18,95% | |
| 2032 | Transição do IBS | 4,20% | — | 8,50% | 7,40% | **20,10%** | 20,10% | |
| 2033 | Regime pleno | — | — | 8,50% | 18,50% | **27,00%** | 27,00% | ICMS/PIS/COFINS extintos |

Fonte: `POST /api/calculadora/frete/projecao` do motor oficial (base V0073), executado em 25/11/2026 para R$ 1.000,00, SP → BA. A rota interna usa ICMS de 18% e muda a linha de base; o estudo usa a interestadual de 7% porque é a mais comum em contratos nacionalizados.

### 3.2 O que é fato e o que é premissa

| Item | Status | Consequência para o repasse |
|---|---|---|
| CBS/IBS em 2026 (0,90% + 0,10%), compensação e ausência de crédito ao adquirente | **Fato** (LC 214/2025, art. 348, I e III, “c”) | 2026 não muda o bruto nem o crédito; é ano de teste |
| Extinção do PIS/COFINS em 2027 e CBS de 8,40% + IBS de 0,10% | **Fato** (LC 214/2025, art. 347) | 2027 é o primeiro ano de **queda** de carga; 2028 repete |
| Cronograma de IBS 2029–2032 e regime pleno em 2033 | **Fato** (LC 214/2025 e ADCT) | a carga sobe de 16,65% a 27,00% |
| Alíquotas de referência de 2029–2033 (8,50% + 18,50%) | **Premissa** (o Senado fixa a referência; art. 18 e 349) | o fator de 2033 pode mudar; use faixa, não ponto |
| Crédito integral do regime regular e do híbrido | **Fato** (LC 214/2025, art. 47) | repasse neutro para o pagador que credita tudo |
| Crédito do Simples limitado ao CBS/IBS do DAS (0,92%–4,00%; exemplo 2,385%) | **Regra fato; número premissa** | é o ponto que quebra a neutralidade |
| Alíquotas do Simples em 2033 | **Não disponível** no motor (tabelas só a partir de 2027) | o crédito de 2033 é a maior incerteza do estudo |
| *Split payment* a partir de 2027 | **Premissa de planejamento** (arts. 31 a 35; implementação gradual) | muda o caixa do transportador, não o bruto |
| ICMS interno de 18% | **Premissa** para rota interna | muda a linha de base e o fator |

### 3.3 Por que o Simples quebra a neutralidade

Em uma cadeia de crédito integral, o tributo é um “pass-through”: o transportador destaca, o pagador credita, e o preço sobe sem alterar o custo líquido de nenhum dos dois. No Simples, o elo se rompe em dois pontos:

1. **O crédito do pagador é limitado** ao CBS/IBS embutido no DAS (2,385% no exemplo), não aos 27% do regime regular.
2. **Os insumos do transportador não geram crédito.** Combustível, manutenção, pneus, pedágio e serviços contratados chegam com CBS/IBS embutido; o optante não credita. O custo sobe e precisa ser repassado.

O primeiro ponto reduz o crédito do pagador; o segundo aumenta o custo do transportador. Juntos, criam o conflito que o app atual não mede.

---

## 4. Quanto o bruto precisa subir — cenários

Base comum: frete de **R$ 100.000,00/mês**, 100 CT-e de R$ 1.000,00, rota SP → BA, ano de referência 2025. Valores em R$; percentuais sobre o bruto.

### 4.1 Regime regular + pagador Lucro Real (crédito integral)

Premissas: carga `t₀ = 16,25%` em 2025; `t` da tabela 3.1; crédito do pagador igual à carga (`c = t`); repasse pela receita líquida (custos neutros).

| Ano | Carga `t` | Fator `f` | Bruto `P` | Δ bruto | Crédito `K` | Líquido `C` | Bruto anual | Líquido anual |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 16,25% | 1,000000 | 100.000,00 | — | 16.250,00 | 83.750,00 | 1.200.000,00 | 1.005.000,00 |
| 2026 | 16,25% | 1,000000 | 100.000,00 | 0,00% | 16.250,00 | 83.750,00 | 1.200.000,00 | 1.005.000,00 |
| 2027 | 15,50% | 0,991124 | 99.112,43 | **−0,89%** | 15.362,43 | 83.750,00 | 1.189.349,11 | 1.005.000,00 |
| 2029 | 16,65% | 1,004799 | 100.479,90 | +0,48% | 16.729,90 | 83.750,00 | 1.205.758,85 | 1.005.000,00 |
| 2033 | 27,00% | 1,147260 | **114.726,03** | **+14,73%** | 30.976,03 | 83.750,00 | **1.376.712,33** | **1.005.000,00** |

**Cuidado:** a carga `t` acima é a do **documento** (tributo destacado), não a carga líquida do transportador depois dos créditos de insumos. Um transportador que credita combustível, manutenção e pneus tem carga líquida menor e pode precisar de menos que 14,73% para preservar a margem. A fórmula é um **teto de repasse integral**; o contrato deve usar a carga efetiva comprovada, não a alíquota cheia. O mesmo vale para o híbrido.

**Leitura:**

- O bruto sobe **R$ 14.726,03/mês** em 2033, mas o crédito sobe exatamente o mesmo: o líquido fica parado. É a neutralidade do IVA para quem credita tudo.
- Em 2027 (e em 2028, com a mesma carga) o bruto **cai** R$ 887,57/mês. Não é erro: a carga cai 0,75 ponto percentual, e o transportador pode reduzir o preço preservando a receita. Se o contrato tiver reajuste só para cima, você paga a mais nesses anos.
- O desembolso anual sobe **R$ 176.712,33** em 2033; o resultado (custo líquido) não muda. Provisione **caixa**, não despesa.

### 4.2 Regime regular + pagador Lucro Presumido (crédito parcial antes da reforma)

Premissas: o pagador não credita PIS/COFINS (cumulativo); antes de 2027 credita só ICMS (7%); de 2027 em diante credita ICMS + CBS/IBS (15,50% em 2027; 27,00% em 2033).

| Ano | Carga `t` | Crédito `c` | Bruto `P_N` | Líquido do pagador em `P_N` | `P_C` (neutro p/ pagador) | Zona `P_C − P_N` |
|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 16,25% | 7,00% | 100.000,00 | 93.000,00 | 100.000,00 | 0,00 |
| 2026 | 16,25% | 7,00% | 100.000,00 | 93.000,00 | 100.000,00 | 0,00 |
| 2027 | 15,50% | 15,50% | 99.112,43 | 83.750,00 | 110.059,17 | **10.946,75** |
| 2029 | 16,65% | 16,65% | 100.479,90 | 83.750,00 | 111.577,68 | **11.097,78** |
| 2033 | 27,00% | 27,00% | 114.726,03 | 83.750,00 | **127.397,26** | **12.671,23** |

**Leitura:**

- No preço que preserva o transportador (`P_N`), o pagador fica **R$ 9.250,00/mês melhor** do que hoje (83.750,00 contra 93.000,00): ele passa a creditar 27% em vez de 7%.
- No preço que preserva o pagador (`P_C`), o transportador fica **R$ 9.250,00/mês melhor** (93.000,00 contra 83.750,00).
- A zona é o espaço de negociação. Um split 50/50 daria `P ≈ 121.061,64`: pagador em R$ 88.375,00 (−4,97%) e transportador em R$ 88.375,00 (+5,52%). Os dois ficam entre os extremos; o ganho de R$ 9.250,00/mês é repartido.
- **Anual:** a zona vale R$ 152.054,76/ano em 2033. Ignorar isso é deixar dinheiro na mesa — ou pagar demais.

### 4.3 Simples/DAS — o caso em que o bruto não é o problema principal

Aqui o app atual tem duas limitações: usa a carga do regime regular (27%) no repasse e não modela o custo não creditável dos insumos. Vamos por partes.

#### 4.3.1 O modelo correto

Premissas do cenário base:

- DAS efetivo `d₀ = d₁ = 12,00%` (Anexo III, transporte de carga; faixa de receita compatível com o porte);
- insumos sujeitos a CBS/IBS = **60%** do frete (`s = 0,60`);
- demais custos = 20% do frete; margem = 8% do frete;
- fator de preço dos insumos = `f = 1,14726` (mesma variação de carga do regime regular, 16,25% → 27,00%);
- crédito do pagador `c = 2,385%` (PGDAS 2027: CBS 2,3591% + IBS 0,0260%).

Custo pós-reforma:

```
custos₁ = 0,60 × P₀ × 1,14726 + 0,20 × P₀ = 0,888356 × P₀
P₁ = (custos₁ + margem₀) / (1 − d₁)
   = (0,888356 + 0,08) / 0,88 × P₀
   = 1,100405 × P₀
```

| Item | 2025 (base) | 2033 (repasse de margem) |
|---|---:|---:|
| Bruto `P` | 100.000,00 | **110.040,45** |
| DAS (12%) | 12.000,00 | 13.204,85 |
| Custos (insumos + outros) | 80.000,00 | 88.835,60 |
| Margem | 8.000,00 | **8.000,00** |
| Receita líquida (P − DAS) | 88.000,00 | 96.835,60 |
| Crédito do pagador (2,385%) | 0,00 | 2.624,46 |
| Líquido do pagador | 100.000,00 | **107.415,99** |
| Δ bruto | — | **+10,04%** |
| Δ líquido do pagador | — | **+7,42%** |

**Leitura:** o bruto sobe 10,04% só para o transportador manter a margem de 8%; o pagador recupera 2,385% e termina com um líquido 7,42% maior. O crédito não cobre o custo não creditável dos insumos. Em valores anuais: bruto de R$ 1.200.000,00 → **R$ 1.320.485,45**; líquido de R$ 1.200.000,00 → **R$ 1.288.991,88** (+R$ 88.991,88/ano).

**O desvio é assimétrico.** Se o pagador segurar o repasse em +5% (R$ 105.000,00), o líquido dele sobe 2,5%, mas a margem do transportador cai 55,4%. Para o pagador, cada ponto de economia no bruto custa vários pontos de margem ao transportador — é por isso que um “teto de reajuste” isolado não resolve.

| Bruto `P` | Δ bruto | Líquido do pagador | Δ líquido | Margem do transportador | Δ margem |
|---:|---:|---:|---:|---:|---:|
| 105.000,00 | +5,00% | 102.495,75 | +2,50% | 3.564,40 | **−55,45%** |
| 107.000,00 | +7,00% | 104.448,05 | +4,45% | 5.324,40 | **−33,45%** |
| 108.000,00 | +8,00% | 105.424,20 | +5,42% | 6.204,40 | **−22,45%** |
| 110.040,45 | +10,04% | 107.415,99 | +7,42% | 8.000,00 | 0,00% |

#### 4.3.2 Sensibilidade: insumos e DAS

O resultado depende de duas variáveis que o app não coleta: a parcela de insumos e o DAS efetivo. A tabela mostra o bruto necessário e o líquido do pagador (c = 2,385%) para combinações plausíveis.

| Insumos `s` | DAS `d₁` | Bruto `P₁` | Δ bruto | Líquido do pagador | Δ líquido |
|---:|---:|---:|---:|---:|---:|
| 40% | 10% | 104.322,67 | +4,32% | 101.834,57 | +1,83% |
| 40% | 12% | 106.693,64 | +6,69% | 104.148,99 | +4,15% |
| 40% | 14% | 109.174,88 | +9,17% | 106.571,06 | +6,57% |
| 50% | 10% | 105.958,89 | +5,96% | 103.431,77 | +3,43% |
| 50% | 12% | 108.367,05 | +8,37% | 105.782,49 | +5,78% |
| 50% | 14% | 110.887,21 | +10,89% | 108.242,55 | +8,24% |
| **60%** | **12%** | **110.040,45** | **+10,04%** | **107.415,99** | **+7,42%** |
| 60% | 14% | 112.599,53 | +12,60% | 109.914,04 | +9,91% |
| 70% | 10% | 109.231,33 | +9,23% | 106.626,17 | +6,63% |
| 70% | 12% | 111.713,86 | +11,71% | 109.049,49 | +9,05% |
| 70% | 14% | 114.311,86 | +14,31% | 111.585,52 | +11,59% |

**Faixa razoável:** bruto **+4,3% a +14,3%**; líquido do pagador **+1,8% a +11,6%**. O caso base (60%/12%) é o centro.

#### 4.3.3 O crédito de 2033 é a variável que decide o conflito

O app usa 2,385% de crédito para o Simples em todos os anos, porque o motor do Simples só tem tabelas a partir de 2027. Em 2033, o crédito pode ser maior — o CBS/IBS dentro do DAS tende a acompanhar a substituição dos tributos antigos. A tabela abaixo mantém o bruto de margem (`P_N = 110.040,45`) e varia o crédito:

| Crédito `c` | `P_C` (neutro p/ pagador) | `P_N − P_C` | Líquido do pagador em `P_N` | Leitura |
|---:|---:|---:|---:|---|
| 2,385% | 102.443,14 | **+7.597,31** | 107.415,99 (+7,42%) | conflito: transportador precisa de 10%, pagador aceita 2,4% |
| 4,00% | 104.166,67 | +5.873,78 | 105.638,83 (+5,64%) | conflito menor |
| 8,00% | 108.695,65 | +1.344,80 | 101.237,21 (+1,24%) | quase equilíbrio |
| **12,00%** | **113.636,36** | **−3.595,91** | **96.835,60 (−3,16%)** | zona de acordo: ambos podem ganhar |
| 14,00% | 116.279,07 | −6.238,62 | 94.634,79 (−5,36%) | pagador ganha mais |

**Conclusão:** o tamanho do problema não é o DAS em si; é **quanto do DAS vira crédito para o pagador**. Se o crédito do Simples em 2033 ficar perto de 12%, o pagador pode absorver o repasse e ainda reduzir o líquido; se ficar perto de 2,4%, o transportador precisa de 10% e o pagador só aceita 2,4%. O contrato tem que prever os dois.

#### 4.3.4 Por que o repasse atual do app não vale para o Simples

O app calcula `repasse` com `fatorRepasse(cargaHoje, cargaAno)` usando a carga da **projeção do regime regular** para qualquer perfil (`app/pagador.js`, linhas 29–35 e 87–90). Para o Simples em 2033, isso resulta em:

| Cálculo | Bruto 2033 | Líquido do pagador | Margem do transportador |
|---|---:|---:|---:|
| App (carga 27%) | 114.726,03 | 111.989,81 | 12.123,31 |
| Correto (margem, DAS 12%, insumos 60%) | 110.040,45 | 107.415,99 | 8.000,00 |

O cenário do app paga **R$ 4.685,58/mês a mais** e ainda assim entrega ao transportador uma margem maior do que a de hoje (porque o bruto foi calculado sobre a carga errada). Para o pagador, são **R$ 4.573,82/mês** de líquido a mais (R$ 54.885,89/ano) sem necessidade. Para o transportador, é um windfall que não se sustenta na renovação.

### 4.4 Híbrido — o caso mais incerto

O híbrido é o optante do Simples que recolhe CBS/IBS no regime regular. O app o trata como “regular puro”: carga de 27% em 2033, crédito integral, sem DAS residual. Isso é um **limite inferior** do bruto necessário, porque o híbrido pode continuar pagando DAS sobre os tributos que permanecem no Simples (ICMS/PIS/COFINS até 2032 e os tributos federais/laborais depois).

Com DAS residual `r` sobre o bruto (não creditável), a carga do transportador é `t₁ = 27% + r` e o bruto de margem é:

```
P_N = P₀ × (1 − d₀) / (1 − 0,27 − r)
```

Premissa: `d₀ = 12%` (DAS antes da reforma), `P₀ = 100.000,00`.

| DAS residual `r` | `P_N` | Δ bruto | Líquido do pagador em `P_N` (c = 27%) | `P_C` | Zona |
|---:|---:|---:|---:|---:|---:|
| 0% | 120.547,95 | +20,55% | 88.000,00 | 136.986,30 | +16.438,35 |
| 5% | 129.411,76 | +29,41% | 94.470,59 | 136.986,30 | +7.574,54 |
| 8% | 135.384,62 | +35,38% | 98.830,77 | 136.986,30 | +1.601,68 |
| 9% | 137.500,00 | +37,50% | 100.375,00 | 136.986,30 | **−513,70** |

**Leitura:** sem DAS residual, o híbrido precisa de +20,55% para preservar a margem; com 8% de DAS residual, +35,38%. O repasse do app (114.726,03) é **menor que o próprio `P_N` sem DAS residual**: ele cortaria a margem do transportador. O híbrido só deve ser negociado com o detalhamento do DAS e do crédito; o número do app não serve para isso.

### 4.5 Comparativo anual — R$ 100.000,00/mês

A tabela consolida o **desembolso bruto** e o **custo líquido** anuais em três estratégias. “Congelado” = preço nominal constante; “repasse” = preço que preserva o líquido/margem.

| Ano | Congelado: bruto | Congelado: líquido (regular) | Repasse regular: bruto | Repasse regular: líquido | Simples margem: bruto | Simples margem: líquido |
|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 1.200.000,00 | 1.005.000,00 | 1.200.000,00 | 1.005.000,00 | 1.200.000,00 | 1.200.000,00 |
| 2026 | 1.200.000,00 | 1.005.000,00 | 1.200.000,00 | 1.005.000,00 | 1.200.000,00 | 1.200.000,00 |
| 2027 | 1.200.000,00 | 1.014.000,00 | 1.189.349,11 | 1.005.000,00 | 1.192.738,03 | 1.164.291,23 |
| 2029 | 1.200.000,00 | 1.000.200,00 | 1.205.758,85 | 1.005.000,00 | 1.203.926,49 | 1.175.212,84 |
| 2033 | 1.200.000,00 | 876.000,00 | 1.376.712,33 | 1.005.000,00 | 1.320.485,45 | 1.288.991,88 |
| **Acumulado 2026–2033** | **9.600.000,00** | **7.827.000,00** | **9.881.594,74** | **8.040.000,00** | **9.791.996,41** | **9.587.077,30** |

**Leitura:**

- **Regular:** o bruto acumulado sobe R$ 281.594,74 (+2,93%) contra o congelado, mas o líquido acumulado sobe R$ 213.000,00 (+2,72%) — porque o congelado destrói o líquido do transportador e, cedo ou tarde, vira reajuste ou perda de serviço. O repasse é mais caro em caixa e mais barato em risco.
- **Simples:** no ano pleno de 2033, o bruto sobe 10,04% e o líquido 7,42%; no acumulado 2026–2033, o bruto sobe 2,00% e o líquido fica praticamente estável (−0,13%), porque 2027–2028 ainda são anos de carga baixa e o bruto do Simples acompanha o custo dos insumos, não os 27% do regime regular.
- **Comparação entre regimes:** o Simples de margem em 2033 (bruto 1.320.485,45; líquido 1.288.991,88) é **mais caro** para o pagador do que o regular de repasse (bruto 1.376.712,33; líquido 1.005.000,00) em **R$ 283.991,88/ano** de líquido. O regular tem bruto maior e líquido menor: é o efeito do crédito integral.

> **Cuidado com a comparação:** o “congelado” não é uma estratégia sustentável. Ele só é apresentado para mostrar o tamanho do subsídio que o transportador teria que dar. Em uma negociação, o preço de equilíbrio é o de repasse, não o congelado.

---

## 5. Contrato variável: como se adequar à oscilação

O contrato de frete tem três fontes de variação que não podem ser misturadas:

1. **Volume** — mês com 80, 120 ou 100 CT-e; sazonalidade, safra, produção.
2. **Custo** — diesel, pneus, manutenção, salário, pedágio; indexadores setoriais.
3. **Tributo** — alíquota anual, regime do transportador, crédito do pagador.

O erro clássico é aplicar um fator tributário médio anual sobre o volume total. Isso cria distorção: o CT-e de janeiro paga o tributo de janeiro, não a média de 2033. A solução é **fator por documento + true-up**.

### 5.1 Arquitetura da cláusula

| Mecanismo | O que faz | Quando usar |
|---|---|---|
| **Preço líquido de referência** | Fixa `P₀` e a carga `t₀` na assinatura; o bruto é derivado | contratos novos, transportador com contabilidade auditável |
| **Fator de repasse** | `f = (1 − t₀)/(1 − t₁)`, aplicado por CT-e | regime regular e híbrido com carga conhecida |
| **Fator de margem** | `P₁ = (custos₁ + margem₀)/(1 − t₁)`, com custos comprovados | Simples, MEI, transportador com insumo não creditável |
| **Conta tributária** | Acumula a diferença entre o fator aplicado e o tributo real; acerta mensalmente | volume variável e mudança de regime |
| **Reset anual** | Recalcula `t₁` com a projeção oficial do ano; assina anexo | todos os contratos de 2026–2033 |
| **Gatilho de revisão** | Reabre se a carga variar > 1,5 p.p., o regime mudar ou a lei mudar | contratos de longo prazo |
| **Cap/floor** | Limita o repasse anual a ±X% e divide o excedente | pagador quer previsibilidade |
| **Direito de auditoria** | Pagador verifica DAS, CT-e e memória de cálculo | sempre |

### 5.2 Exemplo mensal com volume oscilante

Premissas: 100 CT-e de referência a R$ 1.000,00; fator regular 2033 = 1,147260; crédito 27%; Simples de margem = R$ 1.100,40/CT-e (média); crédito 2,385%.

| Mês | CT-e | Bruto regular | Líquido regular | Bruto Simples | Líquido Simples |
|---|---:|---:|---:|---:|---:|
| Janeiro | 80 | 91.780,80 | 67.000,00 | 88.032,36 | 85.933,34 |
| Fevereiro | 120 | 137.671,20 | 100.500,00 | 132.048,55 | 128.900,02 |
| Março | 100 | 114.726,00 | 83.750,00 | 110.040,45 | 107.415,99 |
| **Total** | **300** | **344.178,00** | **251.250,00** | **330.121,36** | **322.249,35** |

O fator é aplicado **por CT-e**, não sobre o total. Se o contrato tem um preço fixo por rota e o volume varia, o bruto mensal é `preço_unitário × f × quantidade`. O true-up compara o tributo efetivamente destacado (ou o DAS pago) com o fator aplicado; a diferença vai para a próxima fatura ou para um encontro de contas anual.

### 5.3 Calendário de ajuste

| Quando | O que fazer | Quem faz |
|---|---|---|
| **Dezembro** | Fechar o ano, apurar o tributo real e o crédito; assinar o anexo tributário do ano seguinte | fiscal + compras |
| **Janeiro** | Aplicar o novo `t₁` e o novo fator; comunicar aos transportadores | compras |
| **Mensal** | Aplicar o fator por CT-e; reconciliar volume e conta tributária | contas a pagar |
| **Trimestral** | Revisar desvios; se > 1,5 p.p., abrir revisão | fiscal + compras |
| **Evento** | Mudança de regime do transportador, nova lei, decisão judicial, split payment | jurídico + fiscal |
| **Anual** | Auditoria da conta tributária e renovação do preço | controladoria |

### 5.4 Esqueleto de cláusula (para revisão jurídica)

> **Cláusula X — Reajuste tributário.**
> 1. O preço do frete será ajustado sempre que houver alteração da carga tributária efetiva do serviço, pela fórmula:
>    `P_t = P_0 × (1 − T_0) / (1 − T_t)`,
>    em que `P_0` é o preço base na data de assinatura, `T_0` é a carga tributária efetiva nessa data e `T_t` é a carga vigente.
> 2. A carga efetiva será apurada pelo motor oficial da Receita Federal ou por memorial de cálculo auditável, com identificação da versão da base e do ano de referência.
> 3. Para o transportador optante do Simples Nacional, `T_t` será a alíquota efetiva do DAS e o reajuste incluirá, separadamente, a variação comprovada dos custos de insumos não creditáveis, limitada a `[X]%` do preço base.
> 4. O reajuste será aplicado a cada CT-e emitido após a vigência da alteração. A diferença entre o valor aplicado e o valor devido será apurada mensalmente e acertada até o 10º dia útil do mês seguinte.
> 5. Se a variação acumulada de `T_t` exceder `1,5` ponto percentual, ou se o transportador alterar seu regime tributário, qualquer parte poderá solicitar revisão extraordinária em até 30 dias.
> 6. O pagador terá direito de auditar o DAS, os CT-e e a memória de cálculo que suportam o reajuste.

**Ressalva:** a cláusula acima é um esqueleto econômico. A redação final precisa de advogado tributarista e de validação de que o mecanismo não conflita com a legislação aplicável, com o contrato de transporte e com as regras de defesa da concorrência.

---

## 6. Respostas diretas às perguntas

### 6.1 “Quanto bruto tenho que pagar para manter o líquido dessa forma?”

Depende de **qual líquido** e de **qual regime**:

| Situação | Fórmula | Resultado em 2033 (R$ 100.000,00/mês) |
|---|---|---:|
| Regular, pagador Lucro Real, preservar líquido do transportador e do pagador | `P = P₀(1 − t₀)/(1 − t₁)` | **R$ 114.726,03/mês** (+14,73%) |
| Regular, pagador Lucro Presumido, preservar o transportador | mesma fórmula | R$ 114.726,03/mês; o pagador fica R$ 83.750,00 (ganho de R$ 9.250,00/mês) |
| Regular, pagador Lucro Presumido, preservar o pagador | `P = C₀/(1 − c₁)` | **R$ 127.397,26/mês** (+27,40%); o transportador fica R$ 93.000,00 |
| Simples, preservar a margem do transportador (DAS 12%, insumos 60%) | `P = (custos₁ + margem₀)/(1 − d₁)` | **R$ 110.040,45/mês** (+10,04%); líquido do pagador R$ 107.415,99 (+7,42%) |
| Simples, faixa de sensibilidade | idem, `s` 40–70%, `d` 10–14% | **R$ 104.322,67 a R$ 114.311,86** (+4,3% a +14,3%) |
| Híbrido, preservar a margem, sem DAS residual | `P = P₀(1 − d₀)/(1 − 27%)` | **R$ 120.547,95/mês** (+20,55%) |
| Híbrido, com 8% de DAS residual | `P = P₀(1 − d₀)/(1 − 35%)` | **R$ 135.384,62/mês** (+35,38%) |

**Resposta curta:** para o caso mais comum (regular + Lucro Real), **R$ 114.726,03/mês** em 2033, ou **+14,73%**; para o Simples, **+10,04%** no cenário base, mas o pagador sente **+7,42%** porque o crédito é baixo. Em 2027–2028, o regular **cai 0,89%**; não presuma que todo ano sobe.

### 6.2 “Um contrato é variável, mês pode aumentar e mês pode subir; como me adequo à oscilação?”

1. **Separe as três variações** (volume, custo, tributo) e trate cada uma com um índice diferente. Não aplique um fator tributário anual sobre o volume.
2. **Aplique o fator por CT-e**, com o preço unitário e a quantidade do mês. O CT-e de janeiro paga a alíquota de janeiro.
3. **Mantenha uma conta tributária** com a diferença entre o fator aplicado e o tributo real; acerte mensalmente ou no fechamento anual.
4. **Faça reset anual** do fator com a projeção oficial e assine um anexo tributário; deixe o gatilho de 1,5 p.p. para revisão extraordinária.
5. **Use cap/floor** se o pagador precisa de previsibilidade: limite o repasse anual e divida o excedente.
6. **Registre a memória de cálculo** (motor, versão da base, ano, CT-e) para auditoria; sem isso, a cláusula vira disputa.

### 6.3 “Como manter o desvio baixo?”

- **Defina a tolerância:** por exemplo, ±1,5% no líquido do pagador e ±1,5% na margem do transportador. Fora disso, renegocie.
- **Reparta o ganho/perda:** no Lucro Presumido, a zona de R$ 12.671,23/mês em 2033 é um ganho; divida-a em vez de deixar o transportador capturar tudo.
- **Priorize crédito integral:** se o prêmio do Simples (bruto menor) não compensar o líquido maior, migre volume para regular/híbrido. Em 2033, o Simples custa R$ 283.991,88/ano **mais** em líquido do que o regular de repasse.
- **Negocie o preço líquido**, não o bruto: o bruto é consequência. Um contrato que fixa o bruto e ignora o crédito transfere todo o risco para o transportador — e ele cobra esse risco no preço.
- **Monitore o regime do transportador:** a mudança de Simples para regular/híbrido altera o crédito e o bruto; exija comunicação e recalcule.

### 6.4 “Isso é fato ou premissa?”

| Afirmação | Status |
|---|---|
| O bruto de 2033 sobe 14,73% no regime regular com crédito integral | **Cálculo** sobre a projeção oficial (premissa de alíquota) |
| Em 2027 o bruto cai 0,89% | **Cálculo** sobre a regra de 2027 (fato) |
| O Simples precisa de +10,04% | **Cenário** com DAS 12%, insumos 60%, margem 8% (premissas a validar) |
| O crédito do Simples em 2033 é 2,385% | **Premissa** do app; o motor só tem 2027 |
| O pagador Lucro Presumido pode pagar até +27,40% e ficar neutro | **Cálculo** sobre a regra de crédito (fato) |
| O repasse do app não vale para Simples/híbrido | **Fato de implementação**: usa a carga do regime regular para todos os perfis |

---

## 7. Riscos e lacunas

| Risco | Efeito no bruto | Mitigação |
|---|---|---|
| Senado fixa alíquota diferente da premissa | fator de 2029–2033 muda | faixa de cenários; reset anual; fonte oficial |
| Crédito do Simples em 2033 indefinido | conflito de 7,6% ou zona de 3,6% | cláusula com faixa; obter a regra; revisão anual |
| DAS e insumos do transportador desconhecidos | bruto de margem errado | exigir DAS, DRE e notas de insumo; auditoria |
| Regime do pagador (Real/Presumido) | crédito e líquido diferentes | modelar os dois; validação fiscal |
| *Split payment* sem data | caixa do transportador piora | cláusula de prazo; capital de giro |
| Contrato com preço fixo até 2033 | transportador absorve 27% e quebra | gatilho de revisão; anexo tributário |
| Volume sazonal | média anual distorce | fator por CT-e + true-up |
| Concorrência | transportador pode absorver no curto prazo | benchmark; não confundir preço de mercado com preço sustentável |
| Cláusula inexequível | disputa judicial | revisão jurídica; arbitragem; memória auditável |

**Lacunas de dados que o estudo não resolve:**

1. **DAS efetivo e composição** de cada transportador (o app só tem a alíquota CBS/IBS do PGDAS, não o DAS total).
2. **Parcela de insumos sujeita a CBS/IBS** e o crédito que o transportador tem hoje.
3. **Regra de crédito do Simples em 2033** (o motor não tem tabela).
4. **DAS residual do híbrido** e a composição após a extinção de ICMS/PIS/COFINS.
5. **Curva de volume** por rota e por transportador, para o true-up.
6. **Prazo de crédito** do pagador e o custo do capital de giro.

---

## 8. Recomendações

### 8.1 Para a decisão (pagador)

1. **Adote o líquido como métrica de decisão** e o bruto como métrica de caixa. O bruto sobe 14,73% no regular, mas o líquido fica parado; o orçamento precisa dos dois números.
2. **Segmente os transportadores por regime** e negocie o repasse com a fórmula certa: regular/híbrido pela carga; Simples pela margem e pelo DAS.
3. **No Lucro Presumido, cobre a zona de acordo:** o pagador pode pagar até R$ 127.397,26/mês (2033) e ficar neutro; a zona de R$ 12.671,23/mês é o ganho a repartir com o transportador, não um custo extra.
4. **No Simples, compare o prêmio com o custo líquido:** o bruto menor pode esconder um líquido **R$ 283.991,88/ano maior em 2033**. Se o serviço não justifica, migre volume.
5. **Trave a cláusula agora:** o contrato de 2026–2033 precisa de anexo tributário, true-up e gatilho de revisão. Sem isso, o risco vira preço.

### 8.2 Para o produto (sem implementar agora)

O estudo aponta quatro evoluções que o app precisaria para responder à pergunta do usuário:

1. **Repasse por regime e por margem:** três modos — receita líquida, margem e teto do pagador — com o DAS e os insumos como entradas.
2. **Visão anual de contrato:** bruto, crédito e líquido mês a mês, com true-up e acumulado 2026–2033.
3. **Coleta de dados do transportador:** DAS, composição de custos, parcela de insumos, regime e histórico de CT-e.
4. **Pacote de auditoria:** memória do motor, versão da base, fator aplicado, diferença e justificativa.

Nada disso deve ser implementado antes de validar as premissas com 2–3 transportadores reais. O estudo é o roteiro; o piloto é o próximo passo.

### 8.3 Próximos 90 dias

| Prazo | Ação | Entregável |
|---|---|---|
| 30 dias | Coletar DAS, DRE e notas de insumo de 3 transportadores; validar a parcela de insumos | planilha de premissas revisada |
| 45 dias | Rodar os cenários 2027/2029/2033 com os dados reais; comparar com o modelo | relatório de aderência |
| 60 dias | Revisar a cláusula com jurídico; definir tolerância e split | minuta de cláusula |
| 90 dias | Piloto em uma rota com conta tributária mensal | extrato de true-up e decisão |

---

## 9. Anexos

### 9.1 Glossário

- **Bruto (`P`):** preço nominal do frete, com tributo embutido.
- **Carga (`T`):** tributo destacado no documento; `T = t × P`.
- **Crédito (`K`):** parcela da carga que o pagador aproveita; `K = c × P`.
- **Líquido do pagador (`C`):** `P − K`.
- **Receita líquida do transportador (`RL`):** `P − T`.
- **Margem (`M`):** `RL − custos`.
- **Fator de repasse (`f`):** `(1 − t₀)/(1 − t₁)`.
- **Preço neutro do transportador (`P_N`):** preço que preserva `RL` ou `M`.
- **Preço neutro do pagador (`P_C`):** preço que preserva `C`.
- **Zona de acordo:** intervalo entre `P_N` e `P_C` quando `P_N < P_C`.
- **True-up:** acerto da diferença entre o fator aplicado e o tributo real.

### 9.2 Fórmulas

```
Carga:                    T = t × P
Receita líquida:          RL = P × (1 − t)
Crédito:                  K = c × P
Líquido do pagador:       C = P × (1 − c)
Repasse de receita:       P₁ = P₀ × (1 − t₀) / (1 − t₁)
Repasse de margem:        P₁ = (custos₁ + margem₀) / (1 − t₁)
Preço neutro do pagador:  P_C = P₀ × (1 − c₀) / (1 − c₁)
Zona de acordo:           [P_N, P_C] se P_N < P_C; conflito se P_N > P_C
Anual:                    Σ (P_m × Q_m)
```

### 9.3 Fontes

- **LC 214/2025** — IBS/CBS, crédito, transição, split payment; arts. 12, 18, 31–35, 41, 47, 169, 347, 348, 349, 501.
- **EC 132/2023** — reforma tributária do consumo; ADCT arts. 125–129.
- **Motor oficial** `calculadora-rtc-regime-regular` (fork local, base V0073): `POST /api/calculadora/frete/projecao`.
- **Documentação interna:** [`docs/frete.md`](../frete.md), [`docs/especialista-fiscal/exemplo-execucao.md`](../especialista-fiscal/exemplo-execucao.md), [`app/README.md`](../../app/README.md), [`ARCHITECTURE.md`](../../ARCHITECTURE.md).
- **Código do repasse:** [`app/pagador.js`](../../app/pagador.js), `fatorRepasse` e `construirHorizonte`.

### 9.4 Premissas do modelo

| Premissa | Valor base | Faixa de sensibilidade |
|---|---:|---|
| Frete mensal | R$ 100.000,00 | R$ 10.000,00 a R$ 1.000.000,00 |
| Rota | SP → BA (ICMS 7%) | interna 18%; outras interestaduais 7%/12% |
| Carga 2025 | 16,25% | 12,00% a 21,25% |
| Carga 2033 | 27,00% | 25,00% a 29,00% |
| Crédito regular 2033 | 27,00% | 25,00% a 29,00% |
| Crédito Simples 2033 | 2,385% | 2,385% a 12,00% |
| DAS Simples | 12,00% | 10,00% a 14,00% |
| Insumos sujeitos a CBS/IBS | 60,00% | 40,00% a 70,00% |
| Margem do transportador | 8,00% | 5,00% a 12,00% |
| Fator de preço dos insumos | 1,14726 | 1,05 a 1,20 |
| Volume | 100 CT-e/mês | 80 a 120 CT-e/mês |

### 9.5 Como usar o modelo em Excel

O arquivo [`modelo-frete-bruto.xlsx`](modelo-frete-bruto.xlsx) tem cinco abas:

1. **Leia-me** — o que é cada aba e como preencher.
2. **Premissas** — células amarelas editáveis (frete, DAS, insumos, margem, crédito).
3. **Cenarios** — regular, Presumido e Simples, com `P_N`, `P_C`, líquido e anual.
4. **Sensibilidade** — tabela de insumos × DAS e crédito × conflito.
5. **Contrato** — exemplo mensal com volume e true-up.

Altere apenas as células amarelas; as fórmulas recalculam o resto. O modelo é uma ferramenta de negociação, não uma apuração fiscal.

---

## Fechamento

A reforma não cria um “aumento de 27%” no frete. Ela cria **três efeitos diferentes**:

1. **No regime regular com crédito integral**, o bruto sobe 14,73% até 2033 e o líquido do pagador fica parado. É caixa, não despesa.
2. **No Lucro Presumido**, o crédito novo é maior que o repasse; há uma zona de ganho de R$ 12.671,23/mês em 2033 que precisa ser negociada.
3. **No Simples**, o crédito não acompanha o custo; o bruto sobe ~10% e o líquido do pagador sobe ~7,4% no cenário base. É o caso em que a reforma realmente aumenta o custo — e onde o app atual mais precisa de um modelo novo.

O próximo passo não é implementar: é **validar as premissas com dados reais de 2–3 transportadores**. O estudo dá o mapa; o piloto dá a confiança.
