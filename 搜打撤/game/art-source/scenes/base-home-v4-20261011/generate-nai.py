import hashlib
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
project = here.parents[3]
sys.path.insert(0, str(project / 'tools'))
from nai_gen import DEFAULTS, MODEL, build_payload, generate_image
from nai_prompt_clean import ARTIST_BLOCK, CLEANUP_VERSION, RECIPE_VERSION, build_asset_prompt, build_uc

prompt = build_asset_prompt(
    'scenery, indoors, winter, no humans. A welcoming expedition base rest room, a lived-in winter refuge, not a cafe or a medieval hall. A single compact life-trace focal group at the centre: one simple paper-white cushioned reading chair with a folded muted terracotta-red blanket, one small charcoal-gray side table holding a plain warm ceramic teacup and one closed book. Behind this group is one broad rectangular window overlooking a quiet snow-covered courtyard in blue-gray winter dusk. The room has cool paper-white plaster wall planes, matte blue-gray stone floor, a few broad dark steel frame shapes, and a low pale ash storage bench. The comfortable chair and blanket clearly belong to returning expeditioners. No people or animals.',
    purpose_layer='A wide 16:9 base homepage background, an original indoor place of rest and belonging, with no interface baked into the image.',
    composition_layer='Human eye-level wide interior view, complete believable room structure. The life-trace group is the single focal point near horizontal centre, within the middle third. LEFT 28 percent is quiet broad wall and floor without objects for navigation. LOWER-RIGHT 28 percent is quiet blue-gray wall/floor with no furniture or props for the departure panel. TOP 13 percent is a calm broad darker architectural plane without ornaments for the resource bar. Large uncluttered spatial layers, no exaggerated tilted perspective, no diagonal beam crossings. The chair, blanket, cup and book stay within the central focus group rather than scattered around the room.',
    light_material_layer='Cool gray, desaturated deep blue-gray and paper-white dominate. Muted terracotta-red blanket is the only strong color accent. One very small restrained warm lamp light within the central group creates a gentle sense of return, not a second focal point. Clear soft winter ambient illumination with broad hard-edged shadow planes and opaque economical painted masses. Low detail density, simplified broad hand-painted brushwork, very few seams. The floor is matte, no reflections; pale wood appears only as broad ash-colored planes, no woodgrain. No brown or golden room color cast, no cinematic spotlight or excessive glow.',
)
negative = build_uc('human, person, people, girl, boy, character, portrait, animal, outdoor foreground, sitting on the ground, scattered paper, tilted bookshelves, brown room, golden room, dark wood floor, woodgrain, ornate furniture, medieval, restaurant, cafe, busy composition, many props, tiny repeated details, detailed window frames, shiny floor, reflections, glossy 3d, photorealistic, cinematic glow, lens flare, neon, interface, icons, captions, letters, clutter, extreme perspective')
width, height, seed = 1024, 576, 1011206400
refs = [project / 'game' / 'assets' / 'portraits' / 'full' / (name + '.webp') for name in ('wu', 'changwuyu', 'baita', 'heixiang', 'xingyue')]
receipt = {
    'channel': 'existing project NovelAI client -> built-in ImageGen redraw',
    'model': MODEL, 'recipeVersion': RECIPE_VERSION, 'cleanupVersion': CLEANUP_VERSION,
    'artistBlock': ARTIST_BLOCK, 'parameters': DEFAULTS,
    'width': width, 'height': height, 'seed': seed, 'prompt': prompt, 'negativePrompt': negative,
    'referenceChecksums': {str(p.relative_to(project)): hashlib.sha256(p.read_bytes()).hexdigest() for p in refs},
    'briefZh': '冬日远征基地休憩厅；中央灰白座椅、赤陶红披毯、茶杯书本为单一生活焦点；左侧28%、右下28%与上栏低纹理留白；冷灰深蓝灰纸白为主，不画人物。',
}
(here / 'request.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(here / 'nai-payload.json').write_text(json.dumps(build_payload(prompt, negative, '', width, height, seed, MODEL), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
output = here / 'nai-base-home-v4.png'
saved, actual_seed = generate_image(prompt, negative, '', width=width, height=height, seed=seed, out=str(output))
receipt['naiSource'] = {'path': str(output.relative_to(project)), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size, 'actualSeed': actual_seed, 'sourceAcquisition': 'tools/nai_gen.py generate_image; original NovelAI response decoded and dimension-verified'}
(here / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('NAI candidate receipt saved; no credentials recorded')
