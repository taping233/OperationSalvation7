import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

output = ROOT.parent / '.tmp/nai/xingyue-nai5-reset-20261026/candidate-portrait.png'
receipt = Path(__file__).with_name('request-portrait.json')
reference = ROOT / 'game/assets/portraits/full/xingyue.webp'
character = (
    '1girl, young adult woman, pale blonde hair, golden eyes, calm expression, '
    'straight bangs, long sidelocks, a single very long thick low braid reaching her calves. '
    "A white crescent moon hairpin clipped flat into the hair just above the bangs, slightly off-center to the viewer's right, tilted against the hair. "
    'White high-neck priestess dress with long bell sleeves and layered ankle-length skirt, '
    'deep teal short shoulder cape with gold edging, restrained gold star ornament, '
    'dark wrist cuffs, dark tights, white gray lace-up ankle boots.'
)
prompt = style.build_asset_prompt(
    'solo, full body, standing, front three-quarter view, looking at viewer, composed expression. '
    'Her left hand is raised before her chest in a gentle blessing gesture, fingers together; '
    'her right hand extends toward screen-left holding the ring handle of a small lantern with a glowing gold star inside. '
    'The long braid curves loosely behind the body, both eyes and both hands clearly visible.',
    purpose_layer='Single complete character illustration for a game character selection screen, plain white background.',
    composition_layer='Vertical portrait composition, one centered figure, entire head, braid, skirt, boots and lantern inside the canvas. '
    'The figure fills about 88 percent of the canvas height, clean complete silhouette, no scenery.',
    light_material_layer='Soft neutral daylight, warm gold lantern light on nearby white cloth. '
    'White, deep teal and muted gold palette, clear face and readable costume layers.')
uc = style.build_uc('cropped head, cropped feet, halo, floating hair ornament, multiple girls')
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
request = nai_gen.build_payload(prompt, uc, seed=1730261026, width=832, height=1216, char_prompts=characters)
assert not receipt.exists() and not output.exists(), 'Candidate already exists'
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=request,
              references=[dict(path=str(reference), sha256=hashlib.sha256(reference.read_bytes()).hexdigest(),
                               purpose='Local visual identity and pose reference; not uploaded')],
              output=str(output), acquisition='tools/nai_gen.py generate_image; NAI5 text-to-image',
              integration='candidate only')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, seed=request['parameters']['seed'],
                                      out=str(output), width=832, height=1216, char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
