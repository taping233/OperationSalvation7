"""New design, after owner rejected blue/gold mechanical complexity."""
import hashlib
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
import nai_gen
import nai_prompt_clean as style
import nai_style
OUT=ROOT/'game/art-source/chests/safe-simple-v7'
OUT.mkdir(parents=True,exist_ok=True)
output,receipt=OUT/'nai.png',OUT/'nai-request.json'
assert not output.exists() and not receipt.exists()
painting=('Hand-painted anime prop, elegant simple silhouette, opaque connected color masses, nuanced secondary color planes, '
          'firm handmade edges and a few broad directional strokes, selective thin structural accents. '
          'Quiet large surfaces, readable simply painted parts, restrained neutral colors with a tiny chromatic accent. '
          'No photorealism, no 3D render, no dense outlining, no overall grain, no facet mosaics, no text.')
prompt=style.build_asset_prompt(
    'no humans, one small freestanding square safe, CLOSED front door. Warm off-white painted steel front, charcoal gray body, '
    'a muted gray-green side plane and ONE small vermilion-red latch accent. '
    'Simple solid round charcoal combination knob, short rectangular lever, one clean recessed door seam, two discreet left hinges. '
    'A compact carefully proportioned object with an appealing bold contour and few parts.',
    purpose_layer='Original anime game prop concept, single object, no animation grid.',
    composition_layer='Three-quarter view slightly above from right, full object with generous transparent-like empty margins, plain neutral dark background.',
    light_material_layer='Matte coated metal with broad ivory light planes and connected cool-gray shadows, a few precise brush accents at knob and hinge. No brass trim, no gold decoration, no exposed screws or rows of locking bolts.')
prompt=prompt.replace(nai_style.STYLE_BLOCK,painting)
uc=style.build_uc('people, ornate, filigree, armor plates, rivets, screws, gold trim, brass, jewelry, blue and gold, glossy metal, chrome, photorealistic, 3d, vector logo, crosshatching, coin, treasure')
record=dict(status='prepared',request=nai_gen.build_payload(prompt,uc,width=1024,height=1024,seed=1674910215,char_prompts=[]),output=str(output.relative_to(ROOT)),
            direction='Owner requested simpler shape and new palette; arknights-art-ui-design + current project painting grammar. Prior blue/gold versions rejected; do not reuse their design.')
def save():receipt.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
save()
try:path,_=nai_gen.generate_image(prompt,uc,width=1024,height=1024,seed=1674910215,char_prompts=[],out=str(output))
except BaseException as error:record.update(status='failed',error_type=type(error).__name__);save();raise
record.update(status='generated',sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest());save()
