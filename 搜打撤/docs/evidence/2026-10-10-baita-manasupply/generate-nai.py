"""法力补给：白塔职业卡分镜，现行NAI管线单张草稿。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
output = PROJECT.parent / '.tmp/nai/output/baita-manasupply-20261010/draft.png'
if output.exists():
    raise SystemExit('本轮草稿已存在，停止重复生成。')
character = (
    'girl, young adult woman, gentle composed anime face, emerald green eyes, '
    'very long dark brown wavy curly hair, large grouped curls, swept bangs, '
    'two small gold metal hairclips parting bangs away from her eyes, '
    'white long-sleeved high-collar blouse with cuff buttons, '
    'dark forest-green suspender long dress with wide straps and simple gold buckles, '
    'white short socks, black shoes'
)
tags = (
    '1girl, solo, slight smile, looking down, simple background, book, open book, '
    'magic, from below, cowboy shot, sitting, leaning back, outstretched arm, open hand'
)
scene = (
    'Character 1 sits sideways on a partially visible carved wooden chair, caught '
    'midway through a small turning motion. Her face is near the upper-right third '
    'and remains clearly visible, with both green eyes readable. One hand presses '
    'an open antique book securely against her lap; the other reaches toward the '
    'viewer, palm upward, and becomes the near foreground gesture. '
    'Broad ivory-gold page-like streams of mana rise from the open book and curl '
    'in one clear path into her receiving palm. The nearest light fold brightens '
    'her fingertips, the book edge and the underside of her cheek. '
    'She watches the mana arrive with a small composed smile rather than attacking. '
    'Her long dark curls and green dress respond to the turning motion, forming '
    'a counter-curve around the book and arm. The face, palm and lap book are the '
    'three readable subjects of this profession-card illustration; keep the chair '
    'secondary and only partly shown. Use a few quiet pale warm background color '
    'planes and a restrained muted green shadow plane appropriate to the mana flow, '
    'without constructing a room, shelves or a scenic environment.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'boy, male, blonde hair, silver hair, blue eyes, golden eyes, straight hair, '
    'witch hat, staff, wand, cake, fork, food, giant floating book hiding face, '
    'library room, bookshelves, scenery, duplicate person, white border, inset illustration, '
    'detached torso, disembodied hand, contact sheet, character sheet'
)
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {'card_id': 'tt7-maxsupply', 'model': 'nai-diffusion-5-full',
           'width': 1024, 'height': 1024, 'seed': seed, 'parameters': DEFAULTS,
           'prompt': prompt, 'character_prompt': character, 'negative_prompt': uc,
           'design': '白塔坐姿半转身，一手压膝上书，一手向前接金白页状魔力，脸/掌/书近中景。',
           'output': str(output)}
(EVIDENCE / 'nai-request.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character,
                                   width=1024, height=1024, seed=seed,
                                   out=output, model=request['model'])
result = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps({
    'path': str(result), 'seed': actual_seed, 'model': request['model'],
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
