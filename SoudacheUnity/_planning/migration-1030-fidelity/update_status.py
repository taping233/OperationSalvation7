# -*- coding: utf-8 -*-
from pathlib import Path
from datetime import datetime, timezone
import argparse
import json

parser=argparse.ArgumentParser()
parser.add_argument('--complete',action='store_true')
args=parser.parse_args()
project=Path(__file__).resolve().parents[2]
evidence=project.parent/'搜打撤/docs/evidence/2026-10-29-unity-desktop'
directory=evidence/'fidelity-1030'
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
notes={
 'cjk-1':'真实字体中文折行、测量及网格一致性通过。',
 'film-flow-3':'完整过场时长、实际节点入口、首脑确认/写失败/重试通过；旧离屏字幕判断已撤销。',
 'frames-2':'264帧、五职业、真实攻击/受击、暂停/死亡末帧及30/60绘制上限通过。',
 'organizer-focus-2':'十项正式EventSystem连续决策、UID/邻行/安全格/文件锁/滚动/覆盖隔离通过。',
 'slot-archive-1':'实际新档/跨档LoadRun/战斗检查点/撤离恢复、文件锁、两实例和坏整档保全通过。',
 'journey-4':'429ticks四层、三闸门、祭坛、首脑、撤离、幂等和稳定基地通过；受控战力不作平衡证明。',
 'shop-source-4':'48条记录，正式交易、文件锁保留与重试、附赠、凭据两骰/恢复/反馈隔离通过。',
 'pile-3':'牌堆排序/聚合、阅读器、滚动回焦和日志边界回归通过。',
 'desktop-final-player-2':'48张正常Standalone实绘，2560×1440/DPI120/原生Canvas；备份实际导入确认、奖励详情领取一次/过期回调拒绝/满包整理通过。'
}
checks=[]
for name,note in notes.items():
    result=read(directory/name/'result.json')
    process=read(directory/name/'process.json')
    assert result['passed'] and process['exitCode']==0 and not process['timedOut'],name
    checks.append({'kind':'manual','result':'passed','description':'[fidelity-1030 current] '+name+'：'+note+' 证据限定于实际输入与记录范围。'})
build=read(directory/'desktop-final-build-2/process.json')
info=read(project/'Build/Desktop/build-info.json')
manifest=read(directory/'desktop-final-build-2/artifact-manifest.json')
density=read(directory/'desktop-final-player-2/density-comparison.json')
assert build['exitCode']==0 and build['inputsUnchanged'] and info['result']=='Succeeded' and info['errors']==0 and info['inputsUnchanged']
assert manifest['passed'] and density['passed']
checks.append({'kind':'manual','result':'passed','description':'[fidelity-1030 current] desktop-final-build-2：默认Desktop更新，0错误，'+str(len(info['inputs']))+'项构建输入前后一致；'+str(len(manifest['files']))+'个产物完整SHA及大文件清单已登记。22文本密度样本通过；一处自适应视口断行差异保留。'})
reviews=[
 project/'_planning/migration-1030-fidelity/independent-final-review/player2-review.json',
 project/'_planning/migration-1030-fidelity/menu-hub-independent/visual-final-player2.json',
 project/'_planning/migration-1030-fidelity/completion-audit.json'
]
if args.complete:
    for path in reviews:
        review=read(path)
        assert review['passed'] and not review['confirmedOpenItems'],str(path)
    checks.append({'kind':'manual','result':'passed','description':'[fidelity-1030 current] 三路独立审查已核实新包改动画面、选档/备份/指南及24类范围证据，确认项全部闭合；completion-audit复核当前构建输入与运行源指纹。'})
limits=[
 '未做物理键鼠长按与多尺寸检查；本轮后台构造EventSystem输入、正式领域命令、受控场景和实际Standalone绘制分别记录。',
 '没有全291卡任意组合或全部自然随机流程穷举声明；规则69场景、商店104源对照与本轮专项各按输入限定。',
 '未提交、推送或发布，远端CI未覆盖本轮本地改动。'
]
if not args.complete: limits.insert(0,'最终独立审查尚未关闭。')
task_path=evidence/'task.json'
task=read(task_path)
task['checks']=[c for c in task['checks'] if not c['description'].startswith('[fidelity-1030 current]')]+checks
task.update(stage='complete-uncommitted' if args.complete else 'doing',updatedAt=datetime.now(timezone.utc).isoformat(),unverified=limits)
write(task_path,task)
progress={
 'stage':task['stage'],'updatedAt':task['updatedAt'],
 'authority':'Current active source execution, final CSS and actual consumers; source prose checked against execution.',
 'codeDifferences':'../../../../../SoudacheUnity/_planning/migration-1030-fidelity/code-differences.md',
 'nativePlayer':'desktop-final-player-2/result.json','nativeChecks':list(notes),
 'build':'desktop-final-build-2/artifact-manifest.json','buildGUID':manifest['buildGUID'],
 'independentReviews':[str(p.relative_to(project)) for p in reviews],
 'limitations':limits,
 'previousFailures':['player-1','player-2','player-3','player-4','player-5','film-flow-1','film-flow-2','journey-1','journey-2','frames-1','organizer-focus-1','shop-source-1'],
 'saves':'Isolated evidence profiles only; user saves untouched.',
 'delivery':'Build/Desktop/代号柒.exe; preserve the entire Desktop directory.'
}
write(directory/'progress.json',progress)
print(json.dumps({'stage':task['stage'],'nativeEvidence':len(notes),'reviewsClosed':args.complete,'buildGUID':manifest['buildGUID']},ensure_ascii=True))
