# -*- coding: utf-8 -*-
"""UI 美术大修循环 09-25 第二批生图（C 组接线用）：免费档，50s 间隔。"""
import sys, time
from pathlib import Path

ROOT = Path(r'D:\素材\代号柒\搜打撤')
sys.path.insert(0, str(ROOT / 'tools'))
from nai_style import build_prompt, build_uc
from nai_gen import generate_image

OUT = Path(r'D:\素材\代号柒\.ui-art-loop-0925\nai-out')
UC = build_uc('1girl, 1boy, human, character, face, text, watermark, border, frame')

JOBS = [
    ('expedition-banner', 1344, 768,
     'a ruined winter frontier district seen from a ridge: collapsed tram lines, snow buried streets, distant watchfires',
     'wide painterly banner background, cold teal dusk palette with warm ember accents, heavy vignette on all edges, '
     'center-left kept clear for overlaid UI text, no characters'),
    ('expedition-map-bg', 1344, 768,
     'aerial view of a ruined snowbound city district at night, blocks of dark rooftops and cracked avenues',
     'painterly tactical map background, muted contrast in midtones so map nodes stay readable, faint blue haze, '
     'no characters, no text, no markers'),
    ('rewards-convoy-success', 1344, 768,
     'a small armored convoy truck driving home through snow fields at golden hour, headlight beams in cold air',
     'wide cinematic background, warm golden light against blue shadows, hopeful mood, no characters, '
     'top edge kept dark for overlaid UI'),
    ('rewards-convoy-fail', 1344, 768,
     'a stalled armored convoy truck half buried in drifting snow under a darkening storm sky',
     'wide cinematic background, desaturated blue-grey palette, wind-blown snow streaks, somber mood, no characters, '
     'top edge kept dark for overlaid UI'),
    ('pet-egg', 1024, 1024,
     'a single speckled creature egg resting on a nest of wool scarf fabric, faint warm glow from inside the shell',
     'centered object portrait on dark slate background, soft rim light, cozy mysterious mood, no text'),
    ('profession-emblem-wu', 1024, 1024,
     'a minimal heraldic emblem of a downward-pointing empty circle wreathed in pale blue ribbon',
     'flat emblem design, brushed painterly texture, centered on dark slate shield, subtle gold trim, no text'),
    ('profession-emblem-dwu', 1024, 1024,
     'a minimal heraldic emblem of a witch hat with a small star spark above its brim',
     'flat emblem design, brushed painterly texture, centered on dark slate shield, subtle gold trim, no text'),
    ('profession-emblem-baita', 1024, 1024,
     'a minimal heraldic emblem of a slender white watchtower with a lit window',
     'flat emblem design, brushed painterly texture, centered on dark slate shield, subtle gold trim, no text'),
    ('profession-emblem-heixiang', 1024, 1024,
     'a minimal heraldic emblem of a massive greatsword point-down behind a small visor silhouette',
     'flat emblem design, brushed painterly texture, centered on dark slate shield, subtle gold trim, no text'),
    ('profession-emblem-xingyue', 1024, 1024,
     'a minimal heraldic emblem of a crescent moon holding a small star in its curve',
     'flat emblem design, brushed painterly texture, centered on dark slate shield, subtle gold trim, no text'),
]

for i, (name, w, h, subject, scene) in enumerate(JOBS):
    if i:
        print('[wait] 50s…', flush=True)
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
