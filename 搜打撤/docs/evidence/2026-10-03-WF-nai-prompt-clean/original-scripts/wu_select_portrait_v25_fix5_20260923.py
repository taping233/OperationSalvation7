# -*- coding: utf-8 -*-
"""v25：老板逐项修 v24——
①肩带三连强约束（slung BEHIND her back / DOES NOT cross front torso / entirely behind back）
②马尾禁前飘（NO ponytail strands forward of torso）③领口单层、裙摆仅一圈荷叶边
④星星改回 four-pointed（上轮误改 five-pointed）⑤UC 追加蛋糕裙/肩带胸前/前飘发六条
参数不变，variety_plus_strength 0.6（400 则去字段重发）；seed 固定 617511376 对比 + 两新 seed。"""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-select-portrait-v25-fix5-'+time.strftime('%Y%m%d-%H%M%S'))
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
POSITIVE=(
    '1girl, solo, fantasy heroine, young woman, pale skin, delicate youthful face, '
    'large bright blue eyes, sharp confident gaze, mischievous open-mouth grin, '
    'one small fang, center-parted bangs, forehead exposed, white hair swept to both sides, '
    'white hair in tight high ponytail, long ponytail reaching mid-calf BEHIND her, '
    'NO ponytail strands forward of torso, '
    'two long sidelocks to collarbone, '
    'round matte-black sunglasses resting flat on top of head, '
    'black rose ornament at ponytail base, blue satin ribbon bow, '
    'black off-shoulder dress, single-layer ruffled neckline, thin black belt at natural waist, '
    'high-waisted A-line skirt ending evenly at shin length, '
    'ONLY ONE row of black ruffles at hem, '
    'deep blue underskirt with light blue four-pointed star pattern, '
    'the star-patterned lining visible only through the gaps between the black ruffle layers, '
    'bare legs, thick-soled black ankle boots with folded cuffs, '
    'full body standing, gentle three-quarter view, facing viewer, '
    'right hand on hip, left arm relaxed, legs slightly apart, '
    'one thin black longsword in black scabbard slung BEHIND her back by a thin black shoulder strap, '
    'shoulder strap DOES NOT cross over front torso, '
    'strap runs from her right shoulder to her left waist entirely behind back, '
    'hilt above left shoulder, scabbard tip past right side, '
    'sword hidden behind body from front view, '
    'heavy painterly brushwork, large blocky strokes, broken brush edges, '
    'selective detail, finely drawn face, simplified hair and clothing, '
    'strong value contrast, muted blue-gray shadows, dry paint texture, '
    'loose hand-painted illustration, character select portrait style, '
    'airy pale painterly tones, clean white background, soft directional light, '
    'calm quiet atmosphere, one large centered standing figure, '
    'open space around silhouette, complete painted sketch, '
    'visible brush marks, confident light and shadow planes, '
    'masterpiece, best quality'
)
NEGATIVE=(
    'polished cel shading, clean anime lineart, overly smooth rendering, '
    'flat airbrush look, plastic texture, vinyl, latex, wet look, '
    'shiny clothing, glossy fabric, blurry face, blurry eyes, '
    'bangs covering forehead, hair falling between the eyes, '
    'sunglasses over eyes, reflective sunglasses, '
    'goggles, headband, strap across forehead, '
    'pantyhose, tights, thighhighs, stockings, '
    'jagged hem, zigzag-cut hem, pointed triangular hem, frayed torn edges, '
    'asymmetrical skirt, uneven skirt, floating hair, wind effect, '
    'sword in front of body, cross pattern, plus signs, '
    'glowing stars, dense grid pattern, '
    'deformed hands, extra fingers, missing fingers, '
    'text, watermark, signature, multiple views, collage, frame, '
    'multiple skirt ruffles, stacked cake skirt, shoulder strap crossing chest, '
    'strap on front of body, sword strap visible on torso front, long hair hanging on front of hip'
)
prompt=nai_style.ARTIST_BLOCK+'\n\n'+POSITIVE
uc=NEGATIVE

def build_payload(seed, with_vp_strength=True):
    params={
        'params_version':3,'width':832,'height':1216,'scale':6.5,'steps':32,'n_samples':1,
        'ucPresetId':'none','qualityPresetId':'none','qualityToggle':False,'negative_prompt':uc,
        'sampler':'k_euler_ancestral','seed':seed,'decrisper':False,
        'deliberate_euler_ancestral_bug':False,'prefer_brownian':True,'karras':True,
        'cfg_rescale':0.0,'variety_plus':True,'texture_transform':False,'autoSmea':True,
        'straight_alpha':False,'legacy_v4_extend':False,'legacy_uc':False,
        'v4_prompt':{'caption':{'base_caption':prompt,'char_captions':[]},'use_coords':False,'use_order':True},
        'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},
        'characterPrompts':[],
    }
    if with_vp_strength:
        params['variety_plus_strength']=0.6
    return {'input':prompt,'model':'nai-diffusion-5-full','action':'generate','parameters':params}

def fire(seed):
    png=OUT/('wu-fix5_'+str(seed)+'.png')
    pj=OUT/('fix5-'+str(seed)+'.payload.json')
    zp=OUT/('fix5-'+str(seed)+'.zip')
    for attempt in range(3):
        if attempt>0: time.sleep(10)
        payload=build_payload(seed, with_vp_strength=fire.with_vp_strength)
        with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
        r=subprocess.run([
            'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
            '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
            '-H','Content-Type: application/json','--data-binary','@'+str(pj),
            'https://image.novelai.net/ai/generate-image'
        ],capture_output=True,text=True,timeout=220)
        code=(r.stdout or '').strip()[-3:]
        if code=='403': sys.exit('STOP_HTTP_403')
        if code=='429': sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
        if code=='400' and fire.with_vp_strength:
            fire.with_vp_strength=False
            print('DROP_VP_STRENGTH_400_RETRY',flush=True)
            continue
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
fire.with_vp_strength=True

seeds=[617511376, random.randint(1,2**32-1), random.randint(1,2**32-1)]
results=[]
for i,seed in enumerate(seeds):
    if i>0: time.sleep(45)
    png=fire(seed)
    results.append({'idx':i+1,'seed':seed,'png':png.name})
    print('READY',i+1,'/3 SEED',seed,str(png),flush=True)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'size':[832,1216],'params':{'steps':32,'scale':6.5,'variety_plus_strength':0.6 if fire.with_vp_strength else 'dropped'},
               'note':'idx1=基准seed 617511376 固定换词对比','prompt':prompt,'uc':uc,'results':results},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',str(OUT),flush=True)
