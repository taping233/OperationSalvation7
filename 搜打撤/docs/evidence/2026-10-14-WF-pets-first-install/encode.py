"""Install the six approved first-pass built-in redraws, preserving alpha."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a13ae1-54ce-73e0-8c64-7cb3dcde601a')
JOBS = {
    'dog': 'exec-85517f9f-c1f8-4469-8ec2-cf1edcd95d57.png',
    'falcon': 'exec-e9c8b75e-07fd-47e5-83d8-f3bf79d830ad.png',
    'cat': 'exec-0084af10-b1bd-449b-95bf-7291d2899699.png',
    'robot': 'exec-a73eaf6b-d5b8-4d15-8532-0b47c031bcb2.png',
    'fire': 'exec-0af9e60d-6f48-4af7-b87f-32a53bbe494d.png',
    'penguin': 'exec-03e9167c-86e4-40c3-93ee-46c6bbc91b9e.png',
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def install():
    manifest_path = ROOT / 'game/assets/asset-manifest.json'
    original = manifest_path.read_text(encoding='utf-8')
    manifest = json.loads(original)
    entries = {entry['path']: entry for entry in manifest['assets']}
    prepared = []
    for pet, filename in JOBS.items():
        image = Image.open(SOURCE / filename).convert('RGBA')
        assert image.getchannel('A').getextrema() == (0, 255), pet
        output = ROOT / f'game/assets/icons/base-v3/companion-{pet}.webp'
        assert output.exists() and f'icons/base-v3/companion-{pet}.webp' in entries
        prepared.append((pet, filename, image, output))
    (HERE / 'source').mkdir(exist_ok=True)
    records = []
    updated = original
    for pet, filename, image, output in prepared:
        raw = HERE / 'source' / f'{pet}.png'
        shutil.copy2(SOURCE / filename, raw)
        image.thumbnail((720, 720), Image.Resampling.LANCZOS)
        image.save(output, 'WEBP', quality=88, method=6)
        check = Image.open(output)
        assert check.mode == 'RGBA' and check.getchannel('A').getextrema() == (0, 255)
        entry = entries[f'icons/base-v3/companion-{pet}.webp']
        old_text = json.dumps(entry, ensure_ascii=False, indent=2)
        entry.update(bytes=output.stat().st_size, sha256=sha(output),
                     source=str((HERE / 'receipts.json').relative_to(ROOT)).replace('\\', '/'))
        entry['provenance'] = {
            'kind': 'generated-source-and-conversion-record',
            'sourceSha256': sha(raw),
            'rawPath': str(raw.relative_to(ROOT)).replace('\\', '/'),
            'encoder': str(Path(__file__).relative_to(ROOT)).replace('\\', '/'),
            'outputBytesMatch': True,
        }
        new_text = json.dumps(entry, ensure_ascii=False, indent=2)
        old_block = '\n'.join('    ' + line for line in old_text.splitlines())
        new_block = '\n'.join('    ' + line for line in new_text.splitlines())
        assert updated.count(old_block) == 1, pet
        updated = updated.replace(old_block, new_block, 1)
        records.append({'id': pet, 'generatedSource': str(SOURCE / filename),
                        'rawPath': entry['provenance']['rawPath'], 'sourceSha256': sha(raw),
                        'rawBytes': raw.stat().st_size,
                        'outputPath': str(output.relative_to(ROOT)).replace('\\', '/'),
                        'outputSha256': sha(output), 'outputBytes': output.stat().st_size,
                        'size': list(check.size), 'alphaExtrema': [0, 255]})
    (HERE / 'receipts.json').write_text(json.dumps({'selection': '本轮六张第一版内置重绘，非可爱版或后续Q版', 'jobs': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest_path.write_text(updated, encoding='utf-8', newline='\n')
    print(json.dumps(records, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    install()
