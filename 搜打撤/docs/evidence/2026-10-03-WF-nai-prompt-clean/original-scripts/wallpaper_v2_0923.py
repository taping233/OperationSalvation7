# -*- coding: utf8 -*-
"""壁纸 v2（0923 布局返工）：角色居中 + 两侧暗边留 UI（明日方舟封面页构图）。单张，节奏铁律同批。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'wallpaper-v2-20260923-' + time.strftime('%H%M%S'))
os.makedirs(OUT, exist_ok=True)
token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line

SUBJECT = (
    '1girl, very long wavy silver-white hair, high ponytail, blue hair ribbon, '
    'black round sunglasses on head, parted bangs, eyebrows visible through hair, blue eyes, '
    'fang, confident smirk, black off-shoulder gothic dress, layered frilled skirt, '
    'blue star-pattern skirt lining, bare legs, black gloves, black ankle boots, '
    'sitting on the snowy floor among fallen bookshelves, one knee raised, one hand resting on her knee, '
    'looking at viewer, centered composition, the character sits at the horizontal center of the canvas, '
    'the girl is the brightest element of the whole image, soft bright light on her face and hair '
    'coming from the upper left, she reads as a clear luminous focal point'
)
SCENE = (
    'wide establishing shot, '
    'the left quarter and the right quarter of the canvas fall into deep quiet shadow '
    'with only faint silhouettes of broken bookshelves, '
    'a snowy ruined library in a winter forest, toppled broken bookshelves half buried in snow behind her, '
    'scattered open books and loose pages around the center, bare black trees, gently falling snow, '
    'cold blue-grey twilight, dense storytelling debris around the character, '
    'quiet dark empty margins on the far left and the far right'
)
UC = ('extra limbs, extra fingers, poorly drawn hands, cropped head, underexposed face, '
      'character in shadow, off-center character, blown highlights, jpeg artifacts, blurry, lowres')

prompt = nai_style.build_prompt(SUBJECT, SCENE)
uc = nai_style.build_uc(UC)
seed = random.randint(1, 2 ** 32 - 1)
payload = {
    'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
    'parameters': {
        'params_version': 3, 'width': 2048, 'height': 1152, 'scale': 6.5, 'steps': 28,
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
pj = os.path.join(OUT, 'wallpaper-v2.payload.json')
with open(pj, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)
zp = os.path.join(OUT, 'wallpaper-v2.zip')

for attempt in range(3):
    ok = False
    for tag, extra in (('direct', ['--noproxy', '*']), ('socks', ['-x', 'socks5h://127.0.0.1:7890'])):
        r = subprocess.run(['curl'] + extra + ['--ssl-no-revoke', '--max-time', '180', '-sS',
                            '-w', '%{http_code}', '-o', zp, '-X', 'POST',
                            '-H', 'Authorization: Bearer ' + token,
                            '-H', 'Content-Type: application/json',
                            '--data-binary', '@' + pj,
                            'https://image.novelai.net/ai/generate-image'],
                           capture_output=True, text=True, timeout=220)
        code = (r.stdout or '').strip()[-3:]
        if code in ('200', '201'):
            ok = True
            break
        if code == '403':
            sys.exit('403_STOP')
        if code == '429':
            print('429 wait 15min', flush=True)
            time.sleep(900)
            break
        time.sleep(45)
    if ok:
        break
else:
    sys.exit('FAIL code=' + str(code))

png = os.path.join(OUT, 'wallpaper-v2_%d.png' % seed)
with zipfile.ZipFile(zp) as z:
    data = z.read(z.namelist()[0])
open(png, 'wb').write(data)
print('OK wallpaper-v2', seed, flush=True)
