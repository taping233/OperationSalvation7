import hashlib,json,sys
from pathlib import Path
EVIDENCE=Path(__file__).resolve().parent
PROJECT=EVIDENCE.parents[2]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
tags='no humans, arrows, wooden target, close-up, three-quarter view, dutch angle, solid background, hand-drawn linework, painterly'
scene=('A thick battered wooden archery target fills the right half and extends outside the right frame, its front plane angled toward the left. '
    'Exactly THREE arrows point diagonally from lower-left toward upper-right into three closely spaced points on this same target. '
    'Two arrows are already embedded, their small dark shafts and two plain feather fins extending back toward the left. '
    'The third arrow is arriving just below them: its steel tip touches the wood with one tiny pale notch and two short splinters. '
    'One short muted ivory motion streak behind the arriving arrow implies the next shot, not a simultaneous fan volley. '
    'Background is one uniform solid deep petrol-blue color, no landscape.')
paint=('Firm economical colored contour lines close the three arrow silhouettes and target rim; sparse structural lines show penetration points and thickness. '
    'Broad matte gray-brown and umber planes describe wood, slate-gray shafts and quiet ochre feather shapes. '
    'Inside contours, a few opaque long brush swipes turn material; no finely painted grain or ornate target pattern. '
    'Keep a small strongest highlight at the arriving arrow contact. Large calm shapes and distinct three-shot rhythm dominate.')
prompt=build_asset_prompt(tags,composition_layer=scene,light_material_layer=paint)
uc=build_uc('people, hands, faces, bow, crossbow, many arrows, arrow fan, bullseye rings, symbols, fine wood grain, many fragments, sparks, flames, glowing arrow trails, thin ink hatching, glossy 3d render, grain filter, gradient background, scenery').replace('clean closed lineart, ','')
seed=build_payload(prompt,seed=None)['parameters']['seed']
output=PROJECT.parent/'.tmp/nai/output/repeat-shot-20261011/shot.png'
if output.exists(): raise SystemExit('Output exists; stop')
request=dict(card_id='tt3-double-shot',model='nai-diffusion-4-5-full',width=1024,height=1024,seed=seed,parameters=DEFAULTS,
    prompt=prompt,character_prompt='',negative_prompt=uc,output=str(output),installed=False,design='三发先后命中木靶，前两箭嵌入、第三箭接触邻近点；无完整弩机，纯色深青蓝背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
