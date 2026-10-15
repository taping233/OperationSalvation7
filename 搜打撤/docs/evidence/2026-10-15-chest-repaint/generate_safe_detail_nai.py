"""Single detailed safe design before expanding rejected atlas frames."""
import hashlib
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style
import nai_style
OUT = ROOT / 'game/art-source/chests/safe-detail-v5'
OUT.mkdir(parents=True,exist_ok=True)
output, receipt = OUT / 'nai.png', OUT / 'nai-request.json'
assert not output.exists() and not receipt.exists()
painting = ('Refined hand-painted anime illustration, detailed believable mechanical design, layered matte color planes, '
            'confident selective colored contours and purposeful opaque brush marks. Fine structure at locking mechanism and hinge, '
            'large coherent shadows on broad surfaces. Rich restrained blue grays and warm ivory, concentrated gold light. '
            'Accurate volumetric construction and varied edges, not crude flat blocks, not global grain, not plastic 3D, no text.')
prompt = style.build_asset_prompt(
    'no humans, one heavy freestanding square steel safe, front door swung open toward left, three-quarter view from right and slightly above. '
    'Deep midnight slate body, layered ivory reinforced door rim, circular brass combination dial, polished short brass handle, '
    'thick steel door cross section, six cylindrical locking bolts and two articulated left hinges. '
    'Accurate hardware connections, carefully designed industrial fantasy prop. '
    'Inside compartment is EMPTY, filled only with a luminous white-gold flash and a few sharp star-shaped glints. No physical rewards.',
    purpose_layer='One full-resolution game prop concept, single object, not sprite sheet or collage.',
    composition_layer='Entire safe and opened attached door visible, clear strong silhouette, object occupies 78 percent of square canvas. Plain dark neutral background, no environment.',
    light_material_layer='Soft cool top light reveals layered painted metal, intense internal white-gold light spills onto inner door and bevel, narrow selective highlights on brass. Refined economical painted details, no uniform dirty scratches.')
prompt=prompt.replace(nai_style.STYLE_BLOCK,painting)
uc=style.build_uc('people, person, chest, suitcase, top lid, room door, coins, gold bars, jewelry, gems, treasure objects, vector, low poly, rough sketch, crosshatching, dirty metal, pixel art')
record=dict(status='prepared',request=nai_gen.build_payload(prompt,uc,width=1024,height=1024,seed=1574910215,char_prompts=[]),
            output=str(output.relative_to(ROOT)),direction='Owner rejected v3/v4 as insufficiently detailed and inconsistent style. Single design revision; no runtime installation.')
def save(): receipt.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
save()
try:
    path,_=nai_gen.generate_image(prompt,uc,width=1024,height=1024,seed=1574910215,char_prompts=[],out=str(output))
except BaseException as error:
    record.update(status='failed',error_type=type(error).__name__);save();raise
record.update(status='generated',sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest());save()
