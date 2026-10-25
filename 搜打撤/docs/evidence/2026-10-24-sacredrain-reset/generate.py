import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/sacredrain-reset-1024'
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, sacred invocation, singing softly, composed majestic expression, looking slightly down toward the viewer, one open hand reaching toward the camera, other hand lifted near her sternum',
    purpose_layer='Premium legendary ability card illustration, a monumental blessing carried by wind, strong iconic silhouette.',
    composition_layer='Extreme low three-quarter camera, close medium shot cropped at upper thighs. Woman dominates center-right, foreground open palm enlarged on lower left with natural foreshortening. Long braid and deep teal cape sweep toward upper right. A huge luminous curved current rises from the lower left foreground, wraps behind her, and opens toward the upper left like a vast breaking wave. Keep her face and hands unobstructed. Dark negative space above left, asymmetrical grand composition, only one character.',
    light_material_layer='Deep midnight teal and blue-black backdrop, one immense warm ivory-gold opening behind her silhouette, pale turquoise wind and sparse golden falling light. Strong chiaroscuro, narrow gold rim along cape and hair, gold eyes and face remain focal. Broad sculptural cloth folds and large luminous shapes, a few geometric flecks, high complexity, no buildings.')
character = 'adult woman, pale blonde very long hair in one thick low braid, neat straight bangs, golden eyes, quiet detached expression, white crescent moon hairpin clipped flat just above bangs slightly to viewers right, tilted against hair, white high-neck priestess dress with gold edging, deep teal short shoulder cape with gold trim, dark wrist cuffs, natural bare hands'
uc = style.build_uc('child, loli, extra person, split screen, lantern, floating hair ornament, circular head halo, crown, wings, angry face, evil grin, purple eyes, sword, microphone, musical instrument, dense particle field, cluttered background, printed playing cards')
chars = [{'prompt': character, 'uc': '', 'center': {'x': .61, 'y': .52}}]
payload = nai_gen.build_payload(prompt, uc, model='nai-diffusion-5-full', char_prompts=chars, use_coords=True)
record = Path(__file__).with_name('nai-request.json')
assert not record.exists() and not (OUT / 'nai5-draft.png').exists(), 'Use a new candidate path'
receipt = {'status': 'prepared', 'recipe_version': style.RECIPE_VERSION,
           'request': payload, 'output': str(OUT / 'nai5-draft.png'),
           'references': [{'path': p, 'sha256': hashlib.sha256((ROOT / p).read_bytes()).hexdigest(),
                           'role': role, 'uploaded_to_nai': False}
                          for p, role in [('game/assets/cards/hero-sacredrain.webp', 'existing card theme only; composition reset'),
                                          ('game/assets/portraits/full/xingyue.webp', 'current light priest identity'),
                                          ('docs/character-bible/xingyue.md', 'current identity description')]]}
def save():
    record.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    result, seed = nai_gen.generate_image(prompt, uc, model='nai-diffusion-5-full',
        seed=payload['parameters']['seed'], char_prompts=chars, use_coords=True,
        out=OUT / 'nai5-draft.png')
except BaseException as error:
    receipt.update(status='failed', error_type=type(error).__name__)
    save()
    raise
receipt.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
save()
print(str(result))
