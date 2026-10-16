import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_style
import nai_prompt_clean as clean

HERE = Path(__file__).parent
OUT = ROOT.parent / '.tmp/nai/wu-half-ask-20261016.png'
RECEIPT = HERE / 'request-free.json'
assert not OUT.exists() and not RECEIPT.exists(), 'Candidate already exists'
# Batch-local artist change; preserve other sessions' shared recipe edits.
nai_style.ARTIST_BLOCK = '0.9::quasarcake::, 0.5::rella::, 0.5::ask (askzy)::'
prompt = clean.build_asset_prompt(
    '1girl, solo, half body, upper body character portrait, looking at viewer, confident smile, small fang. '
    'A relaxed standing pose in a slight three-quarter view; face turned toward the viewer.',
    purpose_layer='A single finished game character illustration of Wu.',
    composition_layer='Vertical waist-up composition cropped at the hips. Entire head, ponytail root, '
    'hair bow, shoulders and waist stay inside the frame with comfortable margins. '
    'Arms rest naturally by her sides and continue below the crop. '
    'Sword remains sheathed on her back, with its black hilt visible behind her right shoulder '
    '(on the left side of the image). Plain warm light-gray background, no scenery.',
    light_material_layer='Soft neutral daylight, restrained cool shadows, bright clear face, '
    'matte charcoal fabric, broad silver hair color planes, blue ribbon as the color accent.')
appearance = (
    '1girl, pale skin, cyan blue eyes, silver white long hair, high ponytail, parted bangs, both eyes visible, '
    'blue satin ribbon bow tied around the ponytail base. Black round sunglasses resting on top of her head, '
    'dark lenses with small gray highlights. Black rose hair ornament on her left temple '
    '(right side of image). Off-shoulder charcoal black long-sleeved dress, layered neckline ruffles, '
    'black waist sash, black diagonal sword back strap. Confident cheerful smile showing a small fang. '
    'A black straight sword in its black sheath is strapped diagonally across her back, '
    'black cross-wrapped grip and angular crossguard behind her right shoulder. Empty hands.')
uc = clean.build_uc('full body, feet, knees, multiple girls, holding sword, unsheathed sword, '
                    'hair over one eye, blue star pattern, scenery, cropped head, cropped hair bow')
chars = [{'prompt': appearance, 'uc': '', 'center': {'x': .5, 'y': .5}}]
seed = 1771065016
request = nai_gen.build_payload(prompt, uc, width=832, height=1216, seed=seed,
                                model='nai-diffusion-5-full', char_prompts=chars)
assert 'piromizu' not in prompt and 'gomzi' not in prompt
assert '0.5::ask (askzy)::' in prompt
reference = ROOT / 'game/assets/portraits/full/wu.webp'
record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION,
              artist_override=nai_style.ARTIST_BLOCK, request=request,
              previous_attempt='request.json: 1024x1536 returned HTTP402; retry within free pixel tier',
              output=str(OUT.relative_to(ROOT.parent)).replace('\\', '/'),
              references=[dict(path='搜打撤/game/assets/portraits/full/wu.webp',
                               sha256=hashlib.sha256(reference.read_bytes()).hexdigest(),
                               purpose='Identity inspected locally; not uploaded')])
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
        seed=seed, model='nai-diffusion-5-full', char_prompts=chars, out=OUT)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=actual_seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
