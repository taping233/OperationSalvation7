"""Pack generated Changwuyu poses around one immutable idle baseline."""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
import hashlib
import shutil
import json
import sys

root=Path(__file__).absolute().parent
name=sys.argv[1]
assert name in ('attack','hurt','death')
count=4 if name=='hurt' else 8
out=root/name
if Path(sys.argv[2]).absolute()!= (out/'source.png').absolute():shutil.copyfile(sys.argv[2],out/'source.png')
neutral=Image.open(str(root/'idle/frames/idle-000.png')).convert('RGBA')
ref=np.array(neutral);rn,rl,rs,rc=cv2.connectedComponentsWithStats((ref[:,:,3]>32).astype(np.uint8),8)
rid=1+np.argmax(rs[1:,4]);rb=rs[rid,1]+rs[rid,3]
def foot_center(labels,label,bottom):
    cols=np.where((labels[max(0,bottom-18):bottom]==label).sum(axis=0)>0)[0]
    return float((cols[0]+cols[-1])/2)
ref_anchor=foot_center(rl,rid,rb)
rgba=np.array(Image.open(str(out/'source.png')).convert('RGBA'))
n,labels,stats,centers=cv2.connectedComponentsWithStats((rgba[:,:,3]>32).astype(np.uint8),8)
ids=sorted(range(1,n),key=lambda i:stats[i,4],reverse=True)[:count]
assert len(ids)==count and min(stats[i,4] for i in ids)>2000
ids.sort(key=lambda i:centers[i,1])
ids=[label for start in range(0,count,2) for label in sorted(ids[start:start+2],key=lambda i:centers[i,0])]
# Attach any small disconnected hat/cloud details to the closest major figure.
groups={label:[label] for label in ids}
for i in range(1,n):
    if i in ids or stats[i,4]<8:continue
    cx,cy=centers[i]
    def distance(label):
        x,y,w,h,_=stats[label]
        return max(x-cx,0,cx-(x+w))**2+max(y-cy,0,cy-(y+h))**2
    nearest=min(ids,key=distance)
    if distance(nearest)<60**2:groups[nearest].append(i)
scale=float(rs[rid,3]/stats[ids[0],3])
initial_bottom=stats[ids[0],1]+stats[ids[0],3]
initial_anchor=foot_center(labels,ids[0],initial_bottom)
frames=[];align=[]
for i,label in enumerate(ids):
    endpoint=i==0 or (i==count-1 and name!='death') or (name=='attack' and i==count-2)
    if endpoint:
        frame=neutral.copy();shutil.copyfile(root/'idle/frames/idle-000.png',out/('frame-%02d.png'%i))
        align.append({'frame':i,'exactIdleCopy':True})
    elif name=='death' and i==count-1:
        frame=frames[-1].copy();frame.save(out/('frame-%02d.png'%i));align.append({'frame':i,'exactFallenCopy':True})
    else:
        mask=np.isin(labels,groups[label]).astype(np.uint8)
        support=cv2.dilate(mask,np.ones((5,5),np.uint8))
        yy,xx=np.where(mask);x,y,xend,bottom=int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)
        x0=max(0,x-3);y0=max(0,y-3);x1=min(rgba.shape[1],xend+3);y1=min(rgba.shape[0],bottom+3)
        crop=rgba[y0:y1,x0:x1].copy();crop[:,:,3]*=support[y0:y1,x0:x1]
        correction=1.0
        if name!='death' and i==count-2:correction=float(np.clip(stats[ids[0],3]/stats[label,3],.92,1.10))
        pose_scale=scale*correction
        im=Image.fromarray(crop,'RGBA');im=im.resize((round(im.width*pose_scale),round(im.height*pose_scale)),Image.Resampling.LANCZOS)
        if name=='death':
            anchor=initial_anchor+(i%2)*(rgba.shape[1]/2)
        else:anchor=foot_center(labels,label,stats[label,1]+stats[label,3])
        ox=round(ref_anchor+(x0-anchor)*pose_scale);oy=round(rb+(y0-bottom)*pose_scale)
        assert ox>=0 and oy>=0 and ox+im.width<768 and oy+im.height<512,(name,i,ox,oy,im.size)
        frame=Image.new('RGBA',(768,512));frame.paste(im,(ox,oy));frame.save(out/('frame-%02d.png'%i))
        align.append({'frame':i,'scale':pose_scale,'offset':[ox,oy],'sourceBounds':[x,y,xend,bottom]})
    frame.save(out/('frame-%02d.webp'%i),lossless=True,exact=True);frames.append(frame)
