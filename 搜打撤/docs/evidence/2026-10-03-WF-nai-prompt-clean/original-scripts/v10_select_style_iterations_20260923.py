# -*- coding: utf-8 -*-
"""Three controlled v1.0 iterations against the current character-select portraits."""
import json, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT = Path(r'D:\素材\代号柒\.tmp\nai')
OUT = ROOT / 'output' / ('v10-select-style-iterations-20260923-' + time.strftime('%H%M%S'))
OUT.mkdir(parents=True, exist_ok=True)
ENDPOINT = 'https://image.novelai.net/ai/generate-image'
TOKEN = ''
with (ROOT / 'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            TOKEN = line
            break
if not TOKEN:
    sys.exit('TOKEN_EMPTY')

SUBJECT = (
    '1girl, Wu, original fantasy heroine, young woman, pale skin, small youthful face, '
    'large bright blue eyes, both eyes clearly visible, parted bangs, silver-white hair, '
    'sleek smooth high ponytail tied with a blue satin ribbon, two long sidelocks falling to the collarbone, '
    'matte black round sunglasses resting on top of her head, black rose hair ornament beside the ribbon, '
    'confident mischievous smile, small fang, '
    'black off-shoulder gothic dress, layered ruffle neckline, fitted black waist belt, '
    'dark blue underskirt with light blue four-point stars visible at the hem, bare legs, '
    'black gloves, thick-soled black ankle boots, '
    'standing full body, right hand on hip, left arm relaxed at her side, '
    'a long black sword and sheath worn diagonally across her back, hilt visible above her left shoulder, '
    'frontal three-quarter view, looking toward the viewer, clear visible face, entire figure in frame'
)
SCENE = (
    'wide horizontal 16:9 character selection illustration, single large centered character, '
    'plain bright white background, very subtle cool blue and warm ivory gradient close behind the figure, '
    'soft even light, clear silhouette, open white space around the character, '
    'open ground below her feet, no scenery, no floor shadow, no effects'
)
UC_EXTRA = (
    'text, watermark, signature, frame, UI, collage, multiple views, background scenery, ground shadow, '
    'photorealistic, 3d render, hair covering one eye, reflective sunglasses, lens flare, '
    'pantyhose, tights, thighhighs, stockings, extra limbs, extra fingers, missing fingers, fused fingers, '
    'blurry, lowres'
)
BASE_UC_REFINED = nai_style.BASE_UC
for phrase in ('flat cel shading, ', 'smooth airbrush, ', 'no brush texture, ',
               'clean closed lineart, ', 'fully rendered polished painting, '):
    BASE_UC_REFINED = BASE_UC_REFINED.replace(phrase, '')
UC_R0 = nai_style.build_uc(UC_EXTRA)
UC_R1 = BASE_UC_REFINED + ', ' + UC_EXTRA

STYLE_R2 = (
    'masterpiece, best quality, painterly, visible brush strokes, loose hand-painted texture, '
    'blocky volume modeling.\n\n'
    'A complete, polished character illustration with a clear, confident silhouette and finished forms. '
    'Soft directional light reveals the planes of the face, hair, clothing, and sword. '
    'Build volumes from broad planes of light and shadow while keeping the character contours clearly defined. '
    'Use restrained, fine brush marks within the hair and fabric; keep the face, hands, and key costume shapes clean and readable. '
    'Use a light, controlled palette and preserve deliberate paint texture without rough sketch edges.'
)
CANDIDATES = [
    ('00-v10-exact', nai_style.STYLE_BLOCK, UC_R0,
     'Exact official v1.0 style and UC; portrait composition only was aligned to the character-select reference.'),
    ('01-v10-uc-unblocked', nai_style.STYLE_BLOCK, UC_R1,
     'Official v1.0 positive style unchanged; removed only UC exclusions that directly block flat shading, smooth rendering, clean contours, and polished finish.'),
    ('02-v10-refined-contours', STYLE_R2, UC_R1,
     'Built on v1.0; reduced sketch/open-edge cues and specified clear contours and restrained brush marks, with the same refined UC as candidate 01.'),
]
SEED = 1278087392
manifest = {'seed': SEED, 'width': 1344, 'height': 768, 'steps': 28, 'scale': 6.5,
            'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras', 'variety_plus': True,
            'subject': SUBJECT, 'scene': SCENE, 'candidates': []}
last_started = None
for name, style, uc, note in CANDIDATES:
    if last_started is not None:
        delay = max(0, 45 - (time.time() - last_started))
        if delay:
            time.sleep(delay)
    prompt = '\n\n'.join(part for part in (nai_style.ARTIST_BLOCK, SUBJECT, SCENE, style) if part)
    payload = {
        'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
        'parameters': {
            'params_version': 3, 'width': 1344, 'height': 768, 'scale': 6.5, 'steps': 28,
            'n_samples': 1, 'ucPresetId': 'none', 'qualityPresetId': 'none', 'qualityToggle': False,
            'negative_prompt': uc, 'sampler': 'k_euler_ancestral', 'seed': SEED,
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
    pj = OUT / (name + '.payload.json')
    zp = OUT / (name + '.zip')
    with pj.open('w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    last_started = time.time()
    print('REQUEST_START', name, flush=True)
    run = subprocess.run([
        'curl', '--noproxy', '*', '--ssl-no-revoke', '--max-time', '180', '-sS',
        '-w', '%{http_code}', '-o', str(zp), '-X', 'POST',
        '-H', 'Authorization: Bearer ' + TOKEN, '-H', 'Content-Type: application/json',
        '--data-binary', '@' + str(pj), ENDPOINT,
    ], capture_output=True, text=True, timeout=220)
    code = (run.stdout or '').strip()[-3:]
    if code == '403':
        print('STOP_HTTP_403', name, flush=True)
        sys.exit(403)
    if code == '429':
        print('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY', name, flush=True)
        sys.exit(429)
    if code not in ('200', '201'):
        print('STOP_HTTP_ERROR', code or 'NO_CODE', name, flush=True)
        sys.exit(1)
    png = OUT / (name + '_' + str(SEED) + '.png')
    with zipfile.ZipFile(zp) as zf:
        png.write_bytes(zf.read(zf.namelist()[0]))
    manifest['candidates'].append({'name': name, 'png': png.name, 'uc': uc, 'prompt': prompt, 'note': note})
    with (OUT / 'manifest.json').open('w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print('IMAGE_READY', name, str(png), flush=True)
print('BATCH_COMPLETE', str(OUT), flush=True)
