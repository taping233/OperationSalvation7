# -*- coding: utf-8 -*-
"""Private production snapshot typecheck and current source card-zoom contract tests."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
SOURCE = PROJECT.parent / "搜打撤"
SNAPSHOT = HERE / "snapshot"
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
inputs = {}
for file in (PROJECT / "Assets/Scripts").rglob("*"):
    if file.is_file() and file.suffix in (".cs", ".asmdef"):
        target = SNAPSHOT / file.relative_to(PROJECT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
        inputs[file.relative_to(PROJECT).as_posix()] = sha(target)
(HERE / "typecheck-inputs.json").write_text(json.dumps(inputs, indent=2), encoding="utf-8")
helper = PROJECT / "_planning/migration-1029/check_compile.py"
code = helper.read_text(encoding="utf-8")
code = code.replace('ROOT = Path(__file__).resolve().parents[2]', f'ROOT = Path({str(PROJECT)!r})')
code = code.replace('OUTPUT = Path(__file__).resolve().parent / "compile"', f'OUTPUT = Path({str(HERE / "typecheck")!r})')
code = code.replace('(ROOT / "Assets/Scripts").rglob', f'(Path({str(SNAPSHOT)!r}) / "Assets/Scripts").rglob')
sys.argv = [str(helper), "Sdt.Boot"]
try:
    exec(compile(code, str(helper), "exec"), {"__file__": str(helper), "__name__": "__main__"})
except SystemExit as error:
    if error.code:
        raise
command = ["node", "node_modules/vitest/vitest.mjs", "run", "tests/card-zoom-controller.test.js", "--project", "dom",
           "--maxWorkers", "1", "--reporter", "json", "--outputFile", str(HERE / "source-tests.json")]
result = subprocess.run(command, cwd=SOURCE, capture_output=True, text=True, encoding="utf-8", errors="replace")
(HERE / "source-tests.log").write_text(result.stdout + result.stderr, encoding="utf-8")
print("source card-zoom DOM exit=" + str(result.returncode))
report = json.loads((HERE / "source-tests.json").read_text(encoding="utf-8"))
source_files = ["game/src/ui/card-zoom-controller.js", "game/src/ui/card-zoom-content.js", "game/src/ui/reward-scene-view.js",
                "game/src/run/chests.js", "game/src/run/event-card-choice.js", "game/src/run/event-branch-choice.js",
                "game/css/winter.css", "game/css/cover-details.css", "game/css/expedition-rewards.css"]
native_files = ["Assets/Scripts/Sdt.UI/Screens/Run/DepartureElements.cs", "Assets/Scripts/Sdt.UI/Screens/Run/CurrentRewardScene.cs"]
receipt = {"typecheck": "Sdt.Boot current production snapshot with imported Unity DLL references",
           "nativeFiles": {path: inputs[path] for path in native_files},
           "sourceFiles": {path: sha(SOURCE / path) for path in source_files},
           "sourceTests": {key: report[key] for key in ["numPassedTests", "numFailedTests", "success"]},
           "sourceTestExit": result.returncode, "nativeRuntime": "pending root consolidated native verification; no Unity launched"}
(HERE / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
raise SystemExit(result.returncode)
