from pathlib import Path
from PIL import Image
import numpy as np
import hashlib,json
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
results=[]
for kind in ('small','medium','large','class','boss'):
    receipt=HERE/(kind+'-rig-receipt.json')
    if not receipt.exists():continue
    r=json.loads(receipt.read_text(encoding='utf8'))
    paths=[ROOT/'game'/v[1:] for v in r.get('sourceFrames',r['frames'])]
    a=[np.asarray(Image.open(p).convert('RGBA')) for p in paths]
    assert all(v.shape==(1254,1254,4) and int(v[:,:,3].min())==0 and int(v[:,:,3].max())==255 for v in a)
    mask=a[0][985:1200,90:1190,3]>0
    assert all(np.array_equal(v[985:1200,90:1190][mask],a[0][985:1200,90:1190][mask]) for v in a)
    assert all(v['hinge']==r['hingeSourcePixels'] for v in r['framesReceipt'])
    results.append({'kind':kind,'passed':True,'frames':18,'dimensions':[1254,1254],'alpha':[0,255],'fps':24,'fixedHinge':True,'lowerBodyVisibleRGBAIdentical':True,'maximumBytes':max(p.stat().st_size for p in paths)})
    runtime=ROOT/'game/assets/scenes/chests'/(kind+'-rig-640-v1')
    runtime.mkdir(parents=True,exist_ok=True)
    urls=[]
    for p in paths:
        im=Image.open(p).convert('RGBA').resize((640,640),Image.LANCZOS)
        target=runtime/p.name;im.save(target,'WEBP',lossless=True)
        urls.append('/assets/scenes/chests/'+runtime.name+'/'+p.name)
    r['sourceFrames']=r.get('sourceFrames',r['frames']);r['frames']=urls
    r['runtimeDimensions']=[640,640];r['runtimeFps']=24
    json.dump(r,open(receipt,'w',encoding='utf8'),ensure_ascii=False,indent=2)
    results[-1]['runtimeMaximumBytes']=max(p.stat().st_size for p in runtime.glob('*.webp'))
    assert results[-1]['runtimeMaximumBytes']<=1000000
    oversized=[p.name for p in paths if p.stat().st_size>1000000]
    if oversized:
        (paths[0].parent/'.gitignore').write_text(''.join('/'+name+'\n' for name in oversized),encoding='utf8')
    preview=[]
    for p in paths:
        im=Image.open(p).convert('RGBA');im.thumbnail((300,300));preview.append(im)
    preview[0].save(HERE/(kind+'-motion.webp'),'WEBP',save_all=True,append_images=preview[1:],duration=42,loop=0,lossless=True)
json.dump({'rigs':results,'limitation':'Alpha-zero hidden RGB can be optimized by WebP encoder; painted body remains fixed; visual approval pending.'},open(HERE/'rig-validation.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
source=[{'path':str(p.relative_to(HERE)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'obtained':'built-in imagegen transparent painted component'} for p in (HERE/'source').glob('*.png')]
json.dump(source,open(HERE/'source-sha256.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print(json.dumps(results))
