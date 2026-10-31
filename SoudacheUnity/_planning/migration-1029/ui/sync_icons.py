"""Import the current bitmap/semantic SVG registry; no glyph substitution or new artwork."""
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
import cairosvg
from PIL import Image
import sync_assets

PROJECT, GAME, ASSETS, RESOURCES = sync_assets.PROJECT, sync_assets.GAME, sync_assets.ASSETS, sync_assets.RESOURCES
source = (GAME / "src/core/icons-bitmap.js").read_text(encoding="utf-8")
semantic_source = (GAME / "src/core/semantic-icons.js").read_text(encoding="utf-8")
semantic = set(re.findall(r"'([a-z-]+)'", semantic_source.split(']);', 1)[0]))
names = set(re.search(r"const NAMES = new Set\('([^']+)'", source)[1].split()) | semantic
previous_path = Path(__file__).with_name("icons-receipt.json")
previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path.exists() else {"files": []}
old = {entry["key"]: entry for entry in previous["files"]}
paths, records, tintable = {}, [], []
for key in sorted(names):
    special = key in ("coin", "altar")
    relative = "ui/map-hud-1015/gold-is7-v2.webp" if key == "coin" else "scenes/map-nodes/altar-symbol-1017-v2.webp" if key == "altar" else "ui/semantic-icons/" + key + ".svg" if key in semantic else "ui/icons/" + key + ".png"
    src = ASSETS / relative
    if not src.is_file():
        raise FileNotFoundError("Current registered icon missing: " + relative)
    if src.suffix == ".svg" and "currentColor" in src.read_text(encoding="utf-8"):
        tintable.append(key)
    destination = Path("Art/Current/UiIcons") / (key + ".png")
    target = RESOURCES / destination
    source_hash = sync_assets.sha(src)
    prior = old.get(key, {})
    reuse = prior.get("sourceSha256") == source_hash and target.exists() and prior.get("outputSha256") == sync_assets.sha(target)
    if not reuse:
        target.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == ".svg":
            cairosvg.svg2png(url=str(src), write_to=str(target), output_width=128, output_height=128)
        elif special:
            with Image.open(src) as original:
                original.convert("RGBA").save(target, "PNG")
        else:
            shutil.copyfile(src, target)
    paths[key] = destination.with_suffix("").as_posix()
    records.append({"key": key, "source": relative, "sourceSha256": source_hash,
                    "destination": destination.as_posix(), "outputSha256": sync_assets.sha(target),
                    "conversion": "CairoSVG 128px raster of current SVG" if src.suffix == ".svg" else "original source pixels"})
emoji = {}
for match in re.finditer(r"add\('([^']+)',\[([^\]]+)\]\)", source):
    for value in match[2].split(','):
        emoji[chr(int(value.strip(), 16))] = match[1]

# The current base navigation owns a separate SVG family, including its leaf-shaped courtyard icon.
hub_source_path = GAME / "src/hub/hub.home-icons-v10.js"
hub_source = hub_source_path.read_text(encoding="utf-8")
hub_paths, hub_records = {}, []
for key, shape in re.findall(r"^\s{2}([a-z]+):'([^']+)'", hub_source, re.MULTILINE):
    destination = Path("Art/Current/HubIcons") / (key + ".png")
    target = RESOURCES / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path fill-rule="evenodd" d="' + shape + '"/></svg>'
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(target), output_width=128, output_height=128)
    hub_paths[key] = destination.with_suffix("").as_posix()
    hub_records.append({"key": key, "source": "src/hub/hub.home-icons-v10.js", "sourceSha256": sync_assets.sha(hub_source_path),
                        "pathSha256": hashlib.sha256(shape.encode("utf-8")).hexdigest(), "destination": destination.as_posix(), "outputSha256": sync_assets.sha(target)})
if len(hub_paths) != 8:
    raise ValueError("Current base navigation SVG family changed; review its mapping before importing")

facility_source = GAME / "src/hub/hub.visuals.js"
facility_script = """
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const text=readFileSync('src/hub/hub.visuals.js','utf8');
const code=text.slice(text.indexOf('export function facilityIllustration')).replace(/^export /,'');
const rows=vm.runInNewContext(code+'; Object.fromEntries([\"bag\",\"stash\"].map(id=>[id,facilityIllustration(id)]))');
console.log(JSON.stringify(rows));
"""
facility_result = subprocess.run(["node", "--input-type=module", "-e", facility_script], cwd=GAME,
                                 check=True, capture_output=True, encoding="utf-8")
for kind, source_svg in json.loads(facility_result.stdout).items():
    key = "facility-" + kind
    destination = Path("Art/Current/HubIcons") / (key + ".png")
    target = RESOURCES / destination
    svg = source_svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('currentColor', '#f2f5f0')
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(target), output_width=256, output_height=256)
    hub_paths[key] = destination.with_suffix("").as_posix()
    hub_records.append({"key": key, "source": "src/hub/hub.visuals.js", "sourceSha256": sync_assets.sha(facility_source),
                        "sourceSvgSha256": hashlib.sha256(source_svg.encode("utf-8")).hexdigest(),
                        "destination": destination.as_posix(), "outputSha256": sync_assets.sha(target)})
generated = "// Generated from current icons-bitmap.js / semantic-icons.js; do not replace with font glyphs.\nusing System.Collections.Generic;\nnamespace Sdt.Res\n{\n    public static class CurrentUiIcons\n    {\n"
generated += sync_assets.dictionary("Paths", paths)
generated += sync_assets.dictionary("Emoji", emoji)
generated += sync_assets.dictionary("HubPaths", hub_paths)
generated += "        public static readonly ISet<string> Tintable = new HashSet<string> { " + ", ".join(sync_assets.quote(key) for key in tintable) + " };\n"
generated += "    }\n}\n"
sync_assets.write_text(PROJECT / "Assets/Scripts/Sdt.Res/CurrentUiIcons.cs", generated)
sync_assets.write_text(previous_path, json.dumps({"files": records, "hubFiles": hub_records, "registeredIcons": len(paths), "emojiMappings": len(emoji)}, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"registeredIcons": len(paths), "semanticSvg": len(semantic), "emojiMappings": len(emoji), "files": len(records), "baseNavigationSvg": len(hub_paths)}))
