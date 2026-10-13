"""基地作业空间草图；复用现行NAI画风与共享节流，不写凭据。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc
import nai_style

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/output/base-operations-v5-20261011/base-nai-v1.png'
subject = (
    'no humans, no characters, a single cozy winter expedition outpost interior, '
    'three-quarter elevated architectural cutaway, connected rooms in one believable stone and dark timber building, '
    'open front wall, snow visible outside the porch, a compact storeroom with crates and shelving at the upper left, '
    'a merchant counter with canvas bags and a brass scale at the upper right, '
    'a large central planning desk with an unfolded paper map and a small lamp, '
    'a rest corner with chairs and hung coats in the lower left, '
    'a quiet archive cabinet and book shelves in the lower right, warm lamps glowing through cold winter daylight'
)
prompt = build_asset_prompt(subject,
    purpose_layer='One coherent game base environment painting with readable facilities; no interface, no icons, no labels, no lettering.',
    composition_layer='Wide 7:4 composition. The whole building footprint is visible inside the frame with generous quiet breathing space around it. Strong broad silhouettes; clear walking space connects the facilities. Show each cabinet, counter and table as part of the same room architecture, never as disconnected floating tiles.',
    light_material_layer='Muted deep olive, charcoal timber and warm desaturated stone; restrained amber lamp pools, pale winter snow. Broad opaque paint planes, hard structural edges and selective detail on functional props; one consistent light direction.')
uc = build_uc('photorealistic, neon, cyberpunk, glossy plastic, anime girl, wallpaper portrait, flat icon sheet, multiple buildings, board game grid, floating islands, miniature figurines, tiny busy detail, bright white background')
seed = 1773210094
payload = build_payload(prompt, uc, width=1344, height=768, seed=seed)
request = {'provider':'NovelAI', 'recipeVersion':nai_style.RECIPE_VERSION, 'width':1344, 'height':768, 'model':payload['model'], 'seed':seed, 'prompt':prompt, 'negativePrompt':uc, 'parameters':payload['parameters'], 'purpose':'NAI草图，之后以自有imagegen重绘作基地环境'}
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
try:
    generated, actual_seed = generate_image(prompt,uc,width=1344,height=768,seed=seed,out=OUTPUT)
    output = Path(generated)
except (Exception,SystemExit) as error:
    (EVIDENCE / 'nai-failure.json').write_text(json.dumps({'error':str(error)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    raise
data = output.read_bytes()
receipt = {'provider':'NovelAI', 'path':str(output), 'seed':actual_seed, 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'excludedFromGit':True}
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False))
