# -*- coding: utf-8 -*-
"""满月形态卡面出图批次 · 2026-10-02 老板令（自然形态→满月形态，改牧师职业卡）。

卡面目标：tt3-nature-form（改名后「满月形态」，cls 牧师=星月）职业卡面。
职业卡铁律：必须体现本人形象（脸可见）；牧师=白+青绿+暖金调，满月月光祝福意象。
出图：免费档横版 1344×768，两张不同构图；产物落 .tmp/nai/fullmoon-cards/ 原始 PNG。
老板过审前不裁切、不落地 game/assets/cards/spell-tt3-nature-form.webp。
角色锚点逐字来自 docs/character-bible/xingyue.md（0919 定稿细粒度锚点照抄；星灯 09-20 已解绑不强制）。
"""
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[2] / '搜打撤' / 'tools'
sys.path.insert(0, str(TOOLS))
from nai_gen import generate_image          # noqa: E402
from nai_style import build_prompt, build_uc  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / 'fullmoon-cards'
OUT_DIR.mkdir(exist_ok=True)

# 角色栏：只放外貌（手册 §3.5 字段分工；锚点=xingyue.md 细粒度逐字）
CHAR_PROMPT = (
    '1girl, pale milk-gold extremely long hair, straight thick hime-cut bangs above her brows, '
    'one thin loose braid on her left side along the temple, '
    'low thick braided ponytail hanging down to her calves with a small hair tie at the end, '
    'a white C-shaped crescent moon hairpin with both points toward the upper right, '
    'clipped flat into the hair at the top of her head just above the bangs, '
    'slightly off-center to the viewer\'s right, tilted, resting against the hair '
    '(not floating, not a halo), '
    'warm golden eyes, calm expressionless face, thin closed lips, '
    'white priestess dress with wide gold trim, small high collar, gold choker, '
    'gold four-pointed star brooch on the chest, '
    'deep teal-green short capelet with gold edging draped over both shoulders, '
    'dark fingerless wrist guards'
)

# 两张不同构图（卡面成批多创意、视角零重复）
SUBJECTS = [
    (
        'moonlight-blessing-front',
        'upper-body to knees composition, facing viewer, face clearly visible, '
        'both hands raised gracefully in front of her chest channeling a veil of pale moonlight, '
        'glowing moon motes gathering between her palms, '
        'a card-art illustration read at a glance: a priestess blessed by the full moon, '
        'her form wrapped in silver-gold light'
    ),
    (
        'moon-summon-three-quarter',
        'three-quarter view standing composition, face turned toward the viewer and clearly visible, '
        'one arm lifted high toward the sky drawing down a ribbon of moonlight, '
        'luminous stardust spiraling around her raised hand and long braid, '
        'a card-art illustration read at a glance: she calls the full moon down as her power'
    ),
]

SCENE = (
    'A huge luminous full moon glowing directly behind her, filling the upper sky, '
    'soft silver-gold moonlight raining down like thin veils, drifting stardust and tiny glowing motes, '
    'quiet night palette of white, teal-green and warm gold, '
    'open ground below her feet'
)

manifest = []
for name, subject in SUBJECTS:
    prompt = build_prompt(subject, SCENE)
    uc = build_uc('1boy')
    out, seed = generate_image(
        prompt, uc, char_prompt=CHAR_PROMPT,
        width=1344, height=768,
        out=str(OUT_DIR / f'{name}.png'),
    )
    manifest.append({
        'file': str(out), 'card': 'tt3-nature-form→满月形态(牧师)', 'seed': seed,
        'prompt': prompt, 'uc': uc, 'char_prompt': CHAR_PROMPT,
    })
    print('done:', name, 'seed:', seed, '->', out)

(OUT_DIR / 'manifest.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print('all done, manifest written')
