"""One requested NAI 4.5 snow-road candidate; no runtime asset changes."""
import gzip
import hashlib
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
FREE = '--free' in sys.argv
WIDTH, HEIGHT = (1344, 768) if FREE else (2048, 1152)
OUT = ROOT.parent / ('.tmp/nai/wu-snow-road-nai45-20261016-free.png' if FREE
                     else '.tmp/nai/wu-snow-road-nai45-20261016.png')
SOURCE = Path(r'C:\Users\太平\AppData\Local\Temp\codex-clipboard-597aa3bb-6e2c-4f1f-aa32-902bea0a21bf.png')
PORTRAIT = ROOT / 'game/assets/portraits/full/wu.webp'
RECEIPT = HERE / ('request-free.json' if FREE else 'request.json')
assert not OUT.exists() and not RECEIPT.exists(), 'Candidate already exists; stop.'

with Image.open(SOURCE) as image:
    alpha = image.getchannel('A')
    px = alpha.load()
    bits = ''.join(str(px[x, y] & 1) for x in range(image.width) for y in range(image.height))
assert bytes(int(bits[i:i+8], 2) for i in range(0, 120, 8)) == b'stealth_pngcomp'
length = int(bits[120:152], 2)
source_metadata = json.loads(gzip.decompress(bytes(
    int(bits[i:i+8], 2) for i in range(152, 152 + length, 8))).decode('utf-8'))
if isinstance(source_metadata.get('Comment'), str):
    source_metadata['Comment'] = json.loads(source_metadata['Comment'])
(HERE / 'source-metadata.json').write_text(json.dumps(source_metadata, ensure_ascii=False, indent=2), encoding='utf-8')

prompt = style.build_asset_prompt(
    '1girl, solo, upper body, full face, eye level, wide shot, off-center, '
    'emerging from the right frame, looking at viewer, 1.5::head tilt::, smiling, fang',
    composition_layer=(
        'A girl leans into the foreground from the right edge, showing part of her upper body. '
        'Her face is fully visible. The empty wet asphalt highway extends toward the central '
        'horizon, guard rails, flat snowy fields, distant utility poles, winter, overcast cold dawn.'),
    light_material_layer=(
        'Blue theme, muted colors, soft ambient twilight, diffused cinematic lighting, '
        'puddles and reflections on the wet road, cold atmospheric haze, glowing particles.'))
character = (
    'silver-white long hair, high ponytail, blue ribbon bow at ponytail base, parted bangs, '
    'both cyan-blue eyes visible, pale skin, confident smile, small fang, '
    'black round goggles on head, black rose on her left temple, '
    'black charcoal off-shoulder long-sleeved short dress, layered ruffles at neckline and cuffs, '
    'black tied waist, above-knee ruffled skirt, bare legs, black ankle boots, '
    'one black straight sword sheathed diagonally on her back, black shoulder strap, '
    'sword hilt above her right shoulder')
char_uc = ('long skirt, high-low skirt, long back hem, dress train, floor-length dress, '
           'blue star pattern, stockings, pantyhose, thighhighs, halo, hat, backpack, '
           'red hair, braid, hair over one eye, holding sword')
characters = [{'prompt': character, 'uc': char_uc, 'center': {'x': .9, 'y': .5}}]
uc = style.build_uc('multiple girls, duplicate character')
model = 'nai-diffusion-4-5-full'
seed = 1552649891
request = nai_gen.build_payload(prompt, uc, width=WIDTH, height=HEIGHT, seed=seed,
                                model=model, char_prompts=characters, use_coords=False)
record = {
    'status': 'prepared', 'recipe_version': style.RECIPE_VERSION,
    'request': request, 'output': str(OUT.relative_to(ROOT.parent)).replace('\\', '/'),
    'references': [
        {'path': str(SOURCE), 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
         'purpose': 'Extracted scene composition and original seed; no image upload.'},
        {'path': 'game/assets/portraits/full/wu.webp',
         'sha256': hashlib.sha256(PORTRAIT.read_bytes()).hexdigest(),
         'purpose': 'Visually checked identity; text description only; no image upload.'}],
    'method': 'nai_gen.generate_image with shared nai_guard; one requested candidate',
    'user_feedback': 'Awaiting review',
}

def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

save()
assert request['model'] == model
assert style.ARTIST_BLOCK in prompt
assert len(characters) == 1 and 'maki' not in prompt + character
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('ALL_PROXY')
assert proxy, 'Expected current verified proxy environment.'

def current_proxy_transport(payload_file, zip_file, token, channel):
    return nai_gen._requests_request(payload_file, zip_file, token, ['-x', proxy])

try:
    path, actual_seed = nai_gen.generate_image(
        prompt, uc, width=WIDTH, height=HEIGHT, seed=seed, out=OUT, model=model,
        char_prompts=characters, use_coords=False, transport=current_proxy_transport)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=actual_seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),
              bytes=Path(path).stat().st_size)
save()
print(json.dumps({'status': record['status'], 'output': str(OUT), 'sha256': record['sha256']}))
