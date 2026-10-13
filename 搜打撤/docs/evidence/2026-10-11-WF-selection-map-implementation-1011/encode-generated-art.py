"""Only copy generated originals and encode runtime WebP; no visual repaint or compositing."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence=Path(__file__).resolve().parent
project=evidence.parents[2]
generated=Path(r'C:\Users\太平\.codex\generated_images\01a12a56-fff8-7393-a312-6f8f01036d55')
source=evidence/'generated-art'/'source'
source.mkdir(parents=True,exist_ok=True)
(source/'.gitignore').write_text('*.png\n',encoding='utf-8')
items=[
    ('small','exec-a6dd0ed1-3ba3-4628-b67c-8bc626946f66.png','game/assets/scenes/rewards/chest-small-1011-v2.webp',True),
    ('battle','exec-bb45f0eb-dfd7-472e-9e26-80b598e8a0ae.png','game/assets/scenes/battle/winter-street-1011-v2.webp',False),
]
manifest=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for key,filename,runtime,transparent in items:
    original=generated/filename
    retained=source/(key+'-selected.png')
    if retained.exists() and sha(retained)!=sha(original):raise RuntimeError('Refuse to overwrite a different retained original')
    if not retained.exists():shutil.copyfile(original,retained)
    out=project/runtime
    out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists():raise RuntimeError('Refuse to overwrite existing runtime asset: '+str(out))
    im=Image.open(retained)
    if transparent:
        if 'A' not in im.getbands() or im.getchannel('A').getextrema()!=(0,255):raise RuntimeError('Expected real alpha')
        im.save(out,'WEBP',lossless=True,exact=True,method=6)
    else:im.save(out,'WEBP',quality=88,method=6)
    decoded=Image.open(out)
    alpha=decoded.getchannel('A') if 'A' in decoded.getbands() else None
    manifest.append({'key':key,'generatedPath':str(original),'source':str(retained.relative_to(project)).replace('\\','/'),'sourceBytes':retained.stat().st_size,'sourceSha256':sha(retained),'runtime':runtime,'bytes':out.stat().st_size,'sha256':sha(out),'size':decoded.size,'mode':decoded.mode,'alphaExtrema':alpha.getextrema() if alpha else None,'alphaBBox':alpha.getbbox() if alpha else None,'encoding':'WebP','tool':'built-in image_gen','conversion':'Pillow WebP encoding only; no repaint/composite/resize'})
(evidence/'generated-art'/'assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
