"""Package native attack exports with the accepted idle at the same canvas anchor."""
from pathlib import Path
from PIL import Image
import numpy as np
import json
import hashlib
import zipfile
import sys

root=Path(__file__).resolve().parent
archive=Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():assert (root/name).resolve().is_relative_to(root), name
    z.extractall(root)
export=json.loads((root/'export.json').read_text(encoding='utf8'))
width,height=export['width'],export['height']
count=export['frames']; px,py=export['padX'],export['padY']
frames=[Image.open(root/'frames'/f'attack-{i:03d}.png').convert('RGBA') for i in range(count)]
assert all(im.size==(width,height) for im in frames)
neutral=Image.open(root.parent/'continuous-idle'/'frames'/'idle-000.png').convert('RGBA')
padded=Image.new('RGBA',(width,height));padded.paste(neutral,(px,py))
arrays=[np.array(im) for im in frames]
assert np.array_equal(arrays[0],arrays[-1]), 'attack endpoints differ'
assert np.array_equal(arrays[0],np.array(padded)), 'attack endpoint differs from paired idle'
foot_start=py+490
assert all(np.array_equal(a[foot_start:],arrays[0][foot_start:]) for a in arrays), 'soles drift'
hand=np.array(Image.open(root/'parts'/'hand.png').convert('RGBA')).astype(int)
silver=(hand[:,:,3]>32)&(np.min(hand[:,:,:3],axis=2)>150)&(hand[:,:,0]-hand[:,:,2]<10)
assert int(silver.sum())==0, 'silver hair pixels remain on hand'
durations=[42,41,42]*(count//3)
assert len(durations)==count
for i,im in enumerate(frames):im.save(root/'frames'/f'attack-{i:03d}.webp',lossless=True,exact=True)
atlas=Image.new('RGBA',(width*6,height*6))
for i,im in enumerate(frames):atlas.paste(im,((i%6)*width,(i//6)*height))
atlas.save(root/'attack-atlas.png')
frames[0].save(root/'preview.webp',save_all=True,append_images=frames[1:]+[frames[0]],duration=durations+[900],loop=0,lossless=True,exact=True)
paired=root/'idle-compatible';(paired/'frames').mkdir(parents=True,exist_ok=True)
for i in range(72):
    idle=Image.open(root.parent/'continuous-idle'/'frames'/f'idle-{i:03d}.png').convert('RGBA')
    canvas=Image.new('RGBA',(width,height));canvas.paste(idle,(px,py))
    canvas.save(paired/'frames'/f'idle-{i:03d}.png');canvas.save(paired/'frames'/f'idle-{i:03d}.webp',lossless=True,exact=True)
common={'character':'wu','frameWidth':width,'frameHeight':height,'fps':24,'figureOffset':[px,py]}
spec={**common,'animation':'attack','status':'candidate','frameCount':count,'durationMs':sum(durations),'loop':False,'frames':[f'frames/attack-{i:03d}.webp' for i in range(count)],'sequence':list(range(count)),'durationsMs':durations,'texture':'attack-atlas.png','columns':6,'rows':6,'pairedIdleSpec':'idle-compatible/sprite.json'}
(root/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
idle_spec={**common,'animation':'idle','frameCount':72,'durationMs':3000,'loop':True,'strength':2,'frames':[f'frames/idle-{i:03d}.webp' for i in range(72)],'sequence':list(range(72)),'durationsMs':[42,41,42]*24}
(paired/'sprite.json').write_text(json.dumps(idle_spec,ensure_ascii=False,indent=2),encoding='utf8')
report={'passed':True,'attackFrames':count,'idleFrames':72,'canvas':[width,height],'fps':24,'durationMs':sum(durations),'endpointEqualsPairedIdle':True,'solesPixelIdentical':True,'silverHairPixelsOnHand':int(silver.sum()),'uniqueAttackFrames':len({a.tobytes() for a in arrays}),'limits':['native animation assets only; no battle integration','colour check supplements visual inspection; it is not a general segmentation proof']}
(root/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
receipt=[]
for p in root.rglob('*'):
    if p.is_file() and p.name not in ['receipt.json','.gitignore']:
        receipt.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'receipt.json').write_text(json.dumps({'files':receipt,'sourceArchive':str(archive),'sourceArchiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest()},ensure_ascii=False,indent=2),encoding='utf8')
large=[r['path'] for r in receipt if r['bytes']>1000000]
(root/'.gitignore').write_text('# Local large binaries; hashes in receipt.json\n'+'\n'.join('/'+name for name in large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
