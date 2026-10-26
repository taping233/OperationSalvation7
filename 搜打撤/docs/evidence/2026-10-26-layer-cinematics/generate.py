import sys, json, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
from nai_prompt_clean import build_asset_prompt, build_uc

SCENES = {
    'watchline': 'An isolated broken military checkpoint silhouette: a low horizontal barricade, two unequal watchtower slabs and a narrow passage through their middle. Wind-swept white snow planes crossing horizontally. No soldiers, no weapons.',
    'ruins': 'An isolated sunken city ruin silhouette: three offset massive pale concrete terraces descending into a dark square well, a single broken cantilever and buried building silhouettes. Frost on the upper planes. No gateway arch.',
    'core': 'An isolated looming sealed laboratory entrance silhouette: a tall charcoal monolith with a narrow ivory vertical opening and one muted rust-red fissure at its foot, two low offset wall blocks. No creature, no magic symbols, no glowing orb.',
    'recovery': 'A symbolic recovery emblem: two broken warm ivory concrete fragments almost reconnect across a fine warm seam, a single pale silver-green young leaf emerging between them. Three simple quiet planes, no medical cross, no circle, no bottle.',
    'restoration': 'A symbolic card restoration emblem: two overlapping blank ivory rectangular card-like stone plates, a missing corner returning to its original place, a hairline warm gold join. No writing or symbols, no playing card suits, no circle.',
    'offering': 'A symbolic offering and activation emblem: three small grey stone chips converging toward a short open vertical slit in a squat charcoal pedestal, a very thin muted rust-red seam receiving them. No altar runes, no magic circle, no diamonds, no people.',
}
for index, (key, scene) in enumerate(SCENES.items()):
    receipt = Path(__file__).with_name(f'nai-{key}.json')
    if receipt.exists():
        record = json.loads(receipt.read_text(encoding='utf-8'))
        if record['status'] == 'generated':
            continue
        raise SystemExit(f'Inspect existing request before resuming: {receipt}')
    output = ROOT / '.tmp/nai/layer-cinematics-1026' / f'{key}.png'
    prompt = build_asset_prompt(
        'scenery, no humans, ' + scene,
        purpose_layer='Symbolic game layer-entry cinematic, one isolated architectural emblem in a nearly black empty field, same restrained visual series as a fractured city reflection.',
        composition_layer='Wide landscape. Architectural emblem on the right half, occupying one third of canvas width and half its height. Left forty percent quiet almost black for an existing caption. Broad simple silhouettes, enormous uninterrupted black negative space.',
        light_material_layer='Matte charcoal, warm grey, ivory and extremely sparse muted rust-red. Broad opaque painted planes, selective rough edges, restrained contrast, no tiny surface details.')
    uc = build_uc('people, character, typography, panels, full-screen environment, dense architecture, tiny windows, pipes, cables, lens flare, blue light, magic circle')
    seed = 26102610 + index
    record = dict(status='prepared', request=nai_gen.build_payload(prompt, uc, seed=seed, char_prompts=[]), output=str(output))
    def save():
        receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        nai_gen.generate_image(prompt, uc, seed=seed, out=output, char_prompts=[])
        record.update(status='generated', sha256=hashlib.sha256(output.read_bytes()).hexdigest())
    except BaseException as error:
        record.update(status='failed', error=str(error))
        raise
    finally:
        save()
