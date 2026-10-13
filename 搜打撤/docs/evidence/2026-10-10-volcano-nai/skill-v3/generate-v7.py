"""重绘推荐A分镜；背景依撕裂与火山压力设计，不锁固定颜色。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
import nai_style

EVIDENCE = Path(__file__).resolve().parent
book = json.loads((EVIDENCE / 'storyboards-v7.json').read_text(encoding='utf-8'))
plan = next(p for p in book['plans'] if p['id'] == 'A')
old_background = (
    'Plain light warm-gray background fills the canvas. '
    'One dominant orange lava shape contrasts with the connected dark figure; '
    'the background stays quiet and the dark fabric remains distinct from the energy.'
)
new_background = (
    'The background echoes the tension of the torn card: broad abstract pressure '
    'planes diverge from the ripping point and open into a calmer negative-space '
    'pocket around the face. Choose background hues and values to distinguish the '
    'dark figure, torn paper edges and incandescent lava. The eruption illuminates '
    'nearby planes while distant areas remain quiet. Carry these abstract painted '
    'planes to the canvas edges as one continuous illustration.'
)
if plan['prompt'].count(old_background) != 1:
    raise SystemExit('A方案背景结构变化，停止核对。')
prompt = plan['prompt'].replace(old_background, new_background, 1)
# 留一种抽象简化背景形态，但撤去固定色排除。
uc_terms = [term.strip() for term in plan['negative_prompt'].split(',')]
uc = ', '.join(term for term in uc_terms if term != 'blue background')
if not prompt.startswith(nai_style.ARTIST_BLOCK + '\n\n') or not prompt.endswith(nai_style.STYLE_BLOCK):
    raise SystemExit('正式共享画师链/画风原文变化，停止。')
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v7.png'
if output.exists():
    raise SystemExit('v7候选已存在，禁止重复请求或覆盖。')
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {
    'status': '老板授权重绘，采用推荐A撕卡分镜',
    'model': book['model'], 'width': book['width'], 'height': book['height'],
    'parameters': book['parameters'], 'seed': seed,
    'prompt': prompt, 'character_prompt': plan['character_prompt'], 'negative_prompt': uc,
    'background': '由撕卡张力/火山积压/喷发设计抽象块面，颜色不预锁；撤去blue background排除',
    'parent_plan': 'storyboards-v7.json / A', 'installed': False,
}
(EVIDENCE / 'request-v7-sent.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(
    prompt, uc, char_prompt=plan['character_prompt'],
    width=book['width'], height=book['height'], seed=seed, out=output, model=book['model'],
)
result = Path(path)
(EVIDENCE / 'receipt-v7.json').write_text(json.dumps({
    'path': str(result), 'model': book['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'request': 'request-v7-sent.json', 'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
