import hashlib, json, sys
from pathlib import Path
EVIDENCE=Path(__file__).resolve().parent
PROJECT=EVIDENCE.parents[2]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
tags='1other, solo, hand focus, two-handed grip, sword, close-up, from below, foreshortening, dutch angle, cropped arms, painterly, broad brush strokes'
scene=('Only two gripping hands and short sleeve ends enter from the upper-left; the entire body stays outside the frame. '
    'Both hands grasp ONE short dark hilt; ONE broad steel blade sweeps diagonally downward toward the lower-right edge. '
    'The grip occupies one sixth of the frame; the blade is the dominant connected shape. '
    'One short pale tapering slash mark follows the blade near its tip. No target or other prop. '
    'Background is quiet muted blue-gray with a restrained dark burgundy transition in the upper-left.')
paint=('Economical hand-painted anime drawing. Sparse firm contour accents explain fingers, hilt and blade edges. '
    'Inside these shapes, broad matte steel-gray, charcoal and muted skin planes form grouped light and shadow. '
    'A few loaded wide strokes turn the blade and sleeves; surfaces stay calm. '
    'Keep grip anatomy clear without glove seams, finger wrinkles or decorative detailing. No finely polished surfaces or scattered texture.')
prompt=build_asset_prompt(tags,composition_layer=scene,light_material_layer=paint)
character='other, anonymous martial artist, dark gray plain sleeves, plain black gloves'
uc=build_uc('head, face, torso, legs, boots, full body, named character, extra swords, extra hands, wrist bandages, ornate guard, etched blade, glove seams, tiny wrinkles, fine ink linework, dense hatching, vector art, glossy 3d render, grain filter, sparks, target, scenery').replace('clean closed lineart, ','')
seed=build_payload(prompt,seed=None)['parameters']['seed']
output=PROJECT.parent/'.tmp/nai/output/flying-cleave-simple-20261011/cleave.png'
if output.exists(): raise SystemExit('Output exists; stop')
request=dict(card_id='tt3-fly-arrowhawk',model='nai-diffusion-4-5-full',width=1024,height=1024,seed=seed,parameters=DEFAULTS,
    prompt=prompt,character_prompt=character,negative_prompt=uc,output=str(output),installed=False,design='仅双手局部与一道下劈刀锋；删躯干腿靴细饰，少量结构线、形体内宽笔明暗，安静蓝灰酒红背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,char_prompt=character,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
