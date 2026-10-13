"""按动作/分镜反馈给三条完整方案，离线构建，未调用API。"""
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
base = json.loads((EVIDENCE / 'request-v6-sent.json').read_text(encoding='utf-8'))
background = (
    'Plain light warm-gray background fills the canvas. '
    'One dominant orange lava shape contrasts with the connected dark figure; '
    'the background stays quiet and the dark fabric remains distinct from the energy.'
)
plans = [
    {
        'id': 'A', 'title': '撕开一座火山',
        '中文分镜': '高机位贴近双手；常无欲的脸在左上，正在撕开的黑卡占前景下右。纸张裂口内部是一座倾斜火山口，熔岩沿撕裂方向喷出；左右手一拉一收形成张力，脸与裂口之间留灰底。捕捉纸面刚被撕开、内部积压热量突然释放的一瞬间。',
        'tags': '1boy, solo, calm expression, slight smile, looking down, simple background, fire, molten lava, playing card, from above, close-up, leaning forward, hands up',
        'scene': (
            'Character 1 is seen close above his hands, with his face at the upper left. '
            'He is tearing one black spell card diagonally between his hands; one hand '
            'draws backward while the other pulls toward the viewer. The torn card '
            'dominates the lower-right foreground. Its split opens into a slanted '
            'charcoal volcanic crater filled with molten orange lava. A broad fiery '
            'plume bursts through the fresh tear and follows the pulling direction. '
            'The surviving black paper edges curl away from the pressure. His eyes '
            'follow the tearing point, calmly controlling the release. '
            'The foreground hands overlap the chest, with the face clear beyond them. '
        ),
    },
    {
        'id': 'B', 'title': '把喷发压在掌下',
        '中文分镜': '低机位从火山口旁仰望；巨大黑手套在前景压住悬浮裂口，脸在后方上左。人物俯身施力、肩线倾斜，熔岩从指掌没有盖住的裂隙侧向喷出，披风向反方向扬起。重心落在压制动作与火焰反冲，表现充能而非普通释放。',
        'tags': '1boy, solo, focused expression, looking down, simple background, fire, molten lava, smoke, from below, cowboy shot, leaning forward, outstretched arm, open hand',
        'scene': (
            'The viewer looks upward past the edge of a floating volcanic vent. '
            'Character 1 leans down behind it, his face visible at the upper left. '
            'His nearer palm presses across the rim of the vent, filling the center '
            'foreground. Molten light builds beneath that palm. A wide orange jet '
            'forces its way sideways through the uncovered gap between palm and rim, '
            'while the opposite side stays dark and compressed. His far hand steadies '
            'the underside of the floating dark rim. His shoulders angle into the '
            'pressure, and the recoil wind sends the cloak away from the erupting jet. '
            'One burning spell-card remnant is caught inside the molten vent. '
            'The close glove, middle vent and more distant face form clear depth layers. '
        ),
    },
    {
        'id': 'C', 'title': '披风里藏着喷发',
        '中文分镜': '从背后侧方截取转身瞬间，常无欲回头露出脸；一手扬开披风，使黑紫布面成为大斜线。披风内的阴影裂出火山口，熔岩朝披风扬开的方向斜向喷涌；另一手把正在燃烧的卡片送进裂口。构图用深色披风包住火焰，再以灰底留白托住脸，形成藏与露的反差。',
        'tags': '1boy, solo, slight smile, looking back, simple background, fire, molten lava, smoke, floating card, from behind, cowboy shot, arm up',
        'scene': (
            'Character 1 is caught midway through a turn, seen from behind with his '
            'face looking back over his shoulder. He sweeps one side of his cloak '
            'upward, exposing a dark magical fissure immediately within its shadow. '
            'The fissure opens like a tilted volcanic mouth, its cracked charcoal '
            'rim containing bright orange molten lava. The sweeping cloak forms '
            'a strong dark diagonal around the eruption. A broad lava plume escapes '
            'along that diagonal, revealing the stored pressure hidden beneath the '
            'fabric. His other hand feeds one burning black spell card into the '
            'mouth of the fissure. His body remains continuous through the lower '
            'crop, while the folded cloak frames rather than hides his visible face. '
        ),
    },
]
for plan in plans:
    plan['prompt'] = build_asset_prompt(plan.pop('tags'), composition_layer=plan.pop('scene') + background)
    plan['character_prompt'] = base['character_prompt']
    plan['negative_prompt'] = build_uc(
        'female, child, old man, broad jaw, elongated chin, staff, wand, feathered hat, '
        'white background, white border, inset illustration, detached torso, '
        'disembodied hand, character sheet, contact sheet, magic circle, circular portal, '
        'blue background, realistic landscape'
    )
request = {
    'status': '三个新动作/分镜方案已写，未生成',
    'model': base['model'], 'width': base['width'], 'height': base['height'],
    'parameters': base['parameters'], 'seed': None,
    'preserved': '常无欲青年男性人设、正式画师链/共享画风原文、浅暖灰底',
    'changed': '放开旧C伸手构图，分别以撕开/压制/揭开为主要动作，火山参与交互',
    'plans': plans,
}
(EVIDENCE / 'storyboards-v7.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
parts = ['# 充能火山：动作与分镜重设计\n', '保留人设、正式画风与浅暖灰底；本轮未调用API。\n']
for plan in plans:
    parts.append('## ' + plan['id'] + ' ' + plan['title'] + '\n\n' + plan['中文分镜'] + '\n')
    for label, key in [('Prompt', 'prompt'), ('Character 1', 'character_prompt'), ('UC', 'negative_prompt')]:
        parts.append(label + ':\n```text\n' + plan[key] + '\n```\n')
(EVIDENCE / 'storyboards-v7.md').write_text('\n'.join(parts), encoding='utf-8')
print('三条分镜与完整NAI提示词已整理，未调用API。')
