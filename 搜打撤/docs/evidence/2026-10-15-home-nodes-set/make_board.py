from pathlib import Path
import hashlib
import json
import shutil
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
GENERATED = Path('C:/Users/太平/.codex/generated_images/01a13ecf-f22d-70c2-8ad7-65619d028474')
copies = {
    'achievement-v5.png': 'exec-2034ce64-6e03-487d-a37a-78226af06c97.png',
    'exit-v1.png': 'exec-947c48a2-554e-402b-a685-9bffae474417.png',
    'exit-v2.png': 'exec-00a5ee9c-8afc-42d5-808d-efc769b00a73.png',
}
config = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')) if len(sys.argv) > 1 else {}
copies = config.get('copies', copies)
for target, source in copies.items():
    assert (GENERATED / source).is_file(), source
    shutil.copy2(GENERATED / source, HERE / target)

items = [
    ('city', '进入城市', HERE.parent / '2026-10-15-home-nodes-retry/city-v7.png'),
    ('guide', '生存指南', HERE / 'guide-v3.png'),
    ('achievement', '成就总览', HERE / 'achievement-v5.png'),
    ('photo', '照相馆', HERE / 'photo-v3.png'),
    ('settings', '设置', HERE / 'settings-v1.png'),
    ('credits', '制作名单', HERE / 'credits-v1.png'),
    ('exit', '退出游戏', HERE / 'exit-v2.png'),
]
if config.get('items'):
    items = [(name, label, Path(path)) for name, label, path in config['items']]
if config.get('preserve'):
    prior = json.loads((HERE / 'board-receipt.json').read_text(encoding='utf-8'))
    prior_hashes = {item['id']: item['sha256'] for item in prior['items']}
    for name, _, path in items:
        if name in config['preserve']:
            assert hashlib.sha256(path.read_bytes()).hexdigest() == prior_hashes[name], name
font_path = 'C:/Windows/Fonts/msyh.ttc'
title_font = ImageFont.truetype(font_path, 46)
label_font = ImageFont.truetype(font_path, 30)
small_font = ImageFont.truetype(font_path, 21)
board = Image.new('RGBA', (2080, 1270), '#171b20')
draw = ImageDraw.Draw(board)
draw.text((70, 38), '首页选项图标', font=title_font, fill='#f0ede5')
draw.text((72, 105), config.get('subtitle', '七项设计 · 本轮汇总'), font=small_font, fill='#a3abb6')
draw.line((70, 150, 2010, 150), fill='#343b44', width=1)
receipt = []
for i, (name, label, path) in enumerate(items):
    x = 40 + i * 500 if i < 4 else 290 + (i - 4) * 500
    y = 168 if i < 4 else 700
    with Image.open(path) as source:
        assert source.mode == 'RGBA', (name, source.mode)
        alpha = source.getchannel('A')
        assert alpha.getextrema()[0] == 0, (name, 'no transparent pixels')
        original_size = source.size
        artwork = source.copy()
        artwork.thumbnail((470, 470), Image.Resampling.LANCZOS)
        board.alpha_composite(artwork, (x + (500 - artwork.width) // 2, y))
        receipt.append({'id': name, 'label': label,
                        'source': str(path), 'dimensions': original_size,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'bytes': path.stat().st_size, 'alphaExtrema': alpha.getextrema()})
    bounds = draw.textbbox((0, 0), label, font=label_font)
    text_width = bounds[2] - bounds[0]
    draw.text((x + (500 - text_width) // 2, y + 460), label,
              font=label_font, fill='#e5e8ec')
output = HERE / config.get('output', 'home-icons-board.png')
board.convert('RGB').save(output, optimize=True)
(HERE / config.get('receipt', 'board-receipt.json')).write_text(json.dumps({
    'status': 'candidate-board-not-integrated',
    'assembly': 'Pillow layout only; original assets not repainted, recolored or masked',
    'board': {'path': output.name, 'dimensions': board.size,
              'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'bytes': output.stat().st_size},
    'items': receipt,
    'preservedUnchanged': config.get('preserve', []),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'board': str(output), 'icons': len(items),
                  'size': board.size, 'bytes': output.stat().st_size}, ensure_ascii=False))
