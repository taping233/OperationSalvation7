# -*- coding: utf-8 -*-
"""Two temporary Wu profession-card previews in the approved V5 painterly style."""
import json
import subprocess
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

ROOT = Path(r'D:\素材\代号柒\.tmp\nai')
SOURCE = ROOT / 'output' / 'wu-profession-throwblade-knife-focus-v5-20260923-190747' / 'wu-throwblade.payload.json'
KIND = sys.argv[1]
OPTIONS = {
    'goldencicada': {
        'card': '金蝉脱壳', 'id': 'tt7-goldencicada',
        'action': (
            'An aerial escape snapshot for the martial card Golden Cicada Escape. '
            '1.4::Wu is airborne, vaulting up and over the struck straw decoy::; her left gloved palm pushes off its shoulder, one knee tucks toward her waist, the other long leg extends behind her. '
            'Her body forms a clear sweeping arc from lower-left to upper-right, with a long silver ponytail and black skirt following the arc. '
            'A single enemy sword enters from the lower-left foreground and pierces the faceless straw-and-dark-cloth dummy below her; a few coarse straw fibers burst from the wound. '
            'The decoy is clearly a stuffed mannequin, not a second girl. The attack missed Wu by a fraction of a second. '
            'Wu twists her upper body to look back over one shoulder; show her refined face, both focused blue eyes and restrained sly half-smile. '
            'Draw her entire graceful long-limbed figure including both boots, naturally small head and slim waist. '
            'Distinct visual hierarchy: airborne Wu first, pierced decoy second, approaching sword third.'
        ),
        'scene': (
            'Horizontal game-card art for a 1.32:1 crop. Slightly elevated three-quarter camera; compressed near-far perspective from foreground sword to straw dummy below and airborne Wu above. '
            'Place the dummy at lower center-left and Wu across the central upper-right, with body and legs forming a dynamic arc rather than a standing pose. '
            'Keep her complete face, fixed head ornaments, both boots and decoy impact point inside the central safe crop. '
            'Uniform flat desaturated sage-green background edge to edge, no environment, floor, gradient, vignette, texture, smoke, lettering or card frame.'
        ),
        'extra_uc': 'standing pose, walking pose, sidestep, static portrait, hand on hip, second girl, human duplicate, ghost copy, realistic injured person, blood, straw hair on Wu, face hidden by dummy, cluttered debris,',
    },
    'ghostblade': {
        'card': '鬼魅之刃', 'id': 'tt7-ghostblade',
        'action': (
            'The instant a stealthy fighter lands a sword thrust for the martial card Ghostly Blade. '
            '1.4::Wu is in a deep ground-level fencing lunge::, right knee bent very low, left leg stretched fully back, one boot braced on the ground. '
            'Her torso leans forward with athletic control, right gloved hand driving her one standard one-handed black sword straight toward image right. Fix the sword dimensions consistently: blade from guard to point is exactly one and a half of her own head heights, grip equals one palm, and total sword length is exactly two head heights; keep the complete sword visible, with the sword occupying only the space between her hand and the target. '
            'The single blade runs nearly horizontal across the foreground and stops exactly at contact with a small round metal buckler held at right-center by a cropped opponent arm; its point touches the buckler face and does not pass through. Metal edge chips and a few dry impact strokes show the hit. No blade or weapon extends from behind or beyond the buckler. Only Wu owns a sword; the opponent holds only the small round buckler and no weapon. '
            'Her free left arm sweeps behind for balance. Her long silver ponytail whips upward and backward; the layered black skirt opens to reveal only the blue star-printed inner hem. '
            'A three-quarter side view shows her refined face in profile with one blue eye looking fiercely at the contact point and a restrained confident smile. '
            'Show her entire long-limbed figure, clearly bent front leg and straight rear leg, with natural adult anatomy. '
            'One action line from rear boot through shoulders, sword hand and shield impact; this is a committed physical strike.'
        ),
        'scene': (
            'Horizontal game-card art for a 1.32:1 crop. Low side-on camera near the ground; a long horizontal silhouette formed by the stretched back leg, low torso, outstretched sword and small shield. '
            'Keep her complete face, fixed head ornaments, both boots, entire sword and shield impact point inside the central safe crop. '
            'Uniform flat muted dusty-mauve background edge to edge, no environment, floor details, gradient, vignette, texture, fog, lettering or card frame.'
        ),
        'extra_uc': 'standing pose, jumping pose, floating pose, static portrait, sword held across body, hand on hip, throwing knife, multiple swords, sword on back, oversized greatsword, extra enemy sword, blade extending beyond shield, blade passing through shield, blade extending behind buckler, enemy sword, long straight line behind target, huge enemy, full enemy person, black smoke, fog cloud, magic aura, glowing slash, face hidden by blade,',
    },
    'sneak': {
        'card': '偷袭', 'id': 'tt7-sneak',
        'action': ('A split-second backstab for the martial card Sneak. Wu slips from behind a distracted armored guard, low and close, one gloved hand guiding a short dagger into a visible gap in the guard\'s shoulder armor. The guard is only a cropped foreground silhouette, twisting too late as one crisp impact spark marks the hit. Wu\'s face is visible over the guard\'s shoulder, focused and calm; her other hand keeps the guard\'s sword arm away. One unmistakable attack, no blood. Strong near-far staging: guard in foreground, Wu behind, dagger and impact at center.'),
        'scene': ('Horizontal 1.32:1 card crop, tight over-the-shoulder three-quarter camera at waist height. Put the blurred guard shoulder in lower-left foreground, Wu\'s face and dagger at center-right, impact point clear and large enough to read at thumbnail size. Flat uniform deep teal background, no room, no floor, no gradient, no text, no frame.'),
        'extra_uc': 'frontal duel, facing enemy, sword thrust, long sword, multiple attackers, blood, wound, gore, face covered, unclear hand, static portrait,',
    },
    'thundergrudge': {
        'card': '快意恩仇', 'id': 'tt7-thundergrudge',
        'action': ('Wu swings her single black sword in a stylish full-body turn for the martial card Thunderous Vengeance. Her hips and shoulders rotate sharply, one boot pivots on the ground and her ponytail whips in the opposite direction. The sword cuts one enormous clean blue-white crescent across the frame; two thinner afterimage arcs trail behind it to suggest a rapid three-strike combo. The leading arc crashes into one enemy shield at the edge of the image with a burst of bright sparks. Wu keeps a fierce confident expression and her face stays unobstructed. One figure, one physical sword, clear sweeping motion.'),
        'scene': ('Dynamic low-angle three-quarter camera, wide enough to show Wu from head to boots and the full curved sword trail. Wu occupies the center-left, the luminous crescent sweeps diagonally toward one shield on the right. Keep the three arc bands distinct and the impact point visible at thumbnail size. Flat uniform muted rust-red background, no scenery, no floor details, no gradient, no text, no frame.'),
        'extra_uc': 'multiple characters, duplicate Wu, extra limbs, multiple swords, tiny sword trail, one straight horizontal slash, blood, gore, static standing pose, hand on hip,',
    },
    'meteorrain': {
        'card': '流星箭雨', 'id': 'tt7-meteorrain',
        'action': ('A panoramic battlefield shot for the martial card Meteor Arrow Rain. Far across the scene, Wu is a small but unmistakable figure with silver high ponytail, planted feet and torso in profile, drawing a compact bow to full draw. A dense mass of dozens of arrows arcs high above her and rains steeply downward across the right half of the image, arrowheads clearly pointing down. In the foreground, armored shields are struck by many visible arrow impacts. The distant archer, high curved volley and dense descending arrow field form one clear left-to-right story.'),
        'scene': ('Ultra-wide panoramic game-card composition from an elevated battlefield camera. Keep Wu at the far-left third, small but readable as a bow-drawing silhouette; fill the upper-right and foreground with a dense diagonal rain of arrows descending onto a few shields. Strong large-scale composition readable as a thumbnail. Flat uniform muted indigo background, no detailed landscape, no buildings, no gradient, no text, no frame.'),
        'extra_uc': 'arrows flying upward, arrows covering Wu, tiny unreadable bow, multiple Wu, bow held backwards, impossible bowstring, blood, clutter,',
    },
    'stealth': {
        'card': '潜匿', 'id': 'tt7-stealth',
        'action': ('Wu hides completely behind a gigantic wooden supply crate for the martial card Stealth. The crate blocks nearly all of her body. Only her recognizable head and a small section of one shoulder peek above the crate near its upper-right corner; her face looks cautiously toward a passing guard. No arms, hands, waist or legs are visible. The guard is a small cropped silhouette at far left, walking away without seeing her. Simple readable hiding action, no weapon, no attack, no smoke.'),
        'scene': ('Horizontal card art, wide simple composition. One huge rectangular wooden crate spans almost the entire frame width and fills the lower four-fifths of the image. Wu stays behind it; only her head and a little shoulder peek above its upper-right edge. A small guard silhouette walks away at the far left. The crate must clearly occlude Wu below the shoulders. Flat uniform cool slate-blue background, no room, no floor, no gradient, no text, no frame.'),
        'extra_uc': 'standing portrait, attack, sword strike, visible second Wu, ghost duplicate, black smoke, fog, magic aura, glowing silhouette, clutter,',
    },
    'swordimmortal': {
        'card': '剑仙形态', 'id': 'tt7-swordimmortal',
        'action': ('Wu awakens her sword-immortal form in a decisive transformation moment. In a tall grounded stance, she raises her single black sword vertically before her face; a clean circular arc of blue-white sword energy closes around her and the blade, while her free hand opens and the hem and ponytail lift in the updraft. Her expression turns serene and commanding, both blue eyes clear. The sword remains one solid physical blade; the energy arc frames her rather than becoming extra weapons. Strong visual read of a powered-up stance, not an ordinary attack.'),
        'scene': ('Horizontal 1.32:1 card art, low-angle medium-full shot looking slightly upward. Center Wu and the vertical sword; frame her silhouette with one simple blue-white circular energy arc, leaving open space around the head ornaments and boots. Flat uniform deep midnight-blue background, no scenery, no floor, no gradient, no text, no frame.'),
        'extra_uc': 'attack lunge, enemy, multiple swords, floating weapons, duplicate character, huge magic explosion, lightning clutter, glowing stars on dress, static hand-on-hip portrait,',
    },
}
if KIND not in OPTIONS:
    sys.exit('Choose one of: goldencicada, ghostblade, sneak, thundergrudge, meteorrain, stealth, swordimmortal')
