import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, treasure chest, open chest, floating object, from below, dutch angle, close-up, playing cards, abstract background'
scene = ('A single battered dark wooden treasure chest floats tilted in the lower-left, its large near corner cropped by the bottom edge. '
    'The open lid recedes sharply toward the upper-left; the mouth of the chest is a deep violet void. '
    'One broad curling golden ribbon of paint erupts from inside the chest and arcs toward the upper-right. '
    'Exactly three separate blank ivory rectangular cards tumble along this single curved path: one large near the mouth, one medium at right-center, one small at upper-right. '
    'The cards are flat rectangles, not books, sheets or stacks. '
    'The box occupies the lower half and the curling ribbon connects it to the three cards across the upper half. '
    'Background is two abstract color masses, deep plum purple and burnt orange, with a restrained transition. '
    'Use a dreamlike impossible perspective, a few blunt wooden planes and dull metal bands, broad strokes instead of wood grain. '
    'The strongest warm accent is at the chest opening; no landscape, coins, gems, extra props or decorative particles.')
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('person, face, hands, arms, coins, jewels, books, card symbols, card text, stacked cards, landscape, room, photorealistic wood grain, ornate metalwork, tiny particles')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/big-chest-imagery-20261010/chest.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='cmtn28jv33wx', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='无人物；低机位倾斜悬空宝箱，三张卡沿金色宽弧涌出，深紫与赭橙抽象背景。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
