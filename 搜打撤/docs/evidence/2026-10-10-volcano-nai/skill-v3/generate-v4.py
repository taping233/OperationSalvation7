"""老板授权生成已整理的v4请求，单张、随机seed、既有客户端护栏。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload

EVIDENCE = Path(__file__).resolve().parent
request = json.loads((EVIDENCE / 'request-v4.json').read_text(encoding='utf-8'))
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v4.png'
if output.exists():
    raise SystemExit('v4候选已存在，停止重复请求或覆盖。')
seed = build_payload(request['prompt'], seed=None)['parameters']['seed']
actual_request = {**request, 'seed': seed, 'status': '老板授权的v4单张请求'}
(EVIDENCE / 'request-v4-sent.json').write_text(
    json.dumps(actual_request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(
    request['prompt'], request['negative_prompt'], char_prompt=request['character_prompt'],
    width=request['width'], height=request['height'], seed=seed, out=output,
    model=request['model'],
)
result = Path(path)
(EVIDENCE / 'receipt-v4.json').write_text(json.dumps({
    'path': str(result), 'model': request['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'request': 'request-v4-sent.json', 'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
