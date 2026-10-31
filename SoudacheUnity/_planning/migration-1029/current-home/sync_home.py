"""Import only the live home cover. Pixels and inline SVG come from the current Vite tree.
No image generation, deletion, shared asset maps or Unity invocation.
"""
import hashlib, json, re, shutil, uuid, xml.etree.ElementTree as ET
from pathlib import Path
import cairosvg
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont
from fontTools.ttLib import TTFont

PROJECT = Path(__file__).resolve().parents[3]
GAME = PROJECT.parent / '搜打撤' / 'game'
OUT = PROJECT / 'Assets/Resources/Art/CurrentHome'
OUT.mkdir(parents=True, exist_ok=True)
HERE = Path(__file__).parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_files = ['index.html', 'css/base.css', 'css/winter.css', 'css/ui-scale.css', 'css/title-p0.css', 'css/ak-skin.css',
                'css/home-polish.css', 'css/home-layers.css', 'css/home-ui-tokens.css',
                'css/home-menu-motion.css', 'css/title-credits.css', 'css/page-settings.css',
                'src/ui/home-fx.js', 'src/ui/home-layers.js', 'src/ui/home-menu-motion.js',
                'src/ui/title-wallpaper.js', 'src/ui/title-credits.js', 'src/ui/menu-feedback.js',
                'src/ui/feedback.local.js', 'src/ui/home-linked-interactions.js', 'css/home-linked-interactions.css', 'version.json']
records = []
def record(src, dst, operation):
    records.append(dict(source=str(src.relative_to(GAME)).replace('\\','/'), sourceSha256=sha(src),
                        output=str(dst.relative_to(PROJECT)).replace('\\','/'), outputSha256=sha(dst),
                        operation=operation, size=list(Image.open(dst).size) if dst.suffix == '.png' else None))
wallpapers = [
 ('snow-road','reconstruction/wallpaper-snow-road-1016.webp'),
 ('baita-heixiang','reconstruction/wallpaper-baita-heixiang-1016.webp'),
 ('xingyue-piano','reconstruction/wallpaper-xingyue-piano-1020.webp'),
 ('wu-bass','reconstruction/wallpaper-wu-bass-1020.webp'),
 ('baita-station','reconstruction/wallpaper-baita-station-1020.webp'),
 ('xingyue-reeds','reconstruction/wallpaper-xingyue-reeds-1020.webp'),
 ('companions-dinner','slot-bg-knight-fantasy.webp')]
for key, relative in wallpapers + [('wordmark','title-wordmark.png'),('mail-empty','ui/sugin-mail-empty.webp')]:
    src, dst = GAME/'assets'/relative, OUT/(key+'.png')
    with Image.open(src) as im: im.convert('RGBA' if 'A' in im.getbands() else 'RGB').save(dst)
    record(src,dst,'original pixels; WebP/PNG to native PNG')
    if key=='baita-heixiang':
        with Image.open(src) as im:
            pixels=np.array(im.convert('RGB')).astype(float)/255
            luma=np.sum(pixels*np.array([.213,.715,.072]),axis=-1,keepdims=True)
            pixels=luma+(pixels-luma)*.88;pixels=((pixels-.5)*1.03+.5)*.96
            filtered=OUT/'baita-heixiang-filtered.png'
            Image.fromarray(np.clip(pixels*255,0,255).astype('uint8'),'RGB').save(filtered)
        record(src,filtered,'home-polish.css alternate layer saturate(.88) contrast(1.03) brightness(.96)')
html=(GAME/'index.html').read_text(encoding='utf-8')
for ident in ['mStart','mGuide','mAch','btnCardLib','mSettings','mCredits','btnTitleExit',
              'btnTitleMute','mInbox','btnTitleWallpaper','btnTitleWallpaperView']:
    block=re.search(r'<button\b[^>]*\bid="'+ident+r'"[^>]*>(.*?)</button>',html,re.S)[1]
    svgs=re.findall(r'<svg\b.*?</svg>',block,re.S)
    for i, svg in enumerate(svgs):
        node=ET.fromstring(svg)
        # title-p0.css line icons inherit stroke/fill, which do not live on the SVG itself.
        node.attrib.update(xmlns='http://www.w3.org/2000/svg',fill='none',stroke='white',
                           **{'stroke-width':'1.8' if ident == 'mAch' else '1.6',
                              'stroke-linecap':'round','stroke-linejoin':'round'})
        raw=ET.tostring(node).replace(b'currentColor',b'white')
        dst=OUT/(ident+('-off' if i else '')+'.png')
        cairosvg.svg2png(bytestring=raw,write_to=str(dst),output_width=176,output_height=176)
        record(GAME/'index.html',dst,'exact inline SVG + final title-p0/home-polish stroke; CairoSVG raster')
