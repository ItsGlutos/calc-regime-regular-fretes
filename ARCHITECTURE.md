# Arquitetura — Frete Líquido

Simulador do **pagador do frete**: descobre quanto de CBS/IBS o tomador realmente aproveita e compara
transportadoras pelo custo líquido, não pelo preço nominal.

O projeto tem três partes executáveis e uma vitrine estática:

| Camada | Tecnologia | Porta | Papel |
|---|---|---|---|
| Motor do regime regular | Java 25 / Spring Boot | `8080` | apura CBS/IBS do regime regular e devolve a memória |
| Motor do Simples Nacional | Java 25 / Spring Boot | `8082` | apura CBS/IBS do Simples (CT-e, NF-e, NFS-e) |
| Aplicação | Node 20+ (sem dependências) | `5180` | valida a entrada, escolhe o motor, aplica a regra do regime e serve a SPA de quatro views |
| Vitrine | HTML + CSS estáticos | — | site do projeto no GitHub Pages |

Os motores são forks locais de
[`calculadora-rtc-regime-regular`](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) e
[`calculadora-rtc-simples-nacional`](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional)
(MIT). **Nenhuma alíquota de CBS/IBS é reimplementada na aplicação.**

## Por que três serviços

As duas calculadoras oficiais são aplicações Spring Boot independentes, com tabelas, regras e ciclos de
versão próprios. A aplicação não tenta reproduzir nenhuma das duas apurações: ela monta uma operação de
CT-e, escolhe o motor pelo regime do transportador, chama o serviço por HTTP e usa o destaque devolvido
como **teto** do crédito. Assim é possível atualizar cada motor (nova versão da base, nova regra) sem tocar
na interface, e a resposta original fica disponível para auditoria.

```
┌──────────────────────────┐
│ Navegador                │
│ SPA de 4 views          │
└────────────┬─────────────┘
             │ fetch /api/simular, /api/comparar
             ▼
┌──────────────────────────┐
│ Node · app/server.js     │  :5180
│ valida · escolhe motor   │
│ regra · memória          │
└───────┬──────────────┬───┘
        │              │
        │ perfil       │ perfil Simples/DAS
        │ regular      │ com alíquotas do PGDAS
        ▼              ▼
┌───────────────┐  ┌──────────────────────┐
│ Motor regular │  │ Motor Simples        │
│ :8080         │  │ :8082                │
│ CBS/IBS +     │  │ CBS/IBS do Simples + │
│ memória       │  │ memória              │
└───────┬───────┘  └──────────┬───────────┘
        │                     │
        └──────────┬──────────┘
                   ▼
      tabelas oficiais + SQLite compartilhado
```

Os dois motores leem o mesmo SQLite (`calculadora/db/calculadora-pro.db`) em modo somente leitura. O
schema é único e já contém as tabelas do Simples (migrações a partir da `V0071`).

## Fluxo de uma simulação

1. A interface envia `POST /api/simular` com valor, perfil, B2B/B2C, UFs e ano.
2. `server.js` valida e normaliza a entrada (valor em reais, UF existente, ano do cronograma, faixa da
   taxa quando o perfil é estimado).
3. `engine.js` escolhe o motor:
   - regime regular e Simples híbrido: item de CT-e — NBS `105011220`, CST `000`, cClassTrib `000001` — no
     motor `8080`. A partir de 2027 envia as alíquotas nominais do ano; em 2026 elas são proibidas e o motor
     aplica o destaque da fase de teste;
   - Simples/DAS com alíquotas do PGDAS: CT-e `tpDoc 57`, `CRT 1`, atividade `05`, cClassTrib `000001` e a
     linha `aliquotasEfetivas` no motor `8082`.
4. O motor devolve `vCBS`, `vIBS` e `memoriaCalculo`.
5. `domain.js` aplica a regra do regime do transportador, limitada ao destaque, e calcula o custo líquido.
6. A resposta inclui `motor.fonte`, a memória em passos, as premissas e a **resposta bruta** do motor (JSON,
   headers de versão e o payload enviado).
7. A interface renderiza crédito, custo líquido, alerta de crédito abaixo de 4% e o bloco de auditoria.

## Camadas da aplicação

### `app/server.js`

HTTP, validação, orquestração, escolha do motor e memória de cálculo. Sem framework: `node:http`, sem
dependências. Também serve a SPA de quatro views, o legado e os assets, com proteção contra path traversal e limite de corpo
de 200 KB.

Rotas:

