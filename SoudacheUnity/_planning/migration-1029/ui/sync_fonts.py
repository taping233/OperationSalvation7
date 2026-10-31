"""Restore current source fonts: decode WOFF2 and copy unmodified HarmonyOS TTF."""
import argparse
import json
import shutil
from pathlib import Path
from fontTools.ttLib import TTFont
import sync_assets

destination = sync_assets.RESOURCES / "Fonts"
woff_names = ["notosans-sc-400", "notosans-sc-700", "oxanium-latin-500-normal", "oxanium-latin-700-normal",
              "rajdhani-latin-600-normal", "rajdhani-latin-700-normal", "cascadia-code-400", "cascadia-code-700"]
harmony_files = ["HarmonyOS_Sans_SC_Regular.ttf", "HarmonyOS_Sans_SC_Bold.ttf"]
license_files = ["LICENSE-HarmonyOS-Sans.txt", "LICENSE-Oxanium-OFL.txt", "LICENSE-Rajdhani-OFL.txt"]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check-sources", action="store_true", help="Check source presence/SHA without writing any output.")
args = parser.parse_args()
if args.check_sources:
    receipt = Path(__file__).with_name("fonts-receipt.json")
    prior = json.loads(receipt.read_text(encoding="utf-8-sig")) if receipt.exists() else []
    expected = {row["source"]: row["sourceSha256"] for row in prior}
    sources = []
    for name in [item + ".woff2" for item in woff_names] + harmony_files + license_files:
        source = sync_assets.ASSETS / "fonts" / name
        relative = source.relative_to(sync_assets.GAME).as_posix()
        actual = sync_assets.sha(source)
        if relative in expected and actual != expected[relative]:
            raise ValueError("Source font changed since its receipt: " + relative)
        sources.append({"source": relative, "sha256": actual})
    print(json.dumps({"passed": True, "sourceFiles": sources, "writes": False}))
    raise SystemExit(0)

destination.mkdir(parents=True, exist_ok=True)
records = []
for name in woff_names:
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
for name in harmony_files:
    source, target = sync_assets.ASSETS / "fonts" / name, destination / name
    shutil.copyfile(source, target)
    source_sha, output_sha = sync_assets.sha(source), sync_assets.sha(target)
    if source_sha != output_sha:
        raise ValueError("Unmodified source font copy mismatch: " + name)
    font = TTFont(target)
    records.append({"source": source.relative_to(sync_assets.GAME).as_posix(), "sourceSha256": source_sha,
                    "destination": target.relative_to(sync_assets.PROJECT).as_posix(), "outputSha256": output_sha,
                    "weight": font["OS/2"].usWeightClass, "codepoints": len(font.getBestCmap()),
                    "glyphMetricsUnchanged": True, "conversion": "Unmodified source TTF copied byte for byte"})
for license_file in license_files:
    shutil.copyfile(sync_assets.ASSETS / "fonts" / license_file, destination / license_file)
sync_assets.write_text(Path(__file__).with_name("fonts-receipt.json"), json.dumps(records,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"passed": True, "currentFonts": len(records), "glyphMetricsUnchanged": True}))
