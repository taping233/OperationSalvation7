import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

HERE = Path(__file__).resolve().parent
base = json.loads((HERE / 'nai-request-v45.json').read_text(encoding='utf-8'))['request']
params = base['parameters']
model = 'nai-diffusion-4-5-full'
output = PROJECT.parent / '.tmp/nai/transition-art-sample-20261021/nai-v45-small.png'
receipt = HERE / 'nai-request-v45-small.json'
assert not output.exists() and not receipt.exists(), 'Do not overwrite an existing attempt.'
request = nai_gen.build_payload(base['input'], params['negative_prompt'],
                               width=768, height=512, seed=params['seed'],
                               model=model, char_prompts=[])
assert request['parameters']['steps'] == 28 and request['parameters']['n_samples'] == 1
record = dict(status='prepared', comparison='4.5小图单次测试；仅改尺寸为768×512，沿原词和种子',
              request=request, output=str(output), acquisition='nai_gen.generate_image')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(base['input'], params['negative_prompt'],
                                       width=768, height=512, seed=params['seed'],
                                       model=model, out=output, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, bytes=Path(path).stat().st_size,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
