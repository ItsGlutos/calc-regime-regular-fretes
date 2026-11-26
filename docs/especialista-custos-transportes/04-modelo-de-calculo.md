# 04 — Modelo de cálculo

**Objetivo:** transformar `diária × dias` em **bruto**, **líquido do transportador**, **crédito do pagador** e **custo líquido do pagador**, para os três regimes, com regras de arredondamento e tratamento de mês irregular.

Compatível com o motor já existente no app: o CBS/IBS **não** é calculado aqui — vem do motor oficial da Receita (`app/engine.js`), e este documento só define **como o valor do frete é formado** e **como o crédito é lido** (`app/domain.js`, `creditosDoPagador`).

---

## 1. Notação

| Símbolo | Significado | Unidade |
|---|---|---|
| `d` | diária do veículo | R$/dia |
| `n` | dias faturáveis do mês | dias |
| `B` | bruto mensal (preço do serviço) | R$ |
| `t` | carga tributária **do transportador**, por dentro | fração (0–1) |
| `c` | crédito **do pagador**, por dentro | fração (0–1) |
| `T` | tributo devido pelo transportador | R$ |
| `L` | líquido do transportador (receita menos tributo) | R$ |
| `K` | crédito do pagador | R$ |
| `C` | custo líquido do pagador | R$ |
| `D` | DAS efetivo do Simples (Anexo III) | fração |
| `F` | custo fixo mensal do transportador | R$/mês |
| `v` | custo variável | R$/km |
| `k` | km por dia | km/dia |

**Regra de ouro:** `t` e `c` são **"por dentro"**. O preço `B` já contém o tributo. Não se soma alíquota ao preço; multiplica-se o preço pela alíquota.

---

## 2. As fórmulas

### 2.1 Bruto mensal

```
B = d × n
```

Nada mais. Sem rateio por dia corrido, sem "média de 30 dias", sem multiplicar por 4 semanas.

### 2.2 Tributo e líquido do transportador, por regime

| Regime | Tributo `T` | Líquido `L` | Observação |
|---|---|---|---|
| **Regular** (Lucro Real/Presumido) | `T = t × B` | `L = B × (1 − t)` | `t` = ICMS + PIS/COFINS até 2026; ICMS + CBS + IBS de 2027 em diante |
| **Simples Nacional** | `T = D × B` | `L = B × (1 − D)` | `D` = alíquota **efetiva** do DAS (Anexo III), não a nominal da faixa |
| **MEI** | `T = DAS_fixo` | `L = B − DAS_fixo` | o MEI não paga percentual sobre a receita: paga valor fixo mensal |
| **Autônomo (TAC) não MEI** | depende do regime | idem regular ou Simples | se pessoa física, há retenções na fonte (IRRF, INSS, SEST/SENAT) — fora do escopo deste modelo |

**`DAS_fixo` do MEI caminhoneiro** (LC 123/2006, art. 18-F, III):

```
DAS_fixo = 12% × salário mínimo + R$ 1,00 (ICMS)
```

O app **não deve fixar** o salário mínimo: leia de configuração e mostre a data de vigência. Com o mínimo em vigor, o DAS do MEI caminhoneiro fica na casa de **R$ 180 a R$ 200 por mês** (estimativa; o valor exato depende do mínimo do ano).

### 2.3 Crédito do pagador

```
K = c × B
```

| Perfil do transportador | `c` | Natureza |
|---|---:|---|
| Regime regular | **igual a `t`** (crédito integral do destaque) | regra legal (LC 214/2025, art. 47) |
| Simples — CBS/IBS dentro do DAS | **0,92% a 4,00%** do bruto (faixa setorial); PGDAS 2027 ≈ **2,385%** | premissa do app, apurada pelo motor do Simples |
| Simples — híbrido | integral (CBS/IBS recolhido no regime regular) | regra legal |
| MEI / autônomo | **1,80% a 4,00%** (faixa setorial; ref. 1,80%) | premissa do app |
| Pagador **consumidor final (B2C)** | **0** | não há crédito |

### 2.4 Custo líquido do pagador

```
C = B − K = B × (1 − c)
```

### 2.5 O "por dentro" em uma linha

```
B = L / (1 − t)     →     L = B × (1 − t)
```

