import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

OUT = ROOT.parent / '.tmp/nai/baita-station-reset-1024'
OUT.mkdir(parents=True, exist_ok=True)
prompt = style.build_asset_prompt(
    '1girl focus, adult woman walking up a railway station staircase toward the camera, high angle view looking down the stairs, quiet thoughtful expression, holding a small paper train ticket in her right hand, left hand holding the strap of her brown shoulder bag, a few distant commuters walking away across the concourse behind her',
    purpose_layer='Wide game homepage wallpaper, a winter morning commute in a modern city station.',
    composition_layer='Landscape composition, young adult woman centered between two gray metal-and-tile stairwell walls, symmetrical brass handrails receding toward the station concourse at the top of the image. Camera looks down from the upper landing. The woman faces upward toward the camera, ascending from the background toward the foreground. One loafer is planted flat on a horizontal stair tread, the other foot is raised only one normal stair above it, modest natural walking stride. Uniform realistic stair risers and deep treads, consistent single perspective. Her ticket is held by thumb and index finger at one short edge, the rest of the ticket is visible. Full figure and shoes inside the frame. Keep blurred commuters secondary, no foreground face obscuring her, no interface.',
    light_material_layer='Pale warm winter daylight from the concourse, cool blue-gray reflected light on tiled stairwell walls, warm brass rails and beige coat, chestnut brown curls, muted blue-gray knit dress, soft rich green eye, clean silver stair-edge strips, controlled light-shadow planes, high complexity')
character = 'adult woman, very long dark chestnut brown wavy curly hair, thick side swept fringe covering her eye on the viewers right, only the green eye on the viewers left visible, two slender gold hairpins on the visible-eye side, small gold earrings, muted dark green beret, calm bookish demeanor, beige knee length open winter coat over a blue gray ribbed turtleneck knit dress, opaque charcoal tights, brown leather loafers, brown leather shoulder bag, natural bare hands'
uc = style.build_uc('child, loli, multiple main characters, both eyes visible, parted fringe, short hair, hair over both eyes, extra legs, extra feet, giant stairs, steep ladder, floating foot, foot through stairs, broken railing, distorted ticket, text on ticket, text, floating books, cake, magic circle')
chars = [{'prompt':character, 'uc':'both eyes visible, short hair', 'center':{'x':0.5,'y':0.56}}]
payload = nai_gen.build_payload(prompt, uc, model='nai-diffusion-5-full', char_prompts=chars, use_coords=True)
receipt = {'status':'prepared','recipe_version':style.RECIPE_VERSION,'request':payload,
    'references':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'role':r,'uploaded_to_nai':False} for p,r in [
        ('game/assets/reconstruction/wallpaper-baita-station-1020.webp','theme and station stair composition'),
        ('game/assets/portraits/full/baita.webp','current character identity only')]],
    'output':str(OUT/'nai5-draft.png')}
record = Path(__file__).with_name('nai-request.json')
def save():
    record.write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
save()
try:
    result,seed=nai_gen.generate_image(prompt,uc,model='nai-diffusion-5-full',
        seed=payload['parameters']['seed'],char_prompts=chars,use_coords=True,out=OUT/'nai5-draft.png')
except BaseException as error:
    receipt.update(status='failed',error_type=type(error).__name__)
    save()
    raise
receipt.update(status='generated',seed=seed,sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
save()
