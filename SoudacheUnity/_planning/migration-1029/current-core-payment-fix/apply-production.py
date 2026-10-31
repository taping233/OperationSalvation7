from pathlib import Path
import json,hashlib
p=Path(__file__).parent;root=p.parents[2];manifest=json.loads((p/'apply-manifest.json').read_text(encoding='utf-8'));outputs=[]
for m in manifest:
 target=root/m['path'];assert target.exists()==m['existed'],m['path'];s=target.read_text(encoding='utf-8-sig') if target.exists() else ''
 if m['existed']:
  for h in m['hunks']:
   assert s.count(h['old'])==1,(m['path'],'changed context; coordinate before application');s=s.replace(h['old'],h['new'],1)
 else:s=m['new']
 outputs.append((target,s))
for target,s in outputs:target.write_text(s,encoding='utf-8')
print('Applied',len(outputs),'files after all-context preflight')
