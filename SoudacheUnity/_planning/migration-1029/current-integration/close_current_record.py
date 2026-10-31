# -*- coding: utf-8 -*-
from pathlib import Path
import json
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[4]
docs = root / '搜打撤' / 'docs'
evidence = docs / 'evidence' / '2026-10-29-unity-desktop'
task_path = evidence / 'task.json'
task = json.loads(task_path.read_text(encoding='utf-8-sig'))
for directory in ['current-entry-2','current-receipts-4','current-journey-2','current-reading-scroll-1','current-unit-frames-2','current-reward-transition-1']:
    result = json.loads((evidence/directory/'result.json').read_text(encoding='utf-8-sig'))
    process = json.loads((evidence/directory/'process.json').read_text(encoding='utf-8-sig'))
    assert result['passed'] and process['exitCode']==0 and process['inputsUnchanged'],directory
build = json.loads((evidence/'current-build-2'/'process.json').read_text(encoding='utf-8-sig'))
artifact = json.loads((evidence/'current-build-2'/'artifact-manifest.json').read_text(encoding='utf-8-sig'))
assert build['exitCode']==0 and build['inputsUnchanged'] and artifact['passed']
prior = evidence/'task-before-final-acceptance.json'
if not prior.exists():
    prior.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
descriptions = [
    '现行原始代码24类玩家界面沿实际模块/布局/素材/交互迁入；794份运行源复核无漂移，11份正式素材收据源端1270条/输出1287条SHA一致；4首现行BGM无旧曲回退。',
    'current-visual-10生成35张原生画面，独立逐图审查与18张专项补证闭环；图标标记、长文内滚、奖励完成态已修并复验，无未闭环确认P1/P2。',
    'current-entry-2通过标题/设置/按键映射/照片背签/选档整备/安全格/读档与文件写失败重试；335项输入未变，构造uGUI输入边界明确。',
    'current-receipts-4通过撤离/死亡/主动撤离/放弃/火堆/多卡箱/事件，含失败恢复、稳定身份与防重复；334项输入未变。',
    'current-journey-2通过实际四层门/祭坛/首脑/终局撤离/入库/回基地；原失败档同种子同卡序current-reward-transition-1三候选命中及领取落盘通过；旧当帧根因不作推定。',
    'current-reading-scroll-1末句可达并回顶，current-unit-frames-2验证五人264资源与代表真实命令；独立复核已闭环夹具标签，物理输入与fixture分别记录。',
    'current-core-independent/final-closure用当前43源码新快照与真实源重跑69指定场景全部同源；1814/289/167、支付46、目标47相关回归通过，不宣称穷举任意schema组合。',
    'current-build-2 Windows构建退出0/0错误；336项源码检查及3784项全Assets/设置/包/媒体输入未变；166个产物文件SHA已登记，源码审查/产物清单见ACCEPTANCE.md。',
    '交付预检doctor --staged退出0；无提交、推送或发布。背包25→16疑点经独立证据确认为已消耗珍珠宝盒的9格资源空间，本次无读档容量丢失。'
]
task['stage']='complete-uncommitted'
task['checks']=[{'result':'passed','description':item,'kind':'manual'} for item in descriptions]
task['unverified']=['后台原生单一1920×1080参考窗口、构造uGUI输入及记录的真实领域命令；未作物理键鼠、650ms硬件长按、多尺寸或全部自然随机状态穷举。详见ACCEPTANCE.md覆盖边界；Agent/旧Web存档/研究第二图及关闭制作坊不在首版范围。']
task['updatedAt']=datetime.now(timezone.utc).isoformat()
task_path.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
registry_path=docs/'PARALLEL-REGISTRY.md'
lines=registry_path.read_text(encoding='utf-8-sig').splitlines()
owned=[i for i,line in enumerate(lines) if line.startswith('Friday（Unity桌面移植 WF-unity-desktop-1029')]
assert len(owned)==1
lines.pop(owned[0])
released=lines.index('## 近期已释放')
lines.insert(released+2,'Friday（Unity桌面移植 WF-unity-desktop-1029；01a18778），2026-10-30：既定Windows桌面首版完成未提交，自有编辑/原生进程占用已释放。SoudacheUnity/及自有证据归本任务；现行原始代码24类页面与玩法沿架构/效果迁入，Agent/旧Web档/研究第二图与关闭制作坊排除，Godot/旧EXE冻结，后台only，现行4首BGM。最新35图与18专项图、入口2/回执4/四层旅程2/长文滚动1/五人帧2/原失败档奖励重放1及独立Core69场景闭环通过；源码794与媒体双端SHA无漂移。Windows current-build-2退出0/0错误，3784全输入一致，166产物SHA已记，启动SoudacheUnity/Build/Desktop/代号柒.exe。旧一次奖励命中当帧原因不推定，同种子/卡序全部三候选已真实命中且无补救；背包容量差异已独立查明容器消耗。物理输入/夹具/参考尺寸及排除范围见docs/evidence/2026-10-29-unity-desktop/ACCEPTANCE.md，当前task.json为complete-uncommitted。不提交推送发布，无本会话前台播放器或保留服务。')
registry_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'stage':task['stage'],'checks':len(task['checks']),'registry':'released'}))
