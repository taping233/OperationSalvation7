# -*- coding: utf-8 -*-
"""WF-nai-v13-restore 第三轮：老板 10-03 方案 A（全身分层优化）+ 方案 B 第一步（半身调脸）。

方案 A（老板原话"推荐优先试"）：全身 832×1216，画师串 0.8::miv4t::,1.1::quasarcake::，
身份层面部前置+双玫瑰拆分（black rose hair accessory / black plain scabbard），
姿态层加 hands simple/clean hands，构图层加 well-proportioned face/balanced facial features，
UC 追加 deformed face/asymmetrical face/crooked mouth/uneven eyes，scale 5.5→5.2，新 seed。

方案 B 第一步（老板"强烈推荐"的半身调脸）：640×832 半身，prompt 仅画师串+风格块+
身份层前半段（脸/发型/头饰，至 sunglasses 为止），不写服装/全身/构图/尾句。
方案 B 第二步（img2img/outpaint 扩全身）当前 nai_gen 无此能力，待老板拍板另议。

两次生成串行，nai_guard 自动维持 ≥45s 间隔；nai_style/nai_gen 源码默认均不动。
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

nai_gen.DEFAULTS['scale'] = 5.2   # 老板方案 A：5.5 略高拉扯五官，降 5.2
nai_gen.DEFAULTS['steps'] = 32    # 沿用上一轮拍板（32-36 区间下限）

REF = PROJECT / 'game' / 'assets' / 'portraits' / 'full' / 'wu.webp'
OUT = PROJECT.parent / '.tmp' / 'nai' / 'output' / 'wu-front-portrait-20261003'

ARTIST_BLOCK_V14B = '0.8::miv4t::, 1.1::quasarcake::'

STYLE_BLOCK_FRONT = (
    'masterpiece, best quality, painterly sketch illustration, visible rough brush strokes, '
    'loose hand-painted texture, broken open edges, blocky volume modeling, '
    'confident planes of light and shadow, broad paint masses, dry uneven strokes, '
    'crisp small material highlights, varying brush sizes, retain deliberate brush marks, '
    'do not over smooth surfaces, soft directional lighting, anime character sheet, '
    'full body character stand'
)

# 身份层（方案 A 重构版：面部前置 + 双玫瑰拆分），前半段截至头饰
IDENTITY_FACE_AND_HAIR = (
    '1girl, young adult woman, small youthful face, fair skin, bright cyan-blue eyes, '
    'slightly upturned sharp eyes, confident playful grin, single small upper fang, '
    'parted bangs, eyebrows visible through hair, silver-white long smooth hair, '
    'tight neat very high ponytail, long ponytail falls behind left side down to mid-calf, '
    'large blue satin ribbon bow at ponytail base, two trailing blue ribbon streamers, '
    'black rose hair accessory beside ponytail root, two long thin sidelocks to collarbone, '
    'matte black round sunglasses resting on top of head'
)
IDENTITY_BODY = (
    'black off-shoulder dress, horizontal pleated ruffle at neckline, '
    'thin narrow black waist belt, outer black skirt with jagged ruffle hem, '
    'deep blue inner skirt lining printed with tiny light-blue four-pointed stars, '
    'star lining peeking out below outer skirt hem, bare lower legs, '
    'black platform ankle boots, folded boot cuffs, side zipper detail, '
    'single black longsword in black plain scabbard slung diagonally across back, '
    'sword hilt over left shoulder, scabbard tip below right knee, '
    'thin black crossbody strap from right shoulder to left waist'
)
IDENTITY_FULL = IDENTITY_FACE_AND_HAIR + ', ' + IDENTITY_BODY

SCENE_A = (
    'full body, front view facing viewer, standing upright, feet slightly apart, '
    'right hand placed gently on hip, left arm relaxed naturally at side, '
    'hands simple, clean hands, entire body visible inside frame, '
    'blank plain white background, cocky self-assured expression'
)

COMPOSITION_A = (
    'portrait orientation, single standing character centered in canvas, '
    'full head-to-boot silhouette, clean white empty background, '
    'character silhouette is main focus, well-proportioned face, balanced facial features'
)

PORTRAIT_TAIL = (
    'quiet loosely brushed plain background with no scenery, preserve specified pose, '
    'character illustration sketch, not unfinished draft'
)

UC_A = (
    'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, '
    'fully polished render, plastic texture, waxy skin, '
    'blurry fingers, extra fingers, missing fingers, fused fingers, deformed hands, '
    'deformed face, asymmetrical face, crooked mouth, uneven eyes, '
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


def run(tag, prompt, uc, width, height, final):
    if final.exists():
        raise SystemExit('Output exists; preserve it: ' + str(final))
    print(f'--- {tag} | scale {nai_gen.DEFAULTS["scale"]} steps {nai_gen.DEFAULTS["steps"]} '
          f'| {width}x{height} | PROMPT {len(prompt)} chars ---', flush=True)
    out, seed = generate_image(prompt, uc, width=width, height=height, out=str(final))
    body = build_payload(prompt, uc, '', width, height, seed, MODEL)
    log = HERE / f'wu-front-portrait-{tag}.request.json'
    log.write_text(json.dumps({
        'recipe_draft': 'v1.4-draft-b（老板 2026-10-03 方案A/B1，实测中未固化）',
        'batch': tag,
        'model': MODEL,
        'param_overrides': {'scale': 5.2, 'steps': 32},
        'reference_image': 'game/assets/portraits/full/wu.webp',
        'reference_sha256': ref_sha256(),
        'prompt': prompt,
        'uc': uc,
        'width': width,
        'height': height,
        'seed': seed,
        'output': str(final.relative_to(PROJECT.parent)),
        'payload': body,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REQUEST LOG SAVED', log, flush=True)


def main():
    # 方案 A：全身分层优化
    prompt_a = '\n\n'.join((ARTIST_BLOCK_V14B, STYLE_BLOCK_FRONT,
                            IDENTITY_FULL, SCENE_A, COMPOSITION_A, PORTRAIT_TAIL))
    run('v3-full', prompt_a, UC_A, 832, 1216, OUT / 'wu-front-portrait-v3-full.png')
    # 方案 B 第一步：半身调脸（仅画师串+风格块+身份层前半段）
    prompt_b = '\n\n'.join((ARTIST_BLOCK_V14B, STYLE_BLOCK_FRONT, IDENTITY_FACE_AND_HAIR))
    run('v3-half', prompt_b, UC_A, 640, 832, OUT / 'wu-front-portrait-v3-half.png')


if __name__ == '__main__':
    main()
