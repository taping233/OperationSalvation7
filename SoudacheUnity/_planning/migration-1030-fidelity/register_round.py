# -*- coding: utf-8 -*-
from pathlib import Path
import json
from datetime import datetime, timezone

root=Path(__file__).resolve().parents[3]
docs=root/'搜打撤'/'docs'
evidence=docs/'evidence'/'2026-10-29-unity-desktop'
round_dir=evidence/'fidelity-1030'
round_dir.mkdir(exist_ok=True)
task_path=evidence/'task.json'
task=json.loads(task_path.read_text(encoding='utf-8-sig'))
backup=round_dir/'task-before-user-feedback.json'
if not backup.exists(): backup.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
task['stage']='doing'
for item in task['checks']:
    if not item['description'].startswith('[previous bounded evidence]'):
        item['description']='[previous bounded evidence] '+item['description']
task['unverified']=[
    '2026-10-30老板实机反馈：过场遗漏、多处文字不对、排版问题、清晰度很低；此前完整验收结论撤销，按实际现行源码重新修正。',
    '现行silent-node-film及真实节点/战斗/跨层/结算触发链未完整迁入；旧字幕过场不作依据。',
    '生存指南仍旧摘要等当前真实文案/页面调用链差异正在修，不能只靠formatter旧向量。',
    '实际Standalone的分辨率/DPI/Canvas和局部缩放文字密度未证明；强制1920离屏图不代表实际清晰度。',
    '公共卡面排版、真实播放器后台画面与动作时序需新证据及独立审查；保留老板当前存档及已有产物，不提交推送。'
]
task['updatedAt']=datetime.now(timezone.utc).isoformat()
task_path.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
registry=docs/'PARALLEL-REGISTRY.md'
lines=registry.read_text(encoding='utf-8-sig').splitlines()
for i,line in enumerate(lines):
    if line.startswith('Friday（Unity桌面演示 WF-unity-desktop-1029'):
        lines[i]=line+' 2026-10-30复核PID42072已退出，不再视为在运行演示。'
    elif line.startswith('Friday（Unity桌面移植 WF-unity-desktop-1029'):
        lines[i]='历史记录（此前结论已被老板实机反馈否定，现已重开）：'+line
index=lines.index('## 活跃登记')
lines.insert(index+2,'Friday（Unity实机反馈修正 WF-unity-desktop-1029；01a18778），2026-10-30：老板反馈过场遗漏、文案错误、排版与低清晰度，持续目标重开。范围SoudacheUnity/及自有docs/evidence/2026-10-29-unity-desktop/fidelity-1030/，源Vite只读。Root独占公共CardFace/布局/Editor集成与共享记录；source_transition_restore独占CurrentRunFilm/Profiles/shader及RunLoopBridge/BattleBridge/NodeModals/ExtractScreens呈现hook；source_text_fidelity独占当前formatter与Menu/Hub/Misc纯文案、生存指南新组件/素材与GuideScreen接线；player_clarity_fidelity独占GameBoot/App/CurrentNativePerformance/InlineIconText及后台实际Standalone诊断、必要渲染配置。各线私有检查，Root统一原生/构建，禁止CUA/前台操控或改用户存档；Agent/旧Web档/研究第二图排除，仅现行BGM，不提交推送。此前35图/规则等仅保留限定证据，不能代替实机效果。')
registry.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'stage':task['stage'],'round':str(round_dir)},ensure_ascii=True))
