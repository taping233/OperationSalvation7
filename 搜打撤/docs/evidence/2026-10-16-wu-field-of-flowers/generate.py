import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

# Explicit style experiment: do not append the project's default artist/style recipe.
nai_gen.DEFAULTS.update(steps=28, scale=7.0, cfg_rescale=0.0,
                        sampler='k_euler_ancestral', noise_schedule='karras',
                        variety_plus=False)
prompt = '''1girl, solo, three-quarter view, cowboy shot, standing among blue flowers at night, looking at viewer, confident smile, one hand resting lightly on her waist. Her long silver ponytail flows to the side in a gentle breeze. Quiet starry sky, softly glowing blue petals and a few drifting lights; the face remains clearly illuminated.

An illustration with clean but slightly textured linework with some mistakes being more sketch like, painterly rendering, with hair and organic forms treated as cohesive painted masses rather than collections of outlined strands. Strong silhouettes with minimal contouring, forms defined primarily by color masses, tonal separation, reflected light, and soft-to-hard edge variation. Hair consists of broad flowing locks with irregular painted highlights and shadow masses, with only a few selective strand accents. No dense strand linework, no uniform black outlines, no rigid cel-shading. Use lost-and-found edges, where some contours are crisp and others dissolve naturally into surrounding forms. Organic surfaces should be similarly rendered through volume, color, and brushwork rather than internal outlines. medium complexity on only the hair, ultra complexity for the rest of the image.

very aesthetic, masterpiece, no text'''
character = '''adult woman, pale skin, cyan blue eyes, silver white long hair, high ponytail, blue satin ribbon bow at ponytail base, parted bangs, both eyes visible, small fang, black round sunglasses resting on top of head, black rose beside her left temple, black grey off shoulder long sleeved dress, layered ruffled neckline and cuffs, black waist tie, short irregular layered ruffled skirt, bare thighs, a straight black longsword fully sheathed and strapped diagonally across her back, black wrapped sword hilt visible above her right shoulder'''
uc = 'lowres, aliasing, bad anatomy, bad hands, extra fingers, extra arms, text, watermark, signature, witch hat, wizard hat, holding sword, unsheathed sword, star patterned skirt lining, stockings, hair over one eye, multiple girls'
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
output = PROJECT.parent / '.tmp/nai/wu-field-of-flowers-20261016/wu-field-of-flowers.png'
receipt = Path(__file__).with_name('request.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=1344, height=768,
                               seed=1792340444, model='nai-diffusion-5-full',
                               char_prompts=characters)
record = dict(status='prepared', source='https://novelai.net/explore/image/30a9cedf-68d2-4730-b0d2-e5041b28c396',
              purpose='Wu preview using Field of flowers painting method; not integrated',
              identity_reference='game/assets/portraits/full/wu.webp (inspected locally, not uploaded)',
              parameter_note='Original published steps/CFG/seed/sampler reused; landscape dimensions chosen for this preview; Karras/rescale/variety inherited explicitly from current client, not claimed as original metadata.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=1344, height=768,
                                     seed=1792340444, model='nai-diffusion-5-full',
                                     char_prompts=characters, out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