- `GET /api/opcoes` — perfis, faixas, atividades do Simples, UFs, anos e status dos dois motores.
- `POST /api/simular` — uma transportadora.
- `POST /api/comparar` — 2 a 3 transportadoras, ordenadas por custo líquido, cada uma com suas alíquotas.
- `GET /api/saude` — motores online, versão e base.

### `app/domain.js`

Dados e regras de negócio puros: perfis, faixas de crédito, atividades do Simples, UFs/municípios de
referência, cronograma de alíquotas e o cálculo do crédito/custo líquido. Não conhece HTTP nem os motores.

### `app/engine.js`

Clientes dos dois motores oficiais. Monta a operação, faz a chamada com timeout, guarda a resposta bruta e lê
o grupo IBS/CBS (ou o `tribCalc` do Simples). Também descobre a versão de cada motor, o catálogo de transição
do regular e testa o endpoint oficial quando o catálogo não existe (motor “puro”).

### `app/public/`

Interface principal em quatro views (`Calculadora`, `Horizonte`, `Comparador`, `Memória`), sem build step e
sem framework: `index.html` é o shell, `estilo-base.css` + `styles.css` formam o sistema visual duotone e
`app.js` controla formulário, navegação, perfis salvos, comparador e memória. O estado da simulação e do
comparador vive no navegador; os perfis ficam em `app/data/perfis.json`, via API do Node.

A página única anterior (linha do tempo 2025–2033, horizonte do pagador e edição completa dos perfis) está
preservada em `app/public/legado/` e continua servida em `/legado/index.html`.

## Contrato com o motor

Requisição (exemplo para 2033):

```json
{
  "id": "frete-...",
  "versao": "1.0.0",
  "dhFatoGerador": "2033-06-15T10:00:00-03:00",
  "municipio": 2927408,
  "uf": "BA",
  "itens": [
    {
      "numero": 1,
      "nbs": "105011220",
      "cst": "000",
      "cClassTrib": "000001",
      "baseCalculo": 1000.0,
      "aliquotasNominais": { "cbs": 8.5, "ibsEstadual": 16.0, "ibsMunicipal": 2.5 }
    }
  ]
}
```

Campos usados da resposta:

- `objetos[0].tribCalc.IBSCBS.gIBSCBS.vCBS` e `.vIBS` — destaque (teto do crédito);
- `objetos[0].tribCalc.IBSCBS.memoriaCalculo` — texto oficial por tributo;
- `objetos[0].calculoSimulado` — indica cenário com alíquotas informadas;
- headers `X-CALC-APP-VERSION` e `X-CALC-DB-VERSION` — versão e base, exibidas na interface.

### Contrato com o motor do Simples

Requisição (exemplo para 2027, atividade `05`):

```json
{
  "id": "frete-sn-...",
  "versao": "1.0.0",
  "data": "2027-06-15",
  "tpDoc": "57",
  "CRT": "1",
  "aliquotasEfetivas": {
    "anexoIII": {
      "pCBSSN": "2.3591",
      "pIBSSN": "0.0260",
      "semRedistribuicaoISS": { "pCBSSN": "2.3591", "pIBSSN": "0.0260" }
    }
  },
  "itens": [
    {
      "numero": 1,
      "cAtivSN": "05",
      "cClassTrib": "000001",
      "nbs": "105011220",
      "baseCalculo": "1000.00",
      "valorImpostoSeletivo": "0.00"
    }
  ]
}
```

Campos usados da resposta:

- `objetos[0].tribCalc.vCBSSN` e `.vIBSSN` — destaque do Simples (teto do crédito);
- `objetos[0].tribCalc.memoriaCalculo.cbs` / `.ibs` — texto oficial por tributo;
- `objetos[0].estadoItem` — precisa ser `CALCULADO`;
- `total` — soma dos itens;
- headers `X-CALC-APP-VERSION` e `X-CALC-DB-VERSION`.

A atividade `05` (transporte de carga intermunicipal/interestadual) usa o Anexo III e o par sem
redistribuição do ISS. O motor do Simples só tem tabelas a partir de 2027; em 2026 o app cai na faixa
estimada.

Erros dos motores são propagados como 502 com a mensagem original; entrada inválida é 400 na aplicação.

## Regra de crédito

| Perfil | Crédito | Natureza |
|---|---|---|
| Regime regular | 100% do destaque do motor | apurado |
| Simples híbrido | 100% do destaque do regime regular | apurado |
| Simples/DAS com PGDAS | 100% do destaque do motor do Simples | apurado |
| Simples/DAS sem PGDAS | 0,92% a 4,0% do frete (padrão 2,0%) | estimativa setorial |
| Autônomo / MEI | 1,8% a 4,0% do frete (padrão 1,8%) | estimativa setorial |

