import hashlib, json, sys
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
tags = 'no humans, bronze bell, thorny vine, close-up, from below, dutch angle, 1.4::gouache painting, thick opaque brush strokes, painterly edges::'
scene = ('One heavy weathered bronze bell hangs tilted in the upper-right, its crown cropped above the frame and broad flared rim visible near the lower-right. '
    'A single dark crimson thorny vine punches through a small jagged hole in the FRONT SIDE of the bell, not through its open bottom. '
    'The vine emerges toward lower-left, then curls upward into a loose hook, with three large pointed thorns along the curve. '
    'Two small bent bronze lips at the side hole show that the thick wall has been pierced. '
    'The red organic curve overlaps the quiet bell face; no flowers or leaves. Background is a muted deep petrol-blue field with one gray-violet sweep.')
paint = ('Broad curved ochre and green-gray brush swipes wrap the bell, charcoal teal shadows turn its thickness. '
    'The vine is painted in one long loaded crimson stroke with blunt rust-red accent dabs and sparse sharp thorn edges. '
    'A short pale ochre rim at the puncture against its dark hole is the strongest local contrast. '
    'Keep broad uneven paint coverage and connected volume, not fine decorative texture. Metal is matte and aged, not glossy gold.')
prompt = build_asset_prompt(tags, composition_layer=scene, light_material_layer=paint)
uc = build_uc('people, hands, faces, weapons, spear, armor, roses, flowers, leaves, many vines, ornate bell patterns, inscriptions, chains, fine scratches, thin ink outlines, vector art, tiny facets, glossy 3d render, noise filter, sparks, scenery')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/pierce-thorn-bell-20261011/pierce.png'
if output.exists(): raise SystemExit('Output exists; stop')
request = dict(card_id='tt3-skewer', model='nai-diffusion-4-5-full', width=1024, height=1024, seed=seed, parameters=DEFAULTS,
    prompt=prompt, character_prompt='', negative_prompt=uc, output=str(output), installed=False, design='柔韧赤色荆棘刺破厚重铜钟侧壁，弯曲有机形对金属厚壁；无枪无甲，深青蓝灰紫背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed = generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
