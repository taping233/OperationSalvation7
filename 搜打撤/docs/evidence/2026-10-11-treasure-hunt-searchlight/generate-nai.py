import hashlib
import json
import sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, treasure chest, closed chest, from above, dutch angle, abstract background, limited palette, rough painting, broad brush strokes, matte surface, hard shadows'
scene = ('A small ochre treasure chest is being revealed at right-center, about one quarter of the image width. '
    'Two long narrow pale blue search strokes enter from the lower-left and upper-left edges and converge at the chest latch. '
    'The dark slate-blue veil covering the chest splits at their meeting point and sweeps away as two broad angular paint masses. '
    'Only the near corner and front of the chest emerge; its back disappears into the dark shape. '
    'Keep large quiet blue-gray negative space above and below the diagonal strokes. '
    'The tiny pale-gold latch against dark blue is the single sharp focal accent.')
paint = ('Build every object with two or three connected opaque matte color planes. '
    'Use long confident flat-brush swipes following the search direction and broad blunt dabs on the box. '
    'Paint edges and grouped hard shadows define forms; interiors stay calm. '
    'The chest is a rough ochre silhouette with dark brown shadow and one muted gray metal band, no planks or ornaments. '
    'Search strokes are sharp tapering painted wedges with broken outer brush edges, no soft glow. '
    'Background is a quiet muted blue-gray color field crossed by the broad dark veil. '
    'Avoid dense marks; this is economical painted shape design, not textured realistic rendering.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('person, hands, face, map, card, book, paper, coins, gems, ornate chest, wood grain, metal engraving, photorealistic materials, fine linework, dense hatching, tiny facets, scratches, granular noise, glossy rendering, smooth gradients, bloom, lens flare, particles, scenery')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/treasure-hunt-searchlight-20261011/treasure.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-treasure-hunt', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed,
    parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False,
    design='追斩/初始攻击画法：两道长笔寻宝光划开深灰遮蔽，在右中汇到小金箱锁扣；冷蓝灰大面，焦点集中。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed, model=request['model'],
    bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
