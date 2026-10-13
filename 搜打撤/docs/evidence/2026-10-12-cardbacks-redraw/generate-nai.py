"""Seven authorized card-back drafts; use the shared NAI client and pacing."""
import contextlib
import hashlib
import io
import json
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PROJECT = ROOT / '搜打撤'
EVIDENCE = Path(__file__).resolve().parent
OUTPUT = ROOT / '.tmp/nai/output/cardbacks-redraw-20261012'
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, MODEL
from nai_style import build_prompt, build_uc, RECIPE_VERSION

DESIGNS = [
    ('classic', '行囊粗布', '缝隙里的远行之门',
     'An impossible travel portal sewn into a weathered ochre canvas. Two broad folded cloth wings curl around a dark diamond-shaped opening; inside it a tiny turquoise four-point compass-star shines. A thick teal cord loops once through the opening and becomes a road. Four large asymmetrical fabric patches and sparse broad stitches make a bold woven talisman. Sand, warm umber and concentrated turquoise.'),
    ('wolf', '猎手皮纸', '月亮与鹿角弓',
     'A crescent moon held between two branching antlers that form a hunting bow, one crimson arrow vertically bisecting the moon. The antlers and torn parchment shapes create a fierce eye-shaped negative space, suggesting a watchful hunter without showing a literal wolf head. Ivory moon, smoky blue-grey shadows, burnt ochre parchment and one vermilion arrow. Sparse bold angular marks around the central emblem.'),
    ('coin', '富商锦缎', '锦鲤绕钱眼',
     'Two plump golden koi with broad ribbon-like tails orbit a square black coin-hole. Their tails blend into extravagant flowing crimson silk bands, an impossible circular brocade knot suggesting abundance and fortunate trade. One small jade bead inside the dark square opening. Large sweeping connected crimson and muted gold shapes, selective rich vermilion and jade accents, no dense fish scales or tiny woven patterns.'),
    ('vault', '仓廪木纹', '年轮里长出麦穗',
     'A monumental wooden growth-ring spiral with a dark seed-shaped keyhole at its center. Two broad golden wheat heads grow directly from the wood rings, their curved stems following the spiral and suggesting a self-replenishing granary. Green malachite bands are embedded into the wood like rivers. Warm honey wood, deep walnut, sage green and concentrated harvest gold. Bold organic architectural pattern rather than a literal wooden door.'),
    ('boss', '弑神黑曜', '断冠与黑曜裂隙',
     'A shattered ivory divine crown falls into a vertical obsidian diamond-shaped void. A single crimson fissure runs through the black diamond; two enormous broken halo arcs frame it like severed wings. Crown fragments are large and few, suspended in impossible heraldic balance. Near-black plum obsidian, chalk bone ivory, deep oxblood and one intense red slash. Intimidating negative space, monumental ceremonial emblem, no skull or humanoid figure.'),
    ('altar', '核心星轨', '折叠的天体仪',
     'An impossible folded celestial instrument: three broad indigo and antique-gold orbital ribbons pass through a cyan crystalline core, crossing in front and behind with clear overlaps. A black eclipsed sun occupies the core, cyan light leaking along one edge. Four large pale stars anchor the corners. Midnight violet, muted antique gold, blue-grey and concentrated electric cyan. Surreal star-map emblem with bold sweeping curves, not a realistic mechanical diagram.'),
    ('pet', '忠犬爪印', '项圈围住爪印星座',
     'A warm ivory four-toed paw constellation nested inside a broad looped blue dog collar. The collar twists once into a protective heart-shaped negative space; two large tawny ear-like ribbons curl around its sides like guardians. Five glowing cream islands form one readable paw, not many scattered stars. Deep moss green, warm tan, navy collar and tiny orange-coral accents. Affectionate magical keepsake emblem, no dog portrait or literal leather texture.'),
]

PURPOSE = ('A single original fantasy playing-card BACK artwork, vertical 2:3 flat front-on rectangular design filling the entire canvas. '
           'One large symbolic silhouette, generous quiet zones, loose balanced surrounding pattern that belongs to the motif. '
           'Large connected opaque paint masses and wide directional strokes, simplified forms readable at thumbnail size. '
           'The artwork itself extends to all four edges. No card mockup, no table, no perspective, no letters, no logos, no UI. '
           'Avoid an ornamental thin gold rectangular picture frame; any edge motif is broad and integral to this design.')

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    request = {'workflow': 'NAI draft then built-in ImageGen repaint, replace seven existing card backs',
               'nai_model': MODEL, 'nai_recipe_version': RECIPE_VERSION, 'nai_size': [768, 1152],
               'items': [{'id': key, 'name': name, 'concept': concept,
                          'asset': 'card-backs/' + key + '.webp',
                          'nai_prompt': build_prompt(subject, PURPOSE),
                          'nai_negative_prompt': build_uc('people, human, character portrait, intricate filigree, tiny patterns, card mockup, perspective, tabletop, 3d render'),
                          'nai_source': str(OUTPUT / (key + '.png'))}
                         for key, name, concept, subject in DESIGNS]}
    request_path = EVIDENCE / 'request.json'
    resume = '--resume' in sys.argv[1:]
    if request_path.exists() and not resume:
        raise SystemExit('Request exists; do not overwrite an existing run.')
    if resume:
        request = json.loads(request_path.read_text(encoding='utf-8'))
    else:
        request_path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
    receipt_path = EVIDENCE / 'nai-receipt.json'
    receipts = json.loads(receipt_path.read_text(encoding='utf-8')) if resume and receipt_path.exists() else []
    completed = {row['id'] for row in receipts if row['status'] == 'generated'}
    for item in request['items']:
        target = Path(item['nai_source'])
        if item['id'] in completed:
            if not target.is_file():
                raise SystemExit('Recorded draft is missing: ' + item['id'])
            continue
        if target.exists():
            raise SystemExit('Draft already exists: ' + item['id'])
        announced = False
        while True:
            rate = json.loads((ROOT / '.tmp/nai/request-rate.json').read_text(encoding='utf-8'))
            remaining = rate['cooldown_until'] - time.time()
            if remaining <= 0:
                break
            if not announced:
                print('WAIT_SHARED_COOLDOWN ' + str(round(remaining)) + ' seconds', flush=True)
                announced = True
            time.sleep(min(45, remaining))
        row = {'id': item['id'], 'started_at': datetime.now().astimezone().isoformat()}
        log = io.StringIO()
        print('REQUEST ' + item['id'], flush=True)
        try:
            with contextlib.redirect_stdout(log):
                generated, seed = generate_image(item['nai_prompt'], item['nai_negative_prompt'],
                                                width=768, height=1152, out=target, model=MODEL)
            row.update(status='generated', path=generated, seed=seed, bytes=target.stat().st_size,
                       sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        except (SystemExit, Exception) as error:
            row.update(status='failed', error=str(error))
        row.update(request_log=log.getvalue(), finished_at=datetime.now().astimezone().isoformat())
        receipts.append(row)
        receipt_path.write_text(json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
        print(item['id'] + ' ' + row['status'] + ' ' + log.getvalue().splitlines()[0] if log.getvalue() else item['id'] + ' ' + row['status'], flush=True)
        if row['status'] != 'generated':
            print(row['error'], flush=True)
            raise SystemExit(1)

if __name__ == '__main__':
    main()
