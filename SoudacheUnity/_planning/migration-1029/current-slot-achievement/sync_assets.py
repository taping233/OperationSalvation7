"""Current slot/achievement source assets only; no generated illustrations."""
from pathlib import Path
import hashlib,json,re,uuid
import cairosvg,numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).parent;GAME=ROOT.parent/'搜打撤/game';OUT=ROOT/'Assets/Resources/Art/CurrentArchive';OUT.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();assets=[]
def record(src,dst,method):assets.append(dict(source=src.relative_to(GAME).as_posix(),sourceSha256=sha(src),output=dst.relative_to(ROOT).as_posix(),outputSha256=sha(dst),bytes=dst.stat().st_size,conversion=method))
def svg(src,key,xml,w,h):
    dst=OUT/(key+'.png');xml=xml.replace('currentColor','#f4f3f1').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ',1)
    cairosvg.svg2png(bytestring=xml.encode(),write_to=str(dst),output_width=w,output_height=h);record(src,dst,'exact inline SVG paths; CairoSVG raster')
src=GAME/'src/ui/slot-emblems.js'
for i,xml in enumerate(re.findall(r'`(<svg.*?</svg>)`',src.read_text(encoding='utf-8'),re.S)):svg(src,'slot-emblem-'+str(i+1),xml,288,288)
for i in range(1,6):
    original=Image.open(OUT/f'slot-emblem-{i}.png').convert('RGBA').resize((122,122),Image.Resampling.LANCZOS);alpha=Image.new('L',(258,258));alpha.paste(original.getchannel('A'),(68,68));layer=Image.new('RGBA',alpha.size)
    for radius,color,opacity in [(34,(202,208,213),.5),(11,(238,240,241),.9)]:
        glow=Image.new('RGBA',alpha.size,color+(0,));glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(radius)).point(lambda a:int(a*opacity)));layer=Image.alpha_composite(layer,glow)
    dst=OUT/f'slot-glow-{i}.png';layer.save(dst);record(src,dst,'same source SVG alpha, literal CSS drop-shadow11px/34px at native122px seal size')
src=GAME/'src/ui/menu-slot-view.js'
for key,w,h in [('horse',400,340),('deer',440,380),('birds',840,140)]:
    xml=re.search(r'<svg class="(?:sil )?sil-'+key+r'".*?</svg>',src.read_text(encoding='utf-8'),re.S)[0];svg(src,'sil-'+key,xml,w,h)
for style in ['gesture','ink','collage','symbol']:
    src=GAME/f'assets/ui/achievement-styles/{style}.webp';dst=OUT/(style+'.png');Image.open(src).convert('RGBA').save(dst);record(src,dst,'original WebP decoded to RGBA PNG; original pixels and canvas')
src=GAME/'assets/scenes/cinematic/archive-leaves-v1.webp'
assert src.exists();dst=OUT/'archive-leaves-v1.png';Image.open(src).convert('RGBA').save(dst);record(src,dst,'original WebP decoded to RGBA PNG')
def rgba(s):
    s=s.lstrip('#');return np.array([int(s[i:i+2],16)/255 for i in (0,2,4)]+[int(s[6:8],16)/255 if len(s)==8 else 1.])
def stops(t,items):return np.stack([np.interp(t,[i[0]for i in items],[rgba(i[1])[c]for i in items])for c in range(4)],axis=-1)
def over(a,b):
    alpha=b[...,3:]+a[...,3:]*(1-b[...,3:]);rgb=(b[...,:3]*b[...,3:]+a[...,:3]*a[...,3:]*(1-b[...,3:]))/np.maximum(alpha,1e-8);return np.concatenate((rgb,alpha),axis=-1)
def save(key,p,src):
    dst=OUT/(key+'.png');Image.fromarray(np.clip(p*255,0,255).astype('uint8'),'RGBA').save(dst);record(src,dst,'literal final CSS gradient paint, raster; native text and interaction remain separate')
