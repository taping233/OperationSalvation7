"""老板纠正：暗牧仍金发，表达更有变化，恶魔之力改暗底。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
prior = json.loads((EVIDENCE / 'nai-dark-priest-request.json').read_text(encoding='utf-8'))
original = next(r for r in json.loads((EVIDENCE / 'nai-requests.json').read_text(encoding='utf-8')) if r['id'] == 'demon')
tags = original['tags'].replace('focused expression, looking down',
                                'smirk, narrowed eyes, looking at viewer').replace('simple background', 'dark background')
character = prior['character_prompt'].replace('calm cold delicate anime face', 'delicate anime face')
character = character.replace('silver-white long hair', 'pale golden long hair with a warm gold base color')
scene = original['scene'].replace('long braid and teal cape', 'long braid and cape')
scene = scene.replace('expression controlled rather than monstrous',
    'expression showing a sharp controlled smirk and tension in the brow as she masters the borrowed force')
scene = scene.replace(
    'Use quiet abstract background color planes chosen to separate ivory dress, '
    'teal cape and dark claw; the torso continues through the crop.',
    'Use subdued charcoal, muted black-violet and deep burgundy abstract background '
    'planes extending to all four edges. The pale face and golden hair remain '
    'separate from the black-gray robe and shadow claw. Red energy is the small '
    'concentrated accent; the torso and robe continue through the lower crop.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'boy, male, silver hair, white hair, gray hair, white crescent clip, '
    'white priestess dress, teal cape, horns on character, lamp, lantern, '
    'blood, wound, gore, full demon body, multiple people, white background, '
    'white border, bright pastel background, inset illustration, detached torso, '
    'contact sheet, character sheet'
)
output = PROJECT.parent / '.tmp/nai/output/demon-darkform-20261010/demon-dark-priest-gold.png'
if output.exists():
    raise SystemExit('本轮正确金发草稿已存在，停止重复生成。')
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {**original, 'prompt': prompt, 'character_prompt': character,
           'negative_prompt': uc, 'seed': seed, 'output': str(output),
           'correction': '暗牧仍金发；银白误判与光牧稿均未接入；表情改带紧张眉眼的锐利冷笑，不用白底'}
(EVIDENCE / 'nai-corrected-request.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character, width=1024,
                                   height=1024, seed=seed, out=output, model=original['model'])
result = Path(path)
(EVIDENCE / 'nai-corrected-receipt.json').write_text(json.dumps({
    'path': str(result), 'model': original['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
