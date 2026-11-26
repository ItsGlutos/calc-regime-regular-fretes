# 03 — Diárias de mercado: faixas em R$ por tipo de veículo

**Pergunta do produto:** qual faixa de diária oferecer como default e como validar o que o usuário digita.

**Aviso de método, antes de qualquer número:** não existe tabela pública de "diária de caminhão" no Brasil. O que existe é (a) **piso mínimo de frete da ANTT**, em R$/km e R$ por rota, e (b) **estadia**, em R$/tonelada-hora. As faixas deste capítulo são **derivadas** dessas duas âncoras oficiais por um método explícito — e estão marcadas como `derivado` ou `estimativa` no JSON. Nenhum número aqui é uma cotação de mercado coletada.

---

## 1. "Diária" quer dizer cinco coisas diferentes

Esse é o primeiro erro a evitar no formulário: o usuário pode chamar de "diária" coisas que se calculam de formas incompatíveis.

| # | Nome | O que é | Quem cobra | Base de cálculo | Fonte |
|---|---|---|---|---|---|
| 1 | **Diária de veículo** (dia dedicado) | Preço por dia de caminhão **à disposição**, com ou sem motorista, para uma rota ou um conjunto de entregas | transportadora, agregado, locadora | R$/dia | conceito de mercado; é o que este capítulo modela |
| 2 | **Diária de viagem** (per diem) | Ajuda de custo paga ao **motorista** por dia fora da base (alimentação, pousada) | empregador, via **CCT** | R$/dia, por motorista | aparece em CCT do SETCESP (cláusula de diárias) — **não localizamos o valor 2026 em fonte pública**; ver §6 |
| 3 | **Estadia** | Indenização pelo tempo de veículo **imobilizado** em carga/descarga além do prazo | transportador ao embarcador | **R$/tonelada-hora**, pela capacidade do veículo | Lei 11.442/2007, art. 11, § 5º; valor reajustado pelo INPC |
| 4 | **TDE / tempo adicional** | Cobrança pelo tempo extra de carga e descarga, contratual ou regulamentada | transportador | R$/hora ou R$/dia | página da ANTT "Pagamento do Tempo Adicional de Carga e Descarga"; ANTT não fixa valor, fixa o direito |
| 5 | **Diária de composição especial** | Preço/dia de conjunto superpesado (vigas, transformadores, 20+ eixos) | especialista em cargas indivisíveis | R$/dia, negociação caso a caso | indício de mercado: "**não fica por menos de R$ 15 mil**" a diária de um conjunto superpesado |

**Regra de produto:** o campo do app deve ser rotulado **"Diária do veículo (R$/dia)"**, com texto de ajuda distinguindo dos itens 2 e 3. Se o usuário digitar a diária de viagem do motorista, o faturamento mensal sai uma ordem de grandeza menor — e é melhor prevenir do que explicar depois.

### 1.1 Os termos vizinhos, para o texto de ajuda

| Termo | Definição | Relação com a diária |
|---|---|---|
| **Fração** | Frete de **carga fracionada**: mercadoria de vários embarcadores consolidada no mesmo veículo, cobrada por **peso/volume** com mínimo | a diária é o **custo** da operação; a fração é a **receita** rateada entre os clientes |
| **Frete-peso** | Tarifa por kg ou por tonelada | concorre com a diária quando o cliente cobra por carga, não por dia |
| **Frete-valor** | Tarifa ad valorem (% do valor da mercadoria), com mínimo de peso | típico de carga de alto valor; não substitui a diária |
| **Estadia** | Ver item 3 acima | **complementa** a diária quando o dia é consumido por espera |
| **TDE/TAP** | Tempo adicional de carga/descarga | **complementa** a diária pelo mesmo motivo |
| **Carga lotação** | Um contrato, um contratante, veículo exclusivo, uma origem, um destino, um CT-e/NF-e | é a operação em que o **piso da ANTT** se aplica — e onde a diária tem piso legal implícito |

---

## 2. A âncora oficial: piso mínimo da ANTT (tabela de 16/07/2026)

A Resolução ANTT nº 5.867/2020 fixa o piso do frete por **coeficientes de custo fixo e variável × distância**, acrescidos de carga/descarga. A tabela é reajustada periodicamente; a referência usada aqui é a de **16/07/2026**, reproduzida pelo ILOS e publicada pelo Guia do TRC.

