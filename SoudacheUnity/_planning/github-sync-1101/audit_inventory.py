"""Read-only repository inventory. Writes only this task's planning receipts."""
import collections
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent

def git(*args):
    result = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, check=True)
    return result.stdout.decode("utf-8")

tracked = set(git("ls-files", "-z").split("\0")) - {""}
untracked = set(git("ls-files", "--others", "--exclude-standard", "-z").split("\0")) - {""}
changed = set(git("diff", "HEAD", "--name-only", "-z").split("\0")) - {""}
allowed_roots = {"Assets", "Packages", "ProjectSettings", "_thirdparty", "_planning"}
runtime_parts = {"bin", "obj", "library", "temp", "logs", "build", "builds", "usersettings", "memorycaptures", "recordings", "__pycache__"}
media_extensions = {".mp3", ".ogg", ".opus", ".wav", ".flac", ".m4a", ".aac", ".mp4", ".webm", ".mov", ".avi", ".zip", ".7z", ".rar", ".tar", ".gz", ".ttf", ".otf", ".woff", ".woff2"}
image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".bmp", ".tga", ".tif", ".tiff", ".gif", ".psd", ".exr", ".hdr"}
resource = json.loads((OUT / "resource-rebuild.json").read_text(encoding="utf-8"))
retired_media = {item["path"] for item in resource["files"] if not item["restorationRequired"]}
retired_paths = retired_media | {path + ".meta" for path in retired_media}
source_extensions = {".cs", ".csproj", ".sln", ".py", ".mjs", ".js", ".ps1", ".sh", ".cmd", ".json", ".md", ".asmdef", ".shader", ".ink", ".yaml", ".yml", ".xml", ".txt"}

paths = set(tracked | untracked)
for name in allowed_roots:
    for path in (ROOT / name).rglob("*"):
        if path.is_file():
            relative = path.relative_to(ROOT).as_posix()
            # The receipt excludes itself; a subsequent stage plan must freeze its final bytes.
            if not relative.startswith("_planning/github-sync-1101/"):
                paths.add(relative)
paths |= {"MIGRATION.md", ".gitignore"}
records = []
for relative in sorted(paths):
    path = ROOT / relative
    if not path.is_file():
        records.append({"path": relative, "tracked": relative in tracked, "changed": relative in changed, "category": "missing-tracked-review", "reason": "Tracked path is absent; preserve intentional deletion review."})
        continue
    root_document = "/" not in relative and path.suffix.lower() == ".md"
    if relative.split("/")[0] not in allowed_roots and relative not in {"MIGRATION.md", ".gitignore"} and not root_document:
        category, reason = "outside-default-scope-review", "Outside normal Unity source roots."
    elif any(part.lower() in runtime_parts for part in Path(relative).parts[:-1]):
        category, reason = "exclude-generated", "Build/cache/runtime output."
    elif path.suffix.lower() in {".log", ".tmp", ".bak", ".pdb", ".exe", ".pyc"} or (relative.startswith("_planning/") and path.suffix.lower() == ".dll"):
        category, reason = "exclude-generated", "Log, local transient or compiled planning output."
    elif relative in retired_paths:
        category, reason = "exclude-policy-retired", "Historical retired media and associated import metadata remain outside the publication scope."
    elif path.stat().st_size > 1_000_000 and not (relative.startswith("Assets/") and path.suffix.lower() in image_extensions):
        category, reason = "exclude-policy-large", "1,000,000-byte limit outside formal Assets images, including planning/evidence."
    elif path.suffix.lower() in media_extensions:
        category, reason = "exclude-policy-media", "Audio/video/archive/font binary; record SHA and recovery source instead."
    elif relative.startswith("_planning/"):
        category, reason = "candidate-planning", "Source, migration evidence or small planning artifact; owner freezes relevance before stage."
    else:
        category, reason = "candidate-project", "Formal Unity source/config/import metadata or image asset; Assets images have no 1MB exclusion."
    item = {"path": relative, "bytes": path.stat().st_size, "tracked": relative in tracked, "changed": relative in changed,
            "untrackedVisible": relative in untracked, "category": category, "reason": reason}
    if category.startswith("exclude-policy"):
        item["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    records.append(item)

candidates = [item["path"] for item in records if item["category"].startswith("candidate")]
check = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "--no-index", "-z", "--stdin"],
                       input=("\0".join(candidates) + "\0").encode("utf-8"), capture_output=True)
if check.returncode not in (0, 1):
    raise RuntimeError(check.stderr.decode("utf-8"))
ignored = set(check.stdout.decode("utf-8").split("\0")) - {""}
for item in records:
    if item["path"] in ignored:
        item["ignoredByCurrentRules"] = True

summary = {
    "date": datetime.datetime.now().isoformat(timespec="seconds"),
    "scope": "Read-only local Unity Git inventory; no staging/commit/push/test/Unity launch.",
    "head": git("rev-parse", "HEAD").strip(), "branch": git("branch", "--show-current").strip(),
    "remotes": git("remote", "-v").strip().splitlines(),
    "tracked": len(tracked), "trackedChanges": len(changed), "visibleUntracked": len(untracked),
    "categories": dict(collections.Counter(item["category"] for item in records)),
    "trackedExcluded": dict(collections.Counter(item["category"] for item in records if item.get("tracked") and item["category"].startswith("exclude"))),
    "ignoredCandidateSources": [item["path"] for item in records if item.get("ignoredByCurrentRules") and Path(item["path"]).suffix.lower() in source_extensions],
    "largeTextCandidatesExcluded": [item["path"] for item in records if item["category"] == "exclude-policy-large" and Path(item["path"]).suffix.lower() in source_extensions],
    "note": "Candidate inventory includes unchanged tracked dependencies; changed/untracked flags identify commit delta. Clean-room rebuild has not run."
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "inventory.json").write_text(json.dumps({"summary": summary, "files": records}, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({key: summary[key] for key in ("head", "branch", "remotes", "tracked", "trackedChanges", "visibleUntracked", "categories", "trackedExcluded")}, ensure_ascii=False))
print("ignored_candidate_sources=" + str(len(summary["ignoredCandidateSources"])))
