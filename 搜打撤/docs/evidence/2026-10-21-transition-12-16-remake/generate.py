"""Five newly commissioned NAI4.5 drafts; one request per subject, shared guard."""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import build_payload, generate_image
from nai_prompt_clean import build_asset_prompt, build_uc, RECIPE_VERSION

HERE = Path(__file__).resolve().parent
OUT = PROJECT.parent / '.tmp/nai/transition-12-16-remake-1021'
MODEL = 'nai-diffusion-4-5-full'
SPECS = [
    ('12-emergency-exit', '紧急撤离点',
     'scenery, no humans, a futuristic emergency evacuation station on an abandoned winter city rooftop, a reinforced rectangular shelter door on the right, a short solid landing platform with safety railing, one tall cyan signal mast attached to the shelter, snow collected at edges, distant high rise silhouettes beneath dark overcast sky',
     'cold slate blue concrete and steel, one cyan signal lamp lighting the doorway and a small patch of damp floor, clear physical access to refuge'),
    ('13-event', '事件入口',
     'scenery, no humans, an isolated public communication terminal in a deserted futuristic winter city, a tall solid metal terminal beneath a small angular concrete canopy on the right, a blank amber glass screen and an attached telephone receiver, one loose cable connected to the base, empty snow edged pedestrian plaza, simple modern building silhouettes',
     'cold blue gray plaza, amber screen as the only warm focal light, mysterious quiet encounter, no market stall'),
    ('14-layer-passage', '跨层移动',
     'scenery, no humans, a broad descending service ramp entering a lower level of an abandoned futuristic city, reinforced concrete retaining walls and one heavy rectangular steel threshold on the right, a single muted red warning light above the threshold, continuous connected road and simple railing, sparse snow outside the tunnel, distant upper city blocks',
     'charcoal blue and muted concrete gray, thin vermilion warning light, cold light outside and dark depth inside, readable descending architecture'),
    ('15-map-return', '返回探索',
     'scenery, no humans, elevated three quarter view of a quiet T junction in an abandoned futuristic winter city, a broad service road curves away between simple modern blocks on the right, a short broken cyan guidance strip embedded in the curb, one low concrete barrier in the foreground, snow gathered along sidewalks, distant skyline in cold haze',
     'steel blue and gray green streets, small cyan curb light, readable junction and direction of exploration, calm wide street shapes'),
    ('16-loading', '共用加载等待',
     'scenery, no humans, a sheltered waiting room inside a futuristic survivor base, on the right a single simple metal bench beneath a large rectangular warm ceiling light, one closed travel case rests beside the bench, broad dark window reveals a distant snowy city, intact concrete walls and flat floor, quiet practical modern interior',
     'muted gray teal interior, soft ivory amber light on bench and floor, cold blue city through window, peaceful pause before departure'),
]

for index, (key, name, subject, light) in enumerate(SPECS):
    prompt = build_asset_prompt(subject,
        purpose_layer='wide game transition illustration, abandoned dark future city in winter, strong single focal idea',
        composition_layer='wide cinematic framing, main focal structure on right half, quiet darker left third reserved for title overlay, believable perspective, continuous ground, a few large architectural shapes, selective details',
        light_material_layer=light)
    uc = build_uc('people, text, letters, numbers, signs, logo, watermark, UI, collage, medieval, gothic, castle, ancient stone columns, mountains, wilderness, wooden stall, market stall, tent, dense machinery, floating structures, impossible perspective, excessive tiny rubble, photorealistic, 3d render')
    seed = 102121650 + index
    output = OUT / f'{key}-nai45.png'
    record_path = HERE / f'{key}-nai-request.json'
    if record_path.exists():
        old = json.loads(record_path.read_text(encoding='utf-8'))
        if old.get('status') == 'generated' and output.exists():
            print('SKIP ' + key, flush=True)
            continue
        raise SystemExit('Existing non-success request; inspect before retry: ' + key)
    record = dict(id=key, name=name, status='prepared', recipeVersion=RECIPE_VERSION,
                  request=build_payload(prompt, uc, width=1344, height=768, seed=seed, model=MODEL, char_prompts=[]),
                  output=str(output))
    def save():
        record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    save()
    print('START ' + key, flush=True)
    try:
        result, _ = generate_image(prompt, uc, width=1344, height=768, seed=seed,
                                   model=MODEL, out=output, char_prompts=[])
    except BaseException as error:
        record.update(status='failed', error=str(error))
        save()
        raise
    record.update(status='generated', sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
    save()
    print('DONE ' + key, flush=True)
