"""Compare current drawing-style words against frozen v2 content and parameters."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_style import ARTIST_BLOCK, STYLE_BLOCK, RECIPE_VERSION


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--label', required=True, choices=['v3', 'v4'])
    parser.add_argument('--generate', action='store_true')
    args = parser.parse_args()
    source = json.loads((HERE / 'request-v2.json').read_text(encoding='utf-8'))
    params = source['parameters']
    sections = source['input'].split('\n\n')
    assert sections[0] == ARTIST_BLOCK == '1.2::miv4t::, 0.8::quasarcake::'
    sections[1] = STYLE_BLOCK
    request = dict(prompt='\n\n'.join(sections), uc=params['negative_prompt'],
                   char_prompts=[{k: c[k] for k in ('prompt', 'uc', 'center')}
                                 for c in params['characterPrompts']],
                   use_coords=params['use_coords'], width=params['width'], height=params['height'],
                   seed=params['seed'], model=source['model'])
    body = build_payload(**request)
    original_params = json.loads(json.dumps(params))
    original_params['v4_prompt']['caption']['base_caption'] = request['prompt']
    assert body['parameters'] == original_params, 'Only the shared style text may change'
    path = HERE / ('request-' + args.label + '.json')
    serialized = json.dumps(body, ensure_ascii=False, indent=2)
    if path.exists() and path.read_text(encoding='utf-8') != serialized:
        raise SystemExit('Existing request differs; preserve the previous experiment.')
    path.write_text(serialized, encoding='utf-8')
    parts = ['NAI 4.5 Full | 1344x768 | seed 15102026 | recipe ' + RECIPE_VERSION,
             'BASE PROMPT', request['prompt'], 'BASE UNDESIRED CONTENT', request['uc']]
    for label, character in zip(['WU / B3', 'XINGYUE / D2'], request['char_prompts']):
        parts.extend([label, character['prompt'], 'CHARACTER UNDESIRED CONTENT', character['uc']])
    (HERE / ('prompt-' + args.label + '.txt')).write_text('\n\n'.join(parts) + '\n', encoding='utf-8')
    import sentencepiece as sp
    tokenizer_file = PROJECT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model'
    tokenizer = sp.SentencePieceProcessor(model_proto=tokenizer_file.read_bytes())
    counts = [len(tokenizer.encode(request['prompt']))] + [
        len(tokenizer.encode(c['prompt'])) for c in request['char_prompts']]
    assert sum(counts) < 480, counts
    print('recipe=' + RECIPE_VERSION + '; raw T5 counts=' + str(counts) + '; total=' + str(sum(counts)), flush=True)
    (HERE / ('budget-' + args.label + '.json')).write_text(json.dumps({
        'positive_raw_t5_counts': counts, 'positive_total': sum(counts),
        'unchanged_from_v2': ['artist_chain', 'subject', 'scene', 'characters', 'all_parameters', 'negative_prompts'],
        'changed': ['shared_style_text'], 'recipe_version': RECIPE_VERSION}, indent=2), encoding='utf-8')
    if args.generate:
        out = PROJECT.parent / ('.tmp/nai/snow-night-20261015/wu-xingyue-snow-night-' + args.label + '.png')
        if out.exists():
            raise SystemExit('Sample exists; preserve the previous output.')
        generate_image(**request, out=out)
        receipt = {'path': str(out.relative_to(PROJECT.parent)),
                   'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
                   'acquisition': 'tools/nai_gen.py; ' + path.name + '; seed 15102026',
                   'recipe_version': RECIPE_VERSION}
        (HERE / ('image-receipt-' + args.label + '.json')).write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
