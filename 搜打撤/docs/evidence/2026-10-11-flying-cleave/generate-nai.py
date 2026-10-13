import hashlib, json, sys
from pathlib import Path
EVIDENCE=Path(__file__).resolve().parent
PROJECT=EVIDENCE.parents[2]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
tags='1other, solo, jumping, knees bent, two-handed grip, sword, from below, close-up, foreshortening, dutch angle, head out of frame, hand-drawn linework'
scene=('An anonymous warrior is airborne in the upper-left, both knees tucked up; head and face are completely cropped above the frame. '
    'Both hands grip ONE short sword handle at upper-left; the broad straight steel blade sweeps down diagonally toward lower-right, ending at a small dark abstract impact plane. '
    'The nearer boot sole fills the left foreground, the farther bent leg and boot are smaller behind it. '
    'Torso weight follows the blade; short tunic hem and belt tails sweep opposite the downward strike. '
    'Background is a quiet muted blue-gray and dark burgundy combination, with one short ivory slash at the lower-right impact.')
paint=('Use clear expressive tapered contour and structural lines to define hands, blade, joints and boots. '
    'Keep color and broad grouped shadow planes WITHIN these defined forms; principal cloth folds only. '
    'Steel is matte gray with one broad restrained ivory highlight. A few wide directional strokes turn volumes inside contours. '
    'Do not cover silhouettes or background in scattered rough paint patches; retain quiet interior stretches and readable anatomy.')
prompt=build_asset_prompt(tags,composition_layer=scene,light_material_layer=paint)
character='other, anonymous warrior, charcoal gray short tunic, gray trousers, black boots, dark gloves, ivory wrist wraps, short dark belt'
uc=build_uc('visible head, visible face, named character, ponytail, goggles, cape, extra limbs, extra swords, separated hands, long sword handle, fine wrinkles, ornate armor, scattered texture, facet mosaic, grain filter, scenery, flesh, blood').replace('clean closed lineart, ','')
seed=build_payload(prompt,seed=None)['parameters']['seed']
output=PROJECT.parent/'.tmp/nai/output/flying-cleave-20261011/cleave.png'
if output.exists(): raise SystemExit('Output exists; stop')
request=dict(card_id='tt3-fly-arrowhawk',model='nai-diffusion-4-5-full',width=1024,height=1024,seed=seed,parameters=DEFAULTS,
    prompt=prompt,character_prompt=character,negative_prompt=uc,output=str(output),installed=False,
    design='匿名腾空下劈低机位，头脸出框、近靴前景、长剑向右下；线条先建形，色块收在形体内。',uc_override='仅本图移除clean closed lineart排除项以落实老板线条要求，不改共享配方')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,char_prompt=character,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
