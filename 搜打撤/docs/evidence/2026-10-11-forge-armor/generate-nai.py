import hashlib, json, sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
tags = 'no humans, forging, hammer, armor, anvil, close-up, from side, dutch angle, 1.4::gouache painting, thick opaque brush strokes, painterly edges::'
scene = ('A cropped heavy square hammer head descends from upper-left and touches a heated curved steel breastplate at the center. '
    'The handle exits the left edge. The breastplate fills the lower-right and continues beyond the frame, resting on a dark anvil whose top is cropped along the bottom. '
    'At contact, a short orange-white hot edge is being pressed smooth into the armor curve, with only two short ochre sparks. '
    'The plate is intact and being shaped, not shattered. Background is deep blue-gray with a broad muted rust-red sweep behind the contact.')
paint = ('Wide loaded flat-brush strokes follow the hammer descent and curved plate. '
    'Broad cool steel-gray strokes overlap warm umber underpainting, blunt dabs define the hammer planes, one broad hard shadow turns the armor. '
    'Keep the strongest small ivory-orange light at the hammer contact; sparse cream highlights elsewhere. '
    'Leave calm stretches of painted metal between broad directional strokes and retain uneven opaque endings. No etched detail or repeated tiny facets.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('people, hands, faces, broken armor, shattered metal, cracks, scattered fragments, ornate armor, engraving, fine scratches, vector art, thin outlines, tiny facets, glossy 3d render, noise filter, flames, many sparks, workshop scenery')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/forge-armor-20261011/armor.png'
if output.exists(): raise SystemExit('Output exists; stop')
request = dict(card_id='tt2-turtlearmor', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed, parameters=DEFAULTS,
    prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False, design='无人物锻甲特写，锤落热甲压合成形；接触点集中最亮，深蓝灰赭红背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed = generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
