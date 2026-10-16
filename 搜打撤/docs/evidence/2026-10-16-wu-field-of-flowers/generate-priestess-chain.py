import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

# Reuse the published Priestess recipe, replacing identity and clothing only.
nai_gen.DEFAULTS.update(steps=28, scale=4.0, cfg_rescale=0.0,
                        sampler='k_euler_ancestral', noise_schedule='karras',
                        variety_plus=False)
prompt = '''1 girl, adult woman, silver_hair, cyan blue eyes, high ponytail, blue satin ribbon bow at ponytail base, parted bangs, both eyes visible, confident smile, small fang, black round sunglasses on top of head, black rose hair ornament above her left temple near the sunglasses, black grey off shoulder long sleeved dress, layered ruffled neckline and cuffs, black waist tie, a black straight longsword fully sheathed and strapped diagonally across her back, black wrapped sword hilt visible above her right shoulder,
0.7::artist (far side)::,artist (nhim),0.7::artist (ask (askzy))::,
电影打光,上半身,正视角,凝视镜头,单手撩起头发,歪头,高细节度的头发,
very aesthetic, masterpiece, no text'''
uc = ',鼻孔,闭眼,lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, bad feet, deformed iris, deformed pupils, mutated hands, poorly drawn hands, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck,\n'
output = PROJECT.parent / '.tmp/nai/wu-priestess-chain-20261016/wu-priestess-chain.png'
receipt = Path(__file__).with_name('request-priestess-chain.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=832, height=1216,
                               seed=1787339500, model='nai-diffusion-5-full',
                               char_prompts=[])
# These settings are explicit in the published image metadata.
def published_payload(original, *args, **kwargs):
    result = original(*args, **kwargs)
    result['parameters']['straight_alpha'] = True
    result['parameters']['quality_boost'] = False
    return result
original_build = nai_gen.build_payload
nai_gen.build_payload = lambda *args, **kwargs: published_payload(original_build, *args, **kwargs)
request = nai_gen.build_payload(prompt, uc, width=832, height=1216,
                               seed=1787339500, model='nai-diffusion-5-full',
                               char_prompts=[])
record = dict(status='prepared',
              source='https://aitag.win/i/149992177',
              purpose='Wu identity with published Priestess artist chain and sampling; no added painterly style block. Preview only.',
              identity_reference='game/assets/portraits/full/wu.webp (inspected locally in this conversation, not uploaded)',
              parameter_note='Published V5 hash 0ADF9AB7 cannot be selected through current model ID; current V5 Full used. Exact original chain, UC, dimensions, seed, steps, CFG, rescale and sampler/noise retained. Client presets remain none, with source quality tail written explicitly.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
                                     seed=1787339500, model='nai-diffusion-5-full',
                                     char_prompts=[], out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
