# -*- coding: utf-8 -*-
"""Small portrait returned to the original 0919 character-select painterly recipe."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-select-portrait-v16-small-'+time.strftime('%Y%m%d-%H%M%S'))
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
    '1girl, solo, Wu, original fantasy heroine, young woman, pale skin, small youthful face, '
    'large bright blue slightly upturned eyes, both eyes fully visible, parted bangs, '
    'sleek smooth silver-white hair in a tight neat high ponytail swept behind her toward the viewer right, '
    'two long sidelocks falling to her collarbone, blue satin bow ribbon at the ponytail, '
    'matte black round sunglasses resting at a slight angle on the upper left of her head, '
    'black rose ornament beside the ribbon, confident mischievous smile, one small visible fang, '
    'black off-shoulder gothic dress with a horizontal ruffled neckline, fitted black waist belt, '
    'layered black outer skirt with a blue underskirt patterned with light blue four-point stars, bare legs, '
    'black gloves, thick-soled black ankle boots. '
    'Standing full body, right hand on hip, legs slightly apart, facing the viewer in a gentle three-quarter view. '
    'The black sword hilt emerges above the upper left side of her silhouette; its black scabbard slopes diagonally down toward the lower right and ends just below her knee. '
    'The entire figure and both boots are visible, with the sword readable beside and behind her silhouette.'
)
SCENE=(
    'Vertical character-select portrait, one large centered standing figure, quiet white background with a very light cool blue loose brush wash, no scenery. '
    'Soft directional light reveals the planes of the forms; leave open space around the full silhouette.'
)
prompt=nai_style.build_character_portrait_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'blurry eyes, hair covering both eyes, sunglasses over eyes, reflective sunglasses, lens flare, glasses reflection, '
    'pantyhose, tights, thighhighs, stockings'
)
seed=random.randint(1,2**32-1)
payload={
    'input':prompt,'model':'nai-diffusion-5-full','action':'generate',
    'parameters':{
        'params_version':3,'width':832,'height':1216,'scale':6.5,'steps':28,'n_samples':1,
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
pj=OUT/'wu-select-portrait.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
zp=OUT/'wu-select-portrait.zip'
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
png=OUT/('wu-select-portrait_'+str(seed)+'.png')
with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'seed':seed,'size':[832,1216],'prompt':prompt,'uc':uc,'png':png.name},f,ensure_ascii=False,indent=2)
print('IMAGE_READY',str(png),'SEED',seed,flush=True)
