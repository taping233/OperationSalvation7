import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
import nai_gen
import nai_prompt_clean as style

SPECS = {
    'city-gate': {
        'name': '阴暗未来城市通路', 'seed': 102101013,
        'scene': ('scenery, no humans, abstract futuristic city at night, an urban threshold '
                  'suggested by broad dark building slabs and angular shelter shapes, '
                  'a continuous flat street plane recedes between them, only a few short '
                  'cold light strips suggest future technology, dark city silhouettes '
                  'merge into the same atmosphere, low detail, simple connected forms, '
                  'no literal mechanical construction'),
        'light': ('very dark charcoal blue and gray violet, restrained desaturated teal light '
                  'along one side, one small dim amber light accent, dim reflected light '
                  'on the continuous ground, a single coherent light direction, subdued '
                  'oppressive mysterious urban mood, no bright daylight or glowing sky'),
    },
    'gate': {
        'name': '大门／跨层通路', 'seed': 102101011,
        'scene': ('scenery, no humans, abstract winter passage, two broad dark upright silhouettes '
                  'suggest a threshold, one soft warm opening between them, a single continuous '
                  'pale sweep leads from foreground into the light, suggest passage without '
                  'literal detailed buildings or corridors'),
        'light': ('deep ink blue and muted gray teal, pale ivory and a little warm amber at the '
                  'opening, one consistent soft light direction, calm cold winter air'),
    },
    'altar': {
        'name': '祭坛前置过场', 'seed': 102101012,
        'scene': ('scenery, no humans, abstract sanctuary, one low dark horizontal mass and one '
                  'small suspended diamond of light above it, a broad muted cyan glow flows '
                  'continuously across the surrounding field, a symbolic sense of quiet power '
                  'without literal machinery, architecture or elaborate altar ornaments'),
        'light': ('deep ink blue, desaturated violet gray and muted teal, pale cyan focal light '
                  'with a very small warm ivory core, one consistent light source, quiet mysterious air'),
    },
}
slug = sys.argv[1]
spec = SPECS[slug]
HERE = Path(__file__).resolve().parent
OUT = PROJECT.parent / f'.tmp/nai/transition-abstract-20261021/{slug}-nai.png'
receipt = HERE / f'{slug}-nai-request.json'
assert not OUT.exists() and not receipt.exists(), 'Use a new candidate path.'
composition = ('wide balanced composition, subject to the right of center, left third quiet, '
               'only a few large connected shapes, one continuous atmospheric environment, '
               'coherent foreground middle distance and background, soft transitions between '
               'masses, complete readable silhouettes, economical brushwork, no split panels')
prompt = style.build_asset_prompt(spec['scene'],
    purpose_layer='abstract hand-painted game transition illustration, communicate mood and direction',
    composition_layer=composition, light_material_layer=spec['light'])
uc = style.build_uc('text, letters, numbers, watermark, people, detailed city, windows, pipes, '
                    'cables, machinery, complicated architecture, detailed rails, tiny objects, '
                    'decorative clutter, collage, split screen, photorealistic, 3d render')
if slug == 'city-gate':
    uc = style.build_uc(uc + ', mountains, cliffs, rocks, wilderness, forest, snow field, '
                       'ancient ruins, stone arch, temple, crystal, sunny, daylight, '
                       'white sky, pastoral landscape, fantasy landscape, busy neon signs')
uc = ', '.join(term for term in uc.split(', ') if term.strip() != 'negative space')
model = 'nai-diffusion-4-5-full'
payload = nai_gen.build_payload(prompt, uc, width=768, height=512, seed=spec['seed'],
                               model=model, char_prompts=[])
record = dict(status='prepared', name=spec['name'], request=payload, output=str(OUT),
              recipe_version=style.RECIPE_VERSION,
              localNegativeAdjustment='移除negative space，避免与左侧安静留白冲突；共享配方不改',
              userConstraint='可抽象；场景不具体化，不增加不合理细节或割裂拼贴')
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, seed = nai_gen.generate_image(prompt, uc, width=768, height=512,
                                       seed=spec['seed'], model=model, out=OUT, char_prompts=[])
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__, error=str(error))
    save()
    raise
record.update(status='generated', seed=seed, sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
