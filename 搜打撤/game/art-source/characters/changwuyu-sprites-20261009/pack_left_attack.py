"""Use generated left-arm poses while freezing the rest of the accepted sprite."""
from pathlib import Path
from PIL import Image,ImageDraw
import cv2
import numpy as np
import json,hashlib,shutil

root=Path(__file__).absolute().parent;out=root/'attack'
neutral=Image.open(str(root/'idle/frames/idle-000.png')).convert('RGBA');ref=np.array(neutral)
rn,rl,rs,rc=cv2.connectedComponentsWithStats((ref[:,:,3]>32).astype(np.uint8),8)
rid=1+np.argmax(rs[1:,4]);rb=rs[rid,1]+rs[rid,3]
def center(labels,label,bottom):
    cols=np.where((labels[bottom-18:bottom]==label).sum(axis=0)>0)[0]
    return float((cols[0]+cols[-1])/2)
anchor=center(rl,rid,rb)
a=np.array(Image.open(str(out/'anatomical-left-source.png')).convert('RGBA'))
n,labels,stats,centers=cv2.connectedComponentsWithStats((a[:,:,3]>32).astype(np.uint8),8)
ids=sorted(range(1,n),key=lambda i:stats[i,4],reverse=True)[:4];ids.sort(key=lambda i:centers[i,1])
ids=[label for start in range(0,4,2) for label in sorted(ids[start:start+2],key=lambda i:centers[i,0])]
scale=float(rs[rid,3]/stats[ids[0],3])
# Anatomical left is the face-level arm on screen-right. The waist hand is anatomical right.
# The old face glove must be inside the replacement corridor so it cannot remain as a third hand.
region=Image.new('L',(768,512));ImageDraw.Draw(region).polygon([(430,78),(480,78),(504,122),(654,118),(658,186),(496,198),(443,171),(433,123)],fill=255)
inside=np.array(region)>0
yy,xx=np.indices((512,768))
old_hand=Image.new('L',(768,512))
ImageDraw.Draw(old_hand).polygon([(423,82),(438,81),(451,90),(468,110),(462,130),(442,131),(428,113),(423,102)],fill=255)
old_hand=np.array(old_hand)>0
# Above the eye line, only the original glove footprint may change; keep the brim intact.
purple_hat=(yy<103)&(xx>=320)&(xx<=501)&(~old_hand)&(ref[:,:,2]>ref[:,:,0].astype(int)+5)&(ref[:,:,2]>ref[:,:,1].astype(int)+8)
inside &= ((yy>=103)|old_hand)&(~purple_hat)
inside |= old_hand
hat_protected=(yy<103)&(xx>=320)&(xx<=501)&(~old_hand|purple_hat)
distance=cv2.distanceTransform(inside.astype(np.uint8),cv2.DIST_L2,3)
mask=Image.fromarray(np.minimum(distance/5,1).astype(np.float32)*255).convert('L')
mask_values=np.array(mask);mask_values[old_hand]=255;mask=Image.fromarray(mask_values)
clean_plate=Image.open(str(out/'hat-clean-source.png')).convert('RGBA').resize((768,512),Image.Resampling.LANCZOS)
hand_mask=Image.fromarray((old_hand.astype(np.uint8)*255))
frames=[neutral.copy()]
for i in (1,2,3):
    label=ids[i];m=(labels==label).astype(np.uint8);support=cv2.dilate(m,np.ones((5,5),np.uint8))
    x,y,w,h,area=stats[label].tolist();bottom=y+h;x0=max(0,x-3);y0=max(0,y-3);x1=min(a.shape[1],x+w+3);y1=min(a.shape[0],bottom+3)
    crop=a[y0:y1,x0:x1].copy();crop[:,:,3]*=support[y0:y1,x0:x1]
    im=Image.fromarray(crop,'RGBA');im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    ox=round(anchor+(x0-center(labels,label,bottom))*scale);oy=round(rb+(y0-bottom)*scale)
    candidate=Image.new('RGBA',(768,512));candidate.paste(im,(ox,oy))
    frame=Image.composite(candidate,neutral,mask)
    frame=Image.composite(clean_plate,frame,hand_mask)
    assert np.array_equal(np.array(frame)[~inside],ref[~inside])
    assert np.array_equal(np.array(frame)[hat_protected],ref[hat_protected])
    frames.append(frame)
frames.append(neutral.copy())
for i,frame in enumerate(frames):
    if i in (0,4):shutil.copyfile(root/'idle/frames/idle-000.png',out/('frame-%02d.png'%i))
    else:frame.save(out/('frame-%02d.png'%i))
    frame.save(out/('frame-%02d.webp'%i),lossless=True,exact=True)
atlas=Image.new('RGBA',(2304,1024))
for i,im in enumerate(frames):atlas.paste(im,((i%3)*768,(i//3)*512))
atlas.save(out/'sheet.png');atlas.save(out/'sheet.webp',lossless=True,exact=True)
seq=[0,1,1,2,2,2,2,3,3,4,4,4];ms=[42,41,42]*4
spec={'character':'changwuyu','animation':'attack','texture':'sheet.webp','frameWidth':768,'frameHeight':512,
      'columns':3,'rows':2,'poseSlots':5,'sequence':seq,'durationsMs':ms,'durationMs':500,'sampleRate':24,
      'loop':False,'firstFrame':0,'lastFrame':4,'noFireball':True,'noStaff':True,'movingLimb':'anatomical left arm: face-level arm on screen-right',
      'phases':[{'name':'左手起势','start':0,'end':2},{'name':'左手向右挥动','start':3,'end':6},{'name':'收回左手','start':7,'end':11}],
      'method':'generated anatomical-left arm; protected hat and clean revealed face plate; immutable idle outside arm corridor',
      'protectedPixels':'right waist-hand and all pixels outside anatomical-left arm corridor; body, lower robe, boots and cloud'}
(out/'sprite.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf8')
play=[frames[i]for i in seq]+[neutral];timing=ms+[900]
play[0].save(out/'preview.webp',save_all=True,append_images=play[1:],duration=timing,loop=0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(768,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'preview.gif',save_all=True,append_images=gif[1:],duration=[40,40,50]*4+[900],loop=0,optimize=True)
assert (out/'frame-00.png').read_bytes()==(out/'frame-04.png').read_bytes()==(root/'idle/frames/idle-000.png').read_bytes()
assert any(not np.array_equal(np.array(frame)[inside],ref[inside])for frame in frames[1:4])
report={'passed':True,'action':'attack','startMatchesIdle':True,'endMatchesIdle':True,
        'neutralSha256':hashlib.sha256((out/'frame-00.png').read_bytes()).hexdigest(),'durationMs':500,
        'outsideLeftArmCorridorIdenticalToIdle':True,'leftArmPixelsActuallyChange':True,'uniqueRasterPoses':len({im.tobytes()for im in frames}),
        'hatProtectedPixelsIdentical':True,
        'anatomyReviewStatus':'final exported pose review pending; source poses have two visible hands',
        'movingArmReference':'screen-right face-level glove moves; waist glove remains fixed'}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
