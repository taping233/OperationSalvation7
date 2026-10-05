# -*- coding: utf-8 -*-
"""Focused redraw of five fireball cards and the early-experiment Abyss Curse card."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('changwuyu-profession-cards-v3-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
TOKEN=''
for line in (ROOT/'token.txt').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if line and not line.startswith('#'):
        TOKEN=line
        break
if not TOKEN: sys.exit('TOKEN_EMPTY')

CHAR=(
 'Changwuyu, the same elegant mysterious male mage from his character-select portrait. Slender pointed ear, silver-gray hair in a low bun with long locks framing his face, '
 'thin round metal glasses, clearly visible amber-yellow eyes. His black witch hat has a long curved tip bending and drooping to the right, with a broad brim and deep purple underside. '
 'Black high-collar robe, gold edging, pale-lavender-to-deep-purple cloak lining, black gloves; white feather and blue sapphire set in a gold clasp on his left chest. '
 'Keep his recognizable face, hairstyle, hat silhouette and costume consistent with the original portrait.'
)

# id, asset, title, camera/action, flame or curse visual language, background, count
CARDS=[
 ('tt7-burnharvest','spell-tt7-burnharvest','爆燃火球',
  'Dynamic waist-up side profile at a low oblique angle. Changwuyu plants his feet, twists his torso and drives one gloved hand forward; his silver locks and cloak whip backward from the force.',
  'One fireball hurtles from his palm toward a small target on the far right. It is a coherent, recognizable burning mass with a bright yellow-white heart, layered orange and vermilion flame sheets, uneven tongues that leap outward and fold back, a ragged turbulent edge and a long brush-streaked tail. The flames visibly surge and change shape around the core; the core is not wrapped in a smooth shell. At impact the front of the fireball blossoms into a compact flare while its trailing flames still read clearly as one projectile.',
  'flat deep muted aubergine', 'one mage, one living fireball, one small target'),
 ('tt7-twinfireball','spell-tt7-twinfireball','三重火球',
  'Three-quarter view from slightly above, cropped at mid-thigh. Changwuyu steps into the cast and opens both hands at different heights, his head turned in profile toward the spell.',
  'Exactly three separate fireballs spiral around his hands in a clear triangular rhythm. Each is a living flame mass with its own bright molten center and a different irregular silhouette: one compact and newly ignited, one stretching into a hooked flame tongue, one flaring outward in layered orange-red sheets. Their fire edges flicker, leap and curl; short painterly flame trails show circular motion. Keep distinct gaps so the count of three is instantly clear; no smooth orange balls, no explosion.',
  'flat cool muted lavender', 'one mage, exactly three distinct living fireballs'),
 ('tt7-meteorstrong','spell-tt7-meteorstrong','星陨之力',
  'Tilted high-angle view looking diagonally down across Changwuyu in a half-body stance. He sweeps his pointing arm across the composition as he tracks a target below.',
  'Exactly three enormous fire meteors plunge diagonally from upper left toward one small target at lower right. Each has a dense incandescent yellow-white center, broken plates of orange flame and long ragged red-orange streamers that shear backward in the wind. Their silhouettes stretch and deform as they descend, with painterly streaks showing speed; one meteor is just beginning to burst beyond the target. The image must read as falling fire meteors, not three polished spheres or a generic explosion.',
  'flat deep indigo-violet', 'one mage, exactly three falling flame meteors, one small target'),
 ('cmtn1lbhbqi4','spell-cmtn1lbhbqi4','充能火球',
  'Intimate side-profile close medium shot, face and both hands prominent. Changwuyu leans in with a concentrated expression, cupping his hands as if compressing a flame into shape.',
  'Between his palms, one compact fireball is being charged: a bright white-yellow core pulses inside swirling orange flame ribbons. Several distinct tongues of fire repeatedly spring out, split, curl around his wrists and fold back into the core; the outline swells and contracts in a visible charging rhythm. Short directional brush marks and heat shimmer reinforce motion. It remains one recognizable fire spell, but never looks like a smooth enclosed sphere or a simple glowing orb.',
  'flat dark muted plum', 'one mage in profile, one actively surging fireball'),
 ('tt3-flame-storm','spell-tt3-flame-storm','风暴火球',
  'Wide, canted over-the-shoulder action view. Changwuyu pivots sharply across the foreground and sweeps his arm from right to left; face in partial profile, eyes following the cast.',
  'Exactly three separate fireballs whip across the frame on three different curved paths, each aimed at one small enemy silhouette. Make their motion visibly different: one stretches into a curved flame streamer, one breaks into several large licking tongues around its bright core, one corkscrews with a layered flame wake. All three keep a clear incandescent center and orange-red fire texture, with vigorous jumping flame edges and broad painterly trails. The three paths form a readable storming sweep, not identical round dots or one merged fire cloud.',
  'flat cool charcoal-violet', 'one mage, exactly three distinct fireballs on different arcs, three small enemies'),
 ('tt7-abysscurse','spell-tt7-abysscurse','深渊诅咒',
  'Match the early experimental card image: Changwuyu large at left-center, waist-up in a dramatic three-quarter view. His right fingertips touch the rim of his round glasses; his left hand extends toward a single armored enemy on the right. Slight low camera angle, enemy kept secondary.',
  'A narrow, forceful stream of black ink-mist shoots from Changwuyu’s palm and binds the enemy’s chest. One bold violet-black curse seal appears at the impact point. Three small distinct curse marks orbit close to the enemy, while a few blank pale spectral cards are pulled out of the target and arc back toward Changwuyu. Use the early experiment’s clean diagonal spell path, dramatic silhouette and airy spacing; keep the enemy and magic readable without turning the image into a dense symbol cloud.',
  'flat muted lavender-mauve', 'one mage, one armored enemy, one ink-mist stream, three small curse marks, a few blank cards'),
]

EXTRA_UC=(
 'text, lettering, watermark, signature, logo, frame, border, UI, collage, multiple views, gradient background, textured background, scenery, floor, '
 'extra characters, extra arms, extra limbs, wrong hat, ordinary hat, red eyes, blue eyes, missing glasses, blurry eyes, '
 'blurry fingers, extra fingers, missing fingers, fused fingers, malformed hands, '
 'smooth enclosed orange sphere, polished glass orb, simple glowing ball, uniform fireball duplicates, abstract fire cloud, '
 'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, plastic texture, waxy texture'
)

manifest=[]
for i,(card_id,filename,title,camera,effect,bg,count) in enumerate(CARDS,1):
    scene=(
      'Small horizontal 1.32:1 collectible game-card illustration, no frame, interface or lettering. '
      'Painterly storyboard composition with a deliberate camera angle, a clear action direction and a large readable Changwuyu. '
      f'{count}. Camera and body action: {camera} '
      f'Effect: {effect} '
      f'Use one perfectly flat solid background color, {bg}, edge to edge. No gradient, background texture, scenery or floor. '
      'Use the approved v1.0 painterly sketch language: broad confident planes, loose visible brushstrokes, broken selected edges, crisp highlights and varied brush texture. Keep the figure and spell readable at thumbnail size.'
    )
    prompt=nai_style.build_prompt('1man, solo main hero, '+CHAR+' '+camera+' '+effect,scene)
    uc=nai_style.build_uc(EXTRA_UC)
    seed=random.randint(1,2**32-1)
    payload={
      'input':prompt,'model':'nai-diffusion-5-full','action':'generate',
      'parameters':{
        'params_version':3,'width':1216,'height':832,'scale':6.5,'steps':28,'n_samples':1,
        'ucPresetId':'none','qualityPresetId':'none','qualityToggle':False,'negative_prompt':uc,
        'sampler':'k_euler_ancestral','seed':seed,'decrisper':False,'deliberate_euler_ancestral_bug':False,
        'prefer_brownian':True,'karras':True,'cfg_rescale':0.0,'variety_plus':True,
        'texture_transform':False,'autoSmea':True,'straight_alpha':False,'legacy_v4_extend':False,'legacy_uc':False,
        'v4_prompt':{'caption':{'base_caption':prompt,'char_captions':[]},'use_coords':False,'use_order':True},
        'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},
        'characterPrompts':[],
      },
    }
    pj=OUT/(card_id+'.payload.json')
    pj.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    zp=OUT/(card_id+'.zip')
    started=time.monotonic()
    print('REQUEST_START',i,'OF',len(CARDS),card_id,flush=True)
    r=subprocess.run([
      'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
      '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
      '-H','Content-Type: application/json','--data-binary','@'+str(pj),
      'https://image.novelai.net/ai/generate-image'
    ],capture_output=True,text=True,timeout=220)
    code=(r.stdout or '').strip()[-3:]
    if code=='403': print('STOP_HTTP_403',card_id,flush=True); break
    if code=='429': print('STOP_HTTP_429_WAIT_15_MINUTES',card_id,flush=True); break
    if code not in ('200','201'):
        print('STOP_HTTP_ERROR',code or 'NO_CODE',card_id,(r.stderr or '')[-250:],flush=True); break
    png=OUT/(filename+'_'+str(seed)+'.png')
    with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
    manifest.append({'id':card_id,'filename':filename+'.webp','name':title,'seed':seed,'size':[1216,832],'png':png.name,'prompt':prompt,'uc':uc})
    print('IMAGE_READY',i,'OF',len(CARDS),card_id,png.name,'SEED',seed,flush=True)
    if i<len(CARDS):
        wait=max(0,45-(time.monotonic()-started))
        if wait: print('WAIT_SECONDS',round(wait),flush=True); time.sleep(wait)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'requested':len(CARDS),'completed':len(manifest),'items':manifest},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',len(manifest),'OF',len(CARDS),'OUTPUT',str(OUT),flush=True)
