# -*- coding: utf-8 -*-
from pathlib import Path
import hashlib
import json

project=Path(__file__).resolve().parents[2]
target=project/'Assets/Resources/Data/CurrentBeginnerGuide.json'
out=project/'_planning/migration-1030-fidelity/text/guide-copy-corrections.json'
assert not out.exists(),'Correction receipt already exists; inspect before rerunning.'
document=json.loads(target.read_text(encoding='utf-8-sig'))
changes=[]
corrections={
    ('loot',1):('看清不同失败方式','倒下时，安全格中的卡牌和安全格珍珠盒保护的资源会被抢运，带入牌也按此规则处理；主动放弃会排除带入牌，只抢运符合条件的本局所得。未受保护的随身牌与消耗区卡牌会散失。'),
    ('extract',2):('普通战斗撤退按失败结算','点击普通战斗的撤退会结束本局，按倒下时的安全格抢运规则结算；主动放弃则不保留带入牌。烟雾弹等卡牌逃跑按各自效果处理。'),
    ('extract',0):('编组前先整理行装','普通背包与安全格中的可编组卡牌都能参与；容器里的牌需先移回普通背包。“对战开始时”装备计入编组并占装备栏；编入混沌之眼可增加 5 张牌库上限。')
}
before=hashlib.sha256(target.read_bytes()).hexdigest()
for (page_id,index),(title,text) in corrections.items():
    page=next(page for page in document['pages'] if page['id']==page_id)
    note=page['notes'][index]
    changes.append({'path':f'pages.{page_id}.notes.{index}','before':dict(note),'after':{'title':title,'text':text}})
    note.update(title=title,text=text)
target.write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
receipt={'authority':'User: original concrete execution is authoritative; source prose can be wrong.',
    'sourceBeforeSha256':before,'correctedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'changes':changes,
    'sourceExecution':['game/src/run/game.session.death.js:141','game/src/hub/run-rescue-cards.js:2','game/src/battle/core/battle.enemy-phase.domain.js:495','game/src/battle/core/battle.lifecycle.domain.js:419'],
    'nativeExecution':['Assets/Scripts/Sdt.Run/GameRuntime.Settlement.cs:116','Assets/Scripts/Sdt.Run/GameRuntime.Settlement.cs:128','Assets/Scripts/Sdt.Core/Battle/BattleSession.cs:467'],
    'boundary':'Only these three prose entries are corrected. All domain rules and Vite source remain unchanged.'}
out.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'corrected':len(changes),'sha256':receipt['correctedSha256']}))
