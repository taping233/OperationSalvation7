# -*- coding: utf8 -*-
"""照相馆装饰件三张（0923 老板授权出图）：页眉金花纹 / 选片台牌匾 / 相角花贴。
画风=仓库 nai_style.painterly v1.0（全游戏统一口径）；白底出图走洪水填充抠透明管线。
节奏铁律内置：45s 间隔 / 429 停15min / 403 立即停手。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'studio-deco-' + time.strftime('%Y%m%d-%H%M%S'))
os.makedirs(OUT, exist_ok=True)
token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line

WHITE = 'plain pure white background, isolated object, nothing else'
UC_WHITE = 'black background, grey background, color gradient background'

TASKS = [
    ('header-flourish', 1216, 832,
     '1.4::ornate gold filigree flourish, symmetrical scrollwork divider ornament::, '
     'elegant acanthus leaf scrolls, gold leaf metallic texture with warm highlights, '
     'a single centered decorative flourish shaped like spread wings, horizontal decorative band, '
     'single centered element',
     WHITE,
     UC_WHITE + ', multiple views, collage, objects arrangement'),
    ('plaque', 1216, 832,
     '1.3::antique wooden sign plaque with brass border::, ornate carved empty sign board, '
     'warm dark walnut wood panel, thin polished gold brass trim frame, small decorative corner bolts, '
     'completely blank empty center with no writing, a single centered object',
     WHITE,
     UC_WHITE + ', paper, parchment, letters, characters, words, symbol, writing'),
    ('corner', 1024, 1024,
     '1.4::gold corner flourish ornament::, ornate photo frame corner decoration, '
     'art nouveau scrollwork vine curls, gold leaf texture with warm highlights, '
     'a single corner ornament designed for the upper right corner of a photograph, '
     'single centered element',
     WHITE,
     UC_WHITE + ', complete frame, full border, multiple views, collage'),
]

MIN_INTERVAL_S = 45


def gen(name, w, h, subject, scene, uc_extra):
    prompt = nai_style.build_prompt(subject, scene)
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
            time.sleep(10)  # 断流/网络抖动，换通道重试
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


for i, (name, w, h, subject, scene, uc) in enumerate(TASKS):
    if i > 0:
        time.sleep(MIN_INTERVAL_S)
    gen(name, w, h, subject, scene, uc)

print('ALLDONE', OUT, flush=True)
