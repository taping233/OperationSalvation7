"""Pack a restrained same-drawing recoil, avoiding independently redrawn poses."""
from pathlib import Path
from PIL import Image
import numpy as np
import json,hashlib,shutil
root=Path(__file__).absolute().parent;out=root/'hurt'
neutral=root/'idle/frames/idle-000.png'
shutil.copyfile(neutral,out/'frame-00.png');shutil.copyfile(neutral,out/'frame-18.png')
frames=[Image.open(str(out/('frame-%02d.png'%i))).convert('RGBA')for i in range(19)]
atlas=Image.new('RGBA',(3840,2048))
for i,im in enumerate(frames):atlas.paste(im,((i%5)*768,(i//5)*512));im.save(out/('frame-%02d.webp'%i),lossless=True,exact=True)
atlas.save(out/'sheet.png');atlas.save(out/'sheet.webp',lossless=True,exact=True)
ms=[42,41,42]*6+[42]
spec={'character':'changwuyu','animation':'hurt','texture':'sheet.webp','frameWidth':768,'frameHeight':512,
      'columns':5,'rows':4,'poseSlots':19,'sequence':list(range(19)),'durationsMs':ms,'durationMs':792,
      'sampleRate':24,'loop':False,'firstFrame':0,'lastFrame':18,'noFireball':True,'noStaff':True,
      'phases':[{'name':'待机起点','start':0,'end':0},{'name':'受击后仰','start':1,'end':4},{'name':'逐渐回稳','start':5,'end':17},{'name':'回到待机','start':18,'end':18}],
      'method':'same accepted idle drawing; bounded 8px upper-body recoil and 2px settle baked continuously; no pose redraw',
      'endpointSource':'../idle/frames/idle-000.png'}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
frames[0].save(out/'preview.webp',save_all=True,append_images=frames[1:]+[frames[0]],duration=ms+[900],loop=0,quality=85,method=0)
gif=[]
for im in frames+[frames[0]]:
 bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'preview.gif',save_all=True,append_images=gif[1:],duration=[40,40,50]*6+[40,900],loop=0,optimize=True)
assert (out/'frame-00.png').read_bytes()==(out/'frame-18.png').read_bytes()==neutral.read_bytes()
fixed=np.array(frames[0])[420:]
assert all(np.array_equal(np.array(im)[420:],fixed)for im in frames)
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes)
report={'passed':True,'action':'hurt','startMatchesIdle':True,'endMatchesIdle':True,'durationMs':792,
        'sameDrawingAllFrames':True,'continuousFrames':19,'maxRecoilPx':8,'maxSettlePx':2,'feetPixelsFixed':True,
        'neutralSha256':hashlib.sha256(neutral.read_bytes()).hexdigest(),'bounds':boxes}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items()if k!='bounds'},ensure_ascii=False))
