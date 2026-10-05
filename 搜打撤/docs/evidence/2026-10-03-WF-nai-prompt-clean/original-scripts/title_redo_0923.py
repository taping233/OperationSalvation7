# -*- coding: utf-8 -*-
"""标题页重做素材批（2026-09-23）：壁纸重构 1 张（2048x1152 烧 Anlas，老板授权）
+ 全部 UI 手绘发光图标 7 张（1024 透明底）。画风一律走仓库 tools/nai_style.py。
节奏铁律内置：一轮一张 >=45s；000 重试 45s x3；429 停 15 分钟（两次后停手上报）；403 立即停。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'title-redo-20260923-' + time.strftime('%H%M%S'))
os.makedirs(OUT, exist_ok=True)
ENDPOINT = 'https://image.novelai.net/ai/generate-image'

token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line
if not token:
    sys.exit('TOKEN_EMPTY')

ICON_TAIL = ('single UI icon, hand-painted glowing emblem: {desc}, '
             'painterly brush strokes, warm gold and cool cyan luminous rim glow, gentle aura, '
             'simple bold readable silhouette, centered composition, '
             'isolated on transparent background')
ICON_UC = ('background, scenery, text, letters, frame, border, collage, multiple objects, '
           'photorealistic, 3d render, extra limbs, blurry, lowres')

WALL_SUBJECT = (
    '1girl, very long wavy silver-white hair, high ponytail, blue hair ribbon, '
    'black round sunglasses on head, parted bangs, eyebrows visible through hair, blue eyes, '
    'fang, confident smirk, black off-shoulder gothic dress, layered frilled skirt, '
    'blue star-pattern skirt lining, bare legs, black gloves, black ankle boots, '
    'sitting on the snowy floor among fallen bookshelves, one knee raised, one hand resting on her knee, '
    'looking at viewer, '
    'the girl is the brightest element of the whole image, soft bright light on her face and hair '
    'coming from the upper left, she reads as a clear luminous focal point against the dark surroundings'
)
WALL_SCENE = (
    'wide establishing shot, character placed on the left half of the canvas, '
    'the right third of the canvas falls into deep quiet shadow with only faint bookshelf silhouettes, '
    'a snowy ruined library in a winter forest, toppled broken bookshelves half buried in snow, '
    'scattered open books and loose pages, bare black trees behind, gently falling snow, '
    'cold blue-grey twilight, dense storytelling debris on the left, calm dark empty zone on the right side'
)
WALL_UC = ('extra limbs, extra fingers, poorly drawn hands, cropped head, underexposed face, '
           'character in shadow, blown highlights, jpeg artifacts, blurry, lowres')

JOBS = [
    dict(name='wallpaper', w=2048, h=1152, alpha=False,
         subject=WALL_SUBJECT, scene=WALL_SCENE, uc=WALL_UC),
    dict(name='ic-exit', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='an open wooden door seen from inside with a bright arrow passing out through the doorway')),
    dict(name='ic-sound', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='an old fashioned hand horn trumpet with two curved sound waves')),
    dict(name='ic-guide', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='an open handbook with a glowing ribbon bookmark and a few small sparkles')),
    dict(name='ic-workshop', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='a quill pen crossed with a small engraving tool resting on a blank card')),
    dict(name='ic-photo', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='a vintage twin lens reflex camera with a small snowflake charm hanging on it')),
    dict(name='ic-achieve', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='a laurel wreath award medal with a five pointed star and ribbon tails')),
    dict(name='ic-settings', w=1024, h=1024, alpha=True, uc=ICON_UC,
         subject=ICON_TAIL.format(desc='an ornate brass gear wheel with a snowflake at its center')),
]


def payload_for(job, prompt, uc, seed):
    return {
        'input': prompt,
        'model': 'nai-diffusion-5-full',
        'action': 'generate',
        'parameters': {
            'params_version': 3,
            'width': job['w'], 'height': job['h'],
            'scale': 6.5, 'steps': 28, 'n_samples': 1,
            'ucPresetId': 'none', 'qualityPresetId': 'none', 'qualityToggle': False,
            'negative_prompt': uc,
            'sampler': 'k_euler_ancestral', 'seed': seed,
            'decrisper': False,
            'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True,
            'karras': True, 'cfg_rescale': 0.0, 'variety_plus': True,
            'texture_transform': False, 'autoSmea': True,
            'straight_alpha': bool(job['alpha']),
            'legacy_v4_extend': False, 'legacy_uc': False,
            'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []},
                          'use_coords': False, 'use_order': True},
            'v4_negative_prompt': {'caption': {'base_caption': uc, 'char_captions': []},
                                   'legacy_uc': False},
            'characterPrompts': [],
        },
    }


def curl_post(payload_path, zip_path):
    """返回 (http_code, channel_tag)。双通道：直连 -> socks5h 7890。"""
    common = ['--ssl-no-revoke', '--max-time', '180', '-sS', '-w', '%{http_code}',
              '-o', zip_path, '-X', 'POST',
              '-H', 'Authorization: Bearer ' + token,
              '-H', 'Content-Type: application/json',
              '--data-binary', '@' + payload_path]
    for tag, extra in (('direct', ['--noproxy', '*']),
                       ('socks', ['-x', 'socks5h://127.0.0.1:7890'])):
        try:
            r = subprocess.run(['curl'] + extra + common + [ENDPOINT],
                               capture_output=True, text=True, timeout=220)
            code = (r.stdout or '').strip()[-3:]
            if code in ('200', '201'):
                return code, tag
            if code == '403':
                return '403', tag
            if code == '429':
                return '429', tag
        except Exception:
            pass
        time.sleep(45)  # 000/断流：等 45s 再换通道重试
    return '000', 'all'


manifest = []
rate429 = 0
for i, job in enumerate(JOBS):
    seed = random.randint(1, 2 ** 32 - 1)
    prompt = nai_style.build_prompt(job['subject'], job.get('scene', ''))
    uc = nai_style.build_uc(job['uc'])
    pj = os.path.join(OUT, job['name'] + '.payload.json')
    zp = os.path.join(OUT, job['name'] + '.zip')
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(payload_for(job, prompt, uc, seed), f, ensure_ascii=False)

    code, ch = '000', ''
    for attempt in range(3):  # 000 系：整体最多 3 轮
        code, ch = curl_post(pj, zp)
        if code in ('200', '201'):
            break
        if code == '403':
            sys.exit('403_STOP: ' + job['name'])
        if code == '429':
            rate429 += 1
            if rate429 > 2:
                sys.exit('429_STOP: ' + job['name'])
            print('429 wait 15min', flush=True)
            time.sleep(900)
        else:
            time.sleep(45)

    if code not in ('200', '201'):
        sys.exit('FAIL ' + job['name'] + ' code=' + str(code))

    png = os.path.join(OUT, job['name'] + '_' + str(seed) + '.png')
    with zipfile.ZipFile(zp) as z:
        data = z.read(z.namelist()[0])
    with open(png, 'wb') as f:
        f.write(data)
    os.remove(zp)
    manifest.append(dict(name=job['name'], seed=seed, png=os.path.basename(png), channel=ch))
    print('OK', job['name'], seed, ch, flush=True)

    if i < len(JOBS) - 1:
        time.sleep(45 + random.randint(0, 5))

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print('DONE', OUT, flush=True)
