import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

HERE = Path(__file__).resolve().parent
RECEIPT = HERE / 'request.json'
assert not RECEIPT.exists(), 'Existing request; inspect before retry.'
prior = json.loads((HERE.parent / '2026-10-16-nai-v32-dinner/request.json').read_text(encoding='utf-8'))
base = prior['request']
p = base['parameters']
chain = '0.9::quasarcake::, 0.5::rella::, 0.5::ask (askzy)::'
assert base['input'].count(chain) == 1
prompt = base['input'].replace(chain, '0.5::ask (askzy)::')
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']}
              for c in p['characterPrompts']]
kwargs = dict(width=p['width'], height=p['height'], seed=p['seed'], model=base['model'],
              char_prompts=characters, use_coords=p['use_coords'])
request = nai_gen.build_payload(prompt, p['negative_prompt'], **kwargs)
expected = json.loads(json.dumps(base))
expected['input'] = prompt
expected['parameters']['v4_prompt']['caption']['base_caption'] = prompt
assert request == expected, 'Unexpected parameter change'
out = PROJECT.parent / '.tmp/nai/nai-v5-ask-only-20261016/wu-ask05.png'
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
record = dict(status='prepared', source='../2026-10-16-nai-v32-dinner/request.json',
              artist_chain='0.5::ask (askzy)::', request=request,
              scope='Single sample removing quasarcake/rella only; shared v3.2 defaults unchanged.',
              validation={'full_payload_diff_guard': 'passed; only artist chain and synchronized caption changed'},
              output_relative=out.relative_to(PROJECT.parent).as_posix())
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, p['negative_prompt'], out=str(out), **kwargs)
    with Image.open(path) as im:
        assert im.size == (p['width'], p['height'])
        record['size'] = list(im.size)
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(), bytes=Path(path).stat().st_size)
    save()
    print(json.dumps({k: record[k] for k in ('status', 'output_relative', 'sha256', 'size')}, ensure_ascii=False))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
