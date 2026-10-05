# -*- coding: utf-8 -*-
"""Ten distinct, action-led Changwuyu profession-card drafts in approved v1.0 style."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
STAMP=time.strftime('%Y%m%d-%H%M%S')
OUT=ROOT/'output'/('changwuyu-profession-cards-v2-'+STAMP)
OUT.mkdir(parents=True,exist_ok=True)
TOKEN=''
with (ROOT/'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line=line.strip()
        if line and not line.startswith('#'):
            TOKEN=line
            break
if not TOKEN: sys.exit('TOKEN_EMPTY')

CHAR=(
 'Changwuyu, an elegant mysterious male mage, clearly visible amber-yellow eyes behind thin round metal glasses, '
 'one pointed ear, silver-gray long hair gathered into a low bun with long side locks, a black witch hat with a long curved tip bending and drooping to the right and broad brim with deep purple underside. '
 'Black high-collar robe with gold edging, black gloves, flowing cloak with pale lavender-to-deep purple lining. '
 'White feather ornament and blue sapphire in a gold clasp pinned on his left chest. Preserve this exact recognizable character design.'
)

# Each scene deliberately varies camera, gesture, direction and visual rhythm.
# id, asset, title, shot/action, flat backdrop, object constraints
CARDS=[
 ('tt3sp-shadowshot','spell-tt3sp-shadowshot','暗影射击',
  'Three-quarter over-the-shoulder action shot from behind Changwuyu’s left shoulder, camera slightly below his raised arm. He twists his torso and snaps his gloved hand forward; exactly two slim, unmistakably arrow-shaped black-violet bolts fly in parallel from left foreground toward one enemy at right. One small curse mark is already visible on the enemy, and the first bolt is just striking it. Keep both arrowheads and the target readable.',
  'flat cool pale lavender-gray', 'exactly two shadow arrows, one mage, one small enemy'),
 ('tt7-burnharvest','spell-tt7-burnharvest','爆燃火球',
  'Low-angle side view, close medium shot. Changwuyu braces his feet and thrusts one open gloved palm forward. A single large, perfectly recognizable spherical fireball dominates the foreground: round orange-red flame shell, bright yellow-white molten center, short tapered flame tail, visibly traveling toward one small target at the edge. Show the instant the spherical fireball bursts against that target in one compact flare; keep the round orb intact and readable.',
  'flat deep muted aubergine', 'one unmistakable spherical fireball with bright core, one mage, one small target'),
 ('tt7-twinfireball','spell-tt7-twinfireball','三重火球',
  'Front-facing medium shot from slightly above. Changwuyu sweeps both hands apart, looking up as exactly three large round orange fireballs appear in a clean triangular arrangement above his palms. Each orb has a bright yellow center and a short flame tail, with clear gaps between all three. This is a controlled summoning beat, no target and no explosion; the count of three must be instantly obvious.',
  'flat subdued blue-violet', 'exactly three separated spherical fireballs, one mage'),
 ('tt7-abysscurse','spell-tt7-abysscurse','深渊诅咒',
  'High-angle diagonal composition looking down past Changwuyu as he kneels and presses one black-gloved hand toward the ground. A single thick black ink-mist ribbon rises from the shadow and coils around one enemy’s torso; a small violet curse seal appears at the contact point. The enemy recoils and reaches toward the seal. Keep the face and hand gesture clear; one bold curse shape, no fire or decorative runes.',
  'flat pale dusty mauve', 'one mage, one enemy, one black curse ribbon, one small seal'),
 ('tt7-meteorstrong','spell-tt7-meteorstrong','星陨之力',
  'Vertical-feeling low camera looking upward past Changwuyu’s extended arm. He points decisively toward a single enemy below frame while exactly three large spherical fire meteors descend from the top edge in a steep staggered line. Each meteor has a round blazing orange body, bright yellow core and a long downward tail; their falling direction and scale make them read as meteors. One broad impact flash begins behind the target, without hiding the three orbs.',
  'flat deep indigo', 'exactly three large descending spherical meteors, one mage, one small enemy'),
 ('cmtn1gfhczzj','spell-cmtn1gfhczzj','厄运',
  'Tight over-the-table shot from a high three-quarter angle. Changwuyu flicks a single black six-sided die from between two gloved fingers toward one distant enemy. Freeze the die large in the foreground with one clear violet curse symbol on its upward face; its cast shadow stretches toward the enemy and ends in a small matching curse mark. His amber eyes and glasses remain visible above the hand. The die is the unmistakable focal prop; no cards, no menu, no abstract sigil cloud.',
  'flat light gray-lavender', 'one mage, one die with one clear curse mark, one small enemy'),
 ('cmtn1lbhbqi4','spell-cmtn1lbhbqi4','充能火球',
  'Centered close medium shot, straight-on camera. Changwuyu cups both hands around one single round fireball at chest height, shoulders tensed as he charges it. The orb is a crisp orange sphere with a bright yellow-white core; a tight circular ring of compressed flame wraps around it, and the glow lights his face and gloves. Show the orb swelling larger between his hands, not multiple projectiles; face, eyes and round fireball both read clearly at thumbnail size.',
  'flat dark muted violet', 'one mage, exactly one spherical fireball, one thin circular charge ring'),
 ('cmtn1r10xnl1','spell-cmtn1r10xnl1','黑暗形态',
  'Dramatic profile-to-three-quarter shot, camera at eye level. Changwuyu turns sharply toward the viewer as a single deep-violet shadow cloak unfurls behind him like a wing, sweeping from left to right. One side of his face stays softly lit so his amber eye, glasses and silver hair remain recognizable; the other side merges into a clean black-violet silhouette. A small blank pale card-shaped glint floats beside his raised hand, secondary and simple. No flames, no pendant, no busy particles.',
  'flat pale cool lavender', 'one mage, one broad shadow-cloak shape, one small blank card glint'),
 ('tt3-flame-storm','spell-tt3-flame-storm','风暴火球',
  'Wide horizontal tracking composition, camera level with the action. Changwuyu pivots through a sweeping side step and throws his arm across the frame. Exactly three separate bright spherical fireballs travel on three broad parallel arcs from left to right, each clearly aimed at one of three small enemy silhouettes spaced across the right side. Every projectile has a round orange body, bright core and short tail; show one orb per target, no extra sparks or duplicates.',
  'flat deep muted plum', 'exactly three spherical fireballs and exactly three small enemies, one mage'),
 ('tt3-nuke-ray','spell-tt3-nuke-ray','致命射线',
  'Compressed over-the-shoulder view aligned along Changwuyu’s pointing arm. He stands steady in the left foreground and extends one finger; a single hair-thin straight violet-white ray cuts horizontally across the image into one enemy at far right. At the point of impact, exactly three small dark-violet curse brands appear on the enemy. Keep the ray ruler-straight and the composition sparse, with the mage’s face in partial profile and amber eye visible; no fire, no explosion, no branching beams.',
  'flat cool light gray', 'one mage, one thin straight ray, one enemy, exactly three small curse marks'),
]

EXTRA_UC=(
 'text, lettering, watermark, signature, logo, frame, border, UI, collage, multiple views, '
 'gradient background, textured background, scenery, random particles, extra characters, extra arms, extra limbs, '
 'wrong hat, ordinary hat, red eyes, blue eyes, missing glasses, '
 'blurry fingers, extra fingers, missing fingers, fused fingers, malformed hands, blurry eyes, '
 'abstract composition, indistinct action, tiny main subject, duplicate projectile, extra fireball, '
 'flat cel shading, smooth airbrush, no brush texture, clean closed lineart, plastic texture, waxy texture'
)

manifest=[]
for i,(card_id,filename,title,action,bg,shape) in enumerate(CARDS,1):
    scene=(
      'Small horizontal 1.32:1 collectible game-card illustration, no card frame, no interface and no lettering. '
      'Single readable storyboard moment with a clear foreground, action direction and focal subject; waist-up or three-quarter hero scale, face visible, spell silhouette legible at thumbnail size. '
      f'{shape}. Camera and action: {action} '
      f'Background is one perfectly flat solid color, {bg}, uniform edge to edge with no gradient, texture, scenery, floor or cast shadow. '
      'Use the approved v1.0 painterly sketch recipe: confident broad planes, visible varied brushstrokes, broken outer edges, crisp selective highlights, painterly rather than vector-clean rendering.'
    )
    subject='1man, solo main hero, ' + CHAR + ' ' + action
    prompt=nai_style.build_prompt(subject,scene)
    uc=nai_style.build_uc(EXTRA_UC)
    seed=random.randint(1,2**32-1)
    payload={
      'input':prompt,'model':'nai-diffusion-5-full','action':'generate',
      'parameters':{
        'params_version':3,'width':1216,'height':832,'scale':6.5,'steps':28,'n_samples':1,
        'ucPresetId':'none','qualityPresetId':'none','qualityToggle':False,'negative_prompt':uc,
        'sampler':'k_euler_ancestral','seed':seed,'decrisper':False,
        'deliberate_euler_ancestral_bug':False,'prefer_brownian':True,'karras':True,
        'cfg_rescale':0.0,'variety_plus':True,'texture_transform':False,'autoSmea':True,
        'straight_alpha':False,'legacy_v4_extend':False,'legacy_uc':False,
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
