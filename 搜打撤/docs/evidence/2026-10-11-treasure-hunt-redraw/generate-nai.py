import hashlib
import json
import sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, from above, close-up, torn map, floating playing card, abstract background, rough painting, thick brush strokes, opaque paint, limited palette, hard shadows'
scene = ('One dark weathered folded map cuts diagonally across the lower two thirds of the image. '
    'Its central fold splits open into a deep indigo slit; one single golden rectangular card rises from this slit toward the upper-right. '
    'The card overlaps the torn map edges and occupies one quarter of the frame width. '
    'Only two primary shapes: the broad folded map and the golden card. '
    'Background consists of quiet slate teal and deep indigo color masses. '
    'Keep the map blank except for one short broken ochre path ending at the opening.')
paint = ('Paint the map as three broad opaque gray-brown fold planes, with blunt irregular edges and no paper grain. '
    'The card is one matte ochre plane with a small pale-yellow edge, not a glowing glass panel. '
    'Use a few very wide directional brush swipes, each stroke spanning a substantial part of an object. '
    'Hard shadow shapes explain the folds; large interior surfaces remain quiet. '
    'Keep the sharpest light-dark edge at the emerging card and slit. No tiny contour lines, intricate patterns or scattered marks.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('person, face, hands, arms, magnifying glass, compass, treasure chest, coins, jewels, lettering, card symbols, ornate border, detailed map, fine linework, dense hatching, paper texture, tiny brush strokes, granular noise, polished illustration, glossy highlights, bloom, particles, scenery')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/treasure-hunt-redraw-20261011/treasure.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-treasure-hunt', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed,
    parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False,
    design='俯视裂开的折叠地图，一张金色卡从中央裂口浮起；青灰深靛背景，宽笔硬边明暗、两个主形。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed, model=request['model'],
    bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
