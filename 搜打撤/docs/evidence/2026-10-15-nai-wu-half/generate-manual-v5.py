"""V5 with separate base and character captions; no shared default edits."""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen

baseline = json.loads((HERE / 'request-manual.json').read_text(encoding='utf-8'))
parts = baseline['prompt'].split('\n\n')
artist = parts[0]
hair_style, tail = parts[3].rsplit('limited palette', 1)
character = 'girl, ' + parts[2].replace(' Her arms rest at her sides.', '') + ' ' + hair_style.strip()
prompt = (artist + '\n\nsolo, waist-up character portrait, white background, looking at viewer, '
          'head and hair accessories fully inside the frame, crop at waist. Her arms rest at her sides.'
          '\n\nlimited palette' + tail)
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
model = 'nai-diffusion-5-full'
assert nai_gen.DEFAULTS == baseline['parameters'], 'Sampling defaults changed; stop.'
out = ROOT.parent / '.tmp/nai/wu-half-20261015/wu-half-manual-v5-slots.png'
assert not out.exists(), 'Candidate already exists.'
style_path = ROOT / 'tools/nai_style.py'
style_sha = hashlib.sha256(style_path.read_bytes()).hexdigest()
payload = nai_gen.build_payload(prompt, baseline['uc'], width=832, height=1216,
                                seed=baseline['seed'], model=model, char_prompts=characters)
assert payload['model'] == model
assert payload['parameters']['v4_prompt']['caption']['base_caption'] == prompt
assert payload['parameters']['characterPrompts'][0]['prompt'] == character
record = dict(recipe_version='manual-v5-slots-candidate', prompt=prompt, uc=baseline['uc'],
              char_prompts=characters, use_coords=False, artist_chain=artist, model=model,
              seed=baseline['seed'], width=832, height=1216, parameters=nai_gen.DEFAULTS,
              output=str(out), references_uploaded=[], default_style_sha256=style_sha,
              default_style_modified=False, status='prepared',
              source_manual=baseline['source_manual'], identity_source=baseline['identity_source'])
receipt = HERE / 'request-manual-v5.json'
receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print('V5, separate character caption, unchanged seed/sampling verified.', flush=True)
if '--generate' in sys.argv:
    path, seed = nai_gen.generate_image(prompt, baseline['uc'], width=832, height=1216,
                                      seed=record['seed'], model=model, out=out, char_prompts=characters)
    assert hashlib.sha256(style_path.read_bytes()).hexdigest() == style_sha
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
