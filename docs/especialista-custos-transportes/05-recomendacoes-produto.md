# 05 — Recomendações de produto

Especificação acionável: defaults, validações com mensagem pronta, textos de ajuda, avisos legais, casos de borda e o que o produto **não** deve prometer.

---

## 1. Defaults

### 1.1 Campos do perfil do transportador

| Campo | Default | Editável | Origem |
|---|---|---|---|
| Nome do perfil | vazio (obrigatório) | sim | usuário |
| Tipo de veículo | **Truck** | sim | `03-diarias-de-mercado.md` §4 |
| UF de origem | UF do perfil anterior ou **SP** | sim | usuário |
| UF de destino | mesma da origem (**interna**) | sim | usuário |
| Optante do Simples | **não** | sim | usuário |
| Regime | **Regular** (se Simples = não) | sim | usuário |
| **Diária (R$/dia)** | **R$ 1.800** (truck) | sim | derivado |
| **Dias faturados/mês** | **22** | sim | `02-dias-e-jornada.md` §4 |
| km/dia | **320** (truck) | sim, avançado | premissa operacional |
| Fator regional | **1,00** | sim, avançado | estimativa |

### 1.2 Diária default por tipo de veículo

| Tipo | Mín. | **Base** | Máx. | km/dia |
|---|---:|---:|---:|---:|
| 3/4 | 550 | **720** | 900 | 250 |
| Toco | 860 | **1.080** | 1.350 | 280 |
| Truck | 1.440 | **1.800** | 2.200 | 320 |
| Carreta | 2.820 | **3.500** | 4.300 | 400 |
| Bitrem | 3.820 | **4.800** | 5.850 | 450 |

**Por que o default é o "base" e não a média da faixa:** o base é o valor **derivado** (R$/km × km/dia), com método auditável. O mínimo e o máximo são bandas de sensibilidade. Default tem que ser o número que o especialista defende, não o meio de uma faixa.

### 1.3 Cenários de dias

| Cenário | Dias | Quando é o default |
|---|---:|---|
| Conservador | **20** | orçamento anual, contrato novo, veículo > 5 anos |
| **Base** | **22** | **sempre**, ao abrir o formulário |
| Otimista | **24** | perfil marcado como **MEI/autônomo** |

---

## 2. Validações

### 2.1 Diária

| Condição | Severidade | Mensagem |
|---|---|---|
| `d <= 0` | **erro (bloqueia)** | "Informe a diária em reais. O valor precisa ser maior que zero." |
| `d < 0,40 × base` | **erro (bloqueia)** | "R$ {d} por dia está muito abaixo da faixa de {tipo} (R$ {min}–{max}). Se você digitou o valor de uma viagem ou o frete mensal, use o campo correspondente." |
| `d < min` | **aviso** | "Abaixo da faixa de referência para {tipo} (R$ {min}–{max}). O cálculo segue, mas confira se a diária inclui motorista, combustível e pedágio." |
| `d > max` | **aviso** | "Acima da faixa de referência para {tipo} (R$ {min}–{max}). Valores altos são comuns em carga especial, operação dedicada com exclusividade ou região de retorno escasso." |
| `d > 20 × base` | **erro (bloqueia)** | "Valor fora de qualquer faixa plausível. Verifique se a diária foi digitada em centavos ou se é o valor mensal." |
| `d` não numérico / vírgula e ponto misturados | **erro** | "Use apenas números, com vírgula para centavos (ex.: 3.500,00)." |

### 2.2 Dias

| Condição | Severidade | Mensagem |
|---|---|---|
| `n < 1` | **erro** | "O mês precisa ter ao menos 1 dia faturado." |
| `n > 31` | **erro** | "Um mês tem no máximo 31 dias." |
| `n > 26` | **erro (a partir de 16/12/2026)** | "Com dois dias de repouso semanal (EC 141/2026), o teto é de ~22 dias por mês. 26 dias só é possível para autônomo/MEI, que não segue jornada CLT — confirme o regime." |
| `n > 26` | **aviso (até 15/12/2026)** | "26 dias corresponde à escala 6×1, que deixa de valer em 16/12/2026." |
| `n < 15` | **aviso** | "Menos de 15 dias costuma indicar mês parcial, veículo em manutenção ou contrato recém-iniciado. Confirme." |
| `n` diferente dos dias úteis do mês | **info** | "Este mês tem {uteis} dias úteis; você informou {n}." |

