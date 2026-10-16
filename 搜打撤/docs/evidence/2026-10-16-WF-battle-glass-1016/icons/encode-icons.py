import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

EVIDENCE = Path(__file__).resolve().parent
ASSETS = EVIDENCE.parents[3] / 'game' / 'assets' / 'ui' / 'battle-controls-glass-1016'

def metadata(path):
    with Image.open(path) as image:
        alpha = image.getchannel('A') if image.mode == 'RGBA' else None
        return {'path': str(path.resolve()), 'size': list(image.size), 'mode': image.mode,
                'alpha_extrema': list(alpha.getextrema()) if alpha else None,
                'alpha_bounds': list(alpha.getbbox()) if alpha and alpha.getbbox() else None,
                'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

ASSETS.mkdir(parents=True, exist_ok=True)
receipt_path = EVIDENCE / 'receipt.json'
receipt = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {
    'date': '2026-10-16', 'generation': 'built-in image_gen; no reference image',
    'processing': 'Full original canvas resized proportionally to 512x512 and encoded as lossless RGBA WebP. No crop, recolouring, alpha mask, backplate or composite.',
    'acceptance': 'Asset self-review only; actual game verification belongs to the root task.', 'icons': {}}
receipt['generation'] = 'built-in image_gen; seven new symbols; spell revision references only its new initial attempt'
for input_path in sys.argv[1:]:
    request = json.loads(Path(input_path).read_text(encoding='utf-8'))
    source = Path(request['source'])
    output = ASSETS / f"{request['kind']}.webp"
    preview = EVIDENCE / f"preview-{request['kind']}.webp"
    with Image.open(source) as image:
        rgba = image.convert('RGBA')
        if rgba.width != rgba.height:
            raise ValueError('Square original canvas required; cropping is not allowed')
        rgba.resize((512, 512), Image.Resampling.LANCZOS).save(output, 'WEBP', lossless=True, exact=True, method=6)
    with Image.open(output) as image:
        image.resize((72, 72), Image.Resampling.LANCZOS).save(preview, 'WEBP', lossless=True, exact=True, method=6)
    receipt['icons'][request['kind']] = {'request': request, 'source': metadata(source),
        'output': metadata(output), 'small_preview': metadata(preview)}
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'kind': request['kind'], 'size': [512, 512], 'bytes': output.stat().st_size,
                      'sha256': receipt['icons'][request['kind']]['output']['sha256']}))
