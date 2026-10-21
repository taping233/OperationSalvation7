import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

HERE = Path(__file__).resolve().parent
OUT = ROOT.parent / '.tmp/nai/xingyue-reeds-nai5-20261020/candidate.png'
REFERENCE = Path('C:/Users/太平/Downloads/89cf6b6a0f5a0ce0a12c367d561cf4b9236908.png')
IDENTITY = ROOT / 'game/assets/portraits/full/xingyue.webp'
prompt = style.build_asset_prompt(
    '1girl, solo, standing in a vast silver reed field, arms gently spread at waist height, both open palms visible, relaxed fingers. Body turned slightly toward screen-right, face looking back toward the viewer, quiet composed expression.',
    composition_layer='Wide landscape, eye-level three-quarter view, girl near center, visible from head to knees, lower legs hidden by reeds. Dense diagonal windblown reeds fill the foreground with soft out-of-focus plumes, smaller reeds lead toward a low distant horizon. Wind blows her hair, jacket and red pennants toward screen-right. Slender weathered poles with long red ribbons on the left and scattered far behind her; tiny white birds across an expansive dramatic cloudy sky.',
    light_material_layer='Sunset after a windy day, dark blue-gray clouds edged with glowing amber light, warm backlight from screen-right, luminous silver reed plumes, golden rim light on hair and shoulders, softly illuminated face and hands, deep cool foreground shadows, cinematic atmosphere, finely resolved face.')
character = ('young adult woman, human, pale skin, golden eyes, very pale blonde hair, straight bangs, long side locks, one very long thick braid tied low and streaming in the wind. '
             'A white crescent moon hairpin clipped flat into the hair just above the bangs on the viewer\'s right, tilted against the hair. '
             'New outdoor outfit: fitted ivory high-neck sleeveless dress with subtle teal waist tabs, open gray lightweight field jacket slipping below the shoulders, rolled sleeves, dark wrist straps, bare hands, simple brown belt. Calm gaze, closed mouth.')
uc = style.build_uc('animal ears, cat ears, wolf ears, tail, blue eyes, yellow gloves, military insignia, faction logo, halo, lantern, staff, weapon')
characters = [{'prompt': character, 'uc': '', 'center': {'x': .5, 'y': .5}}]
payload = nai_gen.build_payload(prompt, uc, seed=1839265147, char_prompts=characters)
receipt = HERE / 'request.json'
assert not receipt.exists() and not OUT.exists()
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION, request=payload,
              references=[dict(path=str(p), role=role, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), uploaded=False)
                          for p, role in [(REFERENCE, 'composition'), (IDENTITY, 'identity')]],
              reference_metadata={'srgb': 0, 'embedded_prompt': None},
              preserve=['夕照芦苇与红飘带', '迎风张臂与掌心展开', '低地平线和前景遮挡'],
              replaced=['原人物兽耳、发眼色和制服标识', '星月浅金长辫、金瞳、白月发饰', '灰白野外裙装与轻外套'],
              output=str(OUT), acquisition='nai_gen.generate_image; local textual reconstruction, no image upload')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, seed=payload['parameters']['seed'], out=str(OUT), char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
