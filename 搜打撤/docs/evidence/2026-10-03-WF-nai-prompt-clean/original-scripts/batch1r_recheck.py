# -*- coding: utf8 -*-
"""批次1R：批次1自审FAIL 9张修句补跑（生物6+事件3）。
统一画风=nai_style painterly v1.0；路线B=亮调可读构图；免费档：1024x768 / 1216x832 / steps28。
豁免（老板令）：白塔职业卡/西部牛仔图/能力卡12/禁咒4/道具资源。
节奏：45s / 429停15min / 403停手；单张FAIL记账继续，末尾汇总。"""
import json, os, sys, time, random, subprocess, zipfile

sys.path.insert(0, r'D:\素材\代号柒\搜打撤\tools')
import nai_style

BASE = r'D:\素材\代号柒\.tmp\nai'
OUT = os.path.join(BASE, 'output', 'batch1r-' + time.strftime('%Y%m%d-%H%M%S'))
os.makedirs(OUT, exist_ok=True)
token = ''
with open(os.path.join(BASE, 'token.txt'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            token = line

BIO_W = 'full body single subject, large centered subject filling the frame, clear strong silhouette, clean crisp painterly illustration, isolated on plain pure white background, nothing else'
BIO_UC = 'background scenery, drop shadow, ground shadow, multiple views, collage, frame, text, watermark, wooden box, crate, chest, vehicle, tank, gloves, bandage'
SCENE_W = 'wide landscape composition, bright readable painterly illustration, clean bold shapes, soft directional light'
SCENE_UC = 'photograph, photorealistic, multiple views, collage, frame, dark murky, underexposed, text, watermark, briefcase, suitcase, toy blocks, colorful cubes'

BIO = [
    ('bio-patrol-soldier', 'futuristic urban patrol soldier with tactical armor helmet and rifle, standing ready pose'),
    ('bio-archer', 'futuristic soldier archer holding a compound bow, alert standing pose'),
    ('bio-scavenger', 'rebel scavenger with big backpack, goggles and salvage tools, patched coat'),
    ('bio-mobile-trooper', 'mobile assault trooper with jet-assist boots and compact carbine, mid-step pose'),
    ('bio-grenadier', 'rebel grenadier with a bandolier of grenades and launcher, sturdy stance'),
    ('bio-snow-wolf', 'large mutated snow wolf, snarling four-legged beast, pale silver-white fur, cold blue accents'),
    ('bio-shell-mutant', 'mutated creature with heavy chitin armor plates and sharp claws, hulking pose'),
    ('bio-ember-mutant', 'mutated creature with glowing molten cracks across its body, heat haze'),
    ('bio-acid-mutant', 'mutated creature dripping with corrosive acid, toxic green drips and burns'),
    ('bio-white-raven', 'a large white raven with spread wings, wings mid-flap'),
    ('bio-candle-spirit', 'a living candle flame spirit, small fiery wisp with a tiny face, warm glow'),
    ('bio-fungal-mutant', 'mutated creature overgrown with fungal growths and hanging tendrils'),
    ('bio-silence', 'a mute shrouded humanoid figure with bandaged face and stitched mouth, gray ragged cloth'),
    ('bio-echo', 'a ghostly translucent humanoid figure with sound ripple rings around it, pale blue glow'),
    ('bio-abyss-beast', 'colossal abyssal beast with massive jaws and horns, enormous boss monster, front view'),
    ('bio-purge-general', 'armored commander boss in a heavy military coat with cape and glowing energy blade'),
    ('bio-brood-mother', 'huge brood mother monster with egg sacs on her back and claw limbs'),
    ('bio-psychic-lord', 'psychic overlord boss floating with a cracked energy crown and crackling aura'),
    ('bio-infantry', 'simple infantry soldier with rifle and helmet, standing at ease'),
    ('bio-doom-gate', 'a monstrous doomsday gate made of flesh and bone with a glowing red maw, vertical doorway object'),
    ('bio-heaven-gate', 'a radiant celestial gate of white stone and golden light, vertical doorway object'),
    ('bio-seal-limb-1', 'a giant severed arm sealed with glowing runes and heavy chains'),
    ('bio-seal-limb-2', 'a giant severed forearm sealed with glowing rune bandages'),
    ('bio-seal-limb-3', 'a giant severed hand sealed with glowing runes and iron rings'),
    ('bio-seal-limb-4', 'a giant twisted severed limb wrapped in cursed bandages and rune chains'),
]
EVENT = [
    ('ev-tunnel-oath', 'a dim metro tunnel with a glowing red ritual blood circle on the tracks, candles at the edges'),
    ('ev-ambush-rain', 'a roadside barricade of barrels and barbed wire in heavy rain, lantern glow cutting the downpour'),
    ('ev-lab-ration', 'an abandoned laboratory bench with nutrient samples and petri dishes, cold clean light'),
    ('ev-cave-in', 'a collapsed mine entrance with fallen timbers and a tipped ore cart, dust in daylight beams'),
    ('ev-power-hammer', 'a heavy industrial power hammer crackling with bright electric arcs on a workbench'),
    ('ev-field-medic', 'a field medical tent with a stretcher and first-aid supplies, warm lamp light inside'),
    ('ev-toxic-drop', 'a supply crate with parachute landed in a glowing toxic green puddle, spill spreading'),
    ('ev-twin-safes', 'two reinforced safes side by side, one half-molten with dripping molten metal seams'),
    ('ev-last-drone', 'a delivery drone carrying a package, sweeping light over an empty street at dusk'),
    ('ev-cobbler', 'a cobbler stall in a narrow alley, shoes hung on the wall, warm lantern over the bench'),
    ('ev-defib', 'emergency defibrillator pads sparking with a bright electric arc, medical kit open below'),
    ('ev-pearl-box', 'an open jewelry box with lustrous pearls glowing softly on a dark wooden table'),
    ('ev-twin-smuggle', 'two hooded smugglers passing a sealed crate in an alley lit by twin flames'),
    ('ev-dark-ledger', 'a warehouse handover scene, crates stacked in shafts of light, a ledger clipboard in front'),
    ('ev-glitch-terminal', 'a glitching terminal panel rewriting luminous code fragments into the air'),
    ('ev-market-stall', 'a sheltered market stall selling rows of glowing potion bottles, warm daylight through awning'),
    ('ev-seawall-quiver', 'arrows stuck in a straw target by a seawall, bright sea sky behind'),
    ('ev-underground-bazaar', 'an underground mall bazaar with hanging bulbs and stalls, bright readable interior'),
    ('ev-requisition', 'an official requisition notice parchment pinned onto a wooden weapon crate, wax seal'),
]
TASKS = [('bio', n, 1024, 768, s) for n, s in [
    ('bio-candle-spirit', 'tiny living flame spirit creature with a cute face and little arms, warm orange glow, small wisp body'),
    ('bio-echo', 'a ghostly humanoid figure made of visible pale blue spirit energy with a solid glowing body, sound ripple rings around it'),
    ('bio-infantry', 'an infantry soldier on foot with rifle and combat helmet, human full body standing pose'),
    ('bio-seal-limb-1', 'a giant severed stone-pale hand wrapped in glowing red rune chains, fantasy severed limb relic'),
    ('bio-seal-limb-2', 'a giant severed pale forearm wrapped in glowing red rune chains, fantasy severed limb relic'),
    ('bio-seal-limb-3', 'a giant severed pale hand with iron rings and glowing red runes, fantasy severed limb relic'),
    ('bio-seal-limb-4', 'a giant twisted severed pale limb bound by glowing red rune chains, fantasy severed limb relic'),
]] + [('ev', n, 1216, 768 if False else 832, s) for n, s in [
    ('ev-defib', 'an open defibrillator device with two glowing control pads and a bright electric spark arc, medical kit around'),
    ('ev-glitch-terminal', 'a futuristic terminal screen with glitching holographic code fragments flying off, luminous data shards'),
    ('ev-seawall-quiver', 'a straw target butt with many arrows stuck in it standing by a stone seawall, bright sea sky'),
]]
MIN_INTERVAL_S = 45
FAILS = []


def gen(kind, name, w, h, subject):
    if kind == 'bio':
        prompt = nai_style.build_prompt(subject + ', ' + BIO_W, '')
        uc = nai_style.build_uc(BIO_UC)
    else:
        prompt = nai_style.build_prompt(subject, SCENE_W)
        uc = nai_style.build_uc(SCENE_UC)
    seed = random.randint(1, 2 ** 32 - 1)
    payload = {
        'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
        'parameters': {
            'params_version': 3, 'width': w, 'height': h, 'scale': 6.5, 'steps': 28,
            'n_samples': 1, 'ucPresetId': 'none', 'qualityPresetId': 'none', 'qualityToggle': False,
            'negative_prompt': uc, 'sampler': 'k_euler_ancestral', 'seed': seed,
            'decrisper': False, 'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True,
            'karras': True, 'cfg_rescale': 0.0, 'variety_plus': True, 'texture_transform': False,
            'autoSmea': True, 'straight_alpha': False, 'legacy_v4_extend': False, 'legacy_uc': False,
            'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []},
                          'use_coords': False, 'use_order': True},
            'v4_negative_prompt': {'caption': {'base_caption': uc, 'char_captions': []},
                                   'legacy_uc': False},
            'characterPrompts': [],
        },
    }
    pj = os.path.join(OUT, name + '.payload.json')
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    zp = os.path.join(OUT, name + '.zip')
    code = ''
    for attempt in range(3):
        ok = False
        for tag, extra in (('direct', ['--noproxy', '*']), ('socks', ['-x', 'socks5h://127.0.0.1:7890'])):
            r = subprocess.run(['curl'] + extra + ['--ssl-no-revoke', '--max-time', '180', '-sS',
                                '-w', '%{http_code}', '-o', zp, '-X', 'POST',
                                '-H', 'Authorization: Bearer ' + token,
                                '-H', 'Content-Type: application/json',
                                '--data-binary', '@' + pj,
                                'https://image.novelai.net/ai/generate-image'],
                               capture_output=True, text=True, timeout=220)
            code = (r.stdout or '').strip()[-3:]
            if code in ('200', '201'):
                ok = True
                break
            if code == '403':
                sys.exit('403_STOP')
            if code == '429':
                print('429 wait 15min', flush=True)
                time.sleep(900)
                break
            time.sleep(10)
        if ok:
            break
    else:
        print('FAIL', name, 'code=' + str(code), flush=True)
        FAILS.append(name)
        return
    png = os.path.join(OUT, name + '_%d.png' % seed)
    try:
        with zipfile.ZipFile(zp) as z:
            data = z.read(z.namelist()[0])
        open(png, 'wb').write(data)
        print('OK', name, seed, flush=True)
    except Exception as e:
        print('ZIPERR', name, e, flush=True)
        FAILS.append(name)


for i, (kind, name, w, h, subject) in enumerate(TASKS):
    if i > 0:
        time.sleep(MIN_INTERVAL_S)
    gen(kind, name, w, h, subject)

print('FAILS', json.dumps(FAILS), flush=True)
print('ALLDONE', OUT, flush=True)
