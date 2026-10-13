"""为本任务自有导入产物补充RGBA编码；不改图、不抠背景、不改全局工具。"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
EVIDENCE.relative_to(ROOT.resolve())
receipt_path = EVIDENCE / 'receipt.json'
receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
helper_path = Path('C:/Users/太平/.codex/skills/game-card-art-fast/scripts/import_cards.py')
spec = importlib.util.spec_from_file_location('card_import_encoding', helper_path)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

prepared = []
for item in receipt['items']:
    raw = (ROOT / item['raw']['path']).resolve()
    if digest(raw) != item['raw']['sha256']:
        raise SystemExit('本任务原始RGBA来源变化，停止。')
    outputs = []
    for output in item['outputs']:
        path = (ROOT / output['path']).resolve()
        path.relative_to((ROOT / 'game/assets').resolve())
        if digest(path) != output['sha256']:
            raise SystemExit('运行图被其他改动更新，停止：' + str(path))
        outputs.append(path)
    with Image.open(raw) as original:
        if 'A' not in original.getbands() or original.getchannel('A').getextrema()[0] != 0:
            raise SystemExit('生成源没有透明通道，停止。')
        image = original.convert('RGBA')
    prepared.append((item, image, outputs))

changes = []
for item, image, (full, thumb) in prepared:
    image.save(full, 'WEBP', quality=90, method=6)
    small = image.copy()
    small.thumbnail((448, 448), Image.Resampling.LANCZOS)
    alpha = small.getchannel('A')
    rgb = small.convert('RGB')
    pixels = rgb.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            old = pixels[x, y]
            pixels[x, y] = tuple(max(0, min(255, round(
                sum(row[i] * old[i] for i in range(3)) - .02575 * 255)))
                for row in helper.MATRIX)
    small = rgb.convert('RGBA')
    small.putalpha(alpha)
    small.save(thumb, 'WEBP', quality=82, method=6)
    for output, path in zip(item['outputs'], (full, thumb)):
        before = {'path': path.relative_to(ROOT / 'game/assets').as_posix(),
                  'bytes': output['bytes'], 'sha256': output['sha256']}
        output['bytes'] = path.stat().st_size
        output['sha256'] = digest(path)
        with Image.open(path) as decoded:
            if 'A' not in decoded.getbands() or decoded.getchannel('A').getextrema()[0] != 0:
                raise SystemExit('重新编码后alpha缺失，停止。')
            output['alpha_range'] = list(decoded.getchannel('A').getextrema())
        patch = next(p for p in item['manifest_patches'] if p['after']['path'] == before['path'])
        patch['after']['bytes'] = output['bytes']
        patch['after']['sha256'] = output['sha256']
        changes.append({'before': before, 'after': {
            'path': before['path'], 'bytes': output['bytes'], 'sha256': output['sha256']}})
receipt['alpha_preservation'] = 'Original RGBA preserved; existing RGB thumbnail bake with alpha retained; decoded outputs checked.'
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'alpha-encoding-changes.json').write_text(
    json.dumps(changes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(changes, ensure_ascii=False, indent=2))
