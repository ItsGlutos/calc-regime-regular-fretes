# Validação fiscal do Frete Líquido

**Por:** Especialista Fiscal · **Data:** 24/11/2026, 20h30–21h00 (America/Sao_Paulo)
**Objeto:** app Frete Líquido (`app/`), simulador de frete do motor oficial (`docs/frete.md`) e o CT-e de exemplo.
**Método:** leitura do código, chamadas reais aos três serviços (`5180`, `8080`, `8082`) e conferência artigo por artigo na LC 214/2025 (texto compilado do Planalto, com as alterações da LC 227/2026), LC 87/1996, LC 123/2006, Lei 10.637/2002, Lei 10.666/2003 e Lei 8.212/1991.

> **Revisão 2 (24/11/2026, 21h) — o que foi corrigido.** O app em `5180` foi reiniciado com o crédito total. Dos oito achados abaixo, os quatro primeiros foram corrigidos e **verificados de forma independente** nesta revisão: `/api/simular` devolve `creditoTotal`/`custoTotal` e o cálculo bate com `ICMS + PIS/COFINS + CBS/IBS` em **todos os anos, com divergência de R$ 0,00** (prova em [03-exemplo-funcional.md](03-exemplo-funcional.md), seção 3); o comparador agora separa regular (8.450,00), híbrido (9.150,00) e Simples/DAS (9.761,49); e 2026 zera o CBS/IBS para todos os perfis. Os achados 5 a 8 (MEI, Simples sem PGDAS, data do split e citação do INSS) **permanecem**. As tabelas das seções 3.3 e 9.2 são o retrato da **revisão 1** e ficam como evidência histórica; os números atuais estão no doc 03.

---

## 1. Veredito em uma página

| # | Achado | Severidade |
|---|---|---|
| 1 | O crédito do pagador considera **só CBS/IBS**. ICMS e PIS/COFINS — que a pagadora credita hoje (16,25% no exemplo SP→BA) — não entram. Em 2025 e 2026 o "custo líquido" aparece igual ao preço cheio. | **Bloqueante** |
| 2 | Consequência: `/api/reforma` mostra custo líquido de R$ 1.000,00 em 2025 e R$ 990,00 em 2026 para um frete de R$ 1.000,00. O correto é R$ 837,50 nos dois anos. A curva "cai de 1.000 para 730" é falsa; a real é 837,50 → 845,00 (2027) → 833,50 (2029) → 730,00 (2033). | **Bloqueante** |
| 3 | O comparador empata **Simples híbrido** e **regime regular** (ambos 9.150,00 em 2027), quando o regular vale 8.450,00: o ICMS de 7% do transportador regular é creditado, o do optante do Simples fica no DAS. Erro de R$ 700,00/mês a cada R$ 10.000,00. | **Bloqueante** |
| 4 | Em 2026 o app no ar credita 1,00% de CBS/IBS — e a nova `creditosDoPagador` (no disco) devolve **2,39%** no Simples. Em 2026 não há crédito de CBS/IBS para o adquirente (o destaque é compensado pelo transportador — art. 348, I) e **não há CBS/IBS nas operações de optante do Simples** (art. 348, III, "c"). | Alta |
| 5 | Autônomo/MEI: o crédito é **presumido**, fixado por ato conjunto anual (art. 169, §§ 3º e 4º), não uma faixa de 1,8%–4% escolhida pelo app. | Alta |
| 6 | Split payment: a LC não fixa data; o app trata "a partir de 2027" como fato. É premissa, não lei. | Alta |
| 7 | Alíquotas de 2027–2033 (CBS 8,40%/8,50%, IBS 16,00%/2,50%) são **projeção**, não alíquota legal: a lei manda o Senado fixar a referência anualmente (arts. 18 e 349) e só fixa a *regra* de 2027–2028 (CBS = referência − 0,1 p.p., art. 347). | Média |
| 8 | Citação errada da retenção de INSS: o app cita art. 31 da Lei 8.212/1991 (cessão de mão de obra). A retenção do contribuinte individual é o art. 4º da Lei 10.666/2003. | Média |

