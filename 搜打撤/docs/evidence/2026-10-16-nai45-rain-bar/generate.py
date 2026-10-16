import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

SOURCE = Path('C:/Users/太平/AppData/Local/Temp/codex-clipboard-58d6dbec-0633-4708-9786-07d89f4152e1.png')
OUTPUT = ROOT.parent / '.tmp/nai/rain-bar-nai45-20261016.png'
RECEIPT = Path(__file__).with_name('request.json')
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, upper body, leaning on counter, head resting sideways on her folded forearm, looking at viewer, half-closed eyes, faint smile, relaxed melancholy.',
    composition_layer='Intimate eye-level close-up along a wooden bar counter. Her face and black-clad shoulder fill the right half; her cheek nearly touches the counter, one relaxed hand beneath her lips. A sharp crystal tumbler of amber whisky and ice stands immediately left of her face. A second large glass is cropped and heavily out of focus in the lower-left foreground. Rain-streaked window fills the left background; blurred illuminated bottle shelves on the right.',
    light_material_layer='Rainy night bar, amber and dark brown palette, warm golden backlight outlining silver hair, dim softly illuminated face, luminous refracted ice, wet glass droplets, glossy wooden counter reflecting the amber glass, shallow depth of field, cinematic bokeh, highly detailed.')
characters = [{'prompt': 'adult woman, red eyes, silver white hair, thick black forelock falling diagonally across one eye, chin-length loose side locks, black tied-back ponytail, two short curved black horns, angular white geometric halo floating behind her head, small black ear piercings, black high-collar jacket, long sleeves, layered cloth folds', 'uc': '', 'center': {'x': .72, 'y': .53}}]
uc = style.build_uc('standing, full body, drinking, holding glass, open mouth, daylight, extra people')
args = dict(width=1216, height=832, seed=1710164523,
            model='nai-diffusion-4-5-full', char_prompts=characters)
assert not RECEIPT.exists() and not OUTPUT.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              request=nai_gen.build_payload(prompt, uc, **args),
              references=[dict(source=str(SOURCE), sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                               usage='Visual analysis for composition, appearance and lighting; not uploaded')],
              output=str(OUTPUT), acquisition='Existing nai_gen / nai_guard client')
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, out=OUTPUT, **args)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
