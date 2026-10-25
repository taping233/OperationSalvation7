import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
from nai_prompt_clean import build_asset_prompt, build_uc
from nai_style import RECIPE_VERSION

OUT = ROOT.parent / '.tmp/nai/event-option-art-1025/v4'
OUT.mkdir(parents=True, exist_ok=True)
jobs = [
    ('coins', 'Exactly three thick worn coins sliding into an open small field satchel, one clear grouped silhouette. The three circular coin rims and the open satchel mouth are immediately recognizable.', 'muted brass gold accents on coin rims, desaturated blue-gray leather satchel'),
    ('breach', 'One short mining pick striking a cracked structural beam, a clear single fracture with three falling masonry fragments below it, one clear grouped silhouette. The pick, unstable beam and falling debris communicate dangerous excavation.', 'cold blue-gray metal and masonry, restrained pale warm-red accent only inside the fracture'),
]
receipt = Path(__file__).with_name('nai-v4-requests.json')
records = []
for index, (key, subject, colors) in enumerate(jobs):
    prompt = build_asset_prompt('no humans, ' + subject,
        purpose_layer='One isolated readable game choice emblem, conceptual 2D painted icon, not a landscape, not a full scene, no words or numbers.',
        composition_layer='One centered compact object group in the middle half of the canvas, front three-quarter view, large coherent shapes and clean silhouette on plain charcoal background. No border, no circle badge, no lettering.',
        light_material_layer=colors + '. Matte layered pigment, restrained highlights, selective crisp edges, no glow or ornate details, quiet broad color planes.')
    uc = build_uc('letters, numbers, landscape, scenery, people, hands, complex background, ornate frame, neon, many repeated coins, many tools')
    params = dict(width=1344, height=768, seed=1382502410+index, char_prompts=[])
    record = dict(key=key, status='prepared', recipe_version=RECIPE_VERSION,
                  payload=nai_gen.build_payload(prompt, uc, **params))
    records.append(record)
    def save():
        receipt.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        path, seed = nai_gen.generate_image(prompt, uc, out=OUT / (key+'-draft.png'), **params)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', output=str(path), seed=seed,
                  sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
