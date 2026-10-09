"""Pack eight reference-informed poses without cancelling the weight transfer."""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
import json
import shutil
import sys

out=Path(__file__).absolute().parent
shutil.copyfile(sys.argv[1],out/'generated-sheet.png')
rgba=np.array(Image.open(str(out/'generated-sheet.png')).convert('RGBA'))
n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>32).astype(np.uint8),8)
ids=[i for i in range(1,n) if stats[i,4]>1000]
assert len(ids)==8,len(ids)
ids.sort(key=lambda i:(round((stats[i,1]+stats[i,3]-385)/(rgba.shape[0]/4)),centers[i,0]))
frames=[]; alignment=[]; scale=1.1
for i,label in enumerate(ids):
    mask=(labels==label).astype(np.uint8)
    support=cv2.dilate(mask,np.ones((5,5),np.uint8))
    x,y,w,h,area=stats[label].tolist(); bottom=y+h
    cols=np.where(mask[bottom-65:bottom].sum(axis=0)>0)[0]
    gap=np.where(np.diff(cols)>5)[0]
    front=cols[gap[-1]+1:] if len(gap) else cols
    anchor=(front[0]+front[-1])/2
    x0=max(0,x-3);y0=max(0,y-3);x1=min(rgba.shape[1],x+w+3);y1=min(rgba.shape[0],bottom+3)
    crop=rgba[y0:y1,x0:x1].copy();crop[:,:,3]*=support[y0:y1,x0:x1]
    im=Image.fromarray(crop,'RGBA');im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    ox=round(440+(x0-anchor)*scale);oy=round(460+(y0-bottom)*scale)
    assert ox>=0 and oy>=0 and ox+im.width<768 and oy+im.height<512,(i,ox,oy,im.size)
    frame=Image.new('RGBA',(768,512));frame.paste(im,(ox,oy))
    frame.save(out/('attack-%02d.png'%i));frame.save(out/('attack-%02d.webp'%i),lossless=True)
    frames.append(frame);alignment.append({'frame':i,'sourceBounds':[x,y,w,h],'frontBootCenter':anchor,'scale':scale,'offset':[ox,oy]})
atlas=Image.new('RGBA',(3072,1024))
for i,im in enumerate(frames):atlas.paste(im,((i%4)*768,(i//4)*512))
atlas.save(out/'wu-attack-sheet.png');atlas.save(out/'wu-attack-sheet.webp',lossless=True)
sequence=[0,1,1,2,3,3,4,5,6,7];durations=[42,41,42]*3+[42]
play=[frames[i] for i in sequence]+[frames[0]]
play[0].save(out/'wu-attack-preview.webp',save_all=True,append_images=play[1:],duration=durations+[900],loop=0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'wu-attack-preview.gif',save_all=True,append_images=gif[1:],duration=[40,40,50,40,40,40,40,40,50,40,900],loop=0,optimize=True)
spec={'status':'candidate','character':'wu','animation':'attack','texture':'wu-attack-sheet.webp',
      'frameWidth':768,'frameHeight':512,'columns':4,'rows':2,'uniquePoseFrames':8,
      'sampleRate':24,'sequence':sequence,'durationsMs':durations,'durationMs':sum(durations),
      'impactStep':4,'restFrame':0,'loop':False,'previewRestMs':900,
      'phases':[{'name':'蓄力','start':0,'end':2},{'name':'斩击','start':3,'end':6},{'name':'收势','start':7,'end':9}],
      'method':'imagegen reference-informed poses; one fixed export scale, front boot anchor alignment; rear heel and body weight transfer preserved',
      'alignment':alignment}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes)
report={'passed':True,'poses':8,'timelineSteps':10,'sampleRate':24,'durationMs':sum(durations),
        'sameScaleAllPoses':True,'frontBootCenterX':440,'soleBaselineY':460,'bounds':boxes,
        'alphaCornersZero':all(im.getpixel((0,0))[3]==0 for im in frames)}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
large=[f.name for f in out.iterdir() if f.is_file() and f.stat().st_size>1000000]
(out/'.gitignore').write_text('# Local assets over 1 MB; hashes recorded in receipt.\n'+'\n'.join(large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
