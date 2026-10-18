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
assert count==31 and all(im.size==(w,h) for im in frames)
pixels=[np.array(im) for im in frames]
assert np.array_equal(pixels[0],pixels[-1]), 'endpoints differ'
neutral=Image.open(root.parent/'continuous-idle/frames/idle-000.png').convert('RGBA')
padded=Image.new('RGBA',(w,h)); padded.paste(neutral,(x,y))
assert np.array_equal(pixels[0],np.array(padded)), 'endpoint differs from selected idle'
assert all(np.array_equal(p[y+490:],pixels[0][y+490:]) for p in pixels), 'soles drift'
assert all(np.array_equal(pixels[12],pixels[i]) for i in [13,14]), 'impact hold moves'
durations=[33,34,33]*10+[33]
frames[0].save(root/'preview.webp',save_all=True,append_images=frames[1:]+[frames[0]],duration=durations+[850],loop=0,lossless=True,exact=True)
output={'character':'wu','animation':'attack','frameWidth':w,'frameHeight':h,'frameCount':count,'fps':30,'durationMs':sum(durations),'figureOffset':[x,y],'status':'candidate','frames':[f'frames/attack-{i:03d}.png' for i in range(count)],'durationsMs':durations}
(root/'sprite.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report={'passed':True,'frameCount':count,'endpointEqualsSelectedIdle':True,'solesPixelIdentical':True,'impactHoldPixelIdentical':True,'scope':'pixel anchors and hold only; naturalness and residual cleanup assessed visually'}
(root/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
receipt=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in root.rglob('*') if p.is_file() and p.name not in ['receipt.json','.gitignore']]
(root/'receipt.json').write_text(json.dumps({'sourceArchive':str(archive),'sourceArchiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':receipt},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(root/'.gitignore').write_text('# Large local animation assets; SHA256 in receipt.json\n'+'\n'.join('/'+f['path'] for f in receipt if f['bytes']>1000000)+'\n',encoding='utf8')
print(json.dumps(report))