**O que está correto e pode ser publicado:** cronograma 2026 (CBS 0,90% / IBS estadual 0,10% / municipal 0) e 2027–2028 (IBS 0,05% + 0,05%); redução de ICMS/ISS de 10/20/30/40% em 2029–2032 e extinção em 2033; 2034 igual a 2033; cClassTrib `000001` sem redução para NBS `105011220`; crédito integral do regime regular; crédito do adquirente do Simples igual ao destaque; ICMS interestadual 7%/12%; PIS/COFINS 1,65% + 7,60%; IRRF 1,5%; vale-pedágio fora da base; e todos os números de aceite (a aritmética está certa — o escopo é que está errado).

---

## 2. Cronograma e alíquotas

| Premissa do app | Veredito | Base legal | Impacto na decisão | Correção | Severidade |
|---|---|---|---|---|---|
| 2026: CBS 0,90%; IBS estadual 0,10%; IBS municipal 0,00% | **Confere** | LC 214/2025, art. 346 (CBS 0,9%) e art. 343 (IBS "alíquota estadual de 0,1%"); a ausência de parcela municipal decorre do art. 343 só citar a estadual | Nenhum: é a fase de teste | Nenhuma | — |
| 2027–2028: IBS estadual 0,05% + municipal 0,05% | **Confere** | LC 214/2025, art. 344 | Nenhum | Nenhuma | — |
| 2027–2028: CBS 8,40% | **Confere com ressalva** | LC 214/2025, art. 347: a alíquota de 2027–2028 é a de referência do art. 14 **reduzida em 0,1 ponto percentual**. 8,40% só fecha se a referência for 8,50% | Se a referência fixada pelo Senado for 8,8%, a CBS de 2027 é 8,7% e o custo muda em ~R$ 30/mês por R$ 10.000 | Rotular como premissa ("referência hipotética de 8,50%") e permitir sobrescrever — o `parametrosTransicao` já faz isso | Média |
| 2029–2032: CBS 8,50%; IBS 1,60/0,25 → 6,40/1,00 | **Confere com ressalva** | LC 214/2025, arts. 361 a 365: as alíquotas de referência de 2029–2033 são fixadas para que a receita equivalha a 10%, 20%, 30%, 40% e 100% da receita de referência — **o percentual é da receita, não da alíquota** | O número de 2033 (27,00%) é o que mais pesa em contrato; ele depende de resolução do Senado, não da LC | Idem: premissa explícita + botão de cenário | Média |
| Redução de ICMS 10/20/30/40% em 2029–2032 e extinção em 2033 | **Confere** | LC 214/2025, art. 501, que insere o art. 31-A na LC 87/1996 ("10% em 2029; 20% em 2030; 30% em 2031; 40% em 2032"); extinção em 2033 pelo art. 155, II, da CF com a redação da EC 132/2023 (ADCT, art. 125 e seguintes) | É a razão de o crédito de ICMS cair ano a ano — e o app não mostra isso | Ver item 3.1 | Alta |
| Redução do ISS na mesma proporção | **Confere com ressalva** | LC 214/2025, art. 508 (insere art. 8º-B na LC 116/2003) | Só afeta operação municipal, que é minoria no frete de carga | Nenhuma; documentar | Baixa |
| 2034 igual a 2033 | **Confere** | LC 214/2025, art. 366 ("em 2034 e 2035 serão aquelas fixadas para 2033") | Nenhum | Nenhuma | — |
| "Alíquotas de 2027 em diante estavam na carga original do banco e foram removidas pela V0053" (`docs/frete.md`, l. 113-118) | **Confere** | Fato verificável: `flyway/sql/criacao/B0001__sistema_tributario_completo.sql` traz exatamente 8,40/0,05/0,05 (2027-28), 8,50/1,60/0,25 (2029) … 8,50/16,00/2,50 (2033); a `V0053__ajustes_aliquotas.sql` apaga as vigências posteriores a 31/12/2026 na `ALIQUOTA_REFERENCIA` | Explica por que o motor não tem a alíquota de 2027+ — e por que o app precisa dizer que projeta | Manter a nota; ela é a defesa do produto | — |

**Leitura correta para o produto:** o app não erra o cronograma; ele **apresenta como alíquota legal o que é parâmetro de projeção**. A LC 214/2025 fixa apenas 2026 (0,9% + 0,1%), 2027–2028 (IBS 0,05% + 0,05% e CBS = referência − 0,1 p.p.) e as *regras* de 2029–2035. Todo o resto é resolução do Senado (arts. 18 e 349) e, na ausência dela, aplica-se a referência (art. 14, §3º). O produto deve dizer "premissa: referência de 8,50% / 18,50%" e não "alíquota de 2033".

