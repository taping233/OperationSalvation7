import hashlib
import json
import sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, treasure chest, from above, three-quarter view, abstract background, 1.4::gouache painting, thick opaque brush strokes, painterly edges::'
scene = ('An old brass-bound wooden treasure chest fills the right-center, about one third of the image width, with a curved lid and a clearly visible front latch. '
    'Two elongated pale silver-blue strokes sweep from upper-left and lower-left toward the latch, revealing the chest out of a deep slate-blue painted obscurity. '
    'The strongest small ivory-gold accent sits where the strokes meet the latch; the surrounding background is muted cool blue-gray.')
paint = ('Lay down paint with a wide loaded flat brush: broad curved strokes wrap the chest lid, long oblique strokes explain its side, and blunt dabs turn the metal bands. '
    'Let warm brown underpainting show at a few broken stroke endings. Overlap broad ochre, umber and cool gray strokes to make the box feel solid. '
    'Use decisive hard-edged cast shadows with a few intermediate color turns, not outlined flat polygons. '
    'The searching marks have sharp light cores surrounded by long irregular blue-gray brush swipes. '
    'Keep brush direction readable and the large masses connected, with selective unfinished edges and quieter stretches between paint marks. '
    'Broad brushed color variation continues into the background. Focus the clearest painting on the latch and near lid edge.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('people, hands, map, playing cards, vector art, geometric diagram, flat outlined cube, uniform flat fill, thin ink outlines, fine wood grain, ornamental engraving, dense tiny facets, all-over noise filter, glossy 3d render, lens flare, scattered particles')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/treasure-hunt-brush-v2-20261011/treasure.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-treasure-hunt', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed,
    parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False,
    design='保留共享画师链/画风全文，移除少数平面/轮廓化措辞，强化宽笔覆盖与体积转折；两道寻宝笔势汇到箱锁。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed, model=request['model'],
    bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
