"""Decode the current WOFF2 faces to native TTF without changing glyphs or metrics."""
import json
import shutil
from pathlib import Path
from fontTools.ttLib import TTFont
import sync_assets

destination = sync_assets.RESOURCES / "Fonts"
records = []
for name in ["notosans-sc-400", "notosans-sc-700", "oxanium-latin-500-normal", "oxanium-latin-700-normal",
             "rajdhani-latin-600-normal", "rajdhani-latin-700-normal", "cascadia-code-400", "cascadia-code-700"]:
    source = sync_assets.ASSETS / "fonts" / (name + ".woff2")
    target = destination / (name + ".ttf")
    font = TTFont(source)
    cmap, metrics = font.getBestCmap(), dict(font["hmtx"].metrics)
    font.flavor = None
    font.save(target)
    decoded = TTFont(target)
    if decoded.getBestCmap() != cmap or dict(decoded["hmtx"].metrics) != metrics:
        raise ValueError("Font glyph or metric mismatch: " + name)
    records.append({"source": source.relative_to(sync_assets.GAME).as_posix(), "sourceSha256": sync_assets.sha(source),
                    "destination": target.relative_to(sync_assets.PROJECT).as_posix(), "outputSha256": sync_assets.sha(target),
                    "weight": decoded["OS/2"].usWeightClass, "codepoints": len(cmap), "glyphMetricsUnchanged": True})
for license_file in ["LICENSE-Oxanium-OFL.txt", "LICENSE-Rajdhani-OFL.txt"]:
    shutil.copyfile(sync_assets.ASSETS / "fonts" / license_file, destination / license_file)
sync_assets.write_text(Path(__file__).with_name("fonts-receipt.json"), json.dumps(records,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"passed": True, "currentFonts": len(records), "glyphMetricsUnchanged": True}))