---

## 3. Crédito do pagador — o núcleo do problema

### 3.1 A regra correta

O crédito do adquirente é o **conjunto dos tributos destacados no CT-e e extintos**, não apenas o CBS/IBS:

| Tributo destacado | O pagador credita? | Base legal | Até quando |
|---|---|---|---|
| ICMS (7% ou 12% interestadual; 18% interna) | **Sim**, se a pagadora for contribuinte e o serviço for relativo à sua atividade | LC 87/1996, art. 19 (não cumulatividade) e art. 20 ("direito de creditar-se do imposto anteriormente cobrado em … recebimento de serviços de transporte interestadual e intermunicipal"); §1º veda o crédito de serviço alheio à atividade | Até 2032 (cai 10%/ano a partir de 2029); zero em 2033 |
| PIS 1,65% + COFINS 7,60% (não cumulativo) | **Sim**, como insumo do serviço/produto | Lei 10.637/2002, art. 3º, II e Lei 10.833/2003, art. 3º, II; conceito de insumo por essencialidade/relevância — STJ, Tema 779 (REsp 1.221.170/PR) | Até 2026 (extintos em 2027) |
| PIS/COFINS no regime **cumulativo** (Lucro Presumido) | **Não** | Regime cumulativo (PIS 0,65% e COFINS 3%), sem direito a crédito — Lei 10.637/2002 e Lei 10.833/2003 | — |
| CBS/IBS | **Sim**, a partir de 2027, integral no regime regular | LC 214/2025, art. 47, caput e §2º, I (crédito = débitos destacados e extintos); §1º, II exige documento idôneo | 2027 em diante |
| CBS/IBS de **2026** | **Não** | LC 214/2025, art. 348, I: o valor recolhido é compensado pelo próprio contribuinte com PIS/COFINS; §1º dispensa o recolhimento. Não há crédito para o adquirente | — |
| CBS/IBS do **optante do Simples** | **Sim**, "em montante equivalente ao devido por meio desse regime" | LC 214/2025, art. 47, §9º, II e §3º | 2027 em diante |
| CBS/IBS do **TAC/MEI** | **Crédito presumido**, percentual fixado por ato conjunto até setembro de cada ano | LC 214/2025, art. 169, caput e §§ 3º e 4º | 2027 em diante |

Duas consequências que o app precisa absorver:

1. **O crédito não é o destaque do ano, é o destaque do ano somado ao que ainda existe do regime antigo.** Em 2026 isso é 16,25% (ICMS + PIS/COFINS); em 2027, 15,50% (ICMS + CBS/IBS); em 2029, 16,65%; em 2033, 27,00%.
2. **A "carga tributária" já é a soma de tudo** — e é exatamente por isso que o crédito, para quem credita tudo, é igual à carga. O app separa carga (tudo) de crédito (só CBS/IBS) e com isso cria a ilusão de que o pagador nunca recupera nada antes de 2027.

### 3.2 Premissa por premissa

