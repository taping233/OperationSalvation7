import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = ROOT.parent / '.tmp/nai/wu-no-style-20261016.png'
RECEIPT = HERE / 'request.json'
assert not OUT.exists() and not RECEIPT.exists(), 'Candidate already exists'
prompt = style.ARTIST_BLOCK + '\n\n' + (
    '1girl, solo, full body character portrait, standing, arms relaxed at her sides, '
    'legs crossed at the ankles, facing viewer, entire ponytail and both boots inside the canvas. '
    'A single sheathed black straight longsword is strapped diagonally across her back; '
    'its black wrapped grip and angular crossguard rise behind her right shoulder '
    '(left side of the image), the pointed scabbard ends below her left knee. '
    'Plain white background, no scenery, no text.'
)
character = (
    'Adult woman, tall slender build, fair skin, slightly full thighs and calves, '
    'cyan blue eyes, confident smile with a small fang, parted bangs exposing both eyes. '
    'Long silver white hair in a high ponytail tied with a blue satin bow. '
    'Black rose above her left temple (right side of the image), '
    'black round goggles with dark lenses resting on top of her head. '
    'Black and charcoal off shoulder long sleeve dress, layered ruffles at neckline, '
    'cuffs and irregular above knee skirt, black waist tie. Bare legs, black ankle boots.'
)
uc = style.build_uc('blue star patterned skirt lining, holding sword, unsheathed sword, stockings, tights, cropped feet')
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
payload = nai_gen.build_payload(prompt, uc, width=832, height=1216, seed=1278087392,
                               char_prompts=characters)
reference = ROOT / 'game/assets/portraits/full/wu.webp'
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              override='Omit STYLE_BLOCK and painterly portrait tail for this candidate only; retain artist block and UC.',
              request=payload, output=str(OUT), references=[dict(path=str(reference),
              sha256=hashlib.sha256(reference.read_bytes()).hexdigest(),
              purpose='Local visual identity inspection only; not uploaded; no Vibe')])

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
        seed=payload['parameters']['seed'], char_prompts=characters, out=str(OUT))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
