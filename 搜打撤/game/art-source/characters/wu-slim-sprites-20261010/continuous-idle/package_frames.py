"""Package native-browser PNG exports and inspect motion continuity; no repaint."""
from pathlib import Path
from PIL import Image
import numpy as np
import hashlib
import json
import zipfile
import sys

root=Path(__file__).resolve().parent
archive=Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        target=(root/name).resolve()
        assert target.is_relative_to(root), name
    z.extractall(root)
frames=[Image.open(root/'frames'/f'idle-{i:03d}.png').convert('RGBA') for i in range(72)]
export_spec=json.loads((root/'export.json').read_text(encoding='utf8'))
arrays=[np.array(im) for im in frames]
assert all(im.size==(576,560) for im in frames)
fixed_regions={'headFace':(0,0,576,135),'feet':(0,490,576,560),'waist':(264,218,314,239)}
checks={}
for name,(x0,y0,x1,y1) in fixed_regions.items():
    reference=arrays[0][y0:y1,x0:x1]
    checks[name]=all(np.array_equal(a[y0:y1,x0:x1],reference) for a in arrays)
    assert checks[name], f'{name} drifts'
endpoint=np.array(Image.open(root/'checks'/'loop-end.png').convert('RGBA'))
assert np.array_equal(endpoint,arrays[0]), 'loop boundary differs from neutral'
visible=arrays[0][:,:,3]>32
adjacent=[]
for i in range(72):
    diff=np.abs(arrays[(i+1)%72].astype(np.int16)-arrays[i].astype(np.int16))
    adjacent.append(float(diff[visible].mean()))
report={'passed':True,'frames':72,'size':[576,560],'fps':24,'durationMs':3000,
        'strength':export_spec.get('strength',1),
        'fixedPixelRegions':checks,'loopEndpointPixelIdentical':True,
        'uniqueFrames':len({a.tobytes() for a in arrays}),
        'adjacentVisibleMeanAbsoluteChange':adjacent,
        'loopLastToFirstChange':adjacent[-1],
        'largestAdjacentChange':max(adjacent),
        'limits':['pixel stability and continuity, not a substitute for visual judgement',
                  'continuous-idle only; attack/hurt/death untouched']}
assert report['uniqueFrames']>=60
assert adjacent[-1]<=max(adjacent[:-1])*1.2, 'loop has abnormal jump'
for i,im in enumerate(frames):
    im.save(root/'frames'/f'idle-{i:03d}.webp',lossless=True,exact=True)
atlas=Image.new('RGBA',(576*9,560*8))
for i,im in enumerate(frames):atlas.paste(im,((i%9)*576,(i//9)*560))
atlas.save(root/'idle-atlas.png')
durations=[42,41,42]*24
frames[0].save(root/'preview.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,exact=True)
spec={'character':'wu','animation':'idle','status':'candidate','frameWidth':576,'frameHeight':560,
      'frameCount':72,'fps':24,'loop':True,'durationMs':3000,
      'frames':[f'frames/idle-{i:03d}.webp' for i in range(72)],
      'sequence':list(range(72)),'durationsMs':durations,
      'texture':'idle-atlas.png','columns':9,'rows':8,
      'method':'single base PNG, continuous compact-region displacement, native browser export'}
spec['strength']=export_spec.get('strength',1)
spec['amplitudesPx']=export_spec['amplitudesPx']
(root/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
(root/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
files=[]
for p in root.rglob('*'):
    if p.is_file() and p.name not in ['receipt.json','.gitignore']:
        files.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'receipt.json').write_text(json.dumps({'files':files,'sourceArchive':str(archive)},ensure_ascii=False,indent=2),encoding='utf8')
large=[f['path'] for f in files if f['bytes']>1000000]
(root/'.gitignore').write_text('# Large local binaries; hashes in receipt.json\n'+'\n'.join('/'+p for p in large)+'\n',encoding='utf8')
print(json.dumps({'passed':True,'frames':72,'fixed':checks,'endpointIdentical':True,'largestAdjacentChange':max(adjacent),'loopBoundaryChange':adjacent[-1],'largeFiles':len(large)}))
