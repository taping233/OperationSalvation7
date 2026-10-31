"""Import only live gallery assets. No image generation, shared registry edits or Unity."""
import hashlib, json, re, uuid
from pathlib import Path
import cairosvg
import numpy as np
from PIL import Image

PROJECT = Path(__file__).resolve().parents[3]
GAME = PROJECT.parent / '搜打撤/game'
OUT = PROJECT / 'Assets/Resources/Art/CurrentPhoto'
OUT.mkdir(parents=True, exist_ok=True)
HERE = Path(__file__).parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
records = []
sources = ['src/hub/game.cardslib.js','src/hub/game.cardslib.page.js','src/hub/game.cardslib.photo-props.js',
 'src/hub/photo-studio-presentation.js','src/hub/photo-studio-controls.js','src/hub/photo-studio-navigation.js',
 'src/hub/photo-studio-tabs.js','src/hub/photo-studio-catalog-cache.js','src/ui/card-browser.js',
 'src/ui/card-browser-state.js','src/ui/card-zoom-controller.js','src/ui/card-zoom-content.js',
 'src/ui/card-zoom-photo-source.js','src/cards/card-photo-notes.js','src/cards/card-draw-explanation.js',
 'src/ui/collection-chrome.js','src/ui/motion-presets.js','css/collection-chrome.css',
 'css/expedition-library.css','css/photo-studio-mounts.css','css/photo-studio-unified.css',
 'css/photo-studio-room-effects.css','css/photo-studio-zoom-motion.css','data/card-notes.json',
 'src/cards/card-description-text.js','src/cards/structured-card-description.js','src/cards/card-state-presentation.js',
 'src/cards/battle-value-context.js','src/cards/card-energy-policy.js','src/cards/rot-seed-revision.js',
 'src/cards/card-description-links.js','src/cards/cards.view.js','src/core/scavenge-terminology.js',
 'src/ui/term-definitions.js','src/ui/term-tips.js','src/ui/status-icons.js']

def record(src, dst, method):
    records.append(dict(source=src.relative_to(GAME).as_posix(), sourceSha256=sha(src),
      output=dst.relative_to(PROJECT).as_posix(), outputSha256=sha(dst), conversion=method,
      bytes=dst.stat().st_size, size=list(Image.open(dst).size)))

for src in [GAME/'assets/scenes/transition-photo-v2.webp', GAME/'assets/ui/photo-studio/paper-grain.png',
            GAME/'assets/ui/photo-studio/frame-atelier-v1.png'] + list((GAME/'assets/ui/photo-studio').glob('*.svg')):
    dst = OUT/(src.stem+'.png')
    if src.suffix=='.svg':
        node=src.read_text(encoding='utf-8')
        box=re.search(r'viewBox="([^"]+)"',node)[1].split()
        cairosvg.svg2png(url=str(src),write_to=str(dst),output_width=int(float(box[2])),output_height=int(float(box[3])))
        record(src,dst,'original SVG paths/gradients; CairoSVG at source viewBox size')
    else:
        with Image.open(src) as im: im.convert('RGBA').save(dst)
        record(src,dst,'original pixels; WebP/PNG to native RGBA PNG')

# Rasterise the final CSS paint layers. Live controls/text remain native and separate.
css=GAME/'css/photo-studio-unified.css'
def rgba(h):
    h=h.lstrip('#');return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)]+[int(h[6:8],16)/255 if len(h)==8 else 1.])
def over(a,b):
    alpha=b[...,3:]+a[...,3:]*(1-b[...,3:]);rgb=(b[...,:3]*b[...,3:]+a[...,:3]*a[...,3:]*(1-b[...,3:]))/np.maximum(alpha,1e-8)
    return np.concatenate((rgb,alpha),axis=-1)
def save(key,pixels):
    dst=OUT/(key+'.png');Image.fromarray(np.clip(pixels*255,0,255).astype('uint8'),'RGBA').save(dst)
    record(css,dst,'final photo-studio-unified.css gradient/paper-grain paint layers, native raster')
