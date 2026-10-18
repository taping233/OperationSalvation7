import hashlib
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
project = here.parents[3]
sys.path.insert(0, str(project / 'tools'))
from nai_gen import DEFAULTS, MODEL, generate_image
from nai_prompt_clean import build_asset_prompt, build_uc

prompt = build_asset_prompt(
    'No humans. Front-facing close-up of two broad overlapping smoky blue-gray glass shutters in a winter expedition terminal. The shutters fill the whole image. Large matte charcoal metal planes frame the left and right outer edges. A single restrained diagonal join descends near the centre. A few broad hand-painted frosted ice planes cling to the upper-left and lower-right corners. One understated mechanical calibration disc is partially visible in the right outer third, formed from three large dark concentric planes and one short dull gold notch. Very sparse details, no tiny bolts or repeated markings.',
    purpose_layer='Production artwork for a full-screen settings page transition in a painterly anime game. An opaque clean shutter texture that code will split into left and right halves and animate. No interface or typography baked into the painting.',
    composition_layer='Wide landscape 16:9, flat front view, no perspective tilt. Two complete large shutter planes cover every pixel, no holes, no scene visible through them. Middle third is quiet dark glass with a simple diagonal seam. Frost and calibration objects stay at the outside edges. Three or four large angular light and shadow masses, no busy decoration.',
    light_material_layer='Charcoal black, desaturated deep navy, cold gray-blue glass, a few paper-white frost brush marks and one small muted champagne-gold accent. Broad opaque painted color blocks, hard-edged shadows, low detail density, visible economical dry brush strokes. Restrained reflected winter light only along a few edges. Dark overall exposure, no bright central glow, no neon, no lens flare, no photorealistic materials.',
)
negative = build_uc('human, person, girl, character, face, text, letters, numbers, logo, watermark, interface, buttons, icons, gears everywhere, many gears, intricate circuit lines, detailed machinery, tiny bolts, repeated markings, holes, transparency, checkerboard, bright centre, vivid neon, glowing rings, lens flare, photorealism, glossy 3d render, collage, sprite sheet')
request = {'channel': 'NovelAI draft then built-in imagegen finish', 'model': MODEL, 'parameters': DEFAULTS, 'width': 1344, 'height': 768, 'seed': 101121438, 'prompt': prompt, 'negativePrompt': negative, 'briefZh': '设置转场：正视双幅深色玻璃闸片、宽面金属、边角概括冰霜、右外侧暗色校准圆盘；冷蓝灰与一点暖金，无人物文字。'}
(here / 'novelai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
output = here / 'settings-nai-v1.png'
saved, seed = generate_image(prompt, negative, '', width=1344, height=768, seed=request['seed'], out=str(output))
receipt = {'source': str(output.relative_to(project)), 'seed': seed, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'acquisition': 'Existing tools/nai_gen.py; no credentials recorded'}
(here / 'novelai-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Settings transition NAI draft saved; no credentials recorded')
