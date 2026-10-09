"""Match the accepted idle canvas and reuse its exact PNG at both endpoints."""
from pathlib import Path
from PIL import Image
import numpy as np
import shutil
import hashlib
import json

out=Path(__file__).absolute().parent
idle=out.parent.parent/'wu-idle-sprite-20261009'/'v2'
source=out.parent/'v2'
neutral=Image.open(str(idle/'frames'/'idle-000.png')).convert('RGBA')
assert neutral.size==(768,512)
# One shared scale/translation for all intermediate poses, fitted to the accepted idle.
# Front boot center: 441.5 -> 496; sole baseline: 459 -> 484.
sx=1.06; sy=465/414; tx=496-441.5*sx; ty=484-459*sy
frames=[]
recovery_scale={5:1.055,6:1.12}
for i in range(8):
    if i in (0,7):
        frame=neutral.copy()
        shutil.copyfile(idle/'frames'/'idle-000.png',out/('attack-%02d.png'%i))
    else:
        im=Image.open(str(source/('attack-%02d.png'%i))).convert('RGBA')
        correction=recovery_scale.get(i,1)
        pose_sx=sx*correction;pose_sy=sy*correction
        pose_tx=496-441.5*pose_sx;pose_ty=484-459*pose_sy
        frame=im.transform((768,512),Image.Transform.AFFINE,
                           (1/pose_sx,0,-pose_tx/pose_sx,0,1/pose_sy,-pose_ty/pose_sy),Image.Resampling.BICUBIC)
        frame.save(out/('attack-%02d.png'%i))
    frame.save(out/('attack-%02d.webp'%i),lossless=True,exact=True)
    frames.append(frame)
atlas=Image.new('RGBA',(3072,1024))
for i,im in enumerate(frames):atlas.paste(im,((i%4)*768,(i//4)*512))
atlas.save(out/'wu-attack-sheet.png');atlas.save(out/'wu-attack-sheet.webp',lossless=True,exact=True)
old=json.loads((source/'sprite.json').read_text(encoding='utf8'))
spec={k:v for k,v in old.items() if k not in ('alignment','method')}
spec.update(idleSpec='../../wu-idle-sprite-20261009/v2/sprite.json',
            endpointSource='../../wu-idle-sprite-20261009/v2/frames/idle-000.png',
            firstFrame=0,lastFrame=7,
            method='exact accepted idle PNG reused at both endpoints; shared affine normalization for intermediate poses',
            normalization={'scaleX':sx,'scaleY':sy,'translateX':tx,'translateY':ty,'recoveryPoseScaleCorrection':recovery_scale})
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
play=[frames[i] for i in spec['sequence']]+[frames[0]]
play[0].save(out/'wu-attack-preview.webp',save_all=True,append_images=play[1:],
            duration=spec['durationsMs']+[900],loop=0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'wu-attack-preview.gif',save_all=True,append_images=gif[1:],
            duration=[40,40,50,40,40,40,40,40,50,40,900],loop=0,optimize=True)
hashes=[hashlib.sha256(p.read_bytes()).hexdigest() for p in [idle/'frames'/'idle-000.png',out/'attack-00.png',out/'attack-07.png']]
assert len(set(hashes))==1
assert frames[0].tobytes()==neutral.tobytes()==frames[-1].tobytes()
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes),boxes
decoded=Image.open(str(out/'wu-attack-sheet.webp')).convert('RGBA')
for i,frame in enumerate(frames):
    a=np.array(frame);b=np.array(decoded.crop(((i%4)*768,(i//4)*512,(i%4+1)*768,(i//4+1)*512)))
    assert np.array_equal(a[:,:,3],b[:,:,3])
    assert np.array_equal(a[a[:,:,3]>0],b[a[:,:,3]>0])
report={'passed':True,'idleInitialEqualsAttackInitialEqualsAttackFinal':True,
        'endpointPngSha256':hashes[0],'frameSize':[768,512],'bounds':boxes,
        'visibleAtlasMatchesFrames':True,'durationMs':sum(spec['durationsMs']),
        'normalization':spec['normalization']}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
large=[p.name for p in out.iterdir() if p.is_file() and p.stat().st_size>1000000]
(out/'.gitignore').write_text('# Local files over 1 MB; receipt records hashes.\n'+'\n'.join(large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
