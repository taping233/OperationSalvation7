import argparse,hashlib,json,re
from pathlib import Path
from PIL import Image
import cairosvg
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
GAME=ROOT.parent/'搜打撤/game'
parser=argparse.ArgumentParser(description='Export current node-room assets; preserve existing destination metadata.')
parser.add_argument('--output',type=Path,default=HERE/'draft/Resources',help='Resources destination; default keeps the historical local draft output.')
OUT=parser.parse_args().output
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
data=json.loads((HERE/'source-data.json').read_text(encoding='utf-8'))
records=[]
def export(source,relative):
    dest=OUT/relative;dest.parent.mkdir(parents=True,exist_ok=True)
    with Image.open(source) as im:rgba=im.convert('RGBA')
    pixels=hashlib.sha256(rgba.tobytes()).hexdigest()
    same=False
    if dest.exists():
        with Image.open(dest) as old:same=old.size==rgba.size and hashlib.sha256(old.convert('RGBA').tobytes()).hexdigest()==pixels
    if not same:rgba.save(dest,optimize=True)
    records.append(dict(source=str(source.relative_to(GAME)).replace('\\','/'),output=str(relative).replace('\\','/'),sourceSha256=sha(source),outputSha256=sha(dest),bytes=dest.stat().st_size,size=list(rgba.size),rgbaSha256=pixels))
for item in data['scenes']:
    relative=Path('Art/Current/node-rooms')/Path(item['source']).with_suffix('.png')
    export(GAME/'assets'/item['source'],relative)
    item['resource']=str(relative.with_suffix('')).replace('\\','/')
export(GAME/'assets/ui/illustrated-node/choice-winter-v1.webp',Path('Art/Current/node-rooms/choice-winter-v1.png'))
for name in ['recovery-v2','restoration-v2']:
    export(GAME/('assets/ui/outcome/'+name+'.webp'),Path('Art/Current/node-rooms/outcome')/(name+'.png'))
for ghost in data['ghosts']:
    source=HERE/'source-svg'/(ghost['kind']+'.svg');dest=OUT/'Art/Current/node-rooms/ghosts'/(ghost['kind']+'.png');dest.parent.mkdir(parents=True,exist_ok=True)
    cairosvg.svg2png(url=str(source),write_to=str(dest),output_width=240,output_height=200)
    records.append(dict(source='source-svg/'+source.name,output=str(dest.relative_to(OUT)).replace('\\','/'),sourceSha256=sha(source),outputSha256=sha(dest),bytes=dest.stat().st_size,method='rasterize original illustratedGhostHTML SVG at 240x200, unchanged paths'))
manifest=OUT/'Data/CurrentNodeRooms.json';manifest.parent.mkdir(parents=True,exist_ok=True)
manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(HERE/'assets-receipt.json').write_text(json.dumps(dict(files=records,manifestSha256=sha(manifest)),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(images=len(records),maxBytes=max(x['bytes'] for x in records))))
