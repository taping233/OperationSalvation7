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
    '1person, adult scavenger, crouching, leaning forward, head down, back view, rummaging. BOTH HANDS INSIDE A LARGE OPEN STORAGE CRATE. The open crate is directly in front of the kneeling person; raised lid and visible ration packets inside. One hand lifts a packet while the other searches the contents. Short slate winter jacket, dark trousers, compact orange backpack. Abandoned futuristic parcel depot interior. Wide-open cupboard doors behind the person, two fully pulled-out drawers, discarded empty packets and folders scattered across the floor. Forced sliding entrance at left, cold winter light, small amber emergency lamp above lockers.',
    purpose_layer='Wide game environment illustration for entering a building and rummaging for supplies left behind.',
    composition_layer='16:9 landscape, eye-level wide view from just inside the doorway. Strong architectural perspective, doorway at far left, scavenger and open searchable crate at middle-left, entire kneeling figure visible and small within the room, about one third of image height. Search-worthy lockers above the character, readable hands interacting with crate contents. Right 40 percent quiet darker room depth for interface choices. Lower 25 percent quiet walkable floor for narrative overlay. Objects realistically human-scale, clear foreground middle ground and rear wall.',
    light_material_layer='Cold pale teal daylight slants through the forced door, warm muted amber emergency light over a few orange supply containers. Matte ivory wall panels, slate blue shadows, synthetic materials. Sparse snow only at the threshold, interior dry. Large readable forms, restrained details, calm intriguing atmosphere.')
uc = style.build_uc('multiple people, looking at viewer, portrait, standing pose, posing, sitting idle, looking over shoulder, looking back, hands away from box, closed crate, closed lockers, outdoor main scene, train, capsule, flower, medieval, castle, wooden treasure chest, piles of gold, supermarket full of goods, abundant stock, text, logo')
request = nai_gen.build_payload(prompt, uc, width=1024, height=576, seed=101524020, char_prompts=[])
output = OUT / 'nai-interior-searcher-v2.png'
receipt = HERE / 'nai-interior-searcher-v2-request.json'
assert not receipt.exists() and not output.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request, references=[],
              output=str(output.relative_to(ROOT)), ratio='16:9',
              concept='人物蹲下翻箱，柜门及抽屉敞开，搜寻建筑内遗留物资', runtime_installed=False)
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1024, height=576,
        seed=101524020, out=output, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
