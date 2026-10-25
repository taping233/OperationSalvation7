"""One authorized NAI environment draft; shared client and guard remain authoritative."""
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))

from nai_gen import MODEL, build_payload, generate_image
from nai_prompt_clean import RECIPE_VERSION, build_asset_prompt, build_uc

OUTPUT = PROJECT / 'game/art-source/battle-journey-1023/nai-winter-transit-draft.png'
REQUEST = EVIDENCE / 'request.json'
RECEIPT = EVIDENCE / 'receipt.json'
SEED = 10232301


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    if OUTPUT.exists() or REQUEST.exists() or RECEIPT.exists():
        raise SystemExit('Draft or evidence already exists; stop without overwriting or regenerating.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prompt = build_asset_prompt(
        'scenery, no humans, an elevated urban interchange platform at the outer edge of a futuristic city in winter. '
        'A broad continuous walkable platform of matte engineered stone and concrete. '
        'Layered city buildings and elevated rail infrastructure in the distance. '
        'A restrained modern metal canopy with narrow supporting columns only at the extreme left and right edges. '
        'A few warm amber station lights, snow gathered only along the platform edges.',
        purpose_layer=(
            'One complete side-view game battle environment for a 2D anime card battle game. '
            'A tangible, grounded urban place with believable weight-bearing architecture, clear construction, '
            'material thickness and contact between the canopy, columns and platform.'
        ),
        composition_layer=(
            'Single wide horizontal landscape image, no panels or storyboard. '
            'A calm side-on camera with a continuous horizontal fighting surface, not a deep view down a corridor. '
            'The platform rear edge is at about 56 percent of the canvas height; its front edge is at about 73 percent; '
            'the future character footline is around 68 percent. '
            'Keep the central 80 percent of the image unobstructed for combat, with quiet negative space behind future figures and HUD. '
            'Canopy eaves and narrow supports frame only the extreme edges. '
            'Show distant sky, city and rails as distinct overlapping depth planes. '
            'The platform has a visible solid fascia and structural base; it is not a floating slab. '
            'Restrained asymmetric composition, clear large silhouettes and broad connected masses of light and shade.'
        ),
        light_material_layer=(
            'Cold cyan-gray winter sky and steel-blue architectural shadow masses, with a few restrained warm amber lamps. '
            'Hand-painted 2D material design: matte mineral paving, painted structural metal and thin wet ice have distinct broad painted responses. '
            'Subtle icy damp reflections only on a few flat ground planes, snow only at edges. '
            'Use economical opaque brush planes and selective crisp structural edges, with quieter softer distant shapes. '
            'Rich spatial depth and clear contact shadows without dense texture or small scratches. '
            'Keep the city readable instead of dissolving the whole image into uniform gray mist.'
        ),
    )
    uc = build_uc(
        'person, people, character, enemy, creature, crowd, interface, HUD, cards, text, lettering, sign, logo, '
        'photorealistic, photograph, 3d render, CGI, glossy plastic, floating platform, floating building, '
        'dense details, excessive texture, rubble piles, cable web, many small objects, dense snowfall, '
        'snow-covered fighting surface, thick fog, whiteout, central pillar, obstructions in center, '
        'multiple panels, split screen, fisheye, extreme perspective, deep corridor perspective'
    )
    parameters = dict(width=1344, height=768, seed=SEED, char_prompts=[])
    payload = build_payload(prompt, uc, **parameters)
    write_json(REQUEST, payload)
    receipt = {
        'status': 'prepared',
        'startedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'model': MODEL,
        'recipeVersion': RECIPE_VERSION,
        'seed': SEED,
        'size': [1344, 768],
        'referenceUploads': [],
        'request': str(REQUEST),
        'requestSha256': hashlib.sha256(REQUEST.read_bytes()).hexdigest(),
        'output': str(OUTPUT),
        'singleCall': True,
        'client': 'tools/nai_gen.py',
        'guard': 'tools/nai_guard.py',
    }
    write_json(RECEIPT, receipt)
    try:
        output, seed = generate_image(prompt, uc, out=OUTPUT, **parameters)
    except (Exception, SystemExit) as error:
        receipt.update(status='failed', error=str(error), finishedAt=datetime.now(timezone(timedelta(hours=8))).isoformat())
        write_json(RECEIPT, receipt)
        raise
    receipt.update(
        status='generated-unreviewed',
        output=output,
        seed=seed,
        bytes=OUTPUT.stat().st_size,
        sha256=hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
        finishedAt=datetime.now(timezone(timedelta(hours=8))).isoformat(),
    )
    write_json(RECEIPT, receipt)
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == '__main__':
    main()
