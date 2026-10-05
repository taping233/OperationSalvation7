# -*- coding: utf-8 -*-
"""Small profession-card illustration for Changwuyu: Abyss Curse, in approved v16 painterly style."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('changwuyu-profession-abyss-curse-small-'+time.strftime('%Y%m%d-%H%M%S'))
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
    '1man, exactly two figures, Changwuyu and one enemy. A dynamic painterly fantasy card illustration capturing the instant Changwuyu casts Abyss Curse. '
    'Changwuyu is the clear foreground focus on the left-center, shown waist-up in a three-quarter view with his face fully visible. '
    'His right fingertips rest lightly on the rim of his round glasses while his left gloved hand reaches toward the enemy. '
    'A compact mass of solid black ink-mist coils from his palm and strikes the enemy at the chest; one distinct violet-black curse seal closes around the impact, with three small separate curse marks orbiting the target to suggest stacked curses. '
    'A few blank spectral cards are drawn from the cursed target and arc back toward Changwuyu, with no symbols or writing. '
    'The single enemy stands at the right in dark armor, turned partly away; keep the target secondary and the spell path easy to read. '
    'Changwuyu is an elegant mysterious male mage with a slender black witch hat: a long curved tip bends and droops to the right, broad brim with deep purple underside. '
    'Thin round metal glasses, visible amber-yellow eyes, pointed right ear, silver-gray long hair gathered in a low bun with long side locks. '
    'Black high-collar robe, flowing cloak opened to show a pale-lavender-to-deep-purple lining with gold edging, black gloves, '
    'white feather ornament and blue sapphire in a gold clasp on his left chest. Keep these signature features clear and accurate. '
    'Use a restrained palette of charcoal black, deep violet, pale lavender, muted gold and small sapphire blue accents. '
    'Crisp readable face and costume details, confident varied contours, clear light-shadow planes, painterly brush marks following the cloak and mist, '
    'strong value separation around the face and spell, controlled highlights on the glasses, brooch and gold trim.'
)
SCENE=(
    'Wide horizontal 1.32:1 trading-card illustration composition, no card frame, no UI, no lettering. '
    'Keep both figures and the spell fully within the central safe area. Deep aubergine fading into muted lavender, sparse painterly atmosphere, '
    'subtle violet rim light keeps Changwuyu’s eyes and gold details readable; no extra scenery or decorative particles.'
)
prompt=nai_style.build_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'extra characters, duplicated people, extra arms, extra limbs, staff, fireball, text, lettering, card frame, UI, photo border'
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
