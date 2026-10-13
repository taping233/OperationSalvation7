"""老板确认v2提示词后生成单张候选，复用现行客户端与共享护栏。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image

EVIDENCE = Path(__file__).resolve().parent
request = json.loads((EVIDENCE / 'request-v2.json').read_text(encoding='utf-8'))
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai-v2.png'
if output.exists():
    raise SystemExit('v2候选已存在，停止以避免重复调用或覆盖。')
path, seed = generate_image(
    request['prompt'], request['negative_prompt'], char_prompt=request['character_prompt'],
    width=request['width'], height=request['height'], seed=request['seed'],
    out=output, model=request['model'],
)
result = Path(path)
receipt = {
    'path': str(result), 'seed': seed, 'model': request['model'],
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'request': 'request-v2.json', 'installed': False,
}
(EVIDENCE / 'receipt-v2.json').write_text(
    json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
