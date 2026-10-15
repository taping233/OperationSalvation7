import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = ROOT / 'game/art-source/scenes/fire-shelter-20261015'
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1person, adult traveler with short blue hair, gray winter jacket and an orange backpack set on the bench. Sitting on a curved station bench, leaning forward and warming both gloved hands over a small portable fire brazier, quiet rest. Visible orange flames inside a low metal fire bowl, kettle on a side bracket. A sheltered campsite inside an abandoned futuristic elevated transit waiting hall in winter. One broken curved translucent windscreen wraps around the warm little camp like a crescent, torn canopy above, a folded blanket on the bench.',
    purpose_layer='Wide game environment illustration for campfire rest, calm warmth and recovery in a cold futuristic city.',
    composition_layer='16:9 horizontal. Diagonal wide view from the station entrance, strong two-point perspective. A large dark structural rib crops the near left edge; floor seams lead to the traveler and fire at middle-left. Crescent bench recedes into room depth. Tall open arch reveals distant snow-covered elevated city terraces. Right 40 percent quieter cool architecture for game choices, lower-left floor quiet for narration. Person about 30 percent of image height, full seated silhouette, believable human scale.',
    light_material_layer='Winter blue hour, cold teal and slate blue city, warm amber fire lights hands and face and ivory canopy underside, warm light concentrated at camp. Large coherent shadows, sparse snow at open edge, interior dry, matte synthetic panels and broad architectural forms, inviting stillness.')
uc = style.build_uc('multiple people, standing, fighting, medieval, stone castle, old european buildings, wooden cabin, huge bonfire, fire on bench, huge kettle, dense rubble, crowded equipment, text, logo')
request = nai_gen.build_payload(prompt, uc, width=1024, height=576, seed=101524025, char_prompts=[])
output = OUT / 'nai-fire-draft.png'
receipt = HERE / 'nai-fire-request.json'
assert not receipt.exists() and not output.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request, references=[],
              output=str(output.relative_to(ROOT)), ratio='16:9',
              concept='废弃高架候车厅的弧形挡风营火', runtime_installed=False)
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1024, height=576,
        seed=101524025, out=output, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
