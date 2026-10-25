import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
from nai_prompt_clean import build_asset_prompt, build_uc
from nai_style import RECIPE_VERSION

OUT = ROOT.parent / '.tmp/nai/event-option-art-1025/v3'
OUT.mkdir(parents=True, exist_ok=True)
prompt = build_asset_prompt(
    'no humans, one empty tactical fantasy game choice panel, wide horizontal painted ivory ink slab with a narrow deep turquoise header strip along the top, abstract watercolor and ink-brush UI material, no letters, no icons',
    purpose_layer='A usable original material asset for an illustrated encounter choice, inspired by a deep teal title band above an ivory brush-painted information area. This is not paper stationery and not a metal plate.',
    composition_layer='One panel centered on plain charcoal, three times wider than high. Header occupies upper one fifth. Main ivory area is clean and empty. Irregular horizontal brush fringes at the left edge and very subtle dry-brush breakup along the bottom. Right edge straight. Calm uninterrupted central 80 percent for live text.',
    light_material_layer='Deep malachite teal header, cool ivory and mist-gray brushed pigment underneath, translucent pale cyan at perimeter. Flat two-dimensional ink and matte paint, no cast shadow, no folds, no fiber paper, no bevel, no decorative border, no scenery.')
uc = ', '.join(part for part in build_uc('paper sheet, parchment, paper fibers, fold, curled edge, rounded card, ornate frame, neon, text, numbers, landscape, people, multiple panels').split(', ')
               if part not in ('negative space', 'blank page', 'frame'))
params = dict(width=1344, height=768, seed=1382502293, char_prompts=[])
record = dict(status='prepared', recipe_version=RECIPE_VERSION,
              purpose='V3 reproduce 相会 option structure; empty UI material only',
              payload=nai_gen.build_payload(prompt, uc, **params))
receipt = Path(__file__).with_name('nai-v3-request.json')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, out=OUT / 'option-draft.png', **params)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', output=str(path), seed=seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
