"""Generate the first event-scene draft with the project's guarded NAI client."""
import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))

from nai_gen import DEFAULTS, generate_image
from nai_style import RECIPE_VERSION, build_asset_prompt, build_uc

SCENE = sys.argv[1] if len(sys.argv) > 1 else 'last-lamp'
if SCENE not in {'last-lamp', 'goldmine'}:
    raise SystemExit(f'Unknown scene: {SCENE}')
OUTPUT = PROJECT.parent / '.tmp' / 'nai' / 'output' / 'WF-expedition-event-1013' / f'{SCENE}-nai.png'
if OUTPUT.exists():
    raise SystemExit(f'Output already exists: {OUTPUT}')

subject = (
    'wide anime game event background, abandoned winter school passage, '
    'broken windows, snow blowing inside, old evacuation sign with two faded '
    'opposite arrows and a single warm emergency lantern, no people'
)
composition = (
    'Landscape 1344x768 illustration. The sign and lantern form a strong, simple '
    'focal silhouette in the left half. The lower left has dark quiet space for '
    'story text. The right 40 percent is a dim low-detail continuation of the '
    'passage for interactive choices. Keep the scene readable at game-screen size.'
)
lighting = (
    'Cold muted blue-gray snow and charcoal shadows, small warm amber lantern '
    'accent, broad opaque planes, hard and soft edges mixed, visible economical '
    'brush marks. No photorealistic architecture, fine surface noise, or smooth airbrush.'
)
prompt = build_asset_prompt(subject, purpose_layer='Original story event illustration, no UI.',
                            composition_layer=composition, light_material_layer=lighting)
uc = build_uc('photorealistic, realistic 3d, detailed stone texture, tiny windows, '
              'bright white snow field, text, lettering, signage words, interface, '
              'buttons, panels, logos, people, watermark')
if SCENE == 'goldmine':
    subject = (
        'wide anime game event background, collapsed winter mine below a ruined city, '
        'buckling timber supports, deep black shaft, exposed metal ore glinting in the rock, '
        'one original bundled-up scout examining the ore with a small lantern'
    )
    composition = (
        'Landscape 1344x768 illustration. Mine opening, scout and ore occupy the left '
        'half in one strong silhouette. The lower left has dark quiet space for story text. '
        'The right 40 percent is an unoccupied dim rock wall reserved for interactive choices. '
        'Do not place the scout or bright ore beneath that right-side area.'
    )
    lighting = (
        'Cold blue-gray and charcoal with restrained amber lantern and metallic glints, '
        'broad opaque shadow planes, matte hand-painted anime brush strokes. '
        'No photorealistic rock texture, fine line noise, or smooth airbrush.'
    )
    prompt = build_asset_prompt(subject, purpose_layer='Original story event illustration, no UI.',
                                composition_layer=composition, light_material_layer=lighting)
    uc = build_uc('photorealistic, realistic 3d, finely textured rocks, bright sky, '
                  'text, lettering, interface, buttons, panels, logos, watermark, '
                  'multiple people, centered subject')
seed = {'last-lamp': 10131531, 'goldmine': 10131532}[SCENE]
request = {
    'scene': SCENE, 'model': 'nai-diffusion-4-5-full', 'recipeVersion': RECIPE_VERSION,
    'width': 1344, 'height': 768, 'seed': seed, 'parameters': DEFAULTS,
    'prompt': prompt, 'negative_prompt': uc, 'output': str(OUTPUT),
    'status': 'NAI draft; internal redraw required before installation',
}
(EVIDENCE / f'{SCENE}-nai-request.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, width=1344, height=768,
                                   seed=seed, out=OUTPUT, model=request['model'])
source = Path(path)
receipt = {
    'scene': SCENE, 'path': str(source), 'seed': actual_seed,
    'model': request['model'], 'recipeVersion': RECIPE_VERSION,
    'bytes': source.stat().st_size,
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'installed': False,
}
(EVIDENCE / f'{SCENE}-nai-receipt.json').write_text(
    json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False), flush=True)
