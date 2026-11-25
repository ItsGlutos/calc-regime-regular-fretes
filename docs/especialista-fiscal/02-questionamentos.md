# As perguntas que o pagador de frete faz

**Por:** Especialista Fiscal · 24/11/2026 · **Revisão 2 (21h):** as perguntas **P0-1, P0-2, P0-3, P0-5 e P0-8** foram resolvidas pelo build com crédito total (ver [03-exemplo-funcional.md](03-exemplo-funcional.md)); elas ficam registradas como especificação de teste e como histórico do que o app respondia em 20h39. As demais seguem abertas.
**Como ler:** cada pergunta está na voz de quem paga (controller, tesouraria, suprimentos, logística/fiscal). "Hoje" é o que o app em `5180` responde de fato (chamadas de 24/11/2026, 20h39–20h47); "falta" é o que ele não responde; "resposta fiscal" é a resposta curta e correta, com base legal. As prioridades são de produto: **P0** = sem isso a ferramenta induz a decisão errada; **P1** = decide bem, mas com trabalho manual; **P2** = conveniência.

**Vocabulário mínimo para ler as respostas** (o app usa estes termos):
*crédito* = valor do tributo destacado no CT-e que a pagadora abate na sua apuração (não é dinheiro de volta); *carga* = soma de todos os tributos embutidos no preço; *custo líquido* = preço − crédito; *desembolso* = o que sai do caixa, com ou sem crédito.

---

## P0 — sem estas, a ferramenta engana

### P0-1. "Hoje eu pago R$ 10.000 de frete. Quanto isso me custa de verdade e quanto vai custar em 2027, 2029 e 2033?"
- **Hoje:** mostra custo líquido de **R$ 10.000,00** em 2025 e **R$ 9.900,00** em 2026 (crédito de 1,00%), R$ 9.150,00 em 2027, R$ 8.965,00 em 2029 e R$ 7.300,00 em 2033.
- **Falta:** o crédito de ICMS e de PIS/COFINS. O custo de hoje é **R$ 8.375,00** (16,25% de crédito), o de 2027 é **R$ 8.450,00** (15,50%) e o de 2029 é **R$ 8.335,00** (16,65%). Só 2033 (R$ 7.300,00) está certo.
- **Resposta fiscal:** o crédito do pagador é a soma de tudo o que está destacado e é apropriável — ICMS (LC 87/1996, arts. 19 e 20), PIS/COFINS não cumulativo (Lei 10.637/2002, art. 3º, II) e CBS/IBS (LC 214/2025, art. 47). Em 2026 o CBS/IBS de 1,00% **não** entra: é compensado pelo transportador (art. 348, I).

### P0-2. "Meu crédito de hoje é 16,25%? E em 2027, quanto? Quando o ICMS sai, meu crédito cai?"
- **Hoje:** responde 0,00% em 2025, 1,00% em 2026, 8,50% em 2027, 10,35% em 2029, 27,00% em 2033.
- **Falta:** a série correta: **16,25% (2025-2026) → 15,50% (2027-2028) → 16,65% (2029) → 17,80% (2030) → 18,95% (2031) → 20,10% (2032) → 27,00% (2033)**.
- **Resposta fiscal:** **cai** em 2027 — o PIS/COFINS de 9,25% sai e a CBS entra em 8,40% + IBS 0,10% (8,50%), e o ICMS segue cheio: 7,00 + 8,50 = 15,50%. Depois **sobe** porque o IBS cresce mais do que o ICMS cai (10% ao ano de 2029 a 2032, art. 501 da LC 214/2025, que insere o art. 31-A da LC 87/1996). Em 2033 o crédito é 100% CBS/IBS: 27,00%.

