# -*- coding: utf-8 -*-
from pathlib import Path
import json,hashlib
from datetime import datetime,timezone
p=Path(__file__).resolve().parent
unity=p.parents[2]
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
production=unity/'Assets/Scripts/Sdt.Core'
production_hashes={str(f.relative_to(production)).replace('\\','/'):sha(f) for f in production.rglob('*.cs')}
snapshot_hashes={str(f.relative_to(p/'snapshot')).replace('\\','/'):sha(f) for f in (p/'snapshot').rglob('*.cs')}
assert production_hashes==snapshot_hashes,'Production Core changed since fresh snapshot'
comparison=json.loads((p/'comparison.json').read_text(encoding='utf-8'))
assert comparison['passed'] and comparison['vectors']==36
source_root=unity.parent/'搜打撤/game/src'
source_hashes={str(f.relative_to(source_root)).replace('\\','/'):sha(f) for f in source_root.rglob('*') if f.is_file() and f.suffix in ['.js','.json']}
receipt={
 'frozen':True,'at':datetime.now(timezone.utc).isoformat(),
 'productionFiles':['Battle/StructuredRules.cs','Battle/BattleSession.cs','Battle/BattleComplexSourceSemantics.cs'],
 'productionCoreSha256':production_hashes,'sourceInputsSha256':source_hashes,
 'actualSourceVectors':{'count':36,'allEqual':True,'randomStreamStatesEqual':True,
   'gateFirstTurn':'8 seeds x empty/missing-armor/only-purify (24 vectors); player and two actual summoned allies',
   'gateOtherDoor':'8 seeds; first selected door then turn 3/4 automatic other-door repeat; state and generation stream checks',
   'recruit':'actual wounded foe carries armor/shield/poison/freeze/reduce/spellUp; two real EndTurn calls; poison death and stealth expiry variants',
   'noInfuse':'actual Spiritual Summon seed 1 offers Dragon Ray at option 2; selected instance marked, played with no fuel and deals 13 damage'},
 'regression':{'currentTargetsAndAdjacent':1814,'forecastAndAdjacent':289,'cardSemantics':167,'paymentBoundary':46,'targetBoundary':47,
    'singleCardScan':{'tested':129,'exact':128,'remaining':'cmtn1r10xnl1: known discoverPlus state-storage projection only'}},
 'discoveredAdjacentGapsFixed':['discover candidates drawn from complete pool with ID/name collision retry limit 40 (not without replacement)',
    'other-door randomCurse uses generation RNG and missing means status not >0',
    'repeat jobs retain registration order relative to not-yet-due jobs'],
 'scope':'Actual JS engine via Vite SSR and fresh production Core snapshot via dotnet; no Unity/native/UI/hardware-input claim',
 'boundaries':['Known combat fields and outstanding attack restoration entries cloned; source intent and hostile marks are not transferred.',
    'Core has no live TimeRune flag (only forecast DTO defaults false); source fixtures use the default evaluateRunes={} port. This change covers unconditioned ally poison clock (one pass); Root must reconcile rune reachability with the agreed migration scope separately.',
    'No generic async queue redesign or arbitrary synthetic schema combinations; existing source-only replay/handSelect limitation remains as separately recorded.']
}
(p/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frozen':True,'vectors':36,'sourceFiles':len(source_hashes),'coreFiles':len(production_hashes),'files':{f:production_hashes[f] for f in receipt['productionFiles']}},ensure_ascii=True))
