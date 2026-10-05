# -*- coding: utf-8 -*-
"""经典生命研究所通关演出三图（ending-1/2/3.webp），走全游戏统一画风配方。
免费档横版 1344x768；一轮一张 ≥50s；PNG→WEBP 落 game/assets/scenes/lab-ending/。
"""
import sys, time
from pathlib import Path

ROOT = Path(r'D:\素材\代号柒\搜打撤')
sys.path.insert(0, str(ROOT / 'tools'))
from nai_style import build_prompt, build_uc
from nai_gen import generate_image
from PIL import Image

OUT_DIR = ROOT / 'game' / 'assets' / 'scenes' / 'lab-ending'
UC = build_uc('1girl, 1boy, human, character, face, logo, ui elements')

JOBS = [
    ('ending-1',
     'A colossal infected leviathan dissolving into drifting motes of light inside a pillar of '
     'blinding white radiation, deep underground laboratory hall',
     'wide cinematic shot from a distance, shattered glass containment tanks, ruined lab machinery, '
     'pale emergency lighting cutting through floating dust, oppressive sci-fi horror atmosphere'),
    ('ending-2',
     'A small armored cargo drone flying away from a ruined laboratory complex, ascending through '
     'thick toxic green-brown pollution clouds toward a dim sky',
     'wide aerial cinematic shot, volumetric haze, industrial ruins below fading into fog, '
     'post-outbreak atmosphere, sense of departure and relief'),
    ('ending-3',
     'An ancient colossal sealed gate of dark metal and stone deep underground, pale bioluminescent '
     'infection veins spreading across its surface',
     'a lone ruined corridor leading toward the massive gate, faint light from unknown depth beyond '
     'the threshold, ominous ancient atmosphere, sci-fi horror'),
]

for i, (name, subject, scene) in enumerate(JOBS):
    if i:
        print(f'[wait] {50}s 间隔…', flush=True)
        time.sleep(50)
    prompt = build_prompt(subject, scene)
    png = OUT_DIR / f'{name}.png'
    out, seed = generate_image(prompt, UC, width=1344, height=768, out=str(png))
    webp = png.with_suffix('.webp')
    with Image.open(png) as im:
        im.save(webp, 'WEBP', quality=90)
    png.unlink()
    print(f'DONE {webp} seed={seed} {webp.stat().st_size} bytes', flush=True)
print('ALL DONE', flush=True)
