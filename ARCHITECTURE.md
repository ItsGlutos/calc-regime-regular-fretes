# Arquitetura — Frete Líquido

Simulador do **pagador do frete**: descobre quanto de CBS/IBS o tomador realmente aproveita e compara
transportadoras pelo custo líquido, não pelo preço nominal.

O projeto tem duas partes executáveis e uma vitrine estática:

| Camada | Tecnologia | Porta | Papel |
|---|---|---|---|
| Motor oficial | Java 25 / Spring Boot | `8080` | apura CBS/IBS e devolve a memória de cálculo |
| Aplicação | Node 20+ (sem dependências) | `5180` | valida a entrada, aplica a regra do regime e serve a página única |
| Vitrine | HTML + CSS estáticos | — | site do projeto no GitHub Pages |

O motor é o fork local de
[`ReceitaFederal/calculadora-rtc-regime-regular`](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular)
(MIT). **Nenhuma alíquota de CBS/IBS é reimplementada na aplicação.**

## Por que dois serviços

O motor oficial é uma aplicação Java/Spring com as tabelas da reforma e a apuração do regime regular.
A aplicação não tenta reproduzir essa apuração: ela monta uma operação de CT-e, chama o motor por HTTP e
usa o destaque devolvido como **teto** do crédito. Assim é possível atualizar o motor (nova versão da
base, nova regra) sem tocar na interface, e a resposta original fica disponível para auditoria.

```
┌──────────────────────────┐
│ Navegador                │
│ página única             │
└────────────┬─────────────┘
             │ fetch /api/simular, /api/comparar
             ▼
┌──────────────────────────┐
│ Node · app/server.js     │  :5180
│ valida · regra · memória │
└────────────┬─────────────┘
             │ POST /api/calculadora/regime-geral
             ▼
┌──────────────────────────┐
│ Motor oficial · Java     │  :8080
│ CBS/IBS + memória        │
└────────────┬─────────────┘
             │
             ▼
      tabelas oficiais + SQLite
```

## Fluxo de uma simulação

1. A interface envia `POST /api/simular` com valor, perfil, B2B/B2C, UFs e ano.
2. `server.js` valida e normaliza a entrada (valor em reais, UF existente, ano do cronograma, faixa da
   taxa quando o perfil é estimado).
3. `engine.js` monta um item de CT-e — NBS `105011220`, CST `000`, cClassTrib `000001` — e chama o motor.
   A partir de 2027 envia as alíquotas nominais do ano; em 2026 elas são proibidas e o motor aplica o
   destaque da fase de teste.
4. O motor devolve `vCBS`, `vIBS` e `memoriaCalculo`.
5. `domain.js` aplica a regra do regime do transportador, limitada ao destaque, e calcula o custo líquido.
6. A resposta inclui a memória em passos, as premissas e a **resposta bruta** do motor (JSON, headers de
   versão e o payload enviado).
7. A interface renderiza crédito, custo líquido, alerta de crédito abaixo de 4% e o bloco de auditoria.

## Camadas da aplicação

### `app/server.js`

HTTP, validação, orquestração e memória de cálculo. Sem framework: `node:http`, sem dependências.
Também serve a página única e os assets, com proteção contra path traversal e limite de corpo de 200 KB.

Rotas:

- `GET /api/opcoes` — perfis, faixas, UFs, anos e status do motor.
- `POST /api/simular` — uma transportadora.
- `POST /api/comparar` — 2 a 3 transportadoras, ordenadas por custo líquido.
- `GET /api/saude` — motor online, versão e base.

### `app/domain.js`

Dados e regras de negócio puros: perfis, faixas de crédito, UFs/municípios de referência, cronograma de
alíquotas e o cálculo do crédito/custo líquido. Não conhece HTTP nem o motor.

### `app/engine.js`

Cliente do motor oficial. Monta a operação, faz a chamada com timeout, guarda a resposta bruta e lê o
grupo IBS/CBS. Também descobre a versão do motor, o catálogo de transição e testa o endpoint oficial
quando o catálogo não existe (motor “puro”).

### `app/public/`

