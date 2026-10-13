import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, arrow, arrowhead, feathers, motion lines, simple background'
scene = (
    'One slender silver arrow flies diagonally from lower left to upper right across quiet warm-gray space. '
    'Its small clean pointed steel head is near the upper-right third, connected to a straight thin dark shaft and a pair of pale blue feather vanes near the lower-left third. '
    'The arrow silhouette is elegant, light and narrow, with generous empty space above and below. '
    'The rear feather edges dissolve into exactly two broad tapering cyan-blue paint swipes trailing toward the lower-left edge, suggesting speed and air. '
    'The swipes stay behind the arrow and do not obscure its silhouette. '
    'Only the arrowhead has a crisp pale highlight; the shaft and grouped feathers use a few quiet planes. '
    'A solid desaturated warm-gray background supports the silver and blue accent. '
    'No target, impact, extra arrows, bow, people or scenery.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, hands, bow, quiver, multiple arrows, spear, oversized arrowhead, thick shaft, ornate weapon, sparks, particles, target, explosion, complex background, text, watermark, border')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/swiftarrow-20261010/swiftarrow.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt2-swiftarrow', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='一支细银箭斜掠暖灰底，箭羽化为两笔青蓝风痕；用轻快轮廓与留白表达迅疾。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
