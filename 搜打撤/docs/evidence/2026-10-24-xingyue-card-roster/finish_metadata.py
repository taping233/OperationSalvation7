import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
manifest_path = ROOT / 'game/assets/asset-manifest.json'
with manifest_path.open('r', encoding='utf-8-sig', newline='') as f:
    text = f.read()
nl = '\r\n' if '\r\n' in text else '\n'
patches = json.loads((EVIDENCE / 'receipt.json').read_text(encoding='utf-8'))['items'][0]['manifest_patches']
patches.append(json.loads((EVIDENCE / 'portrait-receipt.json').read_text(encoding='utf-8'))['manifest_patch'])
for patch in patches:
    marker = '"path": ' + json.dumps(patch['after']['path'], ensure_ascii=False)
    pos = text.index(marker)
    start = text.rfind('{', 0, pos)
    current, length = json.JSONDecoder().raw_decode(text[start:])
    updated = dict(current)
    for key in ('bytes', 'sha256', 'source'):
        updated[key] = patch['after'][key]
    encoded = json.dumps(updated, ensure_ascii=False, indent=2).splitlines()
    replacement = encoded[0] + nl + nl.join('    ' + line for line in encoded[1:])
    text = text[:start] + replacement + text[start + length:]
with manifest_path.open('w', encoding='utf-8', newline='') as f:
    f.write(text)
mapping_path = ROOT / 'game/data/art-mapping.json'
with mapping_path.open('r', encoding='utf-8-sig', newline='') as f:
    mapping = f.read()
mapping = mapping.replace('"tt8-hero-priest": "xingyue-wind-graphic-bg-20261010"', '"tt8-hero-priest": "xingyue-wind-card-style-20261024"')
with mapping_path.open('w', encoding='utf-8', newline='') as f:
    f.write(mapping)
print('Updated card revision and three scoped manifest entries.')
