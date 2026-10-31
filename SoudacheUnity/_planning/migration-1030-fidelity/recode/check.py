# -*- coding: utf-8 -*-
"""Typecheck a private source snapshot; run current source event result contracts."""
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

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

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
sys.argv = [str(helper), "Sdt.UI"]
try:
    exec(compile(code, str(helper), "exec"), {"__file__": str(helper), "__name__": "__main__"})
except SystemExit as exit:
    if exit.code:
        raise

command = ["node", "node_modules/vitest/vitest.mjs", "run", "tests/event-recode-selection-continuity.test.js",
           "tests/event-settlement-unification.test.js", "--project", "dom", "--maxWorkers", "1",
           "--reporter", "json", "--outputFile", str(HERE / "source-tests.json")]
result = subprocess.run(command, cwd=SOURCE, capture_output=True, text=True, encoding="utf-8", errors="replace")
(HERE / "source-tests.log").write_text(result.stdout + result.stderr, encoding="utf-8")
print("source DOM exit=" + str(result.returncode))
if result.returncode:
    print(result.stdout + result.stderr)
test_report = json.loads((HERE / "source-tests.json").read_text(encoding="utf-8"))
native_paths = ["Assets/Scripts/Sdt.UI/Screens/Run/EventDialogRecode.cs",
                "Assets/Scripts/Sdt.UI/Screens/Run/EventDialogScreen.cs",
                "Assets/Scripts/Sdt.UI/Screens/Run/CurrentIllustratedNode.cs"]
receipt = {
    "sourceFiles": {file: sha(SOURCE / file) for file in [
        "game/src/ui/event-recode-result.js", "game/src/run/game.run.events.js",
        "game/css/event-recode-result.css", "game/css/illustrated-node.css",
        "game/src/ui/node-scene-view.js", "game/src/ui/illustrated-node.js",
        "tests/event-recode-selection-continuity.test.js", "tests/event-settlement-unification.test.js"]},
    "nativeFiles": {file: inputs[file] for file in native_paths},
    "typecheck": "Sdt.UI production snapshot using existing imported Unity DLL references",
    "sourceDomCommand": command,
    "sourceDomExit": result.returncode,
    "sourceTests": {key: test_report[key] for key in ["numPassedTests", "numFailedTests", "success"]},
    "sourceTestGap": "The two continuity assertions use retired .event-choice-hand/.picked selectors; current openEventRecode uses reward-v14. Source tests and source production were read-only. The 26 settlement tests passed, including invalidated source-card recode confirmation cases.",
    "nativeRuntime": "pending root consolidated native verification; this task has not launched Unity"
}
(HERE / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
raise SystemExit(result.returncode)