**Piso para carga geral, combinação de 6 eixos, origem São Paulo:**

| Rota | Piso (R$) | Distância aprox. (km) | R$/km implícito |
|---|---:|---:|---:|
| SP → Curitiba | 3.687 | ~410 | **8,99** |
| SP → Rio de Janeiro | 3.834 | ~435 | **8,81** |
| SP → Goiânia | 7.291 | ~930 | **7,84** |
| SP → Recife | 20.162 | ~2.660 | **7,58** |
| SP → Belém | 22.001 | ~3.050 | **7,21** |

**Como ler:** o R$/km **cai** com a distância porque o componente fixo (carga, descarga, dias parados, mobilização) se dilui. Para uma **diária** — que é um dia de trabalho, normalmente 300–450 km — o valor relevante é o da faixa curta: **~R$ 8,80 a R$ 9,00 por km** para 6 eixos.

> As distâncias são premissa de cálculo (rodovia, origem na capital). Variar a distância em ±5% move o R$/km implícito em ±5%, sem mudar a conclusão.

**Derivação da diária de carreta (6 eixos):**

```
diária_piso = R$/km × km/dia
            = 8,80 × 400
            = R$ 3.520,00
```

Conferência contra rota real: SP–Curitiba, 410 km, piso **R$ 3.687** (R$ 8,99/km). O modelo usa R$ 8,80/km porque 400 km é uma diária típica e a rota SP–Curitiba carrega o adicional de curta distância. **Desvio: −2,1%.** Aceitável.

---

## 3. Premissa de km/dia (e por que ela não é arbitrária)

A jornada legal dá o teto; a operação dá o realizado:

```
km/dia = horas de jornada × fração efetivamente dirigindo × velocidade média
       = 8 h × 70% × 60 km/h
       = 336 km
```

Com as 2 h extras da Lei 13.103/2015 (e para longa distância, com 2 motoristas ou 12×36 por CCT), chega-se a 400–450 km/dia. Para distribuição urbana, o gargalo é a **parada**, não a estrada: 200–280 km/dia.

| Tipo | km/dia adotado | Racional |
|---|---:|---|
| 3/4 | **250** | distribuição urbana, muitas entregas; ~8 h com 40% do tempo parado |
| Toco | **280** | distribuição regional curta, menos paradas que o 3/4 |
| Truck | **320** | regional/média distância; permite 5–6 h de direção |
| Carreta | **400** | 8 h + 2 h extras, ~70% dirigindo a 60 km/h |
| Bitrem | **450** | longa distância, rodovia, poucas paradas; 2 motoristas ou 12×36 |

---

## 4. Faixas por tipo de veículo

### 4.1 Como o R$/km de cada tipo foi obtido

O piso da ANTT só foi lido para **6 eixos**. Para os demais tipos, apliquei **economia de escala no custo por tonelada-quilômetro**:

```
R$/km(tipo) = 8,80 × (capacidade_t / 27)^0,55
```

- `27 t` = capacidade da carreta de referência (o valor 27 aparece nas fórmulas de estadia da fonte oficial/setorial).
- Expoente **0,55** = premissa: o custo por km cresce com a capacidade, mas **menos que proporcionalmente** (o veículo maior dilui motorista, cabine, seguro e licenciamento). Faixa plausível do expoente: 0,45 a 0,65.
- `8,80` = R$/km do piso de 6 eixos (§2).

**Teste de sanidade:** com expoente 0,45 o 3/4 cairia para R$ 2,45/km (−14%); com 0,65 subiria para R$ 3,35/km (+17%). É a maior fonte de erro do modelo e está declarada em `06-validacao-cruzada.md`.

### 4.2 Tabela de diárias

