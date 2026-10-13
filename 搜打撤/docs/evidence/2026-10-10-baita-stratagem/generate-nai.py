"""白塔法师锦囊职业卡，单张NAI分镜草稿。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
output = PROJECT.parent / '.tmp/nai/output/baita-stratagem-20261010/draft.png'
if output.exists():
    raise SystemExit('本轮草稿已存在，停止重复生成。')
character = (
    'girl, young adult woman, gentle composed anime face, emerald green eyes, '
    'very long dark brown wavy curly hair, swept bangs, two small gold hairclips '
    'keeping both eyes visible, white long-sleeved high-collar blouse with cuff buttons, '
    'dark forest-green suspender long dress with wide straps and simple gold buckles, '
    'white short socks, black shoes'
)
tags = (
    '1girl, solo, slight smile, looking down, simple background, pouch, drawstring, '
    'magic, from side, upper body, sitting, leaning forward, holding, hands up'
)
scene = (
    'Character 1 is seated and turning slightly toward the viewer, her face near '
    'the upper-left third in a three-quarter view with both green eyes readable. '
    'The camera is close to a small gold-trimmed dark-green spell sachet in the '
    'lower foreground, making the pouch opening and working hands prominent. '
    'Her near hand holds the pouch open. With two fingers of her other hand she '
    'picks one ivory-gold folded spell leaf out of its mouth. That selected leaf '
    'begins to unfold toward the right into a broad clean magical ribbon. '
    'Exactly two other folded spell leaves remain partly tucked at the opening, '
    'secondary to the one she selects. The pouch, nearer fingers and selected '
    'spell form a diagonal across the foreground; her clear face watches from '
    'above. Her long curls and shoulder line follow the small turning motion. '
    'Keep the supporting chair only partly visible and her torso continuous '
    'through the crop. The little pouch should feel like it stores concentrated '
    'knowledge rather than money. Use a few quiet abstract color planes that '
    'support the gold magical leaf and separate dark-green dress from dark-brown '
    'hair, without a literal room, shelving, scenery or decorative particles.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'boy, male, blonde hair, silver hair, straight hair, blue eyes, golden eyes, '
    'witch hat, staff, wand, cake, fork, food, coins, money bag, giant sack, '
    'giant book covering face, library room, bookshelves, duplicate person, '
    'white border, inset illustration, disembodied hand, contact sheet, character sheet'
)
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {'card_id': 'tt7-stratagem', 'model': 'nai-diffusion-5-full',
           'width': 1024, 'height': 1024, 'seed': seed, 'parameters': DEFAULTS,
           'prompt': prompt, 'character_prompt': character, 'negative_prompt': uc,
           'design': '白塔坐姿侧转，近手开锦囊，另一手拈出正在展开的一道光页，另两道留袋口。',
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
