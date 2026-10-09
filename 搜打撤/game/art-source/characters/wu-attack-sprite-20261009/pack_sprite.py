"""Extract connected generated figures, align boot anchors, and pack sprites."""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
import hashlib
import json
import shutil
import sys

out = Path(__file__).absolute().parent
shutil.copyfile(Path(sys.argv[1]), out/'generated-sheet.png')
rgba = np.array(Image.open(str(out/'generated-sheet.png')).convert('RGBA'))
count, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:,:,3]>32).astype(np.uint8),8)
ids = [i for i in range(1,count) if stats[i,4]>1000]
assert len(ids)==12, len(ids)
# Generated cells have uneven margins. The twelve disconnected figures are the extraction units.
ids.sort(key=lambda i:(round((stats[i,1]+stats[i,3]-384)/381),centers[i,0]))
frames=[]
alignments=[]
for i,label in enumerate(ids):
    mask=(labels==label).astype(np.uint8)
    support=cv2.dilate(mask,np.ones((5,5),np.uint8))
    x,y,w,h,area=stats[label].tolist()
    bottom=y+h
    foot=mask[max(0,bottom-12):bottom]
    columns=np.where(foot.sum(axis=0)>0)[0]
    gaps=np.where(np.diff(columns)>5)[0]
    assert len(gaps)==1, (i,columns.tolist())
    left=columns[:gaps[0]+1]; right=columns[gaps[0]+1:]
    lx=(left[0]+left[-1])/2; rx=(right[0]+right[-1])/2
    scale=200/(rx-lx)
    crop=rgba[max(0,y-3):min(rgba.shape[0],bottom+3),max(0,x-3):min(rgba.shape[1],x+w+3)].copy()
    keep=support[max(0,y-3):min(rgba.shape[0],bottom+3),max(0,x-3):min(rgba.shape[1],x+w+3)]
    crop[:,:,3]=crop[:,:,3]*keep
    source=Image.fromarray(crop,'RGBA')
    resized=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    offset_x=round(256-(lx+rx)/2*scale+max(0,x-3)*scale)
    offset_y=round(460-bottom*scale+max(0,y-3)*scale)
    assert offset_x>=0 and offset_y>=0 and offset_x+resized.width<512 and offset_y+resized.height<512,(i,offset_x,offset_y,resized.size)
    frame=Image.new('RGBA',(512,512))
    frame.paste(resized,(offset_x,offset_y))
    frame.save(out/('attack-%02d.png'%i))
    frame.save(out/('attack-%02d.webp'%i),lossless=True)
    frames.append(frame)
    alignments.append({'frame':i,'sourceBounds':[x,y,w,h],'bootCenters':[lx,rx],'scale':scale,'offset':[offset_x,offset_y]})

atlas=Image.new('RGBA',(2048,1536))
for i,im in enumerate(frames): atlas.paste(im,((i%4)*512,(i//4)*512))
atlas.save(out/'wu-attack-sheet.png')
atlas.save(out/'wu-attack-sheet.webp',lossless=True)
# Holds give anticipation/recovery more time; the slash itself advances on every 24fps step.
sequence=[0,1,1,2,3,3,4,5,6,7,8,9,10,10,11,11]
durations=[42,41,42]*5+[42]
total=sum(durations)
gif_durations=[40,40,50,40,40,40]*2+[40,40,50,40]
play=[frames[i] for i in sequence]+[frames[0]]
play[0].save(out/'wu-attack-preview.webp',save_all=True,append_images=play[1:],duration=durations+[900],loop=0,quality=85,method=0)
gif=[]
for im in play:
    bg=Image.new('RGBA',(512,512),'#202734');bg.alpha_composite(im);gif.append(bg.convert('RGB'))
gif[0].save(out/'wu-attack-preview.gif',save_all=True,append_images=gif[1:],duration=gif_durations+[900],loop=0,optimize=True)
meta={'status':'candidate','character':'wu','animation':'attack','texture':'wu-attack-sheet.webp',
      'frameWidth':512,'frameHeight':512,'columns':4,'rows':3,'uniquePoseFrames':12,
      'sampleRate':24,'sequence':sequence,'durationsMs':durations,'durationMs':total,'loop':False,
      'impactStep':8,'restFrame':0,'previewRestMs':900,
      'phases':[{'name':'蓄力','start':0,'end':5},{'name':'斩击','start':6,'end':9},{'name':'收势','start':10,'end':15}],
      'method':'imagegen twelve poses; figure extraction and boot alignment; intentional anticipation/recovery holds; no skeleton or optical-flow morphing',
      'alignment':alignments}
(out/'sprite.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
boxes=[im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for im in frames]
assert all(b[0]>0 and b[1]>0 and b[2]<512 and b[3]<512 for b in boxes),boxes
report={'passed':True,'poses':12,'timelineSteps':16,'sampleRate':24,'durationMs':total,
        'alphaCornersZero':all(im.getpixel((0,0))[3]==0 for im in frames),
        'bounds':boxes,'uniqueImages':len({im.tobytes() for im in frames})}
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
large=[f.name for f in out.iterdir() if f.is_file() and f.stat().st_size>1000000]
(out/'.gitignore').write_text('# Local assets over 1 MB; hashes recorded in receipt.\n'+'\n'.join(large)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
