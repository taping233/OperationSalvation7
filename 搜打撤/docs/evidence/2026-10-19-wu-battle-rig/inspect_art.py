"""Read-only image checks and provenance receipt; never alters pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
request = json.loads((HERE / 'request.json').read_text(encoding='utf-8'))
art_root = ROOT / request['sourceDir']
records = []
for generation in request['generations']:
    target = art_root / generation['file']
    raw = target.read_bytes()
    assert raw == Path(generation['source']).read_bytes(), target
    with Image.open(target) as im:
        assert im.mode == 'RGBA', (target, im.mode)
        assert im.size == (1536, 1024), (target, im.size)
        alpha = im.getchannel('A')
        histogram = alpha.histogram()
        assert histogram[0] > im.width * im.height * .25, target
        assert max(alpha.getextrema()) >= 250, target
        records.append({
            'path': target.relative_to(ROOT).as_posix(),
            'source': generation['source'],
            'acquisition': 'built-in image_gen; copied byte-for-byte; prompt in request.json',
            'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest(),
            'dimensions': list(im.size), 'mode': im.mode,
            'transparentPixelFraction': round(histogram[0] / (im.width * im.height), 5),
            'alphaExtrema': list(alpha.getextrema()),
            'alphaBounds': alpha.getbbox(),
        })
receipt = {
    'task': request['task'], 'stage': request['stage'],
    'status': 'candidate-pose-and-parts-awaiting-owner-review',
    'images': records,
    'checks': ['PNG readable; 1536x1024 RGBA', 'source copies SHA-equivalent',
               'transparent pixels present; subject alpha reaches at least 250'],
    'limits': ['No pixel-perfect production split or rig.',
               'AI parts board has overlapping head/hair content and incomplete waist area.',
               'No Spine installed/license confirmed in checked locations; portable location not excluded.',
               'No motion, runtime integration, build, or gameplay verification.'],
}
(HERE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'ok': True, 'images': records}, ensure_ascii=False))
