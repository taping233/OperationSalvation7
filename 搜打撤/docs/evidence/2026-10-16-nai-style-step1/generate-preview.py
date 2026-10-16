import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

previous = json.loads((PROJECT / 'docs/evidence/2026-10-16-wu-field-of-flowers/request-priestess-chain.json').read_text(encoding='utf-8'))
identity = previous['request']['input'].split('\n0.7::artist (far side)::')[0].rstrip(',\n ')
prompt = style.build_asset_prompt(
    '1girl, solo, upper body, three-quarter view, looking at viewer, confident smile, head tilt, one hand gently brushing her hair beside her head.',
    composition_layer='The character fills the right half of a wide composition, her face and raised hand fully visible. Quiet blue grey background with broad understated shapes.',
    light_material_layer='Soft directional cool daylight and a restrained warm reflected light illuminate the face, silver ponytail and matte charcoal dress.')
uc = style.build_uc('witch hat, wizard hat, stockings, hair over one eye, multiple girls, rose on cheek, flower earrings')
characters = [{'prompt': identity, 'uc': '', 'center': {'x': .67, 'y': .5}}]
seed = 1787339500
output = PROJECT.parent / '.tmp/nai/wu-style-step1-20261016/wu-v31-preview.png'
receipt = Path(__file__).with_name('preview-request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, seed=seed, char_prompts=characters)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              purpose='Wu preview of authorized v3.1 shared prompt; no game integration.',
              identity_reference='game/assets/portraits/full/wu.webp (inspected in this conversation, not uploaded)',
              comparison_note='Uses current default artist chain and all client defaults. Composition differs from prior external-recipe samples; not a strict visual A/B.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, seed=seed, char_prompts=characters, out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
