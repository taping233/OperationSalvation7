import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = PROJECT.parent / '.tmp/nai/transition-art-sample-20261021/nai.png'
SCENE = ('scenery, no humans, winter futuristic city, a massive open sliding transit gate '
         'connecting two urban levels, viewed from inside a sheltered elevated passage, '
         'broad walkway continuing through the gate into a bright snowy city, '
         'modern modular architecture, pale composite panels, steel beams, glass, '
         'snow gathered at the edges, distant layered buildings and elevated railways')
COMPOSITION = ('wide cinematic environment illustration, eye level, strong readable depth, '
               'large rectangular gateway on the right half, gate frames the sunlit city, '
               'left third is a quiet shadowed wall with broad uncluttered color planes '
               'for a later interface title, a clear continuous walkway leads forward, '
               'complete architectural silhouettes, no letters or interface')
LIGHT = ('cold blue gray passage, pale turquoise sky, muted warm ivory sunlight outside, '
         'small amber guidance lamps, distinct light and shadow groups, calm hopeful mood, '
         'clean modern materials, no medieval ruins')
prompt = style.build_asset_prompt(SCENE, purpose_layer='game inter-level transition background',
                                 composition_layer=COMPOSITION, light_material_layer=LIGHT)
uc = style.build_uc('text, letters, numbers, logo, watermark, people, medieval castle, '
                    'stone pillars, ruined gothic arches, busy foreground clutter')
payload = nai_gen.build_payload(prompt, uc, width=1344, height=768, seed=102100731,
                               char_prompts=[])
receipt = HERE / 'nai-request.json'
assert not receipt.exists() and not OUT.exists(), 'Candidate already exists; do not overwrite.'
record = dict(status='prepared', purpose='跨层过场单张预览，不接入运行素材',
              recipe_version=style.RECIPE_VERSION, request=payload,
              references=[], output=str(OUT), acquisition='nai_gen.generate_image')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    output, seed = nai_gen.generate_image(prompt, uc, width=1344, height=768,
                                         seed=payload['parameters']['seed'], out=OUT,
                                         char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed,
              sha256=hashlib.sha256(Path(output).read_bytes()).hexdigest())
save()
