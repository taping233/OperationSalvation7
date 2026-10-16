"""New user-selected HD drawing-style reference; never change the original artist chain."""
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
from nai_vibe import encode_vibe


def example(dark_room=False):
    old = json.loads((HERE / 'request-v2.json').read_text(encoding='utf-8'))['parameters']
    characters = [{k: c[k] for k in ('prompt', 'uc', 'center')} for c in old['characterPrompts']]
    characters[0]['prompt'] = characters[0]['prompt'].replace('ruffled dress', 'long-sleeved ruffled dress')
    characters[1]['center'] = {'x': .7, 'y': .5}
    subject = (
        '2girls, eating together, sitting, medium shot, waist up, three-quarter view, indoors, '
        'winter night, window, warm lamplight, snow. Character-focused game key visual.')
    scene = (
        'A modern city apartment at night. Two women fill the foreground around a small '
        'diagonal table: silver-haired woman on the left eating a steamed bun, blonde woman '
        'on the right eating soup. Flowing hair and overlapping sleeves lead toward their faces '
        'and hands. One amber lamp lights the meal and warm skin against cool charcoal shadows. '
        'Behind them, a closed window reveals a pitch-black city, dim building silhouettes, '
        'snow-covered rooftops and windblown snow outside the glass. Intimate, elegant, lively. '
        'Keep the two faces large and readable; food is a supporting detail.')
    if dark_room:
        scene = (
            '1.4::low-key lighting, chiaroscuro::. A dim city apartment with charcoal walls '
            'and dark metal window frames. Two women fill the foreground at a diagonal table. '
            'Silver-haired woman on the left eats a bun; blonde woman on the right eats soup. '
            'A small amber lamp lights their faces, hands and meal; the room recedes into deep '
            'blue-gray shadow. Through the closed window: pitch-black city towers, faint '
            'snow-covered rooftops and falling snow. Large readable faces, flowing hair, '
            'overlapping sleeves, intimate warmth amid winter darkness.')
    negative = build_uc(
        'daylight, bright exterior, white background, blank background, snow indoors, '
        'crowd, background people, duplicate characters, giant food, extra arms, fused hands, '
        'chibi, contact sheet, starry sky, stars, blue waist sash')
    if dark_room:
        negative += ', white walls, white window frame, high-key lighting, overexposure'
    return dict(prompt=build_prompt(subject, scene), uc=negative,
        char_prompts=characters, use_coords=True, width=1344, height=768, seed=15102026)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--generate', action='store_true')
    parser.add_argument('--label', choices=['v4', 'v5'], default='v5')
    args = parser.parse_args()
    reference_root = PROJECT.parent / '.tmp/nai/snow-night-20261015'
    references = [
        {'path': reference_root / 'style-reference-hd.jpg', 'strength': .3 if args.label == 'v4' else .15,
         'role': 'layered composition, colored linework and selective detail'},
        {'path': reference_root / 'wu-reference-user.png', 'strength': .35 if args.label == 'v4' else .25,
         'role': 'Wu appearance, proportions and grouped dark cloth planes'},
    ]
    request = example(dark_room=args.label == 'v5')
    assert ARTIST_BLOCK == '1.2::miv4t::, 0.8::quasarcake::'
    body = build_payload(**request)
    (HERE / ('request-' + args.label + '-text.json')).write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding='utf-8')
    parts = ['NAI 4.5 Full | recipe ' + RECIPE_VERSION, 'BASE PROMPT', request['prompt'],
             'BASE UNDESIRED CONTENT', request['uc']]
    for label, character in zip(['WU / B3', 'XINGYUE / D3'], request['char_prompts']):
        parts.extend([label, character['prompt'], 'CHARACTER UNDESIRED CONTENT', character['uc']])
    parts.extend(['VIBE REFERENCES', 'HD group artwork: strength ' + str(references[0]['strength']) +
                  '; Wu portrait: strength ' + str(references[1]['strength']) +
                  '; information extracted 1.0.'])
    (HERE / ('prompt-' + args.label + '.txt')).write_text('\n\n'.join(parts) + '\n', encoding='utf-8')
    import sentencepiece as sp
    tokenizer = sp.SentencePieceProcessor(model_proto=(
        PROJECT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model').read_bytes())
    counts = [len(tokenizer.encode(request['prompt']))] + [len(tokenizer.encode(c['prompt']))
                                                         for c in request['char_prompts']]
    assert sum(counts) < 480, counts
    print('recipe=' + RECIPE_VERSION + '; raw T5 counts=' + str(counts) + '; sum=' + str(sum(counts)), flush=True)
    config = {'references': [{'path': str(r['path'].relative_to(PROJECT.parent)),
                             'source_sha256': hashlib.sha256(r['path'].read_bytes()).hexdigest(),
                             'strength': r['strength'], 'role': r['role']} for r in references],
              'information_extracted': 1.0, 'recipe_version': RECIPE_VERSION,
              'positive_raw_t5_counts': counts, 'artist_chain': ARTIST_BLOCK}
    config_path = HERE / (args.label + '-reference-config.json')
    config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    if args.generate:
        out = reference_root / ('wu-xingyue-snow-night-' + args.label + '.png')
        if out.exists():
            raise SystemExit('Sample exists; preserve output.')
        request['vibes'] = []
        for reference, metadata in zip(references, config['references']):
            vibe = encode_vibe(reference['path'], reference_root / 'vibe-cache')
            request['vibes'].append({'encoding': vibe['encoding'], 'strength': reference['strength']})
            metadata['encoding_sha256'] = vibe['encoding_sha256']
            config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
        config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
        generate_image(**request, out=out)
        receipt = {'path': str(out.relative_to(PROJECT.parent)),
                   'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
                   'acquisition': 'NAI tools/nai_gen.py; request-' + args.label + '-text.json plus ' +
                                  args.label + '-reference-config.json',
                   'recipe_version': RECIPE_VERSION}
        (HERE / ('image-receipt-' + args.label + '.json')).write_text(json.dumps(receipt, indent=2), encoding='utf-8')
