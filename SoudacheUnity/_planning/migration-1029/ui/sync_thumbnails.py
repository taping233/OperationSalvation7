"""Import the source photo thumbnails without touching current audio mappings."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image
import sync_assets

project, resources = sync_assets.PROJECT, sync_assets.RESOURCES
receipt = json.loads(sync_assets.REPORT.read_text(encoding="utf-8"))
reverse = {str(Path(row["destination"]).with_suffix("")).replace("\\", "/"): row["source"] for row in receipt["files"]}
source = (project / "Assets/Scripts/Sdt.Res/CurrentAssets.cs").read_text(encoding="utf-8")
section = re.search(r'CardIllustrations = new Dictionary<string, string>\s*\{(.*?)\n        \};', source, re.S)[1]
pairs = re.findall(r'\{ ("(?:[^"\\]|\\.)*"), ("(?:[^"\\]|\\.)*") \}', section)
paths, files = {}, []
for raw_id, raw_resource in pairs:
    card_id, original = json.loads(raw_id), reverse[json.loads(raw_resource)]
    relative = Path("thumbs") / Path(original).with_suffix(".webp")
    source_image = sync_assets.ASSETS / relative
    if not source_image.is_file():
        continue
    destination = Path("Art/Current") / relative.with_suffix(".png")
    output = resources / destination
    output.parent.mkdir(parents=True, exist_ok=True)
    if not output.exists() or source_image.stat().st_mtime > output.stat().st_mtime:
        with Image.open(source_image) as picture:
            picture.convert("RGBA" if "A" in picture.getbands() else "RGB").save(output, "PNG")
    paths[card_id] = destination.with_suffix("").as_posix()
    files.append({"source": relative.as_posix(), "destination": destination.as_posix(),
                  "sourceSha256": hashlib.sha256(source_image.read_bytes()).hexdigest(),
                  "outputSha256": hashlib.sha256(output.read_bytes()).hexdigest(), "bytes": output.stat().st_size})
code = "// Generated from existing Vite 448px thumbnails; does not affect audio.\nusing System.Collections.Generic;\nnamespace Sdt.Res\n{\n    public static class CurrentThumbnails\n    {\n"
code += sync_assets.dictionary("Paths", paths) + "    }\n}\n"
sync_assets.write_text(project / "Assets/Scripts/Sdt.Res/CurrentThumbnails.cs", code)
sync_assets.write_text(Path(__file__).with_name("thumbnails-receipt.json"), json.dumps({"count": len(paths), "files": files}, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"ok": True, "cardMappings": len(paths), "files": len({row['source'] for row in files}), "bytes": sum(row["bytes"] for row in {row['source']:row for row in files}.values())}))
