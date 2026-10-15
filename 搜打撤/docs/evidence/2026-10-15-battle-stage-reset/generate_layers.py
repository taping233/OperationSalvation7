"""Three independent NAI scene drafts, using the existing guarded client."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
LAYERS = {
    'backdrop': dict(seed=10150151,
        subject='no humans, winter futuristic city transit district, broad modular buildings and elevated automated monorail tracks, pale slate blue sky, distant megastructures, tiny warm amber window accents, science fiction city, snow on horizontal roofs',
        purpose='Independent BACKGROUND layer of a side-view 2D card battle stage. Architecture and sky only, no foreground objects, no characters, no UI.',
        composition='Wide landscape 16:9. Fixed camera looking horizontally down a spacious transit plaza, horizon at 48 percent height. Buildings frame the left and right, central vista stays open. The bottom third is quiet distant blue haze, no close pavement.',
        light='Cold overcast winter daylight, readable large silhouettes, muted cool gray and blue masses, a few warm ochre accents, matte modern composite and concrete materials.',
        negative='people, person, character, medieval, castle, gothic arch, old brick factory, cobblestones, giant signs, logo, UI, close foreground, busy tiny detail'),
    'ground': dict(seed=10150152,
        subject='no humans, empty broad winter science fiction transit plaza pavement, matte dark slate composite slabs, thin snow banks only along extreme left and right edges, broad pale blue reflected skylight',
        purpose='Independent GROUND PLANE layer for a side-view 2D combat stage, architecture and sky will be supplied separately. Draw the floor only.',
        composition='Wide landscape 16:9. Camera horizon at 48 percent height. Upper half is blank plain white without architecture. Ground occupies lower half, extends beyond all bottom edges. Wide unobstructed horizontal standing area at 62 percent height. Gentle perspective slab joints converge at center horizon. No wall or raised platform.',
        light='Overcast cold blue daylight. Muted blue gray matte floor, broad calm painted value groups. Snow limited to side edges. No glossy wet reflections.',
        negative='people, person, character, buildings, skyline, furniture, railing, stairs, UI, cobblestone, heavy cracks, tiny paving, busy texture'),
    'foreground': dict(seed=10150153,
        subject='no humans, two sparse near-camera edge fragments from a winter futuristic transit plaza: a short dark modular railing base in the extreme lower left, a low snow-capped composite curb fragment at the extreme lower right',
        purpose='Independent FOREGROUND overlay layer for a 2D combat stage, only a few side-edge props. Background and ground will be supplied separately.',
        composition='Wide landscape 16:9, plain pure white empty background. Keep the entire central 78 percent of the image completely empty white. Objects only touch extreme left and right bottom corners and remain below the lowest third. No continuous floor strip, no arch, no top frame.',
        light='Cold blue gray matte material, restrained warm ochre edge accent, broad simple shadow masses, snow catches the same overcast winter skylight.',
        negative='people, person, character, city, skyline, scenery, landscape, full floor, full railing across center, center object, UI, text, ornate, foliage')
}

def prepare(name):
    spec = LAYERS[name]
    target = HERE / 'nai' / (name + '.png')
    receipt = HERE / ('nai-' + name + '.json')
    if receipt.exists():
        return receipt
    prompt = style.build_asset_prompt(spec['subject'], purpose_layer=spec['purpose'],
        composition_layer=spec['composition'], light_material_layer=spec['light'])
    uc = style.build_uc(spec['negative'])
    request = nai_gen.build_payload(prompt, uc, width=1344, height=768,
        seed=spec['seed'], char_prompts=[])
    record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
        cleanup_version=style.CLEANUP_VERSION, request=request, references=[],
        output=str(target.relative_to(ROOT)), method='NAI guarded client; separate layer draft, then built-in repaint')
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return receipt

def generate(name):
    receipt = prepare(name)
    record = json.loads(receipt.read_text(encoding='utf-8'))
    assert record['status'] == 'prepared', 'Do not repeat a generated or failed request.'
    request = record['request']
    params = request['parameters']
    output = ROOT / record['output']
    assert not output.exists(), 'Use a new candidate instead of overwriting.'
    try:
        path, seed = nai_gen.generate_image(request['input'], params['negative_prompt'],
            width=params['width'], height=params['height'], seed=params['seed'],
            model=request['model'], out=str(output), char_prompts=[])
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
        raise
    record.update(status='generated', seed=seed,
        sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('layer', choices=list(LAYERS) + ['all'])
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    names = list(LAYERS) if args.layer == 'all' else [args.layer]
    for name in names:
        if args.prepare_only:
            print(prepare(name), flush=True)
        else:
            generate(name)
