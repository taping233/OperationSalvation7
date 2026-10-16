"""Verify receipt-bound pixels, or reproduce candidates without editing game files."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent

def digest(value):
    return hashlib.sha256(value).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--output-dir', type=Path)
    args = parser.parse_args()
    if not args.verify_only and args.output_dir is None:
        parser.error('Use --verify-only or provide --output-dir; never overwrite source assets')
    receipt = json.loads((HERE / 'receipt.json').read_text())
    checked = 0
    for item in receipt['files']:
        source = ROOT / 'game/assets' / item['path']
        assert digest(source.read_bytes()) == item['newSha256'], str(source)
        image = Image.open(source).convert('RGBA')
        assert list(image.size) == item['size']
        assert digest(image.tobytes()) == item['rgbaSha256']
        assert digest(image.getchannel('A').tobytes()) == item['alphaSha256']
        if not args.verify_only:
            destination = args.output_dir / item['path']
            assert destination.resolve() != source.resolve()
            destination.parent.mkdir(parents=True, exist_ok=True)
            image.save(destination, 'WEBP', lossless=True, quality=100, method=6, exact=True)
            assert digest(destination.read_bytes()) == item['newSha256'], str(destination)
        checked += 1
    animation_files = []
    texture_files = set()
    for role in ['wu', 'changwuyu', 'baita', 'heixiang', 'xingyue']:
        base = ROOT / 'game/assets/portraits/frames' / role
        catalog_path = base / 'sprite-v1/animations.json'
        catalog = json.loads(catalog_path.read_text())
        names = set(name for sequence in catalog['sequences'].values() for name in sequence)
        if catalog.get('staticFallback'):
            names.add(catalog['staticFallback'])
        names.add('sprite-v1/neutral')
        for name in names:
            texture_path = base / (name + '.webp')
            Image.open(texture_path).load()
            texture_files.add(str(texture_path.relative_to(ROOT)))
        animation_files.append({'path': str(catalog_path.relative_to(ROOT)),
                                'sha256': digest(catalog_path.read_bytes()),
                                'uniqueTextureNames': len(names)})
    print(json.dumps({'encodedFilesVerified': checked, 'allRGBAAndAlphaMatch': True,
                      'catalogs': animation_files, 'catalogTextureFilesDecoded': len(texture_files)}, indent=2))

if __name__ == '__main__':
    main()
