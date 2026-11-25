# Intuitividade para quem tem alta experiência tributária — revisão 2

**Por:** Especialista Fiscal · **Revisão 2:** 24/11/2026, 21h (versão original: 20h50)
**O que foi avaliado:** `app/public/index.html` (362 linhas), `app/public/app.js` (1.4xx linhas), os textos de `app/server.js`/`app/pagador.js` e as respostas de `/api/simular`, `/api/comparar`, `/api/reforma` e `/api/pagador` com o build reiniciado.

**O que mudou desde a revisão 1.** A contradição central — herói prometendo crédito total e cartão entregando só CBS/IBS — **foi resolvida**: o cartão agora diz "Custo líquido total" (`app.js:483`), usa `custoTotal` (`app.js:486`) e decompõe "CBS/IBS + ICMS/PIS/COFINS" (`app.js:489-490`). A seção "Hoje → amanhã" existe e é alimentada (`index.html:240-267`; `/api/pagador`). Três lacunas de vocabulário, porém, **continuam** e são as que este público nota primeiro: a premissa das alíquotas, a palavra "estimativa" e a ordem do formulário.

---

## 1. O que está resolvido (não mexer)

| Item | Prova |
|---|---|
| Custo líquido total, com a decomposição à vista | `app.js:483-490`: "Custo líquido total" + "de R$ 10.000,00 nominais · crédito de R$ 1.550,00 (CBS/IBS R$ 850,00 + ICMS/PIS/COFINS R$ 700,00)" |
| Métricas coerentes | `app.js:498-500`: "Crédito total", "CBS/IBS destacado", "ICMS + PIS/COFINS" |
| A nota do cartão aponta para onde está a decisão | `app.js:492-495`: "A trajetória até 2033 e o preço que você deveria pagar estão em Seu frete ao longo da reforma" |
| Horizonte com dois cenários | `index.html:247-254`: "Preço de hoje" × "Com repasse", com tooltip da premissa |
| Comparador honesto | `index.html:309-311` ("A ordem é pelo custo líquido — não pelo nominal") e o resumo do `/api/comparar` agora cita o crédito total |
| Memória auditável | `/api/simular` devolve `motor.requisicao`, `motor.resposta` e `memoria[]`; `/api/pagador` devolve `premissas[]` e `notas[]` |

---

## 2. O que continua errado para um tributarista

### 2.1 A alíquota de 2033 ainda é apresentada como se fosse lei

| Trecho | Arquivo:linha | O que diz |
|---|---|---|
| KPI do topo | `index.html:68-70` | "**Destaque no ano**: 27,00% — CBS 8,50 + IBS 18,50" |
| `<title>` | `index.html:6` | "custo **real** do frete pós-crédito de CBS/IBS" |

A LC 214/2025 **não fixa** 8,50%/18,50%: manda o Senado fixar a referência de cada ano (arts. 18 e 349) e só fixa a *regra* de 2027–2028 (CBS = referência − 0,1 p.p., art. 347). O rótulo continua sem "premissa" e sem a fonte. Um tributarista lê "27,00%" como alíquota vigente — e vai procurar a resolução do Senado que não existe. **Correção:** "Carga destacada em 2033 (premissa): 27,00% — referência de 8,50% + 18,50%; resolução do Senado pendente (arts. 18 e 349)". O `<title>` deve perder o "real" ou virar "custo do frete pós-crédito".

### 2.2 "Estimativa" ainda cobre três coisas diferentes — duas sem base legal

| Trecho | Arquivo:linha | O que diz |
|---|---|---|
| Badge/hint do Simples | `index.html:129, 168-172` | "estimativa" / "faixa setorial estimada" |
| Slider | `index.html:175-186` | "Crédito do regime … 0,92%–4,00%" |
| Rodapé | `index.html:354-356` | "para autônomo/MEI, valem as faixas setoriais estimadas" |

Medido nesta revisão: Simples/DAS **sem PGDAS** devolve **2,00%** (R$ 20,00 em R$ 1.000,00) e **MEI** devolve **1,80%** (R$ 18,00) — os dois sem destaque no CT-e. O crédito do adquirente depende de débito destacado e extinto (LC 214/2025, art. 47, §2º, I); para o MEI/TAC é **presumido**, com percentual fixado por ato conjunto (art. 169, §§ 3º e 4º). O texto do horizonte já cita o art. 169 (bom), mas o número continua alimentando preço-teto e economia. **Correção:** o slider vira campo "destaque do CT-e (%)"; o MEI mostra "a definir por ato (art. 169)" e **não calcula** economia enquanto o percentual não existir.

### 2.3 A ordem do formulário ainda inverte a causalidade

| Campo | Arquivo:linha | Ordem |
|---|---|---|
| Valor do frete | `index.html:96-112` | 1º |
| Regime do transportador / modalidade | `index.html:114-124` | 2º |
| CBS/IBS do PGDAS, atividade | `index.html:126-173` | 3º |
| Tipo de operação (B2B/B2C) | `index.html:188-192` | 4º |
| **Regime da pagadora** | `index.html:194-198` | **5º** |
| UFs e ano | `index.html:200-215` | 6º |

