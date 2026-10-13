import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload

request_path = EVIDENCE / 'nai-request-v2.json'
request = json.loads(request_path.read_text(encoding='utf-8'))
output = Path(request['output'])
if output.exists():
    raise SystemExit('v2 output already exists; stop')
seed = build_payload(request['prompt'], seed=None)['parameters']['seed']
request['seed'] = seed
request['status'] = 'v2生成已发起'
request_path.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(request['prompt'], request['negative_prompt'],
    char_prompt=request['character_prompt'], width=request['width'], height=request['height'],
    seed=seed, out=output, model=request['model'])
source = Path(path)
receipt = dict(path=str(source), seed=seed, model=request['model'], bytes=source.stat().st_size,
    sha256=hashlib.sha256(source.read_bytes()).hexdigest(), installed=False)
(EVIDENCE / 'nai-receipt-v2.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
request['status'] = 'v2 NAI草稿已生成，待内置重绘'
request_path.write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