W=H=512;y,x=np.mgrid[0:H,0:W];x=x/(W-1);y=y/(H-1)
grain=np.asarray(Image.open(GAME/'assets/ui/photo-studio/paper-grain.png').convert('RGBA').resize((512,512)))/255
for key,base1,base2,overlay1,overlay2 in [
 ('paper','#f3e8d4','#dac9ad','#eee6d3a6','#b9ac98a6'),
 ('zoom-paper','#dde1d3','#c7cebd','#e4e5d9a6','#aab3a5a6')]:
    t=np.clip((x*.819+y*.574)/(1.393),0,1)[...,None]
    pixels=rgba(base1)*(1-t)+rgba(base2)*t
    pixels[...,:3]*=1-grain[...,3:]+grain[...,:3]*grain[...,3:]
    pixels=over(pixels,rgba(overlay1)*(1-t)+rgba(overlay2)*t)
    for cx,cy,col,stop in [(.08,0,'#fff1d07a',.68),(1,1,'#7e9aaf24',.66)]:
        fade=np.clip(1-np.sqrt(((x-cx)/1.3)**2+((y-cy)/1.0)**2)/stop,0,1)
        layer=np.broadcast_to(rgba(col),pixels.shape).copy();layer[...,3]*=fade;pixels=over(pixels,layer)
    save(key,pixels)

# Final darkroom shade stack, separate from original room pixels and native contents.
W,H=1920,1080;y,x=np.mgrid[0:H,0:W];x=x/(W-1);y=y/(H-1)
def stops(t, pairs):
    result=np.zeros(t.shape+(4,))
    for i in range(4): result[...,i]=np.interp(t,[p[0] for p in pairs],[rgba(p[1])[i] for p in pairs])
    return result
shade=stops(y,[(0,'#151d19'),(.18,'#151d19'),(.34,'#151d19a0'),(.56,'#151d1900'),(1,'#0b141045')])
shade=over(shade,stops(x,[(0,'#121b17db'),(.46,'#121b179e'),(.78,'#121b1755'),(1,'#121b17b0')]))
for cx,cy,col,stop in [(.79,.8,'#d4aa6436',.34),(.1,.94,'#6c91b43b',.53),(.16,0,'#edca8847',.62)]:
    d=np.sqrt(((x-cx)/(max(cx,1-cx)*2**.5))**2+((y-cy)/(max(cy,1-cy)*2**.5))**2)
    layer=np.broadcast_to(rgba(col),shade.shape).copy();layer[...,3]*=np.clip(1-d/stop,0,1);shade=over(shade,layer)
save('room-shade',shade)
save('zoom-shade',stops(y,[(0,'#101813'),(.18,'#101813'),(.38,'#0c1410ed'),(1,'#0c1410ed')]))

# Source inline category marks and shutter, unchanged paths.
page=GAME/'src/hub/game.cardslib.page.js';text=page.read_text(encoding='utf-8')
marks=re.search(r'const marks = \{(.*?)\n  \};',text,re.S)[1]
for typ,mark in re.findall(r"'([^']+)':\s*'([^']+)'",marks):
    dst=OUT/('category-'+typ+'.png')
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+mark+'</svg>'
    cairosvg.svg2png(bytestring=svg.encode(),write_to=str(dst),output_width=96,output_height=96);record(page,dst,'exact studioCategoryBadgeHTML inline SVG')
shutter=re.search(r"const STUDIO_SHUTTER_ICON = '(.*?)';",text)[1]
dst=OUT/'shutter.png';cairosvg.svg2png(bytestring=shutter.replace('currentColor','white').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ',1).encode(),write_to=str(dst),output_width=96,output_height=96);record(page,dst,'exact STUDIO_SHUTTER_ICON inline SVG')

# Native texture import keeps originals and alpha; do not replace existing GUIDs.
for image in OUT.glob('*.png'):
    meta=Path(str(image)+'.meta')
    if not meta.exists():
        meta.write_text('fileFormatVersion: 2\nguid: '+uuid.uuid4().hex+'\nTextureImporter:\n  serializedVersion: 12\n  mipmaps:\n    enableMipMap: 0\n  isReadable: 0\n  textureType: 0\n  maxTextureSize: 4096\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 1\n    aniso: 1\n    mipBias: 0\n    wrapU: 1\n    wrapV: 1\n    wrapW: 1\n  alphaIsTransparency: 1\n  textureCompression: 0\n  platformSettings:\n  - serializedVersion: 3\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: 4096\n    textureCompression: 0\n    overridden: 0\n',encoding='utf-8')
(HERE/'source-receipt.json').write_text(json.dumps(dict(authority='../搜打撤/game current bytes',
  sourceFiles=[dict(path=p,sha256=sha(GAME/p)) for p in sources],assets=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(assets=len(records),sources=len(sources),bytes=sum(r['bytes'] for r in records))))
