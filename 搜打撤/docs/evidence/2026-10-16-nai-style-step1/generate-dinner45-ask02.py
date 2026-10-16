import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

source = Path(__file__).with_name('dinner45-free-request.json')
prior = json.loads(source.read_text(encoding='utf-8'))
base = prior['request']
p = base['parameters']
old_chain = '0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::'
new_chain = old_chain + ', 0.2::ask (askzy)::'
assert base['input'].count(old_chain) == 1
prompt = base['input'].replace(old_chain, new_chain)
assert prompt.endswith('very aesthetic, masterpiece, no text')
prompt = prompt[:-len('very aesthetic, masterpiece, no text')] + 'high complexity, very aesthetic, masterpiece, no text'
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']}
              for c in p['characterPrompts']]
output = Path(prior['output']).with_name('wu-dinner45-ask02-high-complexity.png')
receipt = Path(__file__).with_name('dinner45-ask02-request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, p['negative_prompt'], width=p['width'], height=p['height'],
                               seed=p['seed'], model=base['model'], char_prompts=characters,
                               use_coords=p['use_coords'])
expected = json.loads(json.dumps(base))
expected['input'] = prompt
expected['parameters']['v4_prompt']['caption']['base_caption'] = prompt
assert request == expected, 'Unexpected changes outside requested prompt text'
record = dict(status='prepared', source=source.name,
              purpose='User requested original four-artist chain plus 0.2 ASK and restored high complexity, on NAI4.5. Both edits made together as requested; shared defaults unchanged. Preview only.',
              artist_chain=new_chain, quality_tail='high complexity, very aesthetic, masterpiece, no text',
              identity_reference=prior['identity_reference'], request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, p['negative_prompt'], width=p['width'], height=p['height'],
                                    seed=p['seed'], model=base['model'], char_prompts=characters,
                                    use_coords=p['use_coords'], out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
