import hashlib, json, sys
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT/'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc
EVIDENCE=Path(__file__).resolve().parent
common_character=('boy, anonymous adult martial artist, face completely hidden, back of head visible only, '
'plain dark cloth headwrap covering all hair, simple weathered gray-brown layered martial jacket, '
'cloth waist belt, loose trousers, wrist wraps, ordinary dark boots, no insignia, one plain steel longsword with simple crossguard')
jobs=[
('tt3-frostfall','sweep', '1boy, solo, from behind, from below, sword, holding sword, lunging, swinging, foreshortening, faceless',
'The camera is very close behind the rear shoulder of Character 1 and below waist height. '
'His cloth-wrapped head is turned entirely away, without a visible cheek, eye or facial profile. '
'His broad back occupies the left lower third; his torso twists through a low forward lunge. '
'One bent knee carries his weight while the rear leg extends in the opposing direction. '
'Both hands grip ONE sword at the end of a forceful horizontal sweep across the lower foreground. '
'The near shoulder, wrapped forearms and simple sword hilt establish a readable chain of force; the blade projects diagonally from left toward right with clear perspective. '
'An ivory-white slash arc curves across the middle of the image, like a clean cut opening a heavy charcoal-violet veil. '
'The dark veil is an abstract suggestion of evil spirits: two large torn shadow shapes, not a crowd of monsters with detailed faces. '
'The cut makes a broad quiet pale gap behind the blade, and its shadow edges recoil away from the sword. '
'The warrior looks into the newly opened gap, never back toward the camera. '
'Keep his rough jacket warm muted russet-gray, the shadows black-violet and the backdrop ash-gray with a small dull plum field. '
'Large clean shapes and an asymmetrical opening convey purification, rather than piles of sparkles. '
'One continuous sword blade, connected wrists, a grounded turning body, no weapon floating separately.'),
('tt3-fly-arrowhawk','leap', '1boy, solo, from behind, from below, jumping, knees bent, sword, holding sword, overhead, foreshortening, faceless',
'Character 1 is suspended at the apex of a forward leap, viewed from a very low oblique camera in front of the descending blade but behind the warrior\'s shoulder line. '
'His cloth-wrapped head points down and away, showing only the back of the head; his raised forearms also obscure the far side of his head. '
'Both hands grip ONE long sword overhead, elbows bent, at the instant its downward chopping motion begins. '
'His upper body bends forward toward the descending blade while one knee folds tightly toward the torso and the other leg trails backward. '
'His two boots and folded legs remain recognizable, separated from the loose trouser silhouette. '
'The single blade is strongly foreshortened toward the lower-right foreground, larger than the distant hands, and follows a steep diagonal from above his shoulder. '
'A broad narrow-edged ivory slash mark continues the blade direction toward a broken dark-red abstract plane at the lower-right edge. '
'The near boot, tucked knee, shoulders and raised hilt form one compact coiled silhouette in the upper-left and center, while the blade drives the opposite diagonal. '
'Loose jacket panels and a short plain cloth belt tail lag upward and backward from the leap; no large cape. '
'Use a muted smoke-ochre field with slate-gray sections, dark brown clothing and a small oxblood impact accent. '
'The ground is only one angular abstract band, not a detailed landscape or an enemy body. '
'Freeze the exact airborne chopping pose with clean limb count and one coherent perspective. ')
]
uc=build_uc('visible face, eyes visible, facial profile, looking at viewer, portrait, girl, long hair, ponytail, '
'white hair, blond hair, goggles, glasses, pointed ears, wide-brimmed hat, crescent hair ornament, star pattern, '
'orange scarf, ornate armor, huge cape, blue ribbon, staff, two swords, floating sword, detached arms, '
'crowd, detailed demon face, gore, landscape, contact sheet')
for cid,name,tags,scene in jobs:
 out=PROJECT.parent/f'.tmp/nai/output/generic-martial-20261010/{name}.png'
 out.parent.mkdir(parents=True,exist_ok=True)
 if out.exists(): raise SystemExit(f'Already generated: {out}')
 prompt=build_asset_prompt(tags,composition_layer=scene)
 model='nai-diffusion-5-full'
 seed=build_payload(prompt,seed=None)['parameters']['seed']
 req=dict(card_id=cid,model=model,width=1024,height=1024,seed=seed,parameters=DEFAULTS,
 prompt=prompt,character_prompt=common_character,negative_prompt=uc,output=str(out),installed=False)
 (EVIDENCE/f'nai-{name}-request.json').write_text(json.dumps(req,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 path,actual_seed=generate_image(prompt,uc,char_prompt=common_character,width=1024,height=1024,seed=seed,out=out,model=model)
 p=Path(path)
 (EVIDENCE/f'nai-{name}-receipt.json').write_text(json.dumps(dict(path=str(p),seed=actual_seed,model=model,
 bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),installed=False),
 ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(name+' DONE',flush=True)

