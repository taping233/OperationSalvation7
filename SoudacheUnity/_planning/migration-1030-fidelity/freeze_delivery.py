# -*- coding: utf-8 -*-
"""Inventory the already built, reviewed desktop output; does not build or stage."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

project = Path(__file__).resolve().parents[2]
evidence = project.parent / '搜打撤/docs/evidence/2026-10-29-unity-desktop/fidelity-1030'
build = project / 'Build/Desktop'
target = evidence / 'desktop-final-build-2'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(part)
    return result.hexdigest()

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

info = read(build / 'build-info.json')
process = read(target / 'process.json')
player = read(evidence / 'desktop-final-player-2/result.json')
player_process = read(evidence / 'desktop-final-player-2/process.json')
assert info['result'] == 'Succeeded' and info['errors'] == 0 and info['inputsUnchanged']
assert process['exitCode'] == 0 and process['inputsUnchanged']
assert player['passed'] and player_process['exitCode'] == 0
assert player_process['zeroAlphaAndNonactivating']
assert player_process['executableSha256'] == info['executableSha256'] == digest(build / '代号柒.exe')
assert len([r for r in player['records'] if r['kind'] == 'actual-player-capture']) == 48

files = [{'path': p.relative_to(build).as_posix(), 'bytes': p.stat().st_size,
          'sha256': digest(p)} for p in sorted(build.rglob('*')) if p.is_file()]
media_types = {'.ogg', '.opus', '.wav', '.mp3', '.flac', '.ttf', '.otf', '.woff', '.woff2', '.mp4', '.zip', '.7z'}
media = []
for name, sha in info['inputs'].items():
    path = project / name
    if name.startswith('Assets/') and path.is_file() and (path.stat().st_size > 1000000 or path.suffix.lower() in media_types):
        media.append({'path': name, 'bytes': path.stat().st_size, 'sha256': sha})

reused = ['cjk-1', 'film-flow-3', 'frames-2', 'organizer-focus-2', 'slot-archive-1', 'journey-4',
          'shop-source-4', 'pile-3', 'desktop-final-player-2']
large_evidence = []
for name in reused:
    for path in sorted((evidence / name).rglob('*')):
        if path.is_file() and (path.stat().st_size > 1000000 or path.suffix.lower() in media_types):
            large_evidence.append({'path': path.relative_to(evidence).as_posix(),
                                   'bytes': path.stat().st_size, 'sha256': digest(path)})

manifest = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'passed': True,
    'buildDirectory': str(build),
    'buildGUID': player['display']['buildGUID'],
    'unity': info['unity'], 'builtAt': info['builtAt'],
    'buildReportedBytes': info['bytes'], 'inputCount': len(info['inputs']),
    'inputVerification': 'completion-audit.json rehashes all build inputs against current files; build-info snapshot preserves exact build hashes.',
    'acquisition': 'Local Unity BuildPipeline / StandaloneWindows64 / Sdt.Editor.BuildGame.BuildWin64; no upload, stage or publish.',
    'files': files,
    'binarySourceInventory': media,
    'binarySourceAcquisition': 'Existing project assets or current-source conversions; primary provenance: _planning/migration-1029/current-final-asset-provenance/receipt-recheck.json, _planning/migration-1030-fidelity/shop/delivery-manifest.json and text guide receipts. Exact build-input bytes in build-info.snapshot.json.',
    'largeEvidenceFiles': large_evidence,
    'evidenceAcquisition': 'Native checks via _planning/migration-1029/run_native_check.ps1 with method in each process.json; normal standalone via _planning/migration-1030-fidelity/clarity/run_hidden_player.ps1 -TransparentCompositor, then analyse_player_review.py. Isolated profiles; no OS input.',
    'storage': 'Binaries remain local; this script writes only text manifests and does not stage files.',
}
write(target / 'artifact-manifest.json', manifest)
(target / 'build-info.snapshot.json').write_bytes((build / 'build-info.json').read_bytes())
print(json.dumps({'passed': True, 'files': len(files), 'inputs': len(info['inputs']),
                  'largeAssets': len(media), 'largeEvidence': len(large_evidence),
                  'buildGUID': manifest['buildGUID']}, ensure_ascii=True))
