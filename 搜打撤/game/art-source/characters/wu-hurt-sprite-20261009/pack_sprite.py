"""Export the generated recoil/bracing poses with exact accepted idle endpoints."""
from pathlib import Path
from PIL import Image
import numpy as np
import cv2
import hashlib
import shutil
import json
import sys

out=Path(__file__).absolute().parent
idle=out.parent/'wu-idle-sprite-20261009'/'v2'
neutral=Image.open(str(idle/'frames'/'idle-000.png')).convert('RGBA')
shutil.copyfile(sys.argv[1],out/'generated-sheet.png')
rgba=np.array(Image.open(str(out/'generated-sheet.png')).convert('RGBA'))
n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>32).astype(np.uint8),8)
ids=[i for i in range(1,n) if stats[i,4]>1000]
assert len(ids)==4,len(ids)
ids.sort(key=lambda i:(round((stats[i,1]+stats[i,3]-513)/(rgba.shape[0]/2)),centers[i,0]))
scale=465/stats[ids[0],3]
frames=[];alignment=[]
for i,label in enumerate(ids):
    if i in (0,3):
        frame=neutral.copy();shutil.copyfile(idle/'frames'/'idle-000.png',out/('hurt-%02d.png'%i))
        alignment.append({'frame':i,'source':'accepted idle-000.png, exact copy'})
    else:
        mask=(labels==label).astype(np.uint8)
        support=cv2.dilate(mask,np.ones((5,5),np.uint8))
        x,y,w,h,area=stats[label].tolist();bottom=y+h
        cols=np.where(mask[bottom-55:bottom].sum(axis=0)>0)[0]
        gaps=np.where(np.diff(cols)>5)[0];front=cols[gaps[-1]+1:] if len(gaps) else cols
        anchor=(front[0]+front[-1])/2
        x0=max(0,x-3);y0=max(0,y-3);x1=min(rgba.shape[1],x+w+3);y1=min(rgba.shape[0],bottom+3)
        crop=rgba[y0:y1,x0:x1].copy();crop[:,:,3]*=support[y0:y1,x0:x1]
        im=Image.fromarray(crop,'RGBA');im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        ox=round(496+(x0-anchor)*scale);oy=round(484+(y0-bottom)*scale)
        assert ox>=0 and oy>=0 and ox+im.width<768 and oy+im.height<512,(i,ox,oy,im.size)
        frame=Image.new('RGBA',(768,512));frame.paste(im,(ox,oy));frame.save(out/('hurt-%02d.png'%i))
        alignment.append({'frame':i,'sourceBounds':[x,y,w,h],'scale':scale,'frontBootCenter':anchor,'offset':[ox,oy]})
    frame.save(out/('hurt-%02d.webp'%i),lossless=True,exact=True);frames.append(frame)
atlas=Image.new('RGBA',(1536,1024))
for i,im in enumerate(frames):atlas.paste(im,((i%2)*768,(i//2)*512))
atlas.save(out/'wu-hurt-sheet.png');atlas.save(out/'wu-hurt-sheet.webp',lossless=True,exact=True)
sequence=[0,1,1,1,2,2,2,3];durations=[41,42,42,42,41,42,42,42]
spec={'status':'candidate','character':'wu','animation':'hurt','texture':'wu-hurt-sheet.webp',
      'frameWidth':768,'frameHeight':512,'columns':2,'rows':2,'poseSlots':4,'uniquePoseFrames':3,
      'sampleRate':24,'sequence':sequence,'durationsMs':durations,'durationMs':sum(durations),
      'impactStep':1,'restFrame':0,'loop':False,'firstFrame':0,'lastFrame':3,'previewRestMs':900,
      'idleSpec':'../wu-idle-sprite-20261009/v2/sprite.json',
      'endpointSource':'../wu-idle-sprite-20261009/v2/frames/idle-000.png',
      'phases':[{'name':'待机起点','start':0,'end':0},{'name':'受击后仰','start':1,'end':3},{'name':'稳住重心','start':4,'end':6},{'name':'回到待机','start':7,'end':7}],
      'method':'imagegen recoil and bracing; shared scale and front boot alignment; exact accepted idle copied at both endpoints',
      'alignment':alignment}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
play=[frames[i] for i in sequence]+[frames[0]]
play[0].save(out/'wu-hurt-preview.webp',save_all=True,append_images=play[1:],duration=durations+[900],loop=0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'wu-hurt-preview.gif',save_all=True,append_images=gif[1:],duration=[40,40,50,40,40,40,40,40,900],loop=0,optimize=True)
hashes=[hashlib.sha256(p.read_bytes()).hexdigest() for p in [idle/'frames'/'idle-000.png',out/'hurt-00.png',out/'hurt-03.png']]
assert len(set(hashes))==1
assert frames[0].tobytes()==frames[-1].tobytes()==neutral.tobytes()
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes),boxes
decoded=Image.open(str(out/'wu-hurt-sheet.webp')).convert('RGBA')
for i,frame in enumerate(frames):
    a=np.array(frame);b=np.array(decoded.crop(((i%2)*768,(i//2)*512,(i%2+1)*768,(i//2+1)*512)))
    assert np.array_equal(a[:,:,3],b[:,:,3]);assert np.array_equal(a[a[:,:,3]>0],b[a[:,:,3]>0])
report={'passed':True,'idleInitialEqualsHurtInitialEqualsHurtFinal':True,'endpointPngSha256':hashes[0],
        'frameSize':[768,512],'bounds':boxes,'uniquePoses':len({im.tobytes() for im in frames}),
        'visibleAtlasMatchesFrames':True,'durationMs':sum(durations)}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
large=[p.name for p in out.iterdir() if p.is_file() and p.stat().st_size>1000000]
(out/'.gitignore').write_text('# Local files over 1 MB; receipt records hashes.\n'+'\n'.join(large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
