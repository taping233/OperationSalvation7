# -*- coding: utf-8 -*-
"""Regenerate all 12 Changwuyu profession card illustrations in approved v16 painterly style."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style
ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
STAMP=time.strftime('%Y%m%d-%H%M%S')
OUT=ROOT/'output'/('changwuyu-profession-cards-v16-'+STAMP)
OUT.mkdir(parents=True,exist_ok=True)
TOKEN=''
with (ROOT/'token.txt').open(encoding='utf-8') as f:
    for line in f:
        line=line.strip()
        if line and not line.startswith('#'):
            TOKEN=line
            break
if not TOKEN:
    sys.exit('TOKEN_EMPTY')
CHAR=(
    'Changwuyu, an elegant mysterious male mage with amber-yellow eyes clearly visible behind thin round metal glasses, '
    'one pointed ear, silver-gray long hair gathered in a low bun with long side locks, a black witch hat with a long curved tip bending and drooping to the right and a broad brim with deep purple underside. '
    'He wears a black high-collar robe with gold edging, black gloves, and a flowing cloak opened to show a pale-lavender-to-deep-purple lining. '
    'A white feather ornament and a blue sapphire in a gold clasp are pinned on his left chest. Keep his recognizable face and signature costume readable.'
)
# id, filename, Chinese title, action, solid background color description, extras
CARDS=[
 ('tt3sp-shadowshot','spell-tt3sp-shadowshot','暗影射击',
  'He snaps one narrow black-violet shadow bolt from his left hand into one cursed enemy at the right; a second parallel bolt follows the first to show the curse-triggered extra shot. One small purple curse mark is visible on the target. The spell path is a clean, readable diagonal.',
  'solid muted lavender-gray background', 'exactly two figures, one mage and one enemy'),
 ('tt7-burnharvest','spell-tt7-burnharvest','爆燃火球',
  'He launches one large brilliant orange fireball from his left palm toward one enemy at the right. Show a clearly round incandescent core, a short flame tail, and one bright impact flare; the fireball is the dominant simple shape.',
  'solid dark plum background', 'exactly two figures, one mage and one enemy'),
 ('tt7-twinfireball','spell-tt7-twinfireball','三重火球',
  'He conjures exactly two distinct orange fireballs above his open gloved palm, each a clean round ember with a short flame tail, ready to enter his hand as two new spells. Large simple spheres, clear separation, no target needed.',
  'solid muted violet background', 'one mage, exactly two fireballs'),
 ('tt7-abysscurse','spell-tt7-abysscurse','深渊诅咒',
  'He casts one compact mass of solid black ink-mist from his palm; it wraps one enemy at the right and a single bright violet curse seal marks the chest impact. The curse effect is one bold shape, no extra sigils or secondary props.',
  'solid pale mauve-lavender background', 'exactly two figures, one mage and one enemy'),
 ('tt7-meteorstrong','spell-tt7-meteorstrong','星陨之力',
  'He directs exactly three large orange fireballs in a descending arc onto one enemy. Each is a distinct round meteor with a short fiery tail; the three impacts read as one coordinated spell, not a field of tiny sparks.',
  'solid deep indigo-violet background with a clear light rim around the mage', 'exactly two figures, one mage and one enemy'),
 ('tt7-darkfort','equip-tt7-darkfort','黑暗吊坠',
  'He presents one small black-violet pendant with a gold rim and a dark jewel at his chest. A single clean violet-black protective shell surrounds him as one incoming crimson strike breaks against it, showing immunity to a fatal blow. Make the pendant and his face large and immediately readable.',
  'solid muted lavender background', 'one mage, one pendant, one protective shell'),
 ('cmtn1gfhczzj','spell-cmtn1gfhczzj','厄运',
  'He draws one sharp black curse technique out of a dense palm-sized ink-mist knot; it takes the form of one clear violet-black spell sigil above his hand, ready to become a curse move. Focus on the moment the spell takes shape, with no menu, no cards, and no extra targets.',
  'solid pale violet-gray background', 'one mage, one curse sigil'),
 ('cmtn1lbhbqi4','spell-cmtn1lbhbqi4','充能火球',
  'He compresses one orange fireball between his gloved hands. The fireball is visibly charging and growing brighter, with one simple circular heat ring around its crisp round core; no additional fireballs.',
  'solid deep muted violet background', 'one mage, one fireball'),
 ('cmtn1ntxzoc4','spell-cmtn1ntxzoc4','火焰形态',
  'He enters a fire-enhanced form: a restrained orange flame outline wraps his black-purple cloak and one bright orange fireball forms above his open palm. Keep his face, amber eyes, glasses, and silhouette clearly visible; one simple aura, no explosion.',
  'solid dark aubergine background', 'one mage, one fireball'),
 ('cmtn1r10xnl1','spell-cmtn1r10xnl1','黑暗形态',
  'He enters a dark form as a single deep-violet shadow mantle opens behind his black robe; from one small shadow portal, one large blank card silhouette rises beside his hand to represent the extra discovery option. Keep the shape count low and the card entirely blank.',
  'solid pale muted lavender background', 'one mage, one blank card silhouette'),
 ('tt3-flame-storm','spell-tt3-flame-storm','风暴火球',
  'He sweeps his hand across the scene and releases exactly three large orange fireballs, each flying toward one of three small enemy silhouettes on the right. Three distinct targets, one fireball per target, broad simple arcs and no extra projectiles.',
  'solid deep muted plum background', 'exactly four figures, one mage and three simple enemies'),
 ('tt3-nuke-ray','spell-tt3-nuke-ray','致命射线',
  'He fires one straight, narrow violet-white magical ray into one enemy at the right. At the impact, exactly three small distinct black-violet curse brands appear around the target; the ray and the three brands are the only spell effects.',
  'solid pale gray-lavender background', 'exactly two figures, one mage and one enemy'),
]
EXTRA_UC=(
 'text, lettering, watermark, signature, logo, frame, border, UI, collage, multiple views, '
 'gradient background, textured background, scenery, random particles, extra characters, extra arms, extra limbs, '
 'wrong hat, ordinary hat, red eyes, blue eyes, missing glasses, fireball on curse cards, black mist on fireball cards, '
 'blurry fingers, extra fingers, missing fingers, fused fingers, blurry eyes'
)
manifest=[]
for i,(card_id,filename,title,action,bg,shape) in enumerate(CARDS,1):
    scene=(
      'Small horizontal 1.32:1 game-card illustration, no card frame, no user interface, no lettering. '
      'Large centered composition, the character occupies most of the card, face visible, effect silhouette readable as a thumbnail. '
      f'{shape}. {action} '
      f'The entire background is one perfectly flat solid color: {bg}; uniform fill edge to edge, without gradient, texture, scenery, floor, or background shadow. '
      'Keep all major shapes within the central safe area.'
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
    with pj.open('w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
    zp=OUT/(card_id+'.zip')
    start=time.monotonic()
    print('REQUEST_START',i,'OF',len(CARDS),card_id,flush=True)
    r=subprocess.run([
      'curl','--noproxy','*','--ssl-no-revoke','--max-time','180','-sS','-w','%{http_code}',
      '-o',str(zp),'-X','POST','-H','Authorization: Bearer '+TOKEN,
      '-H','Content-Type: application/json','--data-binary','@'+str(pj),
      'https://image.novelai.net/ai/generate-image'
    ],capture_output=True,text=True,timeout=220)
    code=(r.stdout or '').strip()[-3:]
    if code=='403':
      print('STOP_HTTP_403',card_id,flush=True); break
    if code=='429':
      print('STOP_HTTP_429_WAIT_15_MINUTES',card_id,flush=True); break
    if code not in ('200','201'):
      print('STOP_HTTP_ERROR',code or 'NO_CODE',card_id,(r.stderr or '')[-250:],flush=True); break
    png=OUT/(filename+'_'+str(seed)+'.png')
    with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
    item={'id':card_id,'filename':filename+'.webp','name':title,'seed':seed,'size':[1216,832],'png':png.name,'prompt':prompt,'uc':uc}
    manifest.append(item)
    print('IMAGE_READY',i,'OF',len(CARDS),card_id,png.name,'SEED',seed,flush=True)
    if i<len(CARDS):
      remain=max(0,45-(time.monotonic()-start))
      if remain: print('WAIT_SECONDS',round(remain),flush=True); time.sleep(remain)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'requested':len(CARDS),'completed':len(manifest),'items':manifest},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',len(manifest),'OF',len(CARDS),'OUTPUT',str(OUT),flush=True)
