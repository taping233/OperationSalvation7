import hashlib, json, sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
tags = 'no humans, spear, metal plate, close-up, foreshortening, dutch angle, 1.4::gouache painting, thick opaque brush strokes, painterly edges::'
scene = ('A single broad steel spearhead has just punched THROUGH one dark curved armor plate. '
    'The torn exit sits just right of center; the spearhead projects toward the lower-left foreground with its tip near the lower-left edge. '
    'Its narrower neck passes back through the dark opening and is hidden behind the plate. No handle is visible. '
    'The plate fills the upper-right and extends beyond top and right edges; three broad bent metal lips curl outward around the hole. '
    'Sharp pale steel at the exit contrasts with the dark inner opening. Background is quiet blue-gray with a muted gray-ochre diagonal brush mass.')
paint = ('Broad loaded flat-brush swipes run along the spearhead; one wide ivory-gray highlight follows its ridge. '
    'The plate uses charcoal-blue curved strokes and a broad cool shadow; blunt steel-gray dabs explain the bent lips. '
    'Keep the strongest small light-dark edges at the exit, not across the full plate. '
    'Let underpainting show at uneven stroke endings; preserve grouped volume with a few broad midtone turns. No fine engravings, scattered debris or glossy reflections.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('people, hands, faces, blood, flesh, extra weapons, complete spear shaft, multiple shields, floating shards, ornate metalwork, fine scratches, thin ink outlines, vector art, tiny facets, glossy 3d render, noise filter, many sparks, scenery')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/pierce-redraw-20261011/pierce.png'
if output.exists(): raise SystemExit('Output exists; stop')
request = dict(card_id='tt3-skewer', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed, parameters=DEFAULTS,
    prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False, design='单枪穿单甲出口特写，枪尖向左下前景，甲面右上出框，出口翻边与暗破口集中最强对比。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed = generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
