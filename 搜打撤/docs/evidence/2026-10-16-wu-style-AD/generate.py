# -*- coding: utf-8 -*-
"""One authorized four-image NAI style comparison; no shared recipe mutation."""
import hashlib
import json
import sys
from pathlib import Path

GAME = Path(__file__).resolve().parents[3]
ROOT = GAME.parent
sys.path.insert(0, str(GAME / 'tools'))
import nai_gen
import nai_style
from nai_prompt_clean import build_asset_prompt, build_uc
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = ROOT / '.tmp/nai/wu-style-AD-20261016'
GALLERY = Path('C:/Users/太平/.codex/visualizations/2026/10/16/01a1447d-849e-7990-afaa-d118ad32bb47/arknights-style')
SEED = 1771067347

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

IDENTITY = (
    '1girl, adult woman, pale skin, cyan blue eyes, silver white long hair in a high ponytail, '
    'parted bangs, both eyes visible, blue satin ribbon bow at ponytail base, '
    'black round sunglasses on top of her head, black rose on her left temple. '
    'Off-shoulder charcoal black long-sleeved dress, layered ruffles at neckline cuffs and above-knee hem, '
    'black waist sash, bare legs, black ankle boots. '
    'Black straight sword sheathed diagonally across her back, hilt behind her right shoulder, '
    'sheath tip behind her left leg. Confident gentle smile, small fang.'
)
SUBJECT = '1girl, solo, full body, three-quarter view, looking at viewer, confident smile.'
PURPOSE = 'Finished environmental game illustration, arknights, futuristic city.'
COMPOSITION = (
    'Wu sits sideways on a low modern observation-terrace bench, both boots resting on the deck, '
    'knees together, right hand resting on her lap, left palm on the bench beside her hip. '
    'She occupies the left half, her face turned toward us; the city fills the right half. '
    'Entire head, hair bow and boots in frame. A low railing leads toward layered towers, '
    'elevated transit tracks and distant mountains; light snow along roof edges. No other people.'
)
NIGHT = (
    'Winter night, deep blue sky, cool blue ambient light on both figure and terrace, '
    'small warm city windows below, a subtle warm reflection on her cheek, distant haze.'
)
DAY = (
    'Winter daytime, pale blue sky, cool clear daylight on both figure and terrace, '
    'gentle warm sunlight on her cheek and silver hair, distant mountains fading into atmospheric haze.'
)
A_ARTISTS = '0.7::artist:yyb::, 0.6::artist:ruoganzhao::, 0.4::artist:wenquangua::, 0.3::artist:kuuus::'
D_ARTISTS = '0.9::artist:anmi::, 0.3::artist:yyb::, 0.3::artist:ruoganzhao::, 0.2::artist:kuuus::'
A_STYLE = (
    'arknights, refined painterly anime illustration, clean complete silhouettes, '
    'carefully resolved face and hands, grouped hair, dimensional angular cloth folds, '
    'subtle material-specific highlights, delicate skin transitions. '
    'Crisp focal edges, quieter background detail, rich restrained color, '
    'cool gray shadow planes with concentrated colored accents.'
)
D_STYLE = (
    'arknights, atmospheric anime game illustration, anime coloring, clean selective lineart, '
    'clear grouped shadows, dimensional clothing, refined face and hands. '
    'Character and scenery share the same ambient light and reflected colors. '
    'Distinct foreground middle distance and distant city, atmospheric perspective, '
    'a unified broad color structure, small luminous accents, '
    'crisp character focal edges with softer quieter distant architecture.'
)
UC = build_uc('multiple girls, holding sword, unsheathed sword, hair over one eye, blue star pattern, upskirt, underwear, medieval castle, animal ears')
CHARACTERS = [{'prompt': IDENTITY, 'uc': '', 'center': {'x': 0.32, 'y': 0.5}}]
SPECS = [
    ('01-current-night', '01 / 现行版 · 夜景', nai_style.ARTIST_BLOCK, nai_style.STYLE_BLOCK, NIGHT),
    ('02-A-night', '02 / A 向 · 夜景', A_ARTISTS, A_STYLE, NIGHT),
    ('03-D-led-night', '03 / D 主导 A＋D · 夜景', D_ARTISTS, D_STYLE, NIGHT),
    ('04-D-led-day', '04 / D 主导 A＋D · 日间', D_ARTISTS, D_STYLE, DAY),
]

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (GALLERY / 'assets').mkdir(parents=True, exist_ok=True)
    plan = {'status': 'prepared', 'recipe_baseline': nai_style.RECIPE_VERSION,
            'comparison': 'overall recipe comparison: artist chain and style language vary together; not artist-only causal attribution',
            'identity_reference': {'path': 'game/assets/portraits/full/wu.webp',
                                   'sha256': sha(GAME / 'game/assets/portraits/full/wu.webp'),
                                   'use': 'visually inspected and translated into character tags; no image upload or vibe encoding'},
            'style_sources': ['nai5_community_pack_mengshen_korean_0045',
                              'nai5_community_pack_mengshen_september_2026_0662'],
            'latest_preference': 'D preferred; third and fourth variants D-led',
            'notes': 'Same character, pose, layout, seed, model, size, sampler, quality and UC for all. Variant04 changes lighting/time only from03. Fixed seed does not guarantee identical composition after prompt changes.',
            'items': []}
    for key, label, artists, style, light in SPECS:
        prompt = build_asset_prompt(SUBJECT, purpose_layer=PURPOSE,
                                    composition_layer=COMPOSITION, light_material_layer=light)
        prompt = prompt.replace(nai_style.ARTIST_BLOCK, artists).replace(nai_style.STYLE_BLOCK, style)
        output = OUT / (key + '.png')
        request = nai_gen.build_payload(prompt, UC, width=1216, height=832, seed=SEED,
                                       char_prompts=CHARACTERS, use_coords=True)
        item = {'id': key, 'label': label, 'artist_block': artists, 'style_block': style,
                'status': 'prepared', 'request': request,
                'output': str(output.relative_to(ROOT)).replace('\\', '/')}
        plan['items'].append(item)
    record = HERE / 'request.json'
    def save():
        record.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    for item in plan['items']:
        output = ROOT / item['output']
        if output.exists():
            raise SystemExit('Refusing to overwrite existing candidate: ' + str(output))
        print('GENERATING ' + item['id'], flush=True)
        item['status'] = 'requesting'
        save()
        try:
            p = item['request']
            nai_gen.generate_image(p['input'], p['parameters']['negative_prompt'],
                                   width=1216, height=832, seed=SEED, out=output,
                                   char_prompts=CHARACTERS, use_coords=True)
        except BaseException as error:
            item['status'] = 'failed'
            item['error'] = str(error)
            plan['status'] = 'partial-or-failed'
            save()
            raise
        web = GALLERY / 'assets' / (item['id'] + '.webp')
        with Image.open(output) as im:
            im.convert('RGB').save(web, 'WEBP', quality=94, method=6)
        item.update(status='generated', sha256=sha(output), bytes=output.stat().st_size,
                    gallery_asset='assets/' + web.name, gallery_sha256=sha(web))
        save()
        print('READY ' + item['id'], flush=True)
    plan['status'] = 'generated-awaiting-visual-review'
    save()
    print('ALL FOUR READY', flush=True)

if __name__ == '__main__':
    main()
