"""Freeze a narrow Unity source publication manifest; never stage or mutate source files."""
import argparse
import glob
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
UNITY = HERE.parents[1]
PARENT = UNITY.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true", help="Verify the existing frozen list without rewriting it.")
parser.add_argument("--output", type=Path, help="Write or check a task-specific manifest, preserving earlier publication receipts.")
args = parser.parse_args()
MANIFEST = args.output.resolve() if args.output else HERE / "export-manifest.json"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if args.check:
    old = json.loads(MANIFEST.read_text(encoding="utf-8"))
    changed = [row["path"] for row in old["files"] if not (UNITY / row["path"]).is_file()
               or (UNITY / row["path"]).stat().st_size != row["bytes"] or sha(UNITY / row["path"]) != row["sha256"]]
    parent_changed = [row["path"] for row in old["parentSourcePrerequisites"] if not (PARENT / row["path"]).is_file()
                      or sha(PARENT / row["path"]) != row["sha256"]]
    print(json.dumps({"passed": not changed and not parent_changed, "changedUnityFiles": changed,
                      "changedParentSources": parent_changed}, ensure_ascii=False))
    raise SystemExit(1 if changed or parent_changed else 0)

resource = json.loads((HERE / "resource-rebuild.json").read_text(encoding="utf-8"))
dependencies = json.loads((HERE / "restore-dependencies.json").read_text(encoding="utf-8"))
retired_meta = {row["path"] + ".meta" for row in resource["files"] if not row["restorationRequired"]}
media_extensions = {".mp3", ".ogg", ".opus", ".wav", ".flac", ".m4a", ".aac", ".mp4", ".webm", ".mov", ".avi", ".zip", ".7z", ".rar", ".tar", ".gz", ".ttf", ".otf", ".woff", ".woff2"}
generated_extensions = {".log", ".tmp", ".bak", ".pdb", ".exe", ".dll", ".pyc"}
generated_parts = {"bin", "obj", "library", "temp", "logs", "build", "builds", "usersettings", "__pycache__", "snapshot", "profiles", "compile-private"}
selected = {}

def add(relative, purpose):
    relative = Path(relative).as_posix()
    path = UNITY / relative
    if not path.is_file():
        raise ValueError("Required source is absent: " + relative)
    if relative in retired_meta:
        raise ValueError("Retired import metadata must not be exported: " + relative)
    if path.stat().st_size > 1_000_000 or path.suffix.lower() in media_extensions | generated_extensions:
        raise ValueError("Publication policy excludes selected file: " + relative)
    if any(part.lower() in generated_parts for part in Path(relative).parts[:-1]):
        raise ValueError("Generated/intermediate source selected: " + relative)
    selected.setdefault(relative, set()).add(purpose)

formal = set()
for directory in ("Assets", "Packages", "ProjectSettings"):
    for path in (UNITY / directory).rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(UNITY).as_posix()
        if relative in retired_meta or path.stat().st_size > 1_000_000 or path.suffix.lower() in media_extensions | generated_extensions:
            continue
        if any(part.lower() in generated_parts for part in path.relative_to(UNITY).parts[:-1]):
            continue
        purpose = "meta" if path.suffix == ".meta" else "config" if directory != "Assets" else "art" if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg"} else "runtime"
        add(relative, purpose)
        formal.add(relative)
for path in sorted(UNITY.glob("*.md")):
    add(path.name, "project-doc")
    formal.add(path.name)
for name in (".gitignore", ".gitattributes"):
    if (UNITY / name).exists():
        add(name, "config")
        formal.add(name)

for row in dependencies["mustIncludeUnityRelative"]:
    add(row["path"], "restore")
for row in dependencies["recommendedProvenanceUnityRelative"]:
    add(row["path"], "provenance")