Duas consequências que costumam ser erradas na mão:

1. **Para preservar o líquido**, o fator é `(1 − t₀) / (1 − t₁)`, **não** `1 + (t₁ − t₀)`. Com `t₀ = 16,25%` e `t₁ = 27,00%`, o fator é `0,8375 / 0,73 = 1,1473` (**+14,73%**). Usar a diferença de alíquotas (10,75 p.p. → fator 1,1075) **subestima** o repasse em **3,5%** do preço — e é o erro que aparece em toda planilha que "soma a alíquota nova".
2. **Para sair do líquido para o bruto**, divide-se por `(1 − t)`, não se multiplica por `(1 + t)`. Com `t = 27%`, `1/0,73 = 1,3699`: +36,99% sobre o líquido, que equivalem a +14,73% sobre o bruto atual — porque o bruto atual **já embutia** 16,25% de carga.

### 2.6 Repasse e ponto de equilíbrio (quando o preço precisa mudar)

```
Repasse que preserva receita : B₁ = B₀ × (1 − t₀) / (1 − t₁)
Repasse que preserva margem  : B₁ = (custos₁ + margem₀) / (1 − t₁)
Preço neutro do pagador      : B_C = B₀ × (1 − c₀) / (1 − c₁)
```

Já documentado em [`../estudo-frete-bruto/RELATORIO.md`](../estudo-frete-bruto/RELATORIO.md); aqui só é reaproveitado para o botão "quanto preciso cobrar".

### 2.7 Custo do transportador e margem (para o alerta de diária inviável)

```
custo_dia   = F / n + v × k
custo_mes   = F + v × k × n
margem      = (B − custo_mes) / B
diaria_min  = custo_dia / (1 − t)
```

`diaria_min` é a diária que **cobre custo e tributo sem lucro**. É o número que deve acender o alerta vermelho quando o usuário digitar menos que isso.

### 2.8 Estadia (quando o dia é consumido por espera)

```
estadia = horas_paradas × capacidade_t × 2,84
```

Não entra em `B`. É linha separada da fatura: somar estadia ao bruto mensal infla a base do tributo sem que haja serviço de transporte correspondente.

---

## 3. Exemplo completo — carreta, 22 dias, R$ 3.500/dia

Premissas: `d = 3.500`, `n = 22`, rota **interestadual** (ICMS 7%), ano **2026** (carga de 16,25%), Simples com DAS efetivo de **12%**.

```
B = 3.500 × 22 = 77.000,00
```

| Linha | Regular (t = 16,25%) | Simples (D = 12%) | MEI (DAS fixo ≈ 180) |
|---|---:|---:|---:|
| Bruto `B` | 77.000,00 | 77.000,00 | 77.000,00 |
| Tributo `T` | 12.512,50 | 9.240,00 | ~180,00 |
| **Líquido transportador `L`** | **64.487,50** | **67.760,00** | **~76.820,00** |
| Alíquota de crédito `c` | 16,25% | 2,385% | 1,80% |
| Crédito `K` | 12.512,50 | 1.836,45 | 1.386,00 |
| **Custo líquido `C`** | **64.487,50** | **75.163,55** | **75.614,00** |

**Leituras que o produto precisa mostrar:**

1. No **regular**, `L` e `C` são **iguais** (64.487,50): o tributo é pass-through e o crédito é integral.
2. No **Simples**, o transportador fica **R$ 3.272,50 melhor** que no regular, mas o pagador fica **R$ 10.676,05 pior**. O crédito baixo é o custo escondido.
3. No **MEI**, o líquido do transportador é o maior de todos (o DAS fixo é irrisório), mas o crédito do pagador é o menor.
4. **Nenhum regime é "melhor"**: depende de quem senta dos dois lados da mesa.

### 3.1 O mesmo exemplo com a diária implícita

Se o usuário digitar **R$ 77.000/mês** em vez da diária, o app calcula:

```
d = 77.000 / 22 = 3.500,00
```

E deve exibir "diária implícita = R$ 3.500,00 (22 dias)" — nunca esconder a divisão.

---

## 4. Meses de 28, 29, 30 e 31 dias

### 4.1 O que **não** fazer

