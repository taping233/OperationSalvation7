# -*- coding: utf-8 -*-
"""Wu Flying Blade sample v4: accepted portrait face, patterned inner hem only, dry matte finish."""
import json, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
PREV=ROOT/'output'/'wu-profession-throwblade-solidcolor-v2-20260923-183535'/'wu-throwblade.payload.json'
OUT=ROOT/'output'/('wu-profession-throwblade-solidcolor-v4-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
with PREV.open(encoding='utf-8') as f:
    payload=json.load(f)
SUBJECT=(
    '1girl, solo focus, Wu, original fantasy heroine. The same youthful face and recognizable design as her character-select portrait: '
    'small round pale face, soft cheek blush, large bright cyan-blue eyes with slightly upturned outer corners, both eyes fully visible below separated silver-white bangs, '
    'fine dark lashes, delicate little nose, teasing open smile with one clearly visible tiny fang. Her face is prominent, about a quarter of the card height, and looks toward the viewer. '
    'Sleek silver-white hair is pulled into one tight high ponytail that streams to the image right, with two long sidelocks framing her cheeks. '
    'Two matte black round sunglass lenses sit on the image-left side of the top of her head, above the bangs and away from her eyes. '
    'One black rose sits on the image-right side of the ponytail root immediately next to a cobalt-blue satin bow, both clearly visible. '
    'Black off-shoulder gothic dress with one ruffled neckline and a slim waist belt. '
    'The entire outer skirt is plain matte charcoal-black fabric with no pattern or stars anywhere on it. '
    'Under the black outer skirt is a separate dark indigo inner layer; only its lower scalloped hem peeks out in a narrow band, '
    'and small pale-blue four-point stars are printed ONLY on that indigo hem as flat matte fabric decoration. '
    'Bare legs, black gloves, black ankle boots. A long black sword remains in its sheath across her back. '
    'For the Flying Blade Sneak Attack, she twists sharply around an enemy guard and flicks exactly one short steel throwing blade from her right hand. '
    'The blade flies downward-right toward the enemy’s exposed shoulder, leaving one fine crimson cut line. '
    'Camera views the action over the enemy’s shoulder: only his dark armored shoulder and forearm occupy the lower-right foreground, with no second face. '
    'Wu fills the left and center of the frame; her face remains unobstructed, her flared skirt and blue inner hem remain readable. '
    'A strong diagonal movement connects her hand, the flying blade and the armored shoulder. '
    'Use the dry matte painted-sketch finish of the approved portrait: opaque desaturated gray and blue-gray brush planes, crisp dry edges in the black fabric, soft warm skin planes without shine. '
    'The dress is matte cloth, with visible folds and restrained value changes. Reserve tiny highlights for eyes, sunglasses and the steel blade; avoid slick reflections on skin, hair or fabric.'
)
SCENE=(
    'Horizontal 1.32:1 game-card illustration; keep the face, hair ornaments, skirt hem, flying blade and enemy shoulder inside the central crop-safe area. '
    'The background is one perfectly uniform solid pale gray-lavender color from edge to edge. Neutral cool daylight, no orange bounce light. No white, no gradient, no scenery, no floor, no pattern or background brush wash. '
    'No card border, title, lettering or UI.'
)
prompt=nai_style.build_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'narrow eyes, small eyes, mature face, long face, sharp jaw, closed mouth, missing fang, hair covering eyes, sunglasses over eyes, '
    'rose on glasses, rose on forehead, rose on image-left side, stars on black fabric, stars on outer skirt, stars on bodice, '
    'glowing stars, luminous stars, floating stars, star particles, sparkles, light emitted by dress, '
    'pantyhose, tights, thighhighs, stockings, extra characters, extra faces, duplicate girl, '
    'extra throwing blades, multiple daggers, fireball, white background, gradient background, scenery, floor, textured background, card frame, UI, '
    'glossy black dress, shiny fabric, greasy highlights, glossy skin, waxy face, wet-look paint, smooth digital gradients, orange glow'
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
