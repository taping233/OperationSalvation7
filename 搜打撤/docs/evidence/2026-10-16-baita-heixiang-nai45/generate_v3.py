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

OUTPUT = PROJECT.parent / '.tmp/nai/baita-heixiang-nai45-20261016-v3.png'
RECEIPT = HERE / 'request-v3.json'
MODEL, WIDTH, HEIGHT, SEED = 'nai-diffusion-4-5-full', 1344, 768, 545764184
prompt = style.build_asset_prompt(
    '1girl, 1boy, two adults, close three-quarter shot, landscape. Figures fill canvas edge to edge; lower legs and skirt cropped.',
    composition_layer=(
        'Seated woman foreground right overlaps warrior behind left; similar head sizes. '
        'He leans forward over her shoulder, brows lowered, stern stare. '
        'She sits sideways, face turned toward viewer, unreadable expression, hands on book in lap. '
        'His right fingers grip cup handle near mouth; left palm supports saucer below chest. '
        'Two books float behind her shoulders.'),
    light_material_layer=(
        'Dark upper half. Narrow cool sidelight from left catches faces and sleeves, bright lower skirt; '
        'his far eye and half torso lost in solid black. Dark paneled wall, stone base. '
        'Muted jade, bone white, ink black, gold and orange accents, weighty fabric, intimidating stillness.')
)
characters = [
    dict(prompt=(
        'adult man, muscular, 1.2::very dark brown skin::, lit skin remains deep brown. '
        'His black hair is slicked back from his forehead, fully exposing it. '
        'Amber eyes, stitched scar on his left cheek, black combat suit, single shoulder armor, '
        'black gloves, brown-orange scarf, greatsword on back, hilt above shoulder.'
    ), uc='pale skin, light skin, smile', center={'x': .3, 'y': .4}),
    dict(prompt=(
        'adult woman, long wavy dark brown hair, two gold hairpins, green eyes, '
        'white long-sleeved blouse, dark green suspender long skirt, ancient book on lap.'
    ), uc='child, chibi, smile', center={'x': .65, 'y': .55}),
]
uc = style.build_uc('floating cup, floating saucer, giant, miniature person, chibi, white curtain, distant shot, flat cel shading')
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
              changes=['close crop and large figures', 'tight overlapping silhouettes',
                       'forward lean and stern/unreadable expressions', 'dark upper field and narrow left sidelight',
                       'solid black shadow on warrior', 'adult scale, dark skin and held cup/saucer'])

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
    (HERE / 'prompt-v3.txt').write_text('\n\n'.join(sections), encoding='utf-8')
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
