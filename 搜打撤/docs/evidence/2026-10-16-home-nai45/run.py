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
source = PROJECT / 'game/assets/reconstruction/wallpaper-wu-1004.webp'
subject = '1girl, solo, adult woman, seated on scattered book pages beside a frozen lake in a snowy outdoor library, holding one red rose, looking at viewer, quiet composed expression, closed mouth.'
composition = (
    'Very wide panoramic composition, full seated figure near the center, complete head and gown inside the canvas. '
    'Her torso rises upright near center-left; bent legs extend diagonally toward screen-right under a floor-length black off-shoulder ruffled gown. '
    'Her right palm presses flat onto the pages at screen-left beside her hip, supporting her weight. '
    'Her left hand holds the stem of one red rose at chest height on screen-right, the blossom below her shoulder, away from her face. '
    'Right hand supporting her on the pages, left hand holding a single red rose. '
    'Her silver high ponytail flows down onto the pages toward screen-left. Black ankle boots peek from the hem at screen-right. '
    'A long black sheathed straight sword lies horizontally on the pages behind her hips, extending toward screen-right; neither hand touches it. '
    'An open book rests on a small stack in the lower-left foreground. Loose pages spread beneath her and across the icy shore. '
    'Snow-covered leaning wooden bookshelves stand among tall bare winter trees on both sides of the frozen lake. '
    'Distant shelves and conifers fade into pale winter mist. Cold silver-blue-gray snow and ice, charcoal black gown, small blue ribbon accent, one red rose accent. '
    'Soft overcast winter daylight, quiet serious atmosphere, subtle icy reflections, light falling snow. No interface or lettering.')
prompt = style.build_asset_prompt(subject, composition_layer=composition,
                                 light_material_layer='Cool diffuse daylight, matte dark cloth, softly lit face, subdued distant detail.')
assert style.RECIPE_VERSION == '3.0'
# Single-scene substitution for the historical kitchen noun in v3.0; shared recipe stays exact.
assert prompt.count('fabric and kitchen') == 1
prompt = prompt.replace('fabric and kitchen', 'fabric and snowy scenery')
character = ('adult woman, fair skin, cyan eyes, long silver-white hair in a high ponytail, blue satin bow at ponytail base, '
             'parted bangs, both eyes visible, black round sunglasses resting on top of her head, thin frames, '
             'small black rose hair ornament above her own left temple, black off-shoulder long-sleeved floor-length gown, '
             'layered ruffled neckline, waist sash, flowing long skirt, bare shoulders, black ankle boots')
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
uc = style.build_uc('multiple girls, indoor kitchen, dining table, rice bowl, chopsticks, holding sword, sunglasses covering eyes, goggles, cropped head, cropped feet')
kwargs = dict(width=1536, height=576, seed=3058649506, model='nai-diffusion-4-5-full',
              char_prompts=characters, use_coords=False)
request = nai_gen.build_payload(prompt, uc, **kwargs)
assert request['model'] == 'nai-diffusion-4-5-full'
assert prompt.count(style.ARTIST_BLOCK) == 1
out = PROJECT.parent / '.tmp/nai/home-nai45-20261016/wu-snow-library.png'
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
with Image.open(source) as im:
    source_size = list(im.size)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, artist_chain=style.ARTIST_BLOCK,
              source=dict(path=source.relative_to(PROJECT).as_posix(), sha256=hashlib.sha256(source.read_bytes()).hexdigest(), size=source_size),
              scope='Text-to-image reinterpretation of current default title wallpaper, not an exact edit or NAI payload reproduction. Source viewed locally, not uploaded. Same 8:3 aspect at ordinary-size 1536x576; v3.0 recipe with single-scene kitchen->snowy scenery substitution; homepage long gown override. No game replacement or shared default changes.',
              request=request, output_relative=out.relative_to(PROJECT.parent).as_posix())
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, uc, out=str(out), **kwargs)
    with Image.open(path) as im:
        assert im.size == (1536, 576)
        record['size'] = list(im.size)
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(), bytes=Path(path).stat().st_size)
    save()
    print(json.dumps({k: record[k] for k in ('status', 'output_relative', 'sha256', 'size')}, ensure_ascii=False))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
