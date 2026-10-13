import hashlib, json, sys
from pathlib import Path
here=Path(__file__).resolve().parent
project=Path.cwd()
sys.path.insert(0,str(project/'tools'))
from nai_gen import DEFAULTS, MODEL, generate_image
from nai_style import RECIPE_VERSION, build_asset_prompt, build_uc

prompt=build_asset_prompt(
    'object focus, no humans, one CLOSED MODERN SUPPLY CASE. Shape described directly from the observed Arknights Technical Investigation Supplies case: a LOW WIDE light-colored engineering case with softly chamfered rounded corners, a flat thick inset lid, a warm orange rectangular inset on the upper lid, a compact recessed rectangular front catch and carrying-grip recess. Short gray edge protectors, continuous clean lid/body seam. Broad front visible, shallow right-side depth and top plane in a three-quarter view. Compact synthetic composite casing, NOT a wooden fantasy chest, not a black barrel chest. The complete silhouette has a useful elegant industrial form with a few large structural parts. No text or logos on the orange lid inset. Closed flush latch, no old keyhole, no padlock.',
    purpose_layer='One beautiful finished modern prop for a future science-fiction city card game, not cyberpunk. This NAI call has no image-reference input; structural observations are encoded as text only. A later image edit will combine the real reference picture and actual project card style.',
    composition_layer='1344 by 768 wide canvas. Chest centered occupying about 65 percent width and 58 percent height, fully visible with clean margins. View from upper-left front showing top, broad front and right side. Rear lid hinge is at the top rear edge, clear mechanical alignment. Quiet plain pale neutral background only, no floor or scene. This single box will later use consistent opening animation frames.',
    light_material_layer='Warm ivory/off-white main casing, one soft coral-orange lid inset, muted blue-gray side shadow and neutral dark-gray small latch. Attractive calm color balance based on the project pearlbox card pale blue-gray inner planes and soft red/brass outer color groups, and crimson-pouch card large uninterrupted color masses. Three or four large hard-edged light/shadow groups with economical wide directional painterly marks. Complete coherent outer contour, loose painterly internal edge transitions, smooth broad silhouettes without plastic CGI shading. Focus detail only at the compact catch and lid seam. Surfaces quiet, no repeated tiny scratches or random triangular brush facets. Low-to-medium contrast, luminous light body rather than a dark black block. No illuminated strip around the box.'
)
uc=build_uc('people, hands, characters, multiple cases, open case, snow, ice, old wooden chest, wood panels, wood grain, leather, medieval, castle, gigantic gold lock, keyhole, padlock, archaic corner ornaments, engraving, patterns, dense rivets, bolts everywhere, black main body, dark barrel chest, blue bands, glowing outline, neon, cyberpunk, light ring, magical runes, light beam, particles, giant scratches, thick fake brush texture, 3d render, CGI, PBR, shiny plastic, smooth airbrush, pixel art, UI, text, letters, label, logo, watermark, floor, scenery')
seed=1011629502
out=here/'source/nai-modern-supply-v1.png'
record=here/'nai-request.json'
if out.exists() or record.exists():raise SystemExit('One modern-case request already recorded; no manual repeat')
(here/'source').mkdir(parents=True,exist_ok=True)
r={'status':'prepared','model':MODEL,'recipeVersion':RECIPE_VERSION,'parameters':DEFAULTS,'width':1344,'height':768,'seed':seed,'prompt':prompt,'negativePrompt':uc,'naiImageReferences':[],'observedStructure':'art-research-reset/references/ark-technical-supply.jpg','observedPaintStyle':['equip-tt2-pearlbox.webp','equip-tt3-crimson-pouch.webp']}
record.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
(here/'source/.gitignore').write_text('/nai-modern-supply-v1.png\n',encoding='utf8')
try:saved,actual=generate_image(prompt,uc,'',width=1344,height=768,seed=seed,out=str(out))
except BaseException as err:
    r.update(status='failed-no-manual-repeat',failureType=type(err).__name__);record.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8');raise
r.update(status='candidate-not-approved',source=saved,actualSeed=actual,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest())
record.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:r[k] for k in ['status','source','actualSeed','bytes','sha256']},ensure_ascii=True))
