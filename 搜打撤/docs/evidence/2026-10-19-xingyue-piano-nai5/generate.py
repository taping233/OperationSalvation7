import hashlib
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

source = Path(r'C:/Users/太平/Downloads/f1028251bddd6238348e1b8979fa1847236908.png')
data = source.read_bytes()
offset = 8
metadata = None
while offset + 12 <= len(data):
    size = struct.unpack('>I', data[offset:offset + 4])[0]
    kind = data[offset + 4:offset + 8]
    chunk = data[offset + 8:offset + 8 + size]
    offset += size + 12
    if kind == b'iTXt':
        key, rest = chunk.split(b'\0', 1)
        flag = rest[0]
        language, translated, value = rest[2:].split(b'\0', 2)
        if key == b'Comment':
            metadata = json.loads((zlib.decompress(value) if flag else value).decode('utf-8'))
assert metadata is not None
scene = metadata['prompt'].split('playing an old upright piano', 1)[1]
prompt = style.build_asset_prompt('1girl, solo, playing an old upright piano' + scene)
character = (
    'adult woman, pale blonde long hair, straight bangs, long sidelocks, a long thick braid tied low behind her head, golden eyes, calm reserved expression, '
    "a white crescent moon hairpin clipped flat into the hair just above the bangs, slightly off-center to the viewer's right, tilted and resting against the hair, "
    'a newly designed ivory sleeveless high-neck blouse, a loose cool-gray cropped jacket draped off the shoulders with pale cyan-blue lining, '
    'simple charcoal cuffs, dark brown fitted leather gloves, a few small brushed-silver clasps, ivory skirt, subtle practical layered tailoring')
characters = [{'prompt': character, 'uc': '', 'center': {'x': 0.4, 'y': 0.5}}]
# Preserve the original UC and supported sampler configuration for this request.
nai_gen.DEFAULTS.update(steps=metadata['steps'], scale=metadata['scale'],
    sampler=metadata['sampler'], noise_schedule=metadata['noise_schedule'],
    cfg_rescale=metadata['cfg_rescale'], variety_plus=False)
width, height = 1536, 1024
seed = metadata['seed']
output = ROOT.parent / '.tmp/nai/xingyue-piano-20261019/candidate.png'
receipt = Path(__file__).with_name('request.json')
assert not output.exists() and not receipt.exists()
request = nai_gen.build_payload(prompt, metadata['uc'], width=width, height=height,
    seed=seed, model='nai-diffusion-5-full', char_prompts=characters)
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=request,
    original_metadata=metadata, output=str(output),
    references=[dict(path=str(source), sha256=hashlib.sha256(data).hexdigest(), uploaded=False),
        dict(path='game/assets/portraits/full/xingyue.webp',
             sha256=hashlib.sha256((ROOT / 'game/assets/portraits/full/xingyue.webp').read_bytes()).hexdigest(), uploaded=False)],
    changes=dict(identity='Current Xingyue; no Perlica identity or animal ears',
        costume='New tailoring, reference ivory/cool-gray/pale-cyan palette and brown gloves; no uniform emblems or hat',
        style='Current project artist chain, style and quality; original scene prose retained',
        dimensions='Original 1516x1037 adjusted to 1536x1024 for 64-pixel compatibility',
        unused='strength=0.7 and noise=0 are not applied to text-to-image; no image input or reference upload'),
    scope='One candidate only; no runtime asset replacement')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, metadata['uc'], width=width, height=height,
        seed=seed, out=output, model='nai-diffusion-5-full', char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=actual_seed,
    sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
