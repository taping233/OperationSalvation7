"""Safe revision after the owner rejected the industrial chest draft."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style
import nai_style

OUT = ROOT / 'game/art-source/chests/safe-v3'
OUT.mkdir(parents=True, exist_ok=True)
output = OUT / 'safe-nai.png'
receipt = OUT / 'nai-request.json'
assert not receipt.exists() and not output.exists()
v1_props = (
    'Hand-painted anime prop illustration. Opaque economical color masses, broad directional curved or elongated strokes, '
    'firm handmade edges, connected main shadow shapes, selected irregular overlaps surrounded by quiet surfaces. '
    'Readable simply painted mechanical structure. Muted coherent cool and warm colors with concentrated vivid accents. '
    'No dense outlines, no crosshatching, no global grain, no glossy 3D, no uniform vector fill, no triangular mosaics. no text.'
)
prompt = style.build_asset_prompt(
    'no humans. A heavy freestanding steel SAFE, upright square silhouette, thick graphite-blue body, '
    'broad ivory front door bevel, large circular brass combination dial, short three-spoke locking wheel, '
    'two thick hinges on LEFT edge of front door. One striking amber lock accent. '
    'SIX consecutive opening animation frames of the same safe. First closed, second unlocking, '
    'third narrow vertical light gap, fourth front door swinging LEFT to 40 degrees, '
    'fifth front door wide open 100 degrees with a bright white-gold treasure eruption, '
    'sixth door stays wide open with warm luminous contents.',
    purpose_layer='Six equally spaced animation cells, 3 columns by 2 rows, same fixed camera and same safe body.',
    composition_layer='Almost front view slightly from above and right. Complete object in each cell with ample margin. '
                      'Fixed body and baseline across frames. Safe door pivots to LEFT, never opens upward. Uniform dark neutral background.',
    light_material_layer='Matte hand-painted metal, broad cool gray shadow shapes, a few warm opaque edge strokes, '
                         'simple appealing bold silhouette. Treasure light confined to interior and local rays.')
prompt = prompt.replace(nai_style.STYLE_BLOCK, v1_props)
uc = style.build_uc('girl, boy, person, treasure chest, suitcase, top lid, open top, canvas texture, hatch marks, scenery, text, checkerboard')
payload = nai_gen.build_payload(prompt, uc, width=1344, height=768, seed=1474910215, char_prompts=[])
record = dict(status='prepared', request=payload, output=str(output.relative_to(ROOT)),
              style_source='docs/production/art/ART-STYLE-V1.md',
              style_override='Replace conflicting shared STYLE_BLOCK with prop-specific v1.0 painting grammar; artist chain unchanged.',
              direction='Owner: safe with front door opening, replacing rejected top-lid chest.')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, uc, width=1344, height=768, seed=1474910215,
                                    char_prompts=[], out=str(output))
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
