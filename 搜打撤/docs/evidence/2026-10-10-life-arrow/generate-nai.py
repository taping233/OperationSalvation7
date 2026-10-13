import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, arrow, arrowhead, sprout, leaves, simple background'
scene = (
    'One slender wooden arrow flies diagonally upward from lower left to upper right. '
    'A small clean pale silver pointed head, one straight dark wooden shaft, and exactly two fresh tender-green leaves growing at its rear end form the entire subject. '
    'The two leaves replace feather fletching and sweep backward gently in the air. '
    'The old dry wood becoming fresh leaves suggests life awakening and moving forward. '
    'Keep a clear conventional arrow silhouette and generous quiet space around it. '
    'The shaft is one broad stroke, the leaves two coherent green shapes, the arrowhead two simple light and shadow planes. '
    'Solid muted warm ivory-gray background; a faint broad sage sweep behind the leaves suggests forward motion. '
    'No bird, branch, flower, floating seed, particles, ornaments or scenery.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, hands, bird, branch, multiple arrows, bow, target, flowers, dense foliage, forest, scenery, particles, sparks, ornate weapon, intricate leaf veins, text, watermark, frame')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/life-arrow-20261010/life-arrow-v2.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-life-arrow', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='老板修正：必须有箭、少元素、多意象；一支木箭尾端生两片嫩叶，枯木萌芽与向前飞行表达生命。')
(EVIDENCE / 'nai-request-v2.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt-v2.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
