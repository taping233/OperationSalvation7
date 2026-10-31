# -*- coding: utf-8 -*-
from pathlib import Path
import json
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[4]
docs = root / '搜打撤' / 'docs'
evidence = docs / 'evidence' / '2026-10-29-unity-desktop'
task_path = evidence / 'task.json'
task = json.loads(task_path.read_text(encoding='utf-8-sig'))
checks = {
    'current-core-independent/final-closure': 'Independent fresh source/Core execution passed 69 specified scenarios (15 original, 6 repaired cards, 12 fixed-seed RNG, 36 complex consumers). 43 current production Core sources match frozen snapshot, source 677 inputs unchanged. Bounded closure; no exhaustive schema-combination claim.',
    'current-visual-10': '35 native offscreen frames plus atlas generated; 331 source inputs unchanged. Fresh independent review viewed every image: prior icon-marker findings closed, no new confirmed P1/P2. Large-card inner-scroll endpoint is covered separately.',
    'current-receipts-4': 'Native terminal/node workflow passed with 334 inputs unchanged: extraction/death/surrender/abandon, file-write failure and retry, stable card/receipt identities and no duplicate credit, fire, multi-card chest completion retained until Continue, and event progress.',
    'current-reading-scroll-1': 'Native shared large-card description wheel routing passed, 334 inputs unchanged. RaycastAll and scrollHandler reached bottom and returned to top, content bottom aligned within viewport, source thin scrollbar present. Three actual offscreen captures; no hardware input.',
}
for key, detail in checks.items():
    if not any(key+':' in c.get('description','') for c in task['checks']):
        task['checks'].append({'result':'passed','description':'[current evidence] '+key+': '+detail,'kind':'manual'})
task['unverified'] = [
    'Current complete four-layer native journey is running; fresh entry workflow and corrected frame-evidence labels still require native runs.',
    'Independent review of the three reading-scroll images and updated multi-card reward completion images is in progress.',
    'Final current Windows build, source/media manifest and consolidated acceptance remain. All checks are background/offscreen or constructed native input; no OS hardware input.'
]
task['updatedAt'] = datetime.now(timezone.utc).isoformat()
task_path.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
registry_path = docs / 'PARALLEL-REGISTRY.md'
lines = registry_path.read_text(encoding='utf-8-sig').splitlines()
for index,line in enumerate(lines):
    if line.startswith('Friday（Unity桌面移植 WF-unity-desktop-1029'):
        lines[index] = 'Friday（Unity桌面移植 WF-unity-desktop-1029；01a18778），2026-10-30：持续目标实施与最终复验中。按现行原始代码的模块架构、素材、布局及效果直接迁入Windows Unity，尽量复用，不重新设计。排除Agent/旧Web存档/研究第二图；仅现行四首BGM，仅后台。属地 SoudacheUnity/ 与自有 docs/evidence/2026-10-29-unity-desktop/；源Vite只读，不提交推送发布。Root负责集成/Boot/Editor/原生验收/构建及台账，所有实施片已freeze；current_native_visual_independent只读补审滚动3图与最新奖励完成页，其他独立Core/帧审查已收官。794份原始运行源码SHA复核无漂移。当前证据：current-visual-10原生35图/331输入未变，独立审查已闭环图标标记且无新增确认P1/P2；严格1226现行图片原尺寸无GPU二次压缩通过。Core最终独立fresh闭环69场景同源、43生产源码一致；复杂消费者和先前5组修复已全部落地。current-receipts-4已通过终局/失败重试/火堆/多卡箱保留完成态与Continue/事件，334输入未变；current-reading-scroll-1真实程序uGUI轮滚至底返顶通过。五人264帧32图独立复核未见生产缺陷，旧转帧证据fixture标签已修待新跑。当前后台current-journey-1 PID34020，执行实际四层门/祭坛/首脑/终局命令，条件化高战力夹具不作平衡证明。待最新入口/帧标签复验、补审及Windows构建；历史现场与旧失败均保留在本任务证据，当前状态见task.json。'
        break
else:
    raise RuntimeError('task registry row missing')
registry_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'stage':task['stage'],'checks':len(task['checks'])}))
