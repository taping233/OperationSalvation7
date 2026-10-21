import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

prompt = style.build_asset_prompt(
    '1girl, solo focus, full body, high angle, looking up, walking up stairs toward the camera, caught mid-step, quiet reserved expression,',
    purpose_layer='Busy railway station entrance. A lower tiled concourse with small commuters recedes behind her.',
    composition_layer=(
        '1.2::three separate parallel routes, a central fixed stone staircase between two side commuter routes::, '
        'straight sloping metal dividers separate the routes; slim brass handrails on vertical posts line the INNER sides of the central stairs. '
        'Camera on the upper landing looks down the stair flight. Regular stone treads recede toward the concourse. '
        'She is centered, entire body inside frame, clear steps below both shoes. One foot planted on a tread, the other knee bends to reach the next higher tread. '
        'Right hand at screen-left loosely pinches a train ticket beside her thigh; left hand at screen-right holds her bag strap. '
        'Large dark blurred shoulders frame the two foreground corners; sharp woman in the middle distance; smaller softer commuters behind.'),
    light_material_layer=(
        'Low warm sunlight from the concourse behind her, narrow hair rim light, cool sage face and stair shadows. '
        'Long thin railing shadows cross successive treads toward the foreground; shoe contact shadows. '
        'Oatmeal beige, dusty blue, muted brass, brown leather; quiet broad wool folds, subtle knit texture.'))
character = (
    'adult woman, very long dark brown wavy hair, heavy side-swept bangs completely covering the eye on the viewer-left, '
    'only the viewer-right green eye visible, two slim gold hairclips on the exposed-eye side, human ears, gentle bookish face, '
    'oatmeal knee-length wool coat, dusty-blue turtleneck sweater dress, brown tights, brown loafers, dark brown shoulder satchel')
characters = [{'prompt': character, 'uc': 'animal ears, blue eyes, pale hair, hat, both eyes visible',
               'center': {'x': 0.5, 'y': 0.5}}]
uc = style.build_uc('escalator, curved balustrade, cropped feet, standing still, floating feet, animal ears, magic circle, floating books')
output = ROOT.parent / '.tmp/nai/baita-station-nai5-v2-20261020/candidate.png'
receipt = Path(__file__).with_name('request.json')
assert not output.exists() and not receipt.exists(), 'Use a new candidate path.'
kwargs = dict(width=1344, height=768, seed=1402076391, model='nai-diffusion-5-full',
              char_prompts=characters, use_coords=True)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
    request=nai_gen.build_payload(prompt, uc, **kwargs), output=str(output),
    revision='Prompt-led NAI5 regeneration; previous sampler/model/seed/size retained; changed scene/identity text and targeted UC together, not a single-variable test.',
    priorities=['High-angle full-body composition with foreground/middle/background depth',
                'Three routes separated by straight panels, central fixed steps and slim inner rails',
                'Ascending supported gait, ticket and strap hand relations',
                'Baita updated one-eye fringe identity; original commuter palette'],
    references=[dict(path=str(p), sha256=hashlib.sha256(p.read_bytes()).hexdigest(), uploaded=False)
        for p in [Path(r'C:/Users/太平/Downloads/06603d0465bec94f7eb4598e7cdf67e3236908.png'),
                  ROOT / 'docs/character-bible/baita.md']],
    scope='One NAI5 candidate only; no built-in redraw, runtime replacement, build, tests, or commit')
def save():
    receipt.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, out=output, **kwargs)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated',seed=seed,sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
