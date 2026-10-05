"""Prepare the authorized image request from inspected reference and shared style."""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_prompt_clean as recipe

reference = PROJECT / 'game/assets/portraits/full/wu.webp'
subject = (
    'Wu, the same young adult fantasy swordswoman shown in the provided approved reference. '
    'Keep her recognizable youthful face, fair skin, vivid cyan-blue eyes, confident small-fang smile, '
    'silver-white neatly gathered very high ponytail reaching her calves with a blue satin bow, '
    'two face-framing locks, parted light bangs, matte black round sunglasses on her head, '
    'and the black rose beside the ponytail root. '
    'Keep the off-shoulder charcoal-black ruffled dress, narrow black waist belt, '
    'plain dark outer skirt and deep-blue star-patterned inner lining visible at the hem, '
    'calf-length skirt silhouette consistent with the reference, bare lower legs and black cuffed ankle boots. '
    'One single slender black longsword is now drawn in her right gloved hand; '
    'its empty black scabbard remains strapped diagonally behind her back. '
    'Her free left hand stays relaxed and ready near her waist.'
)
composition = (
    'A grounded battle-ready idle stance facing screen-right. Her torso, hips, face, gaze and boots '
    'turn clearly toward the RIGHT edge of the image, at a right-facing three-quarter side angle. '
    'She looks toward an opponent outside the canvas to the right. '
    'Her right boot is a little forward, knees gently flexed, weight balanced. '
    'Hold the one black sword low and forward in a controlled guard, its point toward screen-right. '
    'Make the right-facing direction unmistakable while keeping her recognizable face readable. '
    'Full body from top of ponytail to both boot soles, entire sword, hair and skirt inside the canvas, '
    'with comfortable transparent margins. One character only; no enemy or extra weapon.'
)
light = (
    'Soft directional light with restrained cool gray-blue cloth shadows and precise steel highlights. '
    'Distinct matte fabric, satin ribbon, leather boots and dark metal; retain the reference painterly finish.'
)
uc_extra = (
    'opaque background, white background, checkerboard painted into the image, scenery, floor, cast shadow, '
    'left-facing pose, frontal portrait pose, hand-on-hip fashion pose, extra character, duplicate character, '
    'extra sword, staff, glow aura, slash effect, lens flare, cropped hair, cropped sword, cropped feet, '
    'adult-identity changes, stockings, tights, thighhighs, sunglasses over eyes, stars on outer black skirt'
)
prompt = (
    'Use case: identity-preserve / stylized-concept.\n'
    'Asset: one transparent full-body 2D battle character portrait.\n'
    'Input image: identity, costume and painterly style reference; replace the pose and remove its white background.\n'
    'Scene: genuinely transparent RGBA background, no setting, ground plane, cast shadow, border or checkerboard artwork.\n'
    'Subject: ' + subject + '\n'
    'Composition: ' + composition + '\n'
    'Lighting/materials: ' + light + '\n'
    'Style: ' + recipe.STYLE_BLOCK + '\n'
    'Constraints: preserve reference identity and costume; change pose and weapon handling only as specified. '
    'No text, watermark, extra limbs or malformed fingers. Do not redesign her outfit or lengthen the skirt.'
)
request = {'channel': 'built-in image_gen', 'transparent_background': True,
           'reference_image': str(reference), 'reference_sha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
           'recipe_version': recipe.RECIPE_VERSION, 'cleanup_version': recipe.CLEANUP_VERSION,
           'prompt': prompt, 'nai_prompt_for_record': recipe.build_battle_portrait_prompt(
               subject, composition_layer=composition, light_material_layer=light),
           'nai_uc_for_record': recipe.build_uc(uc_extra),
           'note': 'NAI prompt and UC are offline records only; actual image request uses the built-in prompt with inspected visual reference.'}
(HERE / 'wu-battle.request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'request': str(HERE / 'wu-battle.request.json'), 'reference_sha256': request['reference_sha256']}))
