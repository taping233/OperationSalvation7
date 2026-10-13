import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = '1girl, solo, upper body, three-quarter view, looking at viewer, calm expression, closed mouth, raised hand, open hand, shadow, magic, simple background'
scene = (
    'The character is shown from head to waist in a square frame, placed left of center, shoulders turned gently to the right while her calm face looks back toward the viewer. '
    'Her nearer gloved hand rises just in front of her right shoulder, palm open facing outward, fingers naturally separated. '
    'A single larger purple-black spectral claw opens beyond this palm in the right half, like the outward extension of her restrained gesture. '
    'The spectral hand is one connected dark silhouette with three large curved pointed finger shapes, partly cropped at the right edge, not a second person. '
    'A narrow violet rim separates the dark claw from the quiet backdrop. '
    'Her other gloved hand rests quietly at her waist beneath the cape, with no additional gesture. '
    'The face, open palm and spectral silhouette form a clear triangular arrangement; leave calm space around the hair and eyes. '
    'A tiny muted crimson glint sits at the transition from glove to shadow, never crossing the face. '
    'Her low side braid falls on the left quiet side, her purple cape sweeps back in one broad plane. '
    'Connected shoulders, chest and waist remain readable beneath the high-collared dark priestess clothes. '
    'Background is quiet deep gray-violet and charcoal abstract planes, without red streak networks, scenery, symbols or particle clouds.'
)
character = (
    'girl, young adult priestess, composed delicate face, violet eyes, very pale low-saturation light golden hair, '
    'straight dense bangs, rounded smooth crown, long straight cheek sidelocks, one thick low side braid, '
    'dark indigo crescent hair ornament above bangs, black-gray high-collared priestess dress, muted purple short cape with sparse gold edging, black gloves'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('full body, legs, feet, angry expression, evil grin, bright yellow hair, orange hair, fluffy hair, side-swept bangs, white priestess clothes, green cape, extra arms, extra human hands, multiple characters, wings, horns on girl, many claws, laser, red streaks, particles, ornate background, text, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/demon-half-20261010/demon-half.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='cc-demon', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt=character, negative_prompt=uc,
    output=str(output), installed=False, design='腰以上侧身暗牧星月：肩前抬掌，掌外单只紫黑影爪；脸/掌/爪三角主次，低辫与披肩大面，安静深灰紫背景。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, char_prompt=character, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
