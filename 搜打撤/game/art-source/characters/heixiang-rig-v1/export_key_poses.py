from __future__ import annotations
import argparse, hashlib, json, math, zipfile
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[4]; HERE=Path(__file__).resolve().parent
LAYERS=HERE/'layers'; SOURCE_DIR=HERE/'source'; RIG_DIR=HERE/'rig'; MOTION_DIR=HERE/'motion'
BATTLE=ROOT/'game/assets/portraits/battle/heixiang.webp'; FILL=SOURCE_DIR/'heixiang-fill-reference.png'; KIN=ROOT/'docs/modules/R4-A-RIG-KINEMATICS.json'; W,H=928,760
SPECS=[
('battle','scarf_static',[(25,170),(405,160),(405,820),(20,830)]),
('battle','lower_body_static',[(245,480),(620,480),(630,1215),(245,1215)]),
('fill','torso_fill',[(285,175),(610,175),(610,570),(285,570)]),
('battle','arm_far_upper',[(210,170),(390,165),(445,375),(270,410)]),('battle','arm_far_fore',[(300,260),(470,255),(625,390),(520,445)]),
('battle','sword',[(555,315),(700,315),(700,1215),(600,1215),(575,520)]),
('battle','arm_near_upper',[(420,155),(570,160),(620,355),(475,385)]),('battle','shoulder_armor',[(430,125),(570,140),(610,315),(455,305)]),
('battle','arm_near_fore',[(465,255),(610,265),(700,390),(570,445)]),
('battle','hands_rigid',[(510,285),(705,290),(715,455),(510,460)]),
('battle','neck_scarf_collar',[(265,130),(530,120),(545,275),(270,275)]),('battle','head',[(325,35),(535,35),(545,255),(325,255)]),
('battle','face_detail_lock',[(385,75),(535,75),(535,215),(385,215)])]
REF={'shoulderFar':(232,171),'elbowFar':(155,257),'wristFar':(116,325),'shoulderNear':(392,165),'elbowNear':(469,254),'wristNear':(501,325)}
def bxy(x,y): return 81+(x-35)*.611,46+(y-58)*.611
def fxy(x,y): return 60+x*.592,35+y*.592
def mk_mask(points):
 m=Image.new('L',(W,H)); ImageDraw.Draw(m).polygon([(round(x),round(y)) for x,y in points],fill=255); return m.filter(ImageFilter.GaussianBlur(1.2))
def cut(base,m):
 o=base.copy(); o.putalpha(Image.fromarray(np.minimum(np.array(base.getchannel('A')),np.array(m)).astype('uint8'))); return o
def clean(im):
 a=np.array(im); a[:,:,3]=np.where(a[:,:,3]<20,0,a[:,:,3]); return Image.fromarray(a,'RGBA')
def largest(im):
 a=np.array(im); n,lab,stats,_=cv2.connectedComponentsWithStats((a[:,:,3]>20).astype('uint8'),8); keep=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]); a[:,:,3]=np.where(lab==keep,a[:,:,3],0); return Image.fromarray(a,'RGBA')
def sources():
 s=Image.open(BATTLE).convert('RGBA').crop((35,58,674,1203)).resize((390,700),Image.Resampling.LANCZOS); battle=Image.new('RGBA',(W,H)); battle.alpha_composite(s,(81,46)); battle=clean(battle)
 r=np.array(Image.open(FILL).convert('RGB')); gc=np.zeros(r.shape[:2],np.uint8); bg=np.zeros((1,65),np.float64); fg=np.zeros((1,65),np.float64); cv2.grabCut(cv2.cvtColor(r,cv2.COLOR_RGB2BGR),gc,(24,8,r.shape[1]-48,r.shape[0]-20),bg,fg,7,cv2.GC_INIT_WITH_RECT); al=np.where((gc==cv2.GC_FGD)|(gc==cv2.GC_PR_FGD),255,0).astype('uint8'); al=cv2.GaussianBlur(al,(3,3),0); rr=Image.fromarray(np.dstack((r,al)),'RGBA').resize((492,720),Image.Resampling.LANCZOS); fill=Image.new('RGBA',(W,H)); fill.alpha_composite(rr,(60,35)); return {'battle':battle,'fill':clean(fill)}
def segment(im,a,b,c,d):
 q=math.atan2(d[1]-c[1],d[0]-c[0])-math.atan2(b[1]-a[1],b[0]-a[0]); co,si=math.cos(q),math.sin(q); tx=c[0]-(co*a[0]-si*a[1]); ty=c[1]-(si*a[0]+co*a[1]); inv=(co,si,-co*tx-si*ty,-si,co,si*tx-co*ty); return im.transform((W,H),Image.Transform.AFFINE,inv,Image.Resampling.BICUBIC)
def rotate(im,center,degrees): return im.rotate(-degrees,Image.Resampling.BICUBIC,center=center)
def glove(im,src,dst,degrees):
 t=rotate(im,src,degrees); return t.transform((W,H),Image.Transform.AFFINE,(1,0,src[0]-dst[0],0,1,src[1]-dst[1]),Image.Resampling.BICUBIC)
def ora(images):
 merged=Image.new('RGBA',(W,H)); [merged.alpha_composite(x) for x in images.values()]; stack=[]
 with zipfile.ZipFile(SOURCE_DIR/'heixiang-rig-v1.ora','w') as z:
  z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
  for i,(n,im) in enumerate(images.items()):
   buf=BytesIO(); im.save(buf,'PNG'); fn=f'data/{i:02d}-{n}.png'; z.writestr(fn,buf.getvalue()); stack.append((n,fn))
  z.writestr('stack.xml','<?xml version="1.0"?><image version="0.0.1" w="928" h="760"><stack>'+''.join(f'<layer name="{escape(n)}" src="{f}"/>' for n,f in reversed(stack))+'</stack></image>'); buf=BytesIO(); merged.save(buf,'PNG'); z.writestr('mergedimage.png',buf.getvalue())
