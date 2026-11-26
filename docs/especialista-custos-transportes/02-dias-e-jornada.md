# 02 — Dias e jornada: quantos dias por mês assumir

**Pergunta do produto:** quantos dias um caminhão fatura por mês, para transformar "diária" em "faturamento mensal".

**Resposta curta:** **22 dias** é o default defensável para operação dedicada; **20** no cenário conservador (mês típico já com feriados e uma parada de manutenção) e **24** no otimista (autônomo/MEI ou escala com sábado). **Nunca 26** como default: a escala 6×1 deixou de ser constitucional em 16/12/2026.

---

## 1. As quatro contagens que não podem ser confundidas

| Contagem | O que é | Valor de referência (2026/2027) | Serve para |
|---|---|---:|---|
| **Dias corridos** | Todos os dias do mês | **30** (30,44 em média; 28/29/30/31 conforme o mês) | ratear custo fixo mensal, não faturar |
| **Dias úteis (seg–sex)** | Dias de semana menos feriados nacionais | **21** (21,08 em 2026; 21,25 em 2027) | piso de dias operáveis |
| **Dias úteis com sábado** | Seg–sáb menos feriados | **25** (25,42 em 2026; 25,33 em 2027) | teto teórico da escala 6×1 (pré-EC 141) |
| **Dias faturáveis** | Dias em que o veículo efetivamente gera receita | **20 / 22 / 24** (conservador / base / otimista) | **default do formulário** |

A diferença entre "dia útil" e "dia faturável" é o que separa uma planilha bonita de um orçamento que fecha: dia útil existe no calendário, dia faturável existe na operação.

---

## 2. Base normativa

### 2.1 O teto de jornada mudou em 2026 — e muda de novo em 2027

| Norma | Regra | Vigência |
|---|---|---|
| **EC nº 141/2026**, art. 1º (novo art. 7º, XIII, CF) | Duração normal **não superior a 8 h/dia e 40 h/semana** | Publicada em 16/10/2026 (DOU edição extra) |
| **EC nº 141/2026**, art. 6º, I | Teto de **42 h/semana** | **A partir de 16/12/2026** |
| **EC nº 141/2026**, art. 6º, II | Teto de **40 h/semana** | **A partir de 16/12/2027** |
| **EC nº 141/2026**, art. 1º (novo art. 7º, XV) | **2 dias de repouso semanal remunerado**, um preferencialmente aos domingos | **A partir de 16/12/2026** (art. 10, I) |
| **EC nº 141/2026**, art. 3º | Perdem efeito, em 2 meses, as cláusulas de CCT/ACT sobre duração e repouso **incompatíveis** | **A partir de 16/12/2026** |
| **EC nº 141/2026**, art. 2º e parágrafo único | Redução **sem redução salarial** nominal, proporcional ou de piso | Imediata |
| **CLT, art. 58** (Decreto-Lei 5.452/1943) | Duração normal e regra das **44 h semanais** | Regra histórica, **superada** pelo teto constitucional |
| **Lei nº 605/1949** | **1** dia de DSR por semana, sem prejuízo do salário | Antecedente do DSR duplo |
| **Lei nº 13.103/2015** (CLT arts. 235-C a 235-H) | Motorista: **8 h/dia**, + **2 h extras** (ou **4 h** por CCT/ACT); **11 h de descanso em 24 h** (fracionamento facultado, 8 h ininterruptas no 1º período); **12×36** por CCT (art. 235-F); **tempo de espera não é jornada** (art. 235-C, §§ 8º e 9º) | Vigente, compatibilizada com o novo teto semanal; dispositivos sobre tempo de espera e fracionamento questionados na ADI 5322 |

**Leitura para o produto:** até 15/12/2026 a semana legal de 44 h ainda permitia a escala 6×1 (8 h × 5 + 4 h no sábado). De 16/12/2026 a 15/12/2027, o teto cai para 42 h **e** entram dois DSR: a semana útil passa a ter, na prática, **5 dias**. De 16/12/2027 em diante, 40 h ÷ 8 h = **exatamente 5 dias** — sem folga para sábado.

> A EC 141 admite (art. 7º, § 2º) regime compensatório por CCT/ACT que assegure, **na média, 2 dias de repouso semanal dentro do mês-calendário**, com pelo menos 1 DSR a cada semana. Isso permite *distribuir* folgas — não eliminá-las. O teto prático continua sendo ~22 dias trabalhados por mês, e não 25.

### 2.2 O que a norma não resolve

