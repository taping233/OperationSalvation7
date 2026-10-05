# -*- coding: utf-8 -*-
"""WF-nai-v13-restore：无（wu）正面全身立绘一次出图；配方 nai_style v1.3。

身份层逐条对齐 docs/character-bible/wu.md「现行权威（2026-10-03）」段；
免费档竖版 832×1216（长×宽≈101 万 px < 108 万，不占大图日限额）。
产物落 .tmp/nai/output/wu-front-portrait-20261003/（>1MB 不进 Git）；
完整请求体快照由本脚本写 wu-front-portrait.request.json。
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))

from nai_gen import build_payload, generate_image, MODEL
from nai_prompt_clean import RECIPE_VERSION, build_character_portrait_prompt, build_uc

REF = PROJECT / 'game' / 'assets' / 'portraits' / 'full' / 'wu.webp'
OUT = PROJECT.parent / '.tmp' / 'nai' / 'output' / 'wu-front-portrait-20261003'
FINAL = OUT / 'wu-front-portrait-20261003.png'
REQUEST_LOG = HERE / 'wu-front-portrait.request.json'

WIDTH, HEIGHT = 832, 1216

SUBJECT = (
    '1girl, young adult woman, fair skin, small youthful face, '
    'bright cyan-blue eyes, slightly upturned sharp eyes, '
    'confident playful grin with one small fang, parted bangs, eyebrows visible through hair, '
    'silver-white sleek smooth hair, tight neat very high ponytail, '
    'long ponytail falling behind her left side down to mid-calf, '
    'blue satin ribbon bow with two trailing bands at the ponytail base, '
    'one black rose beside the ponytail root, two long sidelocks reaching the collarbone, '
    'matte black round sunglasses with thin frames resting on top of her head, '
    'black off-shoulder one-line-neckline dress, horizontal pleated ruffle at the neckline, '
    'narrow black waist belt, '
    'charcoal-black outer skirt with zigzag ruffled hem ending at the calves, '
    'deep-blue inner skirt lining covered with small light-blue four-pointed stars, '
    'a ring of the star-patterned lining visible below the outer hem, '
    'bare lower legs, black platform ankle boots with folded cuffs and zipper detail, '
    'one black longsword with a black scabbard slung diagonally on her back, '
    'hilt visible above her left shoulder, scabbard tip extending past her right hip below the knee, '
    'a thin black strap from her right shoulder to her left waist'
)

SCENE = (
    'Full body front view facing the viewer, standing upright with feet slightly apart, '
    'right hand resting on her hip with the back of the hand outward, left arm relaxed at her side, '
    'chest-up fully visible, entire figure inside the frame with margins on all sides, '
    'expression cocky and self-assured'
)

COMPOSITION = (
    'Portrait orientation, single complete standing figure centered, '
    'head-to-boot silhouette fully readable against the quiet background'
)

EXTRA_UC = (
    'reflective sunglasses, lens flare, glasses reflection, '
    'pantyhose, stockings, thigh highs, '
    'fluffy hair, voluminous hair, messy hair, wavy hair, '
    'high-low skirt, asymmetric skirt, '
    'hair over one eye, '
    'second sword, two swords, drawn sword in hand, '
    'multiple girls, multiple views'
)


def ref_sha256():
    digest = hashlib.sha256()
    with REF.open('rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    if FINAL.exists():
        raise SystemExit('Output exists; preserve it: ' + str(FINAL))
    prompt = build_character_portrait_prompt(SUBJECT, SCENE, composition_layer=COMPOSITION)
    uc = build_uc(EXTRA_UC)
    print('RECIPE_VERSION', RECIPE_VERSION, '| MODEL', MODEL)
    print('PROMPT chars', len(prompt), '| UC chars', len(uc))
    out, seed = generate_image(prompt, uc, width=WIDTH, height=HEIGHT, out=str(FINAL))
    body = build_payload(prompt, uc, '', WIDTH, HEIGHT, seed, MODEL)
    REQUEST_LOG.write_text(json.dumps({
        'recipe_version': RECIPE_VERSION,
        'model': MODEL,
        'reference_image': 'game/assets/portraits/full/wu.webp',
        'reference_sha256': ref_sha256(),
        'prompt': prompt,
        'uc': uc,
        'width': WIDTH,
        'height': HEIGHT,
        'seed': seed,
        'output': '.tmp/nai/output/wu-front-portrait-20261003/wu-front-portrait-20261003.png',
        'payload': body,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REQUEST LOG SAVED', REQUEST_LOG)


if __name__ == '__main__':
    main()
