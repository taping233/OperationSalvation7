import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, spear, broken armor, close-up, from side, simple background'
scene = (
    'One silver spearhead pierces one dark armor plate. '
    'Show the contact from a clear side angle: the short black shaft enters from upper left, passes through a single small hole at center, and the silver pointed blade emerges toward lower right. '
    'The armor is one broad flat charcoal plate tilted across the opposite diagonal, with its simple outer shape readable. '
    'A thin bright torn rim around the hole makes the passage through the plate obvious; the rest of the plate remains solid. '
    'Keep the spear and plate silhouettes separate except at this one contact. '
    'Two broad blade planes and one dark plate plane are enough. '
    'A small dark red mark sits only at the puncture. '
    'Quiet solid muted gray-blue background, generous empty space around the two objects. '
    'No tassel, flying fragments, extra plates or elaborate cracking.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, hands, body, gore, blood spray, tassel, ribbon, flying debris, fragments, multiple weapons, sword, ornate weapon, sparks, particles, complex background, dense cracks, text, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/fatal-pierce-20261010/fatal-pierce-v45.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-fatal-pierce', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='清楚侧角：一支枪尖斜穿一块深色甲片；中央小破口、静灰蓝背景；去红缨、碎甲与复杂裂纹。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'prompt.md').write_text('# 致命穿刺 · 4.5简化版\n\n' + request['design'] + '\n\nPrompt:\n```text\n' + prompt + '\n```\n\nUC:\n```text\n' + uc + '\n```\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
