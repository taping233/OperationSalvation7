"""圣光之源分镜返修：去掉洗手/飘带感，离线构建，不调用API。"""
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_prompt_clean import build_asset_prompt, build_uc
import nai_style

EVIDENCE = Path(__file__).resolve().parent
previous = json.loads((EVIDENCE / 'nai-request.json').read_text(encoding='utf-8'))
tags = (
    '1girl, solo, calm expression, closed mouth, looking down, '
    'from below, cowboy shot, standing, outstretched arm, open hand, '
    'light, magic, simple background'
)
scene = (
    'Character 1 stands in a turning three-quarter pose, her body following '
    'a gentle curve from the supporting hip through the shoulders to the head. '
    'Her calm face remains clearly visible near the upper-left third, looking '
    'toward the opening light. One nearer hand turns palm upward at waist height, '
    'while the other hand reaches a little higher and farther away. '
    'She is gently opening a broad layer of dawn-like holy light between those '
    'two hands, as though revealing light concealed inside the quiet space. '
    'The nearer palm supports the lower luminous edge; the farther fingertips '
    'draw the upper edge outward. The light unfolds into one wide ivory plane '
    'with a warm glowing seam, filling the lower-right foreground before curling '
    'softly behind her upper body. Its edge is open and irregular, with broad '
    'painted shapes rather than a narrow ribbon. '
    'Her cape moves in the opposite direction to the unfolding light, framing '
    'the shoulder and connected torso. The low braid falls along the quieter '
    'side of the figure, leaving face and hands clear. '
    'Keep the hands proportional to the face instead of enlarging them into '
    'the dominant subject. The view includes the connected waist and hips, '
    'with the long dress continuing through the bottom crop. '
    'The light reveals gentle illumination on her fingertips, cheek and white '
    'sleeve; connected darker cape planes support the pale luminous shape. '
    'Background color and value follow the light-opening design: quiet abstract '
    'planes separate the golden hair, white dress, teal cape and ivory light, '
    'with calm space around her face. The scene reads as the source of holy '
    'replenishment opening into the world.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'boy, purple eyes, black priestess dress, purple cape, bright yellow hair, '
    'orange hair, silver hair, angry expression, smirk, blushing, '
    'kneeling, washing hands, interlocked fingers, bottle, cup, basin, '
    'lantern, staff, orb, sword, literal cards, book, fabric ribbon, narrow light ribbon, '
    'angel wings, church interior, waterfall, stars, many particles, laser beam, '
    'extra hands, oversized hands, detached torso, white border, contact sheet'
)
request = {
    **previous, 'status': 'v2分镜与提示词已更新，尚未生成',
    'prompt': prompt, 'negative_prompt': uc, 'seed': None,
    'recipe_version': nai_style.RECIPE_VERSION,
    'design': '侧身站姿舒展转腰，前掌托光、后手牵开一大片晨曦般圣光；低机位大腿上段，脸与光面主次明确，披风逆向展开。',
    'changes': [
        '姿态：撤掉侧跪前倾/并掌接水，改为侧身站姿与高低错开的展开动作。',
        '镜头：撤掉close-up和foreshortening；from below + cowboy shot，手比例自然，腰胯连接完整。',
        '圣光：撤掉flowing fabric/水流绸带，改为宽晨光面被揭开，背景随光面设计。',
    ],
    'preserved': ['光牧星月角色栏全文', '正式双画师链和共享画风原文', 'V5 Full模型与尺寸参数'],
    'output': str(PROJECT.parent / '.tmp/nai/output/holy-source-20261010/holy-source-v2.png'),
    'installed': False,
}
(EVIDENCE / 'nai-request-v2.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'prompt-v2.md').write_text(
    '# 圣光之源 · 展开晨曦\n\n' + request['design'] + '\n\n'
    'Prompt:\n```text\n' + prompt + '\n```\n\n'
    'Character 1:\n```text\n' + request['character_prompt'] + '\n```\n\n'
    'UC:\n```text\n' + uc + '\n```\n', encoding='utf-8')
print('圣光之源v2提示词已重写，未调用API。')