cols=2 if count==4 else 4
atlas=Image.new('RGBA',(cols*768,2*512))
for i,im in enumerate(frames):atlas.paste(im,((i%cols)*768,(i//cols)*512))
atlas.save(out/'sheet.png');atlas.save(out/'sheet.webp',lossless=True,exact=True)
if name=='attack':
    seq=[0,1,1,2,3,3,4,5,6,7];ms=[42,41,42]*3+[42]
    phases=[('起手',0,2),('向右挥手',3,6),('收势',7,9)]
elif name=='hurt':
    seq=[0]+[1]*8+[2]*8+[3]*2;ms=[42,41,42]*6+[42]
    phases=[('待机起点',0,0),('受击后仰',1,8),('稳住重心',9,16),('回到待机',17,18)]
else:
    seq=[0]+[1]*4+[2]*4+[3]*4+[4]*4+[5]*4+[6]*4+[7]*3;ms=[42,41,42]*9+[42]
    phases=[('待机起点',0,0),('失去支撑',1,4),('屈膝撑地',5,12),('侧身落地',13,20),('倒地停留',21,27)]
spec={'character':'changwuyu','animation':name,'texture':'sheet.webp','frameWidth':768,'frameHeight':512,
      'columns':cols,'rows':2,'poseSlots':count,'sequence':seq,'durationsMs':ms,'durationMs':sum(ms),
      'sampleRate':24,'loop':False,'holdLastFrame':name=='death','firstFrame':0,'lastFrame':count-1,
      'phases':[{'name':label,'start':start,'end':end}for label,start,end in phases],'alignment':align,
      'endpointSource':'../idle/frames/idle-000.png','noFireball':True,'noStaff':True,
      'method':'built-in imagegen poses; common idle PNG endpoints, alignment and fixed final fallen frame'}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
play=[frames[i] for i in seq];view_ms=ms.copy()
if name!='death':play.append(frames[0]);view_ms.append(900)
play[0].save(out/'preview.webp',save_all=True,append_images=play[1:],duration=view_ms,loop=1 if name=='death' else 0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif_ms=[int(round(v/10)*10) for v in view_ms]
options={} if name=='death' else {'loop':0}
gif[0].save(out/'preview.gif',save_all=True,append_images=gif[1:],duration=gif_ms,optimize=True,**options)
start_hash=hashlib.sha256((out/'frame-00.png').read_bytes()).hexdigest()
assert start_hash==hashlib.sha256((root/'idle/frames/idle-000.png').read_bytes()).hexdigest()
if name!='death':assert (out/('frame-%02d.png'%(count-1))).read_bytes()==(out/'frame-00.png').read_bytes()
else:assert frames[-1].tobytes()==frames[-2].tobytes()!=neutral.tobytes()
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512 for b in boxes)
if name=='death':assert boxes[-1][3]-boxes[-1][1]<rs[rid,3]*.55
decoded=Image.open(str(out/'sheet.webp')).convert('RGBA')
for i,im in enumerate(frames):
    a=np.array(im);b=np.array(decoded.crop(((i%cols)*768,(i//cols)*512,(i%cols+1)*768,(i//cols+1)*512)))
    assert np.array_equal(a[:,:,3],b[:,:,3]);assert np.array_equal(a[a[:,:,3]>0],b[a[:,:,3]>0])
report={'passed':True,'action':name,'startMatchesIdle':True,'endMatchesIdle':name!='death',
        'heldFallenEnd':name=='death','neutralSha256':start_hash,'durationMs':sum(ms),'bounds':boxes,
        'uniqueRasterPoses':len({im.tobytes()for im in frames}),'visibleAtlasMatchesFrames':True}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
