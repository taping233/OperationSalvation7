"""Export a one-shot collapse with accepted idle start and a held fallen end."""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
import json
import hashlib
import shutil
import sys

out=Path(__file__).absolute().parent
idle=out.parent/'wu-idle-sprite-20261009'/'v2'
neutral=Image.open(str(idle/'frames'/'idle-000.png')).convert('RGBA')
shutil.copyfile(sys.argv[1],out/'generated-sheet.png')
rgba=np.array(Image.open(str(out/'generated-sheet.png')).convert('RGBA'))
n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>32).astype(np.uint8),8)
ids=[i for i in range(1,n) if stats[i,4]>1000]
assert len(ids)==8,len(ids)
ids.sort(key=lambda i:centers[i,1])
ids=[label for start in range(0,8,2) for label in sorted(ids[start:start+2],key=lambda i:centers[i,0])]
initial=ids[0];bottom0=stats[initial,1]+stats[initial,3]
cols=np.where((labels[bottom0-55:bottom0]==initial).sum(axis=0)>0)[0]
gaps=np.where(np.diff(cols)>5)[0];front=cols[gaps[-1]+1:] if len(gaps) else cols
anchor=(front[0]+front[-1])/2;scale=465/stats[initial,3];tx=496-anchor*scale
frames=[];alignment=[]
for i,label in enumerate(ids):
    if i==0:
        frame=neutral.copy();shutil.copyfile(idle/'frames'/'idle-000.png',out/'death-00.png')
        alignment.append({'frame':0,'source':'accepted idle-000.png, exact copy'})
    elif i==7:
        frame=frames[6].copy();frame.save(out/'death-07.png')
        alignment.append({'frame':7,'source':'death-06.png, identical settled endpoint'})
    else:
        mask=(labels==label).astype(np.uint8);support=cv2.dilate(mask,np.ones((5,5),np.uint8))
        x,y,w,h,area=stats[label].tolist();bottom=y+h
        x0=max(0,x-3);y0=max(0,y-3);x1=min(rgba.shape[1],x+w+3);y1=min(rgba.shape[0],bottom+3)
        crop=rgba[y0:y1,x0:x1].copy();crop[:,:,3]*=support[y0:y1,x0:x1]
        im=Image.fromarray(crop,'RGBA');im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        col_origin=(i%2)*(rgba.shape[1]/2)
        ox=round(tx+(x0-col_origin)*scale);oy=round(484+(y0-bottom)*scale)
        assert ox>=0 and oy>=0 and ox+im.width<768 and oy+im.height<512,(i,ox,oy,im.size)
        frame=Image.new('RGBA',(768,512));frame.paste(im,(ox,oy));frame.save(out/('death-%02d.png'%i))
        alignment.append({'frame':i,'sourceBounds':[x,y,w,h],'scale':scale,'offset':[ox,oy]})
    frame.save(out/('death-%02d.webp'%i),lossless=True,exact=True);frames.append(frame)
atlas=Image.new('RGBA',(3072,1024))
for i,im in enumerate(frames):atlas.paste(im,((i%4)*768,(i//4)*512))
atlas.save(out/'wu-death-sheet.png');atlas.save(out/'wu-death-sheet.webp',lossless=True,exact=True)
sequence=[0,1,1,1,2,2,3,3,3,4,4,5,5,5,6,6,6,7,7,7,7]
durations=[42,41,42]*7
spec={'status':'candidate','character':'wu','animation':'death','texture':'wu-death-sheet.webp',
      'frameWidth':768,'frameHeight':512,'columns':4,'rows':2,'poseSlots':8,'uniquePoseFrames':7,
      'sampleRate':24,'sequence':sequence,'durationsMs':durations,'durationMs':sum(durations),
      'firstFrame':0,'lastFrame':7,'loop':False,'holdLastFrame':True,
      'idleSpec':'../wu-idle-sprite-20261009/v2/sprite.json',
      'endpointSource':'../wu-idle-sprite-20261009/v2/frames/idle-000.png',
      'phases':[{'name':'待机起点','start':0,'end':0},{'name':'失去支撑','start':1,'end':3},
                {'name':'屈膝撑地','start':4,'end':8},{'name':'侧身落地','start':9,'end':13},
                {'name':'倒地停留','start':14,'end':20}],
      'method':'imagegen collapse poses; shared scale, consistent floor and camera; exact accepted idle start, identical settled final frames',
      'alignment':alignment}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
play=[frames[i] for i in sequence]
play[0].save(out/'wu-death-preview.webp',save_all=True,append_images=play[1:],duration=durations,loop=1,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
# No GIF loop extension: play once and leave the fallen pose on screen.
gif[0].save(out/'wu-death-preview.gif',save_all=True,append_images=gif[1:],duration=[40,40,50]*7,optimize=True)
assert frames[0].tobytes()==neutral.tobytes()
assert frames[-1].tobytes()==frames[-2].tobytes()!=neutral.tobytes()
start_hash=hashlib.sha256((out/'death-00.png').read_bytes()).hexdigest()
assert start_hash==hashlib.sha256((idle/'frames'/'idle-000.png').read_bytes()).hexdigest()
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes),boxes
assert boxes[-1][3]-boxes[-1][1] < (boxes[0][3]-boxes[0][1])*.45
decoded=Image.open(str(out/'wu-death-sheet.webp')).convert('RGBA')
for i,frame in enumerate(frames):
    a=np.array(frame);b=np.array(decoded.crop(((i%4)*768,(i//4)*512,(i%4+1)*768,(i//4+1)*512)))
    assert np.array_equal(a[:,:,3],b[:,:,3]);assert np.array_equal(a[a[:,:,3]>0],b[a[:,:,3]>0])
report={'passed':True,'idleInitialEqualsDeathInitial':True,'startPngSha256':start_hash,
        'finalTwoFramesIdentical':True,'finalDifferentFromIdle':True,'finalIsLowHorizontalSilhouette':True,
        'frameSize':[768,512],'bounds':boxes,'visibleAtlasMatchesFrames':True,
        'durationMs':sum(durations),'loop':False,'holdLastFrame':True}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
large=[p.name for p in out.iterdir() if p.is_file() and p.stat().st_size>1000000]
(out/'.gitignore').write_text('# Local files over 1 MB; receipt records hashes.\n'+'\n'.join(large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
