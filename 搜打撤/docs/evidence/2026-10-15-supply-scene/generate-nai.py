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
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    'scenery, no humans. A futuristic emergency supply capsule unfolded like a mechanical flower beneath a sweeping elevated monorail. Three broad ivory composite shell panels open around a low circular platform, sheltering sealed orange ration cases, a medical container and neatly stacked supply crates. A small suspended amber worklight makes this unattended cache feel like a tiny welcoming island in an abandoned winter city.',
    purpose_layer='Wide game environment illustration, a discoverable supply point, futuristic urban exploration.',
    composition_layer='16:9 landscape, eye-level three-quarter wide view. Capsule entirely visible in upper-left and middle-left, spanning roughly 35 percent of image width, not a close-up product. Rail curves from upper left toward distant center. Open quiet dark architecture on right 40 percent for interface overlay, quiet foreground lower 25 percent. Clear walkable approach and strong foreground middle ground distance.',
    light_material_layer='Cold pale turquoise winter daylight, muted blue-gray architecture, ivory shell, concentrated amber-orange accents. Thin snow along ledges, clear wet ground reflecting warm light. Large readable shapes, sparse structural detail, calm atmospheric depth.')
uc = style.build_uc('people, character, girl, medieval, fantasy castle, ornate treasure chest, golden treasure, overgrown jungle, crowded objects, tiny unreadable machinery, fisheye, isometric, text, logo')
request = nai_gen.build_payload(prompt, uc, width=1024, height=576, seed=101524017, char_prompts=[])
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request,
              references=[], output='game/art-source/scenes/supply-petal-20261015/nai-draft.png',
              concept='高架下的花瓣式补给舱', ratio='16:9', runtime_installed=False)
receipt = HERE / 'nai-request.json'
assert not receipt.exists() and not (OUT / 'nai-draft.png').exists()
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1024, height=576,
        seed=101524017, out=OUT / 'nai-draft.png', char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
