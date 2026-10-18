import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style
import sentencepiece as sp

OUTPUT = PROJECT.parent / '.tmp/nai/baita-heixiang-nai45-20261016-v4.png'
RECEIPT = HERE / 'request-v4.json'
MODEL, WIDTH, HEIGHT, SEED = 'nai-diffusion-4-5-full', 1344, 768, 545764184
prompt = style.build_asset_prompt(
    '1girl, 1boy, adult standing man and adult seated woman, close landscape composition. Similar head sizes; figures fill canvas, cropped below knees.',
    composition_layer=(
        'Man stands on the floor behind woman at screen-left, both legs straight, hips above her seat. '
        'He leans forward, face frontal, eyes staring directly at viewer. '
        'Woman sits sideways on carved wooden chair foreground right, turns face toward viewer, hands on closed gilded book in lap. '
        'His right hand grips coffee cup at chest, left hand supports saucer. '
        'Two small books float behind her.'),
    light_material_layer=(
        'Narrow cold sidelight from left, dark upper background, illuminated lower skirt. '
        'Half his face and torso merge into solid black shadow; lit skin stays deep brown. '
        'Dark paneled wall, muted jade and ivory, intimidating stillness.')
)
characters = [
    dict(prompt=(
        'adult man, massive muscular build, 1.3::very dark brown skin::, short black slicked back hair, exposed forehead. '
        'His black hair is slicked back from his forehead, fully exposing it. '
        'Amber eyes, stitched scar on his left cheek. Black fitted combat suit and gloves, '
        'single steel-gray shoulder armor, brown-orange scarf around neck, broad greatsword strapped to back. '
        'Standing, leaning forward, looking at viewer.'
    ), uc='sitting, kneeling, crossed legs, profile, looking away, pale skin, long hair, ponytail, orange armor, green scarf', center={'x': .3, 'y': .4}),
    dict(prompt=(
        'adult woman, mature proportions, long dark brown wavy hair to waist, two thin gold hairpins together on one side, green eyes, calm expression. '
        'White buttoned high-collar blouse, wide dark green suspenders with metal buckles, ankle-length green skirt.'
    ), uc='child, chibi, oversized head, headband, necktie, open collar, maid, kimono', center={'x': .65, 'y': .55}),
]
uc = style.build_uc('floating cup, floating saucer, giant, miniature person, white curtain, distant shot, flat cel shading')
request = nai_gen.build_payload(prompt, uc, width=WIDTH, height=HEIGHT, seed=SEED,
                               model=MODEL, char_prompts=characters, use_coords=True)
tokenizer = sp.SentencePieceProcessor(model_proto=(PROJECT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model').read_bytes())
counts = [len(tokenizer.encode(prompt))] + [len(tokenizer.encode(c['prompt'])) for c in characters]
print('Positive T5:', counts, 'total:', sum(counts), flush=True)
assert sum(counts) <= 500, 'Shorten before generating.'
source = json.loads((HERE / 'request-free.json').read_text(encoding='utf-8'))
record = dict(status='prepared', source_receipt='request-free.json', request=request,
              references=source['references'], output=str(OUTPUT),
              recipe_version=style.RECIPE_VERSION, cleanup_version=style.CLEANUP_VERSION,
              raw_t5_positive_counts=counts, raw_t5_positive_total=sum(counts),
              method='Prompt-based generation using reference composition and lighting; no image/Vibe upload.',
              changes=['explicit standing and straight legs behind left of seated woman', 'frontal face and direct gaze', 'deep brown lit skin and half torso in black', 'short hair, steel-gray armor and brown-orange scarf', 'adult Baita, thin same-side hairpins, buttoned collar and broad buckled suspenders'])

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

if '--generate' not in sys.argv:
    assert not RECEIPT.exists() and not OUTPUT.exists()
    save()
    sections = ['[Base positive]', prompt]
    for name, character in zip(['Heixiang', 'Baita'], characters):
        sections.extend(['[' + name + ' positive]', character['prompt'], '[' + name + ' negative]', character['uc']])
    sections.extend(['[Base negative]', uc, '[Parameters]',
                     'NAI 4.5 Full; 1344x768; seed 545764184; CFG 5.5; 28 steps; Euler Ancestral; Karras; Variety+ off.'])
    (HERE / 'prompt-v4.txt').write_text('\n\n'.join(sections), encoding='utf-8')
    print('PREPARED', flush=True)
else:
    prepared = json.loads(RECEIPT.read_text(encoding='utf-8'))
    assert prepared['request'] == request and prepared['status'] == 'prepared' and not OUTPUT.exists()
    try:
        path, seed = nai_gen.generate_image(prompt, uc, width=WIDTH, height=HEIGHT, seed=SEED,
            model=MODEL, out=OUTPUT, char_prompts=characters, use_coords=True)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
