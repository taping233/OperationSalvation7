import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = '1girl, solo, standing, upper body, three-quarter view, raised arm, open hands, moon, full moon, calm expression, closed mouth, simple background, gradient background'
scene = (
    'The character stands on the right side of a square frame, seen from head to hips in a gentle three-quarter turn toward the left. '
    'One large complete circular moon disk floats to her left at upper-chest height, separate from her body and never covering her face. '
    'Her farther arm rises with an open palm hovering just above the moon upper rim; her nearer hand turns palm upward immediately beneath the lower rim. '
    'The high and low palms gather soft moonlight into the complete disk, with hands naturally proportional to her face. '
    'The disk occupies about one third of the frame width and is a quiet cool pale ivory shape, with one faint broad gray plane, no craters, ornament or intense flare. '
    'Her face sits in the upper-right third, looking calmly toward the moon, both eyes and cheek silhouette clear. '
    'The low braid descends along the quiet right edge, and one broad cape fold sweeps backward, balancing the rounded moon. '
    'Her shoulders, bent elbows, torso and waist are connected and readable. '
    'The white long dress continues through the bottom crop. '
    'The entire background is a simple dark desaturated indigo-to-gray-violet color gradient, darker at upper-left and slightly lighter toward lower-right. '
    'Keep the background abstract, colored and quiet, never white. '
    'Moonlight gently reflects on the fingertips, pale hair, cheek and white sleeves. '
    'Only character, complete moon disk and color backdrop; no curtains, stars, buildings, landscape, particle clouds or extra props.'
)
character = ('girl, young adult priestess, delicate composed face, warm golden eyes, very pale low-saturation golden long hair, '
    'dense straight bangs, smooth rounded crown, two long straight cheek sidelocks, one thick long low side braid, '
    'white crescent moon hairpin above bangs on viewer-right, white high-collared priestess long dress, restrained gold collar and small four-point star clasp, '
    'deep forest-teal short cape with sparse gold edging, dark wrist guards leaving fingers exposed')
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('white background, empty white backdrop, black priestess dress, purple cape, purple eyes, bright yellow hair, orange hair, fluffy hair, extra arms, extra hands, many moons, crescent moon disk, halo around head, curtains, stars, particles, landscape, staff, book, text, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/fullmoon-redo-20261010/fullmoon.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-nature-form', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt=character, negative_prompt=uc,
    output=str(output), installed=False, design='星月侧身双掌聚成左侧完整月轮；右上脸/左月/高低双手，深靛蓝到灰紫纯色渐变背景。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, char_prompt=character, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