### P0-3. "Duas transportadoras cobram o mesmo preço. Qual é a mais barata para mim?"
- **Hoje:** empata **Simples híbrido** e **regime regular** em R$ 9.150,00 (R$ 10.000,00, 2027) e diz que o híbrido vence o Simples/DAS por R$ 611,49.
- **Falta:** o ICMS do transportador regular. O regular custa **R$ 8.450,00**; o híbrido, **R$ 9.150,00**; o Simples/DAS, **R$ 9.761,49**.
- **Resposta fiscal:** o optante do Simples recolhe o ICMS **dentro do DAS** e não o destaca; logo, a pagadora não credita ICMS (LC 87/1996, art. 20 exige o imposto "cobrado" e destacado). O híbrido só muda o CBS/IBS (LC 214/2025, art. 41, §§ 3º e 4º). A diferença entre regular e híbrido é exatamente o ICMS: **R$ 700,00/mês** em 2027, R$ 630,00 em 2029, zero em 2033.

### P0-4. "Qual é o preço máximo que eu aceito de uma transportadora do Simples para ela valer a pena?"
- **Hoje:** não responde — não há preço-teto nem benchmark.
- **Falta:** o **preço de equilíbrio**: `P_max = custo do benchmark ÷ (1 − crédito% do outro regime)`. Em 2027, `8.450,00 ÷ (1 − 2,3851%) = **R$ 8.656,47**`; em 2033, `7.300,00 ÷ 0,976149 = **R$ 7.478,37**`. Para o híbrido: **R$ 9.234,97** em 2027 e **R$ 10.000,00** em 2033 (empata).
- **Resposta fiscal:** é pura álgebra de crédito, não de tributo: quem cobra mais que o teto entrega ao pagador um custo líquido maior, mesmo com preço nominal igual ou menor. Esse número é o que deve ir para a cláusula de reajuste e para a cotação.

### P0-5. "Vale a pena trocar de transportadora? Quanto eu economizo em R$?"
- **Hoje:** mostra a diferença entre regimes, mas com o crédito errado — logo, subestima a economia.
- **Falta:** a economia fechada. No exemplo de R$ 10.000,00/mês (SP→BA): trocar Simples/DAS por regular economiza **R$ 1.311,49/mês em 2027** (R$ 15.737,88/ano) e **R$ 2.461,49/mês em 2033** (R$ 29.537,88/ano); de 2026 a 2033, **R$ 157.265,16**. Trocar o híbrido pelo regular: R$ 700,00/mês em 2027, R$ 61.500,00 no acumulado.
- **Resposta fiscal:** a economia é 100% de crédito: o preço nominal não muda, muda o que a pagadora recupera. Não há ganho tributário "criado" — há transferência de crédito de ICMS que o optante do Simples não destaca.

### P0-6. "Meu fornecedor quer repassar o aumento do tributo no preço. Quanto é justo?"
- **Hoje:** não tem cenário de repasse.
- **Falta:** a fórmula e o número. `P_novo = P_hoje × (1 − t_hoje) ÷ (1 − t_novo)`, com `t` = carga efetiva. Para R$ 10.000,00: **R$ 9.911,24** em 2027 (a carga cai de 16,25% para 15,50%, então o preço até poderia cair 0,89%), **R$ 10.047,99** em 2029 e **R$ 11.472,60** em 2033. Com repasse integral e crédito integral, o custo líquido do pagador fica **parado em R$ 8.375,00**.
- **Resposta fiscal:** os tributos são cobrados "por dentro" (LC 214/2025, art. 12: a base inclui o próprio tributo). O que sobra para o transportador é `P × (1 − t)`; preservar a sobra é preservar `(1 − t)`. O repasse justo não é "27% em 2033", é a variação de `t`.

### P0-7. "O híbrido resolve o problema do Simples?"
- **Hoje:** trata híbrido e regular como iguais (mesmo custo líquido em todos os anos).
- **Falta:** dizer que o híbrido resolve **só o CBS/IBS**; o ICMS continua no DAS e sem crédito até 2032.
- **Resposta fiscal:** a opção híbrida (LC 214/2025, art. 41, §§ 3º e 4º; LC 123/2006, art. 13, §§ 9º a 11, semestral e irretratável) tira o CBS/IBS do DAS, mas não o ICMS. Converge com o regular só em 2033, quando o ICMS acaba.

