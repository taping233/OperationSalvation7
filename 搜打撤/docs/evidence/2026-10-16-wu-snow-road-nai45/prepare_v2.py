"""Prepare corrected prompt only; preserve the first candidate and parameters."""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_prompt_clean as style

source = json.loads((HERE / 'request-free.json').read_text(encoding='utf-8'))
old = source['request']
prompt = style.build_asset_prompt(
    '1girl, solo, upper body, full face, eye level, wide shot, off-center, '
    '1.3::peeking in from the extreme right edge, tightly cropped foreground character::, '
    'looking at viewer, 1.5::head tilt::, subtle smile',
    composition_layer=(
        'Her head and a narrow slice of shoulder and chest occupy only the rightmost quarter. '
        'Her head touches the top and right edges, both eyes visible; most of her body is beyond '
        'the right border, waist and hands outside the crop. Her torso stays upright with her head tilted sideways. '
        'The broad wet asphalt highway fills the lower two thirds, converging straight toward a '
        'central vanishing point at the upper third. White dashed center line, white edge lines, '
        'snow-topped steel guardrails on both sides, flat snowy fields, distant utility poles.'),
    light_material_layer=(
        'Winter, overcast cold dawn, blue-gray sky, faint pink horizon. Dark wet granular asphalt, '
        'fine surface detail, long pale pink reflections and small puddles. Soft cool shadow on her '
        'face, warm rim light on her hair, sparse glowing particles. Readable road and distant landscape, '
        'highly detailed, high complexity.'))

# Local crop/environment corrections: shared recipe remains unchanged.
replacements = {
    style.STYLE_BLOCK:
        'arknights, painterly anime promotional illustration, grouped shadows, angular cloth folds, '
        'delicate skin transitions, selective facial linework, rich controlled color, '
        'crisp facial features and readable landscape.',
}
for before, after in replacements.items():
    assert before in prompt
    prompt = prompt.replace(before, after)

character = (
    'silver-white long hair, high ponytail tied with a blue ribbon bow, parted bangs, '
    'both cyan-blue eyes visible, pale skin, tiny fang at the corner of her slight smile, '
    'black round sunglasses on head, thin black round frames, dark tinted lenses, '
    'sunglasses pushed up onto her hair, black rose on her left temple, '
    'black charcoal off-shoulder long-sleeved dress, ruffled neckline, '
    'black sword sheathed on her back, black shoulder strap')
char_uc = (
    'goggles, ski goggles, swimming goggles, aviator goggles, safety goggles, '
    'halo, hat, backpack, red hair, braid, hair over one eye, holding sword, '
    'wide open mouth, long skirt, high-low skirt, long back hem, dress train, '
    'floor-length dress, blue star pattern, stockings, pantyhose, thighhighs')
uc = style.build_uc(
    'multiple girls, duplicate character, full body, cowboy shot, visible waist, visible hands, '
    'bent over, leaning forward, bokeh, depth of field, blurred background, '
    'plain road surface, featureless road, fence')
characters = [{'prompt': character, 'uc': char_uc, 'center': {'x': .9, 'y': .5}}]
request = copy.deepcopy(old)
request['input'] = prompt
params = request['parameters']
params['negative_prompt'] = uc
params['characterPrompts'] = [dict(characters[0], enabled=True)]
params['v4_prompt']['caption'] = {
    'base_caption': prompt,
    'char_captions': [{'char_caption': character, 'centers': [characters[0]['center']]}]}
params['v4_negative_prompt']['caption'] = {
    'base_caption': uc,
    'char_captions': [{'char_caption': char_uc, 'centers': [characters[0]['center']]}]}

allowed = {'negative_prompt', 'characterPrompts', 'v4_prompt', 'v4_negative_prompt'}
assert {key for key in params if params[key] != old['parameters'][key]} == allowed
assert request['model'] == old['model']
assert style.ARTIST_BLOCK in prompt
assert 'goggles' not in prompt + character
assert all(term in char_uc.split(', ') for term in
           ('goggles', 'ski goggles', 'swimming goggles', 'aviator goggles', 'safety goggles'))
assert all(term not in character for term in ('bare legs', 'ankle boots', 'above-knee'))
record = {
    'status': 'prepared-not-generated',
    'based_on': 'request-free.json', 'recipe_version': style.RECIPE_VERSION,
    'request': request,
    'comparison': {
        'composition': 'Source: character confined to right edge; first candidate: about half the frame and waist visible.',
        'perspective': 'Source: horizon/vanishing point around upper third; first candidate: around image middle.',
        'environment': 'Source: granular road, lane markings, snowy steel barriers, pink reflected light; first candidate: smoother dark road, thin fence and strong background blur.',
        'expression': 'Source: restrained smile and head tilt; candidate: broader open-mouth smile and forward body lean.',
        'eyewear': 'User confirms round sunglasses on head; previous positive incorrectly used goggles.',
    },
    'local_style_overrides': replacements,
    'parameters': 'Model, seed, dimensions, sampling, reference settings and use_coords unchanged.',
    'validation': 'Text/payload assertions passed; visual effect not yet generated or verified.',
}
import sentencepiece as sp
tokenizer_file = ROOT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model'
tokenizer = sp.SentencePieceProcessor(model_proto=tokenizer_file.read_bytes())
positive_counts = [len(tokenizer.encode(prompt)), len(tokenizer.encode(character))]
negative_counts = [len(tokenizer.encode(uc)), len(tokenizer.encode(char_uc))]
assert sum(positive_counts) <= 480, positive_counts
assert sum(negative_counts) <= 480, negative_counts
record['raw_t5_budget'] = {
    'positive': positive_counts, 'positive_total': sum(positive_counts),
    'negative': negative_counts, 'negative_total': sum(negative_counts),
    'tokenizer_sha256': __import__('hashlib').sha256(tokenizer_file.read_bytes()).hexdigest(),
    'limit': 'Raw local counts include weight syntax; not identical to server tokenisation.',
}
out = HERE / 'request-v2-prepared.json'
if out.exists():
    assert json.loads(out.read_text(encoding='utf-8'))['status'] == 'prepared-not-generated'
out.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
text = ('# 无·雪原公路：修订提示词 v2（尚未出图）\n\n'
        '## 基础正向\n\n' + prompt + '\n\n## 人物正向\n\n' + character +
        '\n\n## 基础负向\n\n' + uc + '\n\n## 人物负向\n\n' + char_uc + '\n')
(HERE / 'prompt-v2.txt').write_text(text, encoding='utf-8')
print('Prepared v2; sunglasses positive, goggles negative; no generation; raw T5:',
      sum(positive_counts), sum(negative_counts))
