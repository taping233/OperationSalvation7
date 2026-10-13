from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
import hashlib, json
from PIL import Image

ROOT = Path(__file__).parent
REFS = [
 {'id':'event','image':'https://img2-tc.tapimg.com/moment/etag/Fi5cOyfvXIqroux0e4VS-zscOaUl.jpg/_tap_ugc.jpg','source':'https://www.taptap.cn/moment/695668996837474839','caption':'明日方舟 · 岁的界园志异 · 事件静态截图'},
 {'id':'map','image':'https://i.imgur.com/lmDe4UH.png','source':'https://forum.gamer.com.tw/C.php?bsn=33651&snA=9019','caption':'明日方舟 · 水月与深蓝之树 · 地图静态截图'},
 {'id':'shop','image':'https://is-central.github.io/guides/is6-sui/is6-progression/shop-rob-button.png','source':'https://is-central.github.io/is6-sui/is6-progression/','caption':'明日方舟 · 岁的界园志异 · 商店静态截图'},
]
def get(ref):
    target=ROOT/'refs'/(ref['id']+'.png')
    target.parent.mkdir(exist_ok=True)
    data=urlopen(Request(ref['image'],headers={'User-Agent':'Mozilla/5.0'}), timeout=35).read()
    target.write_bytes(data)
    with Image.open(target) as im:
        im.verify()
    ref.update(path=str(target),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data))
    return ref
with ThreadPoolExecutor(max_workers=3) as pool:
    refs=list(pool.map(get,REFS))
(ROOT/'sources.json').write_text(json.dumps({'date':'2026-10-12','purpose':'图文参考板中的来源截图，仅用于分析','refs':refs},ensure_ascii=False,indent=2),encoding='utf-8')
for ref in refs: print(ref['id'],ref['bytes'],ref['sha256'][:12])
