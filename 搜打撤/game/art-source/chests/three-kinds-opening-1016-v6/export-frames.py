from pathlib import Path
from shutil import copy2
import hashlib
import json
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = Path.home() / '.codex/generated_images/01a144bf-e46e-7a33-a751-68f09f9e8cdf'
SIZE = 640
MARGIN = 18
RESAMPLE = getattr(Image, 'Resampling', Image).LANCZOS


def mask_bbox(image, threshold=12):
    return image.getchannel('A').point(lambda v: 255 if v >= threshold else 0).getbbox()


def get_frames(sheet):
    width, height = sheet.size
    assert width == height and width % 2 == 0
    edge = width // 2
    return [sheet.crop((i % 2 * edge, i // 2 * edge,
                        (i % 2 + 1) * edge, (i // 2 + 1) * edge)) for i in range(4)]


def body_anchor(frame):
    start = int(frame.height * .64)
    band = frame.crop((0, start, frame.width, frame.height))
    left, top, right, bottom = mask_bbox(band, 128)
    return ((left + right) / 2, start + bottom, right - left)


def fx_anchor(frame):
    alpha = frame.getchannel('A')
    score = ImageChops.multiply(frame.convert('L'), alpha).filter(ImageFilter.GaussianBlur(2))
    width, height = frame.size
    bounds = (int(width * .3), int(height * .55), int(width * .7), int(height * .85))
    region = score.crop(bounds)
    maximum = region.getextrema()[1]
    choices = [(x + bounds[0], y + bounds[1]) for y in range(region.height)
               for x in range(region.width) if region.getpixel((x, y)) >= maximum - 1]
    x, y = min(choices, key=lambda p: (p[0] - width * .5) ** 2 + (p[1] - height * .7) ** 2)
    return x, y, 1


def common_width(frames, anchors, desired=500, baseline=560):
    limit = desired
    for frame, (cx, bottom, width) in zip(frames, anchors):
        left, top, right, last = mask_bbox(frame)
        ratios = [(SIZE / 2 - MARGIN, (cx - left) / width),
                  (SIZE / 2 - MARGIN, (right - cx) / width),
                  (baseline - MARGIN, (bottom - top) / width),
                  (SIZE - baseline - MARGIN, (last - bottom) / width)]
        for space, ratio in ratios:
            if ratio > 0:
                limit = min(limit, space / ratio)
    return limit


def place(frame, scale, anchor, destination):
    image = frame.resize((round(frame.width * scale), round(frame.height * scale)), RESAMPLE)
    x = round(destination[0] - anchor[0] * scale)
    y = round(destination[1] - anchor[1] * scale)
    canvas = Image.new('RGBA', (SIZE, SIZE))
    # Clip only the source canvas; all visible artwork is fitted inside MARGIN.
    left, top = max(0, x), max(0, y)
    right, bottom = min(SIZE, x + image.width), min(SIZE, y + image.height)
    region = image.crop((left - x, top - y, right - x, bottom - y))
    canvas.alpha_composite(region, (left, top))
    box = mask_bbox(canvas, 16)
    assert box and all((box[0] > 0, box[1] > 0, box[2] < SIZE, box[3] < SIZE))
    return canvas


def write_outputs(kind, frames, anchors, fitted_width):
    folder = ROOT / kind
    folder.mkdir(exist_ok=True)
    records = []
    for index, (frame, anchor) in enumerate(zip(frames, anchors)):
        scale = fitted_width / anchor[2]
        baseline = 470 if kind == 'fx' else 560
        result = place(frame, scale, anchor, (SIZE / 2, baseline))
        png = folder / ('frame-%02d.png' % index)
        webp = folder / ('frame-%02d.webp' % index)
        result.save(png)
        result.save(webp, lossless=True, exact=True, method=6)
        with Image.open(webp) as check:
            assert check.convert('RGBA').tobytes() == result.tobytes()
        records.append({'frame': index, 'png': png.relative_to(ROOT).as_posix(),
                        'webp': webp.relative_to(ROOT).as_posix(),
                        'sourceAnchor': list(anchor), 'scale': scale,
                        'outputBodyCenterX': 320, 'outputBaselineY': baseline,
                        'alphaBBox': list(mask_bbox(result, 16)),
                        'pngSHA256': hashlib.sha256(png.read_bytes()).hexdigest(),
                        'webpSHA256': hashlib.sha256(webp.read_bytes()).hexdigest()})
    images = [Image.open(folder / ('frame-%02d.png' % index)).convert('RGBA') for index in range(4)]
    durations = [600, 160, 140, 900] if kind != 'fx' else [180, 100, 100, 500]
    animation = folder / 'opening.webp'
    images[0].save(animation, save_all=True, append_images=images[1:], duration=durations,
                   loop=0, lossless=True, exact=True, method=6, minimize_size=False)
    apng = folder / 'opening.png'
    images[0].save(apng, save_all=True, append_images=images[1:], duration=durations,
                   loop=0, disposal=0, blend=0)
    with Image.open(animation) as check:
        assert check.n_frames == 4 and check.size == (SIZE, SIZE)
        for index in range(4):
            check.seek(index)
            decoded = check.convert('RGBA')
            assert decoded.getchannel('A').tobytes() == images[index].getchannel('A').tobytes()
            # Animated WebP may normalize RGB under alpha 0; visible pixels must be exact.
            assert all(a == b or not (a[3] or b[3])
                       for a, b in zip(decoded.getdata(), images[index].getdata()))
    return {'frames': records, 'durationsMs': durations, 'preview': kind + '/opening.webp',
            'apng': kind + '/opening.png', 'fittedBodyWidth': fitted_width}


def main():
    source_map = json.loads((ROOT / 'source-map.json').read_text(encoding='utf-8'))
    report = {'size': [SIZE, SIZE], 'format': 'RGBA PNG + lossless RGBA WebP',
              'processing': 'Grid crop, uniform scaling and translation only; no repaint, recolor, masking or added effects.',
              'states': ['closed', 'unlock', 'half-open-flash', 'open-afterglow'], 'assets': {}}
    for kind, filename in source_map.items():
        sheet_path = ROOT / (kind + '-sheet.png')
        if not sheet_path.exists():
            copy2(SOURCE / filename, sheet_path)
        sheet = Image.open(sheet_path).convert('RGBA')
        frames = get_frames(sheet)
        if kind == 'fx':
            anchors = [fx_anchor(frame) for frame in frames]
            width = common_width(frames, anchors, desired=1, baseline=470)
            # FX shares one scale and one aligned source, preserving growth across stages.
            for anchor, frame in zip(anchors, frames):
                left, top, right, bottom = mask_bbox(frame)
                for space, distance in [(302, anchor[0] - left), (302, right - anchor[0]),
                                        (452, anchor[1] - top), (152, bottom - anchor[1])]:
                    if distance > 0:
                        width = min(width, space / distance)
        else:
            anchors = [body_anchor(frame) for frame in frames]
            width = common_width(frames, anchors)
        asset = write_outputs(kind, frames, anchors, width)
        asset.update({'sourcePath': str(SOURCE / filename), 'sheet': sheet_path.name,
                      'sheetSize': list(sheet.size),
                      'sheetSHA256': hashlib.sha256(sheet_path.read_bytes()).hexdigest()})
        report['assets'][kind] = asset
        print(kind, '4 frames, alpha/encoding/preview checks passed')
    (ROOT / 'animation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
