"""老板授权生成记忆核实后的v5提示词，单张候选。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
import nai_style

EVIDENCE = Path(__file__).resolve().parent
request = json.loads((EVIDENCE / 'request-v5.json').read_text(encoding='utf-8'))
if request['artist'] != nai_style.ARTIST_BLOCK or not request['prompt'].endswith(nai_style.STYLE_BLOCK):
    raise SystemExit('共享画风输入变化，停止核对。')
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v5.png'
if output.exists():
    raise SystemExit('v5候选已存在，停止重复请求或覆盖。')
seed = build_payload(request['prompt'], seed=None)['parameters']['seed']
(EVIDENCE / 'request-v5-sent.json').write_text(json.dumps({
    **request, 'seed': seed, 'status': '老板授权的v5单张请求',
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(
    request['prompt'], request['negative_prompt'], char_prompt=request['character_prompt'],
    width=request['width'], height=request['height'], seed=seed, out=output,
    model=request['model'],
)
result = Path(path)
(EVIDENCE / 'receipt-v5.json').write_text(json.dumps({
    'path': str(result), 'model': request['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'request': 'request-v5-sent.json', 'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
