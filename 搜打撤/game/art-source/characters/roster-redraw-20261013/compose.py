"""Copy generated portrait candidates and add white 16:9 side panels."""

from pathlib import Path
from shutil import copy2
from PIL import Image


GENERATED = Path(r"C:\Users\太平\.codex\generated_images\01a13563-8acc-7091-ba24-abfe47ed25cf")
HERE = Path(__file__).absolute().parent
SOURCES = {
    "changwuyu": "exec-7fc3a260-6522-41d9-8e22-9858bbc83fc0.png",
    "heixiang": "exec-190a7419-a39e-4c6c-a581-5f67a32eab0e.png",
    "xingyue": "exec-4a37f1e9-4edd-4a28-9d74-0aac335cc4df.png",
    "baita": "exec-ce94123d-68fc-4e67-b626-1720a9115e97.png",
}
WIDE_SIZE = (3072, 1728)


def main():
    for name, filename in SOURCES.items():
        vertical_png = HERE / f"{name}-vertical.png"
        vertical_webp = HERE / f"{name}-vertical.webp"
        if not vertical_png.exists() and not vertical_webp.exists():
            copy2(GENERATED / filename, vertical_png)
        source = vertical_png if vertical_png.exists() else vertical_webp
        with Image.open(source) as original:
            portrait = original.convert("RGB")
            if portrait.size != (1024, 1536):
                raise ValueError(f"Unexpected source dimensions: {name}: {portrait.size}")
            if source != vertical_webp:
                portrait.save(vertical_webp, "WEBP", quality=96, method=6)
            scaled = portrait.resize((1152, 1728), Image.Resampling.LANCZOS)
            wide = Image.new("RGB", WIDE_SIZE, "white")
            wide.paste(scaled, (960, 0))
            wide.save(HERE / f"{name}-wide-white.webp", "WEBP", quality=96, method=6)
            print(f"{name}: vertical {portrait.size}, wide {wide.size}, side margins 960px")


if __name__ == "__main__":
    main()
