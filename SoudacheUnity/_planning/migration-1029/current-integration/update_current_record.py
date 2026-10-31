# -*- coding: utf-8 -*-
from pathlib import Path
import json
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[4]
docs = root / '搜打撤' / 'docs'
evidence = docs / 'evidence' / '2026-10-29-unity-desktop'
task_path = evidence / 'task.json'
task = json.loads(task_path.read_text(encoding='utf-8-sig'))
for check in task['checks']:
    if 'current-visual-6:' in check.get('description', ''):
        check['description'] = check['description'].replace('[current]', '[superseded render evidence]')
new_checks = [
    ('current-source-texture-quality1', '1226 current images normalized and verified at source dimensions, uncompressed with no mipmaps; 1074 import settings changed, original image SHA unchanged.'),
    ('current-visual-9', '30 native offscreen frames generated at reference dimensions prepared before page construction; 328 inputs unchanged. Fresh independent review found no P1 and two visible raw-icon P2, now repaired in the shared text helper pending recheck.'),
    ('current-entry-1', 'Native entry workflow passed with 328 inputs unchanged: settings/keymap, title photo-note write failure and retry, slot/base/preparation, safe/pocket save failure and resume. Constructed uGUI events and explicit runtime commands; no hardware input.'),
    ('current-core-independent/final-review', 'Fresh current-source/Core replay of original 15 vectors passed 50 state comparisons; additional 129/291 bounded card scan found five new behavior groups affecting six cards. Repairs underway; scan coverage and 162 skipped reasons remain explicit.'),
]
for key, detail in new_checks:
    if not any(key + ':' in c.get('description', '') for c in task['checks']):
        task['checks'].append({'result':'passed', 'description':f'[current evidence] {key}: {detail}', 'kind':'manual'})
task['unverified'] = [
    'Five fresh Core behavior differences (heal threshold, energy cap, existing-freeze extension, post-resolution replay condition, random-curse ordering/RNG) are being repaired from actual current consumers; fresh independent closure required.',
    'current-receipts-1 exited 2 at step 8 expecting DeathScreen before queued presentation finished. Inputs unchanged (330). Validation must wait for observable native settlement, then rerun all terminal and node receipt cases.',
    'Latest shared raw-icon helper repair, source quality presets and exact large-reading scope require current-visual-10 and fresh independent review; older captures do not validate these changes.',
    'Five-role native action/frame verification and actual four-layer journey remain pending. Background offscreen rendering, constructed events and hardware input remain separately reported.',
    'Final current Windows build and independent acceptance remain. No commit, push, publishing or foreground manipulation authorized.'
]
task['updatedAt'] = datetime.now(timezone.utc).isoformat()
task_path.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

registry_path = docs / 'PARALLEL-REGISTRY.md'
lines = registry_path.read_text(encoding='utf-8-sig').splitlines()
for index,line in enumerate(lines):
    if line.startswith('Friday（Unity桌面移植 WF-unity-desktop-1029'):
        archive = evidence / 'registry-history-before-current-validation.txt'
        if not archive.exists():
            archive.write_text(line+'\n',encoding='utf-8')
        lines[index] = 'Friday（Unity桌面移植 WF-unity-desktop-1029；01a18778），2026-10-30：持续目标实施中，老板授权按现行原始代码的模块架构、素材、布局与交互效果直接迁入Windows Unity，尽量复用；不重新设计。排除Agent/旧Web存档/研究第二图，仅现行四首BGM，仅后台。属地 SoudacheUnity/ 与自有 docs/evidence/2026-10-29-unity-desktop/；源Vite只读，不提交推送发布。Root负责Boot/Editor/原生集成与本台账；current_core_scan_fixes独占StructuredRules.cs及新source-semantics partial，处理独立扫描新增五组差异；current_receipts_validation_fix独占CurrentMigrationFlowValidation.Receipts/.Journey，修正真实动画结算等待；current_native_visual_independent只读审查新原生画面，其余实施片冻结。当前证据：current-visual-9原生30图/328输入不变，独立审查无P1、两处图标标记P2已修待复验；current-entry-1入口/设置/安全格/新档故障恢复通过。1226现行图片原尺寸无GPU二次压缩归一化通过、源图SHA未变。独立Core原15向量50项比较通过，129卡新扫描另检出6卡5组差异，修复进行中。current-receipts-1在死亡动画结束前断言而退出2，330输入不变，正在改为真实完成条件。待：新增偏好/大字阅读与图标原生复验、终局回执/四层/五人动作、独立闭环及最新Windows构建。历史占用与旧证据见本任务registry-history-before-current-validation.txt及各轮证据，不作现行验收结论。'
        break
else:
    raise RuntimeError('task registry row missing')
registry_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'task':str(task_path),'stage':task['stage'],'checks':len(task['checks'])},ensure_ascii=True))
