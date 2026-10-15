"""Single explicit Scheme B candidate; never modifies the default style."""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen

baseline = json.loads((HERE / 'request-v19.json').read_text(encoding='utf-8'))
style_file = ROOT / 'tools/nai_style.py'
style_sha = hashlib.sha256(style_file.read_bytes()).hexdigest()
parts = baseline['prompt'].split('\n\n')
parts[0] = '1.1::miv4t::, 0.2::quasarcake::'
parts[1] = ('anime illustration, clean game character sprite, fine colored clean contours, '
            'smooth cel shading, flat soft shading planes, expressive hair strands, '
            'flowing fabric contours, detailed clothing structures, clear anime eyes, '
            'subtle facial shading, matte materials. Cool neutral midtones, restrained '
            'overall saturation, selective vivid accents, clean sharp edge detail, '
            'no rough brush strokes. no text.')
prompt = '\n\n'.join(parts)
uc = baseline['uc'] + ', rough brush strokes, scribble, messy linework, jagged outlines, painterly sketch texture'
assert nai_gen.DEFAULTS == baseline['parameters'], 'Sampling parameters changed; stop.'
out = ROOT.parent / '.tmp/nai/wu-half-20261015/wu-half-scheme-b.png'
assert not out.exists(), 'Candidate already exists; do not overwrite or regenerate.'
record = {key: baseline[key] for key in ('model', 'seed', 'width', 'height', 'parameters', 'identity_source', 'references_uploaded')}
record.update(recipe_version='scheme-b-candidate', artist_chain=parts[0], prompt=prompt, uc=uc,
              output=str(out), default_style_sha256=style_sha, default_style_modified=False, status='prepared')
receipt = HERE / 'request-b.json'
receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print('Scheme B prepared; sampling and seed match v1.9; default style untouched.', flush=True)
if '--generate' in sys.argv:
    path, seed = nai_gen.generate_image(prompt, uc, width=record['width'], height=record['height'],
                                      seed=record['seed'], model=record['model'], out=out)
    assert hashlib.sha256(style_file.read_bytes()).hexdigest() == style_sha, 'Default style changed during generation.'
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
