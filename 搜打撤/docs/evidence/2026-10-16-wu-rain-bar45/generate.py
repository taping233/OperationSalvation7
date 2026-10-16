# -*- coding: utf-8 -*-
import json
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_style
import nai_prompt_clean as clean

HERE = Path(__file__).parent
OUT = ROOT.parent / '.tmp/nai/wu-rain-bar45-20261016.png'
RECEIPT = HERE / 'request.json'
assert not RECEIPT.exists() and not OUT.exists()
metadata = Path('C:/Users/太平/.codex/visualizations/2026/10/16/01a1445b-8923-7510-8ca5-e42df4dfcf9a/bilibili-1257909738195124224-metadata.json')
source = json.loads(metadata.read_text(encoding='utf-8'))[1]
original = json.loads(source['info']['Comment'])
scene_action = original['prompt'].split('\n\nhigh complexity, masterpiece', 1)[0]
assert 'leaning on counter' in scene_action and 'rain-streaked window' in scene_action
assert 'rating:general' not in scene_action
prompt = clean.build_prompt(scene_action, 'high complexity, highly detailed')
uc = clean.build_uc()
previous = json.loads((HERE.parent / '2026-10-16-wu-half-quasarcake45/request.json').read_text(encoding='utf-8'))
appearance = previous['request']['parameters']['characterPrompts'][0]['prompt']
# Use only identity anchors, leaving the scene to determine expression and pose.
appearance = appearance.replace('Confident cheerful smile showing a small fang. ', '')
characters = [{'prompt': appearance, 'uc': '', 'center': {'x': .5, 'y': .5}}]
seed = original['seed']
request = nai_gen.build_payload(prompt, uc, width=1216, height=832, seed=seed,
                               model='nai-diffusion-4-5-full', char_prompts=characters)
assert nai_style.QUALITY_BLOCK == 'masterpiece, best quality, very aesthetic, masterpiece, no text, rating:general'
assert set(original['uc'].split(', ')) <= set(uc.split(', '))
record = dict(status='prepared', recipe_version=nai_style.RECIPE_VERSION,
              source_page='https://www.bilibili.com/opus/1257909738195124224',
              source_image_index=2, source_image_url=source['url'],
              scene_action=scene_action, optional_quality='high complexity, highly detailed',
              request=request, output=str(OUT.relative_to(ROOT.parent)).replace('\\', '/'),
              references=previous['references'])
def save():
    RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(prompt, uc, width=1216, height=832, seed=seed,
        model='nai-diffusion-4-5-full', char_prompts=characters, out=OUT)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=actual_seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