for weight in [600,700]:
    src=GAME/f'assets/fonts/rajdhani-latin-{weight}-normal.woff2';dst=OUT/f'Rajdhani-{weight}.ttf'
    font=TTFont(src);font.flavor=None;font.recalcTimestamp=False;font.save(dst)
    record(src,dst,'lossless WOFF2 decompression to Unity TTF; same glyphs and metrics')
backsource=GAME/'src/ui/home-linked-interactions.js'
svg=re.search(r'<svg\b.*?</svg>',backsource.read_text(encoding='utf-8'),re.S)[0].replace('currentColor','white').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ',1)
dst=OUT/'linked-back.png';cairosvg.svg2png(bytestring=svg.encode(),write_to=str(dst),output_width=96,output_height=96)
record(backsource,dst,'current linkedBackHTML inline SVG, unchanged paths')

# CSS gradients become native sprites; geometry/colour stops are copied from the final cascade.
generated=[]
def save_generated(key, rgba, source):
    dst=OUT/(key+'.png'); Image.fromarray(np.clip(rgba*255,0,255).astype('uint8'),'RGBA').save(dst)
    generated.append(dict(key=key,path=str(dst.relative_to(PROJECT)).replace('\\','/'),
                          sha256=sha(dst),source=source))
def colour(value):
    value=value.lstrip('#'); return np.array([int(value[i:i+2],16)/255 for i in range(0,len(value),2)] + ([1] if len(value)==6 else []))
def over(a,b):
    alpha=b[...,3:4]+a[...,3:4]*(1-b[...,3:4]); rgb=(b[...,:3]*b[...,3:4]+a[...,:3]*a[...,3:4]*(1-b[...,3:4]))/np.maximum(alpha,1e-9)
    return np.concatenate((rgb,alpha),axis=-1)
W,H=1920,1080
y,x=np.mgrid[0:H,0:W];x=x/W;y=y/H
shade=np.zeros((H,W,4))
for stops in [[(0,'12131599'),(.25,'12131500'),(.86,'12131500'),(1,'12131566')]]:
    layer=np.stack([np.interp(1-y,[s[0] for s in stops],[colour(s[1])[i] for s in stops]) for i in range(4)],-1);shade=over(shade,layer)
stops=[(0,'080e18e0'),(.25,'0c142096'),(.43,'13141600'),(.61,'13141600'),(1,'080e18b8')]
layer=np.stack([np.interp(x,[s[0] for s in stops],[colour(s[1])[i] for s in stops]) for i in range(4)],-1);shade=over(shade,layer)
for cx,cy,rx,ry,stops in [(.53,.40,.70,.76,[(.28,'05091000'),(.58,'05091040'),(1,'05060ac9')]),(.52,0,.46,.38,[(0,'bcd6ff29'),(.72,'bcd6ff00')])]:
    r=np.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)
    layer=np.stack([np.interp(r,[s[0] for s in stops],[colour(s[1])[i] for s in stops]) for i in range(4)],-1);shade=over(shade,layer)
