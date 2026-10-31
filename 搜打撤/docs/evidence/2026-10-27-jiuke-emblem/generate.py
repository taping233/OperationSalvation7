import sys, json, hashlib
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style
OUT = PROJECT.parent / 'output/jiuke-emblem-20261027/nai45-draft.png'
prompt = style.build_asset_prompt(
    '2::original faction insignia, monochrome graphic emblem, no humans::, a compact angular interlocking silhouette made from one modern tactical rifle and one straight double-edged sword. Rifle points toward upper left, sword points toward upper right. Clear rifle barrel and magazine, clear sword tip and short crossguard. The two weapons join into one deliberate heraldic mark; broad cutout negative space at the center suggests the hooked structure of Chinese numeral nine without written typography. A small separated angular foot anchors the base.',
    purpose_layer='Original identity emblem for Section Nine, a tactical organization in a dystopian game. Professional faction logo, recognizable silhouette, screenprinted military insignia, flat graphic design takes precedence over illustration.',
    composition_layer='One emblem centered on a plain charcoal background. Strong balanced compact silhouette, generous empty margin, readable thick shapes and deliberate negative-space gaps. Weapons are integrated into a designed abstract symbol, not realistic objects laid across one another. No lettering, no border, no shield, no wreath.',
    light_material_layer='Solid warm white silhouette, charcoal cutouts, absolutely flat two-tone graphic, crisp edges, no material rendering, no glow, no scenery.')
# Logo/negative-space exclusions conflict with this explicitly requested use case.
uc = ', '.join(x.strip() for x in style.build_uc('people, character, portrait, realistic weapon render, 3d, metallic bevel, glow, gradients, ornate decoration, wings, skull, stars, typography, lettering, multiple emblems').split(',') if x.strip() not in {'logo', 'text logo', 'negative space'})
kwargs = dict(width=1344, height=768, seed=271009452, model='nai-diffusion-4-5-full', char_prompts=[])
receipt = Path(__file__).with_name('nai-request.json')
assert not receipt.exists() and not OUT.exists()
record = dict(status='prepared', request=nai_gen.build_payload(prompt, uc, **kwargs), output=str(OUT), recipe_version=style.RECIPE_VERSION, task_override='Remove logo/text logo/negative space UC terms because the requested asset is an emblem.', references=[dict(url='https://arknights-matome.blog.jp/archives/5305876.html', role='Faction silhouette and monochrome visual-language research; not uploaded or copied')])
def save():
    receipt.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, out=OUT, **kwargs)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
print(path)
