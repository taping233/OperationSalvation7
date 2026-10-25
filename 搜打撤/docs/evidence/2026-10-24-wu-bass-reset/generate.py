import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/wu-bass-reset-1024'
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, lying on her back on a soft living room rug, playing a four-string electric bass guitar resting across her torso, knees loosely bent, head near the lower right foreground, playful relaxed smile, looking toward the viewer',
    purpose_layer='Wide game homepage wallpaper, a comfortable intimate late-night home music practice moment.',
    composition_layer='Wide low camera close to the rug. Her body extends diagonally from her head at the lower right toward her bent legs at the upper left. Her silver ponytail fans over the rug beside her head. One black electric bass with a cream pickguard lies across her torso, its long neck points diagonally toward the lower left foreground. Include the entire bass headstock and all four tuning pegs inside the frame. Her LEFT hand wraps naturally around the neck and presses strings just behind frets, her RIGHT index and middle fingertips pluck strings above the body pickups. Both hands are visible. Only four strings from four bridge saddles along the neck to four tuning pegs. A dark sofa, a softly lit desk, plants and a small bass amplifier sit in the background. A blue nighttime city skyline is visible through the large window. Artwork only, no actual interface.',
    light_material_layer='Warm amber desk lamp on the left and cool cobalt blue city window light behind the sofa. Muted charcoal upholstery, lavender pajama trousers, wool sweater, silver-white hair with coherent clean flowing locks, pale warm skin, black lacquer bass body and brushed metal frets, cozy chromatic shadows, controlled detail, high complexity')
character = 'adult woman, silver-white very long high ponytail tied with a blue satin bow, swept-aside parted front hair, visibly exposed forehead, both blue eyes and eyebrows readable, small black rose at her left temple, black round sunglasses resting on top of her head, relaxed confident smile with a tiny fang, loose black long sleeved sweater, lavender striped pajama trousers, white socks, natural bare hands'
uc = style.build_uc('child, loli, extra person, thick bangs, covered forehead, goggles, sword, armor, standing, guitar with six strings, six tuning pegs, extra instrument, floating instrument, detached hands, extra fingers, missing bass headstock, text on paper, sheet music notation')
chars = [{'prompt':character, 'uc':'goggles, thick bangs, hair over eyes', 'center':{'x':0.67,'y':0.66}}]
payload = nai_gen.build_payload(prompt, uc, model='nai-diffusion-5-full', char_prompts=chars, use_coords=True)
receipt = {'status':'prepared', 'recipe_version':style.RECIPE_VERSION, 'request':payload,
    'references':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'role':r,'uploaded_to_nai':False} for p,r in [
        ('game/assets/reconstruction/wallpaper-wu-bass-1020.webp','theme and lying composition'),
        ('game/assets/portraits/full/wu.webp','current character identity only')]],
    'output':str(OUT/'nai5-draft.png')}
record = Path(__file__).with_name('nai-request.json')
def save():
    record.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf8')
save()
try:
    result,seed=nai_gen.generate_image(prompt, uc, model='nai-diffusion-5-full',
        seed=payload['parameters']['seed'], char_prompts=chars, use_coords=True, out=OUT/'nai5-draft.png')
except BaseException as error:
    receipt.update(status='failed',error_type=type(error).__name__)
    save()
    raise
receipt.update(status='generated',seed=seed,sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
save()
