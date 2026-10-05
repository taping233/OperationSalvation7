# -*- coding: utf-8 -*-
"""Compact, solid-background version of Changwuyu's Abyss Curse card art."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('changwuyu-abyss-curse-v2-small-'+time.strftime('%Y%m%d-%H%M%S'))
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
    '1man, exactly two figures, Changwuyu and one enemy. A compact horizontal fantasy card illustration of Changwuyu casting Abyss Curse. '
    'Changwuyu is very large in the frame, waist-up, face clear and recognizable, placed center-left in a three-quarter view. '
    'His right gloved fingertips touch his thin round glasses; his left palm is extended toward a single enemy on the right. '
    'One bold solid black ink-mist mass travels from his palm and wraps the enemy; a single bright violet curse seal marks the impact on the enemy chest. '
    'Keep the spell silhouette simple and distinct. No extra sigils, no floating cards, no decorative particles. '
    'The enemy is a small simplified dark armored silhouette, secondary to Changwuyu. '
    'Changwuyu is an elegant mysterious male mage with a black witch hat: its long curved point bends and droops to the right, broad brim with deep purple underside. '
    'Thin round metal glasses, visible amber-yellow eyes, one pointed ear, silver-gray hair gathered in a low bun with long side locks. '
    'Black high-collar robe with gold edging, broad pale-lavender cloak lining, black gloves, white feather and blue sapphire in a gold clasp on his left chest. '
    'Keep the hat, glasses, silver hair, feather-sapphire brooch, and black-purple-gold costume large enough to read at thumbnail size. '
    'Strong value separation: pale hair and face against black clothing, violet spell against the background, crisp simple silhouette, restrained painterly modeling.'
)
SCENE=(
    'Wide 1.32:1 card illustration, no card frame, no interface, no lettering. '
    'A single perfectly flat, solid muted lavender background, one uniform color across the entire canvas; no gradient, no texture, no scenery, no ground, no shadows on the background. '
    'Large central composition with Changwuyu occupying most of the card and the target kept near the right edge inside the safe area.'
)
prompt=nai_style.build_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'extra characters, duplicated people, extra arms, extra limbs, staff, fireball, multiple curse symbols, floating cards, '
    'gradient background, textured background, scenery, ground, background shadow, particles, lettering, card frame, UI'
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
pj=OUT/'changwuyu-abyss-curse.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
zp=OUT/'changwuyu-abyss-curse.zip'
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
png=OUT/('changwuyu-abyss-curse_'+str(seed)+'.png')
with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'card':'深渊诅咒','seed':seed,'size':[1216,832],'prompt':prompt,'uc':uc,'png':png.name},f,ensure_ascii=False,indent=2)
print('IMAGE_READY',str(png),'SEED',seed,'SIZE',1216,832,flush=True)
