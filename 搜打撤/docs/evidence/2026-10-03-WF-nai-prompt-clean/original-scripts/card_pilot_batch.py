# -*- coding: utf8 -*-
"""卡面重出试张（0923 老板拍板路线 B）：浅亮底+大主体+鲜艳点缀构图模板 + painterly 画风（nai_style）。
范围豁免（老板令）：白塔职业卡 / 西部牛仔双人图 / 能力卡12 / 禁咒4 不重出。
试张 6 张：生物×2、道具×2 = 透明通道（白底抠 alpha）；武术/法术×2 = 浅底插画。
比例口径：1024x768 = 1.32 横版固定卡面比例（0923 老板令）。节奏铁律：45s 间隔 / 429 停15min / 403 停手。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'card-pilot-' + time.strftime('%Y%m%d-%H%M%S'))
os.makedirs(OUT, exist_ok=True)
token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line

WHITE = 'isolated single subject on plain pure white background, nothing else'
BRIGHT = 'clean bright pale cream gradient background, no scenery, no objects, no border'
UC_CUT = 'background scenery, drop shadow, ground shadow, multiple views, collage, frame'
UC_ILLUS = 'dark background, murky colors, low contrast, multiple views, collage, frame'

TASKS = [
    # —— 透明通道组（生物/道具）——
    ('bio-patrol', 1024, 768,
     'full body futuristic urban patrol soldier with tactical armor and rifle, standing ready pose, '
     'one single character, large centered subject filling the frame, clear silhouette, '
     'vivid accent details, ' + WHITE,
     UC_CUT),
    ('bio-wolf', 1024, 768,
     'large mutated snow wolf, snarling four-legged beast, powerful predator pose, '
     'one single creature filling the frame, clear silhouette, pale silver-white fur with cold blue accents, '
     + WHITE,
     UC_CUT),
    ('item-fuyuan', 1024, 768,
     'small glass potion bottle with glowing cyan liquid and cork stopper, single object, '
     'large centered item filling the frame, crisp silhouette, vivid cyan accent, ' + WHITE,
     UC_CUT),
    ('item-aid', 1024, 768,
     'slender medical injector vial with pale blue liquid and metal cap, single object, '
     'large centered item filling the frame, crisp silhouette, clean bright highlights, ' + WHITE,
     UC_CUT),
    # —— 浅底插画组（武术/法术）——
    ('mat-meteor', 1024, 768,
     'a volley of flaming arrows raining down diagonally, bright orange fire trails with ember sparks, '
     'one single dramatic action moment, large centered subject filling the frame, '
     'vivid warm orange accents, ' + BRIGHT,
     UC_ILLUS),
    ('spl-execute', 1024, 768,
     'a powerful crimson slash energy cleave splitting the frame, dynamic combat strike effect with flying droplets, '
     'one single dramatic moment, large centered subject, vivid saturated red accents, ' + BRIGHT,
     UC_ILLUS),
]

MIN_INTERVAL_S = 45


def gen(name, w, h, subject, uc_extra):
    prompt = nai_style.build_prompt(subject, '')
    uc = nai_style.build_uc(uc_extra)
    seed = random.randint(1, 2 ** 32 - 1)
    payload = {
        'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
        'parameters': {
            'params_version': 3, 'width': w, 'height': h, 'scale': 6.5, 'steps': 28,
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
    pj = os.path.join(OUT, name + '.payload.json')
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    zp = os.path.join(OUT, name + '.zip')
    code = ''
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
            time.sleep(10)
        if ok:
            break
    else:
        print('FAIL', name, 'code=' + str(code), flush=True)
        return False
    png = os.path.join(OUT, name + '_%d.png' % seed)
    try:
        with zipfile.ZipFile(zp) as z:
            data = z.read(z.namelist()[0])
        open(png, 'wb').write(data)
        print('OK', name, seed, flush=True)
        return True
    except Exception as e:
        print('ZIPERR', name, e, flush=True)
        return False


for i, (name, w, h, subject, uc) in enumerate(TASKS):
    if i > 0:
        time.sleep(MIN_INTERVAL_S)
    gen(name, w, h, subject, uc)

print('ALLDONE', OUT, flush=True)
