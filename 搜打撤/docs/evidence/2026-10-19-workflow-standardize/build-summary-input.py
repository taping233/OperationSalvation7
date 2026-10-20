import hashlib
import json
from pathlib import Path

folder = Path(__file__).resolve().parent
root = folder.parents[2]
files = ['tools/workflow-summary.mjs', 'tools/nai-workflow.py', 'tools/browser-personnel.mjs',
         'tests/workflow-standardize.test.js', 'tools/tests/test_nai_workflow.py']
manifest = [dict(file=file, sha256=hashlib.sha256((root / file).read_bytes()).hexdigest()) for file in files]
report = dict(ok=True, steps=[dict(name='vitest', exitCode=0, passed=13), dict(name='python', exitCode=0, passed=6),
              dict(name='eslint', exitCode=0), dict(name='docs', exitCode=0, checkedRelativeLinks=567)],
              after=dict(manifest=manifest), scope='Observed command results; source snapshot taken after scoped checks. Not a native frozen gate receipt.')
(folder / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
summary = dict(title='工作流短入口标准化', paths=files, reports=[
    dict(path='docs/evidence/2026-10-19-workflow-standardize/checks.json', coverage='13项Vitest、6项Python、目标ESLint、567链接文档守卫'),
    dict(path='docs/evidence/2026-10-19-workflow-standardize/personnel-live.json', coverage='当前内置浏览器六步真实导航与预览取证；不应用装备')],
    unverified=['未验证刷新读档或自然战斗', '未运行全量测试或build；无提交授权', 'NAI服务器和余额未探测；仅本地状态预检'],
    doneWhenConfirmed=True)
(folder / 'summary-input.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print('Checks and summary input saved')
