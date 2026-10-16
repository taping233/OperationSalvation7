"""Single approved-scene trial; changes only the painting paragraph, never defaults."""
import copy
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_style import STYLE_BLOCK

BASE = PROJECT / 'docs/evidence/2026-10-16-nai-default-wide/approved.request.json'
NEW_STYLE = (
    'Organize the image as a fully finished commercial illustration. '
    'Build hair from continuous, substantial locks with broad connected light and shadow masses. '
    'Shape clothing through a few major tension folds and coherent shadow planes. '
    'Concentrate precise detail on the eyes, fingers, accessories and key structural turns; '
    'keep the remaining areas in clear, quiet color masses. '
    'Brushwork follows the form and material, with complete contours and clearly resolved overlaps. '
    'Use delicate skin transitions and distinct surface responses for matte black fabric, metal, glass and ceramic. '
    'Let the specified scene lighting determine the colors. Keep the focal features crisp and carefully resolved, '
    'with complete background spatial structure and restrained background detail.'
)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    approved = json.loads(BASE.read_text(encoding='utf-8'))['request']
    old_style = STYLE_BLOCK.split('painterly anime illustration. ', 1)[1]
    assert approved['input'].count(old_style) == 1
    prompt = approved['input'].replace(old_style, NEW_STYLE)
    p = approved['parameters']
    kwargs = dict(prompt=prompt, uc=p['negative_prompt'], width=p['width'], height=p['height'],
                  seed=p['seed'], model=approved['model'], char_prompts=p['characterPrompts'],
                  use_coords=p['use_coords'])
    candidate = build_payload(**kwargs)
    expected = copy.deepcopy(approved)
    expected['input'] = prompt
    expected['parameters']['v4_prompt']['caption']['base_caption'] = prompt
    assert candidate == expected, 'Unexpected payload change outside painting paragraph'
    defaults = {str(f.relative_to(PROJECT)): sha(f) for f in
                (PROJECT / 'tools/nai_style.py', PROJECT / 'tools/nai_gen.py')}
    out = PROJECT.parent / '.tmp/nai/wu-dinner-v5-style-trial-a-20261016.png'
    assert not out.exists(), 'Refuse to overwrite prior generation'
    record = dict(status='prepared', request=candidate, output=str(out),
                  baseline=str(BASE.relative_to(PROJECT)), old_style=old_style, new_style=NEW_STYLE,
                  only_changed_fields=['input', 'parameters.v4_prompt.caption.base_caption'],
                  defaults_sha256_before=defaults)
    record_file = HERE / 'request.json'
    assert not record_file.exists(), 'Refuse to overwrite trial record'
    record_file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Verified: only painting paragraph changed; seed=3058649506; one image.', flush=True)
    generate_image(**kwargs, out=str(out))
    record.update(status='generated', sha256=sha(out), defaults_unchanged=all(
        sha(PROJECT / f) == digest for f, digest in defaults.items()))
    record_file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    assert record['defaults_unchanged']
    print('Recorded image hash; shared defaults unchanged.', flush=True)

if __name__ == '__main__':
    main()
