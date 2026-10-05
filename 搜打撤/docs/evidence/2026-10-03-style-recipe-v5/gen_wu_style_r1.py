# -*- coding: utf-8 -*-
"""画风基准重定第一轮（老板 10-03 令：4 张参考图=认可画风，基准画风太差，快速迭代固定画风提示词）。

参考图画风判定（4 张视觉分析 + 画师识别）：
  无线稿 painterly / 干笔大块面厚涂 / 破碎残缺边缘 / 成组头发甩笔 /
  脸部五官精细 vs 身体高度概括 / 低饱和冷灰调 + 小面积点睛色 / 素灰底。
  画师归属：miv4t 85% ＞ 米山舞 60-65% ＞ quasarcake 50-55%（视觉模型判读）。
  其中两张参考图内容即「无」本人（蓝星衬黑裙+太刀+虎牙），目标=向其看齐。

与既有配方的关系：
  v1.3 基准 `1.2::miv4t::, 0.8::quasarcake::`（0919 定版口径）出的图被判太差；
  v2（0.7/1.1 对调）painterly 盲评 72 分、v3-full（1.2/0.6）82 分——miv4t 主导方向正确。
  本轮换血：新风格块 STYLE_V5R（六特征对齐参考图）+ 灰调素底尾句 + miv4t 提权梯度。

第一轮三张（832×1216 免费档，steps=28 回免费线——上轮 v2/v3 用 32 步已烧 Anlas）：
  r1a  1.3::miv4t::, 0.6::quasarcake:: + STYLE_V5R + 灰调素底
  r1b  1.5::miv4t::, 0.4::quasarcake:: + STYLE_V5R + 灰调素底（权重敏感度）
  r1c  同 r1a 画师串，尾句换回白底（背景灰调对照）
其余层（身份/姿态/构图/UC）沿用 v3-full 老板方案 A 结构不动；scale 5.5（老板深夜拍板值）。
模型显式 nai-diffusion-5-full；nai_guard 自动 ≥45s 串行。
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))

import nai_gen
from nai_gen import build_payload, generate_image

V5 = 'nai-diffusion-5-full'
nai_gen.DEFAULTS['scale'] = 5.5
nai_gen.DEFAULTS['steps'] = 28

OUT = PROJECT.parent / '.tmp' / 'nai' / 'output' / 'wu-front-portrait-v5style-20261003'

# 身份/姿态/构图/UC：v3-full 老板方案 A 原文，一字不动
IDENTITY_FULL = (
    '1girl, young adult woman, small youthful face, fair skin, bright cyan-blue eyes, '
    'slightly upturned sharp eyes, confident playful grin, single small upper fang, '
    'parted bangs, eyebrows visible through hair, silver-white long smooth hair, '
    'tight neat very high ponytail, long ponytail falls behind left side down to mid-calf, '
    'large blue satin ribbon bow at ponytail base, two trailing blue ribbon streamers, '
    'black rose hair accessory beside ponytail root, two long thin sidelocks to collarbone, '
    'matte black round sunglasses resting on top of head, '
    'black off-shoulder dress, horizontal pleated ruffle at neckline, '
    'thin narrow black waist belt, outer black skirt with jagged ruffle hem, '
    'deep blue inner skirt lining printed with tiny light-blue four-pointed stars, '
    'star lining peeking out below outer skirt hem, bare lower legs, '
    'black platform ankle boots, folded boot cuffs, side zipper detail, '
    'single black longsword in black plain scabbard slung diagonally across back, '
    'sword hilt over left shoulder, scabbard tip below right knee, '
    'thin black crossbody strap from right shoulder to left waist'
)

SCENE_A = (
    'full body, front view facing viewer, standing upright, feet slightly apart, '
    'right hand placed gently on hip, left arm relaxed naturally at side, '
    'hands simple, clean hands, entire body visible inside frame, '
    'cocky self-assured expression'
)

COMPOSITION_A = (
    'portrait orientation, single standing character centered in canvas, '
    'full head-to-boot silhouette, character silhouette is main focus, '
    'well-proportioned face, balanced facial features'
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

# 新风格块：按参考图六特征重写（替换 v1.3/v1.4 的 STYLE_BLOCK）
# 六特征：大而整笔触 / 强明暗低中间调 / 残缺开放边缘 / 成组头发甩笔 / 脸精身松 / 低饱和+点睛色
STYLE_V5R = (
    'masterpiece, best quality, painterly illustration, no lineart, '
    'dry impasto brushwork, visible rough brush strokes, broken open edges, '
    'muted low-saturation palette with small saturated accents.\n\n'
    'Paint in large unified planes, each passage done in a few decisive strokes rather than '
    'many small strokes. Build strong value contrast with deep shadow masses and minimal mid-tones, '
    'letting small crisp highlights land only on material edges. '
    'Hair is drawn in grouped sweeping strokes, with brush marks skipping and breaking '
    'over the outer silhouette. '
    'The face stays finely rendered with sharp eye highlights, while the body, dress and limbs '
    'are kept loosely simplified with broad sketchy planes.'
)

TAIL_GREY = (
    'quiet loosely brushed warm-grey plain background with no scenery, '
    'preserve specified pose, character illustration sketch, not unfinished draft'
)

TAIL_WHITE = (
    'quiet loosely brushed plain white background with no scenery, '
    'preserve specified pose, character illustration sketch, not unfinished draft'
)


def run(tag, artist_block, tail):
    prompt = '\n\n'.join((artist_block, STYLE_V5R, IDENTITY_FULL,
                          SCENE_A, COMPOSITION_A, tail))
    final = OUT / f'wu-style-{tag}.png'
    if final.exists():
        print(f'--- {tag} already done, skip ---', flush=True)
        return
    print(f'--- {tag} | {artist_block} | tail={"grey" if tail is TAIL_GREY else "white"} '
          f'| scale {nai_gen.DEFAULTS["scale"]} steps {nai_gen.DEFAULTS["steps"]} ---', flush=True)
    out, seed = generate_image(prompt, UC_A, width=832, height=1216,
                               out=str(final), model=V5)
    body = build_payload(prompt, UC_A, '', 832, 1216, seed, V5)
    log = HERE / f'wu-style-{tag}.request.json'
    log.write_text(json.dumps({
        'recipe': 'v5-recipe-r1（画风基准重定第一轮，未固化）',
        'batch': tag,
        'model': V5,
        'params': {'scale': nai_gen.DEFAULTS['scale'], 'steps': nai_gen.DEFAULTS['steps'],
                   'size': '832x1216', 'note': 'steps=28 回免费线'},
        'artist_block': artist_block,
        'style_block': STYLE_V5R,
        'tail': tail,
        'identity/scene/composition/uc': 'v3-full 老板方案A原文未动',
        'prompt': prompt,
        'uc': UC_A,
        'seed': seed,
        'output': str(final.relative_to(PROJECT.parent)),
        'payload': body,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REQUEST LOG SAVED', log, flush=True)


def main():
    run('r1a', '1.3::miv4t::, 0.6::quasarcake::', TAIL_GREY)
    run('r1b', '1.5::miv4t::, 0.4::quasarcake::', TAIL_GREY)
    run('r1c', '1.3::miv4t::, 0.6::quasarcake::', TAIL_WHITE)


if __name__ == '__main__':
    main()
