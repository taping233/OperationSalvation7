from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

project = Path(__file__).resolve().parents[3]
generated = Path('C:/Users/太平/.codex/generated_images/01a12182-883a-7c62-9101-2d18bb64c305')
assets = project / 'game/assets/card-backs'
assets.mkdir(parents=True, exist_ok=True)
sources = {
    'classic': ('exec-1e33600e-5e18-469d-b3bf-7216f20fb263.png', '行囊粗布', '黄褐粗布拼接、米黄缝线、束口绳结'),
    'wolf': ('exec-f710400b-c5af-479d-92a6-b3113d75698d.png', '猎手皮纸', '暖皮纸、狼首猎手纹章、交叉箭'),
    'coin': ('exec-05a181b3-c130-4150-be47-2c39ea20ddab.png', '富商锦缎', '朱红锦缎、金色钱币和织纹'),
    'vault': ('exec-d28d94dd-ca35-4cc9-93b9-e955920edc52.png', '仓廪木纹', '蜜褐木板、仓储铁扣、麦穗'),
    'boss': ('exec-aa0afbf5-3031-49e7-837c-1a9a069d4435.png', '弑神黑曜', '黑曜石、暗红裂隙、剑与破碎魔面'),
    'altar': ('exec-c39dc1c9-5190-4ba0-9d93-3d979cad4191.png', '核心星轨', '靛紫星空、金色轨道和琥珀核心'),
    'pet': ('exec-77c520e9-222a-4647-908b-4e50b694daf5.png', '忠犬爪印', '苔绿布面、米黄爪印、棕色项圈环'),
}
receipt = []
sheet = Image.new('RGB', (7 * 180, 290), '#202020')
draw = ImageDraw.Draw(sheet)
for index, (key, (source, name, brief)) in enumerate(sources.items()):
    original = generated / source
    image = Image.open(original).convert('RGB')
    assert image.size == (1024, 1536), (key, image.size)
    image = image.resize((512, 768), Image.Resampling.LANCZOS)
    target = assets / f'{key}.webp'
    assert not target.exists(), f'Refuse overwrite: {target}'
    image.save(target, 'WEBP', quality=88, method=6)
    assert target.stat().st_size < 1024 * 1024
    image.thumbnail((168, 252), Image.Resampling.LANCZOS)
    sheet.paste(image, (index * 180 + 6, 6))
    draw.text((index * 180 + 8, 267), key, fill='#eeeeee')
    receipt.append({
        'id': key, 'name': name, 'path': f'card-backs/{key}.webp',
        'ext': 'webp', 'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'license': '项目自有（内置imagegen生成，老板确认画风并授权全套制作）',
        'source': 'docs/evidence/2026-10-10-cardbacks-seven/receipt.json',
        'generationSource': str(original),
        'generationSha256': hashlib.sha256(original.read_bytes()).hexdigest(),
        'promptBrief': brief,
    })
evidence = Path(__file__).resolve().parent
sheet.save(evidence / 'seven-cardbacks.png')
(evidence / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'id': row['id'], 'bytes': row['bytes']} for row in receipt]))
