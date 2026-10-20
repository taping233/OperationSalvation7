import sys, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc

CONCEPTS = [
('spring','A broken circular brass mechanism cradles a tiny spring of living turquoise water. The water curls upward and closes the missing segment of its ring, one luminous droplet suspended above it. Extreme close-up, the restored joint at center, diagonally tilted ring, charcoal teal background, fresh mint light and aged brass.'),
('magazine','A single oversized extended rifle magazine splits open like a mechanical seed pod, revealing two luminous cartridges. Low three-quarter macro view, black polymer ribs and copper feed lips, cartridges leaning in opposite directions. Muted slate background cut by one amber loading stripe, strong silhouette, no weapon catalog layout.'),
('snipe','Extreme close-up along the top of a precision rifle at the instant of firing. Rifle and gloved firing hand enter from lower left, barrel dramatically recedes toward a tiny distant hostile silhouette at upper right. A single white-hot straight tracer connects muzzle to target. Cropped gun stock, cold blue darkness, tiny orange muzzle flare, clear depth compression.'),
('guard','Close-up of two crossed armored forearms braced in front of a cropped torso. A blunt incoming strike meets the central crossing and breaks into a small crescent of pale gold light. Arms form a compact protective roof; no face or full body. Slate blue sleeves, warm ivory armor edges, quiet dark background, the contact point brightest.'),
('bitter-rain','Black rain falls upward from a cracked dark umbrella into a suspended acid-green cloud. Beneath the umbrella edge a single hooded hostile silhouette bends under the curse; green droplets cling like thorns to its shoulder. Off-center tilted umbrella occupies most of the image, bitter violet shadows, one sharp lime reflection, graphic supernatural storm.'),
('mind-control','A damaged faceless combat helmet seen in profile fills the right foreground. A cropped gloved hand at upper left pinches a luminous violet thread drawn from the helmet brow; the helmet turns toward the hand, its formerly red visor becoming pale violet. Thread bends in a deliberate taut curve, minimal black backdrop, psychological tension, no gore.'),
('flame-staff','A crooked black metal staff head shaped like an open furnace jaw holds a white-orange ember. Viewed from below at close range, staff shaft exits lower right. A single broad flame sweeps horizontally across the top like a clock hand beginning its cycle. Soot blue negative shapes, copper edges and restrained scarlet heat, no person.'),
('scale-armor','Close-up of a curved breastplate built from overlapping dark dragon scales. One reversed crimson scale at its heart springs outward as an incoming impact lands, throwing a red needle of reflected force back toward upper left. Armor fills the frame, cropped edges, impact on right-center, deep petrol blue and oxblood red, readable layered construction.'),
('astrolabe','A suspended double-sided mechanical astrolabe rotates diagonally in close-up. Its left semicircle is warm brass with a small blade-shaped pointer, its right semicircle is indigo glass containing a cold star. One thin tilted orbital ring joins the two halves; a bright spark crosses their central hinge. Two complementary light sources, dark quiet field, asymmetric elegant geometry.'),
('soul-contract','Two small faceless shadow effigies hang at different depths, joined through their chests by a taut luminous crimson thread. A white impact spark touches the larger foreground effigy and travels as a red pulse to the smaller background figure. The thread forms a sharp triangular route, pale wax seal at the nearest chest, ink blue backdrop, ominous restrained light, no writing or gore.'),
('stellar-divination','Top-down close-up of a gloved palm turning a small glass star above three blank floating dark cards. The star casts two identical luminous echoes into two cards while the third remains open beneath the palm. A diagonal fan of cards, cropped wrist, deep midnight blue, silver cyan starlight, subtle brass constellation arcs, no letters or numbers.'),
('chaos-deck','A deck of blank dark cards bursts through an impossible twisted golden ring. On one side blunt iron card edges enter; on the other side refined gold and jewel-colored edges emerge, their colored pips tumbling loose between cards. Corkscrew motion from lower left to upper right, central transformation is the focus, violet and burnt orange, no text or readable suits.'),
('mercy','Extreme close-up of a swordsman gloved hand checking a curved blade just before it touches the side of an opponent neck. Only cropped jaw, neck, hand and blade visible. A tiny intact pale flower is trapped in the narrow gap between edge and skin; blade stops without injury. Tense horizontal composition, steel blue and muted warm skin, one white petal focal point, no blood.')
]
data = (ROOT / 'game/src/cards/cards.data.js').read_text(encoding='utf-8')
cards = json.JSONDecoder().raw_decode(data.split('TABLETOP13: ',1)[1])[0]
evidence = Path(__file__).parent
outdir = ROOT.parent / '.tmp/nai/tt13-card-art-20261020'
outdir.mkdir(parents=True, exist_ok=True)
requests=[]
for card, (suffix, scene) in zip(cards, CONCEPTS):
    assert card['id'] == 'tt13-'+suffix
    prompt=build_asset_prompt(scene,purpose_layer='Single cinematic collectible card illustration, strong thumbnail readability, no border, no lettering.')
    uc=build_uc()
    out=outdir/(suffix+'.png')
    payload=build_payload(prompt,uc,model='nai-diffusion-4-5-full',char_prompts=[])
    requests.append(dict(card_id=card['id'],name=card['name'],type=card['type'],desc=card['desc'],concept=scene,payload=payload,output=str(out),status='prepared'))
record=evidence/'nai-requests.json'
def save(): record.write_text(json.dumps(requests,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if '--prepare' in sys.argv:
    save()
    print('Prepared',len(requests),'NAI 4.5 requests')
else:
    requests=json.loads(record.read_text(encoding='utf-8'))
    for r in requests:
        if r['status']=='generated': continue
        p=r['payload']; r['status']='sending';save()
        try:
            path,seed=generate_image(p['input'],p['parameters']['negative_prompt'],seed=p['parameters']['seed'],model=p['model'],out=r['output'],char_prompts=[])
        except BaseException as e:
            r.update(status='failed',error=str(e));save();raise
        r.update(status='generated',sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest());save()
        print('READY',r['card_id'],flush=True)
