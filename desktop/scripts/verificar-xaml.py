"""Checagens estáticas do projeto desktop, sem precisar do SDK do .NET.

1. Todos os .axaml são XML bem formado.
2. Todo {StaticResource X} existe em algum .axaml de tema.
3. Todo caminho em {Binding ...} existe no tipo declarado em x:DataType.
4. Chaves e parênteses balanceados nos arquivos .cs.

Uso: python desktop/scripts/verificar-xaml.py
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"

ERROS: list[str] = []
AVISOS: list[str] = []


def arquivos(padrao: str) -> list[Path]:
    return sorted(SRC.rglob(padrao))


# --------------------------------------------------------------------- C#

RE_RECORD = re.compile(r"public\s+(?:sealed\s+)?record\s+(\w+)\s*\(", re.MULTILINE)
RE_CLASSE = re.compile(r"public\s+(?:sealed\s+|abstract\s+|static\s+|partial\s+)*class\s+(\w+)")
RE_PROP = re.compile(
    r"public\s+(?:static\s+|readonly\s+|override\s+|virtual\s+|new\s+|required\s+)*"
    r"([A-Za-z_][\w\.<>\[\]\?,\s]*?)\s+([A-Za-z_]\w*)\s*(?:\{|=>|;)",
    re.MULTILINE,
)


def dividir_parametros(corpo: str) -> list[str]:
    """Divide a lista de parâmetros de um record respeitando <> e () aninhados."""
    partes: list[str] = []
    atual: list[str] = []
    profundidade = 0
    for caractere in corpo:
        if caractere in "<([":
            profundidade += 1
        elif caractere in ">)]":
            profundidade -= 1
        if caractere == "," and profundidade == 0:
            partes.append("".join(atual))
            atual = []
            continue
        atual.append(caractere)
    if atual:
        partes.append("".join(atual))
    return [p.strip() for p in partes if p.strip()]


def nome_do_parametro(declaracao: str) -> str | None:
    """'string? Nota = null' -> 'Nota'."""
    sem_padrao = declaracao.split("=")[0].strip()
    casamento = re.match(r"^[\w\.<>\[\]\?, ]*?\b([A-Za-z_]\w*)$", sem_padrao)
    return casamento.group(1) if casamento else None


def membros_das_classes() -> tuple[dict[str, set[str]], dict[tuple[str, str], str]]:
    membros: dict[str, set[str]] = {}
    tipos: dict[tuple[str, str], str] = {}

    for arquivo in arquivos("*.cs"):
        texto = arquivo.read_text(encoding="utf-8")

        for nome, corpo in re.findall(
            r"public\s+(?:sealed\s+)?record\s+(\w+)\s*\((.*?)\)\s*(?:\{|;|$)",
            texto,
            re.DOTALL,
        ):
            nomes: set[str] = set()
            for parametro in dividir_parametros(corpo):
                propriedade = nome_do_parametro(parametro)
                if not propriedade:
                    continue
                nomes.add(propriedade)
                tipo = parametro.split("=")[0].strip()
                tipo = tipo[: tipo.rfind(propriedade)].strip()
                tipos[(nome, propriedade)] = tipo
            # propriedades calculadas no corpo do record
            nomes |= set(re.findall(r"public\s+[\w<>\[\]\?]+\s+(\w+)\s*=>", texto))
            membros.setdefault(nome, set()).update(nomes)

        for nome in RE_CLASSE.findall(texto):
            inicio = texto.find(f"class {nome}")
            corpo = texto[inicio:]
            for tipo, propriedade in RE_PROP.findall(corpo):
                membros.setdefault(nome, set()).add(propriedade)
                tipos[(nome, propriedade)] = tipo.strip()
            membros.setdefault(nome, set()).update(
                re.findall(r"public\s+[\w<>\[\]\?,\s]+\s+(\w+)\s*=>", corpo)
            )

    return membros, tipos


def tipo_simples(tipo: str) -> str:
    """'IReadOnlyList<AnoReforma>?' -> 'AnoReforma' (só para o que usamos)."""
    limpo = tipo.replace("?", "").strip()
    if "<" in limpo and ">" in limpo:
        limpo = limpo[limpo.find("<") + 1 : limpo.rfind(">")]
    return limpo.split(".")[-1].strip()


def checar_cs() -> None:
    for arquivo in arquivos("*.cs"):
        texto = arquivo.read_text(encoding="utf-8")
        # remove strings e comentários para não contar chaves dentro deles
        sem_strings = re.sub(r'"(?:\\.|[^"\\])*"', '""', texto)
        sem_comentarios = re.sub(r"//[^\n]*|/\*.*?\*/", "", sem_strings, flags=re.DOTALL)
        for abre, fecha, rotulo in (("{", "}", "chaves"), ("(", ")", "parênteses")):
            if sem_comentarios.count(abre) != sem_comentarios.count(fecha):
                ERROS.append(
                    f"{arquivo.relative_to(RAIZ)}: {rotulo} desbalanceadas "
                    f"({sem_comentarios.count(abre)} x {sem_comentarios.count(fecha)})"
                )


# ------------------------------------------------------------------- XAML

XMLNS = "{http://www.w3.org/2000/xmlns/}"
X = "{http://schemas.microsoft.com/winfx/2006/xaml}"


def recursos_definidos() -> set[str]:
    definidos: set[str] = set()
    for arquivo in arquivos("*.axaml"):
        texto = arquivo.read_text(encoding="utf-8")
        definidos |= set(re.findall(r'x:Key="([^"]+)"', texto))
    return definidos


def resolver(tipo: str, membros: dict[str, set[str]]) -> set[str] | None:
    nome = tipo.split(":")[-1].strip()
    return membros.get(nome)


def checar_axaml(membros: dict[str, set[str]], tipos: dict[tuple[str, str], str]) -> None:
    recursos = recursos_definidos()

    for arquivo in arquivos("*.axaml"):
        try:
            arvore = ET.parse(arquivo)
        except ET.ParseError as erro:
            ERROS.append(f"{arquivo.relative_to(RAIZ)}: XML inválido — {erro}")
            continue

        texto = arquivo.read_text(encoding="utf-8")

        for chave in set(re.findall(r"\{(?:Static|Dynamic)Resource\s+([\w\.]+)\}", texto)):
            if chave not in recursos:
                ERROS.append(f"{arquivo.name}: StaticResource '{chave}' não existe")

        pais = {filho: pai for pai in arvore.iter() for filho in pai}

        def tipo_do_contexto(elemento) -> str | None:
            atual = elemento
            while atual is not None:
                valor = atual.get(X + "DataType") or atual.get("DataType")
                if valor:
                    return valor
                valor = atual.get("x:DataType")
                if valor:
                    return valor
                atual = pais.get(atual)
            return None

        for elemento in arvore.iter():
            for nome_atributo, valor in elemento.attrib.items():
                if not isinstance(valor, str) or "{Binding" not in valor:
                    continue

                for bruto in re.findall(r"\{Binding([^}]*)\}", valor):
                    caminho = bruto.split(",")[0].strip()
                    if not caminho or caminho.startswith("$") or caminho.startswith("!"):
                        continue

                    tipo = tipo_do_contexto(elemento)
                    if not tipo:
                        tag = elemento.tag.split("}")[-1]
                        AVISOS.append(
                            f"{arquivo.name}: binding '{caminho}' sem x:DataType (<{tag}>)"
                        )
                        continue

                    conhecidos = resolver(tipo, membros)
                    if conhecidos is None:
                        AVISOS.append(f"{arquivo.name}: tipo '{tipo}' não mapeado")
                        continue

                    atual = tipo.split(":")[-1].strip()
                    for indice, segmento in enumerate(caminho.split(".")):
                        conjunto = membros.get(atual)
                        if conjunto is None:
                            break
                        if segmento not in conjunto:
                            ERROS.append(
                                f"{arquivo.name}: binding '{caminho}' — '{segmento}' "
                                f"não existe em {atual}"
                            )
                            break
                        if indice < len(caminho.split(".")) - 1:
                            proximo = tipo_simples(tipos.get((atual, segmento), ""))
                            if not proximo or proximo not in membros:
                                break
                            atual = proximo


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    membros, tipos = membros_das_classes()
    checar_cs()
    checar_axaml(membros, tipos)

    print(f"Arquivos .axaml: {len(arquivos('*.axaml'))} | .cs: {len(arquivos('*.cs'))}")
    print(f"Tipos mapeados: {len(membros)}")

    if AVISOS:
        print(f"\n{len(AVISOS)} aviso(s):")
        for aviso in AVISOS[:20]:
            print("  ~", aviso)

    if ERROS:
        print(f"\n{len(ERROS)} erro(s):")
        for erro in ERROS:
            print("  x", erro)
        return 1

    print("\nOK: XML válido, recursos resolvidos e bindings conhecidos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