domain_files = [
    "_planning/parity-1031/battle-check/BattleChecks.csproj", "_planning/parity-1031/battle-check/Program.cs",
    "_planning/parity-1031/battle-check/Round3Checks.cs", "_planning/parity-1031/battle-check/Round4Checks.cs",
    "_planning/parity-1031/battle-check/Round6Checks.cs",
    "_planning/parity-1031/battle-check/Round6PreviewChecks.cs",
    "_planning/parity-1031/HubParityChecks.csproj", "_planning/parity-1031/HubParityChecks.cs",
    "_planning/parity-1031/hub-source-vectors.mjs", "_planning/parity-1031/hub-source-vectors.json",
    "_planning/parity-1031/run-check/RunParityChecks.csproj", "_planning/parity-1031/run-check/Program.cs",
    "_planning/parity-1101-round2/run-check/RunRound2Checks.csproj", "_planning/parity-1101-round2/run-check/Program.cs",
    "_planning/parity-1101-round3/archive-check/ArchiveRound3Checks.csproj", "_planning/parity-1101-round3/archive-check/Program.cs",
    "_planning/parity-1101-round5/export-check/PhotoStudioExportChecks.csproj", "_planning/parity-1101-round5/export-check/Program.cs",
    "_planning/parity-1101-round6/run-check/RunRound6Checks.csproj", "_planning/parity-1101-round6/run-check/Program.cs",
    "_planning/parity-1101-round6/discover-source-oracle.mjs",
    "_planning/migration-1029/current-departure/Stubs.cs"
]
for relative in domain_files:
    add(relative, "domain-check")
for folder in ("parity-1101-round2", "parity-1101-round3", "parity-1101-round4", "parity-1101-round5", "parity-1101-round6"):
    for pattern in ("*.md", "*.json"):
        for path in sorted((UNITY / "_planning" / folder).glob(pattern)):
            add(path.relative_to(UNITY).as_posix(), "parity-acceptance")
for relative in (
    "_planning/migration-1029/run_native_check.ps1",
    "_planning/migration-1030-fidelity/clarity/run_hidden_player.ps1",
    "_planning/migration-1030-fidelity/clarity/analyse_player_review.py",
    "_planning/migration-1030-fidelity/clarity/README.md"
):
    add(relative, "native-qa")
for path in sorted((UNITY / "_planning").glob("*.md")):
    add(path.relative_to(UNITY).as_posix(), "migration-history")
for name in ("arena-filter.md", "audio-followup.md", "battle-independent-review.md", "battle.md", "hub-save.md", "run-independent-review.md", "run.md", "sfx-mixer-authoring.md", "shared.md",
             "visual-battle-final.json", "visual-hub-final.json", "visual-shared-review.json", "final_receipt.py"):
    add("_planning/parity-1031/" + name, "acceptance")
for relative in (
    "_planning/migration-1030-fidelity/code-differences.md",
    "_planning/migration-1030-fidelity/completion-audit.md",
    "_planning/migration-1030-fidelity/completion-audit.json",
    "_planning/migration-1029/current-ui-version/README.md",
    "_planning/migration-1029/current-ui-version/version-matrix.json",
    "_planning/migration-1029/current-ui-version/runtime-source-manifest.json",
    "_planning/migration-1029/current-ui-version/FREEZE.json"
):
    add(relative, "migration-history")
for name in ("README.md", "resource-rebuild.json", "restore-dependencies.json", "resolution-type-fix.json", "gitignore-review.json", "export_manifest.py"):
    add("_planning/github-sync-1101/" + name, "publication")

missing_dependencies = []
updated_documentation = []
for row in dependencies["mustIncludeUnityRelative"] + dependencies["recommendedProvenanceUnityRelative"]:
    path = UNITY / row["path"]
    if row["path"] not in selected:
        missing_dependencies.append({"path": row["path"], "reason": "Dependency missing or changed since the resource owner's freeze."})
    elif sha(path) != row["sha256"]:
        if row["path"] == "GITHUB-SOURCE.md":
            updated_documentation.append({"path": row["path"], "historicalSha256": row["sha256"], "currentSha256": sha(path),
                                          "reason": "Current acceptance and test navigation; resource recipes/inputs retain exact historical hash checks."})
        else:
            missing_dependencies.append({"path": row["path"], "reason": "Dependency changed since the resource owner's freeze."})
for relative in domain_files:
    if not relative.endswith(".csproj"):
        continue
    project = UNITY / relative
    for entry in ET.parse(project).getroot().iter("Compile"):
        include = entry.get("Include")
        matches = glob.glob(str(project.parent / include), recursive=True)
        if not matches:
            missing_dependencies.append({"path": relative, "reason": "No files match Compile Include " + include})
        for match in matches:
            source = Path(match).resolve().relative_to(UNITY).as_posix()
            if source not in selected:
                missing_dependencies.append({"path": source, "reason": "Direct domain-project source dependency was not selected."})
