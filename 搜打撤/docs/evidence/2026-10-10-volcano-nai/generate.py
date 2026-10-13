"""老板授权的单张 NAI 候选；使用现行共享客户端和提示词构建器。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, MODEL, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc, RECIPE_VERSION, CLEANUP_VERSION

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai.png'
if OUTPUT.exists():
    raise SystemExit('本次候选已存在，停止以避免重复生成或覆盖。')

identity = (
    '1boy, solo, adult male, male mage, refined masculine face, longer face proportions, '
    'restrained narrow golden eyes, thin round eyeglasses, pointed ears, silver gray hair, '
    'low hair bun behind head, two long sidelocks over shoulders, '
    'black bent-tip wide-brim witch hat with purple lining, black high-collared robe, '
    'violet cloak lining, restrained gold edging, black gloves, '
    'white feather and blue sapphire gold clasp brooch on his left chest, '
    'composed small smile, no staff'
)
composition = (
    'Elevated diagonal camera looking down. The mage head, broad hat and upper torso occupy '
    'the upper-left third. One black-gloved hand reaches diagonally toward the lower right. '
    'Three dark spell-paper silhouettes descend from the glove into an eruptive magical '
    'funnel at lower right. One large curved energy sweep connects the upper-right edge '
    'with the funnel, forming a clear diagonal and curved visual path. '
    'Keep a small pale hot center surrounded by broad gold, ivory and restrained orange '
    'energy shapes, with quiet deep blue-gray negative space between mage and eruption. '
    'No physical landscape or held round fireball. Face and reaching hand remain readable.'
)
style_adjustment = (
    '1.25::large connected opaque color masses, broad directional brushwork, '
    'grouped light and shadow planes, selective detail::, '
    'matte muted colored grays with a concentrated gold-orange accent. '
    'Group hair into a few substantial locks and robe into principal fold planes. '
    'Resolve the anime face, glasses, eyes and glove gesture clearly; leave coat surfaces '
    'and background quieter. Paint the eruption with a few confident curved wide strokes. '
    'Brush marks describe form and motion; do not add uniform surface grain or fine scratches. '
    'Reduce decorative trimming and isolated bright flecks.'
)
prompt = build_asset_prompt(
    'One male mage channels energy from consumed spell cards into a volcanic eruption.',
    purpose_layer='One square ability-card illustration for 充能火山, without card frame or text.',
    composition_layer=composition,
    light_material_layer=style_adjustment,
)
uc = build_uc(
    'girl, woman, female, breasts, feminine face, child, baby face, loose unbound long hair, '
    'staff, wand, tiny hair strands, dense wrinkles, ornate filigree, '
    'fragmented polygon facets, fine sparks confetti, all-over grain overlay, '
    'thick oil paint ridges, realistic landscape, photorealism'
)
request = {
    'card_id': 'tt8-hero-descender', 'channel': 'NovelAI via tools/nai_gen.py',
    'model': MODEL, 'recipe_version': RECIPE_VERSION, 'cleanup_version': CLEANUP_VERSION,
    'width': 1024, 'height': 1024, 'seed': 101010031, 'parameters': DEFAULTS,
    'prompt': prompt, 'negative_prompt': uc, 'character_prompt': identity,
    '中文调整': '保持共享配方v1.3；仅本次加强大色面、方向性宽笔、明暗分组与脸手选择性细化，减少碎发碎褶与装饰。男性身份单列角色栏。',
    '人设来源': 'docs/character-bible/changwuyu.md现行权威；人物立绘只作人工核对，本客户端没有传输参考图。',
    'output': str(OUTPUT), 'installed': False,
}
(EVIDENCE / 'request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, char_prompt=identity, width=1024, height=1024,
                            seed=request['seed'], out=OUTPUT, model=MODEL)
result = Path(path)
receipt = {'path': str(result), 'seed': seed, 'model': MODEL,
           'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
           'request': 'request.json', 'installed': False}
(EVIDENCE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
