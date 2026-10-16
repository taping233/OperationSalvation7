import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

EVIDENCE = Path(__file__).resolve().parent
ASSETS = EVIDENCE.parents[3] / 'game' / 'assets' / 'ui' / 'battle-skills-1016'

def metadata(path):
    with Image.open(path) as image:
        return {
            'path': str(path.resolve()), 'size': list(image.size), 'mode': image.mode,
            'alpha_extrema': list(image.getchannel('A').getextrema()) if image.mode == 'RGBA' else None,
            'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }

ASSETS.mkdir(parents=True, exist_ok=True)
receipt_path = EVIDENCE / 'receipt.json'
receipt = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {
    'date': '2026-10-16', 'generation': 'built-in image_gen',
    'processing': 'RGBA conversion if needed, full-canvas Lanczos resize to 512x512, lossless WebP encoding; no cropping, masking, recolouring or compositing',
    'icons': {},
}
for input_path in sys.argv[1:]:
    spec = json.loads(Path(input_path).read_text(encoding='utf-8'))
    source = Path(spec['source'])
    output = ASSETS / f"{spec['kind']}.webp"
    with Image.open(source) as image:
        image.convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS).save(output, 'WEBP', lossless=True, exact=True, method=6)
    preview = EVIDENCE / f"preview-{spec['kind']}.webp"
    with Image.open(output) as image:
        image.resize((96, 96), Image.Resampling.LANCZOS).save(preview, 'WEBP', lossless=True, exact=True, method=6)
    receipt['icons'][spec['kind']] = {
        'request': spec,
        'source': metadata(source),
        'output': metadata(output),
        'small_preview': metadata(preview),
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'kind': spec['kind'], 'output': receipt['icons'][spec['kind']]['output']}, ensure_ascii=False))
