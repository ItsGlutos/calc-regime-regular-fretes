"""Adiciona AutomationProperties.Name aos controles sem texto exposto ao UIA.

Sem isso, um RadioButton cujo Content e um StackPanel se anuncia como
"Avalonia.Controls.StackPanel": leitor de tela e automacao nao sabem dizer
"Calculadora" nem "Simples Nacional".

O script falha alto se qualquer ancora nao aparecer exatamente uma vez, para
nao mascarar uma view que mudou.
"""

from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
VIEWS = RAIZ / "src" / "FreteLiquido.Desktop" / "Views"

# (arquivo, ancora existente, ancora com o nome acessivel)
PATCHES = [
    # Navegacao principal
    ("MainWindow.axaml",
     'IsChecked="{Binding AbaCalculadora, Mode=TwoWay}">',
     'IsChecked="{Binding AbaCalculadora, Mode=TwoWay}"\n                         AutomationProperties.Name="Calculadora">'),
    ("MainWindow.axaml",
     'IsChecked="{Binding AbaComparador, Mode=TwoWay}">',
     'IsChecked="{Binding AbaComparador, Mode=TwoWay}"\n                         AutomationProperties.Name="Comparador">'),
    ("MainWindow.axaml",
     'IsChecked="{Binding AbaHorizonte, Mode=TwoWay}">',
     'IsChecked="{Binding AbaHorizonte, Mode=TwoWay}"\n                         AutomationProperties.Name="Horizonte">'),
    ("MainWindow.axaml",
     'IsChecked="{Binding AbaMemoria, Mode=TwoWay}">',
     'IsChecked="{Binding AbaMemoria, Mode=TwoWay}"\n                         AutomationProperties.Name="Memoria">'),

    # Formulario da calculadora
    ("CalculadoraView.axaml",
     'Command="{Binding RestaurarCommand}"',
     'Command="{Binding RestaurarCommand}"\n                    AutomationProperties.Name="Restaurar o exemplo"'),
    ("CalculadoraView.axaml",
     'Text="{Binding ValorFreteTexto, Mode=TwoWay}"',
     'Text="{Binding ValorFreteTexto, Mode=TwoWay}"\n                             AutomationProperties.Name="Valor do frete"'),
    ("CalculadoraView.axaml",
     'IsChecked="{Binding EhSimples, Mode=TwoWay}">',
     'IsChecked="{Binding EhSimples, Mode=TwoWay}"\n                             AutomationProperties.Name="Simples Nacional">'),
    ("CalculadoraView.axaml",
     'IsChecked="{Binding EhRegular, Mode=TwoWay}">',
     'IsChecked="{Binding EhRegular, Mode=TwoWay}"\n                             AutomationProperties.Name="Regime regular">'),
    ("CalculadoraView.axaml",
     'SelectedItem="{Binding ModalidadeSelecionada, Mode=TwoWay}">',
     'SelectedItem="{Binding ModalidadeSelecionada, Mode=TwoWay}"\n                            AutomationProperties.Name="Modalidade">'),
    ("CalculadoraView.axaml",
     'IsChecked="{Binding EhB2B, Mode=TwoWay}"',
     'IsChecked="{Binding EhB2B, Mode=TwoWay}"\n                                 AutomationProperties.Name="B2B"'),
    ("CalculadoraView.axaml",
     'IsChecked="{Binding EhB2C, Mode=TwoWay}"',
     'IsChecked="{Binding EhB2C, Mode=TwoWay}"\n                                 AutomationProperties.Name="B2C"'),
    ("CalculadoraView.axaml",
     'SelectedItem="{Binding PagadoraSelecionada, Mode=TwoWay}">',
     'SelectedItem="{Binding PagadoraSelecionada, Mode=TwoWay}"\n                            AutomationProperties.Name="Regime de credito da empresa">'),
    ("CalculadoraView.axaml",
     'SelectedItem="{Binding UfOrigem, Mode=TwoWay}">',
     'SelectedItem="{Binding UfOrigem, Mode=TwoWay}"\n                              AutomationProperties.Name="UF de origem">'),
    ("CalculadoraView.axaml",
     'SelectedItem="{Binding UfDestino, Mode=TwoWay}">',
     'SelectedItem="{Binding UfDestino, Mode=TwoWay}"\n                              AutomationProperties.Name="UF de destino">'),
    ("CalculadoraView.axaml",
     'SelectedItem="{Binding AnoSelecionado, Mode=TwoWay}">',
     'SelectedItem="{Binding AnoSelecionado, Mode=TwoWay}"\n                            AutomationProperties.Name="Ano de referencia">'),

    # Memoria de calculo
    ("MemoriaView.axaml",
     'Click="CopiarJson"',
     'Click="CopiarJson"\n                      AutomationProperties.Name="Copiar a resposta JSON"'),
]


def aplicar() -> None:
    por_arquivo: dict[str, list[tuple[str, str]]] = {}
    for arquivo, antigo, novo in PATCHES:
        por_arquivo.setdefault(arquivo, []).append((antigo, novo))

    for arquivo, trocas in por_arquivo.items():
        caminho = VIEWS / arquivo
        texto = caminho.read_text(encoding="utf-8")
        for antigo, novo in trocas:
            ocorrencias = texto.count(antigo)
            if ocorrencias != 1:
                raise SystemExit(
                    f"{arquivo}: ancora com {ocorrencias} ocorrencia(s), esperava 1:\n  {antigo}"
                )
            texto = texto.replace(antigo, novo, 1)
        caminho.write_text(texto, encoding="utf-8")
        print(f"{arquivo}: {len(trocas)} nome(s) acessivel(is) aplicado(s)")


if __name__ == "__main__":
    aplicar()
