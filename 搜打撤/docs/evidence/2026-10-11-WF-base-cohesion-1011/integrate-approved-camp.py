"""Encode the approved A21 without resizing/cropping; write its runtime receipt."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

project = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
source = Path('C:/Users/太平/.codex/generated_images/01a128f5-bd4a-7891-91c7-ab5106c5d409/exec-710ed4ab-ed27-4625-bf72-ba5a1c095cdd.png')
target = project / 'game/assets/scenes/base-operations-v5.webp'
assert not target.exists(), 'Runtime destination already exists; inspect before replacing.'
with Image.open(source) as original:
    size = original.size
    original.save(target, format='WEBP', quality=88, method=6)
with Image.open(target) as encoded:
    assert encoded.size == size
    encoded.verify()
assert target.stat().st_size < 1024 * 1024
receipt = {
    'approvedCandidate': 'A21',
    'authorization': '老板：可以了 接入吧',
    'styleExperiment': 'E3',
    'requestChain': ['style-lab-requests.json', 'camp-e3-application-a18.json', 'camp-detail-a19.json', 'camp-textile-a20.json', 'camp-plain-materials-a21.json'],
    'source': {'path': str(source), 'bytes': source.stat().st_size, 'sha256': sha256(source.read_bytes()).hexdigest(), 'excludedFromGit': True},
    'runtime': {'path': target.relative_to(project).as_posix(), 'bytes': target.stat().st_size, 'sha256': sha256(target.read_bytes()).hexdigest(), 'size': list(size)},
    'operation': 'same-size WebP encoding only; no crop, resize or pixel edits',
    'referenceUse': 'GFL2 original used for study/style reference only, not runtime content',
}
(evidence / 'camp-runtime-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=True))
