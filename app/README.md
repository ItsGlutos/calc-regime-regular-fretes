# Frete Líquido

Simulador local do **pagador do frete**: descobre o custo líquido real depois do crédito de CBS/IBS e
compara transportadoras de regimes tributários diferentes.

O CBS/IBS **não é calculado neste projeto**. Cada simulação chama a API do motor oficial da Receita
([`calculadora-rtc-regime-regular`](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular),
licença MIT), roda localmente em `http://127.0.0.1:8080`, e a resposta bruta fica disponível na
interface para auditoria.

![Frete Líquido no desktop](docs/web-desktop.png)

## Como rodar

Na raiz do repositório:

```powershell
.\run.ps1
```

O script sobe o motor oficial (se ainda não estiver no ar) e a aplicação em `http://127.0.0.1:5180`.
Se a política de execução bloquear:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

Alternativa manual, com o motor já rodando:

```powershell
java -Dspring.profiles.active=offline -jar target\api-regime-geral.jar   # terminal 1
cd app; node server.js                                                   # terminal 2
```

Requisitos: Node 20+ (testado no 24) e o JAR do motor já compilado em `target/api-regime-geral.jar`.

## Como o cálculo funciona

1. A aplicação monta um item de CT-e (NBS `105011220`, CST `000`, cClassTrib `000001`) com o valor do
   frete e chama `POST /api/calculadora/regime-geral` do motor.
2. O motor devolve o CBS/IBS destacado (`vCBS` + `vIBS`) e a memória de cálculo oficial.
3. A aplicação aplica a regra de crédito do regime do transportador — o destaque é um **teto**:

| Perfil | Crédito | Natureza |
|---|---|---|
| Regime regular | 100% do destaque do motor | apurado |
| Simples híbrido | 9,0% a 9,3% do frete | estimativa setorial |
| Simples / DAS | 0,92% a 4,0% do frete (padrão 2,0%) | estimativa setorial |
| Autônomo / MEI | 1,8% a 4,0% do frete (padrão 1,8%) | estimativa setorial |

4. `custo líquido = valor do frete − crédito aproveitável`.
5. Em B2C o pagador é o consumidor final: o crédito não é aproveitável e o custo é o preço cheio.

O ano de referência padrão é **2033 (regime pleno, CBS 8,50% + IBS 18,50%)**, o cenário em que os
regimes realmente se diferenciam. Em 2026 (fase de teste, 1%) o crédito de todos os perfis é limitado
ao destaque do ano.

### Aceite

Com frete de R$ 1.000,00 e preço nominal igual:

| Transportadora | Regime | Crédito | Custo líquido |
|---|---|---|---|
| Rota Sul Logística | Simples/DAS (2,0%) | R$ 20,00 | **R$ 980,00** |
| Via Brasil Transportes | Simples híbrido (9,3%) | R$ 93,00 | **R$ 907,00** |

O comparador ordena por custo líquido: o híbrido vence mesmo com o mesmo preço nominal.

## API

- `GET /api/opcoes` — perfis, faixas, UFs, anos, status do motor.
- `POST /api/simular` — `{ valorFrete, perfil, tipoOperacao, ufOrigem, ufDestino, ano, taxaCredito? }`.
- `POST /api/comparar` — `{ transportadoras: [{ nome, preco, perfil }], ano, tipoOperacao, ufOrigem, ufDestino }`.
- `GET /api/saude` — motor online, versão e base de dados.

Cada resposta de `/api/simular` traz `motor.resposta` (JSON bruto do motor), `motor.requisicao`
(payload enviado), a memória de cálculo em `memoria[]` e as premissas.

## Estrutura

```
app/
  server.js        HTTP + validação + memória de cálculo + comparador
  domain.js        perfis, faixas de crédito, UFs e cronograma de alíquotas
  engine.js        cliente do motor oficial (HTTP), sem regra tributária
  public/
    index.html     página única
    styles.css     estilo, sem build
    app.js         comportamento
```

Variáveis de ambiente: `PORT` (padrão 5180), `MOTOR_URL` (padrão `http://127.0.0.1:8080`).

As faixas de Simples, Simples híbrido e autônomo/MEI são estimativas setoriais, sinalizadas na
interface. A ferramenta é de simulação e não substitui a apuração fiscal.
