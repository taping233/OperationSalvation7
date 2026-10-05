# -*- coding: utf-8 -*-
"""Generate dedicated small card art for the 17 live cards still using family fallback art."""
import json, random, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

ROOT=Path(r'D:\素材\代号柒\.tmp\nai')
OUT=ROOT/'output'/('missing-card-art-17-'+time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=True)
TOKEN=''
for line in (ROOT/'token.txt').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if line and not line.startswith('#'):
        TOKEN=line
        break
if not TOKEN: sys.exit('TOKEN_EMPTY')

# id, type, name, focal subject, storyboard/camera/action, visual effect and flat background
CARDS=[
('tt12-raydragon','spell','龙焰射线',
 'A dragon-shaped torrent of fire, with a clearly defined dragon head and jaws around a white-hot core.',
 'Low side-on close shot: the dragonfire beam surges diagonally from lower left to upper right and strikes one distant armored silhouette. The flame dragon head leads the ray, its jaw and mane made of layered brush-painted flame tongues.',
 'Molten gold core, red-orange flame scales and long wind-torn ribbons; solid deep teal background.'),
('tt12-sporewall','spell','孢子城墙',
 'A tall curved barricade of giant mushroom caps, thick roots and dense luminous spores.',
 'Low upward camera from the defender side. A dark attacker crashes against the living wall; a cloud of spores bursts outward along the point of impact while the wall holds firm. The wall dominates the frame as one strong vertical arc.',
 'Pale mint caps, jade-green spores and dark forest roots; solid muted wine-purple background.'),
('tt12-elemburst','spell','元素爆裂',
 'Four distinct elemental impacts erupt across a sparse battlefield: a blue ice burst, a red flame burst, a gold stone shock and a cyan wind slash.',
 'High oblique overhead view. The four compact bursts hit separate tiny enemy silhouettes in a staggered sequence from upper left to lower right. Keep each impact large and separated; no single merged explosion.',
 'Four restrained saturated element colors against one solid warm charcoal background.'),
('tt12-hitechrd','spell','高端研发',
 'A single pristine blank spell folio suspended over an arcane research bench, surrounded by a precise brass-and-glass calibration frame and two steadily shrinking crystal weights.',
 'Intimate three-quarter tabletop shot from above. A gloved researcher’s hand turns one brass dial; the folio glows brighter as three concentric calibration rings close inward. The folio is blank, with no writing or symbols.',
 'Cool lavender light, antique brass edges and one blue crystal; solid pale blue-gray background.'),
('tt12-barriermend','spell','屏障修复',
 'A large translucent blue-violet shield wall with a deep crack being stitched closed by bright lines of magic.',
 'Waist-up side view: a cloaked defender braces behind the shield and presses one hand to its damaged center. The fractured plates slide together visibly; the repaired half shines brighter than the cracked half.',
 'Crisp cyan repair seams and pale silver facets; solid muted terracotta background.'),
('tt12-saturate','spell','饱和打击',
 'One dense violet-white arcane impact bursting through the center of a single enemy’s guard.',
 'Canted low close-up at the instant of impact. The enemy is driven backward; a compact first shock ring expands, with a second smaller echo forming behind it to suggest a repeat strike. Keep one clear target and a decisive diagonal force.',
 'Deep indigo core, white center and restrained magenta fracture strokes; solid pale ochre background.'),
('tt12-felguard','spell','邪能护体',
 'A half-body sorcerer enclosed in a faceted black-violet ward, with three pale spell folios orbiting just outside it.',
 'Low three-quarter portrait. A red blade and a hooked curse chain strike the ward from opposite sides and ricochet away; the protected figure calmly raises one hand as the folios turn in the air. Face and ward silhouette stay clear.',
 'Black plum planes, violet edge light and small white highlights; solid muted sage-gray background.'),
('tt12-unstableray','spell','不稳定射线',
 'One thin, dangerously unstable blue-white ray with a single bright centerline and short angular deviations.',
 'Extreme oblique side view aligned along the beam toward one target at far right. The ray jitters in sharp controlled kinks and leaves brief afterimages before striking the target; keep it one continuous beam rather than branching lightning.',
 'Electric cyan and cold white against a solid dark rust background.'),
('tt12-infectray','spell','感染射线',
 'A narrow violet ray carrying one dark green spore cluster toward a single enemy.',
 'Over-the-shoulder view from behind a caster’s extended hand. The beam crosses the open space and seeds a small green-violet infection bloom at the target’s shoulder; a few large spores cling to the wound, clearly showing contagion rather than a generic hit.',
 'Ink violet beam, sickly green spores and pale face rim light; solid muted blue-gray background.'),
('tt12-basicdev','spell','基础开发',
 'Two simple blank spell folios taking shape above a compact wooden-and-brass workbench.',
 'Three-quarter high-angle workshop shot. A quill-like engraving tool draws two clean glowing outlines that become two separate blank folios; one is already complete while the other is still forming from brushlike strokes. No readable lettering or runes.',
 'Warm paper ivory, muted brass and a small blue spark; solid dark desaturated teal background.'),
('tt12-firecracker','spell','违禁烟火',
 'A fan of small traditional festival fireworks, each with a bright orange-red burst and a thin golden trail.',
 'Upward-looking wide composition. Several tiny enemy silhouettes are spaced along the lower edge while compact fireworks pop above and around them, one per area. The colorful sparks are deliberate flame-petal shapes, not a realistic battlefield explosion.',
 'Vermilion, amber and warm cream; solid deep blue-violet background.'),
('tt12-magicfind','spell','魔法新发现',
 'One blank spell folio selected from three hovering folios, its blue cost-glow dissolving into motes of light.',
 'Top-down close shot of a gloved hand reaching to take the chosen folio. Two unchosen folios recede softly; the selected one is large and bright in the foreground, with no text, numbers or printed symbols.',
 'Pale periwinkle light with one vivid cyan edge; solid muted dark plum background.'),
('tt12-chargeray','spell','充能射线',
 'A straight focused golden-white spell ray that grows brighter and thicker through three clear charge rings along its path.',
 'Side view at chest height. The ray shoots from a caster’s hand toward one target; three evenly spaced rings feed into it from behind, and the far end is visibly more powerful than the near end. Keep the beam straight and continuous.',
 'White-gold core, amber rings and subtle violet edges; solid cool pale gray background.'),
('tt12-breakthrough','spell','突破进展',
 'Three blank spell folios emerging in sequence from a single fractured blue crystal, each on a distinct step of a rising diagonal.',
 'Front three-quarter view with a strong staircase composition from lower left to upper right. The first folio is small and dim, the second mid-sized, the third large and luminous, making three different development tiers immediately countable.',
 'Icy cyan crystal, pale paper and deep cobalt shadows; solid muted warm mauve background.'),
('tt12-raygun','equip','射线枪',
 'A compact one-handed arcane ray pistol, clear recognizable gun silhouette, brass frame, dark grip and a large blue sapphire power cell.',
 'Dramatic first-person three-quarter close-up, the muzzle aimed from lower left toward upper right. One narrow cyan ray is firing from the sapphire chamber; focus on the crafted weapon and its glowing cell, with no hands obscuring the shape.',
 'Blue-white muzzle flare, aged brass and black steel; solid pale lavender background.'),
('tt12-backupcell','spell','后备能源',
 'A large faceted reserve-energy crystal inside a brass coil, visibly refilling from a dim lower chamber to a bright upper chamber.',
 'Macro three-quarter view of the crystal and its coil. Two blank spell folios rise beside it as stored energy streams upward through the rings; one empty socket at the bottom is refilling. Make the central battery the clear focal object.',
 'Violet crystal, pale gold coil and clean cyan energy; solid dark olive-gray background.'),
('tt12-freezeray','spell','冷冻射线',
 'One straight pale-cyan ray freezing a single enemy at the impact point, where sharp ice crystals bloom outward.',
 'Diagonal over-the-shoulder shot. The thin beam connects a caster’s gloved hand in the left foreground to one target at right; frost spreads from one bright impact point over the target’s armor in branching faceted plates. No broad ice cloud.',
 'Cold white, glacial cyan and deep navy accents; solid muted warm brown background.'),
]

