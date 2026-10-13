import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'gauntlet, clenched hand, arm, sword, blocking, close-up, from side, simple background'
scene = (
    'Show only one armored forearm and one incoming blade at the instant of a successful block. '
    'The defender forearm rises from the lower-right crop across the foreground toward a closed black-gloved fist at the left edge. '
    'A single broad dark steel wrist guard covers the back of the forearm, forming one strong curved plane. '
    'One silver sword blade descends from the upper-right crop and stops against the raised outer ridge of that wrist guard just above center. '
    'The sword cutting edge touches the armor at one clearly visible point; the blade never enters the arm. '
    'The glove and wrist guard belong to the same continuous forearm, with the arm continuing out of frame at lower right. '
    'Blade and arm oppose one another, creating a readable crossed silhouette and a small open dark wedge behind their contact. '
    'One compact ivory glint and two short ochre-gold paint swipes at the contact suggest the sudden arrested strike. '
    'Keep the sword face pale silver, the glove near-black, and the guard muted charcoal with just one broad light plane. '
    'Background is a few broad muted slate-blue and warm ivory diagonal planes following the collision, with quiet space above the fist. '
    'Tight crop, no complete warrior, second hand, face, shield, elaborate armor ornament, scattered debris or particle cloud.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('face, full body, multiple hands, extra arms, shield, multiple swords, sword piercing arm, blood, ornate armor, intricate engraving, many sparks, particles, scenery, text, watermark, frame')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/block-20261010/block.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt2-block', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='单臂横向顶住斜劈刀刃；接触点亮、交叉轮廓清楚；两笔短金色冲击，灰蓝/暖白背景。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'prompt.md').write_text('# 格挡 · 刀刃停住的瞬间\n\n' + request['design'] + '\n\nPrompt:\n```text\n' + prompt + '\n```\n\nUC:\n```text\n' + uc + '\n```\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
