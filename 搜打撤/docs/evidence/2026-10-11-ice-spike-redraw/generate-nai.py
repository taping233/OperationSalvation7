import hashlib,json,sys
from pathlib import Path
EVIDENCE=Path(__file__).resolve().parent
PROJECT=EVIDENCE.parents[2]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
tags='no humans, icicle, ice magic, close-up, foreshortening, dutch angle, hand-drawn linework, painterly'
scene=('ONE long tapered ice spike shoots diagonally from upper-left toward the lower-right foreground, its sharp tip fully visible just inside the bottom-right. '
    'The broad root sits near upper-left center; one short curved frost crescent behind it indicates freezing, with no other shards. '
    'The ice spike has a clear central ridge and three or four large planar faces; its silhouette is one connected sharp form. '
    'Background is a quiet deep petrol-blue to muted gray-violet color transition with ample negative space.')
paint=('Firm sparse colored contour lines define the ice silhouette and a few internal plane divisions. '
    'Broad matte pale cyan, blue-gray and deep teal paint turns stay inside these enclosed planes. '
    'One restrained ivory edge highlight leads to the tip; one broad translucent cyan midtone suggests ice. '
    'Use a few long directional brush swipes inside the ice faces, not many little triangular facets or fine cracks. Keep background free of brush debris.')
prompt=build_asset_prompt(tags,composition_layer=scene,light_material_layer=paint)
uc=build_uc('people, hands, faces, multiple ice spikes, ice cluster, scattered shards, snowflakes, particles, tiny facets, dense cracks, snow scene, weapons, ornate patterns, glossy 3d render, granular filter, fine ink hatching, full-frame glow').replace('clean closed lineart, ','')
seed=build_payload(prompt,seed=None)['parameters']['seed']
output=PROJECT.parent/'.tmp/nai/output/ice-spike-redraw-20261011/ice.png'
if output.exists(): raise SystemExit('Output exists; stop')
request=dict(card_id='tt3-ice-spike',model='nai-diffusion-4-5-full',width=1024,height=1024,seed=seed,parameters=DEFAULTS,
    prompt=prompt,character_prompt='',negative_prompt=uc,output=str(output),installed=False,design='一根长冰刺与短冻结弧痕，清楚外轮廓与脊线、形体内主要冰面；深青蓝灰紫背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,width=1024,height=1024,seed=seed,out=output,model=request['model'])
source=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(source),seed=seed,model=request['model'],bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(source),flush=True)
