import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUTPUT = PROJECT.parent / '.tmp/nai/wu-full-v34-v5-20261016.png'
RECEIPT = Path(__file__).with_name('request.json')
REFERENCE = PROJECT / 'game/assets/portraits/full/wu.webp'

def main():
    assert style.RECIPE_VERSION == '3.4'
    assert not RECEIPT.exists() and not OUTPUT.exists(), 'Candidate already exists'
    prompt = style.build_asset_prompt(
        '1girl, solo, full body, standing, crossed legs, arms at sides, looking at viewer, confident smile, small fang.',
        purpose_layer='A single complete full-length game character portrait on a plain white background.',
        composition_layer='Vertical composition, centered figure. Entire ponytail, sword hilt, scabbard tip and both boots inside the canvas, with a little clear margin above the head and below the feet. Hands relaxed beside the skirt. One sheathed straight black longsword strapped diagonally across her back: hilt above her right shoulder (screen left), scabbard tip behind her left leg (screen right), ending just below the knee.',
        light_material_layer='Soft cool daylight, clear facial features, silver hair highlights, restrained black and charcoal clothing with blue ribbon accents.')
    appearance = (
        'young adult woman, tall slender build, fair skin, slightly full thighs and calves, aqua blue eyes, '
        'silver white long hair, high ponytail, blue satin bow at ponytail base, parted bangs, both eyes visible, '
        'black round goggles on top of head, dark round lenses with soft gray reflections, '
        'black rose hair ornament above her left temple (screen right). '
        'Black charcoal off-shoulder long-sleeved short dress, layered ruffles at neckline and cuffs, '
        'black tied waist, short layered ruffled skirt, front, back and side hems all end above the knees, '
        'thighs and knees clearly visible, bare legs, black ankle boots. '
        'Black back sword strap, straight narrow black scabbard, angular black crossguard, black cross-wrapped sword grip, faceted pommel, single metal band near scabbard tip.')
    uc = style.build_uc('cropped head, cropped feet, out of frame, multiple swords, holding sword, drawn sword, blue star pattern, stockings, pantyhose, thighhighs, long skirt, high-low skirt, long back hem, dress train, floor-length dress, hair over one eye')
    characters = [{'prompt': appearance, 'uc': '', 'center': {'x': 0.5, 'y': 0.5}}]
    request = nai_gen.build_payload(prompt, uc, width=832, height=1216, seed=1634052026,
                                    model='nai-diffusion-5-full', char_prompts=characters)
    record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
                  cleanup_version=style.CLEANUP_VERSION, request=request,
                  references=[dict(path='game/assets/portraits/full/wu.webp',
                                   sha256=hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
                                   purpose='Visual identity checked locally; not uploaded', uploaded=False)],
                  output=str(OUTPUT.relative_to(PROJECT.parent)))
    def save():
        RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
                                           seed=1634052026, model='nai-diffusion-5-full',
                                           out=OUTPUT, char_prompts=characters)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', seed=seed,
                  sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()

if __name__ == '__main__':
    main()