save_generated('scene-shade',shade,'home-polish.css ::after four gradient stack')
slash=np.zeros((H,W,4));sx=(x-.62)/.38;boundary=.24*(1-y)
slash[...,0:3]=colour('080a0e')[:3]
slash[...,3]=np.interp(y,[0,.22,.8,1],[0,.62,.62,0])*(sx>=boundary)
save_generated('home-slash',slash,'home-layers.js polygon and SVG hlSlashFill')
angle=(np.degrees(np.arctan2(x-.52,-(y+.12)))-168)%360
beam=np.zeros((H,W,4));beam[...,:3]=colour('cfe0ff')[:3]
beam[...,3]=np.interp(angle,[0,4,7,11,17,20,25,31,34,38,360],[0,0,.149,0,0,.11,0,0,.125,0,0])*np.clip(1-y/.7,0,1)
save_generated('home-beams',beam,'home-layers.css conic-gradient(from 168deg at 52% -12%) and mask')
my,mx=np.mgrid[0:432,0:2304];mx=mx/2304;my=my/432
mist=np.zeros((432,2304,4))
for cx,cy,rx,ry,value in [(.2,.7,.4,.5,'9fb4d03d'),(.62,.82,.45,.45,'b9c9e030'),(.92,.66,.3,.4,'9fb4d035')]:
    r=np.sqrt(((mx-cx)/rx)**2+((my-cy)/ry)**2);layer=np.empty_like(mist);layer[...,:3]=colour(value)[:3]
    layer[...,3]=np.clip(1-r/.7,0,1)*colour(value)[3];mist=over(mist,layer)
save_generated('home-mist',mist,'home-polish.css three ground-mist radial gradients; screen blend remains native material')
rng=np.random.default_rng(0);noise=rng.random((180,180));grain=np.empty((180,180,4));grain[...,:3]=np.clip(noise[...,None]*2-.5,0,1);grain[...,3]=1
save_generated('home-grain',grain,'home-polish.css monochrome grain carrier; native seeded noise for SVG feTurbulence')
sy,sx=np.mgrid[0:108,0:1398];t=(sx+sy*.268)/1398
sheen=np.ones((108,1398,4));sheen[...,3]=np.interp(t,[0,.4,.5,.6,1],[0,0,.55,0,0])
save_generated('home-sheen',sheen,'home-polish.css 105deg transparent40% white50% transparent60% /260%')
for key,svg in [
 ('home-ripple','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 1040"><circle cx="520" cy="520" r="517" stroke="#d9f1ff" stroke-width="3" fill="#bfe8ff" fill-opacity=".12"/></svg>'),
 ('home-snow-dot','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><radialGradient id="g"><stop stop-color="#f2f3f4"/><stop offset=".25" stop-color="#f2f3f4"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><circle cx="10" cy="10" r="10" fill="url(#g)"/></svg>'),
 ('home-spark','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,0 60,40 100,50 60,60 50,100 40,60 0,50 40,40" fill="#fff3c4"/></svg>')]:
    dst=OUT/(key+'.png');cairosvg.svg2png(bytestring=svg.encode(),write_to=str(dst),output_width=1024 if key=='home-ripple' else 64,output_height=1024 if key=='home-ripple' else 64)
    generated.append(dict(key=key,path=str(dst.relative_to(PROJECT)).replace('\\','/'),sha256=sha(dst),source='winter.css/home-polish.css geometric primitive'))
for key,w,h,stops,reverse in [
 ('plate-start',538,108,[(0,'bbcbd2'),(.72,'e1d6b2')],False),
 ('plate-guide',441,72,[(0,'14202dbd'),(1,'14202d00')],False),
 ('plate-collection',423,90,[(0,'14202dd4'),(.65,'14202d73'),(1,'14202d00')],True),
 ('plate-system',363,58,[(0,'121c2899'),(1,'121c2800')],True)]:
    xx=np.linspace(1,0,w) if reverse else np.linspace(0,1,w)
    face=np.tile(np.stack([np.interp(xx,[s[0] for s in stops],[colour(s[1])[i] for s in stops]) for i in range(4)],-1),(h,1,1))
    if key=='plate-start':
        py,px=np.mgrid[0:h,0:w];angle=np.radians(105)
        t=((px-w/2)*np.sin(angle)-(py-h/2)*np.cos(angle))/(w*abs(np.sin(angle))+h*abs(np.cos(angle)))+.5
        face=np.stack([np.interp(t,[s[0] for s in stops],[colour(s[1])[i] for s in stops]) for i in range(4)],-1)
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).polygon([(0,0),(w-18,0),(w,18),(w,h),(18,h),(0,h-18)],fill=255)
    face[...,3]*=np.array(mask)/255
    save_generated(key,face,'title-p0.css --plate-shape; home-polish.css final --plate-fill')
    if key=='plate-start':
        fx=face.copy();xx=np.linspace(0,1,w)
        for i in range(3):fx[...,i]=np.interp(xx,[0,.7,1],[colour('f2f7ed')[i],colour('fff0c9')[i],colour('fff0c9')[i]])
        save_generated('glow-start',fx,'home-polish.css final .home-start > .home-hover-glow')
    else:
        xx=np.linspace(0,1,w);yy=np.linspace(0,1,h)[:,None]
        fx=np.zeros((h,w,4));fx[...,:3]=colour('bceaff')[:3]
        r=np.sqrt(((xx-(.9 if reverse else .12))/.72)**2+((yy-.5)/1)**2)
        fx[...,3]=np.clip(1-r,0,1)*(.22 if reverse else .19)
        fx[0,:,3]=np.maximum(fx[0,:,3],np.linspace(.47,0,w) if reverse else np.linspace(.4,0,w))
        fx[-1,:,3]=np.maximum(fx[-1,:,3],np.linspace(0,.33,w))
        fx[...,3]*=np.array(mask)/255
        save_generated('glow-'+key[6:],fx,'home-polish.css option-light radial/edge layer')