### 2.3 Regime e limite

| Condição | Severidade | Mensagem |
|---|---|---|
| **MEI** com `B × 12 > 251.600` | **erro (bloqueia simulação)** | "Com esta diária e {n} dias, o faturamento anual seria R$ {anual}, acima do limite do MEI caminhoneiro (R$ 251.600,00/ano — LC 123/2006, art. 18-F). O teto equivale a R$ 20.966,67/mês. Reduza a diária/dias ou escolha Simples." |
| **MEI** com `B × 12 > 0,8 × 251.600` | **aviso** | "Você está a {pct}% do limite do MEI caminhoneiro. Um mês bom pode desenquadrar o perfil." |
| **Simples** sem alíquotas do PGDAS | **info** | "Sem as alíquotas efetivas do PGDAS, usamos a faixa setorial de 0,92% a 4,00% para o crédito do pagador. O resultado é estimativa." |
| **Simples** com DAS fora de 6%–19,5% | **aviso** | "A alíquota efetiva do Anexo III fica entre 6,00% e 19,50% (LC 123/2006). Confira o valor informado." |
| **MEI** informando alíquota percentual | **erro** | "O MEI não recolhe percentual sobre a receita: paga valor fixo mensal (12% do salário mínimo + R$ 1,00 de ICMS)." |

### 2.4 Operação

| Condição | Severidade | Mensagem |
|---|---|---|
| Origem = destino | **info** | "Operação interna: o ICMS é o da UF ({aliquota}%). A diária não muda — muda o líquido e o crédito." |
| Interestadual | **info** | "Operação interestadual: ICMS de 7% ou 12% conforme a região. A diária não muda." |
| Perfil sem diária | **erro** | "Sem diária não há como calcular o faturamento mensal. Informe o valor cobrado por dia." |
| Usuário digita valor mensal e diária juntos | **erro** | "Escolha um modo de entrada: diária × dias **ou** valor mensal. Os dois juntos geram contradição." |

---

## 3. Textos de ajuda (prontos para copiar)

### 3.1 Diária

> **Diária do veículo (R$/dia)**
> Quanto você cobra por **um dia de caminhão à disposição** — com motorista, combustível e pedágio, ou só o veículo, conforme o seu contrato.
> Não é a diária de viagem do motorista (ajuda de custo) nem a estadia (cobrança por tempo parado em carga/descarga). Se você cobra por viagem ou por km, use o simulador de frete.
> Referência para **{tipo}**: R$ {min} a R$ {max}, com base em {km}/dia e no piso mínimo da ANTT.

### 3.2 Dias faturados

> **Dias faturados neste mês**
> Quantos dias o veículo efetivamente gerou receita. O padrão é **22**, que é o teto de uma semana de 5 dias (52 semanas ÷ 12 × 5 = 21,7).
> Cuidado: **dia útil não é dia faturado**. Fevereiro e novembro têm menos dias úteis por causa de feriados; meses com manutenção têm menos ainda.
> A partir de 16/12/2026 a Constituição garante **dois dias de repouso semanal** (EC 141/2026): a escala 6×1 deixa de existir para motorista empregado.

### 3.3 Por que o mês não tem sempre os mesmos dias

> Um mês tem 28, 29, 30 ou 31 dias, e o número de dias úteis varia de **19 a 23**. Por isso o faturamento é `diária × dias`, e não `diária × 30`.
> Se você prefere informar o valor mensal, o app mostra a diária implícita — e você confere se ela faz sentido.

### 3.4 Regime

