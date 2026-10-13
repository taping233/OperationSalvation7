import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = '1girl, solo, upper body, from below, standing, raised arm, outstretched arm, looking at viewer, calm expression, closed mouth, full moon, simple background'
scene = (
    'The priestess fills the lower-right half of the square, her torso turning diagonally upward to the left. '
    'One arm rises above her head with relaxed fingertips tracing the lower-right edge of a flat full moon behind her; the other arm reaches across the lower foreground with an open palm. '
    'The complete ivory moon disk sits in the upper-left, about two fifths of the frame width, BEHIND both hands and shoulders, never held between her palms. '
    'Her calm face is clear near the right-center, framed by the raised white sleeve and deep teal cape. '
    'The cape and low braid sweep toward lower right, reinforcing the upward gesture. '
    'Use three primary masses: quiet deep indigo-gray backdrop, flat ivory moon, connected white-and-teal figure. '
    'The disk has no spherical shading or crater detail. '
    'Background is a solid dark indigo-gray with one subtle muted violet color transition; no white background or scenery. '
    'Paint the large sleeve, cape and hair as broad quiet planes, keep only face and gesture selectively clear.'
)
character = 'girl, priestess, pale blonde hair, straight bangs, cheek sidelocks, low side braid, golden eyes, white crescent hair ornament, white high collar dress, dark teal cape, gold trim, dark wrist guards, bare fingers'
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('green eyes, purple eyes, silver hair, blue hair, side-swept bangs, bare shoulders, missing cape, purple cape, white background, holding ball, sphere, globe, craters, stars, particles, ornate clothes, fine hair strands, dense wrinkles, extra arms, extra hands, text, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/fullmoon-smite-20261010/fullmoon.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-nature-form', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt=character, negative_prompt=uc,
    output=str(output), installed=False, design='抬手引出身后平面满月，另一掌横伸前景，人物/袖/披肩沿上升斜线组织；深靛灰背景，惩击宽笔块面为内置重绘基准。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, char_prompt=character, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
