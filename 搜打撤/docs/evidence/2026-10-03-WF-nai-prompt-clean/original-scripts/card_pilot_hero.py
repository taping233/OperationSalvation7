# -*- coding: utf8 -*-
"""常无欲职业卡试张（0923 老板令）：职业模板=本人出镜+法术意象前景+单主色亮底；1024x768=1.32。
锚点=现场提炼 portraits/full/changwuyu.webp（黑巫师帽紫衬/橙鬓发/圆眼镜/黑金长袍紫衬/
羽毛蓝宝石领饰/实体黑雾+拖尾火球）。试张仅供看效果，不落地（能力卡12在豁免清单）。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'card-pilot-hero3-' + time.strftime('%Y%m%d-%H%M%S'))
os.makedirs(OUT, exist_ok=True)
token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line

SUBJECT = (
    'elegant mysterious young man with a gentle smile, '
    '1.3::silver-grey long hair with two side locks falling to the waist, low bun at the back, short messy bangs under the hat::, '
    '1.3::black wide-brim witch hat with deep purple inner lining, neat slender hat tip gently curving and drooping to the right::, '
    '1.3::round thin metal frame eyeglasses, golden yellow eyes behind the lenses, pointy elf ears::, '
    'black high-collar long coat with thin gold piping only along the front edges and cuffs, small gold buttons, '
    'solid plain black fabric with no stripes, large cloak with purple inner lining flowing behind, '
    'white feather ornament with a gold-set sapphire brooch on the left chest, black leather gloves, '
    'half body portrait cropped at the waist, the character is the clear focal point, looking at viewer, '
    'the space on both sides of the character is clean empty background with nothing floating, '
    'glowing energy volcano vent with molten orange light in the foreground, warm firelight glow on the character'
)
SCENE = (
    'bright warm amber single-color gradient background, clean simple color field, '
    'no scenery clutter, no border'
)
UC = 'female, woman, dark background, murky, low contrast, (black mist cloud:1.3), (black smoke:1.3), (floating orb:1.2), (fireball:1.3), comet, meteor, staff, wand, gold stripes, vertical gold bands, striped fabric, crooked oversized hat tip, twisted distorted hat, multiple views, collage, frame'

prompt = nai_style.build_prompt(SUBJECT, SCENE)
uc = nai_style.build_uc(UC)
seed = random.randint(1, 2 ** 32 - 1)
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
pj = os.path.join(OUT, 'changwuyu-hero.payload.json')
with open(pj, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)
zp = os.path.join(OUT, 'changwuyu-hero.zip')
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
    sys.exit('FAIL code=' + str(code))

png = os.path.join(OUT, 'changwuyu-hero_%d.png' % seed)
with zipfile.ZipFile(zp) as z:
    data = z.read(z.namelist()[0])
open(png, 'wb').write(data)
print('OK changwuyu-hero', seed, OUT, flush=True)