| Premissa do app | Veredito | Base legal | Impacto na decisão | Correção proposta | Severidade |
|---|---|---|---|---|---|
| Regime regular: crédito = 100% do destaque de CBS/IBS (`domain.js:443`; `app/README.md` l. 79) | **Incorreto (por omissão)** — o crédito do destaque está certo, mas faltam ICMS e PIS/COFINS | LC 214/2025, art. 47, §2º, I; LC 87/1996, arts. 19-20; Leis 10.637/2002 e 10.833/2003, art. 3º, II | Em 2027 o custo real é 8.450,00 e não 9.150,00 por R$ 10.000; em 2026, 8.375,00 e não 9.900,00 | Somar `icms + pis + cofins` ao crédito no perfil regular, mantendo o CBS/IBS vindo do motor. O `creditosDoPagador` (`domain.js:301`) já faz isso — falta ligar na resposta | **Bloqueante** |
| "Custo líquido = frete − crédito CBS/IBS" (`app/README.md` l. 85; `server.js:1015`) | **Incorreto** | Idem | 2025/2026 aparecem como preço cheio; a série inventa um ganho de 27% que na prática é de 12,50 p.p. sobre a carga de hoje | `custo = bruto − (icms + pisCofins + cbsIbs)`; expor a decomposição | **Bloqueante** |
| Simples híbrido: crédito 100% do destaque CBS/IBS | **Confere com ressalva** | LC 214/2025, art. 41, §§ 3º e 4º + LC 123/2006, art. 13, §§ 9º a 11 (opção semestral, irretratável) | O híbrido **não empata** com o regular enquanto houver ICMS: o ICMS do optante fica no DAS e não é destacado | Corrigir o comparador: híbrido credita só CBS/IBS; regular credita ICMS + CBS/IBS | **Bloqueante** |
| Simples/DAS com PGDAS: crédito 100% do destaque do Simples | **Confere** | LC 214/2025, art. 47, §9º, II e §3º; exige destaque em documento idôneo (§1º, II) | É o que explica o 2,39% do exemplo | Manter; acrescentar que, sem destaque no CT-e, o crédito é zero | — |
| Simples/DAS sem PGDAS: faixa de 0,92% a 4,00% | **Falta base legal** — é estimativa interna, não regra | Não há dispositivo que autorize "faixa setorial". O crédito é o destacado (art. 47, §2º, I) | Pode induzir a troca de transportadora com número inventado | Ou o CT-e tem destaque (e o número é o dele), ou o crédito é zero. Trocar a faixa por "informe o destaque do CT-e" | Alta |
| Autônomo/MEI: 1,8% a 4,00% | **Incorreto** | LC 214/2025, art. 169: **crédito presumido** com percentual definido em ato conjunto do MF e do CGIBS até setembro de cada ano, aplicado sobre o valor líquido (`crédito = p × (P − crédito)` → `P × p/(1+p)`) e **só** para quem suporta a cobrança do frete (§1º, I), não quando o frete está embutido no preço do bem (§1º, II) | O número muda todo ano; a faixa atual mascara a espera pelo ato | Exibir "presumido a definir (art. 169)" e, quando o ato sair, o percentual oficial; aplicar o gross-up `p/(1+p)` | Alta |
| 2026: crédito de 1,00% de CBS/IBS somado ao crédito (`server.js:1012`; no Simples, `server.js:993`) | **Incorreto** | LC 214/2025, art. 348, I e §1º | Soma R$ 100 de crédito que não existe a cada R$ 10.000 | Zerar CBS/IBS no crédito de 2026; o crédito de 2026 é ICMS + PIS/COFINS | Alta |
| Simples em 2026: 1,00% (DAS/híbrido) no `/api/reforma` | **Incorreto** | LC 214/2025, art. 348, III, "c": as alíquotas de 0,9%/0,1% "não serão aplicadas em relação às operações dos contribuintes optantes pelo Simples Nacional" | O app mostra o Simples *melhor* em 2026 do que ele é | Zerar em 2026 | Alta |
| B2C: crédito zero | **Confere** | LC 214/2025, art. 57 (uso e consumo pessoal) e a lógica do art. 47 (crédito do contribuinte) | Nenhum | Manter | — |
| Crédito limitado ao destaque ("teto") | **Confere** | LC 214/2025, art. 47, §2º, I | Nenhum | Manter | — |

### 3.3 Prova numérica (R$ 10.000,00/mês, SP→BA, B2B, Lucro Real)

> **Retrato da revisão 1.** O app foi corrigido: hoje as colunas "crédito do app" e "custo do app" reproduzem a coluna "correto" em todos os anos. A tabela fica como evidência do defeito que existia.

Fonte: `POST http://127.0.0.1:8080/api/calculadora/frete/projecao` (percentuais) e `POST http://127.0.0.1:5180/api/simular` (resposta do app). Aplicação: `tributo = 10.000 × percentual do motor ÷ 100`.

| Ano | ICMS | PIS | COFINS | CBS | IBS | Crédito correto | % | Custo correto | Crédito do app | % | Custo do app | Erro |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 700,00 | 165,00 | 760,00 | 0,00 | 0,00 | 1.625,00 | 16,25% | 8.375,00 | 0,00 | 0,00% | 10.000,00 | 1.625,00 |
| 2026 | 700,00 | 165,00 | 760,00 | (90,00) | (10,00) | 1.625,00 | 16,25% | 8.375,00 | 100,00 | 1,00% | 9.900,00 | 1.525,00 |
| 2027 | 700,00 | 0,00 | 0,00 | 840,00 | 10,00 | 1.550,00 | 15,50% | 8.450,00 | 850,00 | 8,50% | 9.150,00 | 700,00 |
| 2029 | 630,00 | 0,00 | 0,00 | 850,00 | 185,00 | 1.665,00 | 16,65% | 8.335,00 | 1.035,00 | 10,35% | 8.965,00 | 630,00 |
| 2033 | 0,00 | 0,00 | 0,00 | 850,00 | 1.850,00 | 2.700,00 | 27,00% | 7.300,00 | 2.700,00 | 27,00% | 7.300,00 | 0,00 |

