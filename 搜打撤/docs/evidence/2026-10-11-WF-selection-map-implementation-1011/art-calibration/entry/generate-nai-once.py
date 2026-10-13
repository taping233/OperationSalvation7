import hashlib, json, sys
from pathlib import Path
here = Path(__file__).resolve().parent
project = Path.cwd()
sys.path.insert(0, str(project / 'tools'))
from nai_gen import DEFAULTS, MODEL, generate_image
from nai_style import RECIPE_VERSION, ARTIST_BLOCK, build_asset_prompt, build_uc

prompt = build_asset_prompt(
    'scenery, indoors, no humans. An original calm city-arrival threshold alcove, a simple side-supported entrance setting rather than a vista down a street. LEFT side has one broad ash-gray stone wall and a single thick quiet doorway upright; RIGHT side has one broad muted ochre-red wooden door plane and a dark teal interior shadow. Warm gray plaster and dark teal space behind them establish arrival without a central exit. No specific historical faction, no signs or story objects.',
    purpose_layer='One wide landscape full-page game reward background calibration image. The actual reward objects will be drawn separately in code; this image contains only quiet supporting architecture.',
    composition_layer='Asymmetric large framing masses confined to left x0-25 percent and right x75-100 percent. Centre x28-72 percent and y12-82 percent is one continuous calm low-contrast warm-gray and deep-muted-teal painted space. No doorway, open sky, vanishing point, tower or bright light in the centre. The lower middle is a broad matte ground plane with at most two large color masses; no tiled floor or small fragments. Upper 10 percent and bottom 12 percent contain no important architectural detail. Broad shallow spatial depth with no perspective street; the side structures frame the empty centre without enclosing it in a graphic border. Entire environment is readable as a simple sheltered threshold.',
    light_material_layer='Warm-gray stone, muted ochre-red wood and cool dark-teal shadows are three clear material color groups. Model each material using only three or four broad opaque light and shadow planes. Directional long brush masses, loose uneven brush edges, sparse hard structural edges, complete simple shapes. A very small pale warm-light accent may stay at one far side only; no glowing centre, no dramatic spotlight. Keep the environment low detail and low contrast so foreground rewards remain the focal point. Cloth-like and wood-like material response expressed through painterly planes, not surface texture. No uniformly small triangles, no low-poly mesh, no airbrush gradients, no detailed masonry, no wood grain, no shiny PBR surfaces. Simplify structure as strongly as the project pearlbox and crimson-pouch card pictures.'
)
uc = build_uc('person, people, character, face, girl, boy, animal, whale, Neow, snow, snowflakes, snowy street, central doorway, central bright exit, central light, central tower, symmetrical gate, castle panorama, city street, vanishing road, bricks, tiles, masonry detail, woodgrain, uniform triangles, small polygon faces, low poly, polygon mesh, glossy 3d, pbr, photorealism, reflections, shiny ground, lens flare, bloom, particles, blue ribbon, roses, products, cards, card frames, ui, interface, prices, captions, letters, numbers, ornate arches, many repeated windows, clutter')
seed = 1011367301
out = here / 'source/nai-entry-calibration-v1.png'
receipt_path = here / 'nai-request.json'
if out.exists() or receipt_path.exists():
    raise SystemExit('Single-entry request already recorded; no second manual call')
refs = ['martial-tt7-stealth.webp','equip-tt2-pearlbox.webp','equip-tt3-crimson-pouch.webp']
receipt = {'status':'prepared','model':MODEL,'recipeVersion':RECIPE_VERSION,'artistBlock':ARTIST_BLOCK,'parameters':DEFAULTS,'width':1344,'height':768,'seed':seed,'prompt':prompt,'negativePrompt':uc,'characterPrompt':'','naiImageReferences':[], 'observedStyleOnly':refs,'cardSHA256':{name:hashlib.sha256((project/'game/assets/cards'/name).read_bytes()).hexdigest() for name in refs}}
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(here/'source/.gitignore').write_text('nai-entry-calibration-v1.png\n',encoding='utf-8')
try:
    saved, actual = generate_image(prompt, uc, '', width=1344, height=768, seed=seed, out=str(out))
except BaseException as error:
    receipt.update(status='failed-no-manual-retry',failureType=type(error).__name__)
    receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    raise
receipt.update(status='candidate-not-approved',source=saved,actualSeed=actual,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest())
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:receipt[key] for key in ['status','model','width','height','actualSeed','source','bytes','sha256']},ensure_ascii=True))