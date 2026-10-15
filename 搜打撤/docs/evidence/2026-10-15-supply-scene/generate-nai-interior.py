import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = ROOT / 'game/art-source/scenes/supply-petal-20261015'
prompt = style.build_asset_prompt(
    'scenery, no humans, interior. Inside an abandoned futuristic urban parcel distribution depot just after someone forced the entrance. Half-open wall lockers, tilted plastic transit bins, a few forgotten sealed ration packs and medical cases on a broad sorting counter. A pried-open automatic sliding door on the left reveals the winter city. One small amber emergency lamp still works above the counter. A fallen ceiling panel and a tipped trolley suggest interrupted daily life and a place worth searching, not a treasure room.',
    purpose_layer='Wide game environment illustration for entering a building and rummaging for supplies left behind.',
    composition_layer='16:9 landscape, eye-level wide view from just inside the doorway. Strong architectural perspective, doorway at far left, search-worthy lockers and counter at upper-middle-left. Right 40 percent quiet darker room depth for interface choices. Lower 25 percent quiet walkable floor for narrative overlay. Objects realistically human-scale, clear foreground middle ground and rear wall.',
    light_material_layer='Cold pale teal daylight slants through the forced door, warm muted amber emergency light over a few orange supply containers. Matte ivory wall panels, slate blue shadows, synthetic materials. Sparse snow only at the threshold, interior dry. Large readable forms, restrained details, calm intriguing atmosphere.')
uc = style.build_uc('people, girl, outdoor main scene, train, capsule, flower, medieval, castle, wooden treasure chest, piles of gold, supermarket full of goods, abundant stock, text, logo')
request = nai_gen.build_payload(prompt, uc, width=1024, height=576, seed=101524018, char_prompts=[])
output = OUT / 'nai-interior-draft.png'
receipt = HERE / 'nai-interior-request.json'
assert not receipt.exists() and not output.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request, references=[],
              output=str(output.relative_to(ROOT)), ratio='16:9',
              concept='闯入未来城市配送站，翻找遗留物资', runtime_installed=False)
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1024, height=576,
        seed=101524018, out=output, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
