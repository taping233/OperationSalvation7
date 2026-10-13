"""Project painted body/lid textures; never regenerate a frame's chest identity."""
from pathlib import Path
import json, math, hashlib, sys
import numpy as np
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
kind=sys.argv[1] if len(sys.argv)>1 else 'small'
OUT=ROOT/('game/assets/scenes/chests/'+kind+'-rig-v1')
OUT.mkdir(parents=True,exist_ok=True)
SIZE=1254
body=Image.open(HERE/('source/'+kind+'-body-v1.png')).convert('RGBA')
top=Image.open(HERE/('source/'+kind+'-lid-top-v1.png')).convert('RGBA')
top=top.crop(top.getchannel('A').point(lambda a:255 if a>127 else 0).getbbox())
# Existing painted inner surface, rectified into UV space. No procedural repaint.
old=Image.open(HERE.parent/'art-calibration/modern-chest/source/modern-supply-frame-04.png').convert('RGBA')
inner=old.transform((900,450),Image.QUAD,(324,111,412,537,1190,685,1158,227),Image.BICUBIC)
# Match each family's painted bevel/corner silhouette on both faces.
inner=inner.resize(top.size,Image.LANCZOS)
inner.putalpha(top.getchannel('A'))

def project(texture,quad):
    tw,th=texture.size
    uv=[(0,0),(tw,0),(tw,th),(0,th)]
    a=[]; b=[]
    for (x,y),(u,v) in zip(quad,uv):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
        b.extend([u,v])
    coeff=np.linalg.solve(np.array(a),np.array(b))
    return texture.transform((SIZE,SIZE),Image.PERSPECTIVE,coeff,Image.BICUBIC)

rear=[(376,560),(1153,734)]
depth=[(-284,176),(-225,230)]
height=460
if kind=='medium':
    rear=[(380,500),(1170,654)]
    depth=[(-285,168),(-220,207)]
    height=415
elif kind=='large':
    rear=[(398,422),(1178,590)]
    depth=[(-329,181),(-238,245)]
    height=370
elif kind=='class':
    rear=[(443,505),(1143,660)]
    depth=[(-295,161),(-186,208)]
    height=415
elif kind=='boss':
    rear=[(376,444),(1132,621)]
    depth=[(-270,225),(-181,262)]
    height=380
angles=[0,0,0,2,5,10,17,26,37,49,61,72,82,90,97,102,105,105]
receipt=[];frames=[]
for i,angle in enumerate(angles):
    rad=math.radians(angle)
    delta=[(d[0]*math.cos(rad),d[1]*math.cos(rad)-height*math.sin(rad)) for d in depth]
    quad=[rear[0],rear[1],(rear[1][0]+delta[1][0],rear[1][1]+delta[1][1]),(rear[0][0]+delta[0][0],rear[0][1]+delta[0][1])]
    image=body.copy()
    # Visible side changes when the plane passes the camera's grazing angle.
    surface=top if sum(d[1] for d in delta)>0 else inner
    if abs(sum(d[1] for d in delta))>2:
        image.alpha_composite(project(surface,quad))
    # Fixed joint pins, mechanically identical position in every frame.
    joint=Image.new('RGBA',(SIZE,SIZE)); d=ImageDraw.Draw(joint)
    for t in (.12,.86):
        x=rear[0][0]+(rear[1][0]-rear[0][0])*t;y=rear[0][1]+(rear[1][1]-rear[0][1])*t
        d.line([(x-22,y-5),(x+22,y+5)],fill=(113,114,111,255),width=12)
    image.alpha_composite(joint)
    path=OUT/f'frame-{i:02}.webp';image.save(path,'WEBP',lossless=True)
    frames.append('/assets/scenes/chests/'+kind+'-rig-v1/'+path.name)
    receipt.append({'frame':i,'angle':angle,'hinge':rear,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'alphaExtrema':image.getchannel('A').getextrema()})
    if i in (0,5,9,13,17):
        preview=image.copy();preview.thumbnail((300,300));preview.save(HERE/f'{kind}-preview-{i:02}.png')
json.dump({'kind':kind,'fps':24,'frames':frames,'hingeSourcePixels':rear,'bodyInvariant':'same RGBA body bytes composited each frame','framesReceipt':receipt},open(HERE/(kind+'-rig-receipt.json'),'w',encoding='utf8'),ensure_ascii=False,indent=2)
board=Image.new('RGB',(1500,300),(37,45,49))
for j,i in enumerate((0,5,9,13,17)):
    p=Image.open(HERE/f'{kind}-preview-{i:02}.png');board.paste(p,(j*300,0),p)
board.save(HERE/(kind+'-rig-contact.jpg'),quality=92)
print(json.dumps({'out':str(OUT),'fps':24,'frames':len(frames),'hinge':rear}))
