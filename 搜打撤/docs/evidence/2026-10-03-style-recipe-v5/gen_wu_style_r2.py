# -*- coding: utf-8 -*-
"""画风基准重定第二轮（老板 10-04 反馈：r1c 最好但不够好，修三处，模仿参考照片）。

老板指定问题 → 提示词根源 → 改法：
① 裙子非常不自然 → 'outer black skirt with jagged ruffle hem' 锯齿措辞是祸根
   （09-23 v23 铁口径：均匀齐小腿 A 字裙+单层黑荷叶边，锯齿=跑硬祸根）→
   'black A-line skirt with a single layered ruffle hem'，UC 加回锯齿三连排除。
② 飘带过于长 → 'two trailing blue ribbon streamers' 的 trailing 诱导长飘带 →
   'short ribbon ends'，UC 排长飘带。
③ 颜色不够干净 → 星纹铺满内衬成碎点脏源 + 点睛色无面积约束 →
   星纹只在裙摆开口小面积透出；风格块调色改 'clean limited palette ... one single
   blue accent'；UC 排 busy pattern/scattered dots/glitter/muddy colors。

画师串不动（1.3::miv4t::, 0.6::quasarcake:: = r1c 原串，第一轮已探明 1.5 过权写实、
0.7 反向）；白底保留（r1c 最好）；V5 + steps 28 + scale 5.5 + 832×1216 全不变。
跑法（老板认可口径）：r2a 锁 r1c seed 1502523721 只换词贴基准 + r2b 新随机 seed 对照。
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

# 身份层：v3-full 原文基础上只动裙/星纹/飘带三处（见模块 docstring）
IDENTITY_R2 = (
    '1girl, young adult woman, small youthful face, fair skin, bright cyan-blue eyes, '
    'slightly upturned sharp eyes, confident playful grin, single small upper fang, '
    'parted bangs, eyebrows visible through hair, silver-white long smooth hair, '
    'tight neat very high ponytail, long ponytail falls behind left side down to mid-calf, '
    'large blue satin ribbon bow at ponytail base, short ribbon ends, '
    'black rose hair accessory beside ponytail root, two long thin sidelocks to collarbone, '
    'matte black round sunglasses resting on top of head, '
    'black off-shoulder dress, horizontal pleated ruffle at neckline, '
    'thin narrow black waist belt, black A-line skirt with a single layered ruffle hem, '
    'deep blue inner lining printed with small four-pointed stars, '
    'star lining visible only through small openings at the hem, bare lower legs, '
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

# 风格块：r1 的 STYLE_V5R 只换调色句（颜色干净），其余不动
STYLE_V5R2 = (
    'masterpiece, best quality, painterly illustration, no lineart, '
    'dry impasto brushwork, visible rough brush strokes, broken open edges, '
    'clean limited palette of black, white and muted greys with one single blue accent.\n\n'
    'Paint in large unified planes, each passage done in a few decisive strokes rather than '
    'many small strokes. Build strong value contrast with deep shadow masses and minimal mid-tones, '
    'letting small crisp highlights land only on material edges. '
    'Hair is drawn in grouped sweeping strokes, with brush marks skipping and breaking '
    'over the outer silhouette. '
    'The face stays finely rendered with sharp eye highlights, while the body, dress and limbs '
    'are kept loosely simplified with broad sketchy planes.'
)

TAIL_WHITE = (
    'quiet loosely brushed plain white background with no scenery, '
    'preserve specified pose, character illustration sketch, not unfinished draft'
)

# UC：r1 的 UC_A + 三处问题追加（锯齿三连是 09-23 v25 铁口径加回）
UC_R2 = (
    'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, '
    'fully polished render, plastic texture, waxy skin, '
    'blurry fingers, extra fingers, missing fingers, fused fingers, deformed hands, '
    'deformed face, asymmetrical face, crooked mouth, uneven eyes, '
    'text, watermark, signature, border, collage, multiple character views, '
    'reflective sunglasses, lens flare, glasses lens reflection, '
    'pantyhose, stockings, thigh highs, '
    'over fluffy hair, over voluminous hair, messy tangled hair, wavy curls, '
    'hair fully covering eye, two swords, multiple swords, drawn sword, weapon in hand, '
    'multiple girls, bad anatomy, deformed limbs, '
    'jagged hem, zigzag-cut hem, pointed triangular hem, torn jagged skirt edge, '
    'very long ribbon streamers, oversized ribbons, flying ribbon tails, '
    'busy pattern, scattered confetti dots, glitter, muddy colors, oversaturated colors'
)


def run(tag, seed=None):
    prompt = '\n\n'.join(('1.3::miv4t::, 0.6::quasarcake::', STYLE_V5R2, IDENTITY_R2,
                          SCENE_A, COMPOSITION_A, TAIL_WHITE))
    final = OUT / f'wu-style-{tag}.png'
    if final.exists():
        print(f'--- {tag} already done, skip ---', flush=True)
        return
    print(f'--- {tag} | seed={"locked-r1c" if seed else "random"} '
          f'| scale {nai_gen.DEFAULTS["scale"]} steps {nai_gen.DEFAULTS["steps"]} ---', flush=True)
    out, used_seed = generate_image(prompt, UC_R2, width=832, height=1216,
                                    out=str(final), model=V5, seed=seed)
    body = build_payload(prompt, UC_R2, '', 832, 1216, used_seed, V5)
    log = HERE / f'wu-style-{tag}.request.json'
    log.write_text(json.dumps({
        'recipe': 'v5-recipe-r2（老板10-04反馈三处修正，未固化）',
        'batch': tag,
        'model': V5,
        'params': {'scale': 5.5, 'steps': 28, 'size': '832x1216'},
        'artist_block': '1.3::miv4t::, 0.6::quasarcake::',
        'changes_from_r1c': [
            'skirt: jagged ruffle hem -> black A-line skirt with a single layered ruffle hem (+UC jagged trio)',
            'ribbon: two trailing blue ribbon streamers -> short ribbon ends (+UC long streamers)',
            'color: muted low-saturation palette -> clean limited palette + one single blue accent (+UC busy/muddy)',
        ],
        'seed': used_seed,
        'seed_note': 'r2a locked to r1c seed 1502523721 for A/B' if seed else 'random',
        'prompt': prompt,
        'uc': UC_R2,
        'output': str(final.relative_to(PROJECT.parent)),
        'payload': body,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REQUEST LOG SAVED', log, flush=True)


def main():
    run('r2a', seed=1502523721)   # 锁 r1c seed 贴基准
    run('r2b')                     # 新 seed 对照
    run('r2c')                     # 新 seed 对照（老板口径：每轮 3 张）


if __name__ == '__main__':
    main()
