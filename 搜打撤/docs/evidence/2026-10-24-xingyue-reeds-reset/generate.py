import hashlib
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
import nai_gen
import nai_prompt_clean as style

OUT=ROOT.parent/'.tmp/nai/xingyue-reeds-reset-1024'
OUT.mkdir(parents=True,exist_ok=True)
prompt=style.build_asset_prompt(
    '1girl, solo, adult woman standing among a field of tall silver reed plumes at sunset, calm quiet expression, looking gently toward the viewer, her long thick braid and warm scarf carried sideways by the wind, right hand lightly gathering her scarf at her upper chest, left hand lowered beside her hip brushing a few reed plumes',
    purpose_layer='Wide game homepage wallpaper, a quiet winter sunset walk through silver reeds, completely redesigned warm contemporary outdoor outfit.',
    composition_layer='Landscape composition, woman on the left-center at about forty percent of image width, head and both hands visible above the reeds, body below the upper thighs mostly occluded naturally by grasses. Layered reed plumes in the foreground sweep toward the right, spectacular deep blue cloud formations and honey-gold sunset on the right. A few thin wooden path-marker stakes with narrow red ribbons recede through the reeds. Her braid and scarf flow toward the right with the same wind as the reeds and ribbons. Keep distant scenery and outer edges economical for a game-menu overlay, artwork only.',
    light_material_layer='Cold silver-blue winter light in reed shadows, warm amber rim light along her face, braid and wool coat, richly colored but controlled dusk sky. Matte deep petrol teal wool overcoat, oatmeal knitted high collar, warm ochre scarf, charcoal skirt, fine clean warm skin, quiet fabric planes and coherent long hair locks, high complexity')
character='adult woman, pale blonde very long hair in one thick low braid, straight bangs, gold eyes, quiet reserved face, white crescent moon hairpin clipped flat above the bangs slightly to the viewers right, warm contemporary winter clothing, long deep petrol teal double-breasted wool overcoat with modest dark buttons and sleeves to the wrists, oatmeal high neck cable knit sweater, warm ochre wool scarf wrapped once around the neck, charcoal pleated midi skirt, brown ankle boots, natural bare hands'
uc=style.build_uc('child, loli, extra person, priestess dress, cleric robe, shoulder cape, off shoulder jacket, bare shoulders, sleeveless, detached sleeves, short skirt, swimsuit, armor, floating hairpin, halo, lantern, extra fingers, missing fingers, extra hands, garment logos, text')
chars=[{'prompt':character,'uc':'bare shoulders, shoulder cape, cleric robe','center':{'x':0.4,'y':0.55}}]
payload=nai_gen.build_payload(prompt,uc,model='nai-diffusion-5-full',char_prompts=chars,use_coords=True)
receipt={'status':'prepared','recipe_version':style.RECIPE_VERSION,'request':payload,
    'references':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'role':r,'uploaded_to_nai':False} for p,r in [
        ('game/assets/reconstruction/wallpaper-xingyue-reeds-1020.webp','reeds sunset scene and composition; old clothes explicitly replaced'),
        ('game/assets/portraits/full/xingyue.webp','current identity only')]],
    'output':str(OUT/'nai5-draft.png')}
record=Path(__file__).with_name('nai-request.json')
def save():
    record.write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
save()
try:
    result,seed=nai_gen.generate_image(prompt,uc,model='nai-diffusion-5-full',seed=payload['parameters']['seed'],char_prompts=chars,use_coords=True,out=OUT/'nai5-draft.png')
except BaseException as error:
    receipt.update(status='failed',error_type=type(error).__name__)
    save()
    raise
receipt.update(status='generated',seed=seed,sha256=hashlib.sha256(Path(result).read_bytes()).hexdigest())
save()
