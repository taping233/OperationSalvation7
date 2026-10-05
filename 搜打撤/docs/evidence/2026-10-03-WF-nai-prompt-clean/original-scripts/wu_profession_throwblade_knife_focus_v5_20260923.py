# -*- coding: utf-8 -*-
"""Wu Flying Blade sample v5: large foreground throwing knife composition."""
import json, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
PREV=ROOT/'output'/'wu-profession-throwblade-solidcolor-v4-20260923-185854'/'wu-throwblade.payload.json'
OUT=ROOT/'output'/('wu-profession-throwblade-knife-focus-v5-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
with PREV.open(encoding='utf-8') as f:
    payload=json.load(f)
SUBJECT=(
    '1girl, solo, Wu, original fantasy heroine. A dramatic illustration for the martial card Flying Blade Sneak Attack. '
    'Composition inspired by a bold close-up blade portrait: Wu’s black-gloved right hand thrusts toward the lens from the lower center, '
    '1.4::gripping exactly one short steel throwing knife very close to the camera::; the broad sharp blade stretches horizontally across the center toward image right, fully visible and occupying nearly half the image width. '
    'The knife is the dominant foreground object. A very fine crimson cut-trail starts at its tip. '
    'Wu’s face appears directly behind and above the knife on the image-left, large and completely unobstructed, with both eyes looking at the viewer. '
    'Her expression is a playful self-assured asymmetric grin with a single tiny fang. '
    'Small round youthful pale face, soft cheek blush, large vivid cyan-blue eyes with slightly upturned outer corners, fine lashes, delicate nose, separated silver-white bangs that reveal both eyes. '
    'Sleek silver-white hair in one tight high ponytail streaming to image right, with two long face-framing sidelocks. '
    'Two matte black round sunglass lenses rest on the image-left side of the top of her head, above the bangs and away from the eyes. '
    'One black rose is fixed to the image-right side of the ponytail root immediately beside a cobalt-blue satin bow. '
    'Black off-shoulder gothic dress with one horizontal ruffled neckline and a slim waist belt. The black outer skirt is entirely plain matte charcoal with no stars. '
    'Only a narrow dark-indigo inner hem peeks from beneath the black skirt at the bottom of the image; small pale-blue four-point stars are flat printed decoration on that blue inner hem only, never luminous. '
    'A small sheathed black sword hilt peeks over one shoulder as a secondary identity detail; no exposed second blade. '
    'Thigh-up dynamic crop, her torso twisting behind the extended arm, ponytail and ruffles sweeping in the opposite direction. '
    'Dry matte painted-sketch rendering like the approved character-select portrait: opaque blue-gray and charcoal brush planes in fabric, crisp dry edges, light warm skin planes without gloss, '
    'small controlled highlights on the eyes, sunglasses and steel knife, graceful brushwork following the hair. Keep the face and knife clean and precise.'
)
SCENE=(
    'Horizontal game-card art designed for a 1.32:1 crop. Three clear depth planes: giant throwing knife and hand in foreground, Wu’s readable face behind it, ponytail and skirt further back. '
    'One uniform solid pale gray-lavender background, flat edge to edge. No enemy, no scenery, no floor, no gradient, no background texture or wash. '
    'Keep the entire knife, face and fixed hair ornaments inside the central safe crop. No card frame, title, letters or UI.'
)
prompt=nai_style.build_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'tiny knife, distant knife, blade behind character, sword held in hand, second exposed blade, extra daggers, multiple knives, '
    'narrow eyes, mature face, long face, sharp jaw, hair covering eyes, sunglasses over eyes, rose on glasses, rose on forehead, '
    'stars on black dress, stars on outer skirt, stars on bodice, glowing stars, floating stars, star particles, light emitted by fabric, '
    'glossy black dress, shiny fabric, greasy highlights, glossy skin, waxy face, wet-look paint, smooth digital gradients, '
    'pantyhose, tights, thighhighs, stockings, enemy, extra characters, extra arms, extra faces, white background, gradient background, '
    'scenery, floor, textured background, card frame, UI'
)
seed=978283436
payload['input']=prompt
payload['parameters']['negative_prompt']=uc
payload['parameters']['seed']=seed
payload['parameters']['v4_prompt']['caption']['base_caption']=prompt
payload['parameters']['v4_negative_prompt']['caption']['base_caption']=uc
pj=OUT/'wu-throwblade.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
TOKEN=''
with (ROOT/'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line=line.strip()
        if line and not line.startswith('#'):
            TOKEN=line
            break
if not TOKEN:
    sys.exit('TOKEN_EMPTY')
zp=OUT/'wu-throwblade.zip'
r=subprocess.run([
    'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
    '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
    '-H','Content-Type: application/json','--data-binary','@'+str(pj),
    'https://image.novelai.net/ai/generate-image'
],capture_output=True,text=True,timeout=220)
code=(r.stdout or '').strip()[-3:]
if code=='403': sys.exit('STOP_HTTP_403')
if code=='429': sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
if code not in ('200','201'):
    sys.exit('HTTP_ERROR_'+(code or 'NO_CODE')+' '+(r.stderr or '')[-400:])
png=OUT/('wu-throwblade_'+str(seed)+'.png')
with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'card':'飞刃偷袭','id':'tt7-throwblade','seed':seed,'size':[1216,832],'prompt':prompt,'uc':uc,'png':png.name},f,ensure_ascii=False,indent=2)
print('IMAGE_READY',str(png),'SEED',seed,flush=True)
