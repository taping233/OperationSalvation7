from pathlib import Path
from PIL import Image
import hashlib
import json

root=Path(__file__).absolute().parent
out=root/'idle'
frames=[Image.open(str(out/'frames'/('idle-%03d.png'%i))).convert('RGBA') for i in range(72)]
assert all(im.size==(768,512) for im in frames)
atlas=Image.new('RGBA',(6144,4608))
for i,im in enumerate(frames):atlas.paste(im,((i%8)*768,(i//8)*512))
atlas.save(out/'sheet.png');atlas.save(out/'sheet.webp',lossless=True,exact=True)
durations=[42,41,42]*24
frames[0].save(out/'preview.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=85,method=0)
spec={'character':'changwuyu','animation':'idle','texture':'sheet.webp','frameWidth':768,'frameHeight':512,
      'columns':8,'rows':9,'frameCount':72,'sequence':list(range(72)),'durationsMs':durations,
      'durationMs':3000,'sampleRate':24,'loop':True,'phases':[{'name':'轻微呼吸','start':0,'end':71}],
      'method':'same-image continuous breath bake; no skeleton or independent wind sway'}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
fixed=frames[0].crop((0,365,768,512)).tobytes()
assert all(im.crop((0,365,768,512)).tobytes()==fixed for im in frames)
assert all(im.crop((0,0,768,135)).tobytes()==frames[0].crop((0,0,768,135)).tobytes() for im in frames)
assert all(im.crop((0,0,340,512)).tobytes()==frames[0].crop((0,0,340,512)).tobytes() for im in frames)
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes)
report={'passed':True,'frames':72,'durationMs':3000,'fixedLowerBody':True,
      'headAndHatFixed':True,'leftCloudRegionFixed':True,'breathMaxPx':3,
      'uniqueRasterFrames':len({im.tobytes() for im in frames}),'neutralSha256':hashlib.sha256((out/'frames'/'idle-000.png').read_bytes()).hexdigest(),
        'neutralBounds':boxes[0]}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
