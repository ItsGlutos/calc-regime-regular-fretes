# Frete Líquido

Simulador local do **pagador do frete**: descobre o custo líquido real depois do crédito de CBS/IBS e
compara transportadoras de regimes tributários diferentes.

O CBS/IBS **não é calculado neste projeto**. Cada simulação chama um dos dois motores oficiais da Receita,
ambos com licença MIT e execução local, e a resposta bruta fica disponível na interface para auditoria:

| Perfil | Motor | Porta |
|---|---|---|
| Regime regular e Simples híbrido | [`calculadora-rtc-regime-regular`](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | `8080` |
| Simples/DAS com alíquotas do PGDAS | [`calculadora-rtc-simples-nacional`](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | `8082` |

![Frete Líquido no desktop](docs/web-desktop.png)

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

## Como o cálculo funciona

1. A aplicação monta um item de CT-e (NBS `105011220`, cClassTrib `000001`) com o valor do frete.
2. Pelo perfil, escolhe o motor:
   - **regime regular e Simples híbrido**: item com CST `000` e
     `POST /api/calculadora/regime-geral` na `8080`;
   - **Simples/DAS com PGDAS**: CT-e `tpDoc 57`, `CRT 1`, atividade `05` (Anexo III) e a linha de
     alíquotas efetivas do PGDAS em `POST /api/calculadora/observabilidade/simples-nacional/nao-assistido`
     na `8082`.
3. O motor devolve o CBS/IBS destacado (`vCBS` + `vIBS`) e a memória de cálculo oficial.
4. A aplicação aplica a regra de crédito do regime do transportador — o destaque é um **teto**:

| Perfil | Crédito | Natureza |
|---|---|---|
| Regime regular | 100% do destaque do motor | apurado |
| Simples híbrido | 100% do destaque (CBS/IBS no regime regular) | apurado |
| Simples/DAS com PGDAS | 100% do destaque apurado pelo motor do Simples | apurado |
| Simples/DAS sem PGDAS | 0,92% a 4,0% do frete (padrão 2,0%) | estimativa setorial |
| Autônomo / MEI | 1,8% a 4,0% do frete (padrão 1,8%) | estimativa setorial |

5. `custo líquido = valor do frete − crédito aproveitável`.
6. Em B2C o pagador é o consumidor final: o crédito não é aproveitável e o custo é o preço cheio.

O ano de referência padrão é **2033 (regime pleno, CBS 8,50% + IBS 18,50%)**. O motor do Simples só tem
tabelas a partir de **2027**; em 2026, o Simples/DAS cai na faixa estimada e o destaque de 1% limita o crédito.
O Simples híbrido e o regime regular funcionam em todos os anos do cronograma.

### Aceite

Frete de R$ 1.000,00, SP → BA, em **2027**, com as alíquotas efetivas do PGDAS do exemplo (CBS 2,3591% +
IBS 0,0260%):

| Transportadora | Regime | Crédito | Custo líquido |
|---|---|---|---|
| Rota Sul Logística | Simples/DAS · PGDAS | R$ 23,85 (2,39%) | **R$ 976,15** |
| Via Brasil Transportes | Simples híbrido · regime regular | R$ 85,00 (8,50%) | **R$ 915,00** |

O comparador ordena por custo líquido: o híbrido vence com o mesmo preço nominal, e o Simples/DAS dispara o
alerta de crédito abaixo de 4%.

## API

- `GET /api/opcoes` — perfis, faixas, UFs, anos, atividades do Simples e status dos dois motores.
- `POST /api/simular` — `{ valorFrete, perfil, tipoOperacao, ufOrigem, ufDestino, ano, taxaCredito?,
  aliquotaCbs?, aliquotaIbs?, atividade? }`.
- `POST /api/comparar` — `{ transportadoras: [{ nome, preco, perfil, aliquotaCbs?, aliquotaIbs?, atividade? }],
  ano, tipoOperacao, ufOrigem, ufDestino }`.
- `GET /api/saude` — status, versão e base dos motores regular e do Simples.

Cada resposta de `/api/simular` traz `motor.fonte` (`regime-regular` ou `simples-nacional`), `motor.nome`,
`motor.resposta` (JSON bruto do motor), `motor.requisicao` (payload enviado), a memória de cálculo em
`memoria[]`, as premissas e os `avisos` (por exemplo, quando o Simples/DAS caiu na estimativa).

## Estrutura

```
app/
  server.js        HTTP + validação + memória de cálculo + comparador
  domain.js        perfis, faixas, atividades do Simples, UFs e cronograma
  engine.js        clientes dos motores regular e do Simples, sem regra tributária
  public/
    index.html     página única
    styles.css     estilo, sem build
    app.js         comportamento
```

Variáveis de ambiente: `PORT` (padrão 5180), `MOTOR_URL` (padrão `http://127.0.0.1:8080`) e
`MOTOR_SIMPLES_URL` (padrão `http://127.0.0.1:8082`).

O Simples/DAS usa as alíquotas efetivas do PGDAS quando informadas; sem elas, e para autônomo/MEI, valem as
faixas setoriais estimadas, sinalizadas na interface. A ferramenta é de simulação e não substitui a apuração
fiscal.
