import hashlib,json,re,shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
E=Path(__file__).resolve().parent
req=json.loads((E/'request.json').read_text(encoding='utf-8'))
source=Path(req['source'])
target=ROOT/'game/assets'/req['asset']
assert not target.exists(), 'Battle sprite already exists; do not overwrite'
raw=ROOT/'.tmp/imagegen/2026-10-25-migaofen-battle/final-source.png'
raw.parent.mkdir(parents=True,exist_ok=True)
assert not raw.exists(), 'Saved source already exists'
shutil.copy2(source,raw)
with Image.open(source) as im:
    assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0, 'Source must carry actual transparent alpha'
    figure=im.copy()
figure.thumbnail((920,1382),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(1024,1536),(0,0,0,0))
canvas.alpha_composite(figure,((1024-figure.width)//2,(1536-figure.height)//2))
target.parent.mkdir(parents=True,exist_ok=True)
canvas.save(target,'WEBP',quality=92,method=6)
with Image.open(target) as check:
    alpha=check.getchannel('A')
    assert alpha.getextrema()[0]==0 and alpha.getextrema()[1]>240
    histogram=alpha.histogram()
    transparency={'mode':check.mode,'size':list(check.size),'alpha_extrema':list(alpha.getextrema()),
                  'fully_transparent_pixels':histogram[0],'total_pixels':check.width*check.height,
                  'outer_corners_alpha':[alpha.getpixel(p) for p in [(0,0),(1023,0),(0,1535),(1023,1535)]]}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
entry={'path':req['asset'],'ext':'webp','bytes':target.stat().st_size,'sha256':digest(target),
       'license':'项目自有（AI 生成）','source':'docs/evidence/2026-10-25-migaofen-battle/receipt.json'}
receipt={'method':'Built-in ImageGen alpha cutout and right-facing repose; RGBA WebP encoding with transparent padding',
         'source':str(source),'source_sha256':digest(source),
         'saved_source':raw.relative_to(ROOT).as_posix(),'output':entry,'transparency':transparency}
(E/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
p=ROOT/'game/assets/asset-manifest.json'
with p.open('r',encoding='utf-8-sig',newline='') as f:text=f.read()
nl='\r\n' if '\r\n' in text else '\n'
assert not any(a['path']==req['asset'] for a in json.loads(text)['assets']), 'Manifest entry already exists'
encoded=json.dumps(entry,ensure_ascii=False,indent=2).splitlines()
block=encoded[0]+nl+nl.join('    '+line for line in encoded[1:])
at=text.index('[',text.index('"assets"'))+1
text=text[:at]+nl+'    '+block+','+text[at:]
count=len(json.loads(text)['assets'])
text=re.sub(r'("count"\s*:\s*)\d+',lambda m:m.group(1)+str(count),text,count=1)
with p.open('w',encoding='utf-8',newline='') as f:f.write(text)
print(json.dumps({'output':entry,'transparency':transparency},ensure_ascii=False,indent=2))
