from pathlib import Path
import json, hashlib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
E = ROOT / '搜打撤/docs/evidence/2026-10-29-unity-desktop'
A = E / 'current-journey-1/profile-journey-20261029235058182/profile.json'
B = E / 'current-reward-transition-1/profile-rewardTransition-20261030002552658/profile.json'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
a, b = read(A), read(B)
ar, br = a['runs']['5'], b['runs']['5']
basekey = 'sdt-base-v2-slot5'
def bonus(cards):
    total = 0
    for o in cards:
        c = o['card']; equip = (c.get('rules') or {}).get('equip')
        rule = (equip or {}).get('container')
        if rule and rule.get('slots', 0) > 0:
            total += rule['slots'] if rule.get('accepts') == '资源' else 0
        elif equip is None and c['id'] == 'tt2-pearlbox': total += 9
    return total
reset = next(x['detail'] for x in read(E/'current-reward-transition-1/rewardTransition-trace.json') if x['kind']=='controlled-exact-reward-receipt-reset')
removed = reset['removedOwnedUids']
after = [o for o in ar['ownedCards'] if o['uid'] not in removed]
assert len(after) == reset['ownedAfterReset'] == 7
assert bonus(ar['ownedCards']) == bonus(after) == bonus(br['ownedCards']) == 0
assert a['global'][basekey]['bagUp'] == b['global'][basekey]['bagUp'] == 0
assert a['global'][basekey]['BagCap'] == b['global'][basekey]['BagCap'] == 16
assert reset['capacity'] == 16
assert ar['seed'] == br['seed'] == 169015024
assert ar['layerIdx'] == br['layerIdx'] == 3
assert ar['trackPos'] == br['trackPos'] == 9
timeline = []
for event in read(E/'current-journey-1/journey-trace.json'):
    if event['kind'] != 'capture': continue
    texts = [i['SourceText'] for i in event['detail']['capture'].get('icons', [])]
    if event['tick'] in (110, 115, 119, 141, 154):
        timeline.append(dict(tick=event['tick'], name=event['detail']['name'], texts=[t for t in texts if '/25' in t or '/16' in t or '3×3' in t]))
files = [A, B, E/'current-journey-1/journey-trace.json', E/'current-reward-transition-1/rewardTransition-trace.json', E/'current-journey-1/journey-page-ChestOpenScreen-3.png', E/'current-reward-transition-1/rewardTransition-exact-old-medium-selected.png']
for p in ['SoudacheUnity/Assets/Scripts/Sdt.Run/GameRuntime.cs','SoudacheUnity/Assets/Scripts/Sdt.Run/BaseData.cs','SoudacheUnity/Assets/Scripts/Sdt.Run/CardContainerCommands.cs','SoudacheUnity/Assets/Scripts/Sdt.Core/GameRules.cs','SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Run/ChestOpenScreen.cs','SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Run/CurrentRewardScene.cs','SoudacheUnity/Assets/Editor/CurrentMigrationFlowValidation.Journey.cs','SoudacheUnity/Assets/Editor/CurrentMigrationFlowValidation.RewardTransition.cs','搜打撤/game/src/core/card-capacity.js','搜打撤/game/src/hub/base.js','搜打撤/game/src/run/game-session-restoration.js','搜打撤/game/src/run/game.session.bag.js']:
    files.append(ROOT/p)
result = dict(passed=True, scope='read-only JSON/code directed check; no Unity execution', sourceProfile=str(A), targetProfile=str(B), baseUpgrade=0, baseCapacity=16, resourceBonusBeforeReset=bonus(ar['ownedCards']), resourceBonusAfterReset=bonus(after), resourceBonusAfterReplay=bonus(br['ownedCards']), removed=[dict(uid=o['uid'],id=o['card']['id']) for o in ar['ownedCards'] if o['uid'] in removed], timeline=timeline, sha256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files})
(OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ('sha256','timeline')},ensure_ascii=False,indent=2))
