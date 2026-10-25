import sys, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style
out = ROOT / '.tmp/nai/astrolabe-simple-1024/nai.png'
prompt = style.build_asset_prompt(
    'no humans, single equipment item, a simple handheld circular astrolabe, one thick brass outer rim, one flat disk divided into two broad halves of dull gold and dark cobalt blue, one short broad two-ended pointer with a plain center pin, only four widely spaced short marks',
    purpose_layer='Fantasy game equipment illustration, clear economical silhouette, ordinary useful magical instrument, simple enough to read as a tiny card image.',
    composition_layer='Entire isolated object centered with wide empty margins, slight three-quarter overhead view showing modest disk thickness. Object occupies about sixty percent of canvas height. Solid uniform muted dark teal background with exactly one flat color edge to edge; no environment, no ground, no backdrop brush strokes, no gradients, no halo, no cast shadow.',
    light_material_layer='Muted matte metal with just two broad light planes and one shadow plane, sparse confident painted marks, quiet flat dial surfaces, a single small pale star mark on the blue half. Minimal details, no shine effects.')
uc = style.build_uc('ornate, filigree, elaborate, complex mechanism, gears, overlapping rings, armillary sphere, double disks, orbit, lettering, numbers, dense tick marks, gemstone, particles, starfield, texture background, gradient background, spotlight, halo, glowing, polished metal, photorealistic, cast shadow')
payload = nai_gen.build_payload(prompt, uc, seed=3075149682, char_prompts=[])
record = dict(status='prepared', card_id='tt13-astrolabe', request=payload, output=str(out), feedback='老板否定内部首版，改NAI加内置；背景纯色凸显主体')
receipt = Path(__file__).with_name('nai-request.json')
def save(): receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, seed=3075149682, out=out, char_prompts=[])
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
    print(path)
except BaseException as e:
    record.update(status='failed', error_type=type(e).__name__)
    save()
    raise