UC_EXTRA=(
 'text, readable writing, numbers, watermark, signature, logo, card frame, border, interface, collage, multiple views, '
 'gradient background, textured scenery, extra characters, extra arms, malformed hands, '
 'abstract energy cloud, indistinct focal object, flat cel shading, smooth airbrush, no brush texture, '
 'clean closed lineart, plastic texture, waxy texture, blurry details'
)
manifest=[]
for i,(card_id,kind,title,focus,action,effect) in enumerate(CARDS,1):
    scene=(
      'Small horizontal 1.32:1 game-card illustration, no frame, no interface, no lettering. '
      f'Title concept: {title}. Main visual: {focus} Camera and action: {action} '
      f'Color and background: {effect} Background must be one flat solid color, no gradient, no scenery or floor. '
      'Single readable storyboard instant, one dominant silhouette, card-sized visual clarity. '
      'Use the approved v1.0 painterly sketch treatment: broad confident paint planes, visible varied brush marks, selected broken edges, crisp material highlights, no polished vector finish.'
    )
    prompt=nai_style.build_prompt(focus,scene)
    uc=nai_style.build_uc(UC_EXTRA)
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
        'v4_negative_prompt':{'caption':{'base_caption':uc,'char_captions':[]},'legacy_uc':False},'characterPrompts':[],
      },
    }
    pj=OUT/(card_id+'.payload.json')
    pj.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    zp=OUT/(card_id+'.zip')
    started=time.monotonic()
    print('REQUEST_START',i,'OF',len(CARDS),card_id,title,flush=True)
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
    png=OUT/(kind+'-'+card_id+'_'+str(seed)+'.png')
    with zipfile.ZipFile(zp) as zf: png.write_bytes(zf.read(zf.namelist()[0]))
    filename=('equip-' if kind=='equip' else 'spell-')+card_id+'.webp'
    manifest.append({'id':card_id,'kind':kind,'filename':filename,'name':title,'seed':seed,'size':[1216,832],'png':png.name,'prompt':prompt,'uc':uc})
    print('IMAGE_READY',i,'OF',len(CARDS),card_id,png.name,'SEED',seed,flush=True)
    if i<len(CARDS):
        wait=max(0,45-(time.monotonic()-started))
        if wait: print('WAIT_SECONDS',round(wait),flush=True); time.sleep(wait)
with (OUT/'manifest.json').open('w',encoding='utf-8') as f:
    json.dump({'requested':len(CARDS),'completed':len(manifest),'items':manifest},f,ensure_ascii=False,indent=2)
print('BATCH_DONE',len(manifest),'OF',len(CARDS),'OUTPUT',str(OUT),flush=True)
