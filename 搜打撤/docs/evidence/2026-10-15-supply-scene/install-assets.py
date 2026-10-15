"""Encode an approved scene, retain prior runtime bytes, update only its manifest entries."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
kind, source_arg = sys.argv[1:3]
revision = sys.argv[3] if len(sys.argv) > 3 else ''
assert not revision or all(c.isalnum() or c == '-' for c in revision)
assert kind in ('chest', 'fire')
source = ROOT / source_arg
assets = ROOT / 'game/assets'
folder = Path(__file__).resolve().parent / ('install-' + kind + ('-' + revision if revision else ''))
folder.mkdir(exist_ok=True)
manifest = assets / 'asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
data = json.loads(text)
records = []
im = Image.open(source).convert('RGB')
for relative in ('scenes/scene-' + kind + '-anime-v2.webp', 'thumbs/scenes/scene-' + kind + '-anime-v2.webp'):
    target = assets / relative
    backup = folder / ('previous-thumb.webp' if relative.startswith('thumbs/') else 'previous-scene.webp')
    assert not backup.exists(), 'Already installed; inspect before re-running.'
    previous = target.read_bytes()
    backup.write_bytes(previous)
    prior_size = Image.open(target).size
    output = im.copy()
    if relative.startswith('thumbs/'):
        output.thumbnail(prior_size, Image.Resampling.LANCZOS)
    output.save(target, 'WEBP', quality=88, method=6)
    blob = target.read_bytes()
    entry = next(e for e in data['assets'] if e['path'] == relative)
    position = text.index('"path": "' + relative + '"')
    start = text.rfind('    {', 0, position)
    end = text.index('\n    }', position) + len('\n    }')
    entry.update(bytes=len(blob), sha256=hashlib.sha256(blob).hexdigest(),
                 source='docs/evidence/2026-10-15-supply-scene/' + folder.name + '/receipt.json')
    text = text[:start] + '    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ') + text[end:]
    records.append(dict(path=relative, size=list(output.size), bytes=len(blob),
        sha256=entry['sha256'], previous_sha256=hashlib.sha256(previous).hexdigest(),
        backup=str(backup.relative_to(ROOT))))
manifest.write_text(text, encoding='utf-8')
receipt = dict(source=source_arg, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               outputs=records, tests='Skipped at user request', browser='Skipped at user request')
(folder / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
