import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path.cwd()
source = root / 'game/art-source/card-frame-study-1014'
destination = root / 'game/assets/ui/card-frames/split-1014'
destination.mkdir(parents=True, exist_ok=True)
geometry = json.loads((source / 'geometry.json').read_text(encoding='utf-8'))
manifest_path = root / 'game/assets/asset-manifest.json'
original_manifest = manifest_path.read_bytes()
manifest = json.loads(original_manifest)
entries = []
frames = {}
for key, spec in geometry.items():
    image = Image.open(source / f'{key}.png').convert('RGBA')
    image = image.resize((512, 768), Image.Resampling.LANCZOS)
    output = destination / f'{key}.webp'
    image.save(output, format='WEBP', lossless=True, method=6, exact=True)
    if output.stat().st_size > 1_000_000:
        raise ValueError(f'{key}: runtime image exceeds binary limit')
    restored = Image.open(output).convert('RGBA')
    if image.getchannel('A').tobytes() != restored.getchannel('A').tobytes():
        raise ValueError(f'{key}: WebP alpha changed')
    # Some WebP encoders discard invisible RGB in fully transparent pixels.
    for background in ('black', 'white'):
        canvas = Image.new('RGBA', image.size, background)
        difference = ImageChops.difference(Image.alpha_composite(canvas, image), Image.alpha_composite(canvas, restored)).convert('RGB')
        if difference.getbbox():
            raise ValueError(f'{key}: visible WebP pixels changed')
    relative = output.relative_to(root / 'game/assets').as_posix()
    entries.append(dict(path=relative, ext='webp', license='老板授权项目卡框；Codex内置image_gen重绘', bytes=output.stat().st_size, sha256=hashlib.sha256(output.read_bytes()).hexdigest(), source='docs/evidence/2026-10-15-card-face-integration/README.md'))
    left, top, right, bottom = spec['opening']
    frames[key] = dict(path=relative, width=512, height=768, opening=[left / 2, top / 2, (right - left) / 2, (bottom - top) / 2])
owned = {entry['path'] for entry in entries}
manifest['assets'] = [entry for entry in manifest['assets'] if entry['path'] not in owned] + entries
manifest['count'] = len(manifest['assets'])
if manifest_path.read_bytes() != original_manifest:
    raise RuntimeError('Shared asset manifest changed during conversion')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'game/data/card-frame-layout.json').write_text(json.dumps(frames, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'docs/evidence/2026-10-15-card-face-integration/runtime-assets.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(frames=len(entries), bytes=sum(entry['bytes'] for entry in entries), largest=max(entry['bytes'] for entry in entries), pixelLossless=True)))