item = OPTIONS[KIND]

with SOURCE.open(encoding='utf-8') as f:
    payload = json.load(f)

identity = (
    '1girl, solo, Wu, original fantasy heroine. '
    'Young adult woman matching the approved Wu character-select portrait, slim and long-limbed, natural 7.5-head fashion-illustration proportions, '
    'head around one seventh of the full visible figure height, shoulders about two head widths, long legs, narrow waist. '
    'Refined narrow oval pale face with defined cheek planes and a tapered chin, subtle cheek blush, medium-sized sharp cyan-blue eyes with slightly upturned outer corners, fine lashes, delicate nose, '
    'separated silver-white bangs revealing both eyes, a poised asymmetric half-smile with one subtle upper canine. '
    'Sleek silver-white hair in one tight high ponytail, two long face-framing sidelocks. '
    'Two matte black round sunglass lenses rest on the image-left side of the top of her head above the bangs, never over her eyes. '
    'One black rose is fixed on the image-right side of the ponytail root immediately next to a cobalt-blue satin bow. '
    'Black off-shoulder gothic dress, horizontal ruffled neckline, fitted waist, black outer skirt entirely plain matte charcoal without stars. '
    'Only the dark-indigo inner skirt hem underneath bears small flat pale-blue printed four-point stars; stars do not glow. '
    'Black gloves, bare legs, black boots. '
)
identity = identity.replace('Black gloves, bare legs, black boots. ', 'Black gloves. ') if KIND == 'stealth' else identity
finish = (
    'Dry matte painted-sketch rendering matching the approved character-select portrait: opaque blue-gray and charcoal brush planes on the fabric, '
    'broad confident strokes, crisp dry broken edges, a few precise small highlights on eyes, sunglasses and steel. '
    'Warm simple skin planes, lively deliberate brush marks, no slick oil-paint sheen or plastic finish. Keep the face, gesture and action object precise.'
)
prompt = nai_style.build_prompt(identity + item['action'] + finish, item['scene'])
uc = nai_style.build_uc(
    item['extra_uc'] +
    'child, kid, childish face, toddler, babyface, chibi, super-deformed, huge head, oversized eyes, round doll face, short legs, squat body, '
    'middle-aged face, elderly face, square jaw, blurry eyes, hair over eyes, sunglasses over eyes, '
    'rose on glasses, rose on forehead, two roses, loose low ponytail, '
    'stars on black dress, stars on outer skirt, stars on bodice, glowing stars, floating stars, star particles, glowing fabric, '
    'glossy black dress, shiny fabric, greasy highlights, glossy skin, waxy face, wet-look paint, smooth digital gradients, '
    'pantyhose, tights, thighhighs, stockings, crowd, duplicate characters, extra arms, extra faces, '
    'white background, gradient background, scenery, floor, textured background, card frame, UI, text'
)
seed = 978283436
payload['input'] = prompt
payload['parameters']['negative_prompt'] = uc
payload['parameters']['seed'] = seed
payload['parameters']['v4_prompt']['caption']['base_caption'] = prompt
payload['parameters']['v4_negative_prompt']['caption']['base_caption'] = uc

