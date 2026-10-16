import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_style

BASE = json.loads((HERE.parent / '2026-10-16-nai45-rain-bar/request-no-artists.json').read_text(encoding='utf-8'))
VARIANTS = {
    'A-ask-rella': dict(artists='0.9::ask (askzy)::, 0.5::rella::'),
    'B-ciloranko-gomzi': dict(artists='0.9::ciloranko::, 0.5::gomzi::'),
    'C-alchemaniac-rella': dict(artists='0.9::alchemaniac::, 0.5::rella::'),
    'D-reoen-ask': dict(artists='0.9::reoen::, 0.5::ask (askzy)::'),
    'E-alchemaniac-cfg45': dict(artists='0.9::alchemaniac::, 0.5::rella::', cfg=4.5),
    'F-quasarcake-rella': dict(artists='0.9::quasarcake::, 0.5::rella::'),
}

def run(name):
    config = VARIANTS[name]
    original = copy.deepcopy(BASE['request'])
    p = original['parameters']
    prompt = original['input']
    assert prompt.count(nai_style.STYLE_BLOCK) == 1
    prompt = prompt.replace(nai_style.STYLE_BLOCK, config['artists'] + '\n\n' + config.get('style', nai_style.STYLE_BLOCK))
    nai_gen.DEFAULTS.update(steps=p['steps'], scale=config.get('cfg', p['scale']),
                          cfg_rescale=config.get('rescale', p['cfg_rescale']),
                          sampler=config.get('sampler', p['sampler']),
                          noise_schedule=p['noise_schedule'], variety_plus=p['variety_plus'])
    characters = [dict(prompt=c['prompt'], uc=c['uc'], center=c['center']) for c in p['characterPrompts']]
    args = dict(width=p['width'], height=p['height'], seed=config.get('seed', p['seed']),
                model=original['model'], char_prompts=characters, use_coords=p['use_coords'])
    output = ROOT.parent / '.tmp/nai/rain-bar-experiment-20261016' / (name + '.png')
    receipt = HERE / (name + '.json')
    assert not receipt.exists() and not output.exists(), 'Use a fresh variant name'
    record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION, variant=config,
                  request=nai_gen.build_payload(prompt, p['negative_prompt'], **args),
                  output=str(output), references=BASE['references'],
                  reference_current='C:/Users/太平/AppData/Local/Temp/codex-clipboard-bf3dd922-cc09-4063-b9eb-e692b78e0d7f.png',
                  acquisition='nai_gen / nai_guard; textual reference analysis, no uploaded image')
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

if __name__ == '__main__':
    for name in sys.argv[1:]:
        run(name)
