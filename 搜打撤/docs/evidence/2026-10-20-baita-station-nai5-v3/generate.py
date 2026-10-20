import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

previous = json.loads((ROOT / 'docs/evidence/2026-10-20-baita-station-nai5-v2/request.json').read_text(encoding='utf-8'))
characters = [{k: c[k] for k in ('prompt', 'uc', 'center')} for c in previous['request']['parameters']['characterPrompts']]
prompt = style.build_asset_prompt(
    '1.35::a station stairwell divided into THREE parallel lanes by TWO TALL SOLID METAL PARTITIONS::, '
    'central fixed stone staircase, crowded side passages, 1girl, solo focus, high-angle full body,',
    purpose_layer=(
        'Each solid brushed-steel partition is a broad continuous opaque sloping wall, chest-high beside the woman. '
        'The two silver walls extend diagonally from the lower foreground toward the rear concourse, enclosing the central stair flight. '
        'Slim straight brass handrails and spaced vertical posts are attached INSIDE these solid walls. '
        '1.2::commuters fill the separate passages OUTSIDE both metal walls::, busy tiled concourse behind.'),
    composition_layer=(
        'Camera above the stairs looks down toward the concourse. The woman climbs toward us BETWEEN the two metal walls; '
        'her entire body occupies three quarters of image height, both loafers and one lower tread visible. '
        'One shoe supports her on a stone tread; other knee lifts toward the next step. Face lifts for brief eye contact. '
        'Right hand at screen-left holds a ticket down beside her thigh, left hand grips bag strap. '
        'Dark blurred shoulders overlap bottom corners, crisp woman at middle depth, smaller soft crowds behind.'),
    light_material_layer=(
        'Low sunlight from behind, narrow hair rim, cool sage frontal shadows. Long brass-post shadows cross stone treads toward foreground. '
        'Oatmeal wool, dusty-blue knit, brown leather, subdued silver panels, small gold reflections.'))
uc = style.build_uc('open staircase without side walls, curved central balustrade, cropped feet, floating feet, animal ears, magic circle, floating books')
output = ROOT.parent / '.tmp/nai/baita-station-nai5-v3-20261020/candidate.png'
receipt = Path(__file__).with_name('request.json')
assert not output.exists() and not receipt.exists(), 'Use a new candidate path.'
kwargs = dict(width=1344, height=768, seed=1402076391, model='nai-diffusion-5-full', char_prompts=characters, use_coords=True)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
    request=nai_gen.build_payload(prompt, uc, **kwargs), output=str(output),
    changes='Architecture promoted to first phrase with modest emphasis: TWO broad opaque chest-high silver divider walls; fine inner rails distinguished from solid walls; dense side crowds. Removed global escalator UC to avoid suppressing side-route architecture. Identity/model/seed/sampling/size/coordinates retained from v2.',
    previous_request_sha256=hashlib.sha256((ROOT / 'docs/evidence/2026-10-20-baita-station-nai5-v2/request.json').read_bytes()).hexdigest(),
    references=previous['references'],
    scope='One NAI5 candidate only; no image upload, built-in redraw, runtime replacement, tests, build or commit')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, out=output, **kwargs)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
