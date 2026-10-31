import sys, json, hashlib
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style
OUT = PROJECT.parent / 'output/jiuke-emblem-20261027/nai45-redesign-v2.png'
prompt = style.build_asset_prompt(
    'Original Section Nine faction crest, a compact sophisticated military heraldic insignia. One long upright silver straight sword is the central axis. An abstract short tactical rifle sweeps diagonally behind its center, seamlessly integrated into a broken angular circular band forming a subtle numeral nine. Unified compact silhouette, one central hexagonal mechanical joint, disciplined large cutouts. Finely designed rather than realistic equipment. No humans.',
    purpose_layer='Premium colored faction insignia for a dystopian tactical game. Elegant game emblem, sophisticated symbolism, harmonious designed proportions, icon illustration.',
    composition_layer='Single centered crest, nearly upright compact silhouette occupying middle 65 percent of canvas, isolated on plain dark charcoal. Sword tip above, gun barrel briefly extends upper left, band returns at lower right with one tapered terminal. Original shape design, restrained detailing.',
    light_material_layer='Deep petrol teal enamel fields, pale champagne brushed metal rim, cool ivory silver sword. Restrained bevel planes, selective edge highlights, a few precise geometric engraved lines at the central joint, rich controlled shadows, no glowing effects. Refined designed artifact, not photorealistic.')
# Logo/negative-space exclusions conflict with this explicitly requested use case.
uc = ', '.join(x.strip() for x in style.build_uc('people, character, portrait, realistic weapon render, 3d, metallic bevel, glow, gradients, ornate decoration, wings, skull, stars, typography, lettering, multiple emblems').split(',') if x.strip() not in {'logo', 'text logo', 'negative space'})
kwargs = dict(width=1344, height=768, seed=271009453, model='nai-diffusion-4-5-full', char_prompts=[])
receipt = Path(__file__).with_name('nai-request-v2.json')
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
