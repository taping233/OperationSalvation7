import hashlib,json,sys
from pathlib import Path
PROJECT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
EVIDENCE=Path(__file__).resolve().parent
jobs=[
dict(name='sweep-v2',cid='tt3-frostfall',
tags='1boy, solo, extreme close-up, cropped head, cropped torso, sword, holding sword, gauntlets, foreshortening, mask, slashing, abstract background',
character='boy, anonymous adult swordsman, only a cropped forearm and part of the upper torso in frame, plain charcoal martial sleeve, simple dark steel wrist guard, black leather glove, one silver straight sword with a dark undecorated grip and small straight crossguard',
scene=(
'Frame this as a close shot of a single sword passing THROUGH a huge black demon mask, not a full-body character portrait. '
'The anonymous swordsman is mostly OUTSIDE the left edge: a connected shoulder fragment, sleeve and enormous gloved sword hand enter from the lower-left corner. His entire head and face are outside the canvas. '
'The clenched hand and compact crossguard occupy the lower-left quarter. The silver blade projects from this grip across the center toward the upper-right, wide near the guard and narrowing in perspective. '
'A single enormous flat ink-black demonic mask occupies the upper-right half. It is an abstract broken shell with two horn-like points and a simple hollow eye cutout, not a living humanoid monster. '
'The sword is caught just after cutting through the mask: its upper and lower halves slide apart on either side of the cutting plane, leaving a sharp pale diagonal gap. '
'The blade crosses IN FRONT of the lower half and emerges THROUGH the split; the two edges visibly line up with its path. '
'One broad muted crimson cloth strip tied around the swordsman wrist lags in a reverse curve toward the left, indicating the sweep without another weapon or glowing ring. '
'Show the gloved fingers actually enclosing the grip, an unbroken wrist-sleeve-arm connection and a physically continuous blade. '
'The viewpoint is nearly level with the cutting plane, making the glove and blade loom toward us while the mask sits one plane behind. '
'The glove is the dark foreground anchor; the blade and opened gap form the brightest narrow shape; the broken mask is the large dark counterweight. '
'Use quiet pale stone-gray negative space on the upper-left and lower-right, charcoal masses, desaturated violet inside the mask, and only the small muted crimson cloth accent. '
'Focus detail at the grip and mask break, while sleeve and background stay as broad matte painted planes. '
'No body posed in front of a backdrop; no wall of smoke, particle explosion or giant beam.')),
dict(name='leap-v2',cid='tt3-fly-arrowhawk',
tags='1boy, solo, from below, close-up, cropped head, jumping, sword, holding sword, foreshortening, motion blur, dynamic pose, abstract background',
character='boy, anonymous adult martial fighter, head completely outside the upper-left edge of the crop, plain charcoal-black short martial coat, dull gray loose trousers, simple wrist wraps, black gloves, plain worn black boots, one steel chopping sword with a short plain hilt',
scene=(
'Design an extreme low-angle close shot from directly under an airborne downward sword chop. '
'The anonymous fighter enters diagonally from the upper-left: his HEAD is fully above and outside the picture, while the cropped shoulder, connected forearms, bent waist and two airborne legs remain within the shot. '
'His gloved hands grip one sword hilt near the upper-left edge in front of his raised shoulder. The blade travels from that hilt toward the lower-right foreground, sharply enlarged by perspective. '
'The broad silver blade occupies the main diagonal and about one-third of the composition; the nearer cutting edge is close to the camera, and its point approaches the lower-right corner. '
'His near knee is pulled up behind the hands, while the near boot sole turns toward us in the left middle foreground; the other bent leg recedes toward the upper-left. '
'The visible boot has a simple heavy rectangular sole, not a detailed product diagram, and remains connected to the trouser leg. '
'The coat hem whips upward away from the downward-moving sword, forming a broad dark arc behind the waist. '
'The blade is at the instant before contact with an oblique charcoal band in the lower-right; a small muted oxblood triangular chip begins to lift from this band. '
'The sword, hands, shoulders and coiled hips must form one plausible connected motion; no floating blade, extra arm or elongated impossibly thin sword. '
'The nearest sword edge occludes part of the torso, while the boot and folded trouser leg supply clear airborne depth. '
'Keep a large quiet bone-gray field on the right above the blade and a muted deep wine-red field on the left. '
'A single broad ivory directional smear follows the lower blade edge, rather than many speed lines or sparks. '
'The visual hierarchy is one oversized steel blade, one dark boot and compressed limb group, one small impact accent. '
'No face, no scenic setting, no centered full-body brown-clothed mannequin, no cape, no ornate costume.'))
]
uc=build_uc('face, visible eyes, facial profile, head in frame, portrait, full body, standing, neutral pose, brown ninja outfit, '
'girl, long hair, ponytail, goggles, glasses, orange scarf, crescent ornament, ornate armor, huge cape, staff, '
'two swords, floating sword, oversized hilt, needle-thin sword, realistic smoke, giant laser, explosion, many particles, detailed scenery, contact sheet')
for job in jobs:
 out=PROJECT.parent/f".tmp/nai/output/generic-martial-20261010/{job['name']}.png"
 if out.exists(): raise SystemExit('Already generated; stop')
 prompt=build_asset_prompt(job['tags'],composition_layer=job['scene'])
 seed=build_payload(prompt,seed=None)['parameters']['seed']
 model='nai-diffusion-5-full'
 req=dict(card_id=job['cid'],model=model,seed=seed,width=1024,height=1024,parameters=DEFAULTS,
 prompt=prompt,character_prompt=job['character'],negative_prompt=uc,output=str(out),
 references=['game/assets/cards/martial-tt2-block.webp','game/assets/cards/martial-tt3-fatal-pierce.webp','game/assets/cards/martial-cc-dual-wield.webp'],
 reference_usage='人工分析近景裁切/兵刃比例/碰撞点，不向V5传参考图',installed=False)
 (EVIDENCE/f"{job['name']}-request.json").write_text(json.dumps(req,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 path,seed=generate_image(prompt,uc,char_prompt=job['character'],width=1024,height=1024,seed=seed,out=out,model=model)
 p=Path(path)
 (EVIDENCE/f"{job['name']}-receipt.json").write_text(json.dumps(dict(path=str(p),seed=seed,model=model,bytes=p.stat().st_size,
 sha256=hashlib.sha256(p.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(job['name']+' DONE',flush=True)

