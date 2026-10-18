# -*- coding: utf-8 -*-
"""NAI 默认画风 v3.4：参考质量尾与通用画法减约束。

画师、画法、质量尾在本模块维护，模型与采样配置在 nai_gen。
完整认可请求和旧配方快照见 docs/evidence/2026-10-16-nai-default-wide/。
这套配方用于 NAI；内置生图默认重绘 v1.0 由 ART-STYLE-V1.md 独立维护。
身份、动作、布局、光色与单图排除按任务填写，不全局继承吃饭场景。
"""

RECIPE_VERSION = '3.4'

ARTIST_BLOCK = '0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::'

QUALITY_BLOCK = 'masterpiece, best quality, very aesthetic, masterpiece, no text, rating:general'

STYLE_BLOCK = 'arknights, game promotional illustration, painterly anime illustration. Complete, clean silhouettes and carefully resolved facial features and hands. Use clear grouped shadows and angular cloth folds. Keep fine linework selective around the eyes, fingers and accessories. Skin has delicate restrained transitions. Alternate crisp focal edges with softer background edges while keeping contours complete. Rich but controlled color, precise focal detail, quieter background detail.'

PORTRAIT_SCENE_TAIL = (
    'Use a quiet background without scenery, '
    'leaving the complete character silhouette as the focal point; preserve the specified pose.'
)

BASE_UC = 'lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, unfinished sketch, fragmented silhouette, bad hands, bad anatomy, extra fingers, missing fingers, fused fingers, extra arms, extra hands, plastic skin, waxy skin, glossy fabric, text, watermark, signature, frame, collage, unfinished, sketch, rough sketch, broken contours, plastic rendering, text logo'


def build_prompt(subject_layer, scene_layer=''):
    """主体 → 场景 → 画师 → 画法 → 质量尾；单图身份与场景不在共享块内。"""
    return '\n\n'.join(part for part in (subject_layer, scene_layer, ARTIST_BLOCK, STYLE_BLOCK, QUALITY_BLOCK) if part)


def build_character_portrait_prompt(subject_layer, scene_layer='', *, composition_layer=''):
    """完整轮廓立绘；姿态来自主体/构图层，支持白塔坐姿；兼容旧两参数调用。"""
    portrait_scene = '\n\n'.join(
        part for part in (scene_layer, composition_layer, PORTRAIT_SCENE_TAIL) if part)
    return build_prompt(subject_layer, portrait_scene)


def build_asset_prompt(subject_layer, *, purpose_layer='', composition_layer='', light_material_layer=''):
    """主体/身份、用途、构图、光色材质分层；尺寸、模型与裁切在批次记录。"""
    scene = '\n\n'.join(
        part for part in (purpose_layer, composition_layer, light_material_layer) if part)
    return build_prompt(subject_layer, scene)


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