- ❌ `diária = bruto_mensal / 30` — usa base de dia corrido para um serviço cobrado por dia útil.
- ❌ `bruto = diária × 30` — inventa um dia que não existe em fevereiro e ignora que domingo não fatura.
- ❌ `bruto = diária × 4 × semanas_do_mês` — mistura semana comercial com mês civil.

### 4.2 O que fazer

```
B(mês) = d × n(mês)
```

`n(mês)` vem de uma das três fontes, nesta ordem:

| Prioridade | Fonte de `n` | Como calcular | Quando usar |
|---:|---|---|---|
| 1 | **Informado** | usuário digita 1–31 | quem tem apontamento |
| 2 | **Calendário** | dias úteis do mês, menos feriados locais, menos paradas declaradas | mês real, contrato com cliente |
| 3 | **Default** | 22 (base) / 20 / 24 | orçamento, simulação, ano inteiro |

### 4.3 Comportamento por comprimento do mês

| Mês | Dias corridos | Efeito no bruto | Efeito no custo fixo/dia | O que o app faz |
|---|---:|---|---|---|
| Fevereiro comum | 28 | cai se `n` cair | sobe 7,1% (30/28) | usa `n` do calendário; avisa se o default foi usado |
| **Fevereiro bissexto** | 29 | idem | sobe 3,4% | idem |
| 30 dias | 30 | neutro | neutro | idem |
| 31 dias | 31 | sobe se `n` subir | cai 3,2% | idem |
| Mês com 23 dias úteis | — | +4,5% sobre o default de 22 | — | sugere `n = 23` |

**Regra de interface:** sempre mostrar `n` em campo visível e editável, com o rótulo "dias faturados neste mês". Default silencioso é a origem de 90% das discussões de fatura.

### 4.4 Ano bissexto e o custo fixo

Fevereiro bissexto tem **o mesmo número de dias úteis** de um fevereiro comum na maioria dos anos; o que muda é o custo fixo rateado por dia, porque o mês tem um dia a mais. O app **não** deve ajustar a diária por isso — só o painel de custo.

### 4.5 Contrato que começa ou termina no meio do mês

```
B = d × n_efetivo
```

`n_efetivo` = dias entre o início (ou até o fim) do contrato que sejam faturáveis. Nunca `d × n × (dias_contrato / dias_mês)`: a diária é unitária, não mensal.

---

## 5. Ordem das operações e arredondamento

### 5.1 Ordem canônica

```
1. d    ← diária informada (2 casas)
2. n    ← dias (inteiro)
3. B    ← d × n                      → arredonda 2 casas
4. T    ← B × t                      → arredonda 2 casas
5. L    ← B − T                      → arredonda 2 casas (subtração, não multiplicação)
6. K    ← B × c                      → arredonda 2 casas
7. C    ← B − K                      → arredonda 2 casas
8. %    ← percentuais exibidos com 2 casas, calculados sobre B já arredondado
```

**Por que `L = B − T` e não `L = B × (1 − t)`:** em centavos, as duas contas divergem em 1 centavo com frequência. Subtrair garante que `L + T = B` exatamente — e é isso que o usuário confere na calculadora do celular.

### 5.2 Regras

| Regra | Escolha | Motivo |
|---|---|---|
| Casas decimais | **2** em todo valor monetário | centavo é a unidade legal |
| Modo de arredondamento | **meio para cima** (`ROUND_HALF_UP`) | é o que a planilha e a nota fiscal fazem; evita divergência de 1 centavo |
| Alíquotas | guardar com **4 casas**; arredondar só na exibição | 2,385% arredondado para 2,39% muda R$ 3,85 em R$ 77.000 |
| Percentuais exibidos | 2 casas | legibilidade |
| Soma de linhas | sempre fechar no bruto (`T + L = B`; `K + C = B`) | auditabilidade |
| Nunca | arredondar `d` antes de multiplicar por `n` | R$ 3.500,004 × 22 ≠ R$ 3.500,00 × 22 |

### 5.3 Precisão interna

- Em JavaScript, **não** usar `float` puro para acumular: trabalhar em **centavos inteiros** ou em `decimal` e converter na borda.
- O motor oficial devolve CBS/IBS com 2 casas; **não reajustar** o destaque para "fechar" com o cálculo local — a diferença é memória de cálculo, não erro.

