import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen

source = Path(__file__).resolve().with_name('request.json')
original = json.loads(source.read_text(encoding='utf-8'))
request = original['request']
params = request['parameters']
output = ROOT.parent / '.tmp/nai/changwuyu-drums-20261018/candidate-free.png'
receipt = Path(__file__).with_name('request-free.json')
assert not receipt.exists() and not output.exists(), 'Use a new candidate path.'
characters = params['characterPrompts']
width, height = 1344, 768
assert width * height < nai_gen.FREE_PX_CAP and nai_gen.DEFAULTS['steps'] <= 28
request = nai_gen.build_payload(request['input'], params['negative_prompt'],
    width=width, height=height, seed=params['seed'], model=request['model'],
    char_prompts=characters, use_coords=params['use_coords'])
record = dict(status='prepared', recipe_version=original['recipe_version'],
    cleanup_version=original['cleanup_version'], request=request,
    references=original['references'], output=str(output),
    source_request=str(source.relative_to(ROOT)),
    change='User authorized free-tier landscape size; only width/height changed.',
    scope='One candidate only; no runtime asset replacement')

def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

save()
try:
    path, actual_seed = nai_gen.generate_image(request['input'], params['negative_prompt'],
        width=width, height=height, seed=params['seed'], model=request['model'],
        out=output, char_prompts=characters, use_coords=params['use_coords'])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=actual_seed,
    sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
