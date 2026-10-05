# -*- coding: utf-8 -*-
"""Temporary painterly style comparison: same card scene, seed, and V5 settings."""
import io, json, os, subprocess, sys, time, zipfile
from pathlib import Path

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

ROOT = Path(r'D:\素材\代号柒\.tmp\nai')
OUT = ROOT / 'output' / ('painterly-card-style-20260923-' + time.strftime('%H%M%S'))
OUT.mkdir(parents=True, exist_ok=True)
ENDPOINT = 'https://image.novelai.net/ai/generate-image'

# Character appearance and action/scene are fixed across all four candidates.
SUBJECT = (
    '1girl, Wu, original fantasy heroine, young woman, pale skin, small youthful face, '
    'large sharp bright blue eyes, both eyes fully visible, parted bangs, silver-white hair, '
    'sleek smooth hair, tight neat high ponytail tied with a blue satin ribbon, '
    'two long sidelocks falling to her collarbone, matte black round sunglasses resting on top of her head, '
    'black rose hair ornament beside the ribbon, confident mischievous smile, small fang, '
    'black off-shoulder gothic dress with layered ruffles, blue star-patterned underskirt visible at the hem, '
    'bare legs, black gloves, thick-soled black ankle boots, '
    'the heroine lunges forward into one diagonal sword strike, gripping a long black sword with both hands, '
    'the sword blade cuts clearly across the foreground, face unobstructed and clearly visible, '
    'dynamic three-quarter view, full figure readable within the wide frame, '
    'strong clean silhouette, the heroine is the clear focal point'
)
SCENE = (
    'wide landscape fantasy game card illustration, 1.32:1 composition, '
    'the heroine occupies the central-left foreground, sword slash leading diagonally toward the right, '
    'one ruined library in a snowy winter forest, broken bookshelves and a few scattered pages behind her, '
    'snow swept across the floor by the force of the strike, sparse ice fragments following the blade path, '
    'cold blue-grey ambient light with a restrained warm edge light on the heroine, '
    'clear separation between foreground character and background, no other characters'
)
UC_EXTRA = (
    'text, letters, watermark, signature, frame, card border, UI, collage, multiple views, '
    'extra characters, extra arms, extra legs, extra fingers, fused fingers, poorly drawn hands, '
    'hair covering one eye, reflective sunglasses, lens flare, pantyhose, tights, stockings, '
    'cropped face, hidden face, blurry, lowres, photorealistic, 3d render'
)

STYLE_BASELINE = nai_style.STYLE_BLOCK
STYLE_A = (
    'masterpiece, best quality, painterly, finished fantasy game card illustration, '
    'visible controlled brushwork, refined silhouette, deliberate focal hierarchy, '
    'A fully resolved commercial illustration with confident form design and clear readability. '
    'Keep the heroine face, hands, and sword crisp and intentional; simplify secondary detail in the library. '
    'Use clean value grouping and controlled edges so the action reads at card size. '
    'Preserve visible paint texture in the broad forms without making the image feel like an unfinished sketch.'
)
STYLE_B = (
    'masterpiece, best quality, painterly, premium fantasy RPG card art, '
    'cohesive hand-painted surfaces, unified brush language, broad connected color masses. '
    'Build the heroine and library from the same family of confident brush strokes and consistent edge treatment. '
    'Keep lighting direction and cold-warm color relationships coherent across the whole image. '
    'Reserve the finest strokes for the face, sword, and a few costume details; let secondary forms stay simple and calm. '
    'The result is a complete, polished illustration with painterly texture throughout.'
)
STYLE_C = (
    'masterpiece, best quality, painterly, polished commercial game key art, '
    'strong graphic silhouette, sculpted forms, selective brush texture, material-aware highlights. '
    'Separate hair, fabric, leather, and steel through distinct but restrained surface treatment. '
    'Use a clear value structure and cinematic but controlled lighting to lead the eye from the heroine face to the sword. '
    'Keep the background atmospheric and subordinate, with finished focal details and a clean overall read at small size.'
)
CANDIDATES = [
    ('00-v10-baseline', STYLE_BASELINE),
    ('01-a-finished-hierarchy', STYLE_A),
    ('02-b-unified-brushwork', STYLE_B),
    ('03-c-commercial-key-art', STYLE_C),
]

TOKEN = ''
with (ROOT / 'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            TOKEN = line
            break
if not TOKEN:
    sys.exit('TOKEN_EMPTY')

uc = nai_style.build_uc(UC_EXTRA)
seed = 1278087392
manifest = {'seed': seed, 'width': 1024, 'height': 768, 'steps': 28, 'scale': 6.5,
            'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'variety_plus': True,
            'uc': uc, 'candidates': []}
last_started = None
for name, style in CANDIDATES:
    if last_started is not None:
        wait = max(0, 45 - (time.time() - last_started))
        if wait:
            print('RATE_LIMIT_WAIT_SECONDS', int(wait), flush=True)
            time.sleep(wait)
    prompt = '\n\n'.join(part for part in (nai_style.ARTIST_BLOCK, SUBJECT, SCENE, style) if part)
    payload = {
        'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
        'parameters': {
            'params_version': 3, 'width': 1024, 'height': 768, 'scale': 6.5, 'steps': 28,
            'n_samples': 1, 'ucPresetId': 'none', 'qualityPresetId': 'none', 'qualityToggle': False,
            'negative_prompt': uc, 'sampler': 'k_euler_ancestral', 'seed': seed,
            'decrisper': False, 'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True,
            'karras': True, 'cfg_rescale': 0.0, 'variety_plus': True, 'texture_transform': False,
            'autoSmea': True, 'straight_alpha': False, 'legacy_v4_extend': False, 'legacy_uc': False,
            'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []},
                          'use_coords': False, 'use_order': True},
            'v4_negative_prompt': {'caption': {'base_caption': uc, 'char_captions': []},
                                   'legacy_uc': False},
            'characterPrompts': [],
        },
    }
    payload_path = OUT / (name + '.payload.json')
    zip_path = OUT / (name + '.zip')
    with payload_path.open('w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    last_started = time.time()
    print('REQUEST_START', name, flush=True)
    for attempt in range(3):
        run = subprocess.run([
            'curl', '--noproxy', '*', '--ssl-no-revoke', '--max-time', '180', '-sS',
            '-w', '%{http_code}', '-o', str(zip_path), '-X', 'POST',
            '-H', 'Authorization: Bearer ' + TOKEN,
            '-H', 'Content-Type: application/json', '--data-binary', '@' + str(payload_path),
            ENDPOINT,
        ], capture_output=True, text=True, timeout=220)
        code = (run.stdout or '').strip()[-3:]
        if code in ('200', '201'):
            break
        if code == '403':
            print('STOP_HTTP_403', name, flush=True)
            sys.exit(403)
        if code == '429':
            if attempt == 2:
                print('STOP_HTTP_429_AFTER_THREE_ATTEMPTS', name, flush=True)
                sys.exit(429)
            print('HTTP_429_WAIT_15_MINUTES', name, flush=True)
            time.sleep(900)
            continue
        print('STOP_HTTP_ERROR', code or 'NO_CODE', name, flush=True)
        sys.exit(1)
    png_path = OUT / (name + '_' + str(seed) + '.png')
    with zipfile.ZipFile(zip_path) as zf:
        png_path.write_bytes(zf.read(zf.namelist()[0]))
    manifest['candidates'].append({'name': name, 'png': png_path.name, 'prompt': prompt})
    with (OUT / 'manifest.json').open('w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('IMAGE_READY', name, str(png_path), flush=True)
print('BATCH_COMPLETE', str(OUT), flush=True)
