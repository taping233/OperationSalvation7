import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen

previous = json.loads(Path(__file__).with_name('request.json').read_text(encoding='utf-8'))
base = previous['request']
p = base['parameters']
nai_gen.DEFAULTS.update({k: p[k] for k in nai_gen.DEFAULTS})
scene = base['input'].split('\n\n')[0]
style = '''1.5::painterly anime illustration, painting (medium), visible brush strokes::, 1.3::opaque broad brushwork, edge variation::.
Paint the figure and flowers with layered opaque pigment, broad directional strokes and overlapping color planes. Build volume through grouped shadow masses, reflected color and short painted midtone transitions. Hair is made of substantial silver locks with broad grey-blue shadow planes and irregular brushed highlights. Paint the dark dress as matte charcoal fabric with broad fold planes and visible bristle marks, its edges described by neighboring colors rather than ink. Keep only a few fine marks at the eyes, mouth and fingers. Alternate sharp focal edges at the eyes, rose and selected folds with softer turning edges on cheeks, arms and hair; let a few shadow edges merge into the night. Show deliberate individual brush accents and overlapping paint at changes of plane. The skin has subtle warm-cool modelling, the cloth stays matte, and the flowers form loosely brushed masses. The face and hands remain carefully resolved, while the larger hair, clothing and background shapes carry the brushwork. medium complexity.
The black rose is a hair ornament attached high above her LEFT temple, on the viewer's RIGHT, immediately beside the sunglasses near the ponytail base. Keep the rose entirely above the outer eyebrow and clear of her cheek and ear.'''
prompt = scene + '\n\n' + style + '\n\nvery aesthetic, masterpiece, no text'
characters = base['parameters']['characterPrompts']
character = characters[0]['prompt'].replace(
    'black rose beside her left temple',
    'black rose hair ornament high above her left temple near the crown, above eyebrow level')
characters = [{'prompt': character, 'uc': '', 'center': characters[0]['center']}]
uc = p['negative_prompt'] + ', thick black outlines, uniform outlines, heavy lineart, inked contours, cel shading, flat shading, vector art, flat color, smooth airbrush, plastic rendering, cheek flower, flower earrings, rose on cheek, mosaic texture'
output = Path(previous['output']).with_name('wu-field-of-flowers-v2.png')
receipt = Path(__file__).with_name('request-v2.json')
if receipt.exists() or output.exists():
    raise SystemExit('Candidate or receipt already exists; do not overwrite.')
request = nai_gen.build_payload(prompt, uc, width=p['width'], height=p['height'],
                               seed=p['seed'], model=base['model'], char_prompts=characters)
record = dict(status='prepared', source=previous['source'],
              purpose='Second Wu preview: reduced outlines, layered brushwork and soft/hard edges; high temple rose. Not integrated.',
              previous_request='request.json', identity_reference=previous['identity_reference'],
              comparison='Same seed, model, dimensions and sampling; style and rose placement revised together at user request.',
              request=request, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=p['width'], height=p['height'],
                                     seed=p['seed'], model=base['model'],
                                     char_prompts=characters, out=output)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
