"""One authorized NovelAI draft; --cut only creates the transparent derivative."""
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, MODEL
from nai_prompt_clean import build_asset_prompt, build_uc, RECIPE_VERSION

OUT = PROJECT.parent / '.tmp/nai/output/wu-battle-right-transparent-20261003'
RAW = OUT / 'wu-battle-right-nai-v3-raw.png'
FINAL = OUT / 'wu-battle-right-transparent-nai-v3.png'
CHARACTER = (
    '1girl, young adult woman, pale skin, small youthful face, bright cyan-blue eyes, '
    'confident playful smile with one small fang, silver-white hair, neatly gathered very high ponytail, '
    'long ponytail reaching calf level, parted bangs, two long face-framing sidelocks, '
    'matte black round sunglasses resting on top of head, one black rose beside ponytail root, '
    'blue satin ribbon bow, black off-shoulder ruffled dress, narrow black belt, '
    'plain charcoal-black outer skirt ending near calves, deep-blue inner skirt hem with sparse light-blue stars, '
    'bare lower legs, black cuffed ankle boots, black gloves'
)
SUBJECT = (
    'Wu, one fantasy swordswoman in a grounded battle-ready idle stance, body and face turned toward screen-right, '
    'looking right, right foot forward, knees gently bent, left hand open near waist. '
    'Exactly ONE weapon in the entire image: one very long slender straight black longsword held in her right hand, '
    'low forward guard pointing diagonally toward the right edge. '
    '1.5::The exposed blade from crossguard to tip is almost as long as her head-to-boot body height::; '
    'clearly oversized blade LENGTH, narrow blade WIDTH, small simple crossguard. '
    'No sword, scabbard or weapon on her back.'
)
COMPOSITION = (
    'Wide horizontal 3:2 illustration. Entire character from ponytail top to both boot soles in the left third to left half. '
    'The long sword extends across the otherwise empty right half, its tip fully inside the image with generous margin. '
    'Full hair and skirt silhouette inside frame. '
    'Perfectly flat uniform saturated chroma-green background, RGB 0 255 0, edge to edge, '
    'no floor, no scenery, no background shadow, no gradient. Green only in the background.'
)
MATERIAL = (
    '1.35::Loose broad-brush painted concept sketch, large simple angular light and shadow masses, '
    'dry broken paint edges, simplified forms and low detail density::, '
    'hair grouped into five broad paint ribbons, dress built from a few broad dark folds and large ruffles, '
    'only a handful of simple stars on the blue inner hem, face drawn with a few clear marks. '
    'Matte fabric, subdued leather and dark steel. Minimal small highlights, no meticulous detail.'
)
PROMPT = build_asset_prompt(SUBJECT, purpose_layer='One complete full-body battle character cutout source.',
                            composition_layer=COMPOSITION, light_material_layer=MATERIAL)
UC = build_uc(
    'second sword, two swords, multiple weapons, sword on back, back-mounted sword, scabbard, '
    'short sword, dagger, broad sword, huge wide blade, tiny sword, cropped sword tip, '
    'left-facing pose, frontal fashion pose, hand on hip, cropped hair, cropped boots, '
    'highly detailed, intricate detail, fine hair strands, small fabric folds, ornate accessories, '
    'glossy fabric, shiny skin, photorealistic, 3d render, lens flare, lighting bloom, aura, '
    'green clothing, green hair, green eyes, background shadow, floor, scenery, gradient background, '
    'stockings, tights, sunglasses over eyes, extra character'
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
    pixels[:, :, 1][edge] = np.minimum(pixels[:, :, 1][edge],
                                     np.maximum(pixels[:, :, 0][edge], pixels[:, :, 2][edge]))
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
              'method': 'chroma-green matte to alpha, edge despill; original raw preserved', 'runtime_replacement': False}
    (HERE / 'image-validation-nai-v3.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    if '--cut' in sys.argv:
        cut()
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        if RAW.exists():
            raise SystemExit('Raw exists; do not request another image')
        request = {'channel': 'NovelAI', 'model': MODEL, 'recipe_version': RECIPE_VERSION,
                   'width': 1152, 'height': 768, 'prompt': PROMPT, 'uc': UC, 'char_prompt': CHARACTER,
                   'reference_note': 'text identity from approved Wu; current NAI client has no direct reference-image parameter',
                   'output': RAW.relative_to(PROJECT.parent).as_posix()}
        (HERE / 'wu-battle-nai-v3.request.json').write_text(json.dumps(request, indent=2) + '\n', encoding='utf-8')
        print('REQUEST_START pid={} cwd={} one_image=1152x768'.format(os.getpid(), PROJECT), flush=True)
        out, seed = generate_image(PROMPT, UC, char_prompt=CHARACTER, width=1152, height=768, out=str(RAW))
        request.update(seed=seed, raw_sha256=hashlib.sha256(RAW.read_bytes()).hexdigest())
        (HERE / 'wu-battle-nai-v3.request.json').write_text(json.dumps(request, indent=2) + '\n', encoding='utf-8')