| Tipo | Eixos | Cap. (t) | R$/km | km/dia | **Diária mín.** | **Diária base** | **Diária máx.** | Natureza do número |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **3/4** | 2 | 3,5 | 2,86 | 250 | **R$ 550** | **R$ 720** | **R$ 900** | derivado (base) / estimativa (faixa) |
| **Toco** | 2 | 6 | 3,85 | 280 | **R$ 860** | **R$ 1.080** | **R$ 1.350** | derivado / estimativa |
| **Truck** | 3 | 12 | 5,63 | 320 | **R$ 1.440** | **R$ 1.800** | **R$ 2.200** | derivado / estimativa |
| **Carreta** | 5–6 | 27 | 8,80 | 400 | **R$ 2.820** | **R$ 3.500** | **R$ 4.300** | base ancorada no piso ANTT; faixa estimada |
| **Bitrem** | 7 | 38 | 10,62 | 450 | **R$ 3.820** | **R$ 4.800** | **R$ 5.850** | derivado / estimativa |

**Como a faixa foi construída:** valor derivado = R$/km × km/dia; mín. ≈ derivado × 0,80 (dia curto, 80% dos km); máx. ≈ derivado × 1,22 (dia longo + prêmio de mercado sobre o piso, já que o piso é **mínimo legal**, não preço de equilíbrio). Os três números foram arredondados para múltiplos de R$ 10 (ou de R$ 50), então mín. e máx. **não batem exatamente** com os fatores — a diferença é de arredondamento, não de método.

**Contas abertas (para auditoria):**

```
3/4     : (3,5/27)^0,55 = 0,3251 → 2,861 R$/km × 250 =  715,3 → base  720
Toco    : (6,0/27)^0,55 = 0,4372 → 3,847 R$/km × 280 = 1.077,2 → base 1.080
Truck   : (12/27)^0,55  = 0,6402 → 5,634 R$/km × 320 = 1.802,9 → base 1.800
Carreta : (27/27)^0,55  = 1,0000 → 8,800 R$/km × 400 = 3.520,0 → base 3.500
Bitrem  : (38/27)^0,55  = 1,2071 → 10,622 R$/km × 450 = 4.779,9 → base 4.800
```

### 4.3 O que essas diárias implicam em faturamento mensal

Com 22 dias (default de `02-dias-e-jornada.md`):

| Tipo | Diária base | Bruto mensal (22 dias) | Leitura |
|---|---:|---:|---|
| 3/4 | R$ 720 | R$ 15.840 | cabe no MEI caminhoneiro (R$ 20.966,67/mês) |
| Toco | R$ 1.080 | R$ 23.760 | **estoura** o limite do MEI caminhoneiro |
| Truck | R$ 1.800 | R$ 39.600 | exige Simples ou regular |
| Carreta | R$ 3.500 | R$ 77.000 | exige Simples ou regular |
| Bitrem | R$ 4.800 | R$ 105.600 | exige Simples ou regular |

> **Insight de produto:** o teto do MEI caminhoneiro (R$ 251.600/ano = R$ 20.966,67/mês, LC 123/2006, art. 18-F) equivale a uma diária de **R$ 953 com 22 dias**. Qualquer diária acima disso, com 22 dias, **não cabe no MEI** — o app deve avisar em vez de deixar o usuário simular um regime impossível.

---

## 5. Estadia: o complemento oficial da diária

Quando o dia é consumido por espera, a diária não remunera. A lei resolve com a estadia:

| Parâmetro | Valor | Base |
|---|---:|---|
| Prazo livre de carga/descarga | **5 horas** | Lei 11.442/2007, art. 11, § 5º |
| Valor legal (2015) | **R$ 1,38 / t·hora** | idem, redação da Lei 13.103/2015 |
| Valor reajustado pelo INPC (referência 2026) | **R$ 2,84 / t·hora** | Guia do TRC (fonte 14) |
| Valor reajustado anterior (série histórica) | R$ 2,41 / t·hora | Guia do TRC (fonte 15) |
| Base de cálculo | **capacidade total de transporte do veículo** | Lei 11.442/2007 |

**Fórmula por tipo:**

```
estadia_hora = capacidade_t × 2,84
estadia_dia  = estadia_hora × horas_paradas
```

| Tipo | Cap. (t) | R$/hora | R$/dia (8 h paradas) |
|---|---:|---:|---:|
| 3/4 | 3,5 | 9,94 | 79,52 |
| Toco | 6 | 17,04 | 136,32 |
| Truck | 12 | 34,08 | 272,64 |
| Carreta | 27 | 76,68 | 613,44 |
| Bitrem | 38 | 107,92 | 863,36 |

