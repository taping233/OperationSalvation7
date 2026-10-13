import hashlib
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
project = Path.cwd()
sys.path.insert(0, str(project / 'tools'))
from nai_gen import DEFAULTS, MODEL, generate_image
from nai_style import RECIPE_VERSION, ARTIST_BLOCK, build_asset_prompt, build_uc

prompt = build_asset_prompt(
    'An original indoor temporary supply stall. One adult anime shopkeeper, short brown hair, warm brown eyes, a plain dark knitted cap, muted scarf and charcoal work coat with a small dull terracotta-red cloth accent. The shopkeeper stands calmly behind one compact counter at the far LEFT edge; a clear expressive face and two coherent hands resting naturally on the counter. No named character or story role.',
    purpose_layer='One wide landscape game-art style calibration image, not a finished game screenshot. The subject is a temporary shop interior. No interface is drawn.',
    composition_layer='Strict asymmetric layout: merchant silhouette entirely within LEFT x6-26 percent and y18-65 percent. Counter, hands and one small warm lamp are contained entirely within LEFT x2-28 percent, with no tabletop extension crossing into the centre. RIGHT x32-97 percent and y16-82 percent is a continuous quiet merchandise-safe plane formed from only two or three broad interior curtain/wall masses, no shelf clutter, no boxes, no openings. Upper 12 percent and lower 14 percent are calm and contain no important props. A wide horizontal indoor scene, no central exit or receding street, no snow. Avoid symmetry and avoid a centrally placed character.',
    light_material_layer='Use warm gray, deep muted teal, neutral charcoal and one modest ochre-red cloth group. Distinguish cloth, counter and metal through broad color groups. Build each major material from three or four large confident light/shadow planes with broad directionally meaningful painterly strokes, loose uneven hand-painted edges and complete readable silhouettes. Selectively refine the face, eyes, hands and counter contact; simplify all clothing folds and environmental surfaces. The right merchandise field has low contrast, not black emptiness. A small amber lamp has a precise small highlight without bloom. This is economical opaque anime brush painting, not an environment made of uniformly sized little triangles or faceted polygons. No photorealistic material textures, no detailed brick or woodgrain, no PBR, no shiny floor.'
)
uc = build_uc('snow, snowflakes, exterior, blue ribbon, blue bow, roses, silver ponytail, white hair, goggles, Wu, Neow, bucket helmet, silver cape, central bright doorway, bright window, long counter, counter crossing center, shelf clutter, stacks of crates, products, cards, card frames, interface, ui, prices, lettering, numbers, woodgrain, brick texture, pbr, photorealistic, shiny floor, reflections, lens flare, bloom, particles, low poly, polygon mesh, uniform triangular facets, tiny repeated brush strokes, many small color fragments, symmetrical composition, centered person')
char_prompt = 'An original adult human shopkeeper with short brown hair, a plain dark knit cap and muted scarf, charcoal coat, clear expressive face and coherent hands, behind a compact counter at the far left.'
seed = 1011353401
out = here / 'source' / 'nai-shop-calibration-v1.png'
if out.exists():
    raise SystemExit('Single-request target already exists; do not generate again')
receipt = {
    'status': 'request-prepared', 'channel': 'existing tools/nai_gen.py, single generate_image call',
    'model': MODEL, 'recipeVersion': RECIPE_VERSION, 'artistBlock': ARTIST_BLOCK,
    'parameters': DEFAULTS, 'seed': seed, 'width': 1344, 'height': 768,
    'prompt': prompt, 'negativePrompt': uc, 'characterPrompt': char_prompt,
    'naiImageReferences': [],
    'styleObservationOnly': [str(project / 'game/assets/cards/martial-tt7-stealth.webp'), str(project / 'game/assets/cards/equip-tt2-pearlbox.webp'), str(project / 'game/assets/cards/equip-tt3-crimson-pouch.webp')],
    'notImageInputs': 'NAI current client accepts text only; observed card files were not sent as image conditioning.',
    'referenceSHA256': {name: hashlib.sha256((project / 'game/assets/cards' / name).read_bytes()).hexdigest() for name in ['martial-tt7-stealth.webp', 'equip-tt2-pearlbox.webp', 'equip-tt3-crimson-pouch.webp']},
}
receipt_path = here / 'nai-request.json'
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(here / 'source' / '.gitignore').write_text('nai-shop-calibration-v1.png\n', encoding='utf-8')
try:
    saved, actual_seed = generate_image(prompt, uc, char_prompt, width=1344, height=768, seed=seed, out=str(out))
except BaseException as error:
    receipt['status'] = 'failed'
    receipt['failureType'] = type(error).__name__
    receipt['retryPolicy'] = 'No second manual call or altered channel/model requested.'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    raise
receipt.update(status='generated-candidate-not-approved', outputPath=saved, actualSeed=actual_seed, bytes=out.stat().st_size, sha256=hashlib.sha256(out.read_bytes()).hexdigest())
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key:receipt[key] for key in ['status','model','actualSeed','width','height','outputPath','bytes','sha256']}, ensure_ascii=True))