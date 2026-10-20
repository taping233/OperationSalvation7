import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

source = Path(r'C:/Users/太平/Downloads/06603d0465bec94f7eb4598e7cdf67e3236908.png')
portrait = ROOT / 'game/assets/portraits/full/baita.webp'
with Image.open(source) as image:
    image.load()
    metadata = json.loads(image.info['Comment'])
scene = metadata['prompt'].split('crowded railway station entrance, ', 1)[1]
# Match the visible ticket and bag-strap gesture rather than the metadata's railing gesture.
scene = scene.replace('one hand resting on the railing and the other holding a folded train ticket near her coat',
    'her right hand at screen-left holding a folded train ticket down beside her coat, her left hand at screen-right grasping the strap of the shoulder bag')
prompt = style.build_asset_prompt(
    '1girl, solo focus, crowded railway station entrance, ' + scene,
    composition_layer='The main woman is centered, walking up the staircase toward the camera. Her whole body and both shoes remain visible between the converging brass handrails. Anonymous commuters and two blurred foreground shoulders frame her without hiding her face.')
character = (
    'adult woman, very long dark brown wavy hair with large loose curls, side-swept bangs, '
    'two slender gold metal hair clips holding the bangs away from one eye, clear green eyes, human ears, quiet gentle bookish expression, '
    'a newly designed oatmeal-beige knee-length wool coat with simple lapels and cuff tabs, '
    'dusty blue cable-knit turtleneck sweater dress, dark brown tights, brown leather loafers, '
    'a structured dark brown leather shoulder satchel with small brass buckles')
characters = [{'prompt': character, 'uc': 'animal ears, feathered head tufts, pale hair, blue eyes, hat',
               'center': {'x': 0.5, 'y': 0.5}}]
uc = style.build_uc('cat ears, animal ears, feathered head tufts, witch hat, floating books, magic circle')
output = ROOT.parent / '.tmp/nai/baita-station-20261020/candidate.png'
receipt = Path(__file__).with_name('request.json')
assert not receipt.exists() and not output.exists(), 'Use a new candidate path.'
seed = 1402076391
kwargs = dict(width=1344, height=768, seed=seed, model='nai-diffusion-5-full',
              char_prompts=characters, use_coords=True)
request = nai_gen.build_payload(prompt, uc, **kwargs)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=request,
    original_metadata=metadata, output=str(output),
    references=[dict(path=str(p), sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
                     purpose=purpose, uploaded=False) for p, purpose in [
        (source, 'Composition, station stairs, crowd, sunlight, costume palette; embedded prompt read'),
        (portrait, 'Current Baita identity visually inspected; no old costume or seated pose inherited')]],
    changes=dict(identity='Baita: long dark brown curls, green eyes, two gold hair clips; removed original identity and animal ears',
        costume='New commuter coat and knitted dress in reference oatmeal/dusty blue, brown bag and loafers',
        style='Current project artist chain/style/quality/UC via shared builder',
        parameters='Current NAI5 defaults, free landscape 1344x768, 28 steps; original metadata kept for provenance only'),
    scope='One candidate; no runtime replacement, tests, build, or commit')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, out=output, **kwargs)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=actual_seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
