"""Generate missing transition candidates through the existing guarded NAI client."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
OUTPUT = PROJECT.parent / '.tmp' / 'nai' / 'missing-transition-nai45-20261021'
MODEL = 'nai-diffusion-4-5-full'
SPECS = [
    ('emergency-exit', '紧急撤离点前置', 'A single cyan emergency beacon beside a broad dark service doorway in a deserted futuristic city at night. A simple recessed rectangular doorway, one low illuminated signal strip, a continuous wet concrete floor. Only two or three coherent urban building silhouettes beyond. The beacon and doorway are on the right half; no people or vehicles.', 'muted charcoal and deep blue gray, restrained pale cyan signal, soft teal reflection'),
    ('event', '事件前置', 'A quiet unfamiliar signal in a deserted futuristic city at night: one small amber light on a simple sealed urban utility box, a wide empty street surface and two broad modern building masses fading into haze. The box and light are on the right half. A suggestion of mystery, no literal story props, no humans.', 'cold ink blue and dark chromatic gray, one small muted amber accent, still dim atmosphere'),
    ('layer-passage', '跨层通路', 'An abstracted transition between levels inside a dark futuristic city: one broad continuous inclined urban passage leading past a simple rectangular wall opening, a few large aligned concrete and metal planes. Three-quarter perspective, the opening on the right half, only a narrow distant cold light. No complex stairs, no elevated rail networks.', 'deep blue black, steel gray and desaturated teal, a thin cold light beyond the passage, dim coherent space'),
    ('map-return', '返回地图继续探索', 'An abstracted overview of a dark futuristic city district at night, a continuous street junction suggested by three broad ground planes and a few compact silhouettes of modern buildings. A single quiet cold light along the right street edge. No literal map, no diagram, no floating panels, no aerial road networks.', 'charcoal blue shadows, muted green gray ground, a very small pale cyan accent, subdued nocturnal atmosphere'),
    ('loading', '基地选人菜单加载等待', 'A sheltered dark futuristic city waiting space, represented by a broad flat concrete wall, a simple horizontal metal ledge and one recessed cyan wall lamp on the right. A faint distant city silhouette beyond a single broad rectangular gap. Sparse connected architectural masses, calm and nearly abstract.', 'deep charcoal blue, muted chromatic gray, one soft cyan light, very restrained contrast, dark stillness'),
    ('expedition-start', '启程初入', 'Leaving shelter into a dark futuristic city before dawn: one broad empty paved path continuing past a simple modern rectangular shelter opening toward two distant urban silhouettes. The opening and focal cold horizon sit on the right half. Large coherent shapes, minimal architectural detail, a quiet beginning, not a sunny vista.', 'ink blue and charcoal, muted pale gray blue horizon, tiny soft warm glimmer far away, shadowed foreground'),
    ('page-turn', '通用翻页过场', 'A near-abstract dark futuristic urban environment formed from three broad connected concrete and dark glass wall planes, a single narrow vertical cold light on the far right, and a quiet continuous ground plane. Suggest modern city architecture without literal detailed machinery. A restrained unoccupied space, no objects in foreground.', 'deep blue black and smoky chromatic gray, subdued blue green light at the right edge, low contrast grouped shadows'),
]

def request_for(index, spec):
    key, name, subject, light = spec
    prompt = build_asset_prompt(
        'scenery, no humans, dark futuristic city, ' + subject,
        purpose_layer='One cohesive hand-painted anime environment illustration for a short game transition. Urban, futuristic and dark. No interface or written words.',
        composition_layer='Wide quiet composition. The left third is a dark uncluttered connected plane reserved for a later UI title, but DO NOT draw that title. Main visual interest on the right half. Large opaque grouped color shapes, few selective hard edges, simplified perspective, continuous floor, attached shadows, only necessary readable architectural cues. Avoid little individual fragments, repeating tiny windows or decorative seams.',
        light_material_layer=light + '. Opaque block-painted surfaces, restrained directional brushwork, quiet backgrounds, consistent single light direction. Spatial continuity matters more than intricate detail.',
    )
    uc = build_uc('people, person, character, text, letters, numbers, watermark, signature, logo, interface, HUD, frame, collage, mountains, cliffs, canyon, wilderness, forest, medieval, gothic, castle, pillars, ancient ruins, bright daylight, sunny sky, dense pipes, complex bridges, impossible architecture, disconnected ground, floating platforms, debris fragments everywhere, detailed window grids, photorealistic, 3d render')
    seed = 102121100 + index
    return {
        'id': key, 'name': name, 'status': 'planned', 'generator': 'nai_gen.generate_image',
        'model': MODEL, 'width': 768, 'height': 512, 'seed': seed,
        'prompt': prompt, 'uc': uc,
        'request': build_payload(prompt, uc, width=768, height=512, seed=seed, model=MODEL),
        'output': str(OUTPUT / (key + '.png')),
    }

def main():
    if (EVIDENCE / 'superseded-by-large').exists():
        raise SystemExit('Small draft batch superseded by owner-authorized large format; no request sent')
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', required=True)
    args = parser.parse_args()
    index, spec = next((i, spec) for i, spec in enumerate(SPECS) if spec[0] == args.id)
    request = request_for(index, spec)
    record = EVIDENCE / (args.id + '.json')
    if record.exists():
        existing = json.loads(record.read_text(encoding='utf-8'))
        if existing.get('status') == 'generated':
            raise SystemExit('Already generated; refusing duplicate request')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('START ' + args.id, flush=True)
    try:
        out, seed = generate_image(request['prompt'], request['uc'], width=768, height=512,
                                   seed=request['seed'], model=MODEL, out=request['output'])
    except (SystemExit, Exception) as error:
        request['status'] = 'blocked'
        request['error'] = str(error)
        record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        raise SystemExit(str(error))
    data = Path(out).read_bytes()
    request.update(status='generated', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    record.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DONE ' + args.id, flush=True)

if __name__ == '__main__':
    main()
