import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_style

nai_gen.DEFAULTS.update(steps=28, scale=5.5, cfg_rescale=0.0,
                        sampler='k_euler_ancestral', noise_schedule='karras', variety_plus=False)
prompt = '''1girl, solo, adult woman, silver hair, cyan eyes, black off-shoulder dress, sitting, eating, smile, open mouth, fang, looking at food.
Wide waist-up view, slightly low camera. Her complete head and hands fit inside the canvas. Her left hand holds a small white bowl of rice at chest height. Her right hand holds chopsticks pinching one piece of braised meat before her mouth. Small soup bowl and food plate at lower left. Black sheathed sword rests against the rear wall. Modern apartment kitchen, warm pendant lamp, cool night window light.
'''+nai_style.ARTIST_BLOCK+'''
arknights, game promotional illustration, painterly anime illustration. Complete clean silhouettes, carefully resolved face and hands. Broad opaque color planes, grouped shadows, angular cloth folds, subtle brush texture. Hair consists of broad flowing locks with irregular painted highlights and shadow masses. Fine linework is selective around eyes and fingers. Delicate skin transitions, matte black cloth, small ceramic highlights. Use lost-and-found edges, with crisp focal edges and softer turning edges. Rich controlled color, quieter background detail.
very aesthetic, masterpiece, no text'''
character = 'adult woman, fair skin, cyan eyes, silver long hair, high ponytail, blue satin bow at ponytail base, parted bangs, both eyes visible, small fang, black round sunglasses on head, black rose above her left temple, black off-shoulder long-sleeved dress, layered ruffled neckline and cuffs, black waist sash, bare shoulders and collarbones'
uc = 'lowres, worst quality, bad quality, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, duplicate bowl, oversized bowl, sunglasses covering eyes, goggles, hair covering eyes, high collar, holding sword, sword on table, text, watermark, signature, multiple girls, cropped head, overexposure, excessive bloom, plastic skin'
characters = [{'prompt': character, 'uc': '', 'center': {'x': .68, 'y': .5}}]
model, seed = 'nai-diffusion-4-5-full', 3058649506
output = PROJECT.parent / '.tmp/nai/wu-style-step1-20261016/wu-v31-dinner45-compact.png'
receipt = Path(__file__).with_name('dinner45-compact-request.json')
if output.exists() or receipt.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=2048, height=1152, seed=seed,
                               model=model, char_prompts=characters)
record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION,
              source='docs/evidence/2026-10-16-nai-default-wide/approved.request.json',
              purpose='Original rice/chopsticks/braised-meat dinner scene adapted to V4.5 with shorter wording and identity anchors first. Preserve four-artist chain and v3.1 painting principles; shared defaults unchanged. Preview only.',
              identity_reference='game/assets/portraits/full/wu.webp (already inspected, not uploaded)',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, _ = nai_gen.generate_image(prompt, uc, width=2048, height=1152, seed=seed,
                                    model=model, char_prompts=characters, out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
