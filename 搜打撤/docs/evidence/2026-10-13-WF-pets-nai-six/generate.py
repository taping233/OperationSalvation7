"""Generate one original companion concept through the guarded project NAI client."""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))

from nai_gen import ENDPOINT, MODEL, generate_image
from nai_style import RECIPE_VERSION, build_asset_prompt, build_uc

HERE = Path(__file__).absolute().parent
SOURCE = HERE / 'source'
SOURCE.mkdir(exist_ok=True)

PETS = {
    'dog': {
        'name': '汪汪狗',
        'subject': 'An original young expedition dog, sturdy and unmistakably canine, with a compact shepherd-like body, thick cream fur, broad charcoal patches across its back and one floppy ear, warm amber eyes, a dark nose and a gently open mouth. One ear stands upright while the other folds forward. A weathered burgundy trail scarf is tied loosely around its neck; a small brushed-brass compass tag hangs from a plain leather collar. One front paw is lifted as if volunteering to lead the party. Give the fur distinct soft clumps and the paws believable weight. Its expression is loyal, brave and a little mischievous.',
        'palette': 'Cream and graphite fur, burgundy cloth and muted brass; cool blue-gray light from upper left, warm reflected light on the muzzle. Painted fur strands, worn woven cloth and a few sharp metal glints.',
        'uc': 'wolf, fox, human, humanoid, armor, blue eyes, fangs, extra paws, duplicate tail, giant ears',
    },
    'falcon': {
        'name': '猎鹰宝宝',
        'subject': 'An original juvenile scout falcon with a proud compact raptor silhouette, both wings HALF FOLDED close to the body with every wing tip entirely visible, hooked slate beak, alert golden eyes and strong yellow talons. Its head and mantle are deep chestnut brown; the cream chest has fine dark flecks; the long tail has clear alternating bands. A lightweight indigo leather flight harness crosses the shoulders and carries one tiny sealed brass map tube, suggesting a trusted aerial messenger. Perch on a single narrow weathered branch stub in a calm three-quarter pose. Preserve the anatomy and feather groups of a real falcon while giving the face a curious, friendly character. Leave generous clear space above and beside both wings.',
        'palette': 'Chestnut, cream, muted indigo and aged brass; directional pale sky light, broad feather planes with selective fine barb details around the face and primaries.',
        'uc': 'owl, parrot, eagle crest, human, humanoid, extra wings, extra legs, disconnected talons, giant eyes, spread wings, cropped wings, wing tips outside frame',
    },
    'cat': {
        'name': '招财猫',
        'subject': 'An original lucky merchant cat, a living orange-and-ivory longhair rather than a ceramic figurine. It sits upright with a broad plume tail curling around its paws; one front paw is raised in a small inviting gesture and the other rests lightly on a single old copper coin. Amber eyes, short whiskers, a narrow white blaze and a confident half-smile give it a clever shopkeeper personality. A dark red braided collar holds a small patinated bronze bell and a tiny jade bead. Its coat has layered warm stripes, a soft cream chest ruff and believable feline proportions. The coin is a quiet accessory, never larger than the paw.',
        'palette': 'Burnt orange, ivory, red cord, copper and jade; warm side lighting, large plush fur masses with selected fine whiskers and subtle scratched metal.',
        'uc': 'ceramic statue, maneki-neko toy, human, humanoid, extra paws, extra tails, oversized coin, giant eyes',
    },
    'robot': {
        'name': '变形机器人',
        'subject': 'An original small transforming expedition robot with a compact friendly silhouette and plausible mechanical joints. Its ivory enamel torso is built from folding interlocking plates around a dark graphite chassis; warm amber eyes glow behind a single smoked-glass face panel. One arm waves with a five-segment mechanical hand while the other carries a folded multipurpose tool. Hinged panels on the shoulders and calves hint at a travel-cart transformation, but the figure is currently a complete standing robot. Worn brass pivots, tiny fasteners, scuffed paint and a modest triangular chest emblem give it working history. It feels capable and helpful rather than like a plastic toy.',
        'palette': 'Ivory enamel, gunmetal and weathered brass with restrained amber light; broad painted metal planes, chipped edges and precise details at joints and face.',
        'uc': 'human, humanoid skin, mech pilot, giant battle mech, weapon, extra arms, extra legs, plastic toy, glossy 3d render',
    },
    'fire': {
        'name': '火焰精灵',
        'subject': 'An original tiny magical fire sprite, a SINGLE BRIGHT FLAME SHAPED CREATURE with a flowing teardrop silhouette. Its body is entirely fire, with a rounded golden center and three curved orange-red tongues rising from the top like a windblown crown; two small side flickers and a tapered lower point are continuous with the same flame body. Two small amber eyes are visible within the golden center, giving it an impish friendly expression. There is no separate head, skin, hair, torso, egg, rock, coal or dark sphere. It hovers diagonally as if darting forward, trailing only three tiny sparks. Make the complete luminous creature comfortably fit inside the canvas with wide margins on every side. Rich painterly variation in the translucent heat and crisp broken outer flame edges.',
        'palette': 'Dominant luminous butter-yellow and bright orange, with restrained crimson at the outer tips and a few warm smoky accents. Keep the entire main body light and fiery, not black; layered painted flame planes and a clear silhouette.',
        'uc': 'human, humanoid, girl, boy, baby, child, person, human face, hair, skin, clothes, arms, hands, legs, egg, egg shell, coal, rock, black sphere, dark orb, candle, campfire, fire monster, many faces, separate floating heads, cropped flame, giant eyes',
    },
    'penguin': {
        'name': '小企鹅咕嘎',
        'subject': 'An original young expedition penguin with a round but anatomically believable body, slate-black back, bright ivory belly, pale facial crescents, short ochre beak and wide webbed feet. It strides forward with one flipper lifted in greeting and the other holding a tiny canvas supply pouch; its mustard wool scarf whips gently behind. A small blue-gray crystal is stitched into the pouch clasp, hinting at the extra safe storage it brings to the party. Warm brown eyes and a determined open-beak chirp make it cheerful without turning it into a plush toy. Show the full tail, both flippers and both feet.',
        'palette': 'Slate black, ivory, mustard cloth and one cool blue crystal; crisp cool light, broad feather sheen, woven scarf texture and scuffed pouch seams.',
        'uc': 'human, humanoid, duck, puffin, polar bear, extra flippers, extra feet, giant eyes, plush toy',
    },
}