y,x=np.mgrid[0:1080,0:1920];x=x/1919;y=y/1079
p=stops(np.sqrt(((x-.5)/1.2)**2+((y-.28)/.9)**2),[(0,'#34383c'),(.34,'#292c2f'),(.62,'#1f2123'),(1,'#141517')])
p=over(p,stops(np.sqrt(((x-.5)/1.2)**2+((y-.42)/.9)**2),[(0,'#08090900'),(.5,'#08090900'),(.88,'#0809097a'),(1,'#070708a3')]))
p=over(p,stops(x,[(0,'#0b0c0d7a'),(.22,'#0b0c0d00'),(.78,'#0b0c0d00'),(1,'#0b0c0d7a')]))
p=over(p,stops(y,[(0,'#0a0b0b00'),(.74,'#0a0b0b00'),(1,'#0a0b0b80')]))
save('slot-page',p,GAME/'css/page-slot-select.css')
p=np.zeros((1080,1920,4))
for cx,cy,rx,ry,color,stop in [(.52,.84,.50,.40,'#2224278c',.72),(.72,.40,.38,.30,'#a2adb426',.70),(.30,.62,.42,.34,'#84909842',.68)]:
    layer=np.broadcast_to(rgba(color),p.shape).copy();layer[...,3]*=np.clip(1-np.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)/stop,0,1);p=over(p,layer)
save('slot-mist',p,GAME/'css/page-slot-select.css')
y,x=np.mgrid[0:64,0:64];x=x/63;y=y/63
save('slot-bokeh',stops(np.sqrt(((x-.38)/.9)**2+((y-.34)/.94)**2),[(0,'#f5f6f7d9'),(.55,'#bdc5cb42'),(.72,'#bdc5cb00'),(1,'#bdc5cb00')]),GAME/'css/page-slot-select.css')
y,x=np.mgrid[0:1024,0:256];x=x/255;y=y/1023
save('slot-card-shade',stops(y,[(0,'#14161788'),(.4,'#131516b3'),(.78,'#0f1011f2'),(1,'#0f1011fa')]),GAME/'css/winter.css')
p=stops(np.sqrt(((x-.5)/.5)**2+((y+.08)/1.08)**2),[(0,'#dbdfe333'),(.55,'#dbdfe300'),(1,'#dbdfe300')]);p=over(p,stops(np.sqrt(((x-.5)/.5)**2+((y-1.12)/1.12)**2),[(0,'#0f1011cc'),(.62,'#0f101100'),(1,'#0f101100')]))
save('slot-card-light',p,GAME/'css/winter.css')
for image in OUT.glob('*.png'):
    meta=Path(str(image)+'.meta')
    if not meta.exists():meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\nTextureImporter:\n  internalIDToNameTable: []\n  externalObjects: {}\n  serializedVersion: 13\n  mipmaps:\n    enableMipMap: 0\n  isReadable: 0\n  textureType: 8\n  spriteMode: 1\n  spritePixelsToUnits: 100\n  alphaIsTransparency: 1\n  maxTextureSize: 4096\n  textureCompression: 0\n  platformSettings:\n  - serializedVersion: 3\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: 4096\n    resizeAlgorithm: 0\n    textureFormat: -1\n    textureCompression: 0\n    compressionQuality: 100\n    crunchedCompression: 0\n    allowsAlphaSplitting: 0\n    overridden: 0\n',encoding='utf-8')
sources=['src/ui/menu-slots.js','src/ui/menu-slot-view.js','src/ui/slot-emblems.js','src/ui/achievement-gallery.js','src/ui/achievement-medals.js','src/ui/achievement-motion.js','src/ui/menu-guide.js','src/ui/camp-entry.js','src/ui/archive-motion.js','src/ui/page-motion-profiles.js','src/ui/transition-handoff.js','src/ui/silent-node-film.js','src/ui/cinematic-profiles.js','src/ui/motion-presets.js','src/ui/collection-chrome.js','css/overlays.css','css/winter.css','css/page-slot-select.css','css/title-achievements.css','css/collection-chrome.css','css/review-ui.css','css/archive-motion.css','css/archive-back.css','css/navigation-feedback.css','css/home-linked-interactions.css','css/silent-node-film.css','css/secondary-ui-tokens.css']
(HERE/'source-receipt.json').write_text(json.dumps(dict(assets=assets,sources=[dict(path=s,sha256=sha(GAME/s))for s in sources],reused=['Assets/Resources/Art/CurrentHome/<selected-wallpaper>.png','Assets/Resources/Art/CurrentHome/linked-back.png','Assets/Resources/Art/Current/ui/achievement-styles/painted.png']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(assets=len(assets),bytes=sum(a['bytes']for a in assets)),ensure_ascii=False))
