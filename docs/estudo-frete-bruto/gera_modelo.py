"""Gera o modelo Excel do estudo de variação do frete bruto.

Uso:
    python gera_modelo.py

O arquivo resultante é docs/estudo-frete-bruto/modelo-frete-bruto.xlsx.
As células amarelas da aba Premissas são as entradas editáveis.
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

DESTINO = Path(__file__).with_name("modelo-frete-bruto.xlsx")

AZUL = "0B5FA5"
NAVY = "0F172A"
PAPEL = "F4F5F7"
AMARELO = "FFF2CC"
CINZA = "E2E8F0"
VERDE = "0F7A55"
VERMELHO = "B42318"

TITULO = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
SUBTITULO = Font(name="Calibri", size=11, bold=True, color=NAVY)
TEXTO = Font(name="Calibri", size=10, color=NAVY)
TEXTO_FRACO = Font(name="Calibri", size=9, color="475569")
CABECALHO = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
INPUT = Font(name="Calibri", size=10, bold=True, color="7A4E00")

FUNDO_TITULO = PatternFill("solid", fgColor=AZUL)
FUNDO_CABECALHO = PatternFill("solid", fgColor=NAVY)
FUNDO_INPUT = PatternFill("solid", fgColor=AMARELO)
FUNDO_ZEBRA = PatternFill("solid", fgColor=PAPEL)
FUNDO_DESTAQUE = PatternFill("solid", fgColor="E8F2EA")

BORDA = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)

MOEDA = 'R$ #,##0.00'
PCT = '0.00%'
PCT4 = '0.0000%'
NUM = '#,##0.00'


def titulo(ws, texto, largura=8):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=largura)
    celula = ws.cell(row=1, column=1, value=texto)
    celula.font = TITULO
    celula.fill = FUNDO_TITULO
    celula.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 30


def secao(ws, linha, texto, largura=8):
    ws.merge_cells(start_row=linha, start_column=1, end_row=linha, end_column=largura)
    celula = ws.cell(row=linha, column=1, value=texto)
    celula.font = SUBTITULO
    celula.fill = PatternFill("solid", fgColor=CINZA)
    celula.alignment = Alignment(horizontal="left", vertical="center")


def cabecalho(ws, linha, valores):
    for col, valor in enumerate(valores, start=1):
        celula = ws.cell(row=linha, column=col, value=valor)
        celula.font = CABECALHO
        celula.fill = FUNDO_CABECALHO
        celula.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        celula.border = BORDA


def celula(ws, linha, col, valor, fmt=None, bold=False, input_=False, destaque=False):
    c = ws.cell(row=linha, column=col, value=valor)
    c.font = INPUT if input_ else (Font(name="Calibri", size=10, bold=True, color=NAVY) if bold else TEXTO)
    c.border = BORDA
    c.alignment = Alignment(horizontal="right" if fmt else "left", vertical="center")
    if fmt:
        c.number_format = fmt
    if input_:
        c.fill = FUNDO_INPUT
    elif destaque:
        c.fill = FUNDO_DESTAQUE
    return c


def larguras(ws, mapa):
    for col, largura in mapa.items():
        ws.column_dimensions[col].width = largura


wb = Workbook()

# ---------------------------------------------------------------------------
# Leia-me
# ---------------------------------------------------------------------------
ws = wb.active
ws.title = "Leia-me"
titulo(ws, "Modelo — variação do frete bruto sob CBS/IBS", 6)
ws["A3"] = "O que é"
ws["A3"].font = SUBTITULO
ws["A4"] = (
    "Modelo de negociação para responder quanto o frete bruto precisa subir para preservar o líquido "
    "do transportador e quanto sobra de custo líquido para o pagador. Não é apuração fiscal."
)
ws["A4"].alignment = Alignment(wrap_text=True, vertical="top")
ws.merge_cells("A4:F4")
ws.row_dimensions[4].height = 44

ws["A6"] = "Como usar"
ws["A6"].font = SUBTITULO
passos = [
    "1. Abra a aba Premissas e altere apenas as células amarelas (frete, DAS, insumos, margem, crédito).",
    "2. A aba Cenarios recalcula o bruto de repasse, o crédito e o líquido de cada regime.",
    "3. A aba Sensibilidade mostra o intervalo de bruto e de líquido para insumos e DAS plausíveis.",
    "4. A aba Contrato simula um mês com volume variável e o true-up do tributo.",
    "5. O relatório completo está em RELATORIO.md, na mesma pasta.",
]
for i, texto in enumerate(passos, start=7):
    ws.cell(row=i, column=1, value=texto).font = TEXTO
    ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=6)

ws["A14"] = "Cores"
ws["A14"].font = SUBTITULO
ws["A15"] = "Amarelo = célula de entrada editável"
ws["A15"].fill = FUNDO_INPUT
ws["A15"].font = INPUT
ws["A16"] = "Verde = resultado de referência"
ws["A16"].fill = FUNDO_DESTAQUE
ws["A16"].font = TEXTO
ws["A17"] = "Demais células = fórmula ou texto"
ws["A17"].font = TEXTO

ws["A19"] = "Ressalvas"
ws["A19"].font = SUBTITULO
ressalvas = [
    "As alíquotas de 2027–2033 são premissa do motor oficial; o Senado fixa a referência a cada ano.",
    "O crédito do Simples em 2033 é a maior incerteza: o motor só tem tabelas a partir de 2027.",
    "O modelo usa a carga do documento como proxy da carga do transportador; para o Simples, usa DAS e insumos.",
    "Não substitui parecer tributário, auditoria fiscal ou revisão jurídica da cláusula contratual.",
]
for i, texto in enumerate(ressalvas, start=20):
    ws.cell(row=i, column=1, value="• " + texto).font = TEXTO_FRACO
    ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=6)

larguras(ws, {"A": 24, "B": 18, "C": 18, "D": 18, "E": 18, "F": 18})

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Resumo", 1)
titulo(ws, "Resumo — as respostas em uma tela", 5)
ws["A3"] = "Pergunta"
ws["B3"] = "Resposta"
ws["C3"] = "Onde ver"
for col in ("A3", "B3", "C3"):
    ws[col].font = CABECALHO
    ws[col].fill = FUNDO_CABECALHO
    ws[col].border = BORDA
    ws[col].alignment = Alignment(horizontal="center", vertical="center")

resumo = [
    ("Bruto regular 2033 (R$/mês)", "=Cenarios!D14", MOEDA, "Cenarios A"),
    ("Líquido regular 2033 (R$/mês)", "=Cenarios!F14", MOEDA, "Cenarios A"),
    ("Δ bruto regular 2033", "=Cenarios!D14/Premissas!B4-1", PCT, "Cenarios A"),
    ("Bruto Simples 2033 (R$/mês)", "=Cenarios!D41", MOEDA, "Cenarios C"),
    ("Líquido Simples 2033 (R$/mês)", "=Cenarios!I41", MOEDA, "Cenarios C"),
    ("Δ líquido Simples 2033", "=Cenarios!I41/Premissas!B4-1", PCT, "Cenarios C"),
    ("Zona Presumido 2033 (R$/mês)", "=Cenarios!G27", MOEDA, "Cenarios B"),
    ("Conflito Simples 2033 (R$/mês)", "=Sensibilidade!D23", MOEDA, "Sensibilidade B"),
    ("Crédito Simples 2033", "=Premissas!B9", PCT4, "Premissas"),
    ("Fator de insumos", "=Premissas!B15", "0.000000", "Premissas"),
]
for i, (rotulo, formula, fmt, onde) in enumerate(resumo, start=4):
    ws.cell(row=i, column=1, value=rotulo).font = TEXTO
    celula(ws, i, 2, formula, fmt, bold=True, destaque=True)
    ws.cell(row=i, column=3, value=onde).font = TEXTO_FRACO

ws["A16"] = (
    "Leitura: no regime regular com crédito integral, o bruto sobe e o líquido fica parado. "
    "No Simples, o bruto sobe menos e o líquido sobe porque o crédito é parcial. "
    "A zona do Presumido é o ganho que a reforma cria e que precisa ser negociado."
)
ws["A16"].font = TEXTO_FRACO
ws["A16"].alignment = Alignment(wrap_text=True, vertical="top")
ws.merge_cells("A16:C16")
ws.row_dimensions[16].height = 48
larguras(ws, {"A": 36, "B": 22, "C": 18})

# ---------------------------------------------------------------------------
# Premissas
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Premissas")
titulo(ws, "Premissas — edite apenas as células amarelas", 6)
secao(ws, 3, "Entradas", 6)

entradas = [
    (4, "Frete mensal base (R$)", 100000.0, MOEDA),
    (5, "Volume de referência (CT-e/mês)", 100, NUM),
    (6, "Carga 2025 (% do frete)", 0.1625, PCT),
    (7, "Carga 2033 (% do frete)", 0.27, PCT),
    (8, "Crédito regular 2033 (% do frete)", 0.27, PCT),
    (9, "Crédito Simples 2033 (% do frete)", 0.02385, PCT4),
    (10, "DAS Simples (% do frete)", 0.12, PCT),
    (11, "Insumos sujeitos a CBS/IBS (% do frete)", 0.60, PCT),
    (12, "Margem do transportador (% do frete)", 0.08, PCT),
    (13, "DAS residual do híbrido (% do frete)", 0.00, PCT),
    (14, "Tolerância de desvio", 0.015, PCT),
]
for linha, rotulo, valor, fmt in entradas:
    ws.cell(row=linha, column=1, value=rotulo).font = TEXTO
    celula(ws, linha, 2, valor, fmt, input_=True)

ws["A15"] = "Fator de preço dos insumos (calculado)"
ws["A15"].font = TEXTO
celula(ws, 15, 2, "=(1-B6)/(1-B7)", "0.000000", bold=True)
ws["A16"] = "Crédito do pagador Lucro Presumido em 2025"
ws["A16"].font = TEXTO
celula(ws, 16, 2, 0.07, PCT, input_=True)

secao(ws, 18, "Série de cargas e fatores (fonte: projeção oficial do motor, SP → BA)", 6)
cabecalho(ws, 19, ["Ano", "Carga", "Fator de repasse", "Crédito regular", "Crédito Presumido"])
cargas = [
    (2025, 0.1625),
    (2026, 0.1625),
    (2027, 0.1550),
    (2028, 0.1550),
    (2029, 0.1665),
    (2030, 0.1780),
    (2031, 0.1895),
    (2032, 0.2010),
    (2033, 0.2700),
]
for i, (ano, carga) in enumerate(cargas, start=20):
    celula(ws, i, 1, ano, "0", bold=True)
    celula(ws, i, 2, carga, PCT, input_=True)
    if ano == 2025:
        celula(ws, i, 3, 1, "0.000000")
    else:
        celula(ws, i, 3, f"=(1-$B$6)/(1-B{i})", "0.000000")
    celula(ws, i, 4, f"=B{i}", PCT)
    if ano <= 2026:
        celula(ws, i, 5, "=$B$16", PCT)
    else:
        celula(ws, i, 5, f"=B{i}", PCT)

larguras(ws, {"A": 44, "B": 18, "C": 18, "D": 18, "E": 18})
ws.freeze_panes = "A4"

# ---------------------------------------------------------------------------
# Cenarios
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Cenarios")
titulo(ws, "Cenários — bruto, crédito e líquido", 11)

secao(ws, 3, "A. Regime regular — pagador Lucro Real (crédito integral)", 11)
cabecalho(ws, 5, ["Ano", "Carga", "Fator", "Bruto", "Crédito", "Líquido", "Bruto anual", "Líquido anual"])
for i in range(9):
    linha = 6 + i
    premissa = 20 + i
    celula(ws, linha, 1, f"=Premissas!A{premissa}", "0", bold=True)
    celula(ws, linha, 2, f"=Premissas!B{premissa}", PCT)
    celula(ws, linha, 3, f"=Premissas!C{premissa}", "0.000000")
    celula(ws, linha, 4, f"=Premissas!$B$4*C{linha}", MOEDA)
    celula(ws, linha, 5, f"=D{linha}*B{linha}", MOEDA)
    celula(ws, linha, 6, f"=D{linha}-E{linha}", MOEDA, destaque=True)
    celula(ws, linha, 7, f"=D{linha}*12", MOEDA)
    celula(ws, linha, 8, f"=F{linha}*12", MOEDA)

secao(ws, 16, "B. Regime regular — pagador Lucro Presumido", 11)
cabecalho(ws, 18, ["Ano", "Carga", "Crédito", "P_N (neutro p/ transportador)", "Líquido em P_N", "P_C (neutro p/ pagador)", "Zona P_C - P_N"])
for i in range(9):
    linha = 19 + i
    premissa = 20 + i
    celula(ws, linha, 1, f"=Premissas!A{premissa}", "0", bold=True)
    celula(ws, linha, 2, f"=Premissas!B{premissa}", PCT)
    celula(ws, linha, 3, f"=Premissas!E{premissa}", PCT)
    celula(ws, linha, 4, f"=Premissas!$B$4*(1-Premissas!$B$6)/(1-B{linha})", MOEDA)
    celula(ws, linha, 5, f"=D{linha}*(1-C{linha})", MOEDA)
    celula(ws, linha, 6, f"=Premissas!$B$4*(1-Premissas!$B$16)/(1-C{linha})", MOEDA)
    celula(ws, linha, 7, f"=F{linha}-D{linha}", MOEDA, bold=True)

secao(ws, 30, "C. Simples/DAS — repasse de margem", 11)
cabecalho(ws, 32, ["Ano", "Carga", "Fator", "Bruto", "DAS", "Custos", "Margem", "Crédito", "Líquido", "Bruto anual", "Líquido anual"])
for i in range(9):
    linha = 33 + i
    premissa = 20 + i
    celula(ws, linha, 1, f"=Premissas!A{premissa}", "0", bold=True)
    celula(ws, linha, 2, f"=Premissas!B{premissa}", PCT)
    celula(ws, linha, 3, f"=Premissas!C{premissa}", "0.000000")
    # required = insumos*f + outros + margem; outros = 1 - insumos - DAS - margem
    celula(
        ws,
        linha,
        4,
        f"=(Premissas!$B$11*C{linha}+(1-Premissas!$B$11-Premissas!$B$10-Premissas!$B$12)+Premissas!$B$12)/(1-Premissas!$B$10)*Premissas!$B$4",
        MOEDA,
    )
    celula(ws, linha, 5, f"=D{linha}*Premissas!$B$10", MOEDA)
    celula(ws, linha, 7, "=Premissas!$B$12*Premissas!$B$4", MOEDA)
    celula(ws, linha, 6, f"=D{linha}-E{linha}-G{linha}", MOEDA)
    if i <= 1:
        celula(ws, linha, 8, 0, MOEDA)
    else:
        celula(ws, linha, 8, f"=D{linha}*Premissas!$B$9", MOEDA)
    celula(ws, linha, 9, f"=D{linha}-H{linha}", MOEDA, destaque=True)
    celula(ws, linha, 10, f"=D{linha}*12", MOEDA)
    celula(ws, linha, 11, f"=I{linha}*12", MOEDA)

secao(ws, 44, "D. Híbrido — DAS residual", 11)
cabecalho(ws, 46, ["DAS residual", "P_N", "Líquido em P_N", "P_C", "Zona"])
for i, residual in enumerate([0.0, 0.05, 0.08], start=47):
    celula(ws, i, 1, residual, PCT, input_=True)
    celula(ws, i, 2, f"=Premissas!$B$4*(1-Premissas!$B$10)/(1-Premissas!$B$8-A{i})", MOEDA)
    celula(ws, i, 3, f"=B{i}*(1-Premissas!$B$8)", MOEDA)
    celula(ws, i, 4, f"=Premissas!$B$4/(1-Premissas!$B$8)", MOEDA)
    celula(ws, i, 5, f"=D{i}-B{i}", MOEDA, bold=True)

larguras(ws, {"A": 10, "B": 16, "C": 16, "D": 22, "E": 20, "F": 20, "G": 18, "H": 16, "I": 18, "J": 18, "K": 18})
ws.freeze_panes = "A6"

# ---------------------------------------------------------------------------
# Sensibilidade
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Sensibilidade")
titulo(ws, "Sensibilidade — Simples/DAS", 8)
secao(ws, 3, "A. Insumos x DAS (bruto e líquido do pagador com crédito de 2,385%)", 8)
cabecalho(ws, 5, ["Insumos", "DAS", "Bruto", "Δ bruto", "Líquido", "Δ líquido"])
linha = 6
for s in [0.40, 0.50, 0.60, 0.70]:
    for d in [0.10, 0.12, 0.14]:
        celula(ws, linha, 1, s, PCT)
        celula(ws, linha, 2, d, PCT)
        celula(
            ws,
            linha,
            3,
            f"=(A{linha}*Premissas!$B$15+(1-A{linha}-Premissas!$B$10-Premissas!$B$12)+Premissas!$B$12)/(1-B{linha})*Premissas!$B$4",
            MOEDA,
        )
        celula(ws, linha, 4, f"=C{linha}/Premissas!$B$4-1", PCT)
        celula(ws, linha, 5, f"=C{linha}*(1-Premissas!$B$9)", MOEDA)
        celula(ws, linha, 6, f"=E{linha}/Premissas!$B$4-1", PCT)
        linha += 1

secao(ws, 20, "B. Crédito x conflito (2033, Simples com DAS 12% e insumos 60%)", 8)
cabecalho(ws, 22, ["Crédito", "P_C", "P_N", "Gap (P_N - P_C)", "Líquido em P_N"])
for i, credito in enumerate([0.02385, 0.04, 0.08, 0.12, 0.14], start=23):
    celula(ws, i, 1, credito, PCT4, input_=True)
    celula(ws, i, 2, f"=Premissas!$B$4/(1-A{i})", MOEDA)
    celula(ws, i, 3, "=Cenarios!D41", MOEDA)
    celula(ws, i, 4, f"=C{i}-B{i}", MOEDA, bold=True)
    celula(ws, i, 5, f"=C{i}*(1-A{i})", MOEDA)

larguras(ws, {"A": 14, "B": 14, "C": 18, "D": 18, "E": 18, "F": 16})

# ---------------------------------------------------------------------------
# Contrato
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Contrato")
titulo(ws, "Contrato — volume variável e true-up", 9)
secao(ws, 3, "Volumes do trimestre", 9)
ws["A4"] = "Janeiro"
ws["B4"] = 80
ws["A5"] = "Fevereiro"
ws["B5"] = 120
ws["A6"] = "Março"
ws["B6"] = 100
for linha in range(4, 7):
    ws.cell(row=linha, column=1).font = TEXTO
    celula(ws, linha, 2, ws.cell(row=linha, column=2).value, "0", input_=True)

secao(ws, 8, "Faturamento por CT-e (fator de 2033)", 9)
cabecalho(ws, 10, ["Mês", "CT-e", "Preço unit. regular", "Fator", "Bruto regular", "Crédito", "Líquido regular", "Bruto Simples", "Líquido Simples"])
for i, linha in enumerate([11, 12, 13]):
    origem = 4 + i
    celula(ws, linha, 1, f"=A{origem}", None, bold=True)
    celula(ws, linha, 2, f"=B{origem}", "0")
    celula(ws, linha, 3, "=Premissas!$B$4/Premissas!$B$5", MOEDA)
    celula(ws, linha, 4, "=Premissas!$B$15", "0.000000")
    celula(ws, linha, 5, f"=B{linha}*C{linha}*D{linha}", MOEDA)
    celula(ws, linha, 6, f"=E{linha}*Premissas!$B$8", MOEDA)
    celula(ws, linha, 7, f"=E{linha}-F{linha}", MOEDA, destaque=True)
    celula(ws, linha, 8, f"=B{linha}*(Cenarios!D41/Premissas!$B$5)", MOEDA)
    celula(ws, linha, 9, f"=H{linha}*(1-Premissas!$B$9)", MOEDA)

celula(ws, 14, 1, "Total", bold=True)
celula(ws, 14, 2, "=SUM(B11:B13)", "0", bold=True)
celula(ws, 14, 5, "=SUM(E11:E13)", MOEDA, bold=True)
celula(ws, 14, 6, "=SUM(F11:F13)", MOEDA, bold=True)
celula(ws, 14, 7, "=SUM(G11:G13)", MOEDA, bold=True)
celula(ws, 14, 8, "=SUM(H11:H13)", MOEDA, bold=True)
celula(ws, 14, 9, "=SUM(I11:I13)", MOEDA, bold=True)

secao(ws, 16, "True-up do trimestre", 9)
ws["A17"] = "Alíquota real do período"
ws["A17"].font = TEXTO
celula(ws, 17, 2, 0.275, PCT, input_=True)
ws["A18"] = "Alíquota de referência"
ws["A18"].font = TEXTO
celula(ws, 18, 2, "=Premissas!$B$8", PCT)
ws["A19"] = "Diferença de crédito sobre o bruto regular"
ws["A19"].font = TEXTO
celula(ws, 19, 2, "=E14*(B17-B18)", MOEDA, bold=True)
ws["A20"] = "Ajuste no mês seguinte (positivo = pagar; negativo = creditar)"
ws["A20"].font = TEXTO
celula(ws, 20, 2, "=B19", MOEDA, bold=True)
ws["A22"] = (
    "O true-up compara o tributo real com o fator aplicado. Se o transportador mudar de regime "
    "ou a alíquota mudar no meio do ano, a diferença é apurada e acertada no mês seguinte."
)
ws["A22"].font = TEXTO_FRACO
ws.merge_cells("A22:I22")
ws["A22"].alignment = Alignment(wrap_text=True, vertical="top")

larguras(ws, {"A": 24, "B": 10, "C": 18, "D": 14, "E": 16, "F": 14, "G": 18, "H": 18, "I": 18})

# ---------------------------------------------------------------------------
# Fontes
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Fontes")
titulo(ws, "Fontes e premissas", 6)
fontes = [
    ("LC 214/2025", "CBS/IBS, crédito, transição, split payment; arts. 12, 18, 31–35, 41, 47, 169, 347, 348, 349, 501."),
    ("EC 132/2023", "Reforma tributária do consumo; ADCT arts. 125–129."),
    ("Motor oficial", "calculadora-rtc-regime-regular (fork local, base V0073); POST /api/calculadora/frete/projecao."),
    ("Documentação interna", "docs/frete.md; docs/especialista-fiscal/exemplo-execucao.md; app/README.md; ARCHITECTURE.md."),
    ("Código do repasse", "app/pagador.js — fatorRepasse e construirHorizonte."),
]
ws["A3"] = "Fonte"
ws["B3"] = "Uso"
ws["A3"].font = SUBTITULO
ws["B3"].font = SUBTITULO
for i, (fonte, uso) in enumerate(fontes, start=4):
    ws.cell(row=i, column=1, value=fonte).font = TEXTO
    ws.cell(row=i, column=2, value=uso).font = TEXTO
    ws.cell(row=i, column=2).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[i].height = 32
larguras(ws, {"A": 28, "B": 90})

# ---------------------------------------------------------------------------
# Acabamento
# ---------------------------------------------------------------------------
for sheet in wb.worksheets:
    sheet.sheet_view.showGridLines = False
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.sheet_properties.pageSetUpPr.fitToPage = True

wb.calculation.fullCalcOnLoad = True
wb.save(DESTINO)
print(f"Gerado: {DESTINO}")
