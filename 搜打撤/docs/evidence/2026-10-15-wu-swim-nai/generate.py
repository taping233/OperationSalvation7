import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

output = ROOT.parent / '.tmp/nai/wu-swim-20261015/wu-swim-nai.png'
receipt = Path(__file__).with_name('request.json')
assert not output.exists(), 'Candidate already exists'
previous = None
if receipt.exists():
    previous = json.loads(receipt.read_text(encoding='utf-8'))
    assert '--retry' in sys.argv and previous['status'] == 'failed', 'Request already exists'
prompt = style.build_asset_prompt(
    '1girl, solo, sitting sideways on the edge of a waterfront pier, looking back at viewer, smiling with a small fang. Holding a large orange and white toy water gun over her shoulder; her other hand braces on the pier behind her.',
    purpose_layer='Wide summer swimsuit skin illustration, full body.',
    composition_layer='Girl occupies the right two thirds. One bare leg stretches toward the lower left, kicking an arc of water; the other leg bends down into the sea. Long ponytail flows to the right. Open blue sea fills the left half, modern coastal city and mountains on the horizon, a few palm leaves above.',
    light_material_layer='Bright summer sunlight, clear blue sky and white clouds, sparkling turquoise water, cool shadows and warm skin highlights.')
characters = [{'prompt': 'adult woman, slender tall figure, fair skin, silver white long hair, high ponytail tied with a blue ribbon bow, parted bangs exposing forehead and both eyes, cyan blue eyes. Navy blue one-piece swimsuit patterned with large white stars, loose white long-sleeved jacket slipped off shoulders, barefoot.', 'uc': '', 'center': {'x': .67, 'y': .5}}]
uc = style.build_uc('child, loli, nude, nipples, black dress, sword, boots, stockings, hair over one eye, extra legs, extra arms, real firearm')
request = nai_gen.build_payload(prompt, uc, width=1344, height=768, seed=15102061, char_prompts=characters)
refs = [ROOT / 'game/assets/portraits/full/wu-beach.webp', ROOT / 'game/assets/portraits/full/wu.webp']
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=request,
    output=str(output), references=[dict(path=str(p), sha256=hashlib.sha256(p.read_bytes()).hexdigest(), use='visually inspected; described in text; not uploaded') for p in refs])
if previous:
    record['previous_attempt'] = previous
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1344, height=768, seed=15102061, out=output, char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
