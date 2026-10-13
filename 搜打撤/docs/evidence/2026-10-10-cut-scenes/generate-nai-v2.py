import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'tools'))
from nai_gen import generate_image, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

evidence = Path(__file__).resolve().parent
sources = root / 'game/art-source/ui/cut-scenes-20261010'
scenes = {
    'camp': 'Snowy night refuge entrance, one sturdy closed wooden gate in a dark fortified city wall, large snowy angular rooftop silhouette behind, one small muted amber gate light. No banners or decorative flags. Safe quiet refuge.',
    'photo': 'An antique bellows camera on a wooden photography table, unmistakable large round lens, two small blank mounted photographs leaning behind the camera, dark curtain backdrop. One restrained warm light along the lens and tabletop. The camera is the main silhouette, no large lamp.',
    'field': 'Snowbound expedition route beyond the city, rugged path zigzagging toward a distant mountain pass, one simple wooden direction post without letters, broad snow ridges and dark rocky silhouettes. A subdued cool gray horizon, strong depth and readable route.',
    'battle': 'Deserted broken city alley, huge dark ruined building walls with sharp slanted shadows, one snapped iron barricade and two rubble blocks. Narrow muted rusty red light in depth suggesting danger. Tense deserted battlefield, no shops or crowds.',
    'achievement': 'A quiet dim hall of achievement medals and honor archives, one large antique brass laurel wreath surrounding a simple blank shield emblem displayed upright in a dark wooden cabinet, a few neatly aligned smaller medal silhouettes and two closed archive volumes below. Main wreath and shield on the right-middle, restrained warm gold highlight and soft cool charcoal surroundings. Clear symbolic honor cabinet, no writing, no specific achievement symbols, no trophy cup, no character.',
    'boss': 'Deserted ruined greenhouse arena, tall arching steel frames and shattered glass roof, large circular stone fighting platform, gigantic dark doorway behind. One narrow cold turquoise shaft of light across the platform. Monumental oppressive scale, no creatures or characters.',
}
composition = ('Wide landscape background for a short game interface transition. Main silhouette and light focus on the right half at middle height. The left half is quiet almost-black negative space for later overlay text. Only three large overlapping depth layers. Very simple readable shapes, low detail density, broad angular opaque planes and hard-edged light and shadow. No people, lettering or interface graphics.')
light = 'Charcoal, desaturated deep blue-gray, muted teal and sparse cream accents. Dark low-key lighting. No photorealistic texture, glossy 3D surfaces, airbrush gradients or dense tiny ornaments.'
uc = build_uc('human, person, people, girl, boy, character, face, body, portrait, statue, creature, monster, text, letters, logo, ui, panels, grid, dense detail, highly detailed, busy composition, photorealistic, 3d render, lens flare, neon')
requests = []
for index, (scene, subject) in enumerate(scenes.items()):
    requests.append({'scene': scene, 'model': 'nai-diffusion-4-5-full', 'width': 1344, 'height': 768,
        'seed': 101026800 + index, 'parameters': DEFAULTS,
        'prompt': build_asset_prompt('Scenery only, no humans. ' + subject,
            purpose_layer='A dedicated silhouette-style environmental image for this game interface only.',
            composition_layer=composition, light_material_layer=light),
        'negativePrompt': uc, 'output': str(sources / (scene + '-nai-v2.png'))})
(evidence / 'nai-requests-v2.json').write_text(json.dumps(requests, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipts = []
for item in requests:
    output = Path(item['output'])
    if not output.exists():
        try:
            generate_image(item['prompt'], item['negativePrompt'], width=item['width'], height=item['height'],
                seed=item['seed'], out=output, model=item['model'])
        except SystemExit as error:
            (evidence / 'nai-failure-v2.json').write_text(json.dumps({'scene': item['scene'], 'error': str(error)}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            raise
    receipt = {'scene': item['scene'], 'model': item['model'], 'seed': item['seed'],
        'path': str(output), 'bytes': output.stat().st_size,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
    receipts.append(receipt)
    (evidence / 'nai-receipts-v2.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DRAFT_READY ' + item['scene'], flush=True)