- **Autônomo (TAC) e MEI não são empregados** e não estão sujeitos à jornada da CLT. Para eles o limite é comercial (carga disponível, manutenção, descanso do próprio motorista), não legal. É por isso que o cenário otimista de 24 dias faz sentido **para autônomo** e é frágil para frota empregadora.
- **Tempo de espera** (fila em embarcador/destinatário) não é jornada (regra questionada na ADI 5322), mas **consome o dia do veículo**. Um dia com 6 h de espera não é um dia inteiro de receita: é o caso típico em que a diária precisa virar **estadia** (ver `03-diarias-de-mercado.md`, §5).

---

## 3. Contagem efetiva de dias — cálculo próprio, a partir das leis

Método: para cada dia de 2026 e 2027, contar dias de semana (seg–sex) e descontar os **feriados nacionais fixos** da Lei 662/1949 (com a redação da Lei 10.607/2002: 1/1, 21/4, 1/5, 7/9, 2/11, 15/11, 25/12), da Lei 6.802/1980 (12/10) e da Lei 14.759/2023 (20/11). A coluna "efetivos" desconta também **Carnaval** e **Sexta-feira da Paixão**, que são ponto facultativo/feriado religioso e, na prática, param a operação em boa parte do país.

| Mês | Corridos | Úteis (feriados fixos) | Úteis efetivos (+ Carnaval e Paixão) | Úteis com sábado |
|---|---:|---:|---:|---:|
| 2026-01 | 31 | 21 | 21 | 26 |
| 2026-02 | 28 | 20 | 19 | 24 |
| 2026-03 | 31 | 22 | 22 | 26 |
| 2026-04 | 30 | 21 | 20 | 25 |
| 2026-05 | 31 | 20 | 20 | 25 |
| 2026-06 | 30 | 22 | 22 | 26 |
| 2026-07 | 31 | 23 | 23 | 27 |
| 2026-08 | 31 | 21 | 21 | 26 |
| 2026-09 | 30 | 21 | 21 | 25 |
| 2026-10 | 31 | 21 | 21 | 26 |
| 2026-11 | 30 | 19 | 19 | 23 |
| 2026-12 | 31 | 22 | 22 | 26 |
| **2026** | **365** | **253 (21,08/mês)** | **251 (20,92/mês)** | **305 (25,42/mês)** |
| 2027-01 | 31 | 20 | 20 | 25 |
| 2027-02 | 28 | 20 | 19 | 24 |
| 2027-03 | 31 | 23 | 22 | 27 |
| 2027-04 | 30 | 21 | 21 | 25 |
| 2027-05 | 31 | 21 | 21 | 25 |
| 2027-06 | 30 | 22 | 22 | 26 |
| 2027-07 | 31 | 22 | 22 | 27 |
| 2027-08 | 31 | 22 | 22 | 26 |
| 2027-09 | 30 | 21 | 21 | 25 |
| 2027-10 | 31 | 20 | 20 | 25 |
| 2027-11 | 30 | 20 | 20 | 23 |
| 2027-12 | 31 | 23 | 23 | 26 |
| **2027** | **365** | **255 (21,25/mês)** | **253 (21,08/mês)** | **304 (25,33/mês)** |

**O que a tabela mostra:**

1. **A média é 21, não 22.** A amplitude mensal vai de **19** (fev/2026, nov/2026) a **23** (jul/2026, mar/2027, dez/2027). Usar um número só sempre erra — a pergunta é quanto e para que lado.
2. **Fevereiro e novembro são os meses curtos** de faturamento, não por terem menos dias corridos, mas por concentrarem feriados. Novembro é o pior mês do ano: 19 dias úteis em 2026.
3. **A contagem com sábado (25) é o teto de 6×1** e está em extinção legal. Serve para auditoria de contratos antigos, não como default.

---

## 4. Os três cenários — com a conta à mostra

| Cenário | Dias | Conta | Quando usar |
|---|---:|---|---|
| **Conservador** | **20** | 22 (capacidade 5×2) − 0,75 (9 feriados ÷ 12) − **1,25** (manutenção/ociosidade) = 20,0 | orçamento anual, contrato novo, veículo com idade > 5 anos, operação com fila e retorno vazio |
| **Base** | **22** | 52 semanas ÷ 12 = **4,333** × 5 dias = **21,67 → 22** | default do formulário; operação dedicada, veículo próprio, cliente âncora |
| **Otimista** | **24** | **5,5** dias/semana × 4,333 = **23,83 → 24** | autônomo/MEI (sem limite de jornada CLT), operação urbana com sábado, contrato que paga dia parado |

### 4.1 Por que o conservador desconta 1,25 dia, e não 4

A tentação é descontar 4 dias "de manutenção". Na prática, manutenção preventiva de caminhão é feita em horário morto ou em fim de semana, e a parada corretiva relevante é de **1 a 2 dias por mês** para frota bem mantida; para veículo velho, mais. O número 1,25 é uma **premissa do especialista** (não medida em fonte pública) e está marcado como tal no JSON. Ela é calibrável: o produto pode expor um campo "paradas por mês".

