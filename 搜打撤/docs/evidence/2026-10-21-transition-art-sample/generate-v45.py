import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

HERE = Path(__file__).resolve().parent
original = json.loads((HERE / 'nai-request.json').read_text(encoding='utf-8'))
base = original['request']
params = base['parameters']
assert (params['width'], params['height'], params['steps'], params['n_samples']) == (1344, 768, 28, 1)
model = 'nai-diffusion-4-5-full'
output = PROJECT.parent / '.tmp/nai/transition-art-sample-20261021/nai-v45.png'
receipt = HERE / 'nai-request-v45.json'
assert not output.exists() and not receipt.exists(), 'Do not overwrite an existing attempt.'
request = nai_gen.build_payload(base['input'], params['negative_prompt'],
                               width=1344, height=768, seed=params['seed'],
                               model=model, char_prompts=[])
record = dict(status='prepared', comparison='仅模型从V5 Full改为V4.5 Full；提示词、种子、尺寸及采样不变',
              request=request, output=str(output), acquisition='nai_gen.generate_image')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(base['input'], params['negative_prompt'],
                                         width=1344, height=768, seed=params['seed'],
                                         model=model, out=output, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, bytes=Path(path).stat().st_size,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
