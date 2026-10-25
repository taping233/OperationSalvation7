"""Reward backdrop: one NAI5 request through the shared client and guard."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

prompt = style.build_asset_prompt(
    'no humans, scenery, interior, a quiet frontier waystation supply room, '
    'a few stacked canvas supply cases and a narrow metal shelf at the far side edges, '
    'matte blue grey walls, a high frosted window with pale morning light, calm enclosed space',
    purpose_layer='An original atmospheric reward screen background for a fantasy anime card game. '
    'No interface or text. Keep the broad central area visually quiet for card overlays.',
    composition_layer='Wide level camera, simple asymmetrical composition, large coherent forms, '
    'low contrast wall planes and soft light across the center, the few props stay near the left and right edges. '
    'No table or furniture in the central foreground.',
    light_material_layer='Cool slate, faded teal and ivory, a tiny muted amber reflection near the far edge. '
    'Soft diffused daylight, matte material, economical painterly background detail, gentle quiet atmosphere.')
uc = ', '.join(part.strip() for part in style.build_uc(
    'photorealistic, realistic rendering, 3d, ruined cathedral, gothic arches, rubble, '
    'dense clutter, abandoned dungeon, cobwebs, neon, people, furniture in center, '
    'central pedestal, readable text, UI, buttons, cards, borders').split(',')
    if part.strip() != 'negative space')
seed = 251025071
out = ROOT.parent / '.tmp/nai/reward-redesign-1025/nai5-draft.png'
record_path = Path(__file__).with_name('nai5-request.json')
record = {'status': 'prepared', 'recipeVersion': style.RECIPE_VERSION,
          'request': nai_gen.build_payload(prompt, uc, width=1344, height=768,
              seed=seed, model='nai-diffusion-5-full', char_prompts=[]),
          'output': str(out), 'references': [],
          'ucException': 'Remove negative space because the UI needs a quiet central area.'}
record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
try:
    nai_gen.generate_image(prompt, uc, width=1344, height=768, seed=seed,
        model='nai-diffusion-5-full', char_prompts=[], out=str(out))
except BaseException as error:
    record.update(status='failed', error=str(error))
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    raise
record.update(status='generated', sha256=hashlib.sha256(out.read_bytes()).hexdigest())
record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
