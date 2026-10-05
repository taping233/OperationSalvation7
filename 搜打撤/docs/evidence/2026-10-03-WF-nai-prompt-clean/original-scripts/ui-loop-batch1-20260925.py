# -*- coding: utf-8 -*-
"""UI 美术大修循环 09-25 第一批生图（中心调度）：免费档，50s 间隔。
产物落 .ui-art-loop-0925/nai-out/（PNG），由各实施子代理负责接线与转 webp。
"""
import sys, time
from pathlib import Path

ROOT = Path(r'D:\素材\代号柒\搜打撤')
sys.path.insert(0, str(ROOT / 'tools'))
from nai_style import build_prompt, build_uc
from nai_gen import generate_image

OUT = Path(r'D:\素材\代号柒\.ui-art-loop-0925\nai-out')
OUT.mkdir(parents=True, exist_ok=True)
UC = build_uc('1girl, 1boy, human, character, face, text, watermark, border, frame')

JOBS = [
    # name, subject, scene, w, h
    ('home-icon-camera', 1024, 1024,
     'an antique twin-lens field camera with frost and brass fittings, evergreen sprig tucked in its strap',
     'centered circular badge composition on a dark slate background, soft warm lantern glow from the side, '
     'cozy winter study mood, object portrait, no text'),
    ('home-icon-shield', 1024, 1024,
     'a black obsidian heater shield with a silver wreath crest, a small holly flame burning at its center',
     'centered circular badge composition on a dark slate background, cold moonlight rim light with warm ember glow, '
     'object portrait, no text'),
    ('home-icon-gear', 1024, 1024,
     'a heavy brass clockwork gear with snowflake engravings and a pale blue gemstone bearing',
     'centered circular badge composition on a dark slate background, soft blue-grey winter light, fine metal texture, '
     'object portrait, no text'),
    ('mail-empty', 832, 1216,
     'an old green iron mailbox half buried in snow outside a snowed-in post office, one empty envelope leaning inside',
     'quiet vertical illustration, falling snow, soft window light, gentle melancholic winter mood, '
     'generous empty space at top and bottom for overlaying UI text, no text'),
    ('boss-arena', 1344, 768,
     'a grand research-institute front hall turned war room: fractured reinforced glass, looming dark machinery arches',
     'wide cinematic background, cold cyan skylight shafts from above, ceremonial gold trim accents on pillars, '
     'empty of characters, center kept clear for combat UI, ominous stillness'),
    ('cls2-stage', 1344, 768,
     'a winter arsenal hall interior with an empty center stage, weapon racks faded into shadow at the sides',
     'wide background, cold skylight beams falling on the empty stage floor, faint snow drifting through the light, '
     'no characters, soft vignette edges, quiet ceremonial mood'),
    ('prep-desk', 1344, 768,
     'a campaign commander desk seen from above: an unfolded expedition map, checklists, a brass compass, cedar wood grain',
     'top-down flat lay background, warm candlelight from one corner, deep shadows at edges, no characters, no text'),
]

for i, (name, w, h, subject, scene) in enumerate(JOBS):
    if i:
        print(f'[wait] 50s…', flush=True)
        time.sleep(50)
    prompt = build_prompt(subject, scene)
    try:
        out, seed = generate_image(prompt, UC, width=w, height=h, out=str(OUT / f'{name}.png'))
        print(f'DONE {name} seed={seed}', flush=True)
    except SystemExit as e:
        print(f'STOP {name}: {e}', flush=True)
        break
    except Exception as e:
        print(f'ERR {name}: {type(e).__name__} {e}', flush=True)
        time.sleep(20)
print('ALL DONE', flush=True)
