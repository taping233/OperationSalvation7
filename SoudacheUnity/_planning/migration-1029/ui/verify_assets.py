"""Verify shipped Resources against the source receipts and representative decoded pixels."""
import hashlib
import json
import re
from pathlib import Path

from PIL import Image
import sync_assets

PROJECT = sync_assets.PROJECT
RESOURCES = sync_assets.RESOURCES
receipt = json.loads(sync_assets.REPORT.read_text(encoding="utf-8"))
failures = []
for entry in receipt["files"]:
    for path, expected in [(sync_assets.ASSETS / entry["source"], entry["sourceSha256"]),
                           (RESOURCES / entry["destination"], entry["outputSha256"])]:
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            failures.append("hash mismatch: " + str(path))

source = (PROJECT / "Assets/Scripts/Sdt.Res/CurrentAssets.cs").read_text(encoding="utf-8")
maps = {}
for match in re.finditer(r'IReadOnlyDictionary<string, string> (\w+) = new Dictionary<string, string>\s*\{(.*?)\n        \};', source, re.S):
    pairs = re.findall(r'\{ ("(?:[^"\\]|\\.)*"), ("(?:[^"\\]|\\.)*") \}', match[2])
    maps[match[1]] = {json.loads(key): json.loads(value) for key, value in pairs}
for name, entries in maps.items():
    if name == "CharacterIds":
        continue
    for key, resource in entries.items():
        matches = [RESOURCES / (resource + ext) for ext in [".png", ".ogg", ".wav", ".mp3"]]
        if not any(path.is_file() for path in matches):
            failures.append("unresolved Resources reference: " + name + "/" + key)

pixel_sources = [entry for entry in receipt["files"] if entry["source"].startswith("portraits/full/")
                 or entry["source"].startswith(("scenes/map-nodes/", "scenes/map-environment-1021/", "ui/home-nodes-1015/", "ui/map-hud-1015/"))
                 or "/platform-minimal-1016/" in entry["source"]
                 or entry["source"] in ["cards/wu-heavensword.webp", "cards/bound-shadow.webp", "scenes/courtyard-pond-v4.webp"]]
for entry in pixel_sources:
    with Image.open(sync_assets.ASSETS / entry["source"]) as original, Image.open(RESOURCES / entry["destination"]) as imported:
        if original.convert("RGBA").tobytes() != imported.convert("RGBA").tobytes():
            failures.append("decoded pixels changed: " + entry["source"])

catalog = json.loads((PROJECT / "_planning/migration-1029/battle/current-catalog.json").read_text(encoding="utf-8"))
current_ids = {card["id"] for card in catalog["cards"]}
missing_source_ids = [Path(path).stem.split("-", 1)[1] for path in receipt["missingSourceImages"]]
result = {"ok": not failures, "sourceAndOutputHashes": len(receipt["files"]),
          "resourceMappings": sum(len(values) for name, values in maps.items() if name != "CharacterIds"),
          "pixelIdenticalImages": len(pixel_sources), "currentCards": len(current_ids),
          "missingSourceImages": receipt["missingSourceImages"],
          "missingSourceImagesUsedByCurrentCards": [key for key in missing_source_ids if key in current_ids],
          "failures": failures}
Path(__file__).with_name("assets-verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=True))
raise SystemExit(0 if result["ok"] else 1)
