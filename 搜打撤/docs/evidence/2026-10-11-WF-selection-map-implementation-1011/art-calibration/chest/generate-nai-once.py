import hashlib, json, sys
from pathlib import Path
here = Path(__file__).resolve().parent
project = Path.cwd()
sys.path.insert(0, str(project / 'tools'))
from nai_gen import DEFAULTS, MODEL, generate_image
from nai_style import RECIPE_VERSION, ARTIST_BLOCK, build_asset_prompt, build_uc

prompt = build_asset_prompt(
    'object focus, no humans, ONE closed treasure chest. Closely specified structure based on the observed Slay the Spire 2 cyan-black chest: LOW WIDE arched lid, a continuous squat rectangular body, two WIDE continuous protective metal bands following the curved lid and extending vertically down the left and right edges of the front face, a single dark horizontal lid/body seam. The curved top reads as one large barrel-like arch, not a tall gabled roof. The front face is broad and quiet. A tiny recessed rectangular fastening tab only, no large golden lock plate or huge keyhole. Three-quarter view shows the broad front and the RIGHT arched end. Width about 1.8 times visible height. No legs, no jewels, no ornamental cornices. The subject is made predominantly from deep cyan-black matte metal, not reddish wood.',
    purpose_layer='One isolated 2D card-game treasure-chest prop study. Only one chest, for a later transparent cutout edit; no UI and no rewards. This NAI request has NO image-reference input. Its structure is described from a real game screenshot in text only.',
    composition_layer='Wide 1344 by 768 canvas. Chest centred occupying about 68 percent width and 62 percent height, fully visible with generous quiet margins. A plain untextured neutral warm-gray background only, no scenery, rock pedestal, floor planks or cast shadow plane. The lid/body seam and two bands must remain readable at a 300-pixel chest display width.',
    light_material_layer='Deep cyan-black main body, desaturated teal-blue edge bands, cool blue-gray upper-left light and very dark front/side shadows. Three or four broad opaque value planes, no luminous outlines. Large directional economical brush marks and selective structural edges, matching the project pearlbox and crimson-pouch card painting in textual description. Complete coherent outer silhouette; loose broad internal painted edges, not low-poly triangles. Metal form expressed by broad painted color planes rather than shiny reflection gradients. Preserve the low wide cyan-black chest structure. Do not add the mouse pointer, white hover outline, surrounding rocks or floor shown in the reference screenshot.'
)
uc = build_uc('people, character, girl, boy, face, figure, hands, animal, multiple chests, open chest, red wood, wooden treasure trunk, gigantic gold lock, large gold keyhole, giant padlock, ornate filigree, carvings, many rivets, fine scratches, fine grain, photorealistic, CGI, smooth 3d, glossy PBR, low poly, triangular facets, snow, ice, blue ribbon, roses, character emblem, crystals, loot, coins, scenery, pedestal, rocks, floor, ground, cast shadow, mouse pointer, cursor, white outline, hover border, ui border, light beam, luminous aura, magical particles, sparkles, text, numbers, watermark')
seed = 1011569501
out = here / 'source/nai-sts2-cyan-chest-v1.png'
receipt_path = here / 'nai-request.json'
if out.exists() or receipt_path.exists():
    raise SystemExit('Single chest request already recorded; no manual second call')
(here/'source').mkdir(parents=True,exist_ok=True)
receipt = {'status':'prepared','model':MODEL,'recipeVersion':RECIPE_VERSION,'artistBlock':ARTIST_BLOCK,'parameters':DEFAULTS,'width':1344,'height':768,'seed':seed,'prompt':prompt,'negativePrompt':uc,'characterPrompt':'','naiImageReferences':[], 'textStructureReference':'art-research-reset/references/sts2-chest.png','observedStyleOnly':['equip-tt2-pearlbox.webp','equip-tt3-crimson-pouch.webp']}
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(here/'source/.gitignore').write_text('/nai-sts2-cyan-chest-v1.png\n',encoding='utf-8')
try:
    saved, actual = generate_image(prompt, uc, '', width=1344, height=768, seed=seed, out=str(out))
except BaseException as error:
    receipt.update(status='failed-no-manual-retry',failureType=type(error).__name__)
    receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    raise
receipt.update(status='candidate-not-approved',source=saved,actualSeed=actual,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest())
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:receipt[key] for key in ['status','model','width','height','actualSeed','source','bytes','sha256']},ensure_ascii=True))
