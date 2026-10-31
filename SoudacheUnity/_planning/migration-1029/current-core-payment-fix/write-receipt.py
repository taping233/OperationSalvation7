from pathlib import Path
import json,hashlib,datetime
p=Path(__file__).parent;root=p.parents[2]
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
source=root.parent/'搜打撤/game/src'
sources=['battle/core/battle.hand-selection.js','battle/core/battle.exec-play.domain.js','battle/core/battle.selection-flow.domain.js','battle/view/battle.hand-material-selection.js','battle/effects/battle.card-cost.js','battle/core/battle.damage.domain.js','cards/card-legacy-battle-policy.js','battle/effects/effect-steps.m1.domain.js','battle/effects/equipment-semantic-operations.js','battle/core/battle.engine.factory.domain.js']
manifest=json.loads((p/'apply-manifest.json').read_text(encoding='utf-8'))
r={'status':'private validation complete; production visual-window lock pending','timestamp':datetime.datetime.now().isoformat(),'sourceSha256':{f:sha(source/f) for f in sources},'privateSourceSha256':{str(f.relative_to(p)):sha(f) for f in list((p/'snapshot/Battle').glob('BattleHandPayment.cs'))+list((p/'snapshot/Battle').glob('BattleRuleConsumers.cs'))},'validation':{'fullSevenAssemblies':'0 errors; 10 existing warnings','paymentBoundary':45,'sourceRound1':'8 vectors identical on hands, consumed, armor, foeHp, energy; cost-rule custom fixtures separate','sourceRound2':'cicada normal+boss onConsume 4 damage before draw; scale seed1 two enemies [94,100], hp26, hand1','regression':{'battle':1814,'forecast':289,'cardSemantics':167}},'productionTargets':[m['path'] for m in manifest],'native':'not run; Root owns editor and real-input acceptance','pendingIntegration':'target_retention agent CanUseAsInfusionFuel and prepared target guard; production apply waits Root explicit release'}
(p/'receipt.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
for rel,target in [('integration/BattleChecks.cs','_planning/migration-1029/current-core-payment-fix/integration-results.json'),('semantics/Audit.cs','_planning/migration-1029/current-core-payment-fix/semantics-results.json')]:
 f=p/rel;s=f.read_text(encoding='utf-8-sig');old='_planning/migration-1029/'+('current-integration/battle-results.json' if rel.startswith('integration') else 'card-semantics-fix/unity-results.json');f.write_text(s.replace(old,target),encoding='utf-8')
print('Wrote private source and validation receipt')
