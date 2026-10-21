"""Prepare pending requests only; never sends a network request."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
namespace = {'__file__': str(HERE / 'generate.py')}
source = (HERE / 'generate.py').read_text(encoding='utf-8')
exec(compile(source.split('for item in SCENES:')[0], str(HERE / 'generate.py'), 'exec'), namespace)
nai_gen, style = namespace['nai_gen'], namespace['style']

heixiang = json.loads((HERE / 'heixiang-request.json').read_text(encoding='utf-8'))
body = heixiang['request']
character = body['parameters']['characterPrompts'][0].copy()
character['prompt'] = character['prompt'].replace(
    'very tall, massive muscular build, broad shoulders, thick arms',
    'very tall, 1.5::massive muscular heavyweight bodybuilder build, huge broad shoulders, thick neck and trapezius muscles, barrel chest, massive thick upper arms and forearms, heavy torso, thick muscular thighs and calves::, imposing bulky silhouette, adult masculine proportions')
character['uc'] += ', slim, slender, narrow shoulders, thin arms, lean build'
request = nai_gen.build_payload(body['input'], body['parameters']['negative_prompt'],
                               width=832, height=1216, seed=body['parameters']['seed'],
                               model=body['model'], char_prompts=[character])
record = dict(status='prepared_not_sent', reason='User requested current muscular physique; shared HTTP429 cooldown.',
              request=request, output='.tmp/nai/roster-nai5-redo-20261020/heixiang-muscular-v2.png',
              references=heixiang['references'], change='physique only; same seed and all sampling settings',
              integration='candidate only')
(HERE / 'heixiang-muscular-v2-request.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

item = next(x for x in namespace['SCENES'] if x['id'] == 'changwuyu')
prompt = style.build_asset_prompt(item['action'],
    purpose_layer='Single game character selection full-body portrait, isolated on a clean white background.',
    composition_layer='Vertical composition. Entire character, headwear, hair, clothing, feet and signature props inside frame, comfortable small margins. No scenery, no other people.',
    light_material_layer='Soft neutral studio illumination, clear face and hand shadows, restrained metal reflections, readable dark fabric, subtle ground contact shadow.')
uc = style.build_uc('cropped head, cropped feet, out of frame, multiple people, background scenery')
request = nai_gen.build_payload(prompt, uc, width=832, height=1216, seed=item['seed'],
    model='nai-diffusion-5-full', char_prompts=[dict(prompt=item['character'], uc=item['uc'], center=dict(x=.5, y=.5))])
record = dict(status='prepared_not_sent', reason='Batch stopped on preceding HTTP429.', request=request,
              output='.tmp/nai/roster-nai5-redo-20261020/changwuyu.png', integration='candidate only')
path = HERE / 'changwuyu-request.json'
assert not path.exists()
path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print('Prepared muscular Heixiang v2 and Changwuyu; no network requests sent.')