Quem apura começa pelo **adquirente** (é o regime dele que decide se há crédito de PIS/COFINS) e pela **destinação** (contribuinte, consumidor final, exportação, uso e consumo). "B2B/B2C" é um atalho que esconde três casos: exportação é imune (art. 8º), uso/consumo pessoal veda crédito (art. 57) e o frete embutido no preço do bem não gera o presumido do TAC (art. 169, §1º, II). **Correção:** "Quem paga e quem credita" como primeiro bloco; "destinação" no lugar de B2B/B2C.

### 2.4 O que ainda não aparece na tela

| O tributarista procura | Onde está hoje | O que falta |
|---|---|---|
| Base legal por linha do crédito | só no `docs/frete.md` e nas `premissas[]` da API | um "i" ao lado de ICMS / PIS-COFINS / CBS-IBS com o dispositivo (Res. SF 22/1989; Lei 10.637/2002, art. 3º, II; LC 214/2025, art. 47) |
| Carga × crédito × custo na mesma linha | a linha do tempo alterna a métrica (`index.html:281-289`) | uma tabela única por ano (o `/api/pagador` já devolve tudo: `carga`, `credito.*`, `liquido`, `repasse`) |
| Quem apura o quê | não há | uma frase: "o transportador apura e destaca; você credita — o crédito não é dinheiro de volta" |
| O que muda em 2026 | nota no cartão e `avisos[]` | um marco na linha do tempo: "2026: destaque compensado; sem crédito de CBS/IBS" |
| Efeito de ser Lucro Presumido | campo `regimePagadora` existe (`index.html:195`) | o efeito não é explicado: só o ICMS e o CBS/IBS são creditados, o PIS/COFINS não |

---

## 3. Vocabulário: o que já está bom e o que ainda sobra

**Bom (manter):** "custo líquido total", "carga tributária", "destaque", "desembolso", "preço de hoje × com repasse", "preço-teto", "o vencedor é o menor custo líquido pós-crédito".

**Sobra:**

| Termo | Onde | Problema | Troca |
|---|---|---|---|
| "**crédito material**" | `domain.js:515` (alerta) | jargão contábil | "Crédito relevante" |
| "**Cenário do aceite · PGDAS 2027**" | `index.html:332` | jargão interno de QA | "Exemplo do PGDAS 2027" |
| "**Destaque no ano** 27,00%" | `index.html:68` | "destaque" é valor, não alíquota | "Carga destacada (premissa)" |
| "**estimativa setorial**" | `index.html:183` | não existe "setor" na regra | "sem destaque: crédito zero" / "a definir por ato" |
| "**custo real**" | `index.html:6` (title) | promete o que depende de premissa | "custo do frete pós-crédito" |

---

## 4. Mudanças priorizadas (revisada)

| # | Prioridade | Mudança | Status |
|---|---|---|---|
| 1 | **P0** | Alinhar herói, KPI e cartão no mesmo recorte (crédito total) | **feito** (`app.js:483-500`) |
| 2 | **P0** | Rotular 27,00% / 8,50% / 18,50% como premissa de referência (arts. 349 e 361-365) | **aberto** (`index.html:68-70`, `:6`) |
| 3 | **P0** | Trocar as faixas 0,92%–4% e 1,8%–4% por "destaque do CT-e" e "a definir por ato (art. 169)" | **aberto** (`index.html:175-186`; texto do horizonte já cita o art. 169) |
| 4 | **P1** | Mover "regime da pagadora" para o primeiro bloco e trocar B2B/B2C por "destinação" | **aberto** (`index.html:188-198`) |
| 5 | **P1** | Tabela única `ano → carga → crédito (decomposto) → custo → Δ` na seção hoje→amanhã | **parcial** (`/api/pagador` já entrega os dados; a tela ainda alterna) |
| 6 | **P1** | Base legal por linha no cartão de resultado | **aberto** (só nas `premissas[]`) |
| 7 | **P1** | Explicar o efeito do Lucro Presumido (sem crédito de PIS/COFINS) | **aberto** (`index.html:195` tem o campo, não o efeito) |
| 8 | **P2** | Renomear "crédito material", "cenário do aceite", "destaque no ano", "estimativa setorial" | **aberto** |
| 9 | **P2** | Marco de 2026 na linha do tempo | **aberto** |
| 10 | **P2** | Selo de procedência com a premissa das alíquotas + versão da base | **aberto** (`index.html:36-40` mostra só "Motores da Receita") |

**Frase para o dono do produto:** o crédito agora está certo e a tela conta a mesma história que o número — o que falta é o público tributário aceitar o **pressuposto**: enquanto 27,00% aparecer sem "premissa" e as faixas de 0,92%–4% e 1,8%–4% aparecerem sem norma, o especialista vai tratar o resultado como estimativa de fornecedor, não como cálculo fiscal.