**Por que isso importa para o produto:** a estadia de um dia de carreta (R$ 613) é **17,5% da diária** (R$ 3.500). Ou seja: um dia parado **não** se paga com estadia — ela indeniza o tempo, não o dia comercial. O app deve mostrar os dois conceitos lado a lado, sem somá-los como se fossem a mesma coisa.

---

## 6. Regiões

### 6.1 O que está medido

A tabela da ANTT **não tem fator regional**: para o mesmo tipo de carga e número de eixos, a diferença entre rotas vem da **distância** (§2). O que muda entre regiões é o **prêmio de mercado sobre o piso**, e a fonte 13 explica o porquê: menor disponibilidade de carga de retorno, maior tempo de ciclo, infraestrutura pior, mais restrições e riscos, e necessidade de reposicionar veículo vazio.

### 6.2 O que não está medido — e como o produto deve tratar

**Não encontrado:** nenhuma fonte pública com multiplicador regional de diária. Os fatores abaixo são **estimativa do especialista**, ancorada na explicação qualitativa da fonte 13, e servem apenas para **ordenar** as regiões — não para justificar um preço.

| Região | Fator sugerido | Natureza | Racional |
|---|---:|---|---|
| Sudeste | **1,00** | referência | densidade de embarcadores e de retorno; rotas curtas e médias |
| Sul | **1,00** | estimativa | densidade alta, retorno razoável |
| Centro-Oeste | **1,05** | estimativa | safra concentra demanda e falta retorno em janelas |
| Nordeste | **1,12** | estimativa | retorno escasso, ciclo longo, maior estadia média |
| Norte | **1,18** | estimativa | menor densidade, maior reposicionamento a vazio |

**Como usar sem mentir:** o produto deve apresentar o fator como **"ajuste regional sugerido (estimativa)"**, com um link para o texto de ajuda, e **nunca** como preço de mercado. Se o usuário tiver o dado real da operação dele, o dado dele vence.

### 6.3 Interestadual × interna não muda a diária

Mudar de interna para interestadual altera **ICMS** (18% interna típica contra 7%/12% interestadual) e, com ela, o **líquido e o crédito** — não a diária de mercado. São camadas diferentes: diária é preço; ICMS é tributo. Misturar as duas no formulário é o caminho mais curto para um número que ninguém consegue explicar.

---

## 7. O que não foi encontrado (declarado, não escondido)

| O que faltou | Por que | O que o produto deve fazer |
|---|---|---|
| Tabela pública de diária por tipo de veículo | não existe publicação sistemática; o mercado negocia caso a caso | usar as faixas derivadas, com rótulo "referência" e não "preço" |
| Valor 2026 da **diária de viagem** do motorista (CCT) | CCTs do SETCESP não estão em página aberta; a cláusula existe (aparece em notícia de 2020), mas sem valor vigente acessível | pedir ao usuário; sugerir faixa só se ele declarar que é diária de viagem |
| **Percentual de custo fixo** do transportador | Manual do NTC&Logística não é público; CNT/SEST/SENAT com conteúdo em JavaScript | tratar como parâmetro do usuário, não como default (ver `04-modelo-de-calculo.md`, §6) |
| Preço do diesel de 26/11/2026 | série da ANP em planilha, não em HTML | deixar como parâmetro atualizável; não travar em default |
| Diária de mercado em leilão/licitação pública | não localizada com busca indisponível | registrar como próximo passo de pesquisa |

---

## 8. Números que vão para o produto

| Chave | Valor | Natureza |
|---|---:|---|
| `tiposVeiculo[t].diariaBase` | 720 / 1.080 / 1.800 / 3.500 / 4.800 | derivado |
| `tiposVeiculo[t].diariaMin` | 550 / 860 / 1.440 / 2.820 / 3.820 | estimativa |
| `tiposVeiculo[t].diariaMax` | 900 / 1.350 / 2.200 / 4.300 / 5.850 | estimativa |
| `tiposVeiculo[t].kmPorDia` | 250 / 280 / 320 / 400 / 450 | premissa operacional |
| `estadia.rsPorToneladaHora` | **2,84** | oficial reajustado (INPC) |
| `estadia.prazoLivreHoras` | **5** | oficial (Lei 11.442/2007) |
| `regioes[r].fator` | 1,00 / 1,00 / 1,05 / 1,12 / 1,18 | estimativa |
