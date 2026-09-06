"""Bake the large winter SVG ornaments into small transparent UI WebPs."""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "game" / "assets" / "winter-ui"
OUTPUT = SOURCE / "raster"
ICONS = (
    "snowflakes",
    "squirrel-branch",
    "winter-rose",
    "black-longsword",
    "winter-hotpot",
)


def rasterize(name: str) -> None:
    png = cairosvg.svg2png(url=str(SOURCE / f"{name}.svg"), output_width=1200)
    with Image.open(BytesIO(png)).convert("RGBA") as image:
        alpha_box = image.getchannel("A").getbbox()
        if not alpha_box:
            raise RuntimeError(f"{name}.svg rendered without visible pixels")
        image = image.crop(alpha_box)
        padding = max(8, round(max(image.size) * 0.035))
        framed = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
        framed.alpha_composite(image, (padding, padding))
        framed.thumbnail((360, 220), Image.Resampling.LANCZOS)
        framed.save(OUTPUT / f"{name}.webp", "WEBP", lossless=True, method=6)


OUTPUT.mkdir(parents=True, exist_ok=True)
for icon in ICONS:
    rasterize(icon)
