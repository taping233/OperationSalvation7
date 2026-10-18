# -*- coding: utf-8 -*-
"""NAI 提示词整理入口：画风继续引用 nai_style，不复制或改写共享配方。

旧批次可用 import nai_prompt_clean as nai_style 保持调用兼容。
仅合并完全相同的负面词；不推断语义，不拆开 NAI 的 :: 加权组。
"""
import nai_style as _style

RECIPE_VERSION = _style.RECIPE_VERSION
CLEANUP_VERSION = '1.0'
ARTIST_BLOCK = _style.ARTIST_BLOCK
QUALITY_BLOCK = _style.QUALITY_BLOCK
STYLE_BLOCK = _style.STYLE_BLOCK
BASE_UC = _style.BASE_UC
PORTRAIT_SCENE_TAIL = _style.PORTRAIT_SCENE_TAIL
build_prompt = _style.build_prompt
build_asset_prompt = _style.build_asset_prompt
build_character_portrait_prompt = _style.build_character_portrait_prompt


def _uc_terms(value):
    """逗号分隔词项，:: 加权组内的逗号保持原样。"""
    terms, start, index, weighted = [], 0, 0, False
    while index < len(value):
        if value[index:index + 2] == '::':
            weighted = not weighted
            index += 2
            continue
        if value[index] == ',' and not weighted:
            terms.append(value[start:index].strip())
            start = index + 1
        index += 1
    terms.append(value[start:].strip())
    return terms


def build_uc(extra_uc=''):
    """基线在前、专属项在后，大小写无关去重，保留首项和权重。"""
    seen, result = set(), []
    for term in _uc_terms(_style.build_uc(extra_uc)):
        key = term.casefold()
        if term and key not in seen:
            seen.add(key)
            result.append(term)
    return ', '.join(result)


def build_battle_portrait_prompt(subject_layer, *, composition_layer='', light_material_layer=''):
    """透明底战斗立绘，不继承安静涂刷背景或默认朝向/姿势。"""
    return build_asset_prompt(
        subject_layer,
        purpose_layer='One complete full-body battle character illustration on a truly transparent background.',
        composition_layer=composition_layer,
        light_material_layer=light_material_layer,
    )
