import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

previous = json.loads(Path(__file__).with_name('preview-request.json').read_text(encoding='utf-8'))
p = previous['request']['parameters']
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = previous['request']['parameters']['characterPrompts']
characters = [{'prompt': characters[0]['prompt'], 'uc': '', 'center': {'x': .6, 'y': .5}}]
prompt = style.build_asset_prompt(
    '1girl, solo, sitting at a dining table, eating dinner, upper body, three-quarter view, looking at viewer, cheerful confident smile, small fang. She holds a steamed bun near her mouth with one hand; the other hand rests beside a bowl of hot soup on the table.',
    composition_layer='Wide landscape illustration. The woman occupies the right half, her face, hands and bun clearly visible. A bowl of soup, a small plate of buns and chopsticks sit on the table in the foreground. Quiet modern kitchen in the background with simple cabinetry and a closed window.',
    light_material_layer='Warm indoor light illuminates her face and silver ponytail. Cool blue evening light remains outside the window. Matte charcoal clothing, ceramic bowl with a small highlight, soft steam rising above the soup. Broad quiet background shapes keep attention on her expression and eating gesture.')
uc = style.build_uc('witch hat, wizard hat, stockings, hair over one eye, multiple girls, rose on cheek, flower earrings, holding sword, unsheathed sword, food covering face')
seed = p['seed']
model = 'nai-diffusion-4-5-full'
output = PROJECT.parent / '.tmp/nai/wu-style-step1-20261016/wu-v31-dinner45.png'
receipt = Path(__file__).with_name('dinner45-request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=p['width'], height=p['height'],
                               seed=seed, model=model, char_prompts=characters)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              purpose='User requested Wu eating dinner with NAI 4.5; preserve v3.1 style, artist chain and previous sampling. Preview only.',
              identity_reference=previous['identity_reference'],
              comparison_note='Model and scene changed together at user request; not a single-variable comparison. Shared defaults remain unchanged.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, width=p['width'], height=p['height'],
                                            seed=seed, model=model,
                                            char_prompts=characters, out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