> **Por que o regime muda o líquido**
> No **regime regular**, o transportador destaca ICMS + PIS/COFINS (e CBS/IBS a partir de 2027) e o pagador credita tudo: o líquido do transportador e o custo líquido do pagador coincidem.
> No **Simples**, o DAS substitui os tributos, mas o crédito do pagador é só a parcela de CBS/IBS embutida no DAS — bem menor. O transportador fica melhor; o pagador, pior.
> No **MEI**, o DAS é um valor fixo mensal: o líquido do transportador é alto, o crédito do pagador é quase nulo.
> O app mostra os dois lados porque a negociação depende dos dois.

### 3.5 Estadia (texto educativo, não campo)

> **Estadia não é diária.** Se o caminhão fica mais de **5 horas** em carga ou descarga (Lei 11.442/2007, art. 11, § 5º), o transportador tem direito a **R$ 2,84 por tonelada/hora** (valor legal reajustado pelo INPC), pela capacidade do veículo. Para uma carreta de 27 t, isso dá **R$ 76,68 por hora** — cerca de R$ 613 por um dia de 8 horas paradas, ou 17,5% da diária.
> Ou seja: estadia indeniza o tempo, não o dia comercial. Não some as duas como se fossem a mesma coisa.

---

## 4. Avisos legais (rodapé e modal)

### 4.1 Rodapé fixo

> **Estimativa, não parecer.** Os valores de diária são **referências derivadas** de fontes públicas (piso mínimo da ANTT e estadia da Lei 11.442/2007), não cotações de mercado. A apuração de tributos usa o motor oficial da Receita Federal e as regras da LC 214/2025 e da LC 123/2006, mas **não substitui** a apuração do seu contador. Este app não calcula o piso mínimo da ANTT nem atesta conformidade com ele.

### 4.2 Modal na primeira simulação

> Este cálculo trata **dois líquidos diferentes**: o do transportador (o que sobra depois do tributo) e o do pagador (o que sobra depois do crédito). Em uma cadeia de crédito integral, os dois coincidem; no Simples e no MEI, não.
> O resultado é uma **estimativa para negociação**. Não é guia de recolhimento, não gera obrigação acessória e não considera retenções na fonte (IRRF, INSS, SEST/SENAT), que dependem do tipo de transportador.

### 4.3 Aviso específico de ano de transição

> **2026 é ano de teste da reforma.** O CBS/IBS de 1% é compensado e **não gera crédito** ao adquirente (LC 214/2025, art. 348). Em **2027** o PIS/COFINS é extinto e entra a CBS de 8,40% + IBS de 0,10%. Compare os anos antes de fechar contrato.

---

## 5. Casos de borda

| Caso | O que fazer | Por quê |
|---|---|---|
| **MEI acima do limite** | bloquear a simulação com a conta do limite anual na mensagem | simular um regime impossível é pior que não simular |
| **MEI que presta serviço a PJ** | funcionar normal, mas avisar que o tomador **não** credita CBS/IBS do MEI | crédito residual é ~1,8%–4%, não o destaque cheio |
| **Simples sem PGDAS** | usar faixa setorial e marcar `estimativa: true` | o app não pode inventar a alíquota efetiva |
| **Simples híbrido** | tratar como regular para CBS/IBS, mas avisar do DAS residual | o híbrido pode continuar pagando DAS sobre outros tributos |
| **Interestadual vs interna** | recalcular `t` (ICMS 7%/12% contra interna da UF), **não** a diária | diária é preço; ICMS é tributo |
| **Feriado municipal/estadual** | não entra no default; permitir edição de `n` | não há base nacional para feriado local |
| **Fevereiro bissexto** | `n` normal; só o custo fixo por dia muda | o dia extra não é dia útil automaticamente |
| **Contrato iniciado no meio do mês** | `n` = dias efetivos, nunca proporcional | diária é unitária |
| **Múltiplos veículos** | `B = Σ(d_i × n_i)` | perfis independentes por veículo |
| **Diária sem motorista** | permitir, mas avisar que o custo do motorista não está no preço | muda a margem, não o tributo |
| **12×36 / dois motoristas** | permitir `n` até 26 mesmo após 16/12/2026, com aviso | é regime especial por CCT (CLT art. 235-F), mas o teto semanal continua |
| **Carga fracionada** | não aplicar piso ANTT; o piso é de **carga lotação** | critérios da ANTT (Ofício SEI 20899/2026) |
| **Usuário digita diária de viagem do motorista (R$ 120)** | bloquear pelo mínimo de 40% do base | é a confusão mais provável e a mais cara |