parser = argparse.ArgumentParser()
parser.add_argument('pet', choices=PETS)
parser.add_argument('--variant', default='v1')
args = parser.parse_args()
pet = PETS[args.pet]
stem = args.pet if args.variant == 'v1' else f'{args.pet}-{args.variant}'
out = SOURCE / f'{stem}.png'
if out.exists():
    raise SystemExit(f'Existing image protected: {out}')

prompt = build_asset_prompt(
    pet['subject'],
    purpose_layer='Original high-quality painterly character concept for a fantasy card-game companion selection screen. Rich, memorable design with coherent anatomy, tactile materials and a readable silhouette at small display size.',
    composition_layer='A single complete character in a lively three-quarter view, centered in a square 1024 by 1024 canvas, occupying about 75 percent of the frame. Entire silhouette visible with clean margins. Plain matte warm-gray background with only a faint contact shadow, no landscape, frame, lettering or other characters.',
    light_material_layer=pet['palette'],
)
uc = build_uc(pet['uc'] + ', cropped body, complex background, typography, border')
request = {'id': args.pet, 'name': pet['name'], 'model': MODEL, 'recipe': RECIPE_VERSION,
           'width': 1024, 'height': 1024, 'steps': 28, 'prompt': prompt, 'uc': uc,
           'naiImageReferences': []}
(HERE / f'{stem}-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')

def traced_transport(payload_file, zip_file, token, channel):
    arguments = ['curl'] + channel + ['-sS', '--ssl-no-revoke', '--max-time', '240',
        '-H', 'Authorization: Bearer ' + token, '-H', 'Content-Type: application/json',
        '-w', '%{http_code}', '-o', str(zip_file), '--data-binary', '@' + str(payload_file), ENDPOINT]
    result = subprocess.run(arguments, shell=False, capture_output=True, text=True)
    diagnostic = result.stderr.replace(token, '[REDACTED]').strip()
    print(json.dumps({'channel': channel[0], 'curlExitCode': result.returncode,
        'curlError': diagnostic[-500:]}, ensure_ascii=False), flush=True)
    return result.stdout.strip()

path, seed = generate_image(prompt, uc, width=1024, height=1024, out=out,
                            transport=traced_transport)
request.update({'seed': seed, 'source': str(Path(path).relative_to(ROOT)),
                'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'bytes': out.stat().st_size})
(HERE / f'{stem}-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'pet': args.pet, 'seed': seed, 'sha256': request['sha256'], 'bytes': request['bytes']}, ensure_ascii=False))