receipt=dict(sourceRoot=str(GAME),sourceFingerprints=[dict(path=p,sha256=sha(GAME/p)) for p in source_files],
             files=records,derived=generated,wallpapers=[k for k,_ in wallpapers],defaultWallpaper='wu-bass',
             styleOrder=['ui-scale.css → title-p0.css','ak-skin.css','home-menu-motion.css / home-ui-tokens.css',
                         'home-fx.js → home-polish.css','home-layers.js → dynamic home-layers.css','title-credits.css'],
             nativeVisualVerification='pending parent native capture; no foreground/Unity/compile invoked')
(HERE/'source-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Own metadata only; preserve existing GUIDs. Keep the 3200px wordmark and transparent SVGs lossless.
template=(PROJECT/'Assets/Resources/Art/Current/title-wordmark.png.meta').read_text(encoding='utf-8')
for dst in OUT.glob('*'):
    if dst.suffix not in ('.png','.ttf'):continue
    meta=Path(str(dst)+'.meta')
    if meta.exists():continue
    guid=uuid.uuid5(uuid.NAMESPACE_URL,str(dst.relative_to(PROJECT)).replace('\\','/')).hex
    if dst.suffix=='.png':
        data=re.sub(r'(?m)^guid: .+$','guid: '+guid,template)
        for old,new in [('enableMipMap: 1','enableMipMap: 0'),('maxTextureSize: 2048','maxTextureSize: 4096'),
                        ('textureCompression: 1','textureCompression: 0'),('alphaIsTransparency: 0','alphaIsTransparency: 1'),
                        ('wrapU: 0','wrapU: 1'),('wrapV: 0','wrapV: 1')]:data=data.replace(old,new)
    else:
        data=f'''fileFormatVersion: 2\nguid: {guid}\nTrueTypeFontImporter:\n  externalObjects: {{}}\n  serializedVersion: 4\n  fontSize: 16\n  forceTextureCase: -2\n  characterSpacing: 0\n  characterPadding: 1\n  includeFontData: 1\n  fontNames:\n  - Rajdhani\n  fallbackFontReferences: []\n  customCharacters: \n  fontRenderingMode: 0\n  ascentCalculationMode: 1\n  useLegacyBoundsCalculation: 0\n  shouldRoundAdvanceValue: 1\n  subsetRecipes: []\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n'''
    meta.write_text(data,encoding='utf-8')
owned=[PROJECT/'Assets/Scripts/Sdt.Res/CurrentHomeAssets.cs']+list((PROJECT/'Assets/Scripts/Sdt.UI/Screens/Menu').glob('CurrentHome*.cs'))+list((PROJECT/'Assets/Scripts/Sdt.UI/Screens/Menu').glob('HomeInbox*.cs'))
for dst in owned:
    meta=Path(str(dst)+'.meta')
    if not meta.exists():meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid5(uuid.NAMESPACE_URL,str(dst.relative_to(PROJECT)).replace('\\','/')).hex+'\n',encoding='utf-8')
print(json.dumps(dict(imported=len(records),derived=len(generated),default='wu-bass',wallpapers=7)))
