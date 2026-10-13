"""Preserve completed generated candidates for chat handoff; no image editing or new generation."""
from pathlib import Path
from PIL import Image
import hashlib,json,shutil
e=Path(__file__).resolve().parent
g=Path(r'C:\Users\太平\.codex\generated_images\01a12a56-fff8-7393-a312-6f8f01036d55')
s=e/'handoff-art'/'source';s.mkdir(parents=True,exist_ok=True)
(s/'.gitignore').write_text('*.png\n',encoding='utf-8')
items=[
 ('future-stage-composite','exec-51ae9450-2494-4f39-a41c-826d285ef4e5.png','summer-like future-city composition study; winter weather still required; not adopted'),
 ('future-far','exec-9b5db149-51ce-421c-b9ed-bb052eeefc46.png','opaque far skyline; summer-like sky, needs winter correction; not adopted'),
 ('future-mid','exec-3dee411c-b3b8-4f56-a332-18eb4b1fa974.png','transparent mid structures; greenery needs winter correction; not adopted'),
 ('future-ground','exec-b04b759f-ab07-4678-a18d-2b0ec5abcc5a.png','transparent horizontal standing platform; same canvas; not adopted'),
 ('future-foreground','exec-c746ae85-ff92-406a-885a-c987b7fcc164.png','transparent corner covers; winter edge treatment pending; not adopted'),
 ('rejected-ancient-stage','exec-d4082972-5d8f-4cb7-ab97-b6bc3c8d22a8.png','rejected ancient stone/flags/dome direction; never integrate'),
]
rows=[]
for key,name,status in items:
 src=g/name;dst=s/(key+'.png')
 if not dst.exists():shutil.copyfile(src,dst)
 b=dst.read_bytes();im=Image.open(dst)
 a=im.getchannel('A') if 'A' in im.getbands() else None
 rows.append({'key':key,'file':str(dst.relative_to(e)).replace('\\','/'),'original':str(src),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'size':im.size,'mode':im.mode,'alpha':a.getextrema() if a else None,'status':status})
(e/'handoff-art'/'assets.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'preserved':len(rows),'canvas':[r['size'] for r in rows]},ensure_ascii=True))
