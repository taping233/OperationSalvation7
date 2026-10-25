import sys, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style
out = ROOT / '.tmp/nai/white-plum-1024/nai.png'
prompt = style.build_asset_prompt(
    '1girl, solo, adult woman, turning away and looking back over her shoulder with a confident small fanged smile, three-quarter rear view, one hand relaxed near her waist, high ponytail sweeping toward the left',
    purpose_layer='Horizontal fantasy ability card illustration, white plum falling shadow, entering stealth, a fleeting decisive moment rather than a standing portrait.',
    composition_layer='Medium close shot from head to upper thighs. The woman occupies the right-center, her face near the upper middle. Her left silhouette dissolves into one broad dark ink-like shadow sweep. A few large white plum petals cross the lower left. Keep the face fully solid and readable. Background consists only of broad charcoal teal and pale grey abstract masses; no scenery.',
    light_material_layer='Cool pale rim light along silver hair, warm pale skin, dark matte cloth, small cobalt ribbon accent; strong grouped light and shadow, no particle storm.')
char = 'silver-white long high ponytail, swept-aside parted front hair, exposed forehead, eyebrows and both blue eyes visible, black round sunglasses pushed onto head, blue ribbon tied at ponytail root, black rose at her left temple, black charcoal off-shoulder long-sleeved short ruffled dress, black waist tie, all skirt hems above knees, bare thighs, black straight sword sheathed diagonally on back, black leather sword strap across torso, sword hilt behind right shoulder'
uc = style.build_uc('goggles, bangs covering forehead, blue star pattern, long skirt, dress train, extra swords, holding sword, full body, standing straight, scenery, dense particles')
chars = [{'prompt':char, 'uc':'', 'center':{'x':.6,'y':.5}}]
payload = nai_gen.build_payload(prompt, uc, seed=1745268301, char_prompts=chars)
record = dict(status='prepared', card_id='tt8-hero-assassin', request=payload, references=['game/assets/portraits/full/wu.webp (identity, not uploaded)', 'game/assets/cards/wu-void.webp (old asset reviewed, not uploaded)'], output=str(out))
receipt = Path(__file__).with_name('request.json')
def save(): receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, seed=1745268301, out=out, char_prompts=chars)
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
    print(path)
except BaseException as e:
    record.update(status='failed', error_type=type(e).__name__)
    save()
    raise
