# -*- coding: utf-8 -*-
"""Close documentation only after current independent acceptance gates pass."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys

project = Path(__file__).resolve().parents[2]
web = project.parent / '搜打撤'
evidence = web / 'docs/evidence/2026-10-29-unity-desktop'
fidelity = evidence / 'fidelity-1030'
planning = project / '_planning/migration-1030-fidelity'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def run(command, cwd):
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, encoding='utf-8')
    assert result.returncode == 0, result.stdout[-2500:] + result.stderr[-1500:]
    return result

gates = [planning / 'independent-final-review/player2-review.json',
         planning / 'menu-hub-independent/visual-final-player2.json',
         planning / 'completion-audit.json']
for path in gates:
    gate = read(path)
    assert gate['passed'] and not gate['confirmedOpenItems'], str(path)
manifest = read(fidelity / 'desktop-final-build-2/artifact-manifest.json')
assert manifest['passed'] and manifest['buildGUID'] == read(fidelity / 'desktop-final-player-2/result.json')['display']['buildGUID']
assert (fidelity / 'desktop-final-build-2/build-info.snapshot.json').read_bytes() == (project / 'Build/Desktop/build-info.json').read_bytes()
assert sorted(row['path'] for row in manifest['files']) == sorted(p.relative_to(project / 'Build/Desktop').as_posix() for p in (project / 'Build/Desktop').rglob('*') if p.is_file())

run([sys.executable, str(planning / 'update_status.py'), '--complete'], project)
migration = project / 'MIGRATION.md'
text = migration.read_text(encoding='utf-8')
start = text.index('状态：末轮交付审查。')
end = text.index('\n\n', start)
text = text[:start] + '状态：Windows桌面首版完成未提交。2026-10-31，本轮按现行源码修正过场、指南、公共排版与字形密度、读卡、商店/凭据、首脑编组及单档备份恢复；默认 `Build/Desktop/代号柒.exe` 已更新。最新正常Standalone的48张实际画面、对应原生操作和三路独立审查均通过，确认发现项已闭合。3893项构建输入与当前源码一致，166个交付文件已登记SHA。旧离屏与旧完整验收不替代当前结论；详细范围与未测项见本任务 `ACCEPTANCE.md` 和 `fidelity-1030/progress.json`。' + text[end:]
migration.write_text(text, encoding='utf-8')
acceptance = evidence / 'ACCEPTANCE.md'
text = acceptance.read_text(encoding='utf-8')
old = '状态：末轮独立审查收束中。默认 `Build/Desktop` 已更新为本轮修正版，完成态以 [task.json](task.json) 和 [本轮状态](fidelity-1030/progress.json) 为准。'
new = '状态：2026-10-31，Windows桌面首版完成未提交。默认 `Build/Desktop` 已更新为本轮修正版，原生检查、正常播放器实绘和三路独立审查通过，确认发现项已闭合；当前机器状态见 [task.json](task.json) 和 [本轮状态](fidelity-1030/progress.json)。'
assert old in text
acceptance.write_text(text.replace(old, new, 1), encoding='utf-8')

docs = run(['node', 'scripts/workflow.mjs', 'docs', '--json'], web)
write(fidelity / 'docs-final-check.json', json.loads(docs.stdout))

registry = web / 'docs/PARALLEL-REGISTRY.md'
text = registry.read_text(encoding='utf-8-sig')
owned = [line for line in text.splitlines() if line.startswith('Friday（Unity实机反馈修正 WF-unity-desktop-1029；01a18778），2026-10-30：老板反馈')]
assert len(owned) == 1
text = text.replace(owned[0] + '\n\n', '', 1)
heading = '## 近期已释放\n'
assert heading in text
released = '\nFriday（Unity实机反馈修正 WF-unity-desktop-1029；01a18778），2026-10-31：完成未提交、编辑释放。属地SoudacheUnity/及自有docs/evidence/2026-10-29-unity-desktop/保留归本任务；源Vite只读，其他会话改动原位保留。当前原始架构与24类页面按限定证据闭合，过场/文案/排版/清晰度及商店、凭据、编组、读卡、整理器、单档备份均修正；原生cjk-1/film-flow-3/frames-2/organizer-focus-2/slot-archive-1/journey-4/shop-source-4/pile-3及正常desktop-final-player-2通过。默认Build/Desktop已更新，48张2560×1440/DPI120实绘，三路独审确认项全部闭合；3893输入与166产物指纹已记。只用现行4首BGM；Agent/旧Web档/研究第二图及关闭制作坊排除。后台零透明度非激活宿主，无本会话Unity/播放器保留进程；无前台操控、OS输入、用户档/剪贴板写入、提交/推送/发布。实际边界见ACCEPTANCE.md与fidelity-1030/progress.json。\n'
registry.write_text(text.replace(heading, heading + released, 1), encoding='utf-8')

diff = run(['git', 'diff', '--check', '--', 'Assets', 'MIGRATION.md', '_planning/migration-1030-fidelity'], project)
write(fidelity / 'closing-checks.json', {
    'passed': True, 'checkedAt': datetime.now(timezone.utc).isoformat(),
    'independentGates': [{'path': p.relative_to(project).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in gates],
    'buildGUID': manifest['buildGUID'], 'buildFiles': len(manifest['files']),
    'docsCheck': 'docs-final-check.json', 'codeAndOwnDocsDiffCheckExit': diff.returncode,
    'lineEndings': 'Default repository normalization retained. Unity TagManager empty serialized list items were not changed for whitespace.',
    'registry': 'Own active entry moved to released; other sessions preserved.',
    'scope': 'No production or build changes in closeout; no stage, commit, push, upload or user UI operations.'
})
print(json.dumps({'passed': True, 'stage': 'complete-uncommitted', 'buildGUID': manifest['buildGUID'], 'files': len(manifest['files'])}, ensure_ascii=True))
