import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
from nai_prompt_clean import build_asset_prompt, build_uc
from nai_style import RECIPE_VERSION

OUT = ROOT.parent / '.tmp/nai/event-option-art-1025'
OUT.mkdir(parents=True, exist_ok=True)
prompt = build_asset_prompt(
    'no humans, a single blank wide horizontal game decision banner, mineral-white coated archival paper laminated over dark slate-blue ink, front orthographic view, isolated graphic design material',
    purpose_layer='Original painted interface material for a winter-city exploration event choice. The center is an uninterrupted pale ivory writing area; no text, no symbols, no scenery.',
    composition_layer='One continuous horizontal banner spanning almost the full canvas width, centered vertically, approximately five times wider than tall. Straight left edge with a narrow dark registration tab, subtly irregular dry-brush feathered right edge, calm blank central 80 percent. Plain neutral dark background around the banner.',
    light_material_layer='Matte chalk white, very pale gray-green, desaturated charcoal blue. Delicate edge fibers and layered painted ink only at the perimeter, broad clean central color, no glossy bevel, no glow, no metal frame.')
# This task needs a blank UI material rather than a finished scene/portrait.
uc = ', '.join(part for part in build_uc('landscape, people, architecture, multiple panels, letters, numbers, rounded rectangle, neon, ornate border').split(', ')
               if part not in ('negative space', 'blank page', 'frame'))
params = dict(width=1344, height=768, seed=1382502257, char_prompts=[])
record = dict(status='prepared', purpose='event option material only; retain scene background',
              recipe_version=RECIPE_VERSION, payload=nai_gen.build_payload(prompt, uc, **params))
receipt = Path(__file__).with_name('nai-request.json')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    source, seed = nai_gen.generate_image(prompt, uc, out=OUT / 'option-draft.png', **params)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', output=str(source), seed=seed,
              sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest())
save()
