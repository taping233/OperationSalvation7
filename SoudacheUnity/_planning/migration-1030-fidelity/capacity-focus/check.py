# -*- coding: utf-8 -*-
"""Private production typecheck; reference DOM tests run against current source."""
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
finish = "--finish" in sys.argv
if not finish:
    for file in (PROJECT / "Assets/Scripts").rglob("*"):
        if file.is_file() and file.suffix in (".cs", ".asmdef"):
            target = SNAPSHOT / file.relative_to(PROJECT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, target)
            inputs[str(file.relative_to(PROJECT))] = sha(target)
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
else:
    inputs = json.loads((HERE / "typecheck-inputs.json").read_text("utf-8"))
    native = "Assets\\Scripts\\Sdt.UI\\Screens\\Run\\CurrentRewardCapacityOrganizer.cs"
    if sha(PROJECT / native) != inputs[native]:
        raise SystemExit("Native focus code changed; new typecheck is required")

command = ["node", "node_modules/vitest/vitest.mjs", "run", "tests/reward-capacity-organizer.test.js",
           "--project", "dom", "--maxWorkers", "1", "--reporter", "json", "--outputFile",
           str(HERE / "source-tests.json")]
if not finish:
    result = subprocess.run(command, cwd=SOURCE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (HERE / "source-tests.log").write_text(result.stdout + result.stderr, encoding="utf-8")
    print("source DOM exit=" + str(result.returncode))
full = json.loads((HERE / "source-tests.json").read_text("utf-8"))
focus_command = command[:-1] + [str(HERE / "source-focus-tests.json"), "--testNamePattern", "奖励整理连续键盘焦点"]
result = subprocess.run(focus_command, cwd=SOURCE, capture_output=True, text=True, encoding="utf-8", errors="replace")
(HERE / "source-focus-tests.log").write_text(result.stdout + result.stderr, encoding="utf-8")
print("source focus DOM exit=" + str(result.returncode))
if result.returncode:
    print(result.stdout + result.stderr)
    raise SystemExit(result.returncode)
focused = json.loads((HERE / "source-focus-tests.json").read_text("utf-8"))
receipt = {
    "sourceFiles": {str(file.relative_to(SOURCE)): sha(file) for file in [
        SOURCE / "game/src/ui/reward-capacity-organizer.js",
        SOURCE / "game/src/hub/game.reward-organizer.js",
        SOURCE / "game/css/expedition-rewards.css",
        SOURCE / "tests/reward-capacity-organizer.test.js"]},
    "nativeFile": {"path": "Assets/Scripts/Sdt.UI/Screens/Run/CurrentRewardCapacityOrganizer.cs",
                   "sha256": inputs["Assets\\Scripts\\Sdt.UI\\Screens\\Run\\CurrentRewardCapacityOrganizer.cs"]},
    "typecheck": "Sdt.UI with current production snapshot; existing imported Unity DLL references",
    "sourceDomCommand": command,
    "sourceDomFull": {key: full[key] for key in ["success", "numTotalTests", "numPassedTests", "numFailedTests"]},
    "sourceDomFocusCommand": focus_command,
    "sourceDomFocus": {key: focused[key] for key in ["success", "numTotalTests", "numPassedTests", "numFailedTests", "numPendingTests"]},
    "nativeRuntime": "pending root consolidated native verification; no Unity launched by this task"
}
(HERE / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