Parênteses em 2026 = destacado, mas **não** creditável (compensado pelo transportador, art. 348, I).

O erro do app cai a zero em 2033 porque em 2033 não há mais ICMS nem PIS/COFINS: aí o "só CBS/IBS" coincide com o total. **É por isso que o número de aceite de 2033 (R$ 730,00) está certo e os de 2025–2029 estão errados.**

### 3.4 Efeito no produto (a mensagem que muda)

| Leitura | App hoje | Correto |
|---|---|---|
| Custo líquido hoje | R$ 10.000,00 (crédito zero) | R$ 8.375,00 (16,25%) |
| Custo em 2027, preço congelado | R$ 9.150,00 (queda de 8,5%) | R$ 8.450,00 (**alta de 0,9%** vs 2025) |
| Custo em 2033, preço congelado | R$ 7.300,00 | R$ 7.300,00 |
| Ganho 2025→2033 | "27%" | **12,50% sobre o custo** (8.375 → 7.300) — o crédito sai de 16,25% e chega a 27,00%, e a carga vai a 27,00% |

A narrativa correta não é "o frete vai ficar 27% mais caro e você recupera só no fim". É: **"para quem credita tudo, a reforma é quase neutra no custo líquido; o que muda é o tamanho do crédito e o preço bruto. Quem perde é quem compra de optante do Simples, de MEI ou vende para consumidor final."** Esse é o recorte que justifica o produto.

---

## 4. Base de cálculo, retenções e premissas de valor

| Premissa | Veredito | Base legal | Impacto | Correção | Severidade |
|---|---|---|---|---|---|
| ICMS interestadual 7% (Sul/Sudeste→N/NE/CO) e 12% (demais) | **Confere** | Resolução do Senado Federal nº 22/1989; a tabela do motor (`GET /frete/parametros`) reproduz exatamente a matriz, e o CT-e confere SP→BA em 7,00% | Nenhum | Manter | — |
| ICMS interno padrão 18% | **Confere com ressalva** | Alíquotas estaduais variam (17% a 20%) e há FECP; 18% é o modo do ICMS em SP e o default do motor | Operação interna pode errar 1–3 p.p. | Deixar o campo editável (já é) e avisar que o interno varia — o aviso existe (`server.js:1121`) | Média |
| ISS 5% | **Confere com ressalva** | LC 116/2003, art. 8º: alíquota mínima 2%, máxima 5% | Operação municipal subestimada em municípios com 2%–4% | Idem: campo editável + aviso | Média |
| PIS 1,65% + COFINS 7,60% (não cumulativo) até 2026 | **Confere** | Lei 10.637/2002, art. 2º; Lei 10.833/2003, art. 2º | Nenhum | Manter; expor a opção cumulativo (0,65% + 3%) | Baixa |
| IRRF 1,5% sobre o valor do transporte | **Confere** | IN RFB nº 1.234/2012 (1,5% sobre o valor do transporte de cargas — é a norma que o próprio motor cita); base exclui o vale-pedágio, o que está correto | Nenhum | Manter | — |
| INSS 11% só no TAC | **Número confere, citação errada** | O app cita "Lei 8.212/1991, art. 31", que trata de **cessão de mão de obra**. A retenção da contribuição do segurado contribuinte individual é o **art. 4º da Lei 10.666/2003**, c/c art. 12, V, da Lei 8.212/1991 | Nenhum no valor; risco de a cláusula contratual citar dispositivo errado | Trocar a citação | Média |
| SEST/SENAT 2,5% só no TAC | **Confere com ressalva** | Lei 8.706/1993 (criação do SEST/SENAT); a contribuição de 2,5% é a regra consolidada — confirmar o ato vigente antes de publicar | Nenhum no valor | Documentar a fonte que o time confirmar | Média |
| Vale-pedágio fora da base do frete | **Confere** | Lei 10.209/2001 (antecipação pelo embarcador) e layout do CT-e: o vale-pedágio não integra o valor da prestação. No exemplo, 320,00 fora da base de 5.955,00 | Nenhum | Manter | — |
| Tributos "por dentro" do preço | **Confere** | LC 214/2025, art. 12: base = "valor integral cobrado pelo fornecedor a qualquer título" | É a base da fórmula de repasse | Manter e explicar | — |
| Feriados não considerados na contagem de dias úteis | **Falta** | Premissa de modelagem, não fiscal | Muda o valor mensal em até 2 dias (~10%) | Filtrar feriados por UF ou permitir informar os dias úteis | Baixa |
| ICMS 4% para importado e FECP | **Falta (assumido)** | Resolução do Senado nº 13/2012 (4%); FECP por estado | Rota com carga importada pode ter 3 p.p. a menos de ICMS — e menos crédito | Modelar como opção "carga importada" e "FECP %" | Média |
| Benefícios estaduais, regimes específicos, Imposto Seletivo | **Falta (assumido, e correto)** | IS não incide sobre transporte de cargas (LC 214/2025, art. 154 e ss. — NBS 105011220 não está no Anexo do IS; confirmado em `GET /dados-abertos/nbs`: `tributadoPeloImpostoSeletivo: false`) | Nenhum para frete de carga | Manter a nota | Baixa |
| Créditos de entrada do transportador (combustível, pedágio, manutenção) | **Falta** | Leis 10.637/2002 e 10.833/2003, art. 3º (o transportador credita insumos) | O repasse real depende disso: um transportador com muito crédito de entrada repassa menos | Modelar como "crédito de entrada do transportador (% do frete)" no cenário de repasse | Alta |

