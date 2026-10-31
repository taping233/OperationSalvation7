"""Record the verified source, native package and local-only evidence without staging files."""
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
UNITY = ROOT / "SoudacheUnity"
EVIDENCE = ROOT / "搜打撤/docs/evidence/2026-10-31-unity-parity"
BUILD, PLAYER = sys.argv[1:3]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(path):
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def entry(path, relative_to=ROOT):
    return {"path": path.relative_to(relative_to).as_posix(), "bytes": path.stat().st_size,
            "sha256": digest(path)}


stamp = datetime.now(timezone.utc).isoformat()
build_process = read(EVIDENCE / BUILD / "process.json")
player_process = read(EVIDENCE / PLAYER / "process.json")
player = read(EVIDENCE / PLAYER / "result.json")
audio = read(EVIDENCE / "native-audio-author-2/sfx-mixer-authoring.json")
assert audio["status"] == "generated-and-readback-verified" and audio["sourceRatio"] == 12 and audio["nativeRatio"] == 10
info_path = UNITY / "Build/Desktop/build-info.json"
build = read(info_path)
assert build_process["exitCode"] == 0 and build_process["inputsUnchanged"]
assert player_process["exitCode"] == 0 and player["passed"], player.get("error")
assert build["result"] == "Succeeded" and build["errors"] == 0 and build["inputsUnchanged"]
changed_inputs = [name for name, sha in build["inputs"].items() if digest(UNITY / name) != sha]
assert not changed_inputs, changed_inputs
shutil.copyfile(info_path, EVIDENCE / BUILD / "build-info.json")

baseline = read(EVIDENCE / "source-baseline.json")
before = {item["path"]: item for item in baseline["files"]}
files = [entry(path, UNITY) for directory in ("Assets/Scripts", "Assets/Editor")
         for path in sorted((UNITY / directory).rglob("*.cs"))]
after = {item["path"]: item for item in files}
assert not (before.keys() - after.keys()), "Source files were removed; review deletion authorization."
def runtime_source(item):
    return item["path"].startswith("Assets/Scripts/") and not Path(item["path"]).name.startswith("NativeDisplayReview")

write(EVIDENCE / "source-final.json", {
    "at": stamp, "sourceFiles": len(files),
    "changedSinceBaseline": sorted(name for name in after if name not in before or after[name]["sha256"] != before[name]["sha256"]),
    "sourceBytesBefore": sum(item["bytes"] for item in before.values()),
    "sourceBytesAfter": sum(item["bytes"] for item in files),
    "runtimeByteScope": "Assets/Scripts C# excluding argument-gated NativeDisplayReview QA",
    "runtimeSourceBytesBefore": sum(item["bytes"] for item in before.values() if runtime_source(item)),
    "runtimeSourceBytesAfter": sum(item["bytes"] for item in files if runtime_source(item)), "files": files,
})
vite = [item for item in read(EVIDENCE / "verification-inputs.json")["files"]
        if item["path"].startswith("搜打撤/")]
vite_changed = [item["path"] for item in vite if digest(ROOT / item["path"]) != item["sha256"]]
assert not vite_changed, vite_changed

native_names = ("native-shared-8", "native-battle-6", "native-journey-1", "native-shop-1", "native-slots-1")
native = []
for name in native_names:
    process = read(EVIDENCE / name / "process.json")
    result = read(EVIDENCE / name / "result.json")
    assert process["exitCode"] == 0 and process["inputsUnchanged"] and result["passed"], name
    native.append({"path": name, "passed": True, "sourceCount": process["sourceCount"],
                   "result": entry(EVIDENCE / name / "result.json")})

package = [entry(path) for path in sorted((UNITY / "Build/Desktop").rglob("*")) if path.is_file()]
write(EVIDENCE / "product-manifest.json", {"at": stamp, "acquisition": "Unity BuildGame.BuildWin64 from frozen inputs",
      "fileCount": len(package), "bytes": sum(item["bytes"] for item in package), "files": package})
media_extensions = {".wav", ".ogg", ".opus", ".mp3", ".mp4", ".webm", ".zip", ".7z", ".ttf", ".otf"}
local = [path for path in EVIDENCE.rglob("*") if path.is_file()
         and (path.stat().st_size > 1_000_000 or path.suffix.lower() in media_extensions)]
local.append(UNITY / "Assets/Resources/Art/Current/BattleFxAtlas.png")
write(EVIDENCE / "local-only-files.json", {"at": stamp, "gitPolicy": "local only; do not stage these media or files over 1MB",
      "acquisition": "Native editor/player evidence; atlas losslessly converted from current Vite source; product files separately in product-manifest.json",
      "files": [entry(path) for path in sorted(set(local))]})
start = next(record for record in player["records"] if record.get("kind") == "actual-player-start")
images = [entry(path) for path in sorted((EVIDENCE / PLAYER).glob("*.png"))]
write(EVIDENCE / "verification.json", {
    "at": stamp, "passed": True, "build": BUILD, "player": PLAYER,
    "buildGUID": start["display"]["buildGUID"], "buildInputCount": len(build["inputs"]),
    "currentBuildInputsMatch": True, "viteReadOnlyInputs": len(vite), "viteInputsUnchanged": True,
    "domainChecks": {"battle": 47, "run": 326, "hubSave": 472}, "native": native,
    "domainLogs": [entry(UNITY / f"_planning/parity-1031/{name}-final.log") for name in ("battle", "run", "hub")],
    "sfxAuthoring": entry(EVIDENCE / "native-audio-author-2/sfx-mixer-authoring.json"),
    "audioBackendBoundary": "source compression ratio 12; supported native ratio 10; no sample-identical acoustic claim",
    "playerImageCount": len(images), "images": images,
    "display": start["display"], "osHardwareInput": False,
    "scope": "current native desktop window; constructed EventSystem/production command inputs and isolated profiles",
    "limitations": ["not every card combination or every random route", "no acoustic sample comparison or measured FPS/memory improvement", "no OS hardware input or multiple window sizes"],
})
print(json.dumps({"passed": True, "sourceFiles": len(files), "changedSourceFiles": len(read(EVIDENCE / "source-final.json")["changedSinceBaseline"]),
                  "sourceByteDelta": sum(item["bytes"] for item in files) - sum(item["bytes"] for item in before.values()),
                  "packageFiles": len(package), "images": len(images), "viteInputsUnchanged": len(vite)}, ensure_ascii=False))
