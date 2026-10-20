import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

output = ROOT.parent / '.tmp/nai/changwuyu-drums-20261018/candidate.png'
receipt = Path(__file__).with_name('request.json')
prompt = style.build_asset_prompt(
    '1boy, solo, adult male, seated behind a compact drum kit, legs apart, torso leaning forward slightly, elbows near knees, each hand loosely holding one drumstick across his lap, the two sticks crossing below his hands, head turned toward screen-left, quiet tired expression,',
    purpose_layer='A quiet rehearsal studio after a loud performance. Drum kit around the seated drummer, amplifiers on both sides, acoustic wall panels behind him, a guitar leaning against the right amplifier, microphone stands and floor cables.',
    composition_layer='Wide horizontal composition, full body seated at center, shoes visible. Low front view through the gap between the bass drum and cymbal stands. Foreground drum hardware partially frames him without hiding his face. Large cymbals on both sides above the toms, bass drum below his lap.',
    light_material_layer='Single warm overhead spotlight casting a pale circle on the wall behind him, warm light on his face and hands, narrow golden sheen along cymbal edges, surrounding amplifiers fading into shadow. Muted olive, gunmetal and warm ivory colors, stillness after a performance.')
character = ('adult man, masculine face, silver-gray long hair tied in a low bun, long sidelocks hanging over shoulders, yellow eyes, pointy elf ears, thin round metal-framed eyeglasses, black wide-brimmed witch hat with a long bent pointed tip and purple underside, dark gray T-shirt, thin open olive overshirt with rolled sleeves, loose black work trousers, plain sneakers')
uc = style.build_uc('girl, female, animal ears, cat ears, teal hair, braids, staff, magic wand, extra drumsticks')
characters = [{'prompt': character, 'uc': '', 'center': {'x': 0.5, 'y': 0.5}}]
seed = 1375806249
request = nai_gen.build_payload(prompt, uc, width=2048, height=1152, seed=seed, char_prompts=characters)
assert not receipt.exists() and not output.exists(), 'Use a new candidate path.'
references = []
for path, purpose in [
    (Path(r'C:/Users/太平/Downloads/b3f3a54dfbcff93d8a11f0d6f2795082236908.png'), 'Composition, scene, pose, casual clothes; original embedded prompt read; not uploaded'),
    (ROOT / 'game/assets/portraits/full/changwuyu.webp', 'Current identity visually inspected; not uploaded'),
]:
    references.append(dict(path=str(path), purpose=purpose, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), uploaded=False))
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, cleanup_version=style.CLEANUP_VERSION, request=request, references=references, output=str(output), scope='One candidate only; no runtime asset replacement')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, width=2048, height=1152, seed=seed, out=output, char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=actual_seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
