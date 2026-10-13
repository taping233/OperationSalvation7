"""Only encode generated PNGs as same-size WebP previews; no pixel editing."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

evidence = Path(__file__).resolve().parent
generated = Path('C:/Users/太平/.codex/generated_images/01a128f5-bd4a-7891-91c7-ab5106c5d409')
inputs = {
    'a11': 'exec-53b01706-8447-488c-969f-58d0bb3bff66.png',
    'a12': 'exec-266abaf0-a769-4ac0-8bd4-5c1d972f2ee6.png',
    'a13': 'exec-edfc5e27-d2b6-40b1-b137-7d89bc8af0f6.png',
    'a14': 'exec-117c09e2-24c9-475b-93e5-cfebe07f6aa6.png',
    'a15': 'exec-b21f64a1-ee2a-4718-9edd-c8eca95e0edb.png',
    'a16': 'exec-4fb45ed5-8c91-4eaa-88e7-e2ba26018d10.png',
    'a17': 'exec-fd4b0268-f68f-4b0a-a6db-466436d5b98e.png',
    'e1': 'exec-fb24adf6-7718-44da-ada2-82513fc19074.png',
    'e2': 'exec-acb54701-6e7f-411f-ad03-d906f03d476c.png',
    'e3': 'exec-e0449468-46c2-4c35-ab50-37a1950bddcd.png',
    'source-reference': 'C:/Users/太平/Downloads/BG_None_PersonalLounge_01.png',
}
receipts = []
for key, name in inputs.items():
    source = Path(name)
    if not source.is_absolute():
        source = generated / source
    target = evidence / ('camp-redraw-' + key + '.webp')
    with Image.open(source) as original:
        size = original.size
        if not target.exists():
            original.save(target, format='WEBP', quality=88, method=6)
    with Image.open(target) as result:
        assert result.size == size
        result.verify()
    assert target.stat().st_size <= 1024 * 1024
    receipts.append({
        'stage': key.upper(),
        'operation': 'same-size WebP encoding only',
        'source': str(source),
        'sourceBytes': source.stat().st_size,
        'sourceSha256': sha256(source.read_bytes()).hexdigest(),
        'sourceExcludedFromGit': True,
        'preview': target.name,
        'previewBytes': target.stat().st_size,
        'previewSha256': sha256(target.read_bytes()).hexdigest(),
        'size': list(size),
        'runtimeApplied': False,
    })
(evidence / 'camp-redraw-preview-receipts.json').write_text(
    json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(receipts, ensure_ascii=True))
