# Especialista de Custos de Transportes

Agente de pesquisa que sustenta os defaults e as faixas de diária da funcionalidade
[Perfis de transportadores](../../docs/perfis.md). Ele **não escreve código**: pesquisa, valida e
especifica.

## Quando chamar

- antes de mudar default de dias, faixa de diária ou regra de validação do perfil;
- quando a ANTT reajustar a tabela de piso mínimo (referência atual: 16/07/2026);
- quando um marco da EC 141/2026 entrar em vigor (16/12/2026 e 16/12/2027);
- quando surgir dúvida sobre o que é "diária" (veículo, viagem do motorista, estadia, TDE) ou sobre o
  limite do MEI caminhoneiro;
- antes de prometer ao usuário um número que o app não consegue sustentar.

## Como chamar

1. Leia [`AGENT.md`](AGENT.md) — é o prompt completo e autossuficiente.
2. Abra um subagente com o nome `especialista-custos-transportes` e cole o conteúdo de `AGENT.md` como
   prompt, acrescentando no fim a pergunta da rodada.
3. O agente grava a resposta em `docs/especialista-custos-transportes/07-<tema>.md` e atualiza
   `01-fontes.md`/`referencias-diaria.json` se algum número mudar.
4. Ao integrar, rode `node scripts/verificar-perfis.mjs` e atualize `app/perfis.js` + `docs/perfis.md`
   se o default mudar.

## O que já foi produzido (rodada 1 — 26/11/2026)

| Arquivo | Conteúdo |
|---|---|
| [`01-fontes.md`](../../docs/especialista-custos-transportes/01-fontes.md) | 21 fontes (13 oficiais), com confiabilidade e o que cada uma sustenta |
| [`02-dias-e-jornada.md`](../../docs/especialista-custos-transportes/02-dias-e-jornada.md) | 19–23 dias úteis/mês, 22 dias faturáveis, EC 141/2026 |
| [`03-diarias-de-mercado.md`](../../docs/especialista-custos-transportes/03-diarias-de-mercado.md) | faixas por tipo de veículo, derivadas do piso ANTT |
| [`04-modelo-de-calculo.md`](../../docs/especialista-custos-transportes/04-modelo-de-calculo.md) | fórmulas de bruto, líquido, crédito e diária-teto |
| [`05-recomendacoes-produto.md`](../../docs/especialista-custos-transportes/05-recomendacoes-produto.md) | defaults, validações com mensagem pronta, textos de ajuda |
| [`06-validacao-cruzada.md`](../../docs/especialista-custos-transportes/06-validacao-cruzada.md) | divergências entre fontes e o que foi adotado |
| [`referencias-diaria.json`](../../docs/especialista-custos-transportes/referencias-diaria.json) | faixas legíveis por máquina, com fonte e data por número |

## Manutenção

- **A cada 6 meses** ou quando a ANTT reajustar a tabela: reler `AGENT.md` §4 e rodar a rodada.
- **Depois de 16/12/2026**: reavaliar o modo `UTEIS_SABADO` (dois DSR e teto de 42 h).
- **Depois de 16/12/2027**: teto de 40 h — a semana útil de 5 dias vira regra sem folga para sábado.
- Números alterados só entram no app com `scripts/verificar-perfis.mjs` verde e `docs/perfis.md`
  atualizado.
