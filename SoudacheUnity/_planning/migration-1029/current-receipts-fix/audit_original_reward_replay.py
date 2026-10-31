"""Read-only audit of the old-seed/card-order native transition replay."""
from pathlib import Path
from collections import Counter
import hashlib,json,sys
sys.stdout.reconfigure(encoding='utf-8')
here=Path(__file__).resolve().parent
project=here.parents[2]
evidence=project.parent/'搜打撤/docs/evidence/2026-10-29-unity-desktop'
run=evidence/'current-reward-transition-1'
out=here/'journey-input-closure/original-profile-replay';out.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
trace=read(run/'rewardTransition-trace.json');result=read(run/'result.json');source=read(run/'reward-transition-source.json')
original=Path(source['source']);profile=Path(result['dataDirectory'])/'profile.json'
old=read(original)['runs']['5'];fresh=read(profile)['runs']['5'];node=fresh['nodeRewards']['3,9']
def one(kind):
    rows=[r for r in trace if r['kind']==kind]
    assert len(rows)==1,(kind,len(rows))
    return rows[0]
exact=one('exact-old-choice-object-raycasts');command=one('exact-old-first-choice-command');complete=one('exact-old-reward-transition-complete');reset=one('controlled-exact-reward-receipt-reset')
probe=next(r for r in trace if r['kind']=='current-reward-input-probe' and r['detail']['reason']=='exact-old-medium-before-native-render')
clicks=[r for r in trace if r['kind']=='ugui-raycast'];medium_click=next(r for r in clicks if r['step']==command['step'])
expected=old['nodeRewards']['3,9']['chestQueue'][0]['cardIds']+[old['nodeRewards']['3,9']['chestQueue'][1]['cardIds'][0]]
removed=set(reset['detail']['removedOwnedUids']);retained={c['uid'] for c in old['ownedCards']}-removed
new_owned=[c for c in fresh['ownedCards'] if c['uid'] not in retained]
checks={
 'nativeExitZeroAndInputsUnchanged':read(run/'process.json')['exitCode']==0 and read(run/'process.json')['inputsUnchanged'],
 'originalSeedAndNode':fresh['seed']==169015024 and fresh['layerIdx']==3 and fresh['trackPos']==9,
 'threeOriginalIdentitiesAndOrder':[r['card'] for r in exact['detail']['rows']]==old['nodeRewards']['3,9']['chestQueue'][1]['cardIds'],
 'allThreeExactObjectReceiversAndInsideMasks':len(exact['detail']['rows'])==3 and all(r['receiverIsExactTarget'] and r['inMasks'] for r in exact['detail']['rows']),
 'allThreeGraphicNativeDepthNotCulled':all(any(g['enabled'] and g['raycastTarget'] and not g['culled'] and g['depth']>=0 for g in t['graphics']) for t in probe['detail']['targets']),
 'firstOriginalCardActuallyClicked':command['detail']['card']==expected[-1] and abs(medium_click['detail']['x']-616)<.01 and abs(medium_click['detail']['y']-292)<.01 and medium_click['detail']['target']==medium_click['detail']['receiver'],
 'noExplicitNormalRenderRecovery':not command['detail']['normalRenderRecoveryNeeded'] and not complete['detail']['normalRenderRecoveryNeeded'] and not any(r['kind']=='current-reward-input-probe' and r['detail']['reason'] in ('before-native-render','after-native-render','exact-old-medium-after-native-render') for r in trace),
 'noScrollEvents':not any(r['kind']=='constructed-current-reward-scroll' for r in trace),
 'onlyExpectedThreeRealClicks':len(clicks)==3 and [r['detail']['target'] for r in clicks]==['全部收下','收下','继续探索'],
 'largeAndMediumSavedReceipts':node['completed'] and node['chestIndex']==2 and node['chestQueue'][0]['taken']==[0,1,2] and node['chestQueue'][0]['lost']==[] and node['chestQueue'][1]['taken']==[0] and node['chestQueue'][1]['lost']==[1,2] and all(b['coinsTaken'] and b['completed'] for b in node['chestQueue']),
 'priorGrantUidsRemovedAndRetainedUnchanged':not removed.intersection(c['uid'] for c in fresh['ownedCards']) and retained.issubset(c['uid'] for c in fresh['ownedCards']),
 'exactlyFourNewGrants':len(fresh['ownedCards'])==11 and len({c['uid'] for c in fresh['ownedCards']})==11 and sorted(c['card']['id'] for c in new_owned)==sorted(expected),
 'coinResetAndFreshSavedValue':reset['detail']['reversedCoins']==4 and fresh['coins']==old['coins']==32,
 'originalEvidenceShaUnchanged':sha(original)==source['sourceSha256']==read(here/'reward-transition-fixture-preflight.json')['sourceSha256'] and complete['detail']['originalEvidenceUnchanged'],
 'inputsBeforeAfterIdentical':read(run/'source-before.json')==read(run/'source-after.json'),
}
summary={'allRecordedChecksPass':all(checks.values()),'checks':checks,'process':read(run/'process.json'),
 'sourceProfileSha256':sha(original),'probe':probe,'exactObjectRows':exact,'firstChoiceCommand':command,'actualClicks':clicks,'controlledReset':reset,
 'freshSavedState':{'seed':fresh['seed'],'node':'3,9','coins':fresh['coins'],'owned':len(fresh['ownedCards']),'chestIndex':node['chestIndex'],'nodeCompleted':node['completed'],'boxes':node['chestQueue']},
 'originalFailureCauseDetermined':False,'capacityComparison':'Pending independent capacity_reload_check; this replay does not prove full capacity/reload parity.',
 'limitations':['The old failure frame did not record mask/depth/cull, so no causal attribution is possible.',
  'This controlled replay preserves seed/card order/transition but resets prior grants/coins; acquisition history and balance are not assessed.',
  'The explicit normal-render recovery and scroll branches did not run; the replay is not proof they fixed the old failure.',
  'Constructed native uGUI events are not OS hardware input.']}
inputs=[run/'process.json',run/'result.json',run/'rewardTransition-trace.json',run/'reward-transition-source.json',run/'source-before.json',run/'source-after.json',original,profile]
(out/'inputs.json').write_text(json.dumps({str(p.relative_to(project.parent)):sha(p) for p in inputs},indent=2,ensure_ascii=False),encoding='utf-8')
(out/'audit.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'allRecordedChecksPass':all(checks.values()),'checks':checks,'sourceProfileSha256':sha(original)},indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
