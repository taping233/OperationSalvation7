"""Convert generated originals to lossless RGBA WebP and wire seven home icons."""
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / 'game/art-source/home-nodes-1015'
ASSETS = ROOT / 'game/assets/ui/home-nodes-1015'
IDS = {'city': 'mStart', 'guide': 'mGuide', 'achievement': 'mAch',
       'photo': 'btnCardLib', 'settings': 'mSettings', 'credits': 'mCredits', 'exit': 'btnTitleExit'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    request = json.loads((HERE / 'request.json').read_text(encoding='utf-8'))
    assert set(request['icons']) == set(IDS)
    # Validate every source before changing runtime files.
    for item in request['icons'].values():
        with Image.open(item['path']) as image:
            assert image.mode == 'RGBA', (item['path'], image.mode)
            assert image.getchannel('A').getextrema() == (0, 255)
    SOURCE.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    (SOURCE / '.gitignore').write_text('*.png\n', encoding='utf-8')
    receipt = []
    for name, item in request['icons'].items():
        original = SOURCE / f'{name}-v1.png'
        shutil.copy2(item['path'], original)
        runtime = ASSETS / f'{name}-v1.webp'
        with Image.open(original) as image:
            dimensions = image.size
            image.resize((384, 384), Image.Resampling.LANCZOS).save(runtime, lossless=True, exact=True)
        receipt.append({'id': name, 'original': str(original.relative_to(ROOT)),
                        'originalDimensions': dimensions, 'originalSha256': sha(original),
                        'generatedSource': item['path'], 'path': str(runtime.relative_to(ROOT)).replace('\\', '/'),
                        'bytes': runtime.stat().st_size, 'sha256': sha(runtime)})
    html_path = ROOT / 'game/index.html'
    html = html_path.read_text(encoding='utf-8')
    for name, button in IDS.items():
        pattern = rf'(<button\b[^>]*\bid="{button}"[^>]*>\s*)<svg\b[^>]*class="home-line-icon[^\"]*".*?</svg>'
        replacement = rf'\g<1><img class="home-node-icon" src="assets/ui/home-nodes-1015/{name}-v1.webp" width="384" height="384" alt="" aria-hidden="true" draggable="false">'
        html, count = re.subn(pattern, replacement, html, count=1, flags=re.S)
        assert count == 1, button
    html_path.write_text(html, encoding='utf-8')
    css_path = ROOT / 'game/css/home-polish.css'
    css = css_path.read_text(encoding='utf-8')
    assert '/* Homepage node artwork' not in css
    css += '''
/* Homepage node artwork keeps the generated dark support and transparent light edge. */
body #title.home-composed .home-plate > .home-node-icon {
  display: block; flex: 0 0 76px; width: 76px; height: 76px;
  margin: -10px -16px; object-fit: contain; pointer-events: none;
}
body #title.home-composed .home-system .home-plate > .home-node-icon {
  flex-basis: 60px; width: 60px; height: 60px; margin: -8px -12px;
}
'''
    css_path.write_text(css, encoding='utf-8')
    manifest_path = ROOT / 'game/assets/asset-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for item in receipt:
        asset_path = item['path'].removeprefix('game/assets/')
        assert not any(entry['path'] == asset_path for entry in manifest['assets'])
        manifest['assets'].append({'path': asset_path, 'ext': 'webp', 'bytes': item['bytes'],
            'sha256': item['sha256'], 'license': '项目原创，内置 image_gen 生成；方舟原板仅作视觉关系参考',
            'source': 'docs/evidence/2026-10-15-home-nodes/request.json'})
    manifest['count'] = len(manifest['assets'])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (HERE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (SOURCE / 'README.md').write_text('首页七个节点式图标 v1 原稿。PNG 仅本机保留，不进入 Git；运行图为 384px 透明无损 WebP。\n\n提示词、生成路径与 SHA256 见 `../../../docs/evidence/2026-10-15-home-nodes/`。风格是否认可待老板反馈。\n', encoding='utf-8')
    print(json.dumps({'converted': len(receipt), 'manifestCount': manifest['count']}, ensure_ascii=False))

if __name__ == '__main__':
    main()