def init():
 [d.mkdir(parents=True,exist_ok=True) for d in (LAYERS,SOURCE_DIR,RIG_DIR,MOTION_DIR)]; base=sources(); images={}
 for sid,n,pts in SPECS:
  mapper=bxy if sid=='battle' else fxy; images[n]=cut(base[sid],mk_mask([mapper(x,y) for x,y in pts])); images[n]=largest(images[n]) if n=='sword' else images[n]
  if n=='lower_body_static':
   sm=np.array(mk_mask([bxy(x,y) for x,y in [(545,300),(710,300),(710,1215),(545,1215)]])); a=np.array(images[n]); a[:,:,3]=np.minimum(a[:,:,3],255-sm); images[n]=Image.fromarray(a,'RGBA')
   # The planted sword hides the outer strip of the near leg in the identity source.
   # Reconstruct only that hidden strip from mirrored pixels of the original far leg.
   patch=base['battle'].crop((245,340,330,752)).transpose(Image.Transpose.FLIP_LEFT_RIGHT); pc=Image.new('RGBA',(W,H)); pc.alpha_composite(patch,(340,340)); pm=Image.new('L',(W,H)); ImageDraw.Draw(pm).polygon([(382,345),(425,345),(430,752),(382,752)],fill=255); pa=np.array(pc); pa[:,:,3]=np.minimum(pa[:,:,3],np.array(pm)); images[n].alpha_composite(Image.fromarray(pa,'RGBA'))
  if n=='torso_fill':
   a=np.array(images[n]).astype('float32'); a[:,:,:3]=np.clip(a[:,:,:3]*.62,0,255); images[n]=Image.fromarray(a.astype('uint8'),'RGBA')
  images[n].save(LAYERS/f'{n}.png')
 k=json.loads(KIN.read_text(encoding='utf-8')); rig={'schemaVersion':1,'scope':'upper-body-sword-rig','canvas':{'width':W,'height':H},'pivot':k['pivot'],'joints':k['rig'],'layers':list(images),'sources':{'identity':str(BATTLE.relative_to(ROOT)).replace('\\','/'),'fillReference':str(FILL.relative_to(ROOT)).replace('\\','/'),'identitySha256':hashlib.sha256(BATTLE.read_bytes()).hexdigest()},'usage':{'fillReference':['torso_fill interior only'],'identitySource':['head','face_detail_lock','arms','hands_rigid','shoulder_armor','neck_scarf_collar','scarf_static','lower_body_static','sword'],'staticInCandidate':['lower_body_static','scarf_static'],'experimentalNotRendered':['leg IK from kinematics report']}}
 (RIG_DIR/'heixiang-rig-v1.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); (MOTION_DIR/'key-poses.json').write_text(json.dumps({'schemaVersion':1,'poses':{p['id']:p for p in k['poses']}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); ora(images); print('INIT PASS')
def export(outdir):
 outdir.mkdir(parents=True,exist_ok=True); rig=json.loads((RIG_DIR/'heixiang-rig-v1.json').read_text(encoding='utf-8')); mot=json.loads((MOTION_DIR/'key-poses.json').read_text(encoding='utf-8')); layers={n:Image.open(LAYERS/f'{n}.png').convert('RGBA') for n in rig['layers']}; j={k:(v['x'],v['y']) for k,v in rig['joints'].items()}
 for pid,p in mot['poses'].items():
  out=Image.new('RGBA',(W,H))
  if p['angleDeg']>30: out.alpha_composite(rotate(layers['sword'],(457,258),p['angleDeg']))
  out.alpha_composite(layers['scarf_static']); out.alpha_composite(layers['lower_body_static']); out.alpha_composite(layers['torso_fill'])
  for side in ('far','near'):
   cap=side.title(); q=p['arms'][side]; out.alpha_composite(segment(layers[f'arm_{side}_upper'],j[f'shoulder{cap}'],j[f'elbow{cap}'],(q['shoulder']['x'],q['shoulder']['y']),(q['elbow']['x'],q['elbow']['y']))); out.alpha_composite(segment(layers[f'arm_{side}_fore'],j[f'elbow{cap}'],j[f'wrist{cap}'],(q['elbow']['x'],q['elbow']['y']),(q['wrist']['x'],q['wrist']['y'])))
  out.alpha_composite(layers['shoulder_armor'])
  if p['angleDeg']<=30: out.alpha_composite(rotate(layers['sword'],(457,258),p['angleDeg']))
  out.alpha_composite(rotate(layers['hands_rigid'],(457,258),p['angleDeg']))
  out.alpha_composite(layers['neck_scarf_collar']); out.alpha_composite(layers['head']); out.alpha_composite(layers['face_detail_lock']); out.save(outdir/f'pose-{pid}.png')
 print('EXPORT PASS',outdir)
def main():
 p=argparse.ArgumentParser(); p.add_argument('--init',action='store_true'); p.add_argument('--export',action='store_true'); p.add_argument('--outdir',type=Path,default=HERE/'qa'); a=p.parse_args()
 if a.init:init()
 if a.export:export(a.outdir)
 if not(a.init or a.export):p.error('choose --init and/or --export')
if __name__=='__main__':main()