---

## 6. Custo do transportador: fixo × variável

**Não encontrado:** percentual público de custo fixo do TRC brasileiro em fonte acessível (o Manual do NTC&Logística não é público; CNT, SEST/SENAT e ILOS servem conteúdo por JavaScript). O que existe e pode ser usado:

| Elemento | Status | Valor |
|---|---|---|
| Classificação fixo × variável | **metodologia setorial** (fonte 18) | ver tabela abaixo |
| Base de rateio do custo fixo | **convenção do setor** (fonte 16) | **230 horas/mês** por veículo |
| Custo da hora parada (CHP) | **fórmula setorial** (fonte 16) | `CHP = custo fixo mensal / 230` |
| Percentual de custo fixo | **não encontrado** | estimativa: **35% a 45%** para carreta em longa distância; **50% a 60%** para distribuição urbana (marcar como estimativa) |

### 6.1 Classificação (para o painel de custos)

| Custo **fixo** (existe com o caminhão parado) | Custo **variável** (só existe rodando) |
|---|---|
| depreciação e remuneração do capital | diesel |
| salário + encargos do motorista | ARLA, lubrificantes |
| seguro (casco, RC-DC, carga) | manutenção e peças |
| IPVA, licenciamento, seguro obrigatório | pneus e recapagem |
| rastreamento, telemetria, gestão de risco | pedágio |
| estrutura administrativa rateada | diárias de viagem e alimentação |
| pátio, oficina, pessoal indireto | lavagem, pequenos serviços |

### 6.2 Ponte hora → dia → mês

```
custo_hora   = F / 230
custo_dia    = custo_hora × horas_por_dia   (8 h → F / 28,75)
custo_mes    = F + v × k × n
```

> **Atenção:** `230 h ÷ 8 h = 28,75 dias` — número **maior** que os 22 dias faturáveis. Isso não é erro: o custo fixo é rateado sobre as horas em que o veículo está **disponível** (incluindo sábado e espera), mas a receita só entra nos dias **faturados**. Confundir os dois faz o custo por dia parecer 30% menor do que é.

### 6.3 Ponto de equilíbrio

```
n_equilibrio = F / (d × (1 − t) − v × k)
```

Exemplo com números redondos: `F = 25.000`, `d = 3.500`, `t = 16,25%`, `v = 4,20`, `k = 400`:

```
receita líquida por dia = 3.500 × 0,8375 = 2.931,25
custo variável por dia  = 4,20 × 400     = 1.680,00
margem de contribuição  = 1.251,25
n_equilibrio            = 25.000 / 1.251,25 = 19,98 → 20 dias
```

Ou seja: abaixo de **20 dias** o mês fecha no vermelho. É exatamente o limite inferior do cenário conservador de `02-dias-e-jornada.md` — e o motivo pelo qual 20 não é um número escolhido ao acaso.

---

## 7. Resumo das fórmulas (para implementação)

```
ENTRADAS
  d      diária (R$/dia)
  n      dias faturados no mês
  regime REGULAR | SIMPLES | MEI
  t      carga do transportador (por ano e por UF)
  c      crédito do pagador (por regime e por ano)
  D      alíquota efetiva do DAS (Simples)
  S      salário mínimo vigente (MEI)

SAÍDAS
  B  = d × n
  T  = REGULAR ? B × t : SIMPLES ? B × D : MEI ? (0,12 × S + 1,00) : B × t
  L  = B − T
  K  = B × c
  C  = B − K
  d_implícita = B / n
  custo_dia   = F / 230 × horas_dia + v × k
  margem      = (B − (F + v × k × n)) / B
  alerta      = d < custo_dia / (1 − t)
```

**Invariantes que o teste automatizado deve verificar:**

1. `T + L = B` (tolerância 0 centavo).
2. `K + C = B` (tolerância 0 centavo).
3. `B2C → c = 0 → C = B`.
4. `REGULAR → c = t → C = L`.
5. `n = 0` é inválido; `d = 0` é inválido; `d` ou `n` negativos são inválidos.
6. MEI com `B × 12 > 251.600` → estado inválido, não simulação.
