import sys, json, hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
import nai_gen
from nai_prompt_clean import build_asset_prompt, build_uc

out = root.parent / '.tmp/nai/layer-descent-20261025.png'
prompt = build_asset_prompt(
    'scenery, no humans, a monumental abandoned underground winter-city passage, massive concrete gateway framing a descending stairway into an immense industrial cavern, snow blown through a broken roof, distant cold luminous opening',
    purpose_layer='Full-screen game cinematic for entering a deeper exploration layer. A single continuous environmental painting, no lettering, no UI.',
    composition_layer='Wide landscape, eye-level camera at the threshold, dark huge architectural masses at both edges, strong vanishing point near the center, descending stairs lead toward a small distant illuminated space, clear foreground middle ground and distant depth.',
    light_material_layer='Desaturated blue grey concrete, deep teal shadows, sparse amber service lamps, soft white snow and mist, dramatic restrained lighting, atmospheric perspective.')
uc = build_uc('people, character, letters, typography, split screen, panels')
record = dict(status='prepared', request=nai_gen.build_payload(prompt, uc, seed=10251025, char_prompts=[]), output=str(out))
receipt = Path(__file__).with_name('nai-request.json')
def save(): receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    nai_gen.generate_image(prompt, uc, seed=10251025, out=out, char_prompts=[])
    record.update(status='generated', sha256=hashlib.sha256(out.read_bytes()).hexdigest())
except BaseException as error:
    record.update(status='failed', error=str(error))
    raise
finally: save()
