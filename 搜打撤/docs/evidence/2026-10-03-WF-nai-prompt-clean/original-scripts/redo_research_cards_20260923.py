# -*- coding: utf-8 -*-
"""Clarify the visual concepts for High-end Research and Basic Development."""
import json, random, shutil, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0,r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('missing-card-art-research-redo-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
token=''
for line in (ROOT/'token.txt').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if line and not line.startswith('#'): token=line; break
if not token: sys.exit('TOKEN_EMPTY')
CARDS=[
 ('tt12-hitechrd','spell-tt12-hitechrd','高端研发',
  'A focused fantasy artificer shown waist-up in side profile, leaning over a compact brass-and-glass research desk. One gloved hand rotates a luminous calibration prism while the other holds a blank spell folio. The prism is marked by two clear golden cost-rings; the rings collapse one by one and the folio grows brighter, showing a high-value spell being systematically refined over time. Draw readable lenses, a quill, a few crisp blueprint strokes and controlled instruments. The researcher and the before-to-after action fill the frame; no empty platform, no chest, no tiny distant props.',
  'Oblique close medium shot from above the desk, face and hands visible. Solid muted blue-gray background.'),
 ('tt12-basicdev','spell-tt12-basicdev','基础开发',
  'Close over-the-shoulder view of a young spell researcher sketching a simple spell in the air with a quill. Exactly two separate blank spell folios emerge directly from the fresh sketch, each with a small unlit blue crystal at its center to show two basic, free techniques. The hand, quill, forming strokes and two folios are large and clear; unmistakably a spell being developed into two cards, not a chest, box, or treasure.',
  'High three-quarter side angle, paper and hand dominate the foreground; the researcher’s focused profile is visible behind them. Solid dark desaturated teal background.'),
]
uc=nai_style.build_uc('text, readable writing, numbers, watermark, signature, logo, frame, border, UI, collage, multiple views, gradient background, textured scenery, treasure chest, box, empty platform, tiny distant object, extra cards, extra hands, malformed fingers, flat cel shading, smooth airbrush, no brush texture, clean closed lineart, plastic texture, waxy texture')
manifest=[]
for idx,(card_id,filename,title,subject,scene) in enumerate(CARDS,1):
    prompt=nai_style.build_prompt(subject,'Small horizontal 1.32:1 collectible card illustration, no frame, no interface, no lettering. '+scene+' One dominant clear subject and readable storyboard action. Approved v1.0 painterly sketch treatment: broad confident paint planes, loose varied visible brushstrokes, broken selected edges and crisp material highlights.')
    seed=random.randint(1,2**32-1)
    payload={'input':prompt,'model':'nai-diffusion-5-full','action':'generate','parameters':{'params_version':3,'width':1216,'height':832,'scale':6.5,'steps':28,'n_samples':1,'ucPresetId':'none','qualityPresetId':'none','qualityToggle':False,'negative_prompt':uc,'sampler':'k_euler_ancestral','seed':seed,'decrisper':False,'deliberate_euler_ancestral_bug':False,'prefer_brownian':True,'karras':True,'cfg_rescale':0.0,'variety_plus':True,'texture_transform':False,'autoSmea':True,'straight_alpha':False,'legacy_v4_extend':False,'legacy_uc':False,'v4_prompt':{'caption':{'base_caption':prompt,'char_captions':[]},'use_coords':False,'use_order':True},'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},'characterPrompts':[]}}
    pj=OUT/(card_id+'.payload.json'); pj.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    zp=OUT/(card_id+'.zip'); started=time.monotonic()
    print('REQUEST_START',idx,'OF',len(CARDS),card_id,flush=True)
    r=subprocess.run(['curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}','-o',str(zp),'-X','POST','-H','Authorization: Bearer '+token,'-H','Content-Type: application/json','--data-binary','@'+str(pj),'https://image.novelai.net/ai/generate-image'],capture_output=True,text=True,timeout=220)
    code=(r.stdout or '').strip()[-3:]
    if code=='403': print('STOP_HTTP_403',card_id,flush=True); break
    if code=='429': print('STOP_HTTP_429_WAIT_15_MINUTES',card_id,flush=True); break
    if code not in ('200','201'): print('STOP_HTTP_ERROR',code or 'NO_CODE',card_id,(r.stderr or '')[-250:],flush=True); break
    png=OUT/(filename+'_'+str(seed)+'.png')
    with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
    manifest.append({'id':card_id,'filename':filename+'.webp','name':title,'seed':seed,'size':[1216,832],'png':png.name,'prompt':prompt,'uc':uc})
    print('IMAGE_READY',idx,'OF',len(CARDS),card_id,png.name,'SEED',seed,flush=True)
    if idx<len(CARDS):
        wait=max(0,45-(time.monotonic()-started))
        if wait: print('WAIT_SECONDS',round(wait),flush=True); time.sleep(wait)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f: json.dump({'requested':2,'completed':len(manifest),'items':manifest},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',len(manifest),'OF',len(CARDS),'OUTPUT',str(OUT),flush=True)
