"""Generate the reviewed, frozen v3 background request once through the shared guard."""
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen

prepared = json.loads((HERE / 'request-v3-background-prepared.json').read_text(encoding='utf-8'))
request = prepared['request']
p = request['parameters']
out = ROOT.parent / '.tmp/nai/wu-snow-road-nai45-20261016-v3.png'
receipt = HERE / 'request-v3-generated.json'
assert not out.exists() and not receipt.exists(), 'Preserve existing result.'
characters = [{'prompt': c['prompt'], 'uc': c['uc'], 'center': c['center']}
              for c in p['characterPrompts']]
kwargs = dict(width=p['width'], height=p['height'], seed=p['seed'], model=request['model'],
              char_prompts=characters, use_coords=p['use_coords'])
assert nai_gen.build_payload(request['input'], p['negative_prompt'], **kwargs) == request
assert 'goggles' not in request['input'] + characters[0]['prompt']
assert 'goggles' in characters[0]['uc']
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('ALL_PROXY')
assert proxy, 'Expected verified current proxy environment.'

def transport(payload_file, zip_file, token, channel):
    return nai_gen._requests_request(payload_file, zip_file, token, ['-x', proxy])

record = dict(status='prepared', prepared_source='request-v3-background-prepared.json', request=request,
              output=str(out.relative_to(ROOT.parent)).replace('\\', '/'),
              method='Shared nai_gen/nai_guard, current environment HTTPS proxy, one candidate',
              raw_t5_budget=prepared['raw_t5_budget'])

def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

save()
try:
    path, seed = nai_gen.generate_image(request['input'], p['negative_prompt'], out=out,
                                       transport=transport, **kwargs)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, bytes=out.stat().st_size,
              sha256=hashlib.sha256(out.read_bytes()).hexdigest())
save()
print(json.dumps({'status': record['status'], 'output': str(out), 'sha256': record['sha256']}))
