import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_style

source = PROJECT / 'docs/evidence/2026-10-16-nai-default-wide/approved.request.json'
original = json.loads(source.read_text(encoding='utf-8'))
base = original.get('request', original)
p = base['parameters']
prompt = base['input']
# Apply exactly the authorized v3.0 -> v3.1 wording changes to the approved
# request, preserving all original dinner, framing, lighting and identity text.
replacements = [
    ('Construct hair and clothing from', 'Construct clothing from'),
    ('Use clear grouped shadows,', 'Hair consists of broad flowing locks with irregular painted highlights and shadow masses. Use clear grouped shadows,'),
    ('the hair, fabric and kitchen.', 'the hair and fabric.'),
    ('Alternate crisp focal edges with softer background edges while keeping contours complete.', 'Use lost-and-found edges, with crisp focal edges and softer turning edges.'),
    ('high complexity, very aesthetic, masterpiece, no text', 'very aesthetic, masterpiece, no text'),
]
for old, new in replacements:
    assert prompt.count(old) == 1, 'Unexpected approved prompt: ' + old
    prompt = prompt.replace(old, new)
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = p['characterPrompts']
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']} for c in characters]
uc = p['negative_prompt']
model = 'nai-diffusion-4-5-full'
output = PROJECT.parent / '.tmp/nai/wu-style-step1-20261016/wu-v31-original-dinner45.png'
receipt = Path(__file__).with_name('original-dinner45-request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=p['width'], height=p['height'],
                               seed=p['seed'], model=model, char_prompts=characters,
                               use_coords=p['use_coords'])
assert request['parameters']['characterPrompts'] == p['characterPrompts']
assert request['parameters']['negative_prompt'] == p['negative_prompt']
assert 'braised meat' in prompt and 'chopsticks' in prompt
record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION,
              source='docs/evidence/2026-10-16-nai-default-wide/approved.request.json',
              source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              purpose='Corrected dinner: reuse prior chat approved rice-bowl/chopsticks/braised-meat scene and character slot; apply authorized v3.1 wording and NAI4.5 model only. Preview, not integrated.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=p['width'], height=p['height'],
                                     seed=p['seed'], model=model, char_prompts=characters,
                                     use_coords=p['use_coords'], out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
