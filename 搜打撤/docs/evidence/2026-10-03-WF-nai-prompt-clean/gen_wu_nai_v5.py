"""Authorized concise Wu draft. Existing client/guard; one request, chroma derivative."""
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, MODEL
from nai_prompt_clean import ARTIST_BLOCK, STYLE_BLOCK, RECIPE_VERSION, build_uc

OUT = PROJECT.parent / '.tmp/nai/output/wu-battle-right-transparent-20261003'
RAW = OUT / 'wu-battle-right-nai-v5-raw.png'
FINAL = OUT / 'wu-battle-right-transparent-nai-v5.png'
IDENTITY = (
    '1girl, young adult swordswoman, fair skin, cyan-blue eyes, confident smile with a small fang, '
    'silver-white tight high ponytail, blue ribbon bow, black rose at ponytail base, '
    'matte black round sunglasses on head, parted bangs, two long sidelocks. '
    '1.3::charcoal-black off-shoulder ruffled dress, black bodice and black outer skirt::, '
    'calf-length hem, blue star-patterned inner lining, narrow black waist belt, '
    'black gloves, bare lower legs, black cuffed ankle boots.'
)
POSE = (
    'Full body, three-quarter side view facing screen-right, gaze to the right, '
    'balanced battle-ready stance with slightly bent knees. '
    'Right hand holds exactly one straight slender black longsword in a low forward guard. '
    'Blade length about half her head-to-boot height; small plain crossguard. Left hand relaxed near waist.'
)
COMPOSITION = (
    'Landscape 3:2, character on the left, sword pointing right. Entire hair, boots and blade visible with margins. '
    'Uniform flat chroma-green background, no scenery, ground or cast shadow. '
    'Simplify small hair strands, fabric folds and ornament details into clear larger shapes.'
)
# Keep the shared recipe once. Drop generic quality tags for this explicitly less-refined variant.
STYLE = STYLE_BLOCK.removeprefix('masterpiece, best quality, ') if hasattr(str, 'removeprefix') else STYLE_BLOCK.replace('masterpiece, best quality, ', '', 1)
PROMPT = '\n\n'.join((ARTIST_BLOCK, IDENTITY, POSE, COMPOSITION, STYLE))
UC = build_uc(
    'second sword, back-mounted weapon, scabbard, oversized sword, broad greatsword, dagger, '
    'cropped sword tip, cropped feet, white dress, stockings, sunglasses over eyes, '
    'intricate detail, fine hair strands, glossy fabric, photorealistic, 3d render, '
    'extra character, green clothing, green hair, gradient background, background shadow'
)


def cut():
    import numpy as np
    from PIL import Image
    image = Image.open(RAW).convert('RGBA')
    pixels = np.array(image)
    rgb = pixels[:, :, :3].astype(np.float32)
    excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    alpha = np.clip((70.0 - excess) / 50.0, 0.0, 1.0)
    pixels[:, :, 3] = np.minimum(pixels[:, :, 3], np.rint(alpha * 255)).astype(np.uint8)
    edge = (pixels[:, :, 3] > 0) & (pixels[:, :, 3] < 255)
    pixels[:, :, 1][edge] = np.minimum(pixels[:, :, 1][edge], np.maximum(pixels[:, :, 0][edge], pixels[:, :, 2][edge]))
    result = Image.fromarray(pixels, 'RGBA')
    if FINAL.exists():
        raise SystemExit('Output exists; preserve it')
    result.save(FINAL)
    a = result.getchannel('A')
    report = {'channel': 'NovelAI via existing nai_gen client', 'raw': RAW.relative_to(PROJECT.parent).as_posix(),
              'transparent_png': FINAL.relative_to(PROJECT.parent).as_posix(),
              'sha256': hashlib.sha256(FINAL.read_bytes()).hexdigest(), 'size': list(result.size),
              'mode': result.mode, 'alpha_extrema': list(a.getextrema()), 'transparent_pixels': a.histogram()[0],
              'foreground_bbox': a.getbbox(), 'bytes': FINAL.stat().st_size,
              'method': 'chroma-green matte to alpha, edge despill; raw preserved', 'runtime_replacement': False}
    (HERE / 'image-validation-nai-v5.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    if '--cut' in sys.argv:
        cut()
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        if RAW.exists():
            raise SystemExit('Raw exists; do not request another image')
        request = {'channel': 'NovelAI', 'model': MODEL, 'recipe_version': RECIPE_VERSION,
                   'width': 1152, 'height': 768, 'prompt': PROMPT, 'uc': UC, 'char_prompt': '',
                   'style_variant': 'shared style once, generic quality tags removed',
                   'reference_note': 'text identity from approved Wu; no direct image conditioning in current client',
                   'output': RAW.relative_to(PROJECT.parent).as_posix()}
        (HERE / 'wu-battle-nai-v5.request.json').write_text(json.dumps(request, indent=2) + '\n', encoding='utf-8')
        print('REQUEST_START pid={} one_image=1152x768'.format(os.getpid()), flush=True)
        out, seed = generate_image(PROMPT, UC, char_prompt='', width=1152, height=768, seed=1898224611, out=str(RAW))
        request.update(seed=seed, raw_sha256=hashlib.sha256(RAW.read_bytes()).hexdigest())
        (HERE / 'wu-battle-nai-v5.request.json').write_text(json.dumps(request, indent=2) + '\n', encoding='utf-8')
