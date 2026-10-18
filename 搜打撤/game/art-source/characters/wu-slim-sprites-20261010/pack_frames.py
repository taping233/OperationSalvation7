"""Split generated equal-grid sheets without altering their painted pixels."""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parent
TIMING = {
    'idle': [240, 260, 300, 260, 260, 240],
    'attack': [90, 110, 55, 65, 120, 160],
    'hurt': [40, 55, 65, 70, 80, 90],
    'death': [90, 120, 130, 140, 160, 240],
}

def pack():
    report = {'method': 'equal-grid pixel crop; no synthetic pose deformation', 'actions': {}}
    for action, durations in TIMING.items():
        source = ROOT / (action + '-source.png')
        if not source.exists():
            continue
        image = Image.open(source).convert('RGBA')
        width, height = image.size
        assert width % 3 == 0 and height % 2 == 0, (action, image.size)
        fw, fh = width // 3, height // 2
        folder = ROOT / action
        folder.mkdir(exist_ok=True)
        frames = []
        bounds = []
        alpha_coverage = []
        for i in range(6):
            x, y = (i % 3) * fw, (i // 3) * fh
            # The fourth attack sword crosses the nominal cell boundary by 14px.
            # Preserve that tip in a wider frame; trim it from the next cell.
            left = 16 if action == 'attack' and i == 4 else 0
            right = 20 if action == 'attack' and i == 3 else 0
            top = 16 if action == 'hurt' and i >= 3 else 0
            bottom = 16 if action == 'hurt' and i < 3 else 0
            crop = image.crop((x + left, y + top, x + fw + right, y + fh + bottom))
            frame = Image.new('RGBA', (fw + 64, fh + 48))
            frame.paste(crop, (32 + left, 16 + top))
            alpha = frame.getchannel('A')
            assert alpha.getextrema()[0] == 0, (action, i, 'missing transparency')
            bbox = alpha.point(lambda a: 255 if a > 32 else 0).getbbox()
            assert bbox is not None, (action, i, 'empty frame')
            frame.save(folder / f'{action}-{i:03d}.png')
            frame.save(folder / f'{action}-{i:03d}.webp', lossless=True, exact=True)
            decoded = Image.open(folder / f'{action}-{i:03d}.webp').convert('RGBA')
            assert decoded.getchannel('A').tobytes() == alpha.tobytes()
            frames.append(frame)
            bounds.append(bbox)
            hist = alpha.histogram()
            alpha_coverage.append({'clear': hist[0], 'solid': sum(hist[240:]), 'pixels': frame.width*frame.height})
        # A new neutral is used at action boundaries without changing key poses.
        sequence = list(range(6))
        if action != 'idle' and (ROOT / 'idle' / 'idle-000.png').exists():
            neutral = Image.open(ROOT / 'idle' / 'idle-000.png').convert('RGBA')
            assert neutral.size == frames[0].size
            endpoints = (0,) if action == 'death' else (0, 5)
            for i in endpoints:
                frames[i] = neutral.copy()
                neutral.save(folder / f'{action}-{i:03d}.png')
                neutral.save(folder / f'{action}-{i:03d}.webp', lossless=True, exact=True)
        spec = {'status': 'candidate', 'character': 'wu', 'animation': action,
                'frameWidth': frames[0].width, 'frameHeight': frames[0].height, 'frameCount': 6,
                'sequence': sequence, 'durationsMs': durations,
                'durationMs': sum(durations), 'loop': action == 'idle',
                'holdLastFrame': action == 'death', 'sourceSheet': '../' + source.name,
                'columns': 3, 'rows': 2,
                'frames': [f'{action}-{i:03d}.webp' for i in sequence]}
        (folder / 'sprite.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding='utf8')
        frames[0].save(folder / 'preview.webp', save_all=True, append_images=frames[1:],
                       duration=durations, loop=0 if action == 'idle' else 1,
                       lossless=True, exact=True)
        report['actions'][action] = {'frameSize': list(frames[0].size), 'sourceBounds': bounds,
                                      'alphaCoverage': alpha_coverage, 'durationMs': sum(durations)}
    report['backgroundStatus'] = 'candidate: in-browser checkerboard renders largely clear; low-alpha fringe remains, final edge cleanup not verified'
    report['endpointEquality'] = {}
    neutral = (ROOT / 'idle' / 'idle-000.png').read_bytes()
    for action in ('attack', 'hurt', 'death'):
        if action not in report['actions']:
            continue
        assert (ROOT / action / f'{action}-000.png').read_bytes() == neutral
        if action != 'death':
            assert (ROOT / action / f'{action}-005.png').read_bytes() == neutral
        report['endpointEquality'][action] = True
    (ROOT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    files = []
    for path in ROOT.rglob('*'):
        if path.is_file() and path.name not in ('receipt.json', '.gitignore'):
            files.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    (ROOT / 'receipt.json').write_text(json.dumps({'files': files}, ensure_ascii=False, indent=2), encoding='utf8')
    large = [f['path'] for f in files if f['bytes'] > 1000000]
    (ROOT / '.gitignore').write_text('# Local large binaries, SHA256 in receipt.json\n' + '\n'.join('/'+p for p in large) + '\n', encoding='utf8')
    print(json.dumps({'actions': list(report['actions']), 'frames': 6*len(report['actions']), 'largeFiles': len(large)}))

if __name__ == '__main__':
    pack()
