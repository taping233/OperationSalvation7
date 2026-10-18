"""Read-only raster inspection; writes asset metadata and plan status, never pixels."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--register', nargs=3, metavar=('ID', 'FILE', 'SOURCE'))
parser.add_argument('--variant', nargs=4, metavar=('ID', 'VARIANT', 'FILE', 'SOURCE'))
parser.add_argument('--candidate', metavar='FILE')
parser.add_argument('--neutral-anchors', action='store_true')
parser.add_argument('--activate', metavar='JSON')
args = parser.parse_args()
if args.candidate:
    path = ROOT / args.candidate
    with Image.open(path) as img:
        if 'A' not in img.getbands():
            raise SystemExit('Candidate has no alpha')
        alpha = img.getchannel('A')
        corners = [alpha.getpixel(pt) for pt in [(0,0),(img.width-1,0),(0,img.height-1),(img.width-1,img.height-1)]]
        bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
        if not bounds or any(corners):
            raise SystemExit('Candidate alpha margin failed')
        print(json.dumps({'file':args.candidate,'size':img.size,'solidBounds':bounds,'cornerAlpha':corners,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}, ensure_ascii=False))
    raise SystemExit(0)
plan_path = ROOT / 'parts-plan.json'
plan = json.loads(plan_path.read_text(encoding='utf-8-sig'))
index_path = ROOT / 'asset-index.json'
index = json.loads(index_path.read_text(encoding='utf-8-sig')) if index_path.exists() else {}
if args.activate:
    for item in json.loads(Path(args.activate).read_text(encoding='utf-8-sig')):
        part_id = item['id']
        if item.get('variant'):
            index[part_id].setdefault('variants', {})[item['variant']] = {'file':item['file'],'source':item['source']}
        else:
            part = next(p for p in plan['parts'] if p['id'] == part_id)
            part.update(file=item['file'],status='draft-ready',placement='按统一母版比例重新配准')
            index.setdefault(part_id, {}).update(file=item['file'],source=item['source'])
if args.register:
    part_id, filename, source = args.register
    part = next(p for p in plan['parts'] if p['id'] == part_id)
    part.update(file=filename, status='draft-ready', placement='独立源图，待拼装配准')
    index.setdefault(part_id, {}).update(source=source, file=filename)
if args.variant:
    part_id, variant, filename, source = args.variant
    if part_id not in index:
        raise SystemExit('Register primary asset first')
    index[part_id].setdefault('variants', {}).setdefault(variant, {}).update(file=filename, source=source)
errors = []
for part in plan['parts']:
    if not part.get('file'):
        continue
    path = ROOT / part['file']
    with Image.open(path) as img:
        if 'A' not in img.getbands():
            errors.append(part['id'] + ': no alpha channel')
            continue
        alpha = img.getchannel('A')
        opaque_bbox = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
        histogram = alpha.histogram()
        transparent_ratio = histogram[0] / (img.width * img.height)
        if not opaque_bbox or transparent_ratio < 0.05:
            errors.append(part['id'] + ': missing solid object or empty alpha margin')
        corner_alpha = [alpha.getpixel(pt) for pt in [(0, 0), (img.width-1, 0), (0, img.height-1), (img.width-1, img.height-1)]]
        if any(corner_alpha):
            errors.append(part['id'] + ': nontransparent corner')
        index.setdefault(part['id'], {}).update(
            file=part['file'], width=img.width, height=img.height,
            solidBounds=opaque_bbox, alphaBounds=alpha.getbbox(),
            transparentRatio=round(transparent_ratio, 4), cornerAlpha=corner_alpha,
            bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            pixelCheck='passed' if opaque_bbox and transparent_ratio >= 0.05 and not any(corner_alpha) else 'failed',
            visualStage='needs-assembly-review')
for part_id, primary in index.items():
    for name, variant in primary.get('variants', {}).items():
        path = ROOT / variant['file']
        with Image.open(path) as img:
            if 'A' not in img.getbands() or img.size != (primary['width'], primary['height']):
                errors.append(part_id + ':' + name + ': alpha/canvas mismatch')
                continue
            alpha = img.getchannel('A')
            bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
            corners = [alpha.getpixel(pt) for pt in [(0,0),(img.width-1,0),(0,img.height-1),(img.width-1,img.height-1)]]
            if not bounds or any(corners) or max(abs(a-b) for a,b in zip(bounds, primary['solidBounds'])) > 8:
                errors.append(part_id + ':' + name + ': silhouette registration mismatch')
            variant.update(width=img.width, height=img.height, solidBounds=bounds,
                bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                cornerAlpha=corners, pixelCheck='passed' if bounds and not any(corners) else 'failed')
if args.neutral_anchors:
    for part_id in ['16','17','19','20']:
        item = index[part_id]
        x0,y0,x1,y1 = item['solidBounds']
        points, widths = [], []
        with Image.open(ROOT / item['file']) as img:
            alpha = img.getchannel('A')
            for ratio in [.06,.94]:
                row = round(y0+(y1-y0)*ratio)
                xs = [x for x in range(x0,x1) if alpha.getpixel((x,row)) >= 128]
                if not xs:
                    raise SystemExit(part_id+': no opaque joint cross-section')
                points.append([round(((xs[0]+xs[-1])/2-x0)/(x1-x0),6),round((row-y0)/(y1-y0),6)])
                widths.append(xs[-1]-xs[0]+1)
        item.update(boneAnchors=points,joinWidths=widths,sourcePose='neutral-vertical')
if errors:
    raise SystemExit('\n'.join(errors))
index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'generated': len(index), 'total': len(plan['parts']), 'pixelErrors': errors}, ensure_ascii=False))
