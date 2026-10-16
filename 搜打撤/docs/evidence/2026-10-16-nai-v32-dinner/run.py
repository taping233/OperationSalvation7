import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
RECEIPT = HERE / 'request.json'
assert not RECEIPT.exists(), 'Existing request; inspect before retry.'
prior = json.loads((HERE.parent / '2026-10-16-nai45-ask05-pair/request.json').read_text(encoding='utf-8'))
p = prior['request']['parameters']
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
characters = [{'prompt': c['prompt'], 'uc': c.get('uc', ''), 'center': c['center']}
              for c in p['characterPrompts']]
subject = '1girl, solo, adult woman, sitting at a dining table, eating rice and braised meat, gentle smile, small fang, looking at the meat held by her chopsticks.'
composition = (
    'Wide waist-up view, slightly low camera. Her complete head, ponytail base, both hands, rice bowl and chopstick tips fit inside the canvas. '
    'Her left hand supports a small white porcelain rice bowl from below at chest height, below her chin; a modest portion of rice stays inside the bowl. '
    'Her right hand holds a pair of chopsticks, pinching one small bite-sized piece of braised meat at their tips just in front of her slightly open mouth. '
    'A small visible gap separates the meat from her lips. The bowl stays below her face; neither hand obscures her face. '
    'Left hand supporting the rice bowl, right hand using chopsticks; the chopstick tips and single small piece of meat remain visible beside her mouth. '
    'Her black rose hair ornament sits above her own left temple, on screen-right, separate from the sunglasses on top of her head. '
    'A small soup bowl and food plate sit in the lower-left foreground, below her hands. '
    'A black sheathed straight sword rests against the rear wall, behind her, away from her hands and food. '
    'Modern apartment kitchen, warm pendant lamp, cool night light through the window.')
prompt = style.build_asset_prompt(subject, composition_layer=composition,
                                 light_material_layer='Warm light softly illuminates her face and both hands; cool window fill stays subdued. Small porcelain highlights, matte black cloth.')
kwargs = dict(width=1344, height=768, seed=p['seed'], model='nai-diffusion-5-full',
              char_prompts=characters, use_coords=p['use_coords'])
uc = p['negative_prompt']
request = nai_gen.build_payload(prompt, uc, **kwargs)
assert style.ARTIST_BLOCK == '0.9::quasarcake::, 0.5::rella::, 0.5::ask (askzy)::'
assert prompt.count(style.ARTIST_BLOCK) == 1
assert 'gomzi' not in prompt and 'piromizu' not in prompt
assert request['parameters']['negative_prompt'] == uc
out = PROJECT.parent / '.tmp/nai/nai-v32-dinner-20261016/wu-v32-v5.png'
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, artist_chain=style.ARTIST_BLOCK,
              source='../2026-10-16-nai45-ask05-pair/request.json',
              scope='V5 sample with authorized shared recipe v3.2, clearer hand/object relations and selective repetition; overall variant, not single-variable ablation. Free-size landscape; prior seed/sampling/UC/identity retained. Existing high complexity was trial-only, not added to shared quality tail.',
              request=request, output_relative=out.relative_to(PROJECT.parent).as_posix(),
              validation={'artist_chain': 'passed', 'uc_unchanged': True})
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, uc, out=str(out), **kwargs)
    with Image.open(path) as im:
        assert im.size == (1344, 768)
        record['size'] = list(im.size)
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(), bytes=Path(path).stat().st_size)
    save()
    print(json.dumps({k: record[k] for k in ('status', 'output_relative', 'sha256', 'size')}, ensure_ascii=False))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