out = ROOT / 'output' / ('wu-profession-' + KIND + '-v3-action-' + time.strftime('%Y%m%d-%H%M%S'))
out.mkdir(parents=True, exist_ok=True)
pj = out / (KIND + '.payload.json')
with pj.open('w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)

token = ''
with (ROOT / 'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line
            break
if not token:
    sys.exit('TOKEN_EMPTY')

zp = out / (KIND + '.zip')
r = subprocess.run([
    'curl', '--noproxy', '*', '--ssl-no-revoke', '--max-time', '180', '-sS', '-w', '%{http_code}',
    '-o', str(zp), '-X', 'POST', '-H', 'Authorization: Bearer ' + token,
    '-H', 'Content-Type: application/json', '--data-binary', '@' + str(pj),
    'https://image.novelai.net/ai/generate-image'
], capture_output=True, text=True, timeout=220)
code = (r.stdout or '').strip()[-3:]
if code == '403':
    sys.exit('STOP_HTTP_403')
if code == '429':
    sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
if code not in ('200', '201'):
    sys.exit('HTTP_ERROR_' + (code or 'NO_CODE') + ' ' + (r.stderr or '')[-400:])

png = out / (KIND + '_' + str(seed) + '.png')
with zipfile.ZipFile(zp) as zf:
    png.write_bytes(zf.read(zf.namelist()[0]))
with (out / 'manifest.json').open('w', encoding='utf-8') as f:
    json.dump({'card': item['card'], 'id': item['id'], 'seed': seed, 'size': [1216, 832], 'prompt': prompt, 'uc': uc, 'png': png.name}, f, ensure_ascii=False, indent=2)
print('IMAGE_READY', str(png), 'SEED', seed, flush=True)
