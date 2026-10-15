import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_style

HERE = Path(__file__).resolve().parent
OUT = ROOT.parent / '.tmp/nai/wu-half-20261015/wu-half-v18.png'
subject = ('1girl, solo, silver-white long hair, high ponytail tied with a blue satin bow, '
           'parted bangs, both cyan-blue eyes visible, pale skin, confident smile, small fang. '
           'Black round goggles resting on top of her head, black rose at her left temple '
           '(viewer right). Black-gray off-shoulder long-sleeved dress, layered neckline '
           'ruffles, black waist tie, diagonal black sword strap. A sheathed black straight '
           'sword on her back, angular pommel and black wrapped hilt above her right shoulder '
           '(viewer left).')
scene = ('Waist-up character portrait, eye-level, slight three-quarter turn, looking at viewer. '
         'Centered head and torso, entire ponytail root and accessories within frame, '
         'generous white margin above head, crop at waist. Arms relaxed beside torso. '
         'Pure white background, no scenery, neutral studio light. Matte black cloth, '
         'small gray reflections on goggle lenses, blue ribbon as the color accent.')
prompt = nai_style.build_prompt(subject, scene)
uc = nai_style.build_uc('full body, hair over one eye, holding sword, extra people, colored background')
request = dict(recipe_version=nai_style.RECIPE_VERSION, artist_chain=nai_style.ARTIST_BLOCK,
               prompt=prompt, uc=uc, model=nai_gen.MODEL, seed=15102027, width=832, height=1216,
               parameters=nai_gen.DEFAULTS, output=str(OUT),
               identity_source='game/assets/portraits/full/wu.webp',
               references_uploaded=[], status='prepared')
(HERE / 'request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
assert nai_style.ARTIST_BLOCK == '1.2::miv4t::, 0.8::quasarcake::'
assert 'restrained overall saturation' in prompt
assert 'Faces and gestures' not in prompt
if '--generate' in sys.argv:
    path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216, seed=15102027, out=OUT)
    request.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    (HERE / 'request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
else:
    print('Prepared request; artist weights preserved; composition separated.')
