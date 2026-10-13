"""Encode the reviewed NAI→internal redraws as game scene assets."""
import hashlib
import json
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
GENERATED = Path(r'C:\Users\太平\.codex\generated_images\01a1341b-e17c-7de3-ad87-7422eb6ef359')
SCENES = (
    ('last-lamp', GENERATED / 'exec-9bde1abb-4a5d-4a39-a8a8-8244e616c381.png',
     PROJECT / 'game/assets/scenes/event-last-lamp-1013-v1.webp'),
    ('goldmine', GENERATED / 'exec-af24e82d-c2fd-46a3-9131-c3cb98ca2e7c.png',
     PROJECT / 'game/assets/scenes/event-tt6-goldmine-1013-v2.webp'),
)
records = []
for scene, source, target in SCENES:
    if target.exists():
        raise SystemExit(f'Asset already exists: {target}')
    with Image.open(source) as image:
        image.convert('RGB').save(target, 'WEBP', quality=86, method=6)
        size = image.size
    records.append({
        'scene': scene, 'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'target': str(target), 'targetSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'width': size[0], 'height': size[1], 'bytes': target.stat().st_size,
        'pipeline': 'NAI draft -> built-in internal redraw -> WebP encode',
    })
(EVIDENCE / 'event-redraw-assets.json').write_text(
    json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records, ensure_ascii=False), flush=True)
