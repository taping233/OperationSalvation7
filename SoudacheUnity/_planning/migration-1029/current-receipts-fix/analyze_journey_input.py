"""Read-only native evidence audit; writes only the owned closure directory."""
from pathlib import Path
from collections import Counter
import hashlib, json, sys
sys.stdout.reconfigure(encoding='utf-8')
here=Path(__file__).resolve().parent
project=here.parents[2]
evidence=project.parent/'搜打撤/docs/evidence/2026-10-29-unity-desktop'
old=evidence/'current-journey-1'
current=evidence/'current-journey-2'
out=here/'journey-input-closure';out.mkdir(exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inside(point,bounds):return bounds['minX']-.01<=point['x']<=bounds['maxX']+.01 and bounds['minY']-.01<=point['y']<=bounds['maxY']+.01
trace=read(current/'journey-trace.json')
probes=[r for r in trace if r['kind']=='current-reward-input-probe']
reasons=Counter(r['detail']['reason'] for r in probes)
rows=[];preferred_clicks=[]
for probe in probes:
    detail=probe['detail'];targets=detail['targets']
    for ordinal,target in enumerate(targets):
        center=target['center'];bounds=target['bounds'];masks=target['masks'];hits=target['hits'];graphics=target['graphics']
        other_contains=[i for i,t in enumerate(targets) if i!=ordinal and inside(center,t['bounds'])]
        row={'step':probe['step'],'tick':probe['tick'],'reason':detail['reason'],'node':detail['node'],'chestIndex':detail['chestIndex'],'ordinal':ordinal,**target,
            'audit':{'inScreen':inside(center,{'minX':0,'minY':0,'maxX':1920,'maxY':1080}),
                'independentMaskContains':all(inside(center,m['bounds']) for m in masks),
                'firstHitNameMatches':bool(hits) and hits[0]['name']==target['name'],
                'firstReceiverNameMatches':bool(hits) and hits[0]['receiver']==target['name'],
                'receiverNameMatches':target['receiver']==target['name'],
                'enabledRaycastGraphicHasNativeDepthAndNotCulled':any(g['enabled'] and g['raycastTarget'] and g['depth']>=0 and not g['culled'] for g in graphics),
                'otherCandidateBoundsContainCenter':other_contains}}
        rows.append(row)
    next_records=trace[trace.index(probe)+1:]
    next_click=next((r for r in next_records if r['kind'] in ('ugui-raycast','current-reward-input-probe')),None)
    preferred=targets[0]
    ok=next_click is not None and next_click['kind']=='ugui-raycast'
    if ok:
        click=next_click['detail'];ok=click['target']==preferred['name'] and click['receiver']==click['target'] and abs(click['x']-preferred['center']['x'])<.1 and abs(click['y']-preferred['center']['y'])<.1
    preferred_clicks.append({'probeTick':probe['tick'],'node':detail['node'],'chestIndex':detail['chestIndex'],'preferredCard':preferred['card'],'preferredCenter':preferred['center'],'preferredWasActuallyClicked':ok,'click':next_click})
stats={key:sum(bool(r['audit'][key]) for r in rows) for key in rows[0]['audit'] if key!='otherCandidateBoundsContainCenter'}
stats['centersInsideAnotherCandidateBounds']=sum(bool(r['audit']['otherCandidateBoundsContainCenter']) for r in rows)
before=read(old/'source-before.json');after=read(current/'source-before.json')
changes=[{'path':key,'old':before.get(key),'new':after.get(key)} for key in sorted(before.keys()|after.keys()) if before.get(key)!=after.get(key)]
old_profile=read(Path(read(old/'result.json')['dataDirectory'])/'profile.json')
new_profile=read(Path(read(current/'result.json')['dataDirectory'])/'profile.json')
old_run=old_profile['runs']['5'];settlements=new_profile['settlements'];new_settlement=settlements['5']
old_box=old_run['nodeRewards']['3,9']['chestQueue'][1]
new_run=new_settlement['run'];new_box=new_run['nodeRewards']['3,9']['chestQueue'][1]
summary={'originalCauseDetermined':False,'currentScope':'programmatically constructed native uGUI at 1920x1080; no OS hardware input',
    'process':read(current/'process.json'),'probeReasons':dict(reasons),'probeCount':len(probes),'candidateSampleCount':len(rows),'candidateAuditCounts':stats,
    'preferredClickedExactly':sum(p['preferredWasActuallyClicked'] for p in preferred_clicks),
    'normalRenderFallbackExecuted':reasons['before-native-render']+reasons['after-native-render']>0,
    'scrollEvents':sum(r['kind']=='constructed-current-reward-scroll' for r in trace),'blockedImages':[p.name for p in current.glob('*blocked*.png')],
    'originalSeed':old_run['seed'],'currentSeed':new_run['seed'],'originalCardIds':old_box['cardIds'],'currentCardIds':new_box['cardIds'],
    'currentChoiceReceipt':{'taken':new_box['taken'],'lost':new_box['lost'],'completed':new_box['completed']},
    'currentOriginalPointSamples':[r for r in rows if r['node']=='3,9' and r['chestIndex']==1],
    'sourceChangesBetweenRuns':changes,'changedProductionScriptCount':sum(c['path'].startswith('Assets/Scripts/') for c in changes),
    'limitations':['Journey 1 did not capture depth/cull/mask or a failure frame, so the original transient blocker cannot be classified.',
        'Journey 2 used a different seed and different card identities; equivalent position/choice topology is not an exact replay.',
        'All candidate probes record receiver names, not stable object identities; exact object equality is additionally asserted for each actually selected preferred button by the live helper/Click.',
        'The normal-render and scroll fallback branches did not run; this evidence cannot claim either fixed the original failure.']}
visible=[r for r in rows if r['audit']['inScreen'] and r['audit']['independentMaskContains']]
summary['visibleCandidateSamples']=len(visible)
summary['visibleCandidateFailures']=[r for r in visible if not all(r['audit'][key] for key in ('firstHitNameMatches','firstReceiverNameMatches','receiverNameMatches','enabledRaycastGraphicHasNativeDepthAndNotCulled'))]
summary['nonVisibleCandidateSamples']=[r for r in rows if r not in visible]
inputs=[old/'journey-trace.json',old/'result.json',old/'process.json',old/'source-before.json',current/'journey-trace.json',current/'result.json',current/'process.json',current/'source-before.json',current/'source-after.json',Path(read(old/'result.json')['dataDirectory'])/'profile.json',Path(read(current/'result.json')['dataDirectory'])/'profile.json']
(out/'inputs.json').write_text(json.dumps({str(p.relative_to(project.parent)):sha(p) for p in inputs},indent=2,ensure_ascii=False),encoding='utf-8')
(out/'candidate-audit.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding='utf-8')
(out/'preferred-clicks.json').write_text(json.dumps(preferred_clicks,indent=2,ensure_ascii=False),encoding='utf-8')
(out/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k not in ('currentOriginalPointSamples','process','limitations','sourceChangesBetweenRuns')},indent=2,ensure_ascii=False))