for key, recipe in resource["restoreRecipes"].items():
    if recipe["entry"] is None:
        continue
    script = re.search(r"(_planning/\S+\.py)", recipe["entry"])[1]
    if script not in selected:
        missing_dependencies.append({"path": script, "reason": "Restore recipe entry was not selected: " + key})
if missing_dependencies:
    raise ValueError(json.dumps(missing_dependencies, ensure_ascii=False))

parent_sources = []
for row in resource["requiredCompletedSourceChanges"]:
    path = PARENT / row["path"]
    if not path.is_file() or sha(path) != row["sha256"]:
        raise ValueError("Parent raw source no longer matches the validated resource: " + row["path"])
    parent_sources.append({"path": row["path"], "bytes": path.stat().st_size, "sha256": sha(path), "purpose": "current-raw-source"})

files = [{"path": relative, "bytes": (UNITY / relative).stat().st_size, "sha256": sha(UNITY / relative), "purpose": "+".join(sorted(selected[relative]))} for relative in sorted(selected)]
manifest = {
    "status": "frozen exact export list; no stage, commit, push, import or Unity launch by this tool",
    "unityDestination": "SoudacheUnity/",
    "hashScope": "Current worktree file bytes. Parent repository may normalize text to LF; root must record the resulting Git-object fingerprint separately.",
    "fileCount": len(files), "formalCount": len(formal), "planningCount": len(files) - len(formal), "totalBytes": sum(row["bytes"] for row in files),
    "files": files,
    "manifestPayload": "Copy this export-manifest.json as one additional publication receipt; its own hash is intentionally excluded to avoid self-reference.",
    "parentSourcePrerequisites": parent_sources,
    "restoreCoverage": resource["summary"],
    "dependencyCheck": {"missing": [], "activeRestoreRecipes": sum(recipe["entry"] is not None for recipe in resource["restoreRecipes"].values()), "includedResourceTools": sum(row["path"].endswith(".py") for row in dependencies["mustIncludeUnityRelative"]), "requiredClosureFiles": len(dependencies["mustIncludeUnityRelative"]), "recommendedReceipts": len(dependencies["recommendedProvenanceUnityRelative"]), "domainProjects": sum(path.endswith(".csproj") for path in domain_files), "checks": "Exact restore-entry/input/template/receipt hashes, explicit csproj direct Compile source dependencies and parent raw-source hashes checked at export time."},
    "omittedRetiredMetas": [{"path": row["path"] + ".meta", "guid": row["metaGuid"]} for row in resource["files"] if not row["restorationRequired"]],
    "omissionEvidence": "The 67 retired media have zero current loader-path consumers and zero non-meta serialized GUID references. Export omits their .meta; worktree files are retained unchanged.",
    "exclusions": "No Library/Build/bin/obj/typecheck/compile-private/snapshot/profile outputs, logs, rendered planning images, temporary thirdparty binaries, policy audio/fonts/archives or files over 1,000,000 bytes. The broad inventory and intermediate working JSONs are not exported.",
    "prerequisites": dependencies["externalRuntimeDependencies"],
    "updatedDocumentation": updated_documentation,
    "qaBoundary": "Native launcher retains its documented local Unity editor executable path; configure that machine prerequisite before replay. Domain Hub/Run projects use the restored locked Newtonsoft PackageCache. Player review/analysis and final receipt tools require fresh runtime evidence, not committed renderer captures. These are verification tools, not normal game startup dependencies.",
    "publicationBoundary": "This source/dependency manifest does not certify tests or publication. Bind the current scoped acceptance and reviewed Git snapshot before pushing; no clean-room import is claimed."
}
payload = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
if len(payload.encode("utf-8")) >= 1_000_000:
    raise ValueError("Publication manifest exceeds the project size budget.")
MANIFEST.write_text(payload, encoding="utf-8")
print(json.dumps({"fileCount": manifest["fileCount"], "formalCount": manifest["formalCount"], "planningCount": manifest["planningCount"], "totalBytes": manifest["totalBytes"], "manifestBytes": len(payload.encode("utf-8")), "omittedRetiredMetas": len(retired_meta), "missingDependencies": 0}, ensure_ascii=False))
