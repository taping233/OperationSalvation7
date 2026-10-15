"""Five NAI keyframe boards; shared guard controls timing and quota."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT / 'game/art-source/chests/nai-v2'
KINDS = {
    'small': 'compact olive canvas supply box, charcoal reinforced corners, single brass clasp, worn utilitarian design, warm amber light',
    'medium': 'ivory ceramic and deep navy expedition supply chest, two broad navy straps, brass center latch, pale cyan light',
    'large': 'heavy dark teal expedition strongbox, ivory inset panels, asymmetrical brass locking mechanism, bright molten gold light',
    'class': 'black graphite specialist equipment case, restrained violet inset, pale silver clasp with angular diamond inset, vivid lavender light',
    'boss': 'monumental deep crimson and charcoal sealed reliquary supply chest, worn ivory armor corners, heavy brass seal, white gold core and crimson sparks',
}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    requested = sys.argv[1:] or list(KINDS)
    for index, kind in enumerate(KINDS):
        if kind not in requested:
            continue
        receipt = OUT / f'{kind}-nai-request.json'
        output = OUT / f'{kind}-nai.png'
        assert not receipt.exists() and not output.exists(), 'Use a new candidate path.'
        subject = ('no humans, a single original sci-fi scavenger supply chest design. ' + KINDS[kind] + '. '
                   'Six consecutive animation keyframes of exactly the SAME chest opening, identical camera and body shape. '
                   'Frame 1 fully closed. Frame 2 closed with glowing latch. Frame 3 lid barely cracked, thin light escaping. '
                   'Frame 4 lid raised halfway, intense light inside. Frame 5 lid fully open, luminous treasure energy erupting upward. '
                   'Frame 6 fully open, glowing interior with suspended motes. No empty dark interior.')
        prompt = style.build_asset_prompt(subject,
            purpose_layer='Game animation sprite sheet, six equal separate cells in an exact 3 columns by 2 rows grid, row-major sequence.',
            composition_layer=('Fixed three-quarter view from slightly above, front and right side visible, hinge at back. '
                               'Each whole chest centered in its own cell with identical floor baseline, generous margin. '
                               'All six boxes equal scale. Isolated on uniform dark neutral backdrop, no scene, no labels or grid lines.'),
            light_material_layer=('Hand-drawn anime prop illustration, substantial clear shapes, matte painted surfaces, selective colored outlines. '
                                  'The chest is the focus. Concentrated luminous interior, dark body still readable, controlled small highlights.'))
        uc = style.build_uc('people, girl, boy, hands, weapons, pirate chest, medieval ornament, typography, checkerboard, scenery, cropped object')
        seed = 1374910200 + index
        payload = nai_gen.build_payload(prompt, uc, width=1344, height=768, seed=seed, char_prompts=[])
        record = dict(status='prepared', kind=kind, recipe_version=style.RECIPE_VERSION,
                      request=payload, output=str(output.relative_to(ROOT)), references=[])
        def save():
            receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
        save()
        try:
            path, _ = nai_gen.generate_image(prompt, uc, width=1344, height=768, seed=seed,
                                            char_prompts=[], out=str(output))
        except BaseException as error:
            record.update(status='failed', error_type=type(error).__name__)
            save()
            raise
        record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
        save()
        print(json.dumps({'kind':kind, 'status':'generated', 'output':str(output)}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
