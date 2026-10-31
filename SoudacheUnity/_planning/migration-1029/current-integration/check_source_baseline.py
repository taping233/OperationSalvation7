from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone

here = Path(__file__).resolve().parent
root = here.parents[3]
manifest = here.parent / 'current-ui-version' / 'runtime-source-manifest.json'
data = json.loads(manifest.read_text(encoding='utf-8-sig'))
inputs = {}
def collect(value):
    if isinstance(value, dict):
        if 'path' in value and 'sha256' in value and not value['path'].replace('\\','/').startswith('SoudacheUnity/'):
            inputs[value['path']] = value['sha256']
        for child in value.values():
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)
collect(data)
changes = []
for relative, expected in inputs.items():
    path = root / relative
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    if actual != expected:
        changes.append({'path':relative,'expected':expected,'actual':actual})
result = {'checkedUtc':datetime.now(timezone.utc).isoformat(),'passed':bool(inputs) and not changes,
          'scope':'Recorded current runtime-source JS/CSS/JSON/HTML file bytes, not asset files or new unrecorded imports',
          'inputCount':len(inputs),'changes':changes}
(here / 'source-baseline-check.json').write_text(json.dumps(result,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=True))
raise SystemExit(0 if result['passed'] else 2)
