"""Encode seven authorized card-back replacements and return scoped metadata."""
import hashlib
import json
import shutil
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

options = argparse.ArgumentParser()
options.add_argument('--evidence')
options.add_argument('--raw-dir')
args = options.parse_args()
EVIDENCE = Path(args.evidence).resolve() if args.evidence else Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
ASSETS = PROJECT / 'game/assets'
RAW = Path(args.raw_dir).resolve() if args.raw_dir else PROJECT / '.tmp/imagegen/cardbacks-redraw-20261012'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    request = json.loads((EVIDENCE / 'request.json').read_text(encoding='utf-8'))
    receipt_file = EVIDENCE / 'receipt.json'
    receipt = json.loads(receipt_file.read_text(encoding='utf-8')) if receipt_file.exists() else None
    if RAW.exists() and receipt is None:
        raise SystemExit('Backup exists without import receipt; stop and reconcile.')
    completed = {item['id'] for item in receipt['items']} if receipt else set()
    manifest = json.loads((ASSETS / 'asset-manifest.json').read_text(encoding='utf-8'))
    prepared = []
    for item in request['items']:
        if item['id'] in completed or 'imagegen_source' not in item:
            continue
        source = Path(item['imagegen_source'])
        target = ASSETS / item['asset']
        entry = next(row for row in manifest['assets'] if row['path'] == item['asset'])
        if not source.is_file() or not target.is_file():
            raise SystemExit('Missing generated source or current asset: ' + item['id'])
        prepared.append((item, source, target, entry))
    if not prepared:
        raise SystemExit('No new completed images to import.')
    RAW.mkdir(parents=True, exist_ok=receipt is not None)
    receipt = receipt or {'workflow': request.get('workflow', 'NovelAI draft then built-in ImageGen repaint'),
               'verification': 'Generated images viewed; no tests/browser/audit/build requested',
               'manifest_count': manifest['count'], 'items': []}
    patches = []
    for index, (item, source, target, entry) in enumerate(prepared):
        backup = RAW / (item['id'] + '-before.webp')
        saved = RAW / (item['id'] + '-source.png')
        if backup.exists() or saved.exists():
            raise SystemExit('Existing source or backup; do not replace: ' + item['id'])
        shutil.copy2(target, backup)
        shutil.copy2(source, saved)
        with Image.open(source) as original:
            image = original.convert('RGB').resize((512, 768), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=88, method=6)
        after = dict(entry, bytes=target.stat().st_size, sha256=sha(target),
                     license='项目自有（AI生成）',
                     source=receipt_file.relative_to(PROJECT).as_posix())
        patches.append({'before': entry, 'after': after})
        receipt['items'].append({'id': item['id'], 'name': item['name'], 'concept': item['concept'],
                                'path': item['asset'], 'bytes': after['bytes'], 'sha256': after['sha256'],
                                'generation_source': str(source), 'generation_sha256': sha(source),
                                'saved_source': saved.relative_to(PROJECT).as_posix(),
                                'backup': backup.relative_to(PROJECT).as_posix(),
                                'backup_sha256': sha(backup), 'size': [512, 768]})
        receipt_file.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    if len(receipt['items']) == 7:
        sheet = Image.new('RGB', (7 * 180, 290), '#202020')
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 14)
        for index, item in enumerate(request['items']):
            with Image.open(ASSETS / item['asset']) as original:
                image = original.convert('RGB')
            image.thumbnail((168, 252), Image.Resampling.LANCZOS)
            sheet.paste(image, (index * 180 + 6, 6))
            draw.text((index * 180 + 8, 267), item['name'], fill='#eeeeee', font=font)
        sheet.save(EVIDENCE / 'seven-cardbacks.png')
    print(json.dumps({'patches': patches, 'count': manifest['count']}, ensure_ascii=True))

if __name__ == '__main__':
    main()
