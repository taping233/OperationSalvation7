import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/roster-nai5-redo-20261020'
SCENES = [
    dict(id='baita', seed=1326307801,
         action='1girl, solo, full body, seated on an ornate dark wooden armchair, three-quarter front view. Left hand supports a small plate of strawberry cake; right hand holds a silver fork just before her lips. A large closed antique grimoire rests firmly across her lap, gold ribbon bookmarks hanging down. Two small open books float beside her shoulders. A faint gold magic circle lies beneath the chair.',
         character='adult woman, quiet scholarly expression, green eye, very long dark brown wavy curly hair. Thick side-swept bangs completely cover the eye on the viewer-left side; only the viewer-right green eye is visible. Two slender gold hair clips on the exposed-eye side. White long-sleeved buttoned blouse with gathered cuffs, dark forest-green suspender maxi dress, gold buckles, white ankle socks, black Mary Jane shoes.',
         uc='both eyes visible, uncovered left eye, short hair, standing'),
    dict(id='heixiang', seed=1326307802,
         action='1boy, solo, full body, standing with a grounded relaxed stance, three-quarter front view, confident smirk toward viewer. Right gloved hand delicately holds a tiny silver coffee cup at his lips, little finger slightly raised; left gloved hand supports its small saucer at waist. Steam rises from the cup. A massive plain silver-gray slab greatsword is strapped diagonally across his back, hilt above his shoulder and broad blade extending to calf level.',
         character='adult man, very tall, massive muscular build, broad shoulders, thick arms, dark brown skin, amber gold eyes, black short slicked back hair, exposed forehead. His black hair is slicked back from his forehead, fully exposing it. Stitched scar on his left cheek, viewer-right. Fitted black long-sleeve combat shirt, single metal shoulder plate, black tactical trousers, thigh pouches, utility belt, black gloves and heavy black combat boots. Burnt-orange scarf around neck with one long frayed trailing end.',
         uc='pale skin, white skin, bangs, forehead covered, slim body, girl, beard'),
    dict(id='xingyue', seed=1326307803,
         action='1girl, solo, full body, standing facing viewer with a quiet composed expression. Left hand held upright before chest in a restrained blessing gesture. Right hand holds the handle of a small silver lantern beside her hip, a warm golden star glowing inside. Her very long thick braid arcs gently to her side; complete boots and skirt hem visible.',
         character='adult woman, golden eyes, pale light-blonde hair, straight neat blunt bangs, small side braid joining a low long thick braid reaching calves. A white crescent moon hairpin clipped flat into the hair at the top of her head just above the bangs, slightly off-center to the viewer-right, tilted and resting against the hair. White high-collar priestess dress, layered long skirt, gold edging, small gold four-point star emblem, deep teal short shoulder cape with gold trim, dark wrist cuffs, dark tights, white-gray ankle boots. Serene subtle expression.',
         uc='purple eyes, black dress, halo, floating hair ornament, orange hair, exaggerated grin'),
    dict(id='changwuyu', seed=1326307804,
         action='1boy, solo, full body, elegant three-quarter front standing pose, faint calm smile. Right black-gloved fingertips touch the bridge of his round eyeglasses, left arm rests across his waist. An opaque solid black smoky cloud floats on viewer-left at chest height; a round orange fireball with a long comet tail floats on viewer-right. No staff or wand.',
         character='adult man, refined androgynous masculine face, yellow eyes, pointed elf ears, silver-gray long hair gathered into a low bun behind head, long loose sidelocks over shoulders, thin round metal eyeglasses. Large black broad-brimmed witch hat with long crooked bent pointed tip and purple underside. Black high-collar long robe and black gloves, long sweeping cape with purple lining and gold edging. White feather and blue sapphire in gold brooch on his left chest, not on hat. Black lace-up boots.',
         uc='staff, wand, walking stick, red eyes, girl, breasts, feather on hat, short hair'),
]

for item in SCENES:
    path = OUT / (item['id'] + '.png')
    receipt = Path(__file__).with_name(item['id'] + '-request.json')
    assert not path.exists() and not receipt.exists(), 'Do not regenerate existing candidates.'
    portrait = ROOT / 'game/assets/portraits/full' / (item['id'] + '.webp')
    bible = ROOT / 'docs/character-bible' / (item['id'] + '.md')
    prompt = style.build_asset_prompt(
        item['action'], purpose_layer='Single game character selection full-body portrait, isolated on a clean white background.',
        composition_layer='Vertical composition. Entire character, headwear, hair, clothing, feet and signature props inside frame, comfortable small margins. No scenery, no other people.',
        light_material_layer='Soft neutral studio illumination, clear face and hand shadows, restrained metal reflections, readable dark fabric, subtle ground contact shadow.')
    uc = style.build_uc('cropped head, cropped feet, out of frame, multiple people, background scenery')
    chars = [dict(prompt=item['character'], uc=item['uc'], center=dict(x=.5, y=.5))]
    request = nai_gen.build_payload(prompt, uc, width=832, height=1216,
                                    seed=item['seed'], model='nai-diffusion-5-full', char_prompts=chars)
    record = dict(status='prepared', character=item['id'], recipe_version=style.RECIPE_VERSION,
                  request=request, output=str(path.relative_to(ROOT.parent)),
                  references=[dict(path=str(p.relative_to(ROOT)), sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
                                   role=role, uploaded=False) for p, role in
                              [(portrait, 'current appearance, outfit and pose'), (bible, 'current identity; newest explicit anchors override old illustration')]],
                  integration='candidate only, no runtime assets replaced')
    def save():
        receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    print('START ' + item['id'], flush=True)
    try:
        result, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
                                              seed=item['seed'], model=request['model'], out=path,
                                              char_prompts=chars)
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__, error=str(error))
        save()
        raise
    record.update(status='generated', seed=seed, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  size_bytes=path.stat().st_size, acquisition='nai_gen/nai_guard, one candidate')
    save()
    print('DONE ' + item['id'], flush=True)