---

## 5. Split payment

| Premissa | Veredito | Base legal | Impacto | Correção | Severidade |
|---|---|---|---|---|---|
| "A partir de 2027 o split payment segrega o IBS/CBS no pagamento" (`docs/frete.md` l. 352-354; `CtePagamentoService` l. 500) | **Falta base para a data** | LC 214/2025, arts. 31 a 35. O art. 35, §§ 1º e 2º manda funcionar **simultaneamente para adquirentes que não são contribuintes** e prevê **implementação gradual por ato conjunto** do CGIBS e da RFB. **Não há data legal** | Se o split entrar em 2027 para B2B ou só depois, o caixa e a conciliação mudam de calendário — e o contrato também | Trocar "a partir de 2027" por "quando implementado (ato conjunto CGIBS/RFB; previsão 2027)" e manter a data como parâmetro | Alta |
| O split não muda o desembolso da pagadora | **Confere** | LC 214/2025, art. 31: o valor é segregado na liquidação; o débito do fornecedor é extinto e o crédito do adquirente permanece (art. 47, §2º, I) | Nenhum no total; muda o fluxo (parte vai ao CGIBS/RFB) | Manter e explicar no contrato | — |
| `liquidoTransportador` do pagamento de 2027 desconta o split | **Incorreto (inconsistente)** | — | O mesmo CT-e tem dois líquidos: 5.865,67 no topo da resposta e 5.359,49 no `comparativo[2027]` (medido) | Um único campo, com o split descontado, e um "desembolso" que some split + retenções + vale-pedágio | Média |
| `tomaCreditoIcms`/`tomaCreditoPisCofins` sem default | **Falta (usabilidade fiscal)** | — | Sem os dois campos, o mesmo CT-e de 2027 devolve crédito de 506,18 em vez de 923,03 (medido). O erro é silencioso | Default = regime da pagadora, ou 422 se o campo faltar | Média |

---

## 6. Números de aceite — recálculo

Todos foram recalculados a partir da resposta real do serviço indicado. **A aritmética confere em todos**; o que está errado é o conceito de crédito em três deles.

