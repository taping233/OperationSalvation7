import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

output = ROOT.parent / '.tmp/nai/changwuyu-drums-20261018/candidate-free-hatless.png'
receipt = Path(__file__).resolve().with_name('request-free-hatless.json')
assert not receipt.exists() and not output.exists(), 'Use a new candidate path.'
width, height, seed = 1344, 768, 1375806249
assert width * height < nai_gen.FREE_PX_CAP and nai_gen.DEFAULTS['steps'] <= 28
prompt = style.build_asset_prompt(
    '1boy, solo, full body, seated behind a compact drum kit, relaxed shoulders rolled forward, slightly hunched upper back, torso leaning forward. Elbows near knees, each hand loosely holding one drumstick across lap, sticks crossing below hands. Head turned toward screen-left, calm tired expression.',
    purpose_layer='Quiet rehearsal studio after a loud performance, amplifiers on both sides, acoustic wall panels, guitar leaning at image-right, microphones and floor cables.',
    composition_layer='Wide horizontal view, drummer centered, shoes visible, knees apart. Low frontal camera, bass drum below lap, toms beside torso, large cymbals above both sides. Foreground hardware frames him without obscuring face or hands.',
    light_material_layer='Warm overhead spotlight, pale rounded light pool on rear wall, coherent bare-head shadow. Warm face and hands, narrow golden cymbal reflections, muted olive, gunmetal and ivory palette, surrounding room in shadow.')
character = ('adult man, refined masculine anime face, silver-gray long hair in a low bun, long sidelocks, yellow eyes, pointy elf ears, thin round metal-framed eyeglasses, bare head, natural adult head size, full hair volume, short natural neck, dark gray crew-neck T-shirt covering neck base, thin open olive overshirt with rolled sleeves, loose black work trousers, plain pale sneakers')
uc = style.build_uc('girl, female, animal ears, cat ears, teal hair, braids, hat, witch hat, headwear, elongated neck, tiny head, staff, magic wand, extra drumsticks')
characters = [{'prompt': character, 'uc': '', 'center': {'x': 0.5, 'y': 0.5}}]
request = nai_gen.build_payload(prompt, uc, width=width, height=height,
    seed=seed, model='nai-diffusion-5-full', char_prompts=characters)
references = []
for path, purpose in [
    (Path(r'C:/Users/太平/Downloads/b3f3a54dfbcff93d8a11f0d6f2795082236908.png'), 'Original scene, relaxed seated pose and casual clothes; local reference only'),
    (ROOT / 'game/assets/portraits/full/changwuyu.webp', 'Current adult male identity, gray low bun, yellow eyes, elf ears, round glasses; hat explicitly omitted by user'),
    (Path(r'C:/Users/太平/.codex/generated_images/01a14f3d-d115-7002-98d2-5af998ea575a/exec-d043d0c5-26ba-4d70-99f9-6b82b600f120.png'), 'Built-in anatomy revision reviewed before NAI continuation; local reference only'),
]:
    references.append(dict(path=str(path), purpose=purpose,
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), uploaded=False))
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
    cleanup_version=style.CLEANUP_VERSION, request=request, references=references,
    output=str(output), scope='User authorized one NAI5 free-tier landscape draft after cooldown; hatless and corrected seated anatomy; no runtime asset replacement')

def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, width=width, height=height,
        seed=seed, model='nai-diffusion-5-full', out=output, char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=actual_seed,
    sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
