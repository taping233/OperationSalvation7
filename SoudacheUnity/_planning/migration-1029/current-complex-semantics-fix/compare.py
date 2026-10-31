# -*- coding: utf-8 -*-
from pathlib import Path
import json,sys
p=Path(__file__).resolve().parent
s=json.loads((p/'source-results.json').read_text(encoding='utf-8'))
c=json.loads((p/'core-results.json').read_text(encoding='utf-8'))
def differences(a,b,path=''):
    if isinstance(a,dict) and isinstance(b,dict):
        return [r for k in set(a)|set(b) for r in differences(a.get(k),b.get(k),path+'.'+k)]
    if isinstance(a,list) and isinstance(b,list):
        if len(a)!=len(b):return [(path+'.length',len(a),len(b))]
        return [r for i,(aa,bb) in enumerate(zip(a,b)) for r in differences(aa,bb,path+'['+str(i)+']')]
    return [] if a==b else [(path,a,b)]
rows=[]
for a,b in zip(s,c):
    keys=['immediate','after','second','third','damage','waiver','infusing']
    diff=[r for k in keys if k in a for r in differences(a[k],b[k],k)]
    if 'rng' in a:
        states=dict(pair.split(':') for pair in b['rng'].split(';s=')[1].split(','))
        diff+=differences(a['rng']['streams'],{k:int(v) for k,v in states.items()},'rng.streams')
    rows.append({'name':a['name'],'seed':a['seed'],'passed':not diff,'differences':diff})
result={'passed':all(r['passed'] for r in rows),'vectors':len(rows),'rows':rows}
(p/'comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True))
sys.exit(0 if result['passed'] else 1)
