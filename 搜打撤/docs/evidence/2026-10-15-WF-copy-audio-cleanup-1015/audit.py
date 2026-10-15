"""Create a fixed cleanup plan, preserve independent content, then verify it.

This script never deletes files. Native PowerShell applies the reviewed plan.
"""
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
COPIES = [
    '.tmp/zzz-base-observe-1012',
    '.tmp/WF-battle-ui-runtime',
    '.tmp/selection-map-observe-1011',
    '.tmp/selection-map-repair-1012',
]
MUSIC = [
    'docs/evidence/2026-10-12-WF-battle-full-loop',
    'docs/evidence/2026-10-12-WF-battle-full-loop-v2',
]
MEDIA = {'.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ogg', '.mp3',
         '.wav', '.ttf', '.otf', '.woff', '.woff2', '.mp4', '.webm', '.glb'}


def relative(path):
    return str(path.relative_to(ROOT)).replace('\\', '/')


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def files_under(base):
    if not base.is_dir():
        raise RuntimeError('Required directory is absent: ' + str(base))
    if getattr(base.stat(), 'st_file_attributes', 0) & 0x400:
        raise RuntimeError('Reparse root refused: ' + str(base))
    stack = [base]
    while stack:
        current = stack.pop()
        with os.scandir(str(current)) as entries:
            for entry in entries:
                info = entry.stat(follow_symlinks=False)
                if entry.is_symlink() or getattr(info, 'st_file_attributes', 0) & 0x400:
                    raise RuntimeError('Reparse entry refused: ' + entry.path)
                path = Path(entry.path)
                if entry.is_dir(follow_symlinks=False):
                    stack.append(path)
                elif entry.is_file(follow_symlinks=False):
                    yield path
                else:
                    raise RuntimeError('Special file refused: ' + str(path))


def record(path):
    info = path.stat()
    return {'path': relative(path), 'bytes': info.st_size,
            'sha256': digest(path), 'mtimeNs': info.st_mtime_ns,
            'links': info.st_nlink}


def save(name, data):
    path = EVIDENCE / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'path': relative(path), 'bytes': path.stat().st_size, 'sha256': digest(path)}


def prepare():
    if (EVIDENCE / 'deletion-plan.local.json').exists():
        raise RuntimeError('A frozen deletion plan already exists; do not replace it')
    saved_by_hash = {}
    protected = {}
    preserved = []
    deletion = []
    directories = []

    def protect(path):
        key = relative(path)
        if key not in protected:
            protected[key] = record(path)
        return protected[key]

    for copy in COPIES:
        base = ROOT / copy
        directories.append(copy)
        for source in sorted(files_under(base)):
            source_record = record(source)
            inside = source.relative_to(base)
            canonical = ROOT / inside
            identical_runtime_asset = False
            if str(inside).replace('\\', '/').startswith('game/assets/') and source.suffix.lower() in MEDIA:
                if canonical.is_file() and not canonical.is_symlink():
                    canonical_record = protect(canonical)
                    identical_runtime_asset = (canonical_record['bytes'] == source_record['bytes']
                                               and canonical_record['sha256'] == source_record['sha256'])
            if identical_runtime_asset:
                source_record['preservation'] = {'kind': 'identical-mainline-asset', 'path': relative(canonical)}
            else:
                value = source_record['sha256']
                destination = saved_by_hash.get(value)
                if destination is None:
                    destination = EVIDENCE / 'preserved' / base.name / inside
                    if destination.exists():
                        raise RuntimeError('Preservation path already exists: ' + str(destination))
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(str(source), str(destination))
                    if destination.stat().st_size != source_record['bytes'] or digest(destination) != value:
                        raise RuntimeError('Preservation mismatch: ' + str(source))
                    saved_by_hash[value] = destination
                    preserved.append(record(destination))
                source_record['preservation'] = {'kind': 'saved-independent-content', 'path': relative(destination)}
            deletion.append(source_record)

    waves = []
    for directory in MUSIC:
        base = ROOT / directory
        for path in sorted(files_under(base)):
            if path.parent == base and (path.name.endswith('-two-cycles.wav') or path.name.endswith('-loop-native.wav')):
                waves.append(record(path))
            else:
                protect(path)
    if len(waves) != 18:
        raise RuntimeError('The approved 18 WAV set changed: ' + str(len(waves)))
    deletion.extend(waves)
    for directory in ['.tmp/music-workstation', '.tmp/salamander-title-1009']:
        base = ROOT / directory
        if base.exists():
            for path in files_under(base):
                protect(path)

    for item in preserved:
        path = ROOT / item['path']
        if digest(path) != item['sha256']:
            raise RuntimeError('Saved file changed: ' + str(path))
    manifests = [save('preservation-manifest.local.json', {'files': preserved}),
                 save('protected-originals.local.json', {'files': list(protected.values())})]
    plan = {'root': str(ROOT), 'at': datetime.now(timezone.utc).isoformat(),
            'copyRoots': COPIES, 'musicRoots': MUSIC, 'files': deletion,
            'scope': 'four approved old copies plus exactly 18 intermediate WAV files'}
    manifests.append(save('deletion-plan.local.json', plan))
    summary = {'plannedFiles': len(deletion), 'plannedBytes': sum(x['bytes'] for x in deletion),
               'copyFiles': len(deletion) - len(waves), 'wavFiles': len(waves),
               'wavBytes': sum(x['bytes'] for x in waves), 'savedUniqueFiles': len(preserved),
               'savedBytes': sum(x['bytes'] for x in preserved),
               'protectedOriginalFiles': len(protected), 'manifests': manifests,
               'method': 'logical file bytes; all script/report/code files saved; byte-identical mainline media retained in place'}
    save('preflight-summary.json', summary)
    print(json.dumps(summary, ensure_ascii=True))


def verify(after=False):
    protected = json.loads((EVIDENCE / 'protected-originals.local.json').read_text(encoding='utf-8'))['files']
    preserved = json.loads((EVIDENCE / 'preservation-manifest.local.json').read_text(encoding='utf-8'))['files']
    moved_file = EVIDENCE / 'moved-hardlinks.json'
    moved = json.loads(moved_file.read_text(encoding='utf-8-sig'))['files'] if moved_file.exists() else []
    for item in protected + preserved + moved:
        path = ROOT / item['path']
        if not path.is_file() or path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
            raise RuntimeError('Retained content changed: ' + str(path))
    result = {'protectedOriginalFiles': len(protected), 'savedUniqueFiles': len(preserved),
              'readonlyHardlinksArchived': len(moved),
              'allRetainedSha256Match': True, 'at': datetime.now(timezone.utc).isoformat()}
    if after:
        plan = json.loads((EVIDENCE / 'deletion-plan.local.json').read_text(encoding='utf-8'))
        present = [row['path'] for row in plan['files'] if (ROOT / row['path']).exists()]
        if present:
            raise RuntimeError('Deletion incomplete: ' + str(present[:3]))
        result['approvedDeletedFilesAbsent'] = len(plan['files'])
        result['copyRootsAbsent'] = all(not (ROOT / path).exists() for path in COPIES)
        if not result['copyRootsAbsent']:
            raise RuntimeError('Copy roots remain')
        save('verification.json', result)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    if '--verify-after' in sys.argv:
        verify(after=True)
    elif '--verify-before' in sys.argv:
        verify()
    else:
        prepare()
