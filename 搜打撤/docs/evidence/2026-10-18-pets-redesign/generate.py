import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = ROOT / 'game/art-source/pets/redesign-20261018'
OUT.mkdir(parents=True, exist_ok=True)
DESIGNS = {
 'dog': ('旺财', 'One small original rescue dog, compact spitz puppy with charcoal gray fur, cream muzzle and eyebrows, enormous triangular ears, amber eyes, upright curled tail. Its signature is a broad vermilion triangular rescue scarf, one end shaped like a heartbeat zigzag; a small ivory medical capsule fastened at its chest. A single cream heart-shaped patch on chest. Sitting alert with one forepaw lifted, brave friendly expression. Natural canine anatomy, four paws.'),
 'falcon': ('猎鹰宝宝', 'One original baby falcon scout, plump compact bird with slate blue back, ivory belly, sharp ochre eyes and ochre feet. Its signature is one oversized translucent amber reconnaissance lens mounted ONLY over its left eye, folded blade-like flight feathers and a short split orange signal ribbon on its leg. Perched with wings partially opened, proud curious expression. Distinct hooked beak, two feet, two wings.'),
 'cat': ('招财猫', 'One original lucky black cat, rounded black body, cream muzzle and toes, luminous pale jade eyes, mischievous calm expression. Its signature is an oversized antique gold square-holed coin floating upright inside the curl of its tail, tail curls around coin without piercing it. Dark teal short merchant neck scarf tied with an asymmetric knot, one front paw raised with pink pads visible. One cat, one tail, one coin, four paws. Elegant compact silhouette.'),
 'robot': ('变形机器人', 'One original small transforming support robot, squat rounded triangular torso, ivory ceramic armor with charcoal articulated joints and orange hinges. Its signature is TWO large folded blade-like forearm tools, visibly hinged and stowed safely backwards along the arms. A narrow cyan horizontal face visor and tiny asymmetrical antenna. Two stout mechanical legs, two mechanical arms, standing with a proud slight forward lean. Clear readable transformable construction, cute but functional machine.'),
 'fire': ('火焰精灵', 'One original little fire spirit. Its signature is a cracked matte black ceramic furnace seed as its round floating body, a vertical glowing orange fissure in the front revealing the warm living core. A large flame crest rises above the seed in the silhouette of a fox ear pair, two tiny ember hands hover at its sides, a short comet-like flame tail curls underneath. Two pale warm eyes inside the dark front face, playful impish expression. Orange red amber fire, charcoal ceramic, no legs, no humanoid body.'),
 'penguin': ('小企鹅咕嘎', 'One original small emperor penguin courier chick, round charcoal and ivory body, fluffy cool gray cheeks, little amber beak and feet. Its signature is a compact transparent icy cyan safety vault backpack with TWO visible cream rectangular card cases inside, thick dark protective frame and an oversized orange latch. Backpack firmly strapped, shown in three-quarter view to reveal the side and face simultaneously. One flipper hugs the backpack strap, another extends for balance; short orange scarf, earnest proud expression. Two feet, two flippers.')
}
for index, (pet, (name, subject)) in enumerate(DESIGNS.items()):
    receipt = HERE / (pet + '-request.json')
    output = OUT / (pet + '-nai.png')
    if receipt.exists() or output.exists():
        raise RuntimeError('Existing candidate: ' + pet)
    prompt = style.build_asset_prompt(subject,
        purpose_layer='Original collectible companion creature concept for a futuristic urban extraction card game. Nonhuman pet, solo, full body.',
        composition_layer='Square composition, entire subject centered, complete ears wings tail feet and equipment within canvas, generous clean margin. Three-quarter view, plain warm off-white background, no scenery, no typography.',
        light_material_layer='Coherent muted base palette with one concentrated vivid signature accent, clear grouped shadows, carefully readable face and equipment at thumbnail scale.')
    uc = style.build_uc('human, person, girl, boy, humanoid, duplicate creature, crowd, cropped ears, cropped tail, photorealistic, 3d render')
    request = nai_gen.build_payload(prompt, uc, width=1024, height=1024, seed=1801202600+index, char_prompts=[])
    record = dict(status='prepared', name=name, recipe=style.RECIPE_VERSION, request=request, output=str(output.relative_to(ROOT)))
    def save():
        receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        path, seed = nai_gen.generate_image(prompt, uc, width=1024, height=1024, seed=request['parameters']['seed'], out=output, char_prompts=[])
    except BaseException as error:
        record.update(status='failed', error_type=type(error).__name__)
        save()
        raise
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
    print('READY ' + pet, flush=True)
