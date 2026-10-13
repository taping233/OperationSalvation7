import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

prompt = build_asset_prompt('no humans, arrow, arrowhead, sound waves, simple background', composition_layer=(
    'One slender silver arrow travels diagonally from lower left to upper right. '
    'A small pointed head, straight dark shaft and two grouped blue-gray feather vanes form one unmistakable arrow. '
    'Exactly two pale blue curved echo arcs expand behind its midpoint, one smaller and sharper, one larger and fainter. '
    'The arcs are broad interrupted painted crescents, never complete circles, symbols or extra arrows. '
    'They suggest a sound returning through quiet air. Keep the arrow silhouette clear and the two echo arcs subordinate. '
    'Solid muted deep slate-blue background, generous empty space, restrained ivory highlights and a small cool-blue accent. '
    'No target, landscape, hands, music notes, particles, explosion or decorative objects.'))
uc = build_uc('people, hands, multiple arrows, bow, target, leaves, flowers, music notes, text, particles, ornate weapon, detailed scenery, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/echo-arrow-20261010/echo-arrow.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt2-forestarrow', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='一支银箭掠过深灰蓝底，身后两道由实转淡的回声弧线；少元素、留白。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
