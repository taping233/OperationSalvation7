import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
here = Path(__file__).resolve().parent
source = Path(r'C:\Users\太平\.codex\generated_images\01a14489-de98-7f00-9212-75dbef54de9d\exec-962df0b8-363b-44e7-9aa2-1974d08e141b.png')
output = root / 'game/assets/reconstruction/wallpaper-snow-road-1016.webp'
previous = json.loads((here / 'receipt.json').read_text(encoding='utf-8')) if (here / 'receipt.json').exists() else None

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

with Image.open(source) as original:
    original.load()
    size = original.size
    original.convert('RGB').save(output, 'WEBP', quality=95, method=6)
with Image.open(output) as result:
    result.load()
    assert result.size == size
assert output.stat().st_size < 1000000

def replace_once(path, before, after):
    data = path.read_bytes()
    before = before.encode('utf-8')
    after = after.encode('utf-8')
    if before not in data:
        assert data.count(after) == 1, path
        return
    assert data.count(before) == 1, path
    path.write_bytes(data.replace(before, after))

replace_once(root / 'game/index.html', 'assets/reconstruction/wallpaper-wu-1004.webp?v=snow-expanded-1009', 'assets/reconstruction/wallpaper-snow-road-1016.webp')
replace_once(root / 'game/index.html', '切换壁纸，当前第1张，共2张', '切换壁纸，当前第1张，共1张')
replace_once(root / 'game/index.html', '>1/2</b>', '>1/1</b>')
replace_once(root / 'game/css/winter.css', '../assets/reconstruction/wallpaper-original.webp', '../assets/reconstruction/wallpaper-snow-road-1016.webp')
entry = {
    'path': str(output.relative_to(root / 'game/assets')).replace('\\', '/'),
    'ext': 'webp', 'bytes': output.stat().st_size, 'sha256': sha(output),
    'license': '项目AI生成素材（老板指定本图实装首页）',
    'source': 'docs/evidence/2026-10-16-home-snow-road/receipt.json',
}
manifest_path = root / 'game/assets/asset-manifest.json'
data = manifest_path.read_bytes()
manifest = json.loads(data)
existing = next((item for item in manifest['assets'] if item['path'] == entry['path']), None)
newline = '\r\n' if b'\r\n' in data else '\n'
anchor = '  "assets": [' + newline
serialized = json.dumps(entry, ensure_ascii=False, indent=2)
serialized = newline.join('    ' + line for line in serialized.splitlines())
if existing is None:
    replace_once(manifest_path, anchor, anchor + serialized + ',' + newline)
    replace_once(manifest_path, '  "count": ' + str(manifest['count']) + ',', '  "count": ' + str(manifest['count'] + 1) + ',')
else:
    old_serialized = json.dumps(existing, ensure_ascii=False, indent=2)
    old_serialized = newline.join('    ' + line for line in old_serialized.splitlines())
    if existing != entry:
        replace_once(manifest_path, old_serialized, serialized)
for relative in ['game/index.html', 'game/css/title-p0.css', 'game/css/settings-navigation.css', 'game/css/winter.css']:
    path = root / relative
    content = path.read_bytes()
    content = content.replace(b'wallpaper-snow-road-1016.webp\'', b'wallpaper-snow-road-1016.webp?v=1016b\'')
    content = content.replace(b'wallpaper-snow-road-1016.webp"', b'wallpaper-snow-road-1016.webp?v=1016b"')
    path.write_bytes(content)
retired = ['reconstruction/wallpaper-wu-1004.webp', 'reconstruction/wallpaper-ensemble-1005.webp']
receipt = {
    'date': '2026-10-16', 'authorization': '老板指定PNG接入首页，原有壁纸退役，保留切换功能供以后安装其他壁纸',
    'source': {'path': str(source), 'bytes': source.stat().st_size, 'sha256': sha(source), 'size': size,
               'acquisition': '老板消息提供的本机generated_images PNG；原图不复制入Git'},
    'output': dict(entry, size=size, encoding='Pillow WebP quality 95 method 6；保持原尺寸，无裁切、重绘或调色'),
    'retired': [{'path': path, 'sha256': sha(root / 'game/assets' / path), 'status': '退出首页选项，原文件保留'} for path in retired],
}
receipt['supersededSelections'] = previous.get('supersededSelections', []) if previous else []
if previous and previous['source']['path'] != str(source):
    receipt['supersededSelections'].append({'source': previous['source'], 'output': previous['output'], 'reason': '老板本轮追加指定新PNG替换；不保留在切换列表'})
(here / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt['output'], ensure_ascii=False))
