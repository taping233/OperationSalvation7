"""Reuse the frozen v3 request, changing only the generation model to V5."""
import copy
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

SOURCE = HERE / 'request-v3.json'
RECEIPT = HERE / 'request-v3-v5.json'
OUTPUT = PROJECT.parent / '.tmp/nai/baita-heixiang-naiv5-20261016-v3-prompt.png'
source = json.loads(SOURCE.read_text(encoding='utf-8'))
expected = copy.deepcopy(source['request'])
expected['model'] = 'nai-diffusion-5-full'
parameters = expected['parameters']
characters = parameters['characterPrompts']
arguments = dict(prompt=expected['input'], uc=parameters['negative_prompt'],
    width=parameters['width'], height=parameters['height'], seed=parameters['seed'],
    model=expected['model'], char_prompts=characters, use_coords=parameters['use_coords'])
actual = nai_gen.build_payload(**arguments)
assert actual == expected, 'Current client differs from frozen v3 parameters; stop before network.'
source_image = Path(source['output'])
assert hashlib.sha256(source_image.read_bytes()).hexdigest() == source['sha256']
record = dict(status='prepared', source_receipt=SOURCE.name,
    source_receipt_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    source_image=str(source_image), source_image_sha256=source['sha256'],
    request=actual, output=str(OUTPUT), only_request_change='model: nai-diffusion-4-5-full -> nai-diffusion-5-full',
    recipe_version=source['recipe_version'], references=source['references'],
    method='Text-to-image from exact frozen v3 positive/negative and character prompts; no image upload.')

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

if '--generate' not in sys.argv:
    assert not RECEIPT.exists() and not OUTPUT.exists()
    save()
    print('PREPARED V5; exact v3 prompts, 1344x768, seed', parameters['seed'], flush=True)
else:
    prepared = json.loads(RECEIPT.read_text(encoding='utf-8'))
    assert prepared['request'] == actual and prepared['status'] == 'prepared' and not OUTPUT.exists()
    try:
        path, seed = nai_gen.generate_image(out=OUTPUT, **arguments)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
