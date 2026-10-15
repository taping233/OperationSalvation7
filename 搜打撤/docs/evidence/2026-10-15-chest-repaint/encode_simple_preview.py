"""Register painted frames by their motionless right body edge; preserve generated alpha."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/chests/safe-simple-v7'
OUT=SOURCE/'preview'
assert not OUT.exists(),'Use a new output directory.'
OUT.mkdir()
request=json.loads((SOURCE/'animation-request.json').read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def body_anchor(image):
    # The rightmost part contains only stationary case, never moving door or inner light.
    left=round(image.width*.78)
    strong=image.getchannel('A').point(lambda alpha:255 if alpha>210 else 0)
    bounds=strong.crop((left,0,image.width,image.height)).getbbox()
    assert bounds
    return (left+bounds[2],bounds[1],bounds[3])
frames=[]
records=[]
ref=None
for index,item in enumerate(request['items']):
    original=Path(item['source'])
    if not original.is_absolute():original=ROOT/original
    if index in (1,2,4):
        local=SOURCE/(item['role']+'-source.png')
        assert not local.exists()
        shutil.copy2(original,local)
    else:local=original
    item['local_source']=str(local.relative_to(ROOT)).replace('\\','/')
    item['sha256']=sha(local)
    with Image.open(local) as source:
        assert source.mode=='RGBA' and source.getchannel('A').getextrema()[0]==0
        if index<4:
            anchor=body_anchor(source)
            if ref is None:ref=(anchor,640/source.width)
            reference,base_scale=ref
            scale=(reference[2]-reference[1])*base_scale/(anchor[2]-anchor[1])
            offset=(round(reference[0]*base_scale-anchor[0]*scale),round(reference[1]*base_scale-anchor[1]*scale))
            resized=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
            encoded=Image.new('RGBA',(640,640))
            encoded.paste(resized,offset)
            frames.append(encoded)
            name=f'frame-{index:02}.webp'
            processing=dict(scale=scale,offset=list(offset),body_anchor=list(anchor))
        else:
            encoded=source.resize((640,640),Image.Resampling.LANCZOS)
            name='burst.webp'
            processing=dict(size=[640,640])
        target=OUT/name
        encoded.save(target,'WEBP',lossless=True,method=6)
        alpha=encoded.getchannel('A')
        assert alpha.getextrema()[0]==0 and alpha.getextrema()[1]>220
        records.append(dict(path=str(target.relative_to(ROOT)).replace('\\','/'),sha256=sha(target),bytes=target.stat().st_size,
                            source=item['local_source'],alpha_extrema=list(alpha.getextrema()),processing=processing))
animation=OUT/'opening-loop.webp'
frames[0].save(animation,'WEBP',save_all=True,append_images=frames[1:],duration=[650,160,200,1100],loop=0,lossless=True,method=6)
request.update(status='preview-encoded',assets=records,loop=dict(path=str(animation.relative_to(ROOT)).replace('\\','/'),sha256=sha(animation),bytes=animation.stat().st_size),
               technical_processing='Isotropic registration using stationary case right edge; alpha preserved, lossless encoding. No repaint, keying or generated light composited into frames.')
(SOURCE/'animation-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2),encoding='utf-8')
(Path(__file__).parent/'simple-preview-receipt.json').write_text(json.dumps(request,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(frames),'assets':len(records),'loop_bytes':animation.stat().st_size,'total_bytes':sum(row['bytes'] for row in records)}))
