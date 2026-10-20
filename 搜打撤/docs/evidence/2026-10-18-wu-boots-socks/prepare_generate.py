import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/wu-boots-socks-1018/nai-base.png'
OUT.parent.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, looking at viewer, confident smile, sitting on a low modern bench, removing footwear, barefoot, bare legs, holding boots, holding socks. Her right hand holds one removed black ankle boot beside her right hip; her left hand holds one removed black sock beside her left hip, both hands clearly visible. The other boot and sock rest together on the floor beside the bench.',
    purpose_layer='Full-body character illustration, Arknights-inspired refined anime game illustration, highly detailed.',
    composition_layer='Portrait composition, dramatic foreshortening, low three-quarter camera, one bent knee closer to camera, both bare feet visible on the floor, face and hands unobstructed, entire figure in frame. Skirt covers her lap naturally.',
    light_material_layer='Minimal cool pale gray studio backdrop, soft directional light, blue rim light, refined silver hair, clear leather seams, soft black knit sock folds, precise eyes and hands.')
appearance = ('adult woman, silver white long hair, high ponytail, blue ribbon bow, blue eyes, parted bangs, small fang, '
              'black round sunglasses on head, dark tinted lenses, thin frames, black rose above her left temple, '
              'black charcoal off-shoulder long-sleeved short dress, layered ruffles at neckline cuffs and skirt, '
              'black tied waist, skirt hems above knees, bare legs, barefoot, black sheathed straight sword strapped diagonally behind her back')
uc = style.build_uc('child, loli, goggles, long skirt, dress train, blue star pattern, worn socks, worn boots, pantyhose, thighhighs, underwear, upskirt, extra limbs, duplicated footwear, cropped head, cropped feet')
characters = [dict(prompt=appearance, uc='', center=dict(x=.5, y=.5))]
request = nai_gen.build_payload(prompt, uc, width=832, height=1216, seed=181018326, char_prompts=characters)
receipt = Path(__file__).with_name('request.json')
assert not receipt.exists() and not OUT.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=request,
              output=str(OUT.relative_to(ROOT.parent)), references=[dict(path='搜打撤/game/assets/portraits/full/wu.webp', purpose='identity checked visually; not uploaded to NAI')])
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216, seed=181018326, out=str(OUT), char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
