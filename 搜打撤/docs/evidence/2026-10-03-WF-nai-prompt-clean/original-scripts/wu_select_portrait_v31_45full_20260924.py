# -*- coding: utf-8 -*-
"""v31：Anlas=0、V5 额度条耗尽 → 老板令换 nai-diffusion-4-5-full 小图。
4.5 老权益：832×1216(101万px) + steps28 ≤ 门槛 = 真无限免费。
payload 按 4.5 形状：params_version 1 / 数字 ucPreset=3(none) / sm+sm_dyn false / noise_schedule karras；
无 variety+（4.5 无此字段，V5 的 0.6 强度不适用）。prompt/uc/seed 同 v30（头发保持本版+腮红眼层次+头歪肩胯逆转）。单张。"""
import json, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('wu-select-portrait-v31-45full-'+time.strftime('%Y%m%d-%H%M%S'))
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
    '1girl, solo, fantasy heroine, young woman, pale fair skin, '
    '1.2::small round youthful face, girlish delicate features, '
    'large bright blue slightly upturned eyes with layered highlights, sharp confident gaze, '
    'both eyes fully visible and symmetric, '
    'mischievous open-mouth grin with one small fang, small nose, soft rounded chin::, '
    'center-parted bangs, forehead exposed, white hair swept to both sides, '
    'white hair in tight high ponytail, long ponytail reaching mid-calf BEHIND her, '
    'NO ponytail strands forward of torso, '
    'two long sidelocks to collarbone, '
    'round matte-black sunglasses resting flat on top of head, '
    'black rose ornament at ponytail base, blue satin ribbon bow, '
    'balanced head-to-body ratio, longer torso, defined pelvis, '
    'subtle torso twist matching pose, wide natural shoulder, stable standing center of gravity, '
    'black off-shoulder dress, single-layer ruffled neckline, thin black belt at natural waist, '
    'high-waisted A-line skirt ending evenly at shin length, '
    'ONLY ONE row of black ruffles at hem, '
    'deep blue underskirt with light blue four-pointed star pattern, '
    'the star-patterned lining visible only through the gaps between the black ruffle layers, '
    'bare legs, thick-soled black ankle boots with folded cuffs, '
    'full body standing, gentle three-quarter view, facing viewer, '
    'head tilted slightly, shoulders angled against hips, lively confident stance, '
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
    'unified large block brushstrokes throughout the whole body, '
    'no small sketchy details on limbs, broad soft shadow transitions, '
    'consistent lighting across entire character, '
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
    'mature face, adult woman, angular face, narrow eyes, small eyes, heavy makeup, '
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
    'strap on front of body, sword strap visible on torso front, long hair hanging on front of hip, '
    'overly elongated legs, short torso, sharp hard shadows, '
    'sketchy fine lines on limbs, flat shading without volume, stiff pose, no torso rotation'
)
prompt=nai_style.ARTIST_BLOCK+'\n\n'+POSITIVE
uc=NEGATIVE
SEED=2136158621
payload={
    'input':prompt,'model':'nai-diffusion-4-5-full','action':'generate',
    'parameters':{
        'params_version':1,'width':832,'height':1216,'scale':6.5,'steps':28,'n_samples':1,
        'ucPreset':3,'qualityToggle':False,'negative_prompt':uc,
        'sampler':'k_euler_ancestral','seed':SEED,
        'sm':False,'sm_dyn':False,
        'cfg_rescale':0.0,'noise_schedule':'karras',
        'deliberate_euler_ancestral_bug':False,'prefer_brownian':True,
        'legacy_uc':False,'legacy':False,'add_original_image':False,
        'v4_prompt':{'caption':{'base_caption':prompt,'char_captions':[]},'use_coords':False,'use_order':True},
        'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},
        'characterPrompts':[],
    },
}
pj=OUT/'v45.payload.json'
with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
zp=OUT/'v45.zip'
png=OUT/('wu-45full_'+str(SEED)+'.png')
for attempt in range(3):
    if attempt>0: time.sleep(10)
    r=subprocess.run([
        'curl','--noproxy','*','--ssl-no-revoke','--max-time','300','-sS','-w','%{http_code}',
        '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
        '-H','Content-Type: application/json','--data-binary','@'+str(pj),
        'https://image.novelai.net/ai/generate-image'
    ],capture_output=True,text=True,timeout=340)
    code=(r.stdout or '').strip()[-3:]
    if code=='403': sys.exit('STOP_HTTP_403')
    if code=='429': sys.exit('HTTP_429_WAIT_15_MINUTES_BEFORE_RETRY')
    if code not in ('200','201') or r.returncode!=0:
        body=b''
        if zp.exists(): body=zp.read_bytes()[:200]
        sys.exit('HTTP_ERROR_'+(code or 'NO_CODE')+' rc='+str(r.returncode)+' body='+repr(body)+' '+(r.stderr or '')[-200:])
    try:
        with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
        zp.unlink()
        break
    except Exception as e:
        print('ZIP_BAD_TRY',attempt+1,repr(e)[:120],flush=True)
        try: zp.unlink()
        except OSError: pass
else:
    sys.exit('ZIP_STILL_BROKEN_AFTER_3_TRIES')
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'seed':SEED,'size':[832,1216],'model':'nai-diffusion-4-5-full',
               'params':{'steps':28,'scale':6.5,'ucPreset':3,'noise_schedule':'karras','variety':'off(4.5无此字段)'},
               'prompt':prompt,'uc':uc,'png':png.name},f,ensure_ascii=False,indent=2)
print('IMAGE_READY',str(png),'SEED',SEED,flush=True)