Página única (`index.html`, `styles.css`, `app.js`). Sem build step e sem framework. O estado do
comparador e da simulação vive no navegador; a aplicação não persiste dados.

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

Erros do motor são propagados como 502 com a mensagem original; entrada inválida é 400 na aplicação.

## Regra de crédito

| Perfil | Crédito | Natureza |
|---|---|---|
| Regime regular | 100% do destaque do motor | apurado |
| Simples híbrido | 9,0% a 9,3% do frete (padrão 9,3%) | estimativa setorial |
| Simples / DAS | 0,92% a 4,0% do frete (padrão 2,0%) | estimativa setorial |
| Autônomo / MEI | 1,8% a 4,0% do frete (padrão 1,8%) | estimativa setorial |

Regras:

- o crédito nunca passa do destaque (`min(taxa × frete, destaque)`);
- `custo líquido = frete − crédito`;
- em B2C o pagador é o consumidor final e o crédito é zero (hipótese exibida na memória);
- a taxa estimada pode ser ajustada dentro da faixa na interface.

## Alíquotas de transição

O padrão é **2033 (regime pleno)**: CBS 8,50% + IBS 18,50% = 27,00%. É o cenário em que os regimes
realmente se diferenciam. Em 2026 (fase de teste) o destaque é 1% e todos os perfis ficam limitados a
ele.

As alíquotas nominais vêm do catálogo do motor (`GET /api/calculadora/frete/parametros`). Se esse
endpoint não existir — por exemplo, com o repositório oficial “puro” —, a aplicação usa a tabela do
cronograma da LC 214/2025 embutida em `domain.js` e continua funcionando; o selo do motor indica a fonte.

## Decisões e limites

- **Sem reimplementar CBS/IBS**: o app só decide quanto do destaque vira crédito.
- **Simulação, não apuração**: as faixas de Simples, híbrido e MEI são estimativas setoriais e estão
  sinalizadas em cada resposta.
- **Sem persistência**: nenhuma simulação é gravada; o histórico é a própria resposta em tela.
- **Local por padrão**: escuta em `127.0.0.1`; não há autenticação nem exposição de rede.
- **Falha explícita**: se o motor estiver fora, a interface mostra o erro e o comando para subir — não
  há cálculo de reserva.

## Estrutura de diretórios

```
.
├── app/                     # aplicação Node + página única
│   ├── server.js            # HTTP, validação, memória, comparador
│   ├── domain.js            # perfis, faixas, UFs, cronograma
│   ├── engine.js            # cliente do motor oficial
│   ├── public/              # index.html, styles.css, app.js
│   └── docs/                # capturas usadas na documentação
├── site/                    # vitrine estática publicada no GitHub Pages
├── src/                     # motor oficial (Java/Spring)
├── docs/                    # documentação do motor e do simulador de frete
├── scripts/                 # utilitários de teste do motor
├── run.ps1                  # sobe motor + aplicação
└── .github/workflows/       # deploy do site no Pages
```

## Rodar, testar e publicar

```powershell
# motor + aplicação
.\run.ps1

# só a aplicação (motor já no ar)
cd app
$env:PORT = 5180
node server.js
```

O `run.ps1` detecta se o motor já está na porta 8080, sobe o JAR se necessário, aguarda e inicia o Node.
Se a aplicação já estiver no ar, imprime a URL e encerra.

Aceite (com o motor no ar):

```powershell
curl "http://127.0.0.1:5180/api/simular" -H "Content-Type: application/json" `
  -d '{"valorFrete":1000,"perfil":"SIMPLES_DAS","tipoOperacao":"B2B","ufOrigem":"SP","ufDestino":"BA","ano":2033}'
```

O endpoint `POST /api/comparar` com duas transportadoras de R$ 1.000,00 (Simples e híbrido) devolve o
híbrido em primeiro, com R$ 907,00 contra R$ 980,00.

Publicação: o workflow `.github/workflows/pages.yml` publica `site/` no GitHub Pages a cada push em
`main` que altere o site. A página é uma vitrine estática — o cálculo real depende do motor e do Node
rodando localmente.
