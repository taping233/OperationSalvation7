"""老板纠正恶魔之力暗牧身份，只重出该卡NAI草稿。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
original = next(r for r in json.loads((EVIDENCE / 'nai-requests.json').read_text(encoding='utf-8')) if r['id'] == 'demon')
scene = original['scene'].replace('long braid and teal cape', 'long braid and cape')
scene = scene.replace('ivory dress, teal cape and dark claw', 'silver hair, dark priestess robe and dark claw')
character = (
    'girl, young adult woman, calm cold delicate anime face, purple eyes, '
    'silver-white long hair, straight bangs, long sidelocks and side braid '
    'gathered into low ponytail, dark black-indigo crescent hairclip above bangs '
    'on viewer-right, black-gray high-collared priestess long robe, '
    'muted purple short cape with restrained gold edging, black gloves'
)
prompt = build_asset_prompt(original['tags'], composition_layer=scene)
uc = build_uc(
    'boy, male, blonde hair, golden hair, golden eyes, white crescent clip, '
    'white priestess dress, teal cape, horns on character, lamp, lantern, '
    'blood, wound, gore, full demon body, multiple people, white border, '
    'inset illustration, detached torso, contact sheet, character sheet'
)
output = PROJECT.parent / '.tmp/nai/output/demon-darkform-20261010/demon-dark-priest.png'
if output.exists():
    raise SystemExit('暗牧草稿已存在，禁止重复生成。')
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {**original, 'prompt': prompt, 'character_prompt': character,
           'negative_prompt': uc, 'seed': seed, 'output': str(output),
           'identity_source': '老板明确暗牧；当前禁咒I/IV和xingyue.md新增段',
           'previous_light_priest_draft': 'demon.png（身份错误，未接入）'}
(EVIDENCE / 'nai-dark-priest-request.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character, width=1024,
                                   height=1024, seed=seed, out=output, model=original['model'])
result = Path(path)
(EVIDENCE / 'nai-dark-priest-receipt.json').write_text(json.dumps({
    'path': str(result), 'model': original['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
