# -*- coding: utf-8 -*-
"""WF-nai-v13-restore 第二版：老板 10-03 深夜画崩定位后的调整方案（v1.4 草案实测）。

老板方案要点（原话照抄，未擅自修正）：
① 画师串权重对调主次 0.7::miv4t::, 1.1::quasarcake::（quasarcake 主导速写块面）
② 风格块前置紧跟画师串（NAI 越靠前权重越高）
③ 身份层精简去歧义（charcoal-black outer skirt 等长句简化）
④ 姿态层删精细手势（back of the hand outward）
⑤ UC 重写（over fluffy hair 保留发丝层次 + deformed hands/bad anatomy）
⑥ 参数：scale 6.5→5.5（老板定位 CFG 过高扭曲造型）、steps 28→32（老板定位 32-36 更稳，
   取区间下限）、seed 换新随机、模型/尺寸/采样器/schedule/variety_plus 不变。

本轮仅脚本层拼装实测，nai_style.py v1.3 配方本体不动；老板验收对味后再固化 v1.4
（改配方+联动测试+文档+版本史）。产物与请求体快照落本目录与 .tmp 输出目录。
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))

import nai_gen
from nai_gen import build_payload, generate_image, MODEL

# 老板拍板参数覆盖（2026-10-03 深夜指令；nai_gen 源码默认不动）
nai_gen.DEFAULTS['scale'] = 5.5
nai_gen.DEFAULTS['steps'] = 32

REF = PROJECT / 'game' / 'assets' / 'portraits' / 'full' / 'wu.webp'
OUT = PROJECT.parent / '.tmp' / 'nai' / 'output' / 'wu-front-portrait-20261003'
FINAL = OUT / 'wu-front-portrait-v2.png'
REQUEST_LOG = HERE / 'wu-front-portrait-v2.request.json'

WIDTH, HEIGHT = 832, 1216

ARTIST_BLOCK_V14 = '0.7::miv4t::, 1.1::quasarcake::'

STYLE_BLOCK_V14_FRONT = (
    'masterpiece, best quality, painterly sketch illustration, visible rough brush strokes, '
    'loose hand-painted texture, broken open edges, blocky volume modeling, '
    'confident planes of light and shadow, broad paint masses, dry uneven strokes, '
    'crisp small material highlights, varying brush sizes, retain deliberate brush marks, '
    'do not over smooth surfaces, soft directional lighting, anime character sheet, '
    'full body character stand'
)

SUBJECT_V14 = (
    '1girl, young adult woman, fair skin, small youthful face, bright cyan-blue eyes, '
    'slightly upturned sharp eyes, confident playful grin, single small upper fang, '
    'parted bangs, eyebrows visible through hair, silver-white long smooth hair, '
    'tight neat very high ponytail, long ponytail falls behind left side down to mid-calf, '
    'large blue satin ribbon bow at ponytail base, two trailing blue ribbon streamers, '
    'one black rose decoration beside ponytail root, two long thin sidelocks to collarbone, '
    'matte black round sunglasses resting on top of head, black off-shoulder dress, '
    'horizontal pleated ruffle at neckline, thin narrow black waist belt, '
    'outer black skirt with jagged ruffle hem, '
    'deep blue inner skirt lining printed with tiny light-blue four-pointed stars, '
    'star lining peeking out below outer skirt hem, bare lower legs, '
    'black platform ankle boots, folded boot cuffs, side zipper detail, '
    'single black longsword in black scabbard slung diagonally across back, '
    'sword hilt over left shoulder, scabbard tip below right knee, '
    'thin black crossbody strap from right shoulder to left waist'
)

SCENE_V14 = (
    'full body, front view facing viewer, standing upright, feet slightly apart, '
    'right hand placed on hip, left arm relaxed naturally at side, '
    'entire body visible inside frame, blank plain white background, '
    'cocky self-assured expression'
)

COMPOSITION_V14 = (
    'portrait orientation, single standing character centered in canvas, '
    'full head-to-boot silhouette, clean white empty background, '
    'character silhouette is main focus'
)

PORTRAIT_TAIL_V14 = (
    'quiet loosely brushed plain background with no scenery, preserve specified pose, '
    'character illustration sketch, not unfinished draft'
)

UC_V14 = (
    'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, '
    'fully polished render, plastic texture, waxy skin, '
    'blurry fingers, extra fingers, missing fingers, fused fingers, deformed hands, '
    'text, watermark, signature, border, collage, multiple character views, '
    'reflective sunglasses, lens flare, glasses lens reflection, '
    'pantyhose, stockings, thigh highs, '
    'over fluffy hair, over voluminous hair, messy tangled hair, wavy curls, '
    'hair fully covering eye, two swords, multiple swords, drawn sword, weapon in hand, '
    'multiple girls, bad anatomy, deformed limbs'
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
    # 老板方案拼装顺序：画师串 → 风格块（前置）→ 身份 → 姿态 → 构图 → 尾句
    prompt = '\n\n'.join(part for part in (
        ARTIST_BLOCK_V14, STYLE_BLOCK_V14_FRONT, SUBJECT_V14,
        SCENE_V14, COMPOSITION_V14, PORTRAIT_TAIL_V14,
    ) if part)
    print('RECIPE draft v1.4 (boss 2026-10-03 late-night plan) | MODEL', MODEL)
    print('scale', nai_gen.DEFAULTS['scale'], '| steps', nai_gen.DEFAULTS['steps'])
    print('PROMPT chars', len(prompt), '| UC chars', len(UC_V14))
    out, seed = generate_image(prompt, UC_V14, width=WIDTH, height=HEIGHT, out=str(FINAL))
    body = build_payload(prompt, UC_V14, '', WIDTH, HEIGHT, seed, MODEL)
    REQUEST_LOG.write_text(json.dumps({
        'recipe_draft': 'v1.4-draft（老板 2026-10-03 深夜方案，实测中未固化）',
        'model': MODEL,
        'param_overrides': {'scale': 5.5, 'steps': 32},
        'reference_image': 'game/assets/portraits/full/wu.webp',
        'reference_sha256': ref_sha256(),
        'prompt': prompt,
        'uc': UC_V14,
        'width': WIDTH,
        'height': HEIGHT,
        'seed': seed,
        'output': '.tmp/nai/output/wu-front-portrait-20261003/wu-front-portrait-v2.png',
        'payload': body,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REQUEST LOG SAVED', REQUEST_LOG)


if __name__ == '__main__':
    main()
