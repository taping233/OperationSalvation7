import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/baita-heixiang-nai45-20261016.png'
WIDTH, HEIGHT = (1344, 768) if '--free' in sys.argv else (2048, 1152)
RECEIPT = HERE / ('request-free.json' if '--free' in sys.argv else 'request.json')
if '--free' in sys.argv:
    OUTPUT = OUTPUT.with_name(OUTPUT.stem + '-free.png')
MODEL = 'nai-diffusion-4-5-full'
SEED = 545764184

prompt = style.build_asset_prompt(
    '1girl, 1boy, seated mage foreground right, standing warrior behind her left shoulder, looking at viewer.',
    composition_layer='Landscape composition, natural relative scale, layered silhouettes. She sits sideways on a carved chair, both hands on an ancient book in her lap; he holds a tiny coffee cup and saucer. Two floating books, faint golden circle beneath chair.',
    light_material_layer='Dark paneled interior, narrow cold sidelight, half the warrior concealed in black shadow. Pale jade, bone white, ink black, restrained gold and orange accents, intimidating stillness.'
)
characters = [
    {'prompt': 'man, dark skin, huge muscles, black slicked back hair, exposed forehead. His black hair is slicked back from his forehead, fully exposing it. Amber eyes, stitched scar on his left cheek, smirk, black combat suit, shoulder armor, gloves, orange scarf, greatsword on back, hilt above shoulder.', 'uc': '', 'center': {'x': .3, 'y': .4}},
    {'prompt': 'woman, long wavy dark brown hair, two gold hairpins, green eyes, calm expression, white blouse, dark green suspender long skirt, white socks, black Mary Janes.', 'uc': '', 'center': {'x': .7, 'y': .6}},
]
uc = style.build_uc()
request = nai_gen.build_payload(prompt, uc, width=WIDTH, height=HEIGHT, seed=SEED,
                               model=MODEL, char_prompts=characters, use_coords=True)
references = []
for path, role in [
    (Path(r'C:\Users\太平\Downloads\2adba93cb14b22a3e68757ac758d4d09236908.png'), 'composition and extracted metadata; not uploaded'),
    (PROJECT / 'game/assets/portraits/full/baita.webp', 'current Baita identity; visually inspected; not uploaded'),
    (PROJECT / 'game/assets/portraits/full/heixiang.webp', 'current Heixiang identity; visually inspected; not uploaded'),
]:
    references.append(dict(path=str(path), role=role, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request,
              references=references, output=str(OUTPUT),
              method='Prompt-based new generation from source metadata; no img2img or Vibe upload.')
tokenizer_file = PROJECT.parent / '.tmp/nai/snow-night-20261015/t5-spiece.model'
if tokenizer_file.exists():
    import sentencepiece as sp
    tokenizer = sp.SentencePieceProcessor(model_proto=tokenizer_file.read_bytes())
    counts = [len(tokenizer.encode(prompt))] + [len(tokenizer.encode(c['prompt'])) for c in characters]
    record['raw_t5_positive_counts'] = counts
    record['raw_t5_positive_total'] = sum(counts)
    print('T5 positive counts:', counts, 'total:', sum(counts), flush=True)
    if sum(counts) > 500:
        raise SystemExit('Positive prompt exceeds conservative token budget; shorten before generation.')

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

if '--generate' not in sys.argv:
    assert not RECEIPT.exists() and not OUTPUT.exists()
    save()
    print('PREPARED', MODEL, f'{WIDTH}x{HEIGHT}', flush=True)
else:
    prepared = json.loads(RECEIPT.read_text(encoding='utf-8'))
    assert prepared['request'] == request and prepared['status'] == 'prepared' and not OUTPUT.exists()
    save()
    try:
        path, seed = nai_gen.generate_image(prompt, uc, width=WIDTH, height=HEIGHT,
            seed=SEED, model=MODEL, out=OUTPUT, char_prompts=characters, use_coords=True)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