| Número publicado | Onde | Recálculo | Veredito |
|---|---|---|---|
| 16,25% | `app/README.md` l. 116; `docs/frete.md` l. 76 | (700,00 + 165,00 + 760,00) ÷ 10.000,00 = 16,25% (projeção 2025) | **Confere** |
| 15,50% | idem l. 118 e 78 | (770,00 + 924,00 + 5,50 + 5,50) ÷ 11.000,00 = 15,50%; ou 7,00 + 8,40 + 0,10 | **Confere** |
| 27,00% | idem l. 120 e 79 | (935,00 + 1.760,00 + 275,00) ÷ 11.000,00 = 27,00% | **Confere** |
| 2,39% | idem l. 117-120 | 238,51 ÷ 10.000,00 = 2,3851% (motor do Simples, PGDAS 2,3591% + 0,0260%) | **Confere** |
| R$ 976,15 | `app/README.md` l. 133 | 1.000,00 − 23,85 = 976,15 | **Confere** |
| R$ 915,00 | `app/README.md` l. 134 | 1.000,00 − 85,00 = 915,00 | **Confere na conta, incorreto no conceito**: o crédito correto em 2027 é 155,00 → 845,00 |
| R$ 730,00 | `app/README.md` l. 139 | 1.000,00 − 270,00 = 730,00 | **Confere e está fiscalmente correto** (2033 não tem ICMS/PIS/COFINS) |
| CT-e R$ 5.955,00, 17,25% (R$ 1.027,25), crédito R$ 967,69 | `docs/frete.md` l. 296-307 | 416,85 + 98,26 + 452,58 + 5,96 + 53,60 = 1.027,25; 1.027,25 ÷ 5.955,00 = 17,25%; 416,85 + 98,26 + 452,58 = 967,69 | **Confere** (o CT-e é o módulo mais bem resolvido do produto) |
| Retenções TAC R$ 893,26 e líquido R$ 5.061,74 | `docs/frete.md` l. 335 | 89,33 (IRRF) + 655,05 (INSS 11%) + 148,88 (SEST/SENAT 2,5%) = 893,26; 5.955,00 − 893,26 = 5.061,74 | **Confere** |

---

## 7. O que o app não modela — e muda a decisão do pagador

| Lacuna | Por que muda a decisão | Severidade |
|---|---|---|
| Créditos de entrada do transportador (combustível, pedágio, manutenção, bens) | Define o repasse real: o transportador com muito crédito repassa menos que a fórmula pura | Alta |
| FECP e benefícios estaduais (redução de base, crédito outorgado, isenção) | Podem derrubar o ICMS efetivo de 7% para menos, e o crédito junto | Média |
| ICMS 4% de importado (Res. Senado 13/2012) | Rota com carga importada perde 3 p.p. de crédito | Média |
| Crédito presumido do TAC/MEI (art. 169) | É a única regra de crédito para o autônomo — e o app usa uma faixa própria | Alta |
| Crédito de ICMS do optante do Simples em hipóteses específicas (LC 123/2006, art. 23, §§ 3º e 4º — estabelecimento industrial/comercial) | Pode existir crédito de ICMS mesmo com transportador do Simples, em hipóteses restritas | Média |
| Contribuição previdenciária do TAC sobre o frete com vale-pedágio na base? | A base da retenção e a do frete podem divergir | Baixa |
| Ganho/perda de caixa do crédito (apuração mensal/trimestral, ressarcimento em 60 dias no art. 348, II) | Crédito não é caixa: o custo líquido melhora, o desembolso não | Média |
| Regimes específicos de transporte (por exemplo, transporte de valores, mudança) | NBS e cClassTrib diferentes | Baixa |

---

## 8. Especificação da correção (para o lead)

**Regra de crédito a implementar** (a função `creditosDoPagador` em `app/domain.js:301` já é 80% disso):

```text
credito(ano, perfilTransportador, regimePagadora, tipoOperacao) =
  B2C ..................................................... 0
  B2B + regular ....... ICMS(ano) + PIS_COFINS(ano)×naoCumulativo + CBS_IBS(ano ≥ 2027)
  B2B + híbrido ....... CBS_IBS(ano ≥ 2027)
  B2B + Simples/DAS ... CBS_IBS destacado no CT-e (0 se não houver destaque; 0 em 2026)
  B2B + TAC/MEI ....... crédito presumido do art. 169 (percentual do ato conjunto; 0 enquanto não houver)
```

com `ICMS(ano) = 7% (ou 12%/18%) × (1 − redução do ano)` vindo da projeção, `PIS_COFINS(ano) = 9,25% se ano ≤ 2026 e não cumulativo`, `CBS_IBS(ano)` vindo do motor.

**Saída esperada por ano** (R$ 1.000,00, SP→BA, B2B, Lucro Real — para teste de aceite):

| Ano | Crédito | % | Custo líquido |
|---:|---:|---:|---:|
| 2025 | 162,50 | 16,25% | 837,50 |
| 2026 | 162,50 | 16,25% | 837,50 |
| 2027 | 155,00 | 15,50% | 845,00 |
| 2029 | 166,50 | 16,65% | 833,50 |
| 2033 | 270,00 | 27,00% | 730,00 |

