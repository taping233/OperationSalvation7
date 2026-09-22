# -*- coding: utf-8 -*-
"""全游戏统一画风配方（官方美术生图主题）v1.0 —— 权威定稿文本，进 git 永久固化。

【口径（2026-09-19 老板拍板，本文件为唯一权威源）】
  一切 NAI 生图（立绘 / 卡面 / Q 版头像 / 资源卡 / 皮肤 / 背景……）一律 import 本模块，
  禁止散抄画风文本。.tmp/nai/style_modules/official_painterly_style.py 为兼容薄壳，
  .tmp 清理丢失时以本文件重建。V5 full 口径；出图参数见 0919 链路记忆：
  steps 28 / scale 6.5 / variety_plus / k_euler_ancestral / karras / cfg_rescale 0。

【配方来源】2026-09-19 老板亲自提供（画师串 + 风格块 + 负面词原文）。
  当日首张验证图：wu-portrait-painterly-small-20260919-095726（seed 1278087392）。
【修订史】同日老板曾出 v1.1 修订（painterly sketch illustration + STYLE_CONTROL 1.2），
  对比后拍板回滚 v1.0 —— v1.1 文本见文件末尾存档，默认严禁使用。
【结构】build_prompt(subject, scene) = 画师串 + 主体层 + 场景层 + 风格块（\n\n 分段）；
  build_uc(extra) = 手指四条等通用基线 + 角色/图片专属排除（不要往 BASE_UC 里私加）。"""

ARTIST_BLOCK = '1.2::miv4t::, 0.8::quasarcake::'

STYLE_BLOCK = (
    'masterpiece, best quality, painterly, sketch, visible brush strokes, '
    'loose hand-painted texture, broken edges, blocky volume modeling.\n\n'
    'A complete illustration with the freshness of a painted sketch, not an unfinished draft. '
    'Soft directional light reveals the planes of forms. '
    'Build volumes from confident planes of light and shadow with visible brush edges, '
    'while letting selected outer contours remain open. '
    'Use broad flowing paint masses, dry uneven strokes, and crisp small highlights '
    'appropriate to each material. '
    'Vary the brush size and edge sharpness between different materials. '
    'Preserve deliberate brush marks instead of smoothing every surface.'
)

BASE_UC = (
    'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, '
    'fully rendered polished painting, plastic texture, waxy texture, '
    'blurry fingers, extra fingers, missing fingers, fused fingers, '
    'text, watermark, signature, frame, collage, multiple views'
)
# 手指四条为老板 0919 追加指令（模糊不清、数量异常的手指），其余为老板负面词原文+通用排除。


def build_prompt(subject_layer, scene_layer=''):
    """拼完整正向提示词：画师串 → 主体层 →（可选）场景层 → 风格块，空段自动跳过。"""
    return '\n\n'.join(part for part in (ARTIST_BLOCK, subject_layer, scene_layer, STYLE_BLOCK) if part)


def build_uc(extra_uc=''):
    """拼负面提示词：BASE_UC 基线 + 本图专属排除项（空则只用基线）。"""
    return BASE_UC if not extra_uc else BASE_UC + ', ' + extra_uc


# ── v1.1 存档（0919 老板方案版，实测出图不如 v1.0，当日已回滚，严禁默认启用）────────────
# STYLE_BLOCK_V11 = (
#     'masterpiece, best quality, painterly sketch illustration, visible brush strokes, '
#     'loose hand-painted texture, broken edges, blocky volume modeling, dry brush texture, '
#     'uneven paint edges, broad color masses.\n\n'
#     'A complete painted sketch with freshness and energy, not an over-polished render. '
#     'Build volumes through strong planes of light and shadow, with clear shadow boundaries '
#     'and restrained highlights. '
#     'Use larger brushwork for hair and dress, smaller sharper strokes for eyes, sunglasses, '
#     'boots, and metal details. '
#     'Keep deliberate brush marks, avoid smooth airbrushing, avoid soft plastic-like gradients.'
# )
# STYLE_CONTROL_V11 = ('1.2::The style resembles a character concept sketch with finished volume and color, '
#                      'prioritizing painterly brushwork, anatomical clarity, and strong silhouette '
#                      'over smooth cinematic rendering::')
