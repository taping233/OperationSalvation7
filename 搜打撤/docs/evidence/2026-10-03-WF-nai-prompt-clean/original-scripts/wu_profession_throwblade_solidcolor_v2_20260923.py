# -*- coding: utf-8 -*-
"""Revised Wu Flying Blade profession-card sample: fixed ornaments, matte stars, action composition, solid color."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-profession-throwblade-solidcolor-v2-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
TOKEN=''
with (ROOT/'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line=line.strip()
        if line and not line.startswith('#'):
            TOKEN=line
            break
if not TOKEN:
    sys.exit('TOKEN_EMPTY')
SUBJECT=(
    '1girl, Wu, original fantasy heroine. A single instant from the martial card Flying Blade Sneak Attack. '
    'Dynamic over-the-shoulder view from behind an armored enemy: only his dark shoulder, one raised forearm and the edge of his helmet occupy the lower-right foreground; do not show another face. '
    'Wu darts around his blind side from the upper-left midground, twisting her torso and releasing exactly one short steel throwing blade with her right gloved hand toward the gap under his guard. '
    'The blade cuts across the frame on a steep upper-left-to-lower-right diagonal; a very short thin crimson cut mark appears on the armor at impact. '
    'Her face is large, sharp and unobstructed, turned three-quarter toward the viewer; bright blue eyes, confident sly smile and one small fang are clearly visible. '
    'Her silver-white tight high ponytail and blue ribbon stream behind the turn; layered skirt flares from the sudden movement. '
    'A long black sword remains sheathed diagonally across her back, secondary to the short flying blade. '
    'Young woman with pale skin, youthful small face, parted bangs revealing both eyes, two long sidelocks, '
    '1.2::two large matte black round sunglasses tilted on the image-left side of the crown of her head::, '
    '1.3::one black rose fixed to the image-right side of the high ponytail base immediately beside the cobalt-blue satin bow::, '
    'black off-shoulder gothic dress with a single horizontal ruffled neckline, slim black belt, black layered outer skirt, '
    'dark blue underskirt visible in a narrow band around the hem, covered with many flat printed light-blue four-point stars. '
    'The star pattern is ordinary matte ink on fabric with no light emission or sparkle. Bare legs, black gloves and black ankle boots. '
    'Keep the approved character-select portrait painterly finish: lively broken contours, clear facial details, broad deliberate brush planes in the dark fabric, '
    'flowing paint in the ponytail, small sharp highlights only on metal and eyes. Strong readable silhouette and one decisive action.'
)
SCENE=(
    'Wide horizontal game card art designed for a 1.32:1 crop, dramatic Dutch-angle composition. '
    'The entire background is one uniform solid muted terracotta color, warm ochre-orange, flat and unbroken from edge to edge. '
    'No white background, no gradient, no scenery, no floor, no background brush wash or pattern. '
    'Keep Wu’s face, the fixed hair ornaments, the blade and the enemy shoulder inside the central crop-safe area. '
    'No border, title, letters or UI.'
)
prompt=nai_style.build_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'blurry eyes, hair covering eyes, sunglasses over eyes, rose on glasses, rose on forehead, '
    'glowing stars, luminous stars, floating stars, star particles, sparkles, light emitted by dress, '
    'pantyhose, tights, thighhighs, stockings, extra characters, extra faces, duplicate girl, '
    'extra throwing blades, multiple daggers, fireball, white background, gradient background, '
    'scenery, floor, textured background, card frame, UI'
)
seed=random.randint(1,2**32-1)
payload={
    'input':prompt,'model':'nai-diffusion-5-full','action':'generate',
    'parameters':{
        'params_version':3,'width':1216,'height':832,'scale':6.5,'steps':28,'n_samples':1,
        'ucPresetId':'none','qualityPresetId':'none','qualityToggle':False,'negative_prompt':uc,
        'sampler':'k_euler_ancestral','seed':seed,'decrisper':False,
        'deliberate_euler_ancestral_bug':False,'prefer_brownian':True,'karras':True,
        'cfg_rescale':0.0,'variety_plus':True,'texture_transform':False,'autoSmea':True,
        'straight_alpha':False,'legacy_v4_extend':False,'legacy_uc':False,
        'v4_prompt':{'caption':{'base_caption':prompt,'char_captions':[]},'use_coords':False,'use_order':True},
        'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},
        'characterPrompts':[],
    },
}
pj=OUT/'wu-throwblade.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
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
print('IMAGE_READY',str(png),'SEED',seed,'SIZE',1216,832,flush=True)
