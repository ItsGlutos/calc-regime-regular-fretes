# Frete Líquido

Simulador local do **pagador do frete**: descobre o custo líquido real depois de todo o crédito (CBS/IBS,
ICMS e PIS/COFINS), compara transportadoras de regimes tributários diferentes e mostra **o antes e o depois
da reforma tributária, ano a ano (2025–2033)** — incluindo o desembolso com repasse, o preço que você
deveria pagar e o que fazer em cada ano.

O CBS/IBS **não é calculado neste projeto**. Cada simulação chama um dos dois motores oficiais da Receita,
ambos com licença MIT e execução local, e a resposta bruta fica disponível na interface para auditoria:

| Perfil | Motor | Porta |
|---|---|---|
| Regime regular e Simples híbrido | [`calculadora-rtc-regime-regular`](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | `8080` |
| Simples/DAS com alíquotas do PGDAS | [`calculadora-rtc-simples-nacional`](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | `8082` |

![Frete Líquido no desktop](docs/web-desktop.png)

![Antes e depois da reforma](docs/web-reforma.png)

![Hoje e amanhã: o horizonte do pagador](docs/web-horizonte.png)

![Perfis de transportadores: diária, calendário e custo líquido](docs/web-perfis.png)

## Como rodar

Na raiz do repositório, compile os dois motores uma vez:

```powershell
.\mvnw.cmd -DskipTests package
.\mvnw.cmd -f simples-nacional\pom.xml -DskipTests package
```

Depois:

```powershell
.\run.ps1
```

O script sobe os dois motores (se ainda não estiverem no ar) e a aplicação em `http://127.0.0.1:5180`.
Se a política de execução bloquear:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

Alternativa manual, com os motores já rodando:

```powershell
java -Dspring.profiles.active=offline -jar target\api-regime-geral.jar                    # terminal 1
java -Dspring.profiles.active=offline -jar simples-nacional\target\api-simples-nacional.jar # terminal 2
cd app; node server.js                                                                    # terminal 3
```

Requisitos: Node 20+ (testado no 24) e os dois JARs compilados. Os motores leem o mesmo SQLite em
`calculadora/db/calculadora-pro.db`.

## A modalidade Simples Nacional

O formulário começa pelo **regime tributário** — uma modalidade, não um detalhe do perfil:

- **Simples Nacional**: o optante recolhe o CBS/IBS **dentro do DAS** (com as alíquotas efetivas do
  PGDAS) ou escolhe o **híbrido** (CBS/IBS no regime regular, fora do DAS);
- **Regime regular**: Lucro Real/Presumido com crédito integral ou autônomo/MEI com faixa estimada.

O painel do Simples mostra as alíquotas efetivas de CBS e IBS, a **alíquota efetiva total** (soma das
duas) e a atividade no Simples (Anexo III). Com as duas preenchidas e ano a partir de 2027, o crédito é
o destaque apurado pelo motor do Simples (`CT-e tpDoc 57`, `CRT 1`, atividade `05`). Em branco, vale a
faixa setorial de 0,92% a 4% do frete, sinalizada como estimativa.

## Como o cálculo funciona

1. A aplicação monta um item de CT-e (NBS `105011220`, cClassTrib `000001`) com o valor do frete.
2. Pelo perfil, escolhe o motor:
   - **regime regular e Simples híbrido**: item com CST `000` e
     `POST /api/calculadora/regime-geral` na `8080`;
   - **Simples/DAS com PGDAS**: CT-e `tpDoc 57`, `CRT 1`, atividade `05` (Anexo III) e a linha de
     alíquotas efetivas do PGDAS em `POST /api/calculadora/observabilidade/simples-nacional/nao-assistido`
     na `8082`.
3. O motor devolve o CBS/IBS destacado (`vCBS` + `vIBS`) e a memória de cálculo oficial.
4. A aplicação soma ao crédito os **tributos do regime anterior que o pagador ainda credita no ano** — ICMS e
   PIS/COFINS, quando o transportador é do regime regular e os destaca no CT-e. O destaque do CBS/IBS é um
   teto: nenhum regime transfere mais crédito do que o tributo efetivamente destacado.

| Perfil | ICMS | PIS/COFINS | CBS/IBS | Natureza |
|---|---|---|---|---|
| Regime regular | creditável | creditável se a pagadora é não cumulativa (até 2026) | a partir de 2027 | apurado |
| Simples híbrido | no DAS | no DAS | a partir de 2027 | apurado |
| Simples/DAS com PGDAS | no DAS | no DAS | destaque apurado pelo motor do Simples | apurado |
| Simples/DAS sem PGDAS | no DAS | no DAS | 0,92% a 4,0% do frete (padrão 2,0%) | estimativa setorial |
| Autônomo / MEI | no DAS | no DAS | 1,8% a 4,0% do frete (padrão 1,8%) | estimativa setorial |

5. `crédito total = CBS/IBS creditável + ICMS + PIS/COFINS` e `custo líquido = valor do frete − crédito total`.
6. Em 2026 não há crédito de CBS/IBS para o adquirente: o destaque de 1,00% é compensado pelo próprio
   transportador (LC 214/2025, art. 348, I) e não se aplica ao optante do Simples (art. 348, III, "c"). O
   crédito do ano é ICMS + PIS/COFINS.
7. Em B2C o pagador é o consumidor final: o crédito é zero e o custo é o preço cheio.

O ano de referência padrão é **2033 (regime pleno, CBS 8,50% + IBS 18,50%)**. O motor do Simples só tem
tabelas a partir de **2027**; em 2026, o Simples/DAS não tem crédito de CBS/IBS (art. 348, III, "c") e o
crédito do regime regular é ICMS + PIS/COFINS. O Simples híbrido e o regime regular funcionam em todos os anos
do cronograma.

## Hoje → amanhã (o horizonte do pagador)

A seção **Seu frete ao longo da reforma** responde a pergunta central de quem paga: hoje o frete custa X
bruto e Y líquido; quanto sobra em cada ano se o preço não mudar; e quanto o preço precisa mudar para o
líquido ficar no nível de hoje. Ela é servida por `POST /api/pagador` e trabalha com **três leituras**:

- **Preço travado** — o contrato não muda; o crédito e o custo líquido variam com a alíquota;
- **Preço de equilíbrio** — o preço que mantém o **seu** custo líquido de hoje:
  `preço = líquido_de_hoje ÷ (1 − crédito_do_ano)`;
- **Piso do transportador** — o preço que preserva a **receita líquida do transportador**:
  `preço_novo = preço_hoje × (1 − carga_hoje) ÷ (1 − carga_ano)`. É publicado para regime regular e
  híbrido; no Simples/MEI o app não conhece o DAS total nem o custo não creditável, então não inventa um
  piso.

O app também mostra, lado a lado, o **preço travado** e o **preço de equilíbrio** ano a ano, com o
respectivo líquido, e sinaliza quando o piso do transportador fica acima do equilíbrio do pagador (conflito)
ou abaixo (espaço de negociação). No Simples/DAS, o piso é estimado a partir do **DAS total** e da
**parcela de insumos** informados na modalidade; sem esses dados, o app publica só o equilíbrio do pagador
e avisa que o piso não foi calculado.

Para R$ 10.000,00/mês, SP → BA, Lucro Real:

| Ano | Preço travado | Líquido com preço travado | Preço de equilíbrio | Líquido mantido |
|---|---|---|---|---|
| 2026 (hoje) | R$ 10.000,00 | R$ 8.375,00 | R$ 10.000,00 | R$ 8.375,00 |
| 2027 | R$ 10.000,00 | R$ 8.450,00 | R$ 9.911,24 | R$ 8.375,00 |
| 2029 | R$ 10.000,00 | R$ 8.335,00 | R$ 10.047,99 | R$ 8.375,00 |
| 2033 | R$ 10.000,00 | R$ 7.300,00 | R$ 11.472,60 | R$ 8.375,00 |

A leitura que muda a decisão: **com crédito integral, o repasse da carga não altera o custo líquido — altera
o caixa**. O desembolso sobe 14,73% até 2033, mas o líquido fica em R$ 8.375,00. Quem compra de optante do
Simples não tem essa neutralidade: o crédito do DAS não acompanha os 27,00% e o preço de equilíbrio do
pagador pode ficar abaixo do piso do transportador.

## Perfis de transportadores (diária → mês)

A seção **Perfis de transportadores** cadastra o transportador pelo que o pagador sabe dele antes de
contratar: nome, tipo de veículo, rota, regime e **diária** (R$ por dia de veículo). O app transforma a
diária em faturamento e custo líquido **mês a mês**, porque o mês não tem sempre os mesmos dias: são 28 a
31 dias corridos e **19 a 23 dias úteis**, já descontados os feriados nacionais.

![Perfis de transportadores](docs/web-perfis.png)

- **calendário**: dias úteis (seg–sex, sem feriados), dias úteis efetivos (sem Carnaval e Paixão),
  seg–sáb, dias corridos ou um número fixo por mês;
- **tipo de veículo** opcional: preenche a diária base e mostra a faixa de referência derivada do piso
  mínimo da ANTT (3/4 R$ 550–900, toco R$ 860–1.350, truck R$ 1.440–2.200, carreta R$ 2.820–4.300,
  bitrem R$ 3.820–5.850);
- **mês a mês**: bruto, crédito e custo líquido dos 12 meses, com o total do ano;
- **ano a ano (2026–2033)**: o mesmo preço por diária contra o calendário e a carga de cada ano;
- **diária-teto**: a diária que empata o custo líquido com um transportador do regime regular
  (`custo líquido do regular ÷ (1 − crédito %) ÷ dias`), com a diferença mensal e anual;
- **ranking por tipo de veículo**: duas carretas no mesmo trecho, uma no regular e uma no Simples, mostram
  por que o desconto nominal pode custar mais caro depois do crédito;
- **usar na simulação**: leva a diária, o mês, a rota e o regime para o formulário principal.

Para a carreta de R$ 3.500,00/dia, SP → BA, regime regular, em novembro de 2026 (19 dias úteis):

| | Valor |
|---|---:|
| Faturamento bruto do mês | R$ 66.500,00 |
| Crédito (ICMS + PIS/COFINS, 16,25%) | R$ 10.806,25 |
| Custo líquido do mês | R$ 55.693,75 |
| Custo líquido do ano (253 dias úteis) | R$ 741.606,25 |

No mesmo trecho, a carreta do Simples cobra R$ 3.300,00/dia (5,7% menos) mas, em 2026, não gera crédito
de CBS/IBS (LC 214/2025, art. 348, III, "c"): o custo líquido anual fica em R$ 834.900,00 — **R$ 93.293,75
mais caro** que a carreta do regime regular.

API: `GET/POST /api/perfis`, `GET/PUT/DELETE /api/perfis/:id`, `POST /api/perfis/calcular`,
`POST /api/perfis/comparar` e `POST /api/perfis/exemplos`. Modelo, fórmulas e limites em
[docs/perfis.md](../docs/perfis.md); a pesquisa que sustenta as faixas está em
[docs/especialista-custos-transportes/](../docs/especialista-custos-transportes/).

## Antes e depois da reforma (2025–2033)

Abaixo do resultado há uma linha do tempo com **o mesmo frete nominal em todos os anos** (valor diário,
para isolar o efeito das alíquotas). Ela tem três leituras, alternáveis:

| Leitura | O que mostra |
|---|---|
| **Custo líquido** | preço − crédito total (CBS/IBS + ICMS + PIS/COFINS) do regime escolhido, ano a ano |
| **Crédito CBS/IBS** | quanto volta como crédito (e o benchmark do regime regular) |
| **Carga tributária** | os tributos destacados no documento: antigos (ICMS/PIS/COFINS) + CBS/IBS |

A **carga** de cada ano vem da projeção oficial do frete do motor do regime regular
(`POST /api/calculadora/frete/projecao`), que apura o CBS/IBS pela mesma calculadora e compõe ICMS,
PIS/COFINS e ISS com o cronograma da LC 214/2025. O app não calcula CBS/IBS nem recria a tabela de
transição: quando o motor não expõe a projeção, a linha do tempo cai no CBS/IBS apurado ano a ano e
avisa que os tributos antigos não estão decompostos.

O recorte é explícito: **carga** inclui todos os tributos do documento; **crédito e custo líquido** somam
CBS/IBS + ICMS + PIS/COFINS (quando destacados). Em B2C o crédito é zero.

Para o frete de R$ 1.000,00, SP → BA, a leitura é:

| Ano | Regime regular · carga | Regime regular · crédito total | Regime regular · custo líquido | Simples/DAS 2027 · crédito total |
|---|---|---|---|---|
| 2025 (antes) | R$ 162,50 (16,25%) | R$ 162,50 (16,25%) | R$ 837,50 | R$ 0,00 |
| 2026 (teste) | R$ 162,50 (16,25%) | R$ 162,50 (16,25%) | R$ 837,50 | R$ 0,00 |
| 2027 | R$ 155,00 (15,50%) | R$ 155,00 (15,50%) | **R$ 845,00** | R$ 23,85 (2,39%) |
| 2029 | R$ 166,50 (16,65%) | R$ 166,50 (16,65%) | R$ 833,50 | R$ 23,85 (2,39%) |
| 2033 | R$ 270,00 (27,00%) | R$ 270,00 (27,00%) | R$ 730,00 | R$ 23,85 (2,39%) |

O primeiro ano com **custo acima de hoje** é **2027** (R$ 837,50 → R$ 845,00): o PIS/COFINS de 9,25% sai e a
CBS entra em 8,40%, então o crédito cai 0,75 p.p. antes de voltar a subir. O primeiro ano com **carga** acima
de 2025 é 2029. No Simples/DAS o crédito transferível é o CBS/IBS do DAS (2,39% no exemplo), não os 27,00% do
regime regular.

## Aceite

Frete de R$ 1.000,00, SP → BA, em **2027**, com as alíquotas efetivas do PGDAS do exemplo (CBS 2,3591% +
IBS 0,0260%):

| Transportadora | Regime | Crédito total | Custo líquido |
|---|---|---|---|
| Serra Azul Logística | Regime regular | R$ 155,00 (15,50%) | **R$ 845,00** |
| Via Brasil Transportes | Simples híbrido · regime regular | R$ 85,00 (8,50%) | **R$ 915,00** |
| Rota Sul Logística | Simples/DAS · PGDAS | R$ 23,85 (2,39%) | **R$ 976,15** |

O comparador ordena por custo líquido total: o regime regular vence no mesmo preço nominal; o híbrido empata
só em 2033, quando o ICMS deixa de existir; e o Simples/DAS dispara o alerta de crédito abaixo de 4%.

Na linha do tempo, o mesmo frete no **regime regular** em 2033 dá R$ 270,00 de CBS/IBS destacado e crédito,
com custo líquido de **R$ 730,00**; a carga no regime pleno é 27,00%, contra 0,00% de CBS/IBS destacado no
Simples em 2025 e 2,39% em 2027.

## API

- `GET /api/opcoes` — regimes, perfis, faixas, regimes da pagadora, UFs, anos, série da reforma, atividades
  do Simples e status dos dois motores.
- `POST /api/simular` — `{ valorFrete, perfil, regimePagadora?, tipoOperacao, ufOrigem, ufDestino, ano,
  taxaCredito?, aliquotaCbs?, aliquotaIbs?, atividade?, dasTotal?, insumos? }`. `regimePagadora`
  (`NAO_CUMULATIVO` padrão ou `CUMULATIVO`) define o crédito de PIS/COFINS; `dasTotal` e `insumos` são
  opcionais e só alimentam o piso do Simples no horizonte.
- `POST /api/reforma` — a mesma entrada de `/api/simular`, devolvendo `anos[]` (2025–2033) com
  `antigos`, `cbsIbs`, `carga`, `credito` (total), `creditoCbsIbs`, `creditoAntigos`, `custoLiquido`,
  `percentualCarga`, `percentualCredito`, `disponivel` e `fonte`; mais `resumo`, `benchmark`, `notas`,
  `premissas`, `avisos` e `fonte`.
- `POST /api/pagador` — o horizonte do pagador: `hoje`, `anos[]` com `bruto`, `credito` (decomposto),
  `liquido`, `equilibrio` (preço/líquido que mantém o custo de hoje), `piso` (preço que preserva a receita
  do transportador, quando calculável), `conflito`, `repasse`, `benchmark` e `equivalente` (preço-teto),
  `resumo`, `deveria` e `ajustes`. Para Simples/DAS, `piso` é estimado por
  `preço = base × (1 − DAS + insumos × (fator − 1)) ÷ (1 − DAS)`, com `dasTotal` e `insumos` informados.
- `POST /api/comparar` — `{ transportadoras: [{ nome, preco, perfil, aliquotaCbs?, aliquotaIbs?, atividade? }],
  ano, tipoOperacao, regimePagadora, ufOrigem, ufDestino }` — ordena por `custoTotal` e devolve, por
  transportadora, `hoje` (líquido no ano corrente), `precoTravado`, `liquidoTravado`, `precoEquilibrio`,
  `liquidoEquilibrio`, `variacaoPreco` e `variacaoLiquidoTravado`.
- `GET /api/saude` — status, versão e base dos motores regular e do Simples.

Cada resposta de `/api/simular` traz `motor.fonte` (`regime-regular` ou `simples-nacional`), `motor.nome`,
`motor.resposta` (JSON bruto do motor), `motor.requisicao` (payload enviado), a memória de cálculo em
`memoria[]`, as premissas e os `avisos` (por exemplo, quando o Simples/DAS caiu na estimativa).

`/api/reforma` preserva os mesmos princípios: a carga dos anos 2026–2033 sai da projeção oficial do motor
(cada ano com o CBS/IBS apurado pela calculadora), e o crédito/custo é a regra do regime aplicada ao
destaque. Se a projeção não existir no motor, a resposta não falha: devolve a série só de CBS/IBS, marca
2025 como indisponível e inclui o aviso — a interface mostra os traços e o motivo.

## Estrutura

```
app/
  server.js        HTTP + validação + memória de cálculo + comparador + linha do tempo
  domain.js        perfis, regimes, regras de crédito, faixas, atividades do Simples, UFs e cronograma
  engine.js        clientes dos motores regular e do Simples + projeção anual, sem regra tributária
  pagador.js       horizonte hoje → amanhã: preço travado, equilíbrio do pagador, piso do transportador, benchmark, preço-teto e ações
  public/
    index.html     página única
    styles.css     estilo, sem build
    app.js         comportamento (formulário, resultado, horizonte, comparador e linha do tempo)
```

Variáveis de ambiente: `PORT` (padrão 5180), `MOTOR_URL` (padrão `http://127.0.0.1:8080`) e
`MOTOR_SIMPLES_URL` (padrão `http://127.0.0.1:8082`).

O Simples/DAS usa as alíquotas efetivas do PGDAS quando informadas; sem elas, e para autônomo/MEI, valem as
faixas setoriais estimadas, sinalizadas na interface. A linha do tempo usa PIS/COFINS não cumulativo
(1,65% + 7,60%) e a tabela de ICMS interestadual do motor; em operação interna, o ICMS padrão é 18% e o
aviso lembra que a alíquota interna varia por UF. A ferramenta é de simulação e não substitui a apuração
fiscal.
