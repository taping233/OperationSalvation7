import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

here = Path(__file__).resolve().parent
output = ROOT.parent / '.tmp/nai/general-transition-1016/nai-draft-v2.png'
output.parent.mkdir(parents=True, exist_ok=True)
receipt = here / 'nai-request-v2.json'
assert not output.exists() and not receipt.exists(), 'Candidate already exists.'
prompt = style.build_asset_prompt(
    'scenery, no humans, winter landscape. An empty snow-covered mountain passage, an old ruined stone gateway on the RIGHT, a single long faded vermilion cloth tied to its upright hanging in the cold wind. Beyond the gateway a winding pale snowy path leads into layered dark blue pine forests and immense distant snowy mountain silhouettes. A quiet journey between places, no battle. A few snow-laden branches frame the upper right. Wide calm pale winter sky, sparse drifting snow.',
    purpose_layer='A beautiful atmospheric reusable transition illustration for a winter expedition game. Environment only, no UI or lettering.',
    composition_layer='Wide 16:9 landscape. Three clear depth layers, strong graphic silhouettes and a simple diagonal path. Main gateway and red cloth occupy the RIGHT third. LEFT 40 percent is quiet deep blue-gray foreground shade and misty snow, no focal props, for overlay text. The mountain and forest are grouped shapes, no intricate architectural clutter.',
    light_material_layer='Luminous cold winter overcast light, delicate icy cyan and pale silver snow, deep ink blue foreground shadow, desaturated blue-green forests. One small vivid vermilion cloth is the only warm color accent. Spacious, poetic and inviting, restrained contrast with a clear cold-warm accent. Hand-painted anime environment illustration, economical shapes and clear large-scale light and shadow.',
)
uc = style.build_uc('people, human, girl, boy, character, face, animal, weapons, enemies, fighting, machinery, industrial scaffolding, ruined city, detailed brickwork, crowded composition, lettering, logo, watermark, interface, photorealistic, 3d render')
request = nai_gen.build_payload(prompt, uc, width=1344, height=768, char_prompts=[])
record = dict(status='prepared', workflow='NovelAI draft -> built-in ImageGen redraw',
              recipeVersion=style.RECIPE_VERSION, cleanupVersion=style.CLEANUP_VERSION,
              request=request, output=str(output.relative_to(ROOT.parent)))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1344, height=768,
        seed=request['parameters']['seed'], out=str(output), char_prompts=[])
except BaseException as error:
    record.update(status='failed', errorType=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, bytes=Path(path).stat().st_size,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
print('NAI draft and full request saved.')
