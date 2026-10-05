# -*- coding: utf-8 -*-
"""One character portrait using the new universal v1.2 painterly recipe."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-portrait-v12-20260923-'+time.strftime('%H%M%S'))
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
    '1girl, Wu, original fantasy heroine, young woman, pale skin, small youthful face, '
    'large bright blue eyes, sharp slightly upturned eyes, both eyes fully visible, parted bangs, '
    'sleek smooth silver-white hair in a tight high ponytail, blue satin ribbon at the ponytail, '
    'two long sidelocks falling to her collarbone, matte black round sunglasses resting on top of her head, '
    'black rose hair ornament beside the ribbon, confident mischievous smile, small fang, '
    'black off-shoulder gothic dress with a ruffled neckline, fitted black waist belt, '
    'layered black skirt with blue underskirt patterned with light blue four-point stars, bare legs, '
    'black gloves, thick-soled black ankle boots, '
    'standing full body, right hand on hip, left arm relaxed at her side, '
    'long black sword and black sheath worn diagonally across her back, hilt visible above her left shoulder, '
    'frontal three-quarter view, looking at viewer, entire figure visible, open ground below her feet'
)
SCENE=(
    'vertical full-body character portrait, single large centered figure, '
    'quiet white background with a very light cool blue loose brush wash, no scenery, '
    'soft directional light, clean open space around the silhouette'
)
UC_EXTRA=(
    'blurry eyes, hair over one eye, sunglasses over eyes, pantyhose, tights, thighhighs, stockings, '
    'reflective sunglasses, lens flare, glasses reflection, dark busy background, scenery, ground shadow, '
    'text, watermark, signature, frame, collage, multiple views'
)
prompt=nai_style.build_character_portrait_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(UC_EXTRA)
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
pj=OUT/'wu-portrait.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
zp=OUT/'wu-portrait.zip'
r=subprocess.run([
    'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
    '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
    '-H','Content-Type: application/json','--data-binary','@'+str(pj),
    'https://image.novelai.net/ai/generate-image'
],capture_output=True,text=True,timeout=220)
code=(r.stdout or '').strip()[-3:]
if code=='403': sys.exit('STOP_HTTP_403')
if code=='429': sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
if code not in ('200','201'): sys.exit('HTTP_ERROR_'+(code or 'NO_CODE'))
png=OUT/('wu-portrait_'+str(seed)+'.png')
with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'seed':seed,'size':[832,1216],'prompt':prompt,'uc':uc,'png':png.name},f,ensure_ascii=False,indent=2)
print('IMAGE_READY',str(png), 'SEED',seed,flush=True)
