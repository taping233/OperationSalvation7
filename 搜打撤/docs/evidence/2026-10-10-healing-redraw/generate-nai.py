import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, potion, glass bottle, water drop, light, simple background'
scene = (
    'A single small clear glass healing-potion bottle stands upright near the center of a square illustration. '
    'The bottle has a short narrow neck, a plain stopper and one gently rounded body, occupying about half the image height. '
    'Inside it, one large luminous cyan teardrop floats just above a shallow pool of pale blue liquid. '
    'Keep the drop silhouette unmistakable and the glass described by only two broad pale reflection planes. '
    'One soft warm ivory halo behind the bottle suggests restoration; leave generous quiet space around it. '
    'Solid muted warm gray-beige background, concentrated cyan accent and a small warm highlight. '
    'No hands, people, labels, lettering, decorative filigree, particles, landscape or extra objects.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, hands, multiple bottles, ornate bottle, label, text, cross symbol, wings, particles, sparks, detailed scenery, photorealistic glass, frame, watermark')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/healing-20261010/healing.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-holy-water', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='一只小药瓶，瓶内一滴青蓝光与浅液面，瓶后少量暖光晕；暖灰底大量留白。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
