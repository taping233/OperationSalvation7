import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/xingyue-piano-reset-1024'
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, playing an old upright piano, seated at the keyboard, quiet focused expression, both hands resting naturally on different piano keys, looking down at the keyboard',
    purpose_layer='Wide game title-screen wallpaper, a quiet intimate musical moment in a roofless abandoned wooden hall at sunset.',
    composition_layer='Landscape composition, low three-quarter view from the left end of the keyboard. The old wooden piano occupies the left foreground, its keyboard recedes diagonally toward the woman seated on the right half. Her face, both wrists and both hands are visible. Only one continuous keyboard with orderly black and white keys. A broken roof opens onto luminous clouds above. Keep the outer edges quiet enough for a game menu overlay, no actual interface.',
    light_material_layer='Warm late-afternoon sunlight grazes her pale blonde braid and face, cool muted teal shadows inside the timber hall. Weathered brown wood, cream cloth and deep teal cape, golden rim light, atmospheric depth, restrained dust motes, softly glowing sky, high complexity')
character = 'adult woman, pale blonde very long hair in a single thick low braid, straight bangs, gold eyes, calm expression, white crescent moon hairpin clipped flat just above the bangs slightly to the viewers right, white priestess dress with gold edging, dark teal short shoulder cape with gold trim, natural bare hands'
uc = style.build_uc('child, loli, extra person, split screen, multiple pianos, organ, floating hair ornament, halo, lantern, gloves, extra keyboard, bent piano keys, detached hands, extra fingers, monochrome')
chars = [{'prompt':character, 'uc':'', 'center':{'x':0.69,'y':0.61}}]
payload = nai_gen.build_payload(prompt, uc, model='nai-diffusion-5-full', char_prompts=chars, use_coords=True)
receipt = {'status':'prepared', 'recipe_version':style.RECIPE_VERSION, 'request':payload,
           'references':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'role':r,'uploaded_to_nai':False} for p,r in [
               ('game/assets/reconstruction/wallpaper-xingyue-piano-1020.webp','theme and composition'),
               ('game/assets/portraits/full/xingyue.webp','current character identity')]],
           'output':str(OUT/'nai5-draft.png')}
record = Path(__file__).with_name('nai-request.json')
def save():
    record.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    result,seed=nai_gen.generate_image(prompt, uc, model='nai-diffusion-5-full',
        seed=payload['parameters']['seed'], char_prompts=chars, use_coords=True, out=OUT/'nai5-draft.png')
except BaseException as error:
    receipt.update(status='failed',error_type=type(error).__name__)
    save()
    raise
receipt.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
save()
