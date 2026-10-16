import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_style

previous = json.loads(Path(__file__).with_name('request.json').read_text(encoding='utf-8'))
original = previous['request']
parts = original['input'].split('\n\n')
assert parts.count(nai_style.ARTIST_BLOCK) == 1
prompt = '\n\n'.join(part for part in parts if part != nai_style.ARTIST_BLOCK)
p = original['parameters']
characters = [dict(prompt=c['prompt'], uc=c['uc'], center=c['center']) for c in p['characterPrompts']]
args = dict(width=p['width'], height=p['height'], seed=p['seed'], model=original['model'],
            char_prompts=characters, use_coords=p['use_coords'])
payload = nai_gen.build_payload(prompt, p['negative_prompt'], **args)
expected = json.loads(json.dumps(original))
expected['input'] = prompt
expected['parameters']['v4_prompt']['caption']['base_caption'] = prompt
assert payload == expected, 'Only the artist block may change'
output = ROOT.parent / '.tmp/nai/rain-bar-nai45-no-artists-20261016.png'
receipt = Path(__file__).with_name('request-no-artists.json')
assert not receipt.exists() and not output.exists()
record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION,
              override='Remove ARTIST_BLOCK only; preserve previous seed and all other request fields',
              request=payload, references=previous['references'], output=str(output),
              acquisition='Existing nai_gen / nai_guard client')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, p['negative_prompt'], out=output, **args)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
