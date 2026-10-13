"""沿核实记忆恢复共享画风原文；只重写脸部身份与火山交互，不生图。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_style
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
previous = json.loads((EVIDENCE / 'request-v4.json').read_text(encoding='utf-8'))
tags = (
    '1boy, solo, calm expression, gentle smile, looking down, simple background, '
    'volcanic eruption, molten lava, glowing crater, smoke, floating cards, '
    'from above, upper body, leaning forward, outstretched arm, open hand'
)
scene = (
    'Character 1 fills the upper-left foreground, his reaching hand nearer to the '
    'viewer at the center. His face remains readable beneath the hat brim; his torso '
    'continues through the lower-left crop. '
    'At the lower right, large charcoal-colored shapes enclose an oblique elliptical '
    'volcanic vent. Molten orange lava wells up inside its cracked dark rim. '
    'Three burning black spell cards fall from his fingers into the vent, adding '
    'heat and pressure. A broad wedge of incandescent lava bursts upward from the '
    'vent toward the upper-right, with one thick curved fiery plume and a dark smoke '
    'mass trailing behind it. The vent and plume read as a charging volcano in abstract '
    'color shapes. The blast lights the underside of his fingers and cheek and '
    'pulls his cloak along the diagonal flow. '
    'Plain deep ink-blue background, even flat color extending to all four canvas edges; '
    'the character, dark vent rim and eruptive plume belong to one continuous image.'
)
character = (
    'boy, elegant mysterious young man, refined youthful male features, pale skin, '
    'silver-grey long hair with two side locks falling to the waist, low bun at the '
    'back, short messy bangs under the hat, '
    'black wide-brim witch hat with deep purple inner lining, neat slender hat tip '
    'gently curving and drooping to the right, '
    'round thin metal frame eyeglasses, golden yellow eyes behind the lenses, pointy elf ears, '
    'black high-collar long coat with thin gold piping only along the front edges '
    'and cuffs, small gold buttons, solid plain black fabric, '
    'large cloak with purple inner lining, white feather ornament with a gold-set '
    'sapphire brooch on the left chest, black leather gloves'
)
# 所有画师/画风措辞从现行模块取，不再替换、缩写或叠加个人画风块。
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'female, child, old man, aged face, broad jaw, elongated chin, wrinkles, '
    'staff, wand, feathered hat, hat feather, magic circle, circular portal, '
    'energy ring, spiral vortex, crescent moon, white background, white border, '
    'paper background, inset illustration, detached torso, disembodied hand, '
    'contact sheet, character sheet, realistic landscape, mottled background, '
    'gradient background'
)
if not prompt.startswith(nai_style.ARTIST_BLOCK + '\n\n'):
    raise SystemExit('画师链与现行模块不一致，停止。')
if not prompt.endswith(nai_style.STYLE_BLOCK):
    raise SystemExit('画风尾与现行模块原文不一致，停止。')
request = {
    'status': '记忆核实后v5提示词已整理，尚未生成',
    'model': previous['model'], 'recipe_version': nai_style.RECIPE_VERSION,
    'width': previous['width'], 'height': previous['height'],
    'seed': None, 'parameters': previous['parameters'],
    'prompt': prompt, 'character_prompt': character, 'negative_prompt': uc,
    'style_source': 'tools/nai_style.py原文，经nai_prompt_clean构建；无额外画风块',
    'artist': nai_style.ARTIST_BLOCK,
    'style_block_sha256': hashlib.sha256(nai_style.STYLE_BLOCK.encode()).hexdigest(),
    'identity_source': {
        'current': 'docs/character-bible/changwuyu.md及ref-images/changwuyu.webp',
        'historical_text_only': '../.tmp/nai/output/card-pilot-hero3-20260923-020544/changwuyu-hero.payload.json',
        'note': '恢复清秀青年男性身份用词；不把历史构图/背景当现行，文本不能保证脸逐像素一致',
    },
    'memory_sources': [
        'C:/Users/太平/.zcode/cli/memories/projects/project-9f3e184c77472436/memory/nai-artist-style-verified.md',
        'C:/Users/太平/.zcode/cli/memories/projects/project-9f3e184c77472436/memory/nai-v5-prompt-pitfalls.md',
    ],
    'changes': {
        'face': '撤掉泛化的slender masculine face，不以拉长脸/宽下颌制造男性；恢复原稿青年男性、低发髻鬓发、圆镜黄瞳。',
        'volcano': '撤掉旋涡/两条同心弧/热点魔法环；暗色块面形成倾斜火山口，熔岩积压向右上喷出；保留三卡投入与已选对角线。',
        'style': '正式双画师链与现行STYLE_BLOCK逐字沿用，撤掉此前自加1.3画风加权及改写段。背景采用记忆里的纯色卡面口径。',
    },
    'installed': False,
}
(EVIDENCE / 'request-v5.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'prompt-v5.md').write_text(
    '# 充能火山 NAI V5 提示词\n\n'
    'Prompt:\n```text\n' + prompt + '\n```\n\n'
    'Character 1:\n```text\n' + character + '\n```\n\n'
    'UC:\n```text\n' + uc + '\n```\n', encoding='utf-8')
print('记忆已核实，v5提示词已整理；正式画师链与共享画风原文保留；未调用API。')
