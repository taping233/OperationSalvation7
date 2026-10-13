import hashlib,json,sys
from pathlib import Path
PROJECT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(PROJECT/'tools'))
from nai_gen import generate_image,build_payload,DEFAULTS
from nai_prompt_clean import build_asset_prompt,build_uc
EVIDENCE=Path(__file__).resolve().parent
tags='1girl, solo, from below, close-up, foreshortening, kneeling, leaning forward, cupped hands, light, flowing fabric, calm expression, closed mouth'
character=(
'girl, young adult priestess, delicate composed face, warm golden eyes, very pale low-saturation golden long hair, '
'dense straight bangs above brows, smooth rounded crown, two long straight cheek sidelocks, one thick long low side braid, '
'a white crescent moon hairpin clipped flat just above the bangs on viewer-right, tilted against her hair, '
'white high-collared priestess long dress with restrained gold collar and small four-point star clasp, '
'deep forest-teal short cape with sparse gold edging, dark wrist guards leaving fingers exposed, dark tights, white-gray short boots')
scene=(
'Character 1 is the source of holy light, rather than standing beside a decorative light source. '
'She kneels sideways on one knee in a quiet abstract space and bends forward from the waist, her rear hip and folded leg counterbalancing the reach. '
'Both bare hands are cupped together in front of her lower chest, fingers gently interlocking at the little-finger edges to form a real shallow channel. '
'An impossibly soft broad sheet of ivory light pours from the hollow between her palms, flowing downward and then toward the camera like a luminous ribbon of water. '
'The light has two or three large folded white planes, not a glowing ball, laser, thin rays or a mass of particles. '
'The camera is almost within the near end of this light stream, looking up diagonally at her hands and face. '
'The near sleeve and cupped hands occupy the lower center foreground, strongly larger than her face; the flowing light enters the lower-right corner and creates a sweeping S-curve. '
'Her face is clearly visible in three-quarter view near the upper-left third, inclined toward the palms, with both golden eyes readable, relaxed brows and a neutral closed mouth. '
'The near white sleeve flares around the wrist while the deep-teal cape folds back behind her shoulder, exposing the connected arm and chest. '
'Her low pale braid follows the forward bend and hangs across the quieter left edge instead of obscuring her hands. '
'The white stream supplies reflected light to the underside of the fingers, chin and sleeve; her head is outlined against a dark gray-teal block behind it. '
'The rear folded skirt and knee fade into a broad warm-gray plane, with enough waist and torso to understand the kneeling support, rather than a floating detached bust. '
'The background is a few large desaturated gray-teal and warm-stone color planes, not a church, waterfall, garden or star field. '
'Reserve broad calm negative space above and to the right of her shoulder. '
'Keep the luminous hand contact, readable calm face and broad flowing white sheet as the three focal elements. '
'The stream is symbolic holy replenishment opening outward like large blank leaves of light, not literal playing cards or a written book. '
'Do not invent a container: no bottle, cup, basin, lantern or staff. ')
prompt=build_asset_prompt(tags,composition_layer=scene)
uc=build_uc('boy, purple eyes, black priestess dress, purple cape, bright yellow hair, orange hair, silver hair, '
'angry expression, smirk, blushing, bottle, cup, basin, lantern, staff, orb, sword, literal cards, book, '
'church interior, waterfall, stars, many particles, laser beam, extra hands, white border, contact sheet')
model='nai-diffusion-5-full'
seed=build_payload(prompt,seed=None)['parameters']['seed']
out=PROJECT.parent/'.tmp/nai/output/holy-source-20261010/holy-source.png'
out.parent.mkdir(parents=True,exist_ok=True)
if out.exists(): raise SystemExit('Already generated; stop')
req=dict(card_id='tt7-livingwater',model=model,width=1024,height=1024,seed=seed,parameters=DEFAULTS,
prompt=prompt,character_prompt=character,negative_prompt=uc,output=str(out),installed=False,
design='低机位贴近光流仰视；光牧星月侧跪前倾，双掌倾出宽白绸状圣光，手与袖口近大、脸清楚，灰青暖灰抽象背景。')
(EVIDENCE/'nai-request.json').write_text(json.dumps(req,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path,seed=generate_image(prompt,uc,char_prompt=character,width=1024,height=1024,seed=seed,out=out,model=model)
p=Path(path)
(EVIDENCE/'nai-receipt.json').write_text(json.dumps(dict(path=str(p),seed=seed,model=model,bytes=p.stat().st_size,
sha256=hashlib.sha256(p.read_bytes()).hexdigest(),installed=False),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(p),flush=True)

