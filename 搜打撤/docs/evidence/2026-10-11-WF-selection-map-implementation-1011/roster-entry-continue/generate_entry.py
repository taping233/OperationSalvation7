import sys, json, hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(root / 'tools'))
from nai_style import build_asset_prompt, build_uc, RECIPE_VERSION
from nai_gen import generate_image, MODEL, DEFAULTS

folder = Path(__file__).resolve().parent
out = folder / 'source' / 'nai-modern-winter-entry.png'
out.parent.mkdir(parents=True, exist_ok=True)
prompt = build_asset_prompt(
    'An uninhabited future city entrance in winter. Modern modular concrete and muted composite-metal transit structures, a broad cleared pedestrian approach, restrained elevated transit in the distance. No ancient architecture. Thin snow lies on rooftops and street edges, a few bare winter branches. No person or vehicle near the camera.',
    purpose_layer='Wide full-page RPG arrival reward background, no UI or text. Actual reward cards will overlay the centre and lower centre, so this field must stay visually quiet.',
    composition_layer='Landscape 16:9, eye-level view. Large angular modern transit gateway at the left third, distant city silhouettes in upper third, wide quiet grey-blue middle and lower field. Clean continuous approach, no dramatic vanishing point in the card field. Main built shapes occupy the sides, not the central reward field.',
    light_material_layer='Cold overcast daylight, muted slate blue and neutral grey, small dull terracotta structural accents. Opaque broad directional brush strokes, two or three large shadow planes per form, readable complete silhouettes and selective sharp edges. No granular texture, polygon facets, PBR shine, neon or bloom.')
uc = build_uc('people, characters, castle, stone pillars, medieval, wood doors, banners, neon, cyberpunk, polished 3d, pbr, low poly, polygon mesh, uniform triangular facets, tiny brush marks, granular texture, cards, interface, lettering, snowstorm, glossy reflections')
receipt = dict(status='candidate-not-approved', channel='NAI text only', model=MODEL, recipeVersion=RECIPE_VERSION, parameters=DEFAULTS, width=1344, height=768, seed=1011462201, prompt=prompt, negativePrompt=uc, naiImageReferences=[], outputPath=str(out))
(folder / 'nai-request.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
result = generate_image(prompt, uc, width=1344, height=768, seed=receipt['seed'], out=str(out))
receipt['clientResult'] = result
receipt['sha256'] = hashlib.sha256(out.read_bytes()).hexdigest()
receipt['bytes'] = out.stat().st_size
(folder / 'nai-request.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'outputPath':str(out), 'sha256':receipt['sha256'], 'bytes':receipt['bytes']},ensure_ascii=False))
