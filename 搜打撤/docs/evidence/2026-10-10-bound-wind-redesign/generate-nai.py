"""本轮两卡三步流程的NAI分镜草稿；共享配方原文与客户端护栏。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
import nai_style

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/output/bound-wind-redesign-20261010'
plans = [
    {
        'id': 'bound', 'card_id': 'tt8-hero-sealer', 'name': '受缚之残影',
        'design': '低机位跪姿伸向亮隙；巨链在前景锁住拉长影子，与人物方向相反。',
        'tags': '1boy, solo, focused expression, looking up, from below, cowboy shot, kneeling, leaning back, arm up, open hand, chains, shadow, simple background',
        'character_prompt': (
            'boy, elegant mysterious young man, refined youthful masculine face, '
            'narrow golden yellow eyes, thin round metal eyeglasses, pointed elf ears, '
            'silver-gray long hair gathered in a low bun, long sidelocks, short messy bangs, '
            'black bent-tip wide-brim witch hat with purple lining, black high-collared long '
            'robe, gold trim, purple cloak lining, black gloves and boots, '
            'white feather with blue sapphire gold clasp brooch on his left chest'
        ),
        'scene': (
            'Character 1 kneels on one knee in a turning three-quarter pose, '
            'his upper body leaning back as his raised hand reaches toward a narrow '
            'opening of light above the upper-right edge. His face remains visible '
            'beneath the hat, eyes following that opening. His other hand braces '
            'near his hip as his cloak pulls toward the opposite lower-left side. '
            'An elongated flat shadow spills from him across the lower-left plane. '
            'Immense metal chain links cross the extreme foreground and pin the '
            'edges of that shadow, making the shadow seem heavier than the body. '
            'The chain is nearest the lens, the kneeling man is in the middle, and '
            'the thin pale light opening is farthest away. A broad dark shadow mass '
            'and a few light abstract planes set up the opposite directions of '
            'captivity and reach. Choose the background hues and values to separate '
            'silver chains, black robe, pale face and shadow; keep the light opening '
            'quiet instead of surrounding the figure with decorative particles.'
        ),
        'extra_uc': 'female, child, old man, beard, staff, wand, feathered hat, multiple people, duplicate person, photorealistic landscape',
    },
    {
        'id': 'wind', 'card_id': 'tt8-hero-priest', 'name': '浪掷风吟',
        'design': '低机位三分之四后仰吟唱，一手贴胸一手迎风，宽S形风带转甘霖。',
        'tags': '1girl, solo, closed eyes, open mouth, from below, cowboy shot, leaning back, outstretched arm, hand on own chest, wind, rain, simple background',
        'character_prompt': (
            'girl, young adult woman, calm gentle anime face, golden eyes, '
            'pale golden very long hair, side braid gathered into a low ponytail, '
            'white crescent moon hairclip resting flat and tilted above the bangs '
            'on the viewer-right side of her head, white priestess long dress, '
            'deep teal short cape, restrained gold trim, white socks, short boots'
        ),
        'scene': (
            'Character 1 leans back slightly in a singing three-quarter pose, '
            'her face at the upper right with chin lifted and eyes softly closed. '
            'One hand rests at her heart; the other arm opens toward the wind, '
            'its relaxed palm nearer the viewer at the lower left. A broad wind '
            'current follows an S-shaped path from the foreground palm across '
            'her body and into the upper background. Her long braid and teal cape '
            'sweep against the body tilt, making two opposing directions. '
            'The passing wind gathers her song, and its far curve opens into a '
            'small shower of nourishing rain. The rain is a few broad pale strokes '
            'and soft droplets separated by quiet space. The foreground palm, '
            'middle singing figure and distant rain form depth. Choose background '
            'hues and light-dark planes around the teal cape, ivory dress and '
            'pale wind so their silhouettes remain distinct. Keep the dress '
            'continuous through the lower crop and leave quiet space around her face.'
        ),
        'extra_uc': 'boy, male, lamp, lantern, staff, wand, floating halo, crescent halo, duplicate person, photorealistic landscape',
    },
]
requests = []
for plan in plans:
    path = OUTPUT / (plan['id'] + '.png')
    if path.exists():
        raise SystemExit('本轮草稿已存在，停止重复生成。')
    prompt = build_asset_prompt(plan['tags'], composition_layer=plan['scene'])
    requests.append({**plan, 'prompt': prompt, 'negative_prompt': build_uc(
        plan['extra_uc'] + ', white border, inset illustration, detached torso, '
        'disembodied hand, contact sheet, character sheet'),
        'model': 'nai-diffusion-5-full', 'width': 1024, 'height': 1024,
        'parameters': DEFAULTS, 'recipe_version': nai_style.RECIPE_VERSION,
        'seed': build_payload(prompt, seed=None)['parameters']['seed'], 'output': str(path)})
(EVIDENCE / 'nai-requests.json').write_text(
    json.dumps(requests, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipts = []
for request in requests:
    print('START ' + request['id'], flush=True)
    path, seed = generate_image(
        request['prompt'], request['negative_prompt'], char_prompt=request['character_prompt'],
        width=1024, height=1024, seed=request['seed'], out=request['output'], model=request['model'])
    result = Path(path)
    receipts.append({'id': request['id'], 'card_id': request['card_id'], 'path': str(result),
                     'seed': seed, 'bytes': result.stat().st_size,
                     'sha256': hashlib.sha256(result.read_bytes()).hexdigest()})
    (EVIDENCE / 'nai-receipts.json').write_text(
        json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE ' + request['id'], flush=True)
