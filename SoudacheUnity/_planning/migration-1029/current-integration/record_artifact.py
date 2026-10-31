from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone

here = Path(__file__).resolve().parent
project = here.parents[2]
root = project.parent
output = root / '\u641c\u6253\u64a4' / 'docs' / 'evidence' / '2026-10-29-unity-desktop' / 'current-build-2'
build = project / 'Build' / 'Desktop'
info = json.loads((build / 'build-info.json').read_text(encoding='utf-8-sig'))
assert info['result'] == 'Succeeded' and info['errors'] == 0 and info['inputsUnchanged']
def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    return digest.hexdigest()
files = [{'path':p.relative_to(build).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}
         for p in sorted(build.rglob('*')) if p.is_file()]
executable = next(item for item in files if item['path'] == '\u4ee3\u53f7\u67d2.exe')
assert executable['sha256'] == info['executableSha256']
result = {'checkedUtc':datetime.now(timezone.utc).isoformat(),'passed':True,
          'acquisition':'Local Unity BuildPipeline, StandaloneWindows64, current-build-2; no publishing or upload',
          'buildDirectory':str(build),'unity':info['unity'],'inputCount':len(info['inputs']),
          'files':files,'fileCount':len(files),'totalBytes':sum(f['bytes'] for f in files),
          'binaryStorage':'Local only. Binary files larger than 1MB, audio and fonts are not staged or committed.'}
(output / 'artifact-manifest.json').write_text(json.dumps(result,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ('passed','inputCount','fileCount','totalBytes')}))
