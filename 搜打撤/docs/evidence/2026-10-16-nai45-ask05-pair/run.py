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
batch = json.loads((HERE.parent / '2026-10-16-nai45-ablation/manifest.json').read_text(encoding='utf-8'))
source = next(item for item in batch['items'] if item['id'] == 'E')
base = source['request']
p = base['parameters']
chain = '0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::, 0.5::ask (askzy)::'
replacement = '0.9::quasarcake::, 0.5::rella::, 0.5::ask (askzy)::'
assert base['input'].count(chain) == 1
prompt = base['input'].replace(chain, replacement)
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
out = PROJECT.parent / '.tmp/nai/nai45-ask05-pair-20261016/I.png'
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
record = dict(status='prepared', source='../2026-10-16-nai45-ablation/manifest.json#E',
              instruction='Remove piromizu and gomzi; ASK 0.5. Continue previous 4.5 experiment.',
              artist_chain=replacement, request=request, output_relative=out.relative_to(PROJECT.parent).as_posix(),
              validation={'full_payload_diff_guard': 'passed; only artist chain changed from E'},
              scope='One fixed-seed sample; shared defaults unchanged; high complexity retained.')
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, p['negative_prompt'], out=str(out), **kwargs)
    with Image.open(path) as im:
        assert im.size == (p['width'], p['height'])
        record['size'] = list(im.size)
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
    print(json.dumps({k: record[k] for k in ('status', 'output_relative', 'sha256', 'size')}, ensure_ascii=False))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
