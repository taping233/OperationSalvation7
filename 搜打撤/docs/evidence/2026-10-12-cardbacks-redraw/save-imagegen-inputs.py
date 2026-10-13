"""Persist actual built-in prompts and generated-source paths for this batch."""
import json
import sys
from pathlib import Path

path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / 'request.json'
request = json.loads(path.read_text(encoding='utf-8'))
incoming = json.load(sys.stdin)
by_id = {item['id']: item for item in incoming}
for item in request['items']:
    if item['id'] in by_id:
        item.update(by_id[item['id']])
request.setdefault('frame_requirement', 'Complete enclosing border on all four sides.')
order = {key: index for index, key in enumerate(['classic', 'wolf', 'coin', 'vault', 'boss', 'altar', 'pet'])}
request['items'].sort(key=lambda item: order.get(item['id'], 99))
path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
print('Saved actual ImageGen inputs for ' + ', '.join(by_id))
