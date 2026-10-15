"""Install the seven approved board-v2 originals without altering their artwork."""
from pathlib import Path
import hashlib
import io
import json
import re
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ASSETS = ROOT / 'game/assets/ui/home-nodes-1015'
IDS = {'city': 'mStart', 'guide': 'mGuide', 'achievement': 'mAch',
       'photo': 'btnCardLib', 'settings': 'mSettings', 'credits': 'mCredits', 'exit': 'btnTitleExit'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    board = json.loads((HERE / 'board-v2-receipt.json').read_text(encoding='utf-8'))
    assert {item['id'] for item in board['items']} == set(IDS)
    html_path = ROOT / 'game/index.html'
    css_path = ROOT / 'game/css/home-polish.css'
    manifest_path = ROOT / 'game/assets/asset-manifest.json'
    before = {path: path.read_bytes() for path in [html_path, css_path, manifest_path]}
    html = before[html_path].decode('utf-8')
    css = before[css_path].decode('utf-8')
    manifest_text = before[manifest_path].decode('utf-8')
    manifest = json.loads(manifest_text)
    css_already_applied = '/* Homepage node artwork' in css
    outputs, receipt, entries = {}, [], []
    for item in board['items']:
        name = item['id']
        original = Path(item['source']).resolve()
        raw = original.read_bytes()
        assert sha(raw) == item['sha256'], name
        with Image.open(io.BytesIO(raw)) as source:
            assert source.mode == 'RGBA' and source.getchannel('A').getextrema()[0] == 0
            # Keep the non-square photo's aspect ratio and every transparent margin.
            fitted = source.copy()
            fitted.thumbnail((384, 384), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (384, 384))
            canvas.paste(fitted, ((384 - fitted.width) // 2, (384 - fitted.height) // 2))
            buffer = io.BytesIO()
            canvas.save(buffer, format='WEBP', lossless=True, exact=True)
            encoded = buffer.getvalue()
            with Image.open(io.BytesIO(encoded)) as check:
                assert check.mode == 'RGBA' and check.size == (384, 384)
                assert check.tobytes() == canvas.tobytes(), name
        relative = f'ui/home-nodes-1015/{name}-v1.webp'
        runtime = ROOT / 'game/assets' / relative
        if runtime.exists():
            assert runtime.read_bytes() == encoded, runtime
        assert not any(entry['path'] == relative for entry in manifest['assets'])
        outputs[runtime] = encoded
        pattern = rf'(<button\b[^>]*\bid="{IDS[name]}"[^>]*>\s*)<svg\b[^>]*class="home-line-icon[^\"]*".*?</svg>'
        replacement = rf'\g<1><img class="home-node-icon" src="assets/{relative}" width="384" height="384" alt="" aria-hidden="true" draggable="false">'
        html, count = re.subn(pattern, replacement, html, count=1, flags=re.S)
        assert count == 1 or (count == 0 and f'src="assets/{relative}"' in html), IDS[name]
        entries.append({'path': relative, 'ext': 'webp', 'bytes': len(encoded),
                        'sha256': sha(encoded), 'license': '项目原创，内置 image_gen 生成；原板仅作视觉关系参考',
                        'source': 'docs/evidence/2026-10-15-home-nodes-set/install-receipt.json'})
        receipt.append({'id': name, 'button': IDS[name], 'original': str(original),
                        'originalSha256': sha(raw), 'path': 'game/assets/' + relative,
                        'sha256': sha(encoded), 'bytes': len(encoded), 'dimensions': [384, 384],
                        'conversion': 'aspect-fit with transparent padding; lossless RGBA WebP'})
    css += '''
/* Homepage node artwork: transparent padding expands inside the existing icon slots. */
body #title.home-composed .home-plate > .home-node-icon {
  display: block; flex: 0 0 80px; width: 80px; height: 80px;
  margin: -18px -24px; object-fit: contain; pointer-events: none;
}
body #title.home-composed .home-start > .home-node-icon {
  flex-basis: 96px; width: 96px; height: 96px; margin: -24px -26px;
}
body #title.home-composed .home-collection .home-plate > .home-node-icon {
  flex-basis: 88px; width: 88px; height: 88px; margin: -18px -26px;
}
body #title.home-composed .home-system .home-plate > .home-node-icon {
  flex-basis: 64px; width: 64px; height: 64px; margin: -12px -19px;
}
'''
    # Insert only new manifest entries; preserve all pre-existing text and metadata.
    boundary = manifest_text.rfind('\n  ],')
    assert boundary >= 0
    block = ',\n' + ',\n'.join('    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ') for entry in entries)
    manifest_text = manifest_text[:boundary] + block + manifest_text[boundary:]
    manifest_text, count = re.subn(r'("count"\s*:\s*)\d+', lambda match: match[1] + str(len(manifest['assets']) + len(entries)), manifest_text, count=1)
    assert count == 1
    updated = json.loads(manifest_text)
    assert updated['assets'][:-7] == manifest['assets']
    for path, raw in before.items():
        assert path.read_bytes() == raw, f'Concurrent edit: {path}'
    ASSETS.mkdir(parents=True, exist_ok=True)
    for path, data in outputs.items():
        path.write_bytes(data)
    assert html_path.read_bytes() == html.encode('utf-8'), 'HTML replacement must already be applied'
    # The CSS patch is applied separately after this script's conversion checks.
    if not css_already_applied:
        (HERE / 'install-css.txt').write_bytes(css[len(before[css_path].decode('utf-8')):].encode('utf-8'))
    (HERE / 'install-manifest-entries.json').write_text(json.dumps({
        'previousCount': len(manifest['assets']), 'count': updated['count'], 'entries': entries,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (HERE / 'install-receipt.json').write_text(json.dumps({
        'selection': 'board-v2-receipt.json', 'items': receipt,
        'previousFileHashes': {str(path.relative_to(ROOT)): sha(raw) for path, raw in before.items()},
        'manifestPreviousEntriesPreserved': True,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'installed': len(receipt), 'runtimeBytes': sum(len(data) for data in outputs.values())}, ensure_ascii=False))

if __name__ == '__main__':
    main()
