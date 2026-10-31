"""Check source registry import hashes and source bitmap pixels without starting any UI."""
import json
import hashlib
import re
import subprocess
from pathlib import Path
from PIL import Image
import sync_assets
receipt = json.loads(Path(__file__).with_name("icons-receipt.json").read_text(encoding="utf-8"))
failures, bitmaps, vectors = [], 0, 0
facility_shapes = None
for row in receipt["files"]:
    source = sync_assets.ASSETS / row["source"]
    output = sync_assets.RESOURCES / row["destination"]
    if sync_assets.sha(source) != row["sourceSha256"] or sync_assets.sha(output) != row["outputSha256"]:
        failures.append("hash mismatch: " + row["key"])
    with Image.open(output) as target:
        if target.mode != "RGBA" or not target.getchannel("A").getbbox(): failures.append("empty alpha: " + row["key"])
        if source.suffix == ".svg":
            vectors += 1
            if target.size != (128,128): failures.append("SVG raster dimensions: " + row["key"])
        else:
            bitmaps += 1
            with Image.open(source) as original:
                if original.convert("RGBA").tobytes() != target.convert("RGBA").tobytes(): failures.append("bitmap pixel mismatch: " + row["key"])
for row in receipt.get("hubFiles", []):
    source = sync_assets.GAME / row["source"]
    output = sync_assets.RESOURCES / row["destination"]
    if "sourceSvgSha256" in row:
        if facility_shapes is None:
            # Facility illustrations are a real exported function, not the separate home path map.
            code = "const m=await import(process.argv[1]);console.log(JSON.stringify(Object.fromEntries(['bag','stash'].map(id=>['facility-'+id,m.facilityIllustration(id)]))));"
            result = subprocess.run(["node", "--input-type=module", "-e", code, source.resolve().as_uri()], capture_output=True, text=True, encoding="utf-8", check=True)
            facility_shapes = json.loads(result.stdout)
        shape = facility_shapes[row["key"]]
        expected_shape = row["sourceSvgSha256"]
    else:
        shapes = dict(re.findall(r"^\s{2}([a-z]+):'([^']+)'", source.read_text(encoding="utf-8"), re.MULTILINE))
        shape = shapes[row["key"]]
        expected_shape = row["pathSha256"]
    if sync_assets.sha(source) != row["sourceSha256"] or sync_assets.sha(output) != row["outputSha256"] or hashlib.sha256(shape.encode("utf-8")).hexdigest() != expected_shape:
        failures.append("base SVG path/hash mismatch: " + row["key"])
    with Image.open(output) as target:
        expected_size = (256, 256) if "sourceSvgSha256" in row else (128, 128)
        if target.mode != "RGBA" or target.size != expected_size or not target.getchannel("A").getbbox():
            failures.append("base SVG raster empty or wrong dimensions: " + row["key"])
result = {"passed":not failures,"sourceAndOutputHashes":len(receipt["files"]),"vectorImports":vectors,"pixelIdenticalBitmaps":bitmaps,"baseSvgImports":len(receipt.get("hubFiles", [])),"failures":failures}
Path(__file__).with_name("icons-verification.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=True))
raise SystemExit(0 if result["passed"] else 1)
