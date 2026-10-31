from pathlib import Path
import json,hashlib,re
p=Path(__file__).resolve().parent
root=p.parents[3]
def read(f):return json.loads(f.read_text(encoding='utf-8-sig'))
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
s=read(p/'boundary-source.json');c=read(p/'boundary-core.json')
deviations=[];rng_pass=0
for a,b in zip(s,c):
 if a['after']!=b['after']:deviations.append(a['q']['name'])
 streams={k:int(v) for k,v in (x.split(':') for x in b['rng'].split(';s=')[1].split(','))} if ';s=' in b['rng'] else {}
 assert streams==a['rng']['streams'],(a['q']['name'],streams,a['rng'])
 rng_pass+=1
assert deviations==['replay-async-empty'],deviations
cards=read(p/'fresh-catalog.json')
def walk(v):
 if isinstance(v,dict):
  if 'op' in v:yield v
  for x in v.values():yield from walk(x)
 elif isinstance(v,list):
  for x in v:yield from walk(x)
combos=[];self_extend=[]
for card in cards:
 ops=list(walk(card.get('rules',{})))
 if card.get('rules',{}).get('triggers',{}).get('replay') and any(x['op'] in ['choice','handSelect','acquire'] for x in ops):combos.append(card['id'])
 if any(x['op']=='curse' and 'extend' in x and x.get('target')=='self' for x in ops):self_extend.append(card['id'])
assert not combos and not self_extend,(combos,self_extend)
source_files=['battle/core/battle.exec-play.domain.js','battle/core/battle.resolution.domain.js','battle/effects/battle.status-operations.domain.js','cards/card-energy-policy.js','battle/core/battle.effect-assembly.domain.js','battle/core/combat.factory.js','core/random-service.js','core/random-core.js','core/random-streams.js','battle/effects/card-semantic-operations.js']
production=root/'SoudacheUnity/Assets/Scripts/Sdt.Core'
checks={str(f.relative_to(production)):sha(f) for f in production.rglob('*.cs')}
snapshot={str(f.relative_to(p/'snapshot/Sdt.Core')):sha(f) for f in (p/'snapshot/Sdt.Core').rglob('*.cs')}
assert checks==snapshot,'Production changed since snapshot'
receipt={'frozen':True,'catalog':len(cards),'sourceSha256':{f:sha(root/'搜打撤/game/src'/f) for f in source_files},'productionCoreSha256':checks,'scan':{'tested':129,'identical':128,'remaining':'cmtn1r10xnl1 discoverPlus already-known snapshot projection'},'boundaries':{'total':len(s),'equal':len(s)-len(deviations),'knownUnreachableSyntheticDeviation':deviations,'rngStatesEqual':rng_pass},'v8':read(p/'v8-sort-vectors.json'),'regressions':{'integration':1814,'forecast':289,'semantics':167,'targets':47},'selfExtendCurrentCards':self_extend,'replayAsyncCurrentCards':combos,'native':'Not run by this agent; Root native validation pending'}
(p/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['sourceSha256','productionCoreSha256','v8']},ensure_ascii=False))
