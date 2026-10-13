"""邪神四手分镜草稿；统一造型，四个不同手势，透明由内置重绘阶段输出。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/output/eldritch-hands-20261010'
common = (
    'One single isolated hand and short forearm belonging to the same eldritch god. '
    'Charcoal-black matte skin with muted deep-violet planes, elongated palm bones, '
    'five long articulated fingers including one opposable thumb, tapering claw tips. '
    'The anatomy is recognizably a hand but has severe angular knuckles and a few '
    'broad irregular obsidian-like ridges across the back of the hand. '
    'A restrained violet inner glow appears only in two or three deep joint creases. '
    'A plain black sealing cuff encircles the wrist, marked by one pale diamond seal; '
    'a few broad gray chain links hang from the cuff. '
    'The short forearm ends in a simple tapered shadow shape, not bloody tissue. '
    'The hand fills most of the square, wrist/forearm remains inside the frame, '
    'with a small clear margin around claws and chain. Plain white background '
    'is only a draft backdrop; the final asset will be genuinely transparent. '
    'Use large matte opaque planes and restrained directional brush marks; '
    'readable knuckles and gesture, quiet low-detail cuff and chains.'
)
specs = [
    ('1', 'tt8-curseimmune', 'creature-tt8-curseimmune.webp', '托握',
     'Palm upward in a three-quarter view; the long fingers curve inward around '
     'an empty center as if cradling an invisible weight. The thumb is clearly '
     'separate, and the palm basin is visible. Wrist enters from lower left.'),
    ('2', 'tt8-energycap', 'creature-tt8-energycap.webp', '张掌',
     'An upright open palm faces three-quarter toward the viewer. All five '
     'digits are clearly separated in a broad fan; the thumb sweeps outward '
     'rather than duplicating a finger. Wrist enters from below.'),
    ('3', 'tt8-nofocus', 'creature-tt8-nofocus.webp', '勾爪',
     'The back of the hand faces the viewer in a foreshortened three-quarter '
     'view. The five digits curl forward in a hooked grasp, with staggered '
     'knuckles and readable gaps, like closing on something. Wrist enters '
     'from upper left and fingertips point toward lower right.'),
    ('4', 'tt8-healplus', 'creature-tt8-healplus.webp', '攥拳',
     'A clenched fist seen from a low three-quarter angle. Four fingers fold '
     'into the palm and the opposable thumb lies across them; a strong broad '
     'knuckle arc and the cuff establish the silhouette. Wrist enters from '
     'lower right. Do not leave additional extended fingers.'),
]
uc = build_uc(
    'human person, full body, face, head, torso, multiple hands, extra arms, '
    'feet, foot, toes, legs, shoes, tentacle fingers, extra digits, palm eye, '
    'gore, blood, dismemberment wound, weapon, background scenery, '
    'white border, card frame, glossy metal armor, photorealism'
)
requests = []
for number, card_id, asset, gesture, scene in specs:
    output = OUTPUT / ('hand-' + number + '.png')
    if output.exists():
        raise SystemExit('本轮草稿已存在，停止重复生成。')
    prompt = build_asset_prompt(
        'hand focus, disembodied hand, claws, wrist cuff, chains, white background',
        composition_layer=common + ' ' + scene)
    requests.append({'number': number, 'card_id': card_id, 'asset': asset,
                     'gesture': gesture, 'prompt': prompt, 'negative_prompt': uc,
                     'character_prompt': '', 'model': 'nai-diffusion-5-full',
                     'width': 1024, 'height': 1024, 'parameters': DEFAULTS,
                     'seed': build_payload(prompt, seed=None)['parameters']['seed'],
                     'output': str(output)})
(EVIDENCE / 'nai-requests.json').write_text(
    json.dumps(requests, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipts = []
for request in requests:
    print('START hand-' + request['number'], flush=True)
    path, seed = generate_image(request['prompt'], uc, width=1024, height=1024,
                               seed=request['seed'], out=request['output'], model=request['model'])
    result = Path(path)
    receipts.append({'number': request['number'], 'card_id': request['card_id'],
                     'path': str(result), 'seed': seed, 'bytes': result.stat().st_size,
                     'sha256': hashlib.sha256(result.read_bytes()).hexdigest()})
    (EVIDENCE / 'nai-receipts.json').write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE hand-' + request['number'], flush=True)
