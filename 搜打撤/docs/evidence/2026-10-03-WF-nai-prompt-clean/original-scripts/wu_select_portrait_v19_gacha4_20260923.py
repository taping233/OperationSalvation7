# -*- coding: utf-8 -*-
"""v19 抽卡批：老板反馈 v18 内容锚点全保留、但画风跑偏（渲染偏硬偏赛璐璐）。
同 v18 锚点提示词原样，只换 4 个随机 seed 出 4 版供老板抽卡。
张间隔 45s（节奏铁律）；429 停 15 分钟、403 立即停。"""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-select-portrait-v19-gacha4-'+time.strftime('%Y%m%d-%H%M%S'))
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
    'the ponytail hanging straight down her back, its length visible behind her on the viewer\'s right side, '
    'reaching mid-calf below the skirt hem, calm and heavy, not floating; '
    'two long sidelocks falling to her collarbone. '
    'Headwear is a fixed anchor: round matte-black sunglasses with thin frames resting flat on top of her head '
    'over her white hair, tilted slightly toward her left, no strap; '
    'a black rose ornament at the base of the ponytail, beside a blue satin ribbon bow with two hanging streamers. '
    'Black off-shoulder dress with bare shoulders and collarbone, one horizontal ruffled neckline layer. '
    'A thin black belt cinched flat around her natural waist is a fixed anchor, '
    'clearly visible at the waist where the flared skirt begins. '
    'Skirt shape is a fixed anchor: a high-waisted A-line skirt, flat and fitted at the waist, '
    'flaring wide and ending evenly at shin length all around. '
    'The outer black skirt is the main skirt: its hem is a jagged zigzag row of pointed black ruffled tufts '
    'hanging around the legs, and the deep blue inner lining, densely patterned with light blue four-point stars, '
    'peeks through between the tufts and shows as a modest tier under the black hem. '
    'Bare legs, thick-soled black ankle boots with folded cuffs. '
    'Standing full body facing the viewer in a gentle three-quarter view, '
    'right hand resting on her hip with the back of the hand outward, left arm relaxed at her side, '
    'legs slightly apart, weight even. '
    'A thin black longsword in a black scabbard is slung flat across her back: '
    'only the hilt emerges above her left shoulder and the scabbard tip past her right side at knee level; '
    'from the front the sword stays hidden behind her body and never crosses the dress; '
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
    'goggles, headband, strap across forehead, '
    'pantyhose, tights, thighhighs, stockings, '
    'high-low skirt, asymmetrical skirt, uneven skirt, floating hair, wind, sword in front of body, '
    'glowing stars, dense grid pattern'
)
def fire(seed):
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
    pj=OUT/('gacha-'+str(seed)+'.payload.json')
    with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
    zp=OUT/('gacha-'+str(seed)+'.zip')
    png=OUT/('wu-gacha_'+str(seed)+'.png')
    for attempt in range(3):
        if attempt>0: time.sleep(10)
        r=subprocess.run([
            'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
            '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
            '-H','Content-Type: application/json','--data-binary','@'+str(pj),
            'https://image.novelai.net/ai/generate-image'
        ],capture_output=True,text=True,timeout=220)
        code=(r.stdout or '').strip()[-3:]
        if code=='403': sys.exit('STOP_HTTP_403')
        if code=='429': sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
        if code not in ('200','201') or r.returncode!=0:
            sys.exit('HTTP_ERROR_'+(code or 'NO_CODE')+' rc='+str(r.returncode)+' '+(r.stderr or '')[-400:])
        try:
            with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
            zp.unlink()
            return png
        except Exception as e:
            print('ZIP_BAD_TRY',attempt+1,seed,repr(e)[:120],flush=True)
            try: zp.unlink()
            except OSError: pass
    sys.exit('ZIP_STILL_BROKEN_AFTER_3_TRIES '+str(seed))

results=[]
for i in range(4):
    if i>0: time.sleep(45)
    seed=random.randint(1,2**32-1)
    existing=OUT/('wu-gacha_'+str(seed)+'.png')
    png=existing if existing.is_file() and existing.stat().st_size>0 else fire(seed)
    results.append({'idx':i+1,'seed':seed,'png':png.name})
    print('READY',i+1,'/4 SEED',seed,str(png),flush=True)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'size':[832,1216],'prompt':prompt,'uc':uc,'results':results},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',str(OUT),flush=True)
