import hashlib, json, sys
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
EVIDENCE = Path(__file__).resolve().parent
tags = '1girl, solo, moon, full moon, curtain, kneeling, from above, foreshortening, reaching, looking at viewer, closed mouth, calm expression'
character = (
'girl, young adult priestess, composed delicate anime face, warm golden eyes, very pale low-saturation golden long hair, '
'dense straight bangs just above eyebrows, smooth rounded crown, long straight cheek sidelocks, one thick long low braid, '
'a white crescent moon hairpin clipped flat just above the bangs on viewer-right, tilted against the hair, '
'white high-collared priestess long dress, restrained gold collar and star clasp, deep teal short cape with gold trim, '
'dark wrist guards with visible fingers, dark tights, white-gray short boots')
scene = (
'An enormous flat ivory-white full moon is tilted in space like a round sheet of luminous paper, not a landscape. '
'Character 1 kneels sideways along its lower curved rim, one knee supporting her weight and the other leg folded under her robe. '
'She is caught halfway through peeling a heavy sheet of night away from the lunar disc. '
'One hand braces on the curved ivory rim behind her shoulder. Her other arm reaches down and toward the camera, gripping the edge of a broad charcoal-teal curtain. '
'The dark curtain is pulled diagonally into the lower-right foreground, uncovering the large uninterrupted pale circular face of the moon behind her. '
'Her torso twists naturally between the bracing hand and the pulling arm. Her head turns back toward the viewer, both golden eyes readable, mouth neutral and brows relaxed. '
'The camera is above and in front of her at a steep oblique angle, close enough that the pulling hand and curtain are enlarged in the foreground. '
'Her face lies in the upper-left third, the near hand in the lower-right third, and the moon fills most of the upper-right field. '
'The pale braid and white skirt sweep in an opposing arc along the moon rim, revealing the support of the knee and continuity of her body. '
'The dark cloth folds are a few sweeping heavy shapes with a clearly pinched edge in her fingers, not smoke or tentacles. '
'Leave broad quiet space within the moon; its circular outline remains legible and partly extends beyond the upper edge. '
'Surround the disc with subdued charcoal-green and gray-violet abstract color planes. The pale moon supplies soft reflected light to her face and sleeve. '
'Use the muted teal cape, pale hair, ivory moon and one small warm-gold eye accent as the limited color hierarchy. '
'The action reveals completeness and new power through uncovering the full moon, not through an energy beam or an explosion. '
'One coherent scene, no stars or floating ornaments used to fill empty space.')
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('boy, male, purple eyes, black priestess dress, purple cape, orange hair, bright yellow hair, '
'wicked grin, angry expression, lantern, staff, sword, halo, crescent moon background, moon landscape, '
'standing portrait, frontal symmetrical pose, smoke tentacles, multiple arms, detached torso, white border, contact sheet')
out = PROJECT.parent / '.tmp/nai/output/fullmoon-20261010/fullmoon-unveiling.png'
out.parent.mkdir(parents=True, exist_ok=True)
if out.exists(): raise SystemExit('Draft already exists; do not regenerate.')
model = 'nai-diffusion-5-full'
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = dict(card_id='tt3-nature-form', model=model, width=1024, height=1024, seed=seed,
parameters=DEFAULTS, prompt=prompt, character_prompt=character, negative_prompt=uc,
design='斜上方大透视，侧身半跪月缘，近手揭夜幕，远手撑月缘，完整月面显露。',
output=str(out), installed=False)
(EVIDENCE/'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character, width=1024, height=1024,
seed=seed, out=out, model=model)
p = Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(p), seed=actual_seed, model=model,
bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), installed=False),
ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(str(p))

