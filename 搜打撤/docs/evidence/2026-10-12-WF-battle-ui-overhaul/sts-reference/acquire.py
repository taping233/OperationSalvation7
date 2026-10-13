from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
import json,hashlib
from PIL import Image
ROOT=Path(__file__).parent
ROOT.mkdir(exist_ok=True)
meta=json.load(urlopen('https://store.steampowered.com/api/appdetails?appids=646570',timeout=25))['646570']['data']
def fetch(item):
    target=ROOT/f'steam-{item["id"]:02d}.jpg'
    data=urlopen(Request(item['path_full'],headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
    target.write_bytes(data)
    with Image.open(target) as im: im.verify()
    return {'id':item['id'],'path':target.name,'image_url':item['path_full'],'source':'https://store.steampowered.com/app/646570/Slay_the_Spire/','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'purpose':'开发者Steam商店截图，设计分析参考'}
with ThreadPoolExecutor(max_workers=4) as pool:
    refs=list(pool.map(fetch,meta['screenshots'][:4]))
(ROOT/'sources.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'id':r['id'],'bytes':r['bytes']} for r in refs]))
