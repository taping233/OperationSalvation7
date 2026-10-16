import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

prior = json.loads(Path(__file__).with_name('dinner45-free-request.json').read_text(encoding='utf-8'))
base = prior['request']
p = base['parameters']
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']}
              for c in p['characterPrompts']]
model, width, height = 'nai-diffusion-5-full', 1344, 768
output = Path(prior['output']).with_name('wu-v31-dinner5-wide-free.png')
receipt = Path(__file__).with_name('dinner5-wide-request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(base['input'], p['negative_prompt'], width=width, height=height,
                               seed=p['seed'], model=model, char_prompts=characters,
                               use_coords=p['use_coords'])
record = dict(status='prepared', recipe_version=prior['recipe_version'],
              source='dinner45-free-request.json',
              purpose='User requested V5 landscape dinner preview. Same positive/negative text, artist chain, identity, seed and sampling as V4.5 free sample; V5 Full and 1344x768 normal-size landscape. Shared defaults unchanged; not integrated.',
              identity_reference=prior['identity_reference'], request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(base['input'], p['negative_prompt'], width=width, height=height,
                                    seed=p['seed'], model=model, char_prompts=characters,
                                    use_coords=p['use_coords'], out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
