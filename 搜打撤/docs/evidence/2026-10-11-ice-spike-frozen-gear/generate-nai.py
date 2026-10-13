import hashlib,json,sys
from pathlib import Path
EVIDENCE=Path(__file__).resolve().parent
PROJECT=EVIDENCE.parents[2]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
tags='no humans, gear, icicle, frost, close-up, three-quarter view, dutch angle, solid background, hand-drawn linework, painterly'
scene=('A massive old bronze cogwheel is stopped by ONE jagged ice spike lodged tightly BETWEEN TWO TEETH on its near rim. '
    'The wheel occupies the right two thirds, its right side cropped by the frame, with a clear thick rim and large teeth in perspective. '
    'The ice spike enters diagonally from lower-left toward the tooth gap near center-right; its sharp point jams against the tooth. '
    'Frost spreads from this contact across three nearby bronze teeth, changing warm metal into pale blue ice. '
    'A short curved motion trace behind the unfrozen upper rim suggests rotation abruptly stopped. '
    'Background is one solid deep navy-blue color, no gradient or environment detail.')
paint=('Clear tapered colored contour and structural lines describe the gear thickness, teeth and irregular ice edges. '
    'Broad matte umber and muted ochre shadows stay within metal forms; ice uses pale cyan, blue-gray and ivory major planes. '
    'Keep the brightest crisp edge where ice wedges against bronze; leave broad quieter stretches elsewhere. '
    'Use a few wide opaque strokes within enclosed shapes. Frost is a thin irregular connected crust, not scattered particles or tiny crystal facets.')
prompt=build_asset_prompt(tags,composition_layer=scene,light_material_layer=paint)
uc=build_uc('people, hands, face, multiple gears, extra ice spikes, clock face, letters, numbers, ornamental engraving, many rivets, snowflakes, floating shards, fine hatching, glossy 3d render, grain filter, gradient background, scenery').replace('clean closed lineart, ','')
seed=build_payload(prompt,seed=None)['parameters']['seed']
output=PROJECT.parent/'.tmp/nai/output/ice-spike-frozen-gear-20261011/ice.png'
if output.exists(): raise SystemExit('Output exists; stop')
request=dict(card_id='tt3-ice-spike',model='nai-diffusion-4-5-full',width=1024,height=1024,seed=seed,parameters=DEFAULTS,
    prompt=prompt,character_prompt='',negative_prompt=uc,output=str(output),installed=False,design='冰刺楔入铜齿轮齿隙截停转动，寒霜从接触点蔓延；有实物作用关系，纯色深蓝背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