Regras:

- o crédito nunca passa do destaque (`min(taxa × frete, destaque)`);
- `custo líquido = frete − crédito`;
- em B2C o pagador é o consumidor final e o crédito é zero (hipótese exibida na memória);
- a taxa estimada pode ser ajustada dentro da faixa na interface;
- o Simples híbrido é o optante que recolhe CBS/IBS no regime regular — o CT-e destaca o tributo cheio, e
  não a fração do DAS.

## Alíquotas de transição

O padrão é **2033 (regime pleno)**: CBS 8,50% + IBS 18,50% = 27,00%. É o cenário em que os regimes
realmente se diferenciam. Em 2026 (fase de teste) o destaque é 1% e todos os perfis ficam limitados a
ele.

As alíquotas nominais vêm do catálogo do motor (`GET /api/calculadora/frete/parametros`). Se esse
endpoint não existir — por exemplo, com o repositório oficial “puro” —, a aplicação usa a tabela do
cronograma da LC 214/2025 embutida em `domain.js` e continua funcionando; o selo do motor indica a fonte.
O Simples não usa essa tabela: as alíquotas efetivas vêm do PGDAS informado pelo usuário, e o motor do
Simples resolve o anexo e a vigência.

## Decisões e limites

- **Sem reimplementar CBS/IBS**: o app só escolhe o motor e decide quanto do destaque vira crédito.
- **Simulação, não apuração**: o crédito do Simples/DAS com PGDAS, do híbrido e do regular é apurado pelo
  motor; sem PGDAS, e no autônomo/MEI, a faixa é setorial e está sinalizada.
- **Sem persistência**: nenhuma simulação é gravada; o histórico é a própria resposta em tela.
- **Local por padrão**: escuta em `127.0.0.1`; não há autenticação nem exposição de rede.
- **Falha explícita**: se o motor do regime escolhido estiver fora, a interface mostra o erro e o comando
  para subir — não há cálculo de reserva.

## Estrutura de diretórios

```
.
├── app/                     # aplicação Node + SPA de quatro views
│   ├── server.js            # HTTP, validação, escolha do motor, memória, comparador
│   ├── domain.js            # perfis, faixas, atividades do Simples, UFs, cronograma
│   ├── engine.js            # clientes dos motores regular e do Simples
│   ├── public/              # index.html, estilo-base.css, styles.css, app.js e legado/
│   └── docs/                # capturas usadas na documentação
├── simples-nacional/        # subtree do motor do Simples (Java/Spring)
├── site/                    # vitrine estática publicada no GitHub Pages
├── src/                     # motor do regime regular (Java/Spring)
├── docs/                    # documentação do motor e do simulador de frete
├── scripts/                 # utilitários de teste dos motores e da interface
├── run.ps1                  # sobe os dois motores + aplicação
└── .github/workflows/       # deploy do site no Pages
```

## Rodar, testar e publicar

```powershell
# compilar os dois motores
.\mvnw.cmd -DskipTests package
.\mvnw.cmd -f simples-nacional\pom.xml -DskipTests package

# motores + aplicação
.\run.ps1

# só a aplicação (motores já no ar)
cd app
$env:PORT = 5180
node server.js
```

O `run.ps1` detecta se cada motor já está na respectiva porta (8080 e 8082), sobe os JARs se necessário,
aguarda e inicia o Node. Se a aplicação já estiver no ar, imprime a URL e encerra.

Aceite (com os dois motores no ar):

```powershell
curl "http://127.0.0.1:5180/api/simular" -H "Content-Type: application/json" `
  -d '{"valorFrete":1000,"perfil":"SIMPLES_DAS","tipoOperacao":"B2B","ufOrigem":"SP","ufDestino":"BA","ano":2027,"aliquotaCbs":2.3591,"aliquotaIbs":0.026}'
```

O retorno é o crédito de R$ 23,85 e o custo líquido de R$ 976,15, apurados pelo motor do Simples. O
endpoint `POST /api/comparar` com duas transportadoras de R$ 1.000,00 (Simples/DAS com PGDAS e híbrido)
devolve o híbrido em primeiro, com R$ 915,00 contra R$ 976,15. Em 2033, sem PGDAS, o Simples/DAS cai na
estimativa de 2% (R$ 980,00) e o híbrido fica em R$ 730,00.

Publicação: o workflow `.github/workflows/pages.yml` publica `site/` no GitHub Pages a cada push em
`main` que altere o site. A página é uma vitrine estática — o cálculo real depende dos motores e do Node
rodando localmente.
