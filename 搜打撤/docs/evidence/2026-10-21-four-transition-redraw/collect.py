import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT.parent / '.tmp/imagegen/four-transition-redraw-20261021'
OUT.mkdir(parents=True, exist_ok=True)
paths = {
    'retreat': 'exec-7cae7516-8cb3-4dda-9bbf-df2a65bbfece.png',
    'door': 'exec-c7d7f36c-57fa-4200-80e2-ec5a4f718ddc.png',
    'altar': 'exec-722d4e49-b2a5-4144-aba5-d3b3c4efafca.png',
    'shop': 'exec-833ffd43-f668-4260-b3b8-9bfc0213de1c.png',
}
GEN = Path('C:/Users/太平/.codex/generated_images/01a15a22-8b3e-7611-97f9-321deb86583d')
file = HERE / 'request.json'
record = json.loads(file.read_text(encoding='utf-8'))
for item in record['items']:
    source = GEN / paths[item['id']]
    target = OUT / (item['id'] + '.png')
    webp = OUT / (item['id'] + '.webp')
    assert not target.exists() and not webp.exists(), 'Do not overwrite a candidate.'
    shutil.copy2(source, target)
    with Image.open(source) as im:
        size = list(im.size)
        im.convert('RGB').save(webp, 'WEBP', quality=94, method=6)
    item.update(status='generated-awaiting-feedback', generatedSource=str(source), output=str(target),
                preview=str(webp), size=size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                webpSha256=hashlib.sha256(webp.read_bytes()).hexdigest(), webpBytes=webp.stat().st_size,
                referenceHashes=[hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in item['references']])
record.update(status='four-generated-awaiting-feedback', integration='四张为重绘候选，未替换运行图/引用或清单',
              observed='四图保留原主构图并使用不透明块面覆色。商店灯具已收至三盏与现代物资箱；祭坛晶体和三张室外图地面仍有较多局部细节，待老板反馈。')
file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{'id':x['id'],'size':x['size'],'webpBytes':x['webpBytes']} for x in record['items']]))
