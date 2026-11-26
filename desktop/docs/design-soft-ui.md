# Sistema visual — Soft UI do Frete Líquido

A paleta parte da mesma base do produto web (`app/public/styles.css`), com o azul
de crédito trocado por **verde militar**, e é reorganizada para superfícies de
baixo contraste. A regra central: **nenhuma borda dura**. A separação entre
camadas vem de sombra difusa e de cor, não de linha.

> **Fonte de verdade.** Os tokens vivem em `Temas/Cores.axaml` (e em
> `Infrastructure/Paleta.cs`, quando o item de lista carrega a própria cor). Os
> PNGs em `docs/preview/app-*.png` são gerados a partir do aplicativo compilado,
> por `scripts/capturar-janela.ps1` — não são maquetes. A prévia HTML
> (`docs/preview/calculadora.html`) e o PNG `calculadora-completa.png` são o
> desenho original que originou o sistema: servem como referência histórica de
> layout, não como especificação.

## Princípios

1. **Papel e cartão.** O fundo é levemente mais escuro (#EDF0F5) que os cartões
   (#FFFFFF). O cartão flutua com duas sombras: uma escura e ampla embaixo, uma
   quase invisível de contato.
2. **Dupla luz.** Superfícies elevadas ganham um realce branco no topo
   (`inset 0 1 0 #FFFFFF`); superfícies rebaixadas (campos, trilhas de segmento)
   ganham sombra interna escura no canto superior esquerdo e luz no inferior
   direito.
3. **Cantos generosos.** Cartões 24 px, painéis 20 px, campos 13–14 px, chips 9 px.
4. **Cor com função.** Verde militar (oliva) = crédito/principal, esmeralda = custo menor, âmbar =
   atenção, vermelho = risco. Nada de cor decorativa.
5. **Números primeiro.** O custo líquido é o maior elemento da tela (54 px). Todo o
   resto hierarquiza abaixo dele.

## Tokens (Temas/Cores.axaml)

| Grupo | Token | Valor |
|---|---|---|
| Papel | `PincelPapel` | `#EDF0F5` |
| Superfície | `PincelSuperficie` | `#FFFFFF` |
| Superfície suave | `PincelSuperficieSuave` | `#F7F9FC` |
| Rebaixado | `PincelAfundado` | `#E7ECF3` |
| Tinta | `PincelTinta` | `#0B1220` |
| Tinta suave | `PincelTintaSuave` | `#33405A` |
| Texto | `PincelTexto` | `#556274` |
| Texto fraco | `PincelTextoFraco` | `#7E8A9C` |
| Linha | `PincelLinha` | `#E4E9F0` |
| Marca | `GradienteMarca` | `#1B2A44 → #0F172A` |
| Verde militar | `PincelOliva` | `#4D5C36` |
| Verde militar forte | `PincelOlivaForte` | `#3C4829` |
| Verde militar 050 / 100 / 200 / 300 | `PincelOliva050` … `PincelOliva300` | `#F3F5EA` / `#E6EAD3` / `#CDD7AE` / `#B4C293` |
| Barra antes da reforma | `GradienteBarraAntes` | `#C9D5E4 → #A9B9CE` |
| Barra em vigor | `GradienteBarra` | `#5E7240 → #45542F` |
| Foco | `PincelFoco` | `#A9B98E` |
| Verde (custo menor) | `PincelVerde` | `#0F7A55` |
| Âmbar | `PincelAmbar` | `#9A5B06` |
| Vermelho | `PincelVermelho` | `#B42318` |

## Tipografia (Temas/Tipografia.axaml)

Família: `Calibri, Carlito, Segoe UI`. Calibri não existe no Linux; Carlito é
métrica e visualmente compatível e é o primeiro fallback.

| Classe | Tamanho | Peso | Uso |
|---|---|---|---|
| `.heroi` | 54 | SemiBold | custo líquido |
| `.h1` | 31 | SemiBold | título da tela |
| `.h2` | 20 | SemiBold | título de cartão |
| `.h3` | 15,5 | SemiBold | item, subtítulo |
| `.corpo` | 14,5 | Regular | texto de apoio |
| `.legenda` | 12,5 | Regular | descrição de campo |
| `.fina` | 11,5 | Regular | nota, rodapé |
| `.rotulo` | 11 | SemiBold | rótulo em caixa alta, entreletra 1,1 |
| `.eyebrow` | 10,5 | SemiBold | chamada de seção, entreletra 1,6 |
| `.numero` | 14,5 | SemiBold | valores em linha |

## Componentes

| Classe / tema | Aparência |
|---|---|
| `Border.cartao` | branco, raio 24, sombra `0 26 50 -34` + contato |
| `Border.painel` | branco, raio 20, sombra mais curta |
| `Border.afundado` | gelo, raio 14, sombra interna dupla |
| `Border.segmentado` | trilha de segmento, raio 14, rebaixada |
| `Border.chip` / `.chipOliva` | pílula de metadado |
| `BotaoPrimario` | gradiente navy, raio 16, altura 52 |
| `BotaoSuave` | branco elevado, raio 14 |
| `BotaoFantasma` | só texto em verde militar |
| `BotaoIcone` | 38×38, raio 12 |
| `AbaNav` | RadioButton de navegação; selecionado vira pílula branca |
| `Segmento` | RadioButton de segmento; selecionado vira pílula branca |
| `CartaoOpcao` | RadioButton de cartão (regime); selecionado fica em verde militar claro |
| `BarraCredito` | ProgressBar de 10 px com preenchimento em gradiente |
| `BarraRolagem` | ScrollBar de 11 px; thumb oliva 300, raio 4 |

## Regras que o primeiro build ensinou

Cada linha abaixo foi um defeito real, encontrado ao compilar e olhar a janela —
não são preferências.

| Sintoma | Causa | Regra |
|---|---|---|
| `StrokeLineJoin` não resolve | é propriedade de WPF; no Avalonia chama-se `StrokeJoin` | conferir nomes de propriedade contra o Avalonia, não contra o WPF |
| Scrollbar virava fio cinza `#888888` | o template do Fluent pinta o thumb com cinza fixo; `ScrollBar.Foreground` não chega nele | tema próprio (`BarraRolagem`) referenciado por `Theme` |
| Thumb minúsculo no pé da trilha | `Track` sem `TemplateBinding` de `Minimum/Maximum/Value/ViewportSize` | sempre ligar essas quatro no `Track` do template |
| Barras do gráfico desalinhadas | `StackPanel` por item: o rótulo de fase só existe em alguns anos | item com `Grid RowDefinitions="*,Auto,Auto,Auto"`, barra ancorada no rodapé |
| Texto cortado no fim do formulário | rolagem interna sem sinal visual | degradê branco fixo sobre a borda inferior + scrollbar com cor própria |
| Captura de tela pegava o navegador | `SetForegroundWindow` recusado e DPI não declarada | `TOPMOST` + `SetProcessDPIAware()` antes de capturar |

## Acessibilidade e teclado

- **Foco visível.** Botões e cartões usam `ControlTheme` próprio, então o foco do
  Fluent não desenha nada neles. O adorno de foco padrão foi desligado
  (`FocusAdorner="{x:Null}"`), porque é um retângulo duro de 1 px com cantos retos
  que briga com as pílulas; no lugar dele há um anel em `Button:focus-visible` e
  `RadioButton:focus-visible`, em verde militar (`#4D5C36`) com transparência.
  Não remover: sem ele, navegar por Tab não mostra onde o cursor está.
- **Nome acessível.** Qualquer controle cujo conteúdo é um `StackPanel` de ícone +
  texto se anuncia como "Avalonia.Controls.StackPanel". As abas, os cartões de
  regime, os segmentos, os combos e os botões de ícone recebem
  `AutomationProperties.Name` (aplicado por `scripts/aplicar-nomes-acessiveis.py`,
  que falha se a âncora não existir exatamente uma vez).
- **Contraste.** Texto principal `#0B1220` sobre branco (~19:1); rótulos `#7E8A9C`
  sobre branco (~4,6:1) — no limite para texto pequeno, aceitável para rótulo
  secundário. Texto branco sobre oliva `#4D5C36` fica em ~7,5:1.
- **Navegação.** Todo o formulário é alcançável por Tab; ComboBox e TextBox mantêm
  o comportamento nativo do Fluent.

