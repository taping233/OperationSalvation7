# -*- coding: utf-8 -*-
"""v17: 对着 0919 定版选人立绘（portraits/full/wu.webp, seed 尾 2701）修小图。
按 bible wu.md 细粒度锚点逐要素重写主体层；修 v16 跑偏点：
马尾垂坠贴身到小腿、星衬只露下摆一圈、剑鞘在身后、墨镜架头顶偏左、裙长前后等长。"""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-select-portrait-v17-small-'+time.strftime('%Y%m%d-%H%M%S'))
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
    '1girl, solo, original fantasy heroine, young woman, pale skin, small round youthful face, '
    'large bright blue slightly upturned eyes, sharp confident gaze, both eyes fully visible, '
    'parted bangs, eyebrows visible through hair, mischievous open-mouth grin with one small fang. '
    'Sleek smooth white hair in a tight neat high ponytail tied at the back top of her head, '
    'the ponytail hanging straight down her back on her left side, reaching mid-calf below the skirt hem, '
    'calm and heavy, not floating; two long sidelocks falling to her collarbone. '
    'A blue satin ribbon bow with two hanging streamers at the ponytail base, '
    'a black rose ornament at the right side of the ponytail base beside the ribbon, '
    'matte black round sunglasses with thin frames resting on top of her head, tilted slightly to the left. '
    'Black off-shoulder dress with bare shoulders and collarbone, one horizontal ruffled neckline layer, '
    'a thin black waist belt at the waist. '
    'The skirt hangs evenly at shin length all around: an outer black ruffled skirt with a jagged zigzag hem '
    'covering front and sides, with the deep blue underskirt densely patterned with light blue four-point stars '
    'showing only as a circle of hem below the outer skirt. '
    'Bare legs, thick-soled black ankle boots with folded cuffs. '
    'Standing full body facing the viewer in a gentle three-quarter view, '
    'right hand resting on her hip with the back of the hand outward, left arm relaxed at her side, '
    'legs slightly apart, weight even. '
    'A thin black longsword in a black scabbard is slung diagonally across her back: '
    'the hilt emerges above her left shoulder, the scabbard tip extends past her right side down to just below the knee, '
    'the whole sword stays behind her body and never crosses in front of the dress; '
    'a thin black strap runs from her right shoulder to her left waist.'
)
SCENE=(
    'Vertical character-select portrait, one large centered standing figure on a clean white background, no scenery. '
    'Soft directional light reveals the planes of the forms; '
    'the entire figure and both boots are visible, with open space around the silhouette.'
)
prompt=nai_style.build_character_portrait_prompt(SUBJECT,SCENE)
uc=nai_style.build_uc(
    'blurry eyes, hair covering both eyes, sunglasses over eyes, reflective sunglasses, lens flare, glasses reflection, '
    'pantyhose, tights, thighhighs, stockings, '
    'high-low skirt, asymmetrical skirt, uneven skirt, floating hair, wind, sword in front of body'
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
