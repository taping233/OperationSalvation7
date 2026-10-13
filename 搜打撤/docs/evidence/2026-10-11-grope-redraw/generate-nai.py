import hashlib, json, sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
tags = 'no humans, lantern, floating object, playing cards, close-up, dutch angle, 1.4::gouache painting, thick opaque brush strokes, painterly edges::'
scene = ('A small old square lantern floats near the upper-left, its warm ivory window occupying only one tenth of the frame width. '
    'One broad dim amber search-light swathe stretches diagonally toward the lower-right through deep indigo-gray obscurity. '
    'Exactly two blank rectangular cards are partly uncovered near right-center: one angled ivory face and one muted ochre card behind it, both lower halves hidden by broad dark violet paint masses. '
    'The light reveals only their upper corners and a small strip of face; most of the image remains quiet darkness. '
    'There is no floor, room or landscape, only overlapping indigo, gray-violet and muted blue color masses.')
paint = ('Broad loaded brush swipes follow the search-light diagonal. The lantern frame is built with blunt charcoal and dull gray dabs, a single quiet warm window. '
    'Cards have broad matte ivory and ochre faces with angular violet shadows, no inset borders. '
    'Dark paint overlaps the card silhouettes to suggest tentative discovery. Keep sparse hard lit edges at the revealed corners. '
    'Use connected opaque masses, broad directional overlaps and uneven endings, with restrained middle tones rather than smooth luminous gradients.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('people, hands, faces, rocks, room, scenery, extra lanterns, extra cards, card symbols, card text, ornate metalwork, fine linework, vector art, glossy 3d render, all-over grain, particles, bright full-frame glow')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/grope-redraw-20261011/grope.png'
if output.exists(): raise SystemExit('Output exists; stop')
request = dict(card_id='tt3-grope', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed, parameters=DEFAULTS,
    prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False, design='微光探路意象；小提灯光带揭开两张卡边角，深靛灰紫抽象暗场，无人物岩石。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed = generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
