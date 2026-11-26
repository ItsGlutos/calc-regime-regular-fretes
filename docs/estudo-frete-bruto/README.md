# Estudo — variação do frete bruto sob CBS/IBS

Esta pasta reúne o estudo econômico sobre quanto o frete bruto precisa subir para preservar o líquido do transportador e do pagador, com projeção anual e cláusula contratual.

| Arquivo | O que é |
|---|---|
| [`RELATORIO.md`](RELATORIO.md) | Relatório completo: fatos, fórmulas, cenários, sensibilidade, contrato e respostas às perguntas. |
| [`modelo-frete-bruto.xlsx`](modelo-frete-bruto.xlsx) | Modelo editável: premissas, cenários, sensibilidade e exemplo de contrato. |
| [`gera_modelo.py`](gera_modelo.py) | Script que regenera o Excel a partir das premissas e fórmulas. |

## Leitura rápida

- **Regular + Lucro Real:** bruto +14,73% em 2033; líquido constante.
- **Lucro Presumido:** zona de acordo de R$ 12.671,23/mês em 2033.
- **Simples/DAS:** bruto +10,04% no cenário base; líquido do pagador +7,42%.
- **2027–2028:** o bruto regular cai 0,89%; não é todo ano que sobe.

O estudo **não altera o app** e **não é parecer tributário**. As premissas de DAS, insumos e margem do Simples precisam ser validadas com transportadores reais antes de qualquer decisão.

## Como regenerar o Excel

```powershell
cd docs/estudo-frete-bruto
python gera_modelo.py
```

O script usa `openpyxl` e grava `modelo-frete-bruto.xlsx` na mesma pasta. As células amarelas da aba **Premissas** são as entradas editáveis.
