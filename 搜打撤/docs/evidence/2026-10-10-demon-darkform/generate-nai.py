"""恶魔之力/黑暗形态两卡重新分镜，职业人设分开锁定。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
OUT = PROJECT.parent / '.tmp/nai/output/demon-darkform-20261010'
plans = [
    {
        'id': 'demon', 'card_id': 'cc-demon', 'name': '恶魔之力',
        'tags': '1girl, solo, focused expression, looking down, magic, shadow, claws, simple background, from below, cowboy shot, leaning forward, outstretched arm, open hand, hand on own chest',
        'character_prompt': (
            'girl, young adult woman, calm delicate anime face, golden eyes, '
            'pale golden very long hair with side braid gathered into low ponytail, '
            'white crescent hairclip lying flat and tilted above bangs on viewer-right, '
            'white priestess long dress, deep teal short cape, restrained gold trim, '
            'white socks, short boots'
        ),
        'scene': (
            'Character 1 leans into a turning forward motion, one hand firmly '
            'against her heart while her nearer open palm reaches into the foreground. '
            'A small warm-gold light at her chest is drawn along the arm into a '
            'narrow dark-red current. An immense disembodied shadow claw rises '
            'behind the extended palm, enclosing that red current between broad '
            'black-violet fingers. The two gestures form a diagonal of exchange: '
            'her own warm life-light dwindles while the borrowed dark power '
            'gathers near the foreground hand. Her face remains clearly readable '
            'above the shoulder, expression controlled rather than monstrous. '
            'The long braid and teal cape sweep opposite the reaching arm. '
            'Keep the demonic presence as one abstract claw silhouette, secondary '
            'to her face and hand, with a concentrated red/ivory energy accent. '
            'Use quiet abstract background color planes chosen to separate ivory '
            'dress, teal cape and dark claw; the torso continues through the crop.'
        ),
        'extra_uc': 'boy, male, horns on character, black hair, silver hair, purple eyes, black priestess outfit, lamp, lantern, blood, wound, gore, full demon body, multiple people',
    },
    {
        'id': 'darkform', 'card_id': 'cmtn1r10xnl1', 'name': '黑暗形态',
        'tags': '1boy, solo, slight smile, looking back, shadow, magic, simple background, from behind, cowboy shot, standing, arm up',
        'character_prompt': (
            'boy, elegant mysterious young man, refined youthful masculine face, '
            'narrow golden yellow eyes, thin round metal eyeglasses, pointed elf ears, '
            'silver-gray long hair gathered in low bun, two long sidelocks, short messy bangs, '
            'black bent-tip wide-brim witch hat with deep purple lining, '
            'black high-collar long robe with thin gold edges, purple cloak lining, '
            'black leather gloves and boots, white feather with gold-set blue sapphire '
            'brooch on his left chest'
        ),
        'scene': (
            'Character 1 is caught midway through a turn, seen from a three-quarter '
            'back angle with his face looking back over the shoulder toward the '
            'viewer. His raised hand draws his own elongated shadow upward and '
            'over his shoulder like a second cloak. The real violet cloak and '
            'the heavier black shadow flow in opposing directions. The lifted '
            'shadow unfolds into several broad overlapping dark curtains, each '
            'opening a thin pale gap into an otherwise hidden space. One newly '
            'revealed gap extends farther than the others, suggesting another '
            'possibility beyond the ordinary choices. His other glove gathers '
            'the shadow near the waist, making the transformation an intentional '
            'dressing gesture. The hat, golden eye, glasses and pale hair stay '
            'readable; the torso and upper thighs remain connected through the '
            'lower crop. Keep the curtain spaces abstract rather than literal '
            'doors, rooms or scenery; background values separate the black '
            'shadow silhouette from the real robe and the small pale openings.'
        ),
        'extra_uc': 'female, child, old man, beard, staff, wand, feathered hat, black hair, blue eyes, full demon body, multiple people, literal doors, room scenery',
    },
]
requests = []
for plan in plans:
    output = OUT / (plan['id'] + '.png')
    if output.exists():
        raise SystemExit('本轮草稿已存在，停止重复调用。')
    prompt = build_asset_prompt(plan['tags'], composition_layer=plan['scene'])
    requests.append({**plan, 'prompt': prompt,
                     'negative_prompt': build_uc(plan['extra_uc'] + ', white border, inset illustration, disembodied human hand, detached torso, contact sheet, character sheet'),
                     'model': 'nai-diffusion-5-full', 'width': 1024, 'height': 1024,
                     'parameters': DEFAULTS, 'seed': build_payload(prompt, seed=None)['parameters']['seed'],
                     'output': str(output)})
(EVIDENCE / 'nai-requests.json').write_text(
    json.dumps(requests, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipts = []
for request in requests:
    print('START ' + request['id'], flush=True)
    path, seed = generate_image(request['prompt'], request['negative_prompt'],
                               char_prompt=request['character_prompt'], width=1024,
                               height=1024, seed=request['seed'], out=request['output'],
                               model=request['model'])
    result = Path(path)
    receipts.append({'id': request['id'], 'card_id': request['card_id'], 'path': str(result),
                     'seed': seed, 'bytes': result.stat().st_size,
                     'sha256': hashlib.sha256(result.read_bytes()).hexdigest()})
    (EVIDENCE / 'nai-receipts.json').write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE ' + request['id'], flush=True)
