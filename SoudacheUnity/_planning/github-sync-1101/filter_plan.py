"""Produce explicit clean snapshot lists from the read-only inventory."""
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
inventory = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
records = [dict(item) for item in inventory["files"]]
image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".bmp", ".tga", ".tif", ".tiff", ".gif", ".psd", ".exr", ".hdr"}
resource = json.loads((OUT / "resource-rebuild.json").read_text(encoding="utf-8"))
retired_media = {item["path"] for item in resource["files"] if not item["restorationRequired"]}
retired_paths = retired_media | {path + ".meta" for path in retired_media}
for item in records:
    relative = item["path"]
    if relative in retired_paths:
        item["category"] = "exclude-policy-retired"
    elif item["category"] == "exclude-policy-large" and relative.startswith("Assets/") and Path(relative).suffix.lower() in image_extensions:
        item["category"] = "candidate-project"
formal = [item for item in records if item["category"] == "candidate-project" and not item["path"].startswith("_thirdparty/")]
for item in formal:
    item["sha256"] = hashlib.sha256((ROOT / item["path"]).read_bytes()).hexdigest()
excluded_assets = [item for item in records if item["path"].startswith("Assets/") and item["category"].startswith("exclude-policy")]
for item in excluded_assets:
    item["sha256"] = hashlib.sha256((ROOT / item["path"]).read_bytes()).hexdigest()
generated = [item for item in records if item["tracked"] and item["category"] == "exclude-generated"]
planning_review = [item["path"] for item in records if item["category"] == "candidate-planning"]
plan = {
    "status": "read-only clean-snapshot candidate; root owns final scope and commits",
    "target": {"remote": "https://github.com/taping233/OperationSalvation7.git", "branch": "codex/unity-validated-20261101", "base": "safe completed parent-repository HEAD; preserve 搜打撤/game sibling sources"},
    "formalCount": len(formal),
    "formalScope": "Assets, Packages, ProjectSettings, .gitignore and root project documents. Formal Assets images are included regardless of size; other >1,000,000-byte files and policy audio/font/archive files remain excluded. The 67 retired media and their metadata remain excluded.",
    "formal": [{key: item[key] for key in ("path", "bytes", "sha256", "tracked", "changed", "untrackedVisible")} for item in formal],
    "excludedAssetCount": len(excluded_assets),
    "excludedAssetBytes": sum(item["bytes"] for item in excluded_assets),
    "excludedAssets": [{key: item[key] for key in ("path", "bytes", "sha256", "tracked", "category")} for item in excluded_assets],
    "trackedGeneratedDoNotCopy": [{key: item[key] for key in ("path", "bytes")} for item in generated],
    "planningReviewBoundary": "Keep authored migration/rebuild/verification tools, small receipts and final reviews as chosen by root. The broad inventory planning candidates are NOT an approved copy list: they include private compiler snapshots, typecheck projects, constructed profiles and old intermediate results. Do not copy _planning wholesale.",
    "planningCandidateInventoryCount": len(planning_review),
    "specificRequiredPlanningSources": [
        "_planning/migration-1029/ui/sync_assets.py", "_planning/migration-1029/ui/sync_fonts.py", "_planning/migration-1029/ui/README.md",
        "_planning/migration-1029/current-unit-frames/sync_frames.py", "_planning/parity-1031/battle-check/BattleChecks.csproj", "_planning/parity-1031/battle-check/Program.cs",
        "_planning/parity-1031/HubParityChecks.csproj", "_planning/parity-1031/HubParityChecks.cs", "_planning/parity-1031/hub-source-vectors.mjs", "_planning/parity-1031/hub-source-vectors.json",
        "_planning/parity-1031/run-check/RunParityChecks.csproj", "_planning/parity-1031/run-check/Program.cs", "_planning/migration-1029/current-departure/Stubs.cs", "_planning/parity-1031/arena-filter-check/CurrentArenaFilterChecks.cs"
    ],
    "ignoreRecommendations": [
        "Ignore local _planning bin/obj, typecheck outputs, compile-private snapshots, constructed profile directories and logs; preserve authored Program/check sources.",
        "Narrow root *.csproj/*.sln ignore or explicitly include selected authored validation projects. Current blanket *.csproj suppresses 298 planning projects, including active parity projects.",
        "Keep formal Assets images at every size; the size limit still applies to planning/evidence. Exclude the 67 retired media and their metadata explicitly.",
        "Do not carry the old local Unity Git history or old snapshot binary state into the fresh parent-based branch."
    ],
    "blockers": [
        "resource-rebuild.json is historical evidence: its 189 active PNG targets now ship directly; the 52 audio/font targets retain their restoration policy. The 67 retired media and metadata remain excluded. export_manifest.py checks every current Assets image and the historical required image set.",
        "Candidate generation does not certify a clean-room project opening or runtime validation; use the current export manifest and scoped acceptance receipts.",
        "Hub/Run .NET validation projects reference the locked Newtonsoft DLL in Library/PackageCache; Unity package restoration must precede those checks. The active Run project also needs migration-1029/current-departure/Stubs.cs."
    ],
    "doNotPublishAuditIntermediate": ["_planning/github-sync-1101/inventory.json", "_planning/github-sync-1101/*.log"],
    "auditOnly": "No production writes, staging, commit, push, build or Unity launch performed. Formal hashes freeze the read time; any later source edits require root refresh."
}
(OUT / "commit-candidates.json").write_text(json.dumps(plan, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"formal": len(formal), "excludedAssets": len(excluded_assets), "excludedAssetBytes": plan["excludedAssetBytes"], "trackedGeneratedDoNotCopy": len(generated), "planBytes": (OUT / "commit-candidates.json").stat().st_size}, ensure_ascii=False))
