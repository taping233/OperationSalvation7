#!/usr/bin/env python3
"""Lossless format-only candidates; never touches production or input PNGs."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import json
import struct
from PIL import Image, features

ROOT = Path(__file__).resolve().parents[3]
PREVIEW = ROOT / 'docs/previews/roster-cutouts-20261016'
EVIDENCE = Path(__file__).resolve().parent
OUTPUT = Path('/workspace/shared/roster-cutouts-lossless-20261016')
OUTPUT.mkdir(parents=True, exist_ok=True)
MANIFEST = PREVIEW / 'manifest.json'
SELECTION = {'heixiang': 'v1', 'xingyue': 'v2'}
LIMIT = 1024 * 1024

def digest(path):
    return sha256(path.read_bytes()).hexdigest()

def rgba_digest(im):
    return sha256(im.tobytes()).hexdigest()

def bounds(im, minimum):
    return im.getchannel('A').point(lambda v: 255 if v >= minimum else 0).getbbox()

def chunks(path):
    raw = path.read_bytes()
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WEBP'
    result, offset = [], 12
    while offset + 8 <= len(raw):
        name = raw[offset:offset+4].decode('ascii')
        size = struct.unpack('<I', raw[offset+4:offset+8])[0]
        result.append({'name': name, 'bytes': size})
        offset += 8 + size + (size % 2)
    assert offset == len(raw)
    return result

manifest = json.loads(MANIFEST.read_text())
result = {
    'task': 'roster-cutout-lossless-format-only-20261016',
    'status': 'candidate-only-blocked-by-size-gate',
    'created_at_utc': datetime.now(timezone.utc).isoformat(),
    'source_manifest': str(MANIFEST.relative_to(ROOT)),
    'source_manifest_sha256': digest(MANIFEST),
    'encoder': {'pillow': Image.__version__, 'libwebp': features.version('webp'),
                'parameters': {'format': 'WEBP', 'lossless': True, 'quality': 100, 'method': 6, 'exact': True},
                'note': 'quality controls lossless compression effort here; exact preserves RGB even beneath alpha=0'},
    'limits': {'exclusive_candidate_bytes': LIMIT},
    'assets': [],
}
for asset in manifest['assets']:
    cid = asset['id']
    if cid not in SELECTION:
        continue
    variant = next(v for v in asset['variants'] if v['id'] == SELECTION[cid])
    source = ROOT / asset['source']
    png = PREVIEW / variant['file']
    out = OUTPUT / png.with_suffix('.webp').name
    png_sha = digest(png)
    source_sha = digest(source)
    assert png_sha == variant['sha256'], (cid, 'PNG provenance hash mismatch')
    assert source_sha == asset['source_sha256'], (cid, 'original portrait provenance hash mismatch')
    with Image.open(png) as opened:
        source_mode = opened.mode
        image = opened.convert('RGBA')
    assert image.size == (1024, 1536), (cid, 'unexpected canvas')
    assert source_mode == 'RGBA', (cid, 'unexpected source mode')
    image.save(out, format='WEBP', lossless=True, quality=100, method=6, exact=True)
    with Image.open(out) as opened:
        decoded_mode = opened.mode
        decoded = opened.convert('RGBA')
    source_raw, decoded_raw = image.tobytes(), decoded.tobytes()
    equal = source_raw == decoded_raw
    alpha_equal = image.getchannel('A').tobytes() == decoded.getchannel('A').tobytes()
    generated = Path(variant['generated_source'])
    generated_exists = generated.is_file()
    size = out.stat().st_size
    b128 = bounds(image, 128)
    original_bytes = source.stat().st_size
    entry = {
        'id': cid, 'variant': variant['id'],
        'production_original': {'file': asset['source'], 'sha256': source_sha, 'manifest_hash_matches': True,
                                'bytes': original_bytes},
        'generated_provenance': {'path': variant['generated_source'], 'exists': generated_exists,
                                'sha256': digest(generated) if generated_exists else None,
                                'matches_preview_png': digest(generated) == png_sha if generated_exists else None,
                                'method': manifest['method'],
                                'prompt': variant['prompt']},
        'input': {'file': str(png.relative_to(ROOT)), 'sha256': png_sha, 'bytes': png.stat().st_size,
                  'mode': source_mode, 'dimensions': image.size, 'rgba_sha256': rgba_digest(image)},
        'candidate': {'file': str(out), 'sha256': digest(out), 'bytes': size,
                      'mode': decoded_mode, 'dimensions': decoded.size, 'rgba_sha256': rgba_digest(decoded),
                      'webp_chunks': chunks(out)},
        'verification': {'dimensions_equal': image.size == decoded.size, 'mode_equal': source_mode == decoded_mode,
                         'decoded_rgba_bytes_equal': equal, 'decoded_alpha_bytes_equal': alpha_equal,
                         'rgba_differing_values': sum(a != b for a,b in zip(source_raw, decoded_raw)),
                         'alpha_extrema': image.getchannel('A').getextrema(),
                         'alpha_nonzero_bbox': bounds(image, 1), 'alpha_gte_128_bbox': b128,
                         'input_png_unchanged': digest(png) == png_sha,
                         'production_original_unchanged': digest(source) == source_sha,
                         'candidate_under_1_mib': size < LIMIT},
        'suggested_personnel_bounds': [*image.size, *b128],
        'bytes_impact': {'candidate_addition': size, 'delta_from_png': size-png.stat().st_size,
                         'detail_request_delta_from_old_portrait': size-original_bytes,
                         'production_original_remains': True},
    }
    assert equal and alpha_equal and image.size == decoded.size and source_mode == decoded_mode, (cid, 'decode identity failed')
    result['assets'].append(entry)
    print(json.dumps({'id':cid, 'variant':variant['id'], 'bytes':size, 'under_1_mib':size < LIMIT,
                      'rgba_exact':equal,'alpha_exact':alpha_equal,'bounds':entry['suggested_personnel_bounds']},ensure_ascii=False),flush=True)
result['all_decode_identity_checks_pass'] = all(a['verification']['decoded_rgba_bytes_equal'] and a['verification']['decoded_alpha_bytes_equal'] and a['verification']['dimensions_equal'] for a in result['assets'])
result['all_under_1_mib'] = all(a['verification']['candidate_under_1_mib'] for a in result['assets'])
result['total_candidate_bytes'] = sum(a['candidate']['bytes'] for a in result['assets'])
(EVIDENCE / 'transcode-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['all_decode_identity_checks_pass','all_under_1_mib','total_candidate_bytes']},ensure_ascii=False),flush=True)
