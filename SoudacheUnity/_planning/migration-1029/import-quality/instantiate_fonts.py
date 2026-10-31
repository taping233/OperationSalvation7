"""Bake the existing OFL variable Noto font at the source UI's 400/700 weights."""
from pathlib import Path
import hashlib
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "static-fonts"
OUT.mkdir(parents=True, exist_ok=True)
source = ROOT / "Assets/Resources/Fonts/NotoSansSC-Regular.ttf"
original = OUT / "original-variable.ttf"
if not original.exists():
    original.write_bytes(source.read_bytes())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

results = []
for name, weight in [("NotoSansSC-Regular.ttf", 400), ("NotoSansSC-Bold.ttf", 700)]:
    target = OUT / name
    font = TTFont(str(original))
    before = font.getBestCmap()
    static = instantiateVariableFont(font, {"wght": weight}, inplace=True, optimize=True, updateFontNames=True)
    static.save(str(target))
    checked = TTFont(str(target))
    if "fvar" in checked or checked["OS/2"].usWeightClass != weight or checked.getBestCmap() != before:
        raise RuntimeError("Font instance validation failed: " + name)
    results.append({"file": name, "weight": weight, "source": str(original.relative_to(ROOT)),
                    "sourceSha256": sha(original), "sha256": sha(target), "glyphs": len(checked.getGlyphOrder()),
                    "codepoints": len(before), "variable": False, "output": str(target.relative_to(ROOT))})
    print(name + ": static weight=" + str(weight) + ", codepoints=" + str(len(before)), flush=True)
(OUT / "receipt.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print("Prepared only; Assets fonts are unchanged until the parent applies both files.")
