import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path.cwd()
evidence = root / 'docs/evidence/2026-10-16-WF-battle-platform-minimal'
request = json.loads((evidence / 'request.json').read_text(encoding='utf-8'))
asset_dir = root / 'game/assets/scenes/battle/platform-minimal-1016'
asset_dir.mkdir(parents=True, exist_ok=True)
manifest_path = root / 'game/assets/asset-manifest.json'
manifest_before = manifest_path.read_bytes()
manifest = json.loads(manifest_before.decode('utf-8-sig'))
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
receipt = {'channel':request['channel'], 'reference':request['reference'], 'referenceSha256':digest(Path(request['reference'])), 'items':[]}
for item in request['items']:
    source = Path(item['source'])
    output = asset_dir / (item['name'] + '.webp')
    if output.exists():
        raise RuntimeError(f'产物已存在，停止覆盖：{output}')
    with Image.open(source) as im:
        if im.size != (1672, 941):
            raise RuntimeError(f'分层画幅不一致：{source} {im.size}')
        if item['transparent_background'] and ('A' not in im.getbands() or im.getchannel('A').getextrema() != (0, 255)):
            raise RuntimeError(f'透明层缺少预期alpha：{source}')
        mode = 'RGBA' if item['transparent_background'] else 'RGB'
        # 仅编码为游戏消费的WebP，保持尺寸、像素位置与生成的alpha。
        im.convert(mode).save(output, 'WEBP', quality=93, method=6, exact=True)
        alpha = im.getchannel('A').getextrema() if 'A' in im.getbands() else None
    relative = output.relative_to(root / 'game/assets').as_posix()
    entry = {'path':relative, 'ext':'webp', 'license':'AI生成（本项目原创，内置imagegen，老板认可简约轨道站概念的分层）', 'bytes':output.stat().st_size, 'sha256':digest(output), 'source':'docs/evidence/2026-10-16-WF-battle-platform-minimal/request.json'}
    if any(existing['path'] == relative for existing in manifest['assets']):
        raise RuntimeError(f'清单已存在同路径：{relative}')
    manifest['assets'].append(entry)
    receipt['items'].append({**entry, 'original':str(source), 'originalSha256':digest(source), 'size':[1672,941], 'mode':mode, 'alphaExtrema':alpha})
if manifest_path.read_bytes() != manifest_before:
    raise RuntimeError('共享素材清单已变化，产物已保留，停止写清单')
manifest['count'] = len(manifest['assets'])
newline = '\r\n' if b'\r\n' in manifest_before else '\n'
manifest_path.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').replace('\n', newline).encode('utf-8'))
receipt['manifestCount'] = manifest['count']
(evidence / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'assets':[{key:item[key] for key in ['path','bytes','size','mode']} for item in receipt['items']], 'manifestCount':manifest['count']}, ensure_ascii=False))
