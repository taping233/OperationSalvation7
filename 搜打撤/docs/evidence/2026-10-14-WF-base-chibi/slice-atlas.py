"""Slice generated atlas cells without repainting or replacing alpha."""
from pathlib import Path
import hashlib
import json
import sys
from collections import deque
from PIL import Image

source, target = Path(sys.argv[1]), Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
atlas = Image.open(source).convert('RGBA')
names = ['head', 'hair', 'body', 'arm-back', 'arm-front', 'leg-back', 'leg-front', 'sword']
width, height = atlas.size
receipt = {'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'size': [width, height], 'parts': []}
for index, name in enumerate(names):
    col, row = index % 4, index // 4
    cell = atlas.crop((col * width // 4, row * height // 2, (col + 1) * width // 4, (row + 1) * height // 2))
    # Neighboring cell's ponytail fringes must not expand a leg's crop.
    alpha = cell.getchannel('A')
    cw, ch = cell.size
    mask = bytearray(1 if value > 24 else 0 for value in alpha.getdata())
    largest = 0
    bounds = None
    for start in range(cw * ch):
        if not mask[start]:
            continue
        queue = deque([start]); mask[start] = 0
        count = 0; left = cw; top = ch; right = bottom = 0
        while queue:
            point = queue.popleft(); x, y = point % cw, point // cw
            count += 1; left = min(left, x); top = min(top, y); right = max(right, x + 1); bottom = max(bottom, y + 1)
            for neighbor in (point - cw if y else -1, point + cw if y + 1 < ch else -1, point - 1 if x else -1, point + 1 if x + 1 < cw else -1):
                if neighbor >= 0 and mask[neighbor]:
                    mask[neighbor] = 0; queue.append(neighbor)
        if count > largest:
            largest = count; bounds = (max(0, left - 2), max(0, top - 2), min(cw, right + 2), min(ch, bottom + 2))
    if not bounds:
        raise ValueError(f'Empty atlas cell: {name}')
    part = cell.crop(bounds)
    if max(part.size) > 512:
        part.thumbnail((512, 512), Image.Resampling.LANCZOS)
    output = target / f'{name}.webp'
    part.save(output, 'WEBP', quality=92, method=6)
    decoded = Image.open(output).convert('RGBA')
    assert decoded.getchannel('A').getextrema()[0] == 0
    receipt['parts'].append({'path': name + '.webp', 'cell': [col, row], 'crop': bounds, 'size': list(decoded.size), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
(target / 'SOURCE.md').write_text('# 无的基地Q版拆件 v1\n\n由 Codex 内置 image_gen 生成，参考项目现行无立绘；老板授权制作游戏小人。八格图集切分、透明 WebP 编码，不改绘画内容。提示词、原稿SHA256与切分记录见 docs/evidence/2026-10-14-WF-base-chibi。\n', encoding='utf-8')
Path(__file__).with_name('atlas-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
