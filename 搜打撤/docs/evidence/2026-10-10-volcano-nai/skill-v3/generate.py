"""按 nai5-prompting 学习结果，离散事实用词组，关系用句子，V5 单张。"""
import hashlib
import json
import secrets
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc, ARTIST_BLOCK, RECIPE_VERSION

EVIDENCE = Path(__file__).resolve().parent
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v3.png'
if output.exists():
    raise SystemExit('已存在本次候选，禁止重复请求或覆盖。')

tags = (
    '1boy, solo, calm expression, slight smile, looking down, '
    'dark background, fire, magic, floating cards, limited palette, '
    'from above, upper body, leaning forward, outstretched arm, open hand'
)
relations = (
    'Character 1 occupies the upper-left of the square composition, with his reaching '
    'hand nearer to the viewer at the center. His torso remains joined to that arm '
    'and continues out of the lower-left crop. '
    'He releases three small black spell cards toward a fiery vortex at the lower right. '
    'The cards recede along a diagonal, their edges burning away as they feed the eruption. '
    'A broad orange-gold surge curls up the right edge from a small ivory hot core, '
    'leaving deep ink-blue and charcoal-violet negative space inside the curve. '
    'The surge lights his fingers and cheek from below and pulls the cloak along its flow.'
)
paint = (
    'opaque broad color masses, clear shadow planes, grouped hair locks, '
    'principal cloth folds, matte painting, selective facial detail. '
    'Paint the volcanic surge in a few broad directional swipes; keep dark surfaces quiet. '
    'The background is abstract volcanic pressure expressed by dark color layers '
    'and eruptive fire, not a physical mountain or a landscape.'
)
assembled = build_asset_prompt(tags, composition_layer=relations, light_material_layer=paint)
# 保留项目提供的画师串/画风块；人数前置，去掉该次不需要的质量尾重复词。
prefix = ARTIST_BLOCK + '\n\n' + tags
if not assembled.startswith(prefix):
    raise SystemExit('共享提示词构建结构变化，停止核对。')
prompt = tags + '\n\n' + ARTIST_BLOCK + assembled[len(prefix):]
prompt = prompt.replace('masterpiece, best quality, ', '', 1)
character = (
    'boy, adult male, slender masculine face, silver-gray hair, long hair, low hair bun, '
    'two long sidelocks, golden eyes, pointy ears, thin round glasses, '
    'black bent-tip wide-brim witch hat, purple hat lining, '
    'black high-collared long robe, purple cloak lining, gold trim, black gloves, '
    'white feather and blue sapphire gold clasp brooch on his left chest'
)
uc = build_uc(
    'female, child, breasts, staff, wand, white background, detached torso, '
    'disembodied hand, contact sheet, character sheet, realistic landscape, '
    'crescent moon, thin flame jet, dense fine strokes, grain overlay, ornate filigree'
)
seed = 100_000_000 + secrets.randbelow(1_900_000_001)
request = {
    'model': 'nai-diffusion-5-full', 'recipe_version': RECIPE_VERSION,
    'width': 1024, 'height': 1024, 'seed': seed, 'parameters': DEFAULTS,
    'prompt': prompt, 'character_prompt': character, 'negative_prompt': uc,
    'skill': 'C:/Users/太平/.zcode/skills/nai5-prompting/SKILL.md',
    'checks': {
        'one_count_in_main': True, 'character_starts_with_boy': True,
        'appearance_only_in_character': True, 'camera_pose_as_phrases': True,
        'one_background_kind': 'dark background', 'relations_as_sentences': True,
        'artist_source': 'tools/nai_style.py ARTIST_BLOCK，项目已提供，不自编',
        'uc_source': '项目build_uc基线与本图排除项，API预设none，无前端预设重复',
        'seed': '本轮随机，不复用固定对照seed',
    },
    'installed': False,
}
(EVIDENCE / 'request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character, width=1024,
                                   height=1024, seed=seed, out=output,
                                   model=request['model'])
result = Path(path)
(EVIDENCE / 'receipt.json').write_text(json.dumps({
    'path': str(result), 'model': request['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
