"""Extract drawn poses, bake the agreed idle and export fixed-canvas sprite banks."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import cv2
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[3]
EVIDENCE = PROJECT / 'docs/evidence/2026-10-10-three-role-sprites'
SIZE = (768, 512)
RUNTIME_SIZE = (512, 342)
TARGET_HEIGHT = {'baita': 415, 'heixiang': 325, 'xingyue': 400}
SEQUENCES = {
    'idle': list(range(37)) + list(range(35, 0, -1)),
    'atk': [0, 1, 1, 2, 3, 3, 4, 5, 6, 7],
    'hurt': [0, 1, 1, 1, 2, 2, 2, 3],
    'death': [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5] + [6] * 7,
}
TIMINGS = {
    'idle': [round((i + 1) * 3000 / 72) - round(i * 3000 / 72) for i in range(72)],
    'atk': [42, 41, 42, 42, 41, 42, 42, 41, 42, 42],
    'hurt': [41, 42, 42, 42, 41, 42, 42, 42],
    'death': [round((i + 1) * 875 / 21) - round(i * 875 / 21) for i in range(21)],
}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def extract(path, columns, rows):
    """Group disconnected books/effects with their drawn figure; preserve alpha."""
    rgba = np.array(Image.open(str(path)).convert('RGBA'))
    n, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:, :, 3] > 32).astype('uint8'), 8)
    count = columns * rows
    major = sorted(range(1, n), key=lambda i: stats[i, 4], reverse=True)[:count]
    assert len(major) == count and min(stats[i, 4] for i in major) > 10000
    major.sort(key=lambda i: centers[i, 1])
    ordered = []
    for row in range(rows):
        ordered.extend(sorted(major[row * columns:(row + 1) * columns], key=lambda i: centers[i, 0]))
    groups = {i: [i] for i in ordered}
    for i in range(1, n):
        if i in groups or stats[i, 4] < 12:
            continue
        x, y = centers[i]
        def distance(j):
            bx, by, bw, bh = stats[j, :4]
            dx = max(bx - x, 0, x - bx - bw)
            dy = max(by - y, 0, y - by - bh)
            return dx * dx + dy * dy
        owner = min(ordered, key=distance)
        groups[owner].append(i)
    poses = []
    for i in ordered:
        mask = np.isin(labels, groups[i]).astype('uint8')
        support = cv2.dilate(mask, np.ones((5, 5), np.uint8))
        selected = rgba.copy()
        selected[:, :, 3] *= support
        bounds = Image.fromarray((mask * 255).astype('uint8')).getbbox()
        poses.append({'rgba': selected, 'mask': mask, 'bounds': bounds, 'bodyBounds': stats[i, :4].tolist()})
    return poses


def render(pose, scale, role, action):
    x0, y0, x1, y1 = pose['bounds']
    bx, by, bw, bh = pose['bodyBounds']
    crop = Image.fromarray(pose['rgba'][y0:y1, x0:x1], 'RGBA')
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    if role == 'baita':
        # Chair/left book remain at the same horizontal reference through collapse.
        ox = 145
    elif action == 'death':
        ox = round((SIZE[0] - crop.width) / 2)
    else:
        bottom = by + bh
        foot = pose['mask'][max(by, bottom - 80):bottom].sum(axis=0)
        columns = np.where(foot > 0)[0]
        cuts = np.where(np.diff(columns) > 6)[0]
        front = columns[cuts[-1] + 1:] if len(cuts) else columns
        anchor = float((front[0] + front[-1]) / 2)
        ox = round(510 + (x0 - anchor) * scale)
    oy = round(484 - (y1 - y0) * scale)
    assert ox > 4 and oy > 4 and ox + crop.width < 764, (role, action, ox, oy, crop.size)
    frame = Image.new('RGBA', SIZE)
    frame.paste(crop, (ox, oy))
    return frame


def bake_idle(neutral, role):
    rgba = np.array(neutral)
    yy, xx = np.indices((512, 768), dtype=np.float32)
    weight = np.where(yy < 300, 1, np.where(yy < 365, (1 + np.cos(np.pi * (yy - 300) / 65)) / 2, 0)).astype('float32')
    if role == 'baita':
        # Leave the left chair-back region stable; taper breathing into the torso.
        weight *= np.clip((xx - 220) / 90, 0, 1)
    frames = [neutral.copy()]
    for i in range(1, 37):
        source_y = yy + 1.75 * (1 - np.cos(2 * np.pi * i / 72)) * weight
        sample = cv2.remap(rgba, xx, source_y.astype('float32'), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        frames.append(Image.fromarray(sample, 'RGBA'))
    assert all(np.array_equal(np.array(f)[365:], rgba[365:]) for f in frames)
    return frames


def package(role):
    folder = ROOT / role
    out = folder / 'frames'
    out.mkdir(exist_ok=True)
    neutral_pose = extract(folder / 'base-right-source.png', 1, 1)[0]
    neutral_scale = TARGET_HEIGHT[role] / neutral_pose['bodyBounds'][3]
    neutral = render(neutral_pose, neutral_scale, role, 'idle')
    frames = {'idle': bake_idle(neutral, role)}
    alignment = {'baseScale': neutral_scale, 'groups': {}}
    for action, columns, rows in [('atk', 3, 2), ('hurt', 2, 2), ('death', 2, 3)]:
        source_name = 'attack' if action == 'atk' else action
        poses = extract(folder / (source_name + '-source.png'), columns, rows)
        scale = TARGET_HEIGHT[role] / poses[0]['bodyBounds'][3]
        if role == 'heixiang' and action == 'atk':
            # Sword raises above the head; use the common body scale, not sword bounds.
            scale = 0.91
        use = poses[1:3] if action == 'hurt' else poses
        drawn = [render(p, scale, role, action) for p in use]
        frames[action] = [neutral.copy()] + drawn + ([] if action == 'death' else [neutral.copy()])
        alignment['groups'][action] = {'sharedScale': scale, 'sourceBodyBounds': [p['bodyBounds'] for p in poses]}
    spec = {'character': role, 'width': 768, 'height': 512, 'fps': 24, 'facing': 'right', 'actions': {}}
    runtime = PROJECT / 'game/assets/portraits/frames' / role / 'sprite-v1'
    runtime.mkdir(parents=True, exist_ok=True)
    bank, files, seq = {}, [], {}
    for action, poses in frames.items():
        names = []
        for i, im in enumerate(poses):
            name = '%s-%03d' % (action, i)
            im.save(out / (name + '.png'), compress_level=3)
            im.save(out / (name + '.webp'), lossless=True, exact=True, method=0)
            names.append(name)
        source_sequence = [names[i] for i in SEQUENCES[action]]
        spec['actions'][action] = {'poses': names, 'sequence': source_sequence, 'durationsMs': TIMINGS[action],
                                   'durationMs': sum(TIMINGS[action]), 'loop': action == 'idle', 'holdLastFrame': action == 'death'}
        run_names = []
        for name in source_sequence:
            im = Image.open(str(out / (name + '.png'))).convert('RGBA').resize(RUNTIME_SIZE, Image.Resampling.LANCZOS)
            key = hashlib.sha256(im.tobytes()).hexdigest()
            if key not in bank:
                rt_name = 'neutral' if not bank else 'frame-%03d' % len(bank)
                target = runtime / (rt_name + '.webp')
                im.save(target, lossless=True, exact=True, method=0)
                bank[key] = 'sprite-v1/' + rt_name
                files.append({'path': target.relative_to(PROJECT).as_posix(), 'bytes': target.stat().st_size,
                              'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                              'source': (out / (name + '.png')).relative_to(PROJECT).as_posix(),
                              'license': '项目原创；内置imagegen生成，老板授权游戏使用'})
            run_names.append(bank[key])
        seq[action] = run_names
    seq['cast'] = seq['atk'].copy() if role in ('baita', 'xingyue') else [seq['idle'][0]]
    durations = dict(TIMINGS, cast=TIMINGS['atk'] if role in ('baita', 'xingyue') else [800])
    catalog = {'width': 512, 'height': 342, 'sequences': seq, 'timings': durations,
               'fixedGeometry': True, 'assetVersion': 'sprite-v1', 'facing': 'right'}
    write_json(runtime / 'animations.json', catalog)
    write_json(folder / 'animations.json', spec)
    write_json(folder / 'alignment.json', alignment)
    assert (out / 'idle-000.png').read_bytes() == (out / 'atk-000.png').read_bytes() == (out / 'atk-007.png').read_bytes()
    assert (out / 'idle-000.png').read_bytes() == (out / 'hurt-000.png').read_bytes() == (out / 'hurt-003.png').read_bytes()
    assert seq['death'][0] == seq['idle'][0] and seq['death'][-1] != seq['idle'][0]
    boxes = {a: [im.getchannel('A').point(lambda v: 255 if v > 32 else 0).getbbox() for im in poses] for a, poses in frames.items()}
    assert all(b[0] > 0 and b[1] > 0 and b[2] < 768 and b[3] < 512 for group in boxes.values() for b in group)
    checks = {'passed': True, 'role': role, 'uniqueRuntimeTextures': len(bank), 'frameSize': SIZE,
              'runtimeSize': RUNTIME_SIZE, 'exactIdleAttackHurtEndpoints': True, 'fixedIdleLower147Rows': True,
              'fixedCanvasAndGroupScale': True, 'deathHoldLast': True, 'durationMs': {a: sum(t) for a, t in TIMINGS.items()},
              'bounds': boxes, 'coverage': '静态导出检查；姿态与动作自然度另做当前窗口内置预览核验'}
    write_json(folder / 'validation.json', checks)
    write_json(EVIDENCE / (role + '-runtime-assets.json'), {'files': files, 'catalog': catalog, 'checks': checks})
    return checks, frames


if __name__ == '__main__':
    results, strips = [], Image.new('RGB', (1152, 768), '#e8e6df')
    for row, role in enumerate(TARGET_HEIGHT):
        checks, frames = package(role)
        results.append(checks)
        for col, (act, pose) in enumerate([('idle', 0), ('atk', 3), ('hurt', 1), ('death', 6)]):
            im = frames[act][pose].copy(); im.thumbnail((288, 192))
            strips.paste(im, (col * 288, row * 256 + 25), im)
        ImageDraw.Draw(strips).text((8, row * 256 + 6), role + ': idle / attack / hurt / death', fill='#263340')
    strips.save(EVIDENCE / 'four-actions-light-check.png')
    write_json(EVIDENCE / 'export-checks.json', results)
    receipt = []
    for p in ROOT.rglob('*'):
        if p.is_file() and p.name not in ('receipt.json', '.gitignore'):
            receipt.append({'path': p.relative_to(PROJECT).as_posix(), 'bytes': p.stat().st_size,
                            'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                            'acquisition': '内置imagegen生成后复制，或执行pack_sprites.py重导出'})
    write_json(EVIDENCE / 'receipt.json', receipt)
    large = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and p.stat().st_size > 1000000]
    (ROOT / '.gitignore').write_text('# Local sources over 1 MB; receipt includes SHA256 and acquisition.\nexport-draft-intermediate/\n' + '\n'.join(large) + '\n', encoding='utf8')
    print(json.dumps([{'role': c['role'], 'textures': c['uniqueRuntimeTextures'], 'passed': c['passed']} for c in results]))
