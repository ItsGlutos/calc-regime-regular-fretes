# ADR 001 — Stack do aplicativo desktop: .NET 8 + Avalonia

**Status:** aceita (substitui parcialmente a recomendação de `docs/estudo-interface-desktop.md`)
**Data:** novembro/2026

## Contexto

O estudo `docs/estudo-interface-desktop.md` recomendava uma casca Electron reaproveitando a
interface web, com o Node e os dois motores Java como sidecars, e explicitamente desaconselhava
reescrever a UI em JavaFX, Flutter ou .NET (seção 4.2, opção G: 16–24 semanas de esforço).

A direção do produto mudou: a próxima fase é um **aplicativo desktop instalável com interface
própria**, iniciando por uma GUI nativa que possa evoluir para um workspace (histórico, documentos,
contratos) sem as limitações de uma página única. A decisão foi tomada para .NET, inicialmente
referida como ".NET Flutter" — combinação que não existe: Flutter é Dart e exige Visual Studio com
a carga de trabalho C++ para compilar no Windows.

## Decisão

Usar **.NET 8 (LTS) + Avalonia 11.3** para a interface desktop.

- XAML/C#, um único projeto para Windows e Linux (requisito: não descartar Linux).
- Build apenas com o SDK do .NET — sem Visual Studio, sem toolchain nativa adicional.
- MVVM próprio (`ObservableObject` + `RelayCommand`), sem dependência de framework de MVVM.
- Dados de demonstração na fase 1; a integração com os motores oficiais fica atrás da interface
  `ISimuladorFrete` (HTTP para os sidecars Java, como o estudo propõe para o backend).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Electron + UI web atual** | era a recomendação do estudo; rejeitada por decisão de produto (GUI própria, não uma casca) |
| **Tauri 2 + UI web** | mesma objeção de casca; adiciona toolchain Rust |
| **WPF / WinUI 3** | excelente no Windows, mas fecha a porta para Linux |
| **.NET MAUI** | sem alvo Linux para desktop |
| **Flutter desktop** | stack nova em Dart, build no Windows exige Visual Studio + C++, e não é .NET |
| **JavaFX** | manteria a stack Java, mas exigiria reescrever a UI sem o CSS atual |

Avaliação qualitativa (não medida): Avalonia entrega o mesmo resultado visual do CSS atual com
controles nativos, empacotamento simples (`dotnet publish`) e um único código para os dois sistemas.
O custo aceito é reescrever a UI (o estudo estimava 16–24 semanas para a opção G); esta fase 1 cobre
calculadora, comparador, horizonte e memória.

## Consequências

**Positivas**

- Um só projeto para Windows e Linux; nenhuma dependência de Chromium embutido (~80–120 MB a menos
  que Electron, ~150–250 MB de RAM a menos).
- Controles nativos com acessibilidade do sistema; DPI por monitor via manifesto.
- Empacotamento direto: publish autocontido, MSIX ou Inno Setup.
- A GUI nasce estruturada para virar workspace (navegação + telas), como o estudo pede na fase 3.

**Negativas / custos**

- A UI existente não é reaproveitada: layout e componentes foram recriados em XAML.
- Gráficos não vêm de uma biblioteca pronta: as barras usam `ItemsControl` + `ProgressBar`; gráficos
  mais ricos (waterfall, heatmap) exigirão um controle próprio ou um pacote de charts.
- O time precisa manter C#/XAML além de Java/Node.
- Funcionalidades que o estudo previa para a fase 2 (histórico em SQLite, exportação PDF/XLSX,
  auto-update, tema escuro, i18n, suporte a arquivos) **ainda não existem**; a fase 1 é só a GUI.
- Fonte: Calibri não existe no Linux; o fallback é Carlito (métrica compatível), dependência do pacote
  Linux.

## Pendências

1. Executar o primeiro build e corrigir o que o compilador apontar (o SDK não estava instalado na
   máquina onde a fase 1 foi escrita).
2. Definir o caminho de integração: sidecars Java supervisionados pelo app (como o estudo recomenda)
   ou BFF reescrito em C# (P2 do estudo) — a interface `ISimuladorFrete` isola a escolha.
3. Revisar acessibilidade (foco visível, contraste dos rótulos, navegação por teclado).
