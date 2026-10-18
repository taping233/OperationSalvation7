"""Persist frames exported by the current in-app browser and verify anchors."""
from pathlib import Path
import json, hashlib, zipfile, sys
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parent
archive=Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        if not (root/name).resolve().is_relative_to(root):
            raise ValueError(name)
    z.extractall(root)
spec=json.loads((root/'export.json').read_text(encoding='utf8'))
count=spec['frames']; w,h=spec['width'],spec['height']; x,y=spec['padX'],spec['padY']
frames=[Image.open(root/'frames'/f'attack-{i:03d}.png').convert('RGBA') for i in range(count)]
assert count==67 and all(im.size==(w,h) for im in frames)
pixels=[np.array(im) for im in frames]
assert np.array_equal(pixels[0],pixels[-1]), 'endpoints differ'
neutral=Image.open(root.parent/'continuous-idle/frames/idle-000.png').convert('RGBA')
padded=Image.new('RGBA',(w,h)); padded.paste(neutral,(x,y))
assert np.array_equal(pixels[0],np.array(padded)), 'endpoint differs from selected idle'
assert all(np.array_equal(p[y+490:],pixels[0][y+490:]) for p in pixels), 'soles drift'
assert np.array_equal(pixels[28],pixels[29]), 'brief impact hold moves'
unique=len({hashlib.sha256(p.tobytes()).hexdigest() for p in pixels})
assert unique>=65, 'too many repeated frames'
# Check the actual exported pixels at the transformed sword tip, rather than
# relying only on the length of the unrendered geometry.
weapon=np.array(Image.open(root/'parts/weapon.png').convert('RGBA'))
ys,xs=np.where(weapon[:,:,3]>=128)
direction=np.array([347.,212.]); direction/=np.linalg.norm(direction)
tip=np.array([xs[(xs*direction[0]+ys*direction[1]).argmax()],ys[(xs*direction[0]+ys*direction[1]).argmax()]])
start=np.array([165.,266.]); axis=np.array([347.,212.]); base_angle=np.arctan2(axis[1],axis[0])
tip_checks=[]
for i,sample in enumerate(spec['samples']):
    a,b=np.array(sample['weapon'][0]),np.array(sample['weapon'][9]); angle=np.arctan2((b-a)[1],(b-a)[0])-base_angle
    c,s=np.cos(angle),np.sin(angle); q=a+np.array([[c,-s],[s,c]])@(tip-start)+[x,y]
    tx,ty=np.rint(q).astype(int); patch=pixels[i][max(0,ty-3):ty+4,max(0,tx-3):tx+4]
    assert patch.size and patch[:,:,3].max()>=96, f'missing rendered sword tip at frame {i}'
    tip_checks.append([int(tx),int(ty)])
durations=[17,16,17]*22+[17]
frames[0].save(root/'preview.webp',save_all=True,append_images=frames[1:]+[frames[0]],duration=durations+[850],loop=0,lossless=True,exact=True)
output={'character':'wu','animation':'attack','frameWidth':w,'frameHeight':h,'frameCount':count,'fps':60,'durationMs':sum(durations),'figureOffset':[x,y],'status':'candidate','frames':[f'frames/attack-{i:03d}.png' for i in range(count)],'durationsMs':durations}
(root/'sprite.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report={'passed':True,'frameCount':count,'uniqueFrames':unique,'fps':60,'endpointEqualsSelectedIdle':True,'solesPixelIdentical':True,'impactHoldPixelIdentical':True,'renderedSwordTipPresentInAllFrames':True,'swordTipPositions':tip_checks,'scope':'exported pixel anchors, repeated frames and sword tip visibility; naturalness assessed visually'}
(root/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
receipt=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in root.rglob('*') if p.is_file() and p.name not in ['receipt.json','.gitignore']]
(root/'receipt.json').write_text(json.dumps({'sourceArchive':str(archive),'sourceArchiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':receipt},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(root/'.gitignore').write_text('# Large local animation assets; SHA256 in receipt.json\n'+'\n'.join('/'+f['path'] for f in receipt if f['bytes']>1000000)+'\n',encoding='utf8')
print(json.dumps(report))
