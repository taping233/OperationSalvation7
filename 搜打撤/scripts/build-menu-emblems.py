"""Turn generated menu-emblem PNGs into compact, self-contained SVG assets."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "prototypes" / "map-system" / "assets" / "winter-ui" / "menu-emblems" / "source"
OUTPUT = SOURCE.parent
EMBLEMS = {
    "prebattle-snow": "战前准备 · 雪花星盘",
    "card-library-squirrel": "卡牌库 · 枯枝松鼠",
    "card-designer-rose": "卡牌制作 · 玫瑰工坊",
    "exit-black-sword": "退出游戏 · 黑色长剑",
    "start-hotpot": "开始探索 · 双味火锅",
}


def remove_white_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    red, green, blue, source_alpha = image.split()
    distance = ImageChops.lighter(ImageChops.invert(red), ImageChops.invert(green))
    distance = ImageChops.lighter(distance, ImageChops.invert(blue))
    matte_alpha = distance.point(lambda value: 0 if value < 5 else min(255, (value - 5) * 6))
    image.putalpha(ImageChops.multiply(source_alpha, matte_alpha))
    return image


def build(name: str, title: str) -> None:
    with Image.open(SOURCE / f"{name}.png") as source:
        image = remove_white_background(source)
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            raise RuntimeError(f"{name}.png contains no visible emblem")
        image = image.crop(bounds)
        padding = max(12, round(max(image.size) * 0.035))
        framed = Image.new("RGBA", (image.width + padding * 2, image.height + padding * 2))
        framed.alpha_composite(image, (padding, padding))
        framed.thumbnail((360, 360), Image.Resampling.LANCZOS)

        encoded = BytesIO()
        framed.save(encoded, "WEBP", quality=86, method=6, exact=True)
        payload = b64encode(encoded.getvalue()).decode("ascii")
        width, height = framed.size

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img">\n'
        f'  <title>{title}</title>\n'
        f'  <image width="{width}" height="{height}" href="data:image/webp;base64,{payload}" />\n'
        f'</svg>\n'
    )
    (OUTPUT / f"{name}.svg").write_text(svg, encoding="utf-8")


for emblem_name, emblem_title in EMBLEMS.items():
    build(emblem_name, emblem_title)
