import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

HERE = Path(__file__).resolve().parent
PREVIOUS = PROJECT / 'docs/evidence/2026-10-16-nai-style-step1'
OUT = PROJECT.parent / '.tmp/nai/nai45-ablation-20261016'
MANIFEST = HERE / 'manifest.json'
assert not MANIFEST.exists(), 'Existing batch; do not replay.'
OUT.mkdir(parents=True, exist_ok=True)
prior = json.loads((PREVIOUS / 'dinner45-free-request.json').read_text(encoding='utf-8'))
base = prior['request']
p = base['parameters']
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']}
              for c in p['characterPrompts']]
CHAIN = '0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::'
ASK = ', 0.2::ask (askzy)::'
TAIL = 'very aesthetic, masterpiece, no text'
assert base['input'].count(CHAIN) == 1 and base['input'].endswith(TAIL)
variants = [
    ('A', 'Original 4 / no complexity', CHAIN, False, 'dinner45-free-request.json', 'baseline'),
    ('B', 'Original 4 / HIGH', CHAIN, True, None, 'A + high complexity'),
    ('C', 'Original 4 + ASK 0.2 / no complexity', CHAIN + ASK, False, None, 'A + ASK 0.2'),
    ('D', 'Original 4 + ASK 0.2 / HIGH', CHAIN + ASK, True, 'dinner45-ask02-request.json', 'B + ASK 0.2 / C + high complexity'),
    ('E', 'Original 4 + ASK 0.5 / HIGH', CHAIN + ', 0.5::ask (askzy)::', True, None, 'D: ASK 0.2 -> 0.5'),
    ('F', 'No piromizu + ASK 0.2 / HIGH', CHAIN.replace(', 0.3::piromizu::', '') + ASK, True, None, 'D: remove piromizu'),
    ('G', 'No gomzi + ASK 0.2 / HIGH', CHAIN.replace(', 0.4::gomzi::', '') + ASK, True, None, 'D: remove gomzi'),
    ('H', 'rella 0.8 + ASK 0.2 / HIGH', CHAIN.replace('0.5::rella::', '0.8::rella::') + ASK, True, None, 'D: rella 0.5 -> 0.8'),
]
record = dict(status='prepared', model=base['model'], seed=p['seed'], size=[p['width'], p['height']],
              scope='Fixed scene, identity, negative prompt, seed and all sampling. Artist-chain/complexity experiment. One seed only; no stability claim. Six new requests, two reused outputs. Shared defaults unchanged.',
              items=[])
def save():
    MANIFEST.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
for key, label, chain, complexity, reuse, difference in variants:
    prompt = base['input'].replace(CHAIN, chain)
    if complexity:
        prompt = prompt[:-len(TAIL)] + 'high complexity, ' + TAIL
    request = nai_gen.build_payload(prompt, p['negative_prompt'], width=p['width'], height=p['height'],
                                   seed=p['seed'], model=base['model'], char_prompts=characters,
                                   use_coords=p['use_coords'])
    expected = json.loads(json.dumps(base))
    expected['input'] = prompt
    expected['parameters']['v4_prompt']['caption']['base_caption'] = prompt
    assert request == expected, key + ': unexpected parameter change'
    item = dict(id=key, label=label, artist_chain=chain, high_complexity=complexity,
                difference=difference, request=request, status='prepared')
    if reuse:
        old = json.loads((PREVIOUS / reuse).read_text(encoding='utf-8'))
        assert old['status'] == 'generated' and old['request'] == request, key + ': reuse mismatch'
        image_path = Path(old['output'])
        assert hashlib.sha256(image_path.read_bytes()).hexdigest() == old['sha256']
        item.update(status='reused', output=str(image_path), sha256=old['sha256'], source_receipt=str(PREVIOUS / reuse))
    else:
        image_path = OUT / (key + '.png')
        assert not image_path.exists(), 'Existing candidate: ' + str(image_path)
        item['output'] = str(image_path)
    record['items'].append(item)
save()
for item in record['items']:
    if item['status'] == 'reused':
        print(item['id'] + ' REUSED', flush=True)
        continue
    print(item['id'] + ' START ' + item['label'], flush=True)
    try:
        image_path, _ = nai_gen.generate_image(item['request']['input'], p['negative_prompt'],
                                              width=p['width'], height=p['height'], seed=p['seed'],
                                              model=base['model'], char_prompts=characters,
                                              use_coords=p['use_coords'], out=item['output'])
    except BaseException as error:
        item.update(status='failed', error_type=type(error).__name__, error=str(error))
        record['status'] = 'stopped-on-failure'
        save()
        raise
    item.update(status='generated', sha256=hashlib.sha256(Path(image_path).read_bytes()).hexdigest())
    save()
    print(item['id'] + ' DONE', flush=True)

font_path = 'C:/Windows/Fonts/arial.ttf'
font = ImageFont.truetype(font_path, 21)
small = ImageFont.truetype(font_path, 17)
cell_w, image_h, header_h = 608, 416, 68
board = Image.new('RGB', (cell_w * 2, (image_h + header_h) * 4), '#151a23')
draw = ImageDraw.Draw(board)
for index, item in enumerate(record['items']):
    x, y = (index % 2) * cell_w, (index // 2) * (image_h + header_h)
    draw.text((x+12,y+8), item['id'] + '  ' + item['label'], font=font, fill='white')
    draw.text((x+12,y+36), item['difference'], font=small, fill='#b4c4db')
    with Image.open(item['output']) as im:
        board.paste(im.convert('RGB').resize((cell_w,image_h),Image.Resampling.LANCZOS),(x,y+header_h))
board_path = OUT / 'comparison-A-H.jpg'
board.save(board_path, quality=94)
record.update(status='complete', board=str(board_path), board_sha256=hashlib.sha256(board_path.read_bytes()).hexdigest())
save()
print('COMPLETE ' + str(board_path), flush=True)