### P0-8. "Em 2026 eu credito 1% ou 16,25%?"
- **Hoje:** mostra crédito de R$ 100,00 (1,00%) em R$ 10.000,00 e alerta que "o crédito de 1,00% é o destaque do ano".
- **Falta:** o crédito de ICMS + PIS/COFINS de 2026 (**16,25%**) e o aviso de que o 1% **não** é crédito do adquirente.
- **Resposta fiscal:** art. 348, I, da LC 214/2025 — o CBS/IBS recolhido em 2026 é compensado pelo **próprio contribuinte que o destacou** com PIS/COFINS (e, no §1º, até dispensado o recolhimento). O adquirente não tem crédito de CBS/IBS em 2026; tem ICMS e PIS/COFINS.

---

## P1 — decide bem, mas ainda no braço

### P1-9. "Quanto do meu desembolso vira crédito e quando esse crédito volta?"
- **Hoje:** só o custo líquido; não há desembolso nem prazo.
- **Falta:** uma linha de caixa: o crédito é abatido na apuração (mensal/trimestral), não devolvido no pagamento; e em 2026 o art. 348, II prevê ressarcimento em até 60 dias quando não há débito para compensar.
- **Resposta fiscal:** crédito ≠ caixa. O desembolso do CT-e não muda com o crédito; o que muda é o tributo a recolher no mês seguinte.

### P1-10. "O split payment muda meu caixa?"
- **Hoje:** mostra "split payment" a partir de 2027 e o valor segregado; o desembolso total não muda.
- **Falta:** separar **quem recebe**. No exemplo de R$ 5.955,00 em 2027: a pagadora paga R$ 506,18 ao CGIBS/RFB e R$ 5.359,49 ao transportador (mais R$ 89,33 de IRRF e R$ 320,00 de vale-pedágio). Total: os mesmos R$ 6.275,00.
- **Resposta fiscal:** arts. 31 a 35 da LC 214/2025. O split **não tem data legal**: o art. 35, §§ 1º e 2º manda começar pelos adquirentes não contribuintes e prevê implementação gradual por ato conjunto. "2027" é premissa, não lei.

### P1-11. "Quanto eu retenho de cada transportador?"
- **Hoje:** o app do pagador não mostra retenções; o módulo de CT-e do motor mostra TDE (só IRRF 1,5%) e TAC (IRRF + INSS 11% + SEST/SENAT 2,5% = 15%).
- **Falta:** trazer isso para o fluxo do pagador e corrigir a citação legal do INSS (art. 4º da Lei 10.666/2003, não art. 31 da Lei 8.212/1991, que é cessão de mão de obra).
- **Resposta fiscal:** no CT-e de R$ 5.955,00: TDE retém R$ 89,33 (líquido R$ 5.865,67); TAC retém R$ 893,26 (líquido R$ 5.061,74). A retenção **não** reduz o custo: é antecipação do tributo do transportador.

### P1-12. "Meu transportador é MEI/autônomo. Quanto de crédito eu tenho?"
- **Hoje:** faixa de 1,8% a 4,00% (padrão 1,8%) e um destaque cheio de CBS/IBS que não existe para esse perfil.
- **Falta:** o crédito **presumido** do art. 169 da LC 214/2025: percentual fixado por ato conjunto do Ministro da Fazenda e do CGIBS até setembro de cada ano, aplicado sobre o valor líquido (`crédito = P × p/(1+p)`), e **só** para quem suporta a cobrança do frete (§1º, I).
- **Resposta fiscal:** enquanto o ato não sair, o número é **desconhecido** — o app deve dizer isso, não estimar.

### P1-13. "E se eu for Lucro Presumido (PIS/COFINS cumulativo)?"
- **Hoje:** não pergunta o regime da pagadora; assume não cumulativo.
- **Falta:** um campo "regime da pagadora" e o efeito: o Lucro Presumido não credita PIS/COFINS sobre o frete.
- **Resposta fiscal:** crédito de 2025 cai de 16,25% para **7,00%** (só ICMS); em 2027 volta a 15,50% (ICMS + CBS/IBS, que independem do regime da pagadora); em 2033, 27,00%.

