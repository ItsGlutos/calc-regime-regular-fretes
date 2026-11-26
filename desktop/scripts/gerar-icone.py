"""Gera o ícone do app desktop (ICO multirresolução + PNG de documentação)."""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO_ASSETS = os.path.join(RAIZ, "src", "FreteLiquido.Desktop", "Assets")
DESTINO_DOCS = os.path.join(RAIZ, "docs")

OLIVA = (77, 92, 54)
OLIVA_CLARO = (180, 194, 147)
NAVY = (15, 23, 42)
NAVY_2 = (28, 41, 66)

TAMANHO = 1024
ESCALA = TAMANHO / 32.0


def ponto(x: float, y: float) -> tuple[float, float]:
    return (x * ESCALA, y * ESCALA)


def desenhar() -> Image.Image:
    base = Image.new("RGBA", (TAMANHO, TAMANHO), (0, 0, 0, 0))

    # Fundo: gradiente vertical suave entre dois navys.
    gradiente = Image.new("RGBA", (TAMANHO, TAMANHO))
    for y in range(TAMANHO):
        t = y / (TAMANHO - 1)
        cor = tuple(int(NAVY[i] + (NAVY_2[i] - NAVY[i]) * t) for i in range(3)) + (255,)
        ImageDraw.Draw(gradiente).line([(0, y), (TAMANHO, y)], fill=cor)

    mascara = Image.new("L", (TAMANHO, TAMANHO), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [0, 0, TAMANHO - 1, TAMANHO - 1], radius=int(9 * ESCALA), fill=255
    )
    base.paste(gradiente, (0, 0), mascara)

    desenho = ImageDraw.Draw(base)


    espessura = int(1.9 * ESCALA)

    # Rota: linha horizontal + seta.
    desenho.line([ponto(7.5, 16), ponto(21.2, 16)], fill=(255, 255, 255, 255), width=espessura)
    desenho.line(
        [ponto(15, 9.5), ponto(21.5, 16), ponto(15, 22.5)],
        fill=(255, 255, 255, 255),
        width=espessura,
        joint="curve",
    )
    # Pontos arredondados nas extremidades.
    for (x, y) in (ponto(7.5, 16), ponto(21.2, 16), ponto(15, 9.5), ponto(15, 22.5)):
        r = espessura / 2
        desenho.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))

    # Crédito: círculo oliva no canto superior direito.
    cx, cy = ponto(24.6, 8.8)
    raio = 2.35 * ESCALA
    desenho.ellipse(
        [cx - raio, cy - raio, cx + raio, cy + raio],
        outline=OLIVA_CLARO + (255,),
        width=int(1.35 * ESCALA),
    )
    return base


def main() -> None:
    os.makedirs(DESTINO_ASSETS, exist_ok=True)
    os.makedirs(DESTINO_DOCS, exist_ok=True)

    arte = desenhar()
    ico = os.path.join(DESTINO_ASSETS, "frete-liquido.ico")
    arte.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    png = os.path.join(DESTINO_DOCS, "icone.png")
    arte.resize((512, 512), Image.LANCZOS).save(png)

    print(f"ico  -> {ico} ({os.path.getsize(ico)} bytes)")
    print(f"png  -> {png}")


if __name__ == "__main__":
    main()