A **ociosidade** (veículo sem carga) não é dia parado, é dia **sem receita**: quem cobra diária de contrato dedicado normalmente recebe o dia mesmo ocioso; quem cobra por viagem, não. Essa diferença é uma decisão de contrato, não de calendário — e precisa aparecer no texto de ajuda.

### 4.2 Por que 26 virou número proibido

- 26 = 6 dias × 4,333 semanas. Só é legal enquanto a semana útil tiver 6 dias.
- Com **2 DSR** (a partir de 16/12/2026), o máximo legal é **5 dias/semana** → 21,67 ≈ 22.
- Com **42 h** (16/12/2026) e **40 h** (16/12/2027) e jornada de 8 h, não há hora disponível para um sexto dia.
- Usar 26 no default inflaria o faturamento mensal em **18%** (26 ÷ 22) e faria o usuário acreditar numa receita que a lei não permite entregar com motorista empregado.

### 4.3 O efeito no custo (o lado que dói)

A NTC&Logística aponta que a redução de jornada **não reduz a demanda** — o contrato continua, a rota continua, o cliente continua (fonte 17 de `01-fontes.md`). O que muda é a **disponibilidade de horas por empregado**. Efeitos previsíveis:

| Efeito | Direção | Impacto no custo por dia |
|---|---|---|
| Divisor da hora cai de 220 para 210 e depois 200 | custo/hora ↑ | +4,8% em 16/12/2026; +10,0% em 16/12/2027, com salário nominal constante |
| 2 DSR por semana | dias disponíveis ↓ | ~17% menos dias por motorista; exige mais gente para a mesma operação |
| Hora extra para cobrir sábado | custo ↑ | +50% ou +100% sobre a hora normal, quando aplicável |

**Consequência para o produto:** a diária não é só preço de mercado; ela tem um **piso de custo que sobe em duas datas conhecidas** (16/12/2026 e 16/12/2027). O simulador deve avisar isso quando o usuário digitar uma diária que não cobre o custo estimado.

---

## 5. Mês típico: como lidar com 28/29/30/31 dias

O faturamento por diária **não** deve ser rateado por dia corrido. A regra do produto:

```
bruto do mês = diária × dias faturáveis do mês
```

e "dias faturáveis do mês" tem três origens possíveis, nesta ordem de preferência:

| Modo | Fórmula | Uso |
|---|---|---|
| **Informado** (preferido) | dias apontados pelo usuário (1 a 31) | quem tem controle de frota |
| **Calendário** | dias úteis do mês, descontados feriados locais | quem quer previsibilidade |
| **Default** | 22 (base) / 20 / 24 | orçamento e simulação |

Casos de borda que o formulário precisa aceitar sem quebrar:

- **Fevereiro de ano bissexto** (29 dias): não muda nada no faturamento por diária — o que muda é o custo fixo rateado, que cai ~3,4% por dia.
- **Mês com 23 dias úteis** (jul/2026, mar/2027, dez/2027): o default de 22 **subestima** 4,5%. O produto deve sugerir o valor do calendário quando o usuário escolher "mês real".
- **Dezembro**: 22 dias úteis em 2026, mas com parada coletiva e recesso em muitas operações. O calendário não captura isso; só o modo "informado" captura.
- **Mês de início de contrato**: faturar por diária proporcional (dias efetivos), nunca por "mês cheio".

---

## 6. Números que vão para o produto

| Chave | Valor | Natureza | Fonte |
|---|---:|---|---|
| `diasPorMes.corridos` | **30** | derivado (365 ÷ 12 = 30,44) | calendário |
| `diasPorMes.uteis` | **21** | calculado | Leis 662/1949, 6.802/1980, 14.759/2023 |
| `diasPorMes.uteisComSabado` | **25** | calculado | idem |
| `diasPorMes.faturaveisConservador` | **20** | estimativa calibrada | §4 |
| `diasPorMes.faturaveisBase` | **22** | derivado de 5×2 | EC 141/2026 |
| `diasPorMes.faturaveisOtimista` | **24** | derivado de 5,5×2 | EC 141/2026 + TAC/MEI |
| `diasPorMes.tetoLegalPosEC141` | **22** | derivado | EC 141/2026, arts. 1º e 6º |

**Uma frase para o texto de ajuda:** *"Um mês típico tem 21 dias úteis, mas o caminhão só fatura 20 a 22 deles. Usamos 22 como padrão porque é o teto de uma semana de 5 dias; se sua operação trabalha sábado ou tem muitas paradas, ajuste."*
