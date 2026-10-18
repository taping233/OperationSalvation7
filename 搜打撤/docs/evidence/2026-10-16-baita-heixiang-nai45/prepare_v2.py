"""Prepare the prompt correction only; never performs a network request."""
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
source = json.loads((HERE / 'request-free.json').read_text(encoding='utf-8'))
request = copy.deepcopy(source['request'])
# Reuse the exact artist/style/quality blocks that produced v1.
shared_blocks = request['input'].split('\n\n', 3)[3]
scene = (
    '1girl, 1boy, two adults, medium shot, landscape. '
    'Seated woman foreground right dominates the right half; tall man stands behind her left shoulder. '
    'Their heads are similar in size, adult body proportions; lower legs outside frame. '
    'Both look at viewer. Her hands rest on a closed ancient book on her lap. '
    'His right gloved hand grips a coffee cup at his lips; his left palm supports its saucer below his chest. '
    'Only two books levitate beside her shoulders. '
    'Dark paneled room, narrow cold sidelight, deep shadows, pale jade and bone-white clothing, gold accents.'
)
prompt = scene + '\n\n' + shared_blocks
characters = [
    dict(prompt=(
        'adult man, muscular, 1.2::very dark brown skin::, lit skin remains deep brown. '
        'Black slicked back hair, exposed forehead. His black hair is slicked back from his forehead, fully exposing it. '
        'Amber eyes, stitched scar on his left cheek, smirk, black combat suit, single shoulder armor, '
        'black gloves, brown-orange scarf, greatsword on back, hilt above shoulder. '
        'Right hand gripping cup handle, left hand under saucer.'
    ), uc='pale skin, light skin', center={'x': .35, 'y': .4}, enabled=True),
    dict(prompt=(
        'adult woman, normal adult proportions, long wavy dark brown hair, two gold hairpins, green eyes, calm expression. '
        'White long-sleeved blouse, dark green suspender long skirt. Seated sideways on a carved chair, '
        'both hands touching the book on her lap.'
    ), uc='child, chibi', center={'x': .65, 'y': .55}, enabled=True),
]
uc = request['parameters']['negative_prompt'] + ', floating cup, floating saucer, giant, miniature person, chibi, white curtain'
request['input'] = prompt
parameters = request['parameters']
parameters['negative_prompt'] = uc
parameters['characterPrompts'] = characters
parameters['v4_prompt']['caption'] = dict(
    base_caption=prompt,
    char_captions=[dict(char_caption=c['prompt'], centers=[c['center']]) for c in characters])
parameters['v4_negative_prompt']['caption'] = dict(
    base_caption=uc,
    char_captions=[dict(char_caption=c['uc'], centers=[c['center']]) for c in characters])

import sentencepiece as sp
tokenizer = sp.SentencePieceProcessor(model_proto=(PROJECT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model').read_bytes())
positive_counts = [len(tokenizer.encode(prompt))] + [len(tokenizer.encode(c['prompt'])) for c in characters]
negative_counts = [len(tokenizer.encode(uc))] + [len(tokenizer.encode(c['uc'])) for c in characters]
assert sum(positive_counts) <= 500, positive_counts
record = dict(status='prepared-not-generated', source_receipt='request-free.json',
              request=request, references=source['references'],
              output=str(PROJECT.parent / '.tmp/nai/baita-heixiang-nai45-20261016-v2.png'),
              raw_t5_positive_counts=positive_counts, raw_t5_positive_total=sum(positive_counts),
              raw_t5_negative_total=sum(negative_counts),
              changes=['adult scale and closer crop', 'dark skin on lit areas',
                       'explicit hand contact for cup and saucer', 'levitation applies only to two books'],
              recipe_version=source['recipe_version'], cleanup_version=source['cleanup_version'],
              network_requests=0, visual_result='Not generated; prompt correction remains unverified.')
output = HERE / 'request-v2.json'
text_output = HERE / 'prompt-v2.txt'
assert not output.exists() and not text_output.exists()
output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
text_output.write_text('\n\n'.join([
    '[Base positive]', prompt,
    '[Heixiang positive]', characters[0]['prompt'], '[Heixiang negative]', characters[0]['uc'],
    '[Baita positive]', characters[1]['prompt'], '[Baita negative]', characters[1]['uc'],
    '[Base negative]', uc,
    '[Parameters]', 'NAI 4.5 Full; 1344x768; seed 545764184; CFG 5.5; 28 steps; Euler Ancestral; Karras; Variety+ off.',
    '[Status]', 'Prepared only; no generation request sent.'
]), encoding='utf-8')
print('Prepared v2 only. Positive T5:', positive_counts, 'total:', sum(positive_counts),
      'negative total:', sum(negative_counts))
