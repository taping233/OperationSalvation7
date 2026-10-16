"""Save the exact NAI request; --generate also generates one landscape sample."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_style import ARTIST_BLOCK, RECIPE_VERSION, build_prompt, build_uc


def example():
    # 已生成的 v2 按原始请求重现，不随共享配方的后续修订改写历史样本。
    frozen = HERE / 'request-v2.json'
    if frozen.exists():
        body = json.loads(frozen.read_text(encoding='utf-8'))
        params = body['parameters']
        return dict(prompt=body['input'], uc=params['negative_prompt'],
                    char_prompts=[{k: c[k] for k in ('prompt', 'uc', 'center')}
                                  for c in params['characterPrompts']],
                    use_coords=params['use_coords'], width=params['width'], height=params['height'],
                    seed=params['seed'], model=body['model'])
    prompt = build_prompt(
        '1.2::2girls::, eating, sitting, indoors, winter night, window, snowfall, '
        'wide shot, three-quarter view, cinematic composition, depth.',
        'Game key visual: a diagonal dining table in a futuristic city apartment. '
        'Silver-haired woman sits nearer on the left, blonde woman farther right. '
        'One amber lamp lights their faces and steaming food against deep teal shadows. '
        'A large window fills the background: near-black city towers, snow-covered rooftops, '
        'windblown snowflakes lit outside the glass. Warm intimate interior, pitch-dark snowy city. '
        'Broad painted light and shadow shapes; faces remain readable.')
    characters = [
        {'prompt': 'girl, silver long hair, high ponytail, blue hair ribbon, blue eyes, '
                    'black rose, round sunglasses on head, parted bangs, '
                    'black off-shoulder ruffled dress, black waist sash, fang, playful smile, '
                    'holding steamed bun, eating, looking at another, sheathed black sword on back',
         'uc': 'blonde hair, golden eyes, crescent hair ornament, green cape, white dress, '
               'hair over one eye, handheld sword', 'center': {'x': .3, 'y': .5}},
        {'prompt': 'girl, pale blonde hair, blunt bangs, long low side braid, golden eyes, '
                    'white clerical dress, dark teal capelet, gold trim, calm expression, '
                    'holding spoon, eating soup, looking at another. '
                    'White crescent hairpin lies flat above bangs on viewer-right.',
         'uc': 'silver hair, blue eyes, ponytail on top of head, sunglasses, black rose, '
               'black dress, purple eyes, halo, angry, exaggerated grin',
         'center': {'x': .7, 'y': .3}},
    ]
    uc = build_uc('daylight, bright exterior, neon city, snow indoors, crowd, '
                  'extra people, duplicate, extra arms, fused hands, symmetrical composition, '
                  'blue waist sash, yellow hair, monochrome')
    return dict(prompt=prompt, uc=uc, char_prompts=characters, use_coords=True,
                width=1344, height=768, seed=15102026)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--generate', action='store_true')
    args = parser.parse_args()
    request = example()
    assert ARTIST_BLOCK == '1.2::miv4t::, 0.8::quasarcake::'
    payload = build_payload(**request)
    (HERE / 'request.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'request-v2.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print('frozen v2 recipe=1.5; artist chain unchanged; characters=2; 1344x768')
    if args.generate:
        out = PROJECT.parent / '.tmp/nai/snow-night-20261015/wu-xingyue-snow-night-v2.png'
        if out.exists():
            raise SystemExit('Sample exists; preserve the existing output.')
        generate_image(**request, out=out)
        receipt = {'path': str(out.relative_to(PROJECT.parent)),
                   'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
                   'acquisition': 'tools/nai_gen.py; request.json; seed 15102026',
                   'recipe_version': '1.5'}
        (HERE / 'image-receipt-v2.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
