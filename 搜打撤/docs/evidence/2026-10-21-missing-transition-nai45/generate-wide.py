"""Owner-selected 1344x768 NAI4.5 candidates; reuse project recipe and guard."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_prompt_clean import build_asset_prompt, build_uc, RECIPE_VERSION

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp/nai/missing-transition-nai45-20261021/wide'
MODEL = 'nai-diffusion-4-5-full'
SPECS = [
    ('emergency-exit', '紧急撤离点前置',
     'a deserted emergency extraction bay in a futuristic megacity at night, one open rectangular shelter outlined by a cyan beacon, its long diagonal reflection crosses an empty wet plaza, a few immense urban silhouettes enclosing the space, emergency refuge, no vehicles',
     'charcoal blue masses, concentrated pale cyan light, restrained teal reflection, shelter on the right'),
    ('event', '事件前置',
     'a mysterious abandoned broadcast kiosk in a dark futuristic city, a single tall blank amber screen hovering just above its solid base beneath a broad concrete awning, warm light reflected as a wide ribbon on empty rain-dark pavement, silent modern city masses, no writing on the screen',
     'cold navy gray city, one warm amber rectangle, soft reflected gold, kiosk on the right'),
    ('layer-passage', '跨层通路',
     'a single broad continuous ramp passing between colossal modern city blocks into a narrow rectangular opening, futuristic urban infrastructure, enormous quiet architectural masses, a thin horizontal red light marks the far threshold, empty rain-dark road, depth expressed with just three overlapping planes',
     'deep blue black, steel gray, one narrow muted vermilion threshold, perspective toward the right'),
    ('map-return', '返回地图继续探索',
     'a slightly elevated view of a quiet crossroads in a dark futuristic city, three broad streets form a readable junction between simple blocklike buildings, a curved band of cyan light traces one street edge like a route home, coherent empty streets, a few distant windows',
     'ink blue city, gray green wet paving, a restrained cyan curved light, focal junction on the right'),
    ('loading', '基地选人菜单加载等待',
     'a sheltered waiting atrium in a dark futuristic city, one large circular overhead light seen obliquely creates an oval pool on a continuous floor, broad black glass wall reveals a faint distant urban skyline, a few solid architectural planes, quiet contemplative sci-fi space',
     'charcoal violet and deep blue glass, one soft ivory overhead glow on the right, low contrast shadows'),
    ('expedition-start', '启程初入',
     'view from beneath a broad modern shelter into a vast dark futuristic city before dawn, an empty continuous road leads between two monumental urban silhouettes toward a narrow cold horizon, a small warm street light near the threshold, grand quiet scale, an invitation into the city',
     'deep navy shadows, smoky blue horizon, one tiny muted amber lamp, opening on the right'),
    ('page-turn', '通用翻页过场',
     'near abstract futuristic city architecture, three large overlapping dark glass and concrete planes suggesting a corner turning into another urban space, a single thin blade of pale gold reflected light runs vertically along the far right edge, continuous broad floor, elegant empty modern space',
     'blue black and smoky gray planes, a restrained champagne gold edge on the right, quiet large shadow shapes'),
]

def make_request(index, spec):
    key, name, subject, light = spec
    prompt = build_asset_prompt(
        'scenery, no humans, dark futuristic city, ' + subject,
        purpose_layer='game transition environment illustration, a distinctive simple visual idea, cohesive hand-painted anime scenery',
        composition_layer='wide cinematic composition, dark quiet left third reserved for a later title, main subject on right, large connected opaque color blocks, selective hard edges, simple believable perspective, continuous ground, few details',
        light_material_layer=light + ', consistent attached shadows, expressive broad painted shapes, restrained focal highlights',
    )
    uc = build_uc('people, text, letters, numbers, logo, watermark, HUD, interface, collage, mountains, cliffs, wilderness, forest, medieval, gothic, castle, ancient ruins, bright daylight, sunny sky, dense machinery, dense pipes, complex bridges, floating roads, disconnected ground, impossible architecture, excessive debris, tiny window grids, photorealism, 3d render')
    seed = 102121200 + index
    return dict(id=key, name=name, status='planned', model=MODEL, recipeVersion=RECIPE_VERSION,
                width=1344, height=768, seed=seed, prompt=prompt, uc=uc,
                request=build_payload(prompt, uc, width=1344, height=768, seed=seed, model=MODEL),
                output=str(OUTPUT / (key + '.png')))

def generate_one(index, spec):
    request = make_request(index, spec)
    record = EVIDENCE / ('wide-' + request['id'] + '.json')
    if record.exists() and json.loads(record.read_text(encoding='utf-8')).get('status') == 'generated':
        print('SKIP already generated ' + request['id'], flush=True)
        return
    record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('START wide ' + request['id'], flush=True)
    try:
        out, _ = generate_image(request['prompt'], request['uc'], width=1344, height=768,
                                seed=request['seed'], model=MODEL, out=request['output'])
    except (SystemExit, Exception) as error:
        request.update(status='blocked', error=str(error))
        record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        raise SystemExit(str(error))
    data = Path(out).read_bytes()
    request.update(status='generated', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE wide ' + request['id'], flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--id')
    args = parser.parse_args()
    for index, spec in enumerate(SPECS):
        if args.id is None or args.id == spec[0]:
            generate_one(index, spec)

if __name__ == '__main__':
    main()
