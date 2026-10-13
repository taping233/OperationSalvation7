"""自由分镜三候选；既有NAI客户端逐张共享节流，人设/正式画风保留。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
import nai_style

EVIDENCE = Path(__file__).resolve().parent
ROOT_OUT = PROJECT.parent / '.tmp/nai/output/volcano-free-v8-20261010'
character = (
    'boy, elegant mysterious young man, youthful refined masculine face, slender jaw, '
    'narrow almond-shaped golden yellow eyes, delicate nose, small mouth, pale skin, '
    'round thin metal frame eyeglasses, slender pointed elf ears, '
    'silver-grey long hair gathered into a low bun, two long sidelocks, short messy bangs, '
    'black wide-brim witch hat with a slender bent tip drooping to the right, purple hat lining, '
    'black high-collar long robe, restrained thin gold piping, small gold buttons, '
    'large cloak with purple lining, white feather with a gold-set blue sapphire '
    'brooch on the left chest, black leather gloves, black lace-up boots'
)
plans = [
    {
        'id': 'A', 'title': '提起火幕',
        'tags': '1boy, solo, slight smile, looking up, dark background, fire, smoke, from below, full body, standing, arm up',
        'scene': (
            'Character 1 stands in a turning three-quarter pose with his weight on '
            'the rear foot. His raised hand appears to lift an immense sheet of '
            'eruptive fire behind him like a heavy curtain. The fire folds upward '
            'into one towering curved shape; its lower edge remains compressed and '
            'dark while the lifted edge opens into brilliant molten light. '
            'The other hand calmly holds the cloak near his hip. His face stays '
            'visible beneath the hat, his eyes following the lifted fire. '
            'His cloak swings against the rising flame, creating opposing diagonals. '
            'Show the complete figure from hat to boots, with the feet grounded '
            'on one simple dark abstract plane. The huge fire curtain frames him '
            'without hiding his silhouette; distant smoke becomes a few quiet masses. '
            'Design the background color and lighting around the fire curtain '
            'and clear separation of face, black robe and boots.'
        ),
    },
    {
        'id': 'B', 'title': '压住怒潮',
        'tags': '1boy, solo, calm expression, slight smile, looking down, dark background, fire, smoke, from side, upper body, leaning forward, outstretched arm, open hand',
        'scene': (
            'Character 1 is seen in a close three-quarter side view, his face '
            'prominent above the nearer hand. He gently presses his palm against '
            'an invisible boundary, keeping a colossal molten surge behind it '
            'compressed like a suspended wave. The dark-red crest curls over '
            'his shoulder, frozen a moment before release. A narrow ivory fissure '
            'opens at the point just beyond his fingertips and a single short '
            'tongue of fire escapes. His calm small smile contrasts with the '
            'enormous stored force. The leaning shoulder and continuous arm '
            'form a strong diagonal; the other hand remains near his waist. '
            'Use the boundary between dark pressure and pale molten light as '
            'the main background shape, with quiet space around his face. '
            'The upper-body crop occurs at the canvas edge and his robe remains '
            'connected through the bottom edge.'
        ),
    },
    {
        'id': 'C', 'title': '从火中探身',
        'tags': '1boy, solo, slight smile, looking at viewer, dark background, fire, smoke, from below, cowboy shot, foreshortening, leaning forward, outstretched arm, open hand',
        'scene': (
            'The viewer is inside the eruptive fire looking up toward Character 1. '
            'His nearer gloved hand reaches toward the lens and becomes the large '
            'foreground shape, while his clearly visible face sits behind it '
            'near the upper third. He twists his shoulders through a gap in a '
            'huge sweeping flame wall, looking directly toward the viewer with '
            'a restrained confident smile. His far arm draws the cloak back '
            'so it arcs across the opposite side of the frame. Broad molten '
            'streaks sweep past the lens at the edges, with a quiet opening '
            'around his eyes and glasses. His upper legs and connected robe '
            'continue into the bottom crop; the perspective enlarges the near '
            'hand and compresses the torso naturally. Let foreground fire, '
            'middle figure and distant smoke form three clear depth layers, '
            'with the background hue chosen for the face and gesture to read.'
        ),
    },
]
uc = build_uc(
    'female, child, old man, aged face, broad jaw, elongated chin, huge round eyes, '
    'makeup, beard, staff, wand, feathered hat, hat feather, playing cards, '
    'card decks, magic circle, circular portal, realistic volcano landscape, '
    'white border, inset illustration, character sheet, contact sheet, '
    'detached torso, disembodied hand'
)
requests = []
for plan in plans:
    output = ROOT_OUT / (plan['id'] + '.png')
    if output.exists():
        raise SystemExit('本轮候选已存在，停止核对，不重刷或覆盖。')
    prompt = build_asset_prompt(plan['tags'], composition_layer=plan['scene'])
    requests.append({**plan, 'prompt': prompt, 'character_prompt': character,
                     'negative_prompt': uc, 'model': 'nai-diffusion-5-full',
                     'width': 1024, 'height': 1024, 'parameters': DEFAULTS,
                     'recipe_version': nai_style.RECIPE_VERSION,
                     'seed': build_payload(prompt, seed=None)['parameters']['seed'],
                     'output': str(output), 'installed': False})
(EVIDENCE / 'requests.json').write_text(
    json.dumps(requests, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipts = []
for request in requests:
    print('START ' + request['id'], flush=True)
    path, seed = generate_image(
        request['prompt'], uc, char_prompt=character, width=1024, height=1024,
        seed=request['seed'], out=request['output'], model=request['model'])
    result = Path(path)
    receipts.append({'id': request['id'], 'title': request['title'], 'path': str(result),
                     'seed': seed, 'bytes': result.stat().st_size,
                     'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
                     'installed': False})
    (EVIDENCE / 'receipts.json').write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE ' + request['id'], flush=True)