---

## 6. O que **não** prometer

| Não prometa | Por quê | Diga em vez disso |
|---|---|---|
| "Preço de mercado da diária" | não há tabela pública; o número é derivado | "faixa de referência derivada do piso ANTT" |
| "Está conforme o piso mínimo da ANTT" | o app não calcula o piso (coeficientes por eixo e distância) | "o piso é referência de comparação, não cálculo do app" |
| "Você vai pagar X% menos" | o resultado depende de regime, UF, ano e crédito do pagador | "neste cenário, o custo líquido é R$ X" |
| "Crédito garantido de Y%" | o crédito depende do regime **do pagador** e do uso do serviço | "crédito estimado, condicionado ao regime do tomador" |
| "Economia de imposto" | o app mostra carga e crédito, não planejamento tributário | "comparação de carga tributária entre regimes" |
| "Serve para o Simples de 2033" | o motor do Simples só tem tabelas a partir de 2027 | "projeção disponível até {ano}" |
| "Vale para qualquer feriado" | o default usa feriados nacionais | "feriados locais devem ser ajustados nos dias" |
| "Atualizado automaticamente" | as faixas são versionadas manualmente | "referência de {data}; revisão anual" |
| "Substitui o contador" | não é parecer | "estimativa para negociação" |

---

## 7. Ordem dos campos no formulário

```
1. Nome do perfil                         (texto)
2. Tipo de veículo                        (select → define diária default)
3. UF origem / UF destino                 (selects → interna ou interestadual)
4. Optante do Simples?                    (sim/não)
   └─ se sim: DAS efetivo (opcional)      (número % — vazio = faixa setorial)
   └─ se MEI: aviso de limite
5. Diária (R$/dia)                        (moeda — default do tipo)
6. Dias faturados no mês                  (inteiro — default 22, com botão "usar calendário")
7. [avançado] km/dia, fator regional      (números — colapsados)
```

**Por que essa ordem:** o tipo de veículo define a diária default; a UF define o tributo; o regime define o crédito. O usuário só vê número na tela quando já respondeu o que muda o número.

---

## 8. Microcopy dos resultados

| Cartão | Título | Subtítulo |
|---|---|---|
| 1 | **Faturamento bruto** | `{diária} × {dias} dias = {B}` |
| 2 | **Líquido do transportador** | `{B} − {T} de {regime} = {L}` |
| 3 | **Crédito do pagador** | `{c}% de {B} = {K}` |
| 4 | **Custo líquido** | `{B} − {K} = {C}` |
| 5 | **Diária implícita** | `{B} ÷ {dias} = {d}` |
| 6 | **Alerta de viabilidade** | `custo/dia estimado = {custo}; diária mínima para cobrir custo e tributo = {d_min}` |

Nunca mostrar o cartão 4 sem o 3: o usuário precisa ver que o custo líquido **não** é o bruto.

---

## 9. Instrumentação sugerida (para calibrar os defaults com dados reais)

| Evento | Para que serve |
|---|---|
| diária digitada por tipo de veículo | substituir a estimativa por mediana real da base |
| `n` efetivamente informado | calibrar 20/22/24 |
| taxa de bloqueio por "diária < 40% do base" | medir confusão diária × viagem |
| % de perfis MEI que estouram o limite | dimensionar o aviso |
| % de perfis Simples sem DAS | medir dependência da faixa setorial |

**Meta de calibração:** com 200 perfis reais por tipo de veículo, trocar a faixa derivada pela mediana observada — e manter a derivação como *fallback* documentado.