**Três correções pontuais no código que está no disco:**
1. `app/domain.js:301` — o ramo do Simples aplica `taxaSimples` em 2026 (devolvi 2,39% no teste); deve ser 0 (art. 348, III, "c").
2. `app/domain.js:301` — o ramo `else` junta Simples/DAS e autônomo/MEI com a mesma nota ("parcela de CBS/IBS do DAS"); o MEI é crédito presumido (art. 169) e não tem DAS de CBS/IBS.
3. `server.js` — as premissas de `/api/simular` ainda dizem "o crédito é limitado ao CBS/IBS efetivamente destacado" (texto que contradiz a nova função) e `custoLiquido` continua saindo de `avaliarCredito` (só CBS/IBS).

**Nota operacional:** o processo em `5180` foi iniciado antes das alterações de 20h33–20h43 e não recarrega módulos. Qualquer validação do novo código exige reiniciar o app (`node app/server.js`), o que eu não fiz por instrução.

---

## 9. Anexo — respostas usadas como prova (revisão 1)

> Estas respostas são de **20h39**, antes da correção. Em 21h o app passou a devolver, nos mesmos endpoints: `/api/reforma` com crédito 162,50 / 162,50 / 155,00 / 166,50 / 270,00 (custo 837,50 / 837,50 / 845,00 / 833,50 / 730,00) e `/api/comparar` com 8.450,00 / 9.150,00 / 9.761,49. A prova da revisão 2 está em [exemplo-execucao.md](exemplo-execucao.md).

**9.1 `/api/reforma` (regime regular, R$ 1.000, 2027) — o defeito visível**

| ano | antigos | cbsIbs | carga | % carga | crédito | % crédito | custo líquido |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 162,50 | 0,00 | 162,50 | 16,25 | **0,00** | 0,00 | **1.000,00** |
| 2026 | 162,50 | 10,00 | 162,50 | 16,25 | 10,00 | 1,00 | 990,00 |
| 2027 | 70,00 | 85,00 | 155,00 | 15,50 | 85,00 | 8,50 | 915,00 |
| 2029 | 63,00 | 103,50 | 166,50 | 16,65 | 103,50 | 10,35 | 896,50 |
| 2033 | 0,00 | 270,00 | 270,00 | 27,00 | 270,00 | 27,00 | 730,00 |

**9.2 `/api/comparar` (2027, três transportadoras a R$ 10.000,00) — o empate falso**

| # | Transportadora | Crédito (app) | % | Custo (app) | Crédito correto | Custo correto |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Via Brasil (híbrido) | 850,00 | 8,50% | 9.150,00 | 850,00 | 9.150,00 |
| 2 | Serra Azul (regular) | 850,00 | 8,50% | 9.150,00 | 1.550,00 | **8.450,00** |
| 3 | Rota Sul (Simples/DAS) | 238,51 | 2,39% | 9.761,49 | 238,51 | 9.761,49 |

Resumo devolvido pelo app: *"No líquido, Via Brasil Transportes sai por R$ 9.150,00 — R$ 611,49 a menos que Rota Sul Logística."* O número correto é R$ 1.311,49.

**9.3 Motor do Simples (`/api/simular` com PGDAS 2,3591% + 0,0260%)** — destaque 238,51 (CBS 235,91 + IBS 2,60), crédito 238,51 (2,3851%), custo 9.761,49. Confere com a LC 214/2025, art. 47, §9º, II.

**9.4 CT-e de novembro de 2026 (`GET /cte/exemplo`)** — base 5.955,00; ICMS 416,85; PIS 98,26; COFINS 452,58; IBS UF 5,96; CBS 53,60; total 1.027,25 (17,25%); crédito 967,69; IRRF 89,33; líquido 5.865,67; desembolso 6.275,00; `creditoIbsCbs: 0` (correto em 2026).

**9.5 Comparativo interno do CT-e (`comparativo[2027]`)** — total 923,03; `creditoIbsCbs` 506,18; `custoNaoRecuperavel` 416,85; split 506,18. O campo `custoNaoRecuperavel` soma ICMS e PIS/COFINS como **custo**, embora o mesmo serviço calcule `creditoTotal` de 967,69 em 2026: é a mesma omissão do app, replicada no módulo do motor (`CtePagamentoService.java:496-498`).
