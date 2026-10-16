# -*- coding: utf-8 -*-
"""全游戏统一画风配方 v2.1（追加质量词）—— 现行视觉权威见 docs/production/art/VISUAL-BIBLE.md。

【口径（2026-09-23 老板拍板，本文件为唯一权威源）】
  一切 NAI 生图（立绘 / 卡面 / Q 版头像 / 资源卡 / 皮肤 / 背景……）一律 import 本模块，
  禁止散抄画风文本。.tmp/nai/style_modules/official_painterly_style.py 为兼容薄壳，
  .tmp 清理丢失时以本文件重建。历史 0919 使用 V5 full；当前 nai_gen 默认
  nai-diffusion-4-5-full，V5 必须显式传 model；配方与模型版本分别记录，不改客户端默认。
  现行客户端参数（与历史基线一致）：
  steps 28 / scale 6.5 / variety_plus / k_euler_ancestral / karras / cfg_rescale 0。

【配方来源】0919 首版选人立绘 wu-portrait-painterly-small（seed 1278087392）的画师串与风格块，
  2026-09-23 老板指定为全游戏通用风格基准；角色专属排除项仍由单图追加。
【修订史】旧 v1.1（painterly sketch illustration + STYLE_CONTROL 1.2）实测后回滚记录仍保留，
  不作为当前默认；v1.3 纠正用途与强制站姿；v1.4 按现行画风技能精简块面词，
  去掉草稿/开放轮廓和固定柔光，画师链不变。场景决定光源，角色身份单独分槽。
  v1.5 经教程与首样反馈压缩总词量，风格前置、适度加权；画师链仍不变。
  v1.6 去掉通用审美质量词，改为明确的丙烯绘画媒介与概括笔触；雪夜样本仍在验证。
  v1.7 老板改指定高清明日方舟群像参考；删除无勾线/粗块面/丙烯强制与细节排除，
  保留细线、衣装结构与概括上色，画师链不变。当轮参考优先，验证见雪夜任务记录。
  v1.8 明确细彩色轮廓与概括明暗色面的分工，约束整体饱和度；构图移至单图，画师与UC不变。
  v1.9 老板指定画师权重改为1.0/0.4，风格文本、通用UC与采样参数不变。
  2026-10-15 老板要求恢复v1.7；v1.8/v1.9与手册试图仅作历史候选。
  当前v2.0为老板随后指定的流程整合版：画师、STYLE_BLOCK与BASE_UC逐字沿用v1.7。
  v1.8/v1.9均保留旧试验编号，不复用；以实际请求快照为准；分槽/用途/对照/记录见NAI-PROMPTING.md。
  v2.1 按老板要求追加质量词，保留重复 masterpiece；画师、画法与通用负面沿用v2.0。
【结构】build_prompt(subject, scene) = 画师串 + 风格块 + 主体层 + 场景层 + 质量词（\n\n 分段）；
  build_uc(extra) = 含手指异常排除的通用基线 + 角色/图片专属排除；
  build_character_portrait_prompt() 仅为全身立绘追加安静无场景背景的构图句。"""

RECIPE_VERSION = '2.1'

ARTIST_BLOCK = '1.2::miv4t::, 0.8::quasarcake::'

QUALITY_BLOCK = 'high complexity, masterpiece, best quality, highly detailed, very aesthetic, masterpiece'

STYLE_BLOCK = (
    'anime illustration, delicate colored linework, painterly shading, layered composition. '
    'Expressive hair strands and flowing fabric contours; detailed clothing structures over '
    'economical color planes. Clear anime eyes, subtle facial shading, matte materials. '
    'Cool neutral midtones with selective vivid accents; fluid rhythms and varied edge detail. '
    'Faces and gestures anchor the composition. no text.'
)

PORTRAIT_SCENE_TAIL = (
    'Use a quiet, loosely brushed background without scenery, '
    'leaving the complete character silhouette as the focal point; preserve the specified pose.'
)

BASE_UC = (
    'lowres, worst quality, bad quality, jpeg artifacts, '
    'photorealistic, 3d, plastic texture, waxy texture, '
    'unfinished sketch, fragmented silhouette, canvas grain, '
    'blurry fingers, extra fingers, missing fingers, fused fingers, '
    'text, watermark, signature, frame, collage, multiple views'
)
# 手指四条保留老板 0919 指令；其余为通用质量与现行块面画法排除项。


def build_prompt(subject_layer, scene_layer=''):
    """画师串 → 精简风格 → 主体 → 场景 → 质量词；保留正向质量词的重复项。"""
    return '\n\n'.join(part for part in (ARTIST_BLOCK, STYLE_BLOCK, subject_layer, scene_layer, QUALITY_BLOCK) if part)


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