### P1-14. "E se o frete for interno (SP→SP)?"
- **Hoje:** permite operação interna, mas com ICMS de 18% padrão e sem FECP.
- **Falta:** aviso de que a alíquota interna varia por UF e que o FECP não está incluído.
- **Resposta fiscal:** crédito de 2025 em operação interna = 18% + 9,25% = **27,25%**; em 2027, 18% + 8,50% = **26,50%**. Um ponto percentual de ICMS interno muda R$ 100/mês a cada R$ 10.000.

### P1-15. "O CT-e que a transportadora me mandou está certo?"
- **Hoje:** o módulo de CT-e do motor calcula um documento de exemplo e mostra 10 conferências; o app do pagador não importa o documento da empresa.
- **Falta:** importar o XML do CT-e real e conferir destaque, base, vale-pedágio, ICMS interestadual e retenções.
- **Resposta fiscal:** o crédito depende de documento idôneo com o destaque (LC 214/2025, art. 47, §1º, II). Sem essa conferência, o crédito é uma expectativa.

### P1-16. "Qual o efeito do Simples no meu preço se o PGDAS do transportador mudar?"
- **Hoje:** aceita as alíquotas efetivas do PGDAS e calcula o destaque; a linha do tempo mantém 2,3851% de 2027 a 2033.
- **Falta:** sensibilidade — o que acontece se o PGDAS subir de faixa (o Anexo III tem 6 faixas) e o que acontece com o crédito.
- **Resposta fiscal:** o crédito do adquirente acompanha o destaque do DAS (art. 47, §9º, II). Faixa maior no PGDAS = mais crédito para o pagador, mas preço maior: a comparação tem de ser sempre no líquido.

---

## P2 — conveniência e bordas

### P2-17. "E o ICMS de 4% de carga importada?"
- **Hoje:** não modela (assumido em `docs/frete.md`, seção 4).
- **Falta:** opção "carga importada" com ICMS de 4% (Resolução do Senado nº 13/2012).
- **Resposta fiscal:** o crédito cai 3 p.p. em relação a 7% — R$ 300/mês a cada R$ 10.000 — e o custo sobe na mesma medida.

### P2-18. "Benefício estadual, crédito outorgado, isenção: entra?"
- **Hoje:** não; o app usa a alíquota cheia.
- **Falta:** um campo de "ICMS efetivo" para o usuário informar o benefício.
- **Resposta fiscal:** benefício reduz o destaque e, portanto, o crédito; o app deve permitir editar a alíquota (o motor já aceita `aliquotaIcms`).

### P2-19. "E a exportação?" 
- **Hoje:** não modela.
- **Falta:** a imunidade do art. 8º da LC 214/2025 e o creditamento nas operações anteriores.
- **Resposta fiscal:** frete vinculado a exportação é imune; a cadeia anterior mantém o crédito. Para o pagador exportador, o crédito do frete é relevante e o app hoje o trata como operação comum.

### P2-20. "Como eu provo esse número para a auditoria/contrato?"
- **Hoje:** a memória de cálculo do motor fica disponível na resposta de `/api/simular` (`motor.resposta`, `memoria[]`) — ponto forte.
- **Falta:** um anexo contratual com a fórmula, a data-base e a fonte de cada alíquota (o `GET /frete/produto/anexo` existe, mas cita o art. 31 da Lei 8.212/1991 para o INSS).
- **Resposta fiscal:** o contrato deve fixar a **fórmula** (`custo = P − crédito`) e a **fonte da alíquota** (resolução do Senado, ato do CGIBS), não o número — porque o número muda todo ano.

---

## O que o produto precisa responder primeiro

1. **P0-1, P0-2, P0-3, P0-8** são a mesma correção: somar ICMS e PIS/COFINS ao crédito e zerar o CBS/IBS de 2026. Sem ela, todo o resto (economia, benchmark, teto) sai errado.
2. **P0-4, P0-5, P0-6** são a camada de decisão: preço-teto, economia e repasse. É o que transforma o simulador em ferramenta de contas a pagar.
3. **P0-7 e P1-12** são os dois perfis em que o número é estruturalmente diferente (híbrido e MEI/TAC): um tem crédito parcial, o outro tem crédito presumido por ato.
