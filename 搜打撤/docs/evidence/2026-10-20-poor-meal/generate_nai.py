import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

output = ROOT / '.tmp/nai/poor-meal-1020/draft.png'
output.parent.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    'no humans, still life, a pauper survival meal kit, one battered oval tin mess tray containing half a small coarse bread roll and a tiny enamel cup of thin clear soup, one simple bent metal spoon resting diagonally across the tray rim, frayed cloth tied under the tray',
    purpose_layer='Equipment card illustration, humble inexpensive survival gear, a single compact coherent silhouette, no lettering or numbers.',
    composition_layer='Three-quarter overhead close-up. Entire meal kit fully visible in the central square region of this wide canvas, subject occupies center 55 percent of width and 75 percent of height. Bread on left, soup cup upper right, spoon diagonal across front rim. Quiet empty side margins for a later square composition. No additional dishes.',
    light_material_layer='Muted olive gray background in broad simple color areas, warm ochre bread as the focus, cool dull gray tin and one restrained cream highlight. Simple abstract backdrop, no room, no table setting, no decorative objects.')
uc = style.build_uc('people, person, hands, banquet, abundant food, meat, luxury tableware, letters, numbers, split screen')
payload = nai_gen.build_payload(prompt, uc, seed=10202061)
record = dict(status='prepared', request=payload, references=[], output=str(output))
receipt = Path(__file__).with_name('nai-request.json')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
assert not output.exists() and not receipt.exists()
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, seed=10202061, out=output)
    record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
save()
