import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, spear, armor, broken armor, close-up, foreshortening, dutch angle, motion blur, simple background'
scene = (
    'The camera is just beyond the exit side of a single thick charcoal armor plate, looking diagonally along the axis of a spear at the instant of penetration. '
    'One broad steel spearhead bursts toward the viewer from a tight jagged opening slightly left of center. '
    'Its continuous central ridge and two large clean blade planes run from the dark shaft in the upper-left distance to a sharp point in the lower-right foreground. '
    'The point remains entirely inside the square frame, and the spearhead occupies almost half the image diagonal. '
    'The armor plate curves across the lower-left half of the frame, with two large torn metal lips bent outward at the puncture. '
    'A few distinct heavy fragments rotate away to the upper-right; leave clear gaps between fragments so the central weapon silhouette reads immediately. '
    'A short crimson tassel tied behind the blade is pulled backward toward the upper-left, opposing the forward thrust. '
    'Concentrate a narrow dark-crimson mark at the puncture rim as an abstract sign of a fatal wound, with no visible body or gore. '
    'A single broad pale diagonal wedge behind the spear separates the blade from an otherwise dark warm-charcoal and gray-blue abstract background. '
    'Directional light catches one blade plane and the newly torn metal edges; the reverse blade plane and plate interior stay dark. '
    'The tip, the torn opening and the backward red tassel form the clear hierarchy. '
    'Keep the image a close material study of piercing force, not a battle scene. No warrior, hands, face, landscape or architecture.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, girl, boy, hands, face, body, gore, organs, blood spray, multiple spears, sword, ornate weapon, flame, sparks, particle cloud, detailed scenery, text, watermark, frame, collage')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/fatal-pierce-20261010/fatal-pierce.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-fatal-pierce', model='nai-diffusion-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='沿枪轴看向穿透点；枪尖迎面突出、甲片外翻、红缨逆向甩开；深灰与灰蓝抽象背景加一块浅色斜面。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
