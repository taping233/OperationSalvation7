# -*- coding: utf-8 -*-
"""Read-only production/evidence audit; writes only its two audit artifacts."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
here = Path(__file__).resolve().parent
project = here.parents[1]
root = project.parent
evidence = next(root.glob('*/docs/evidence/2026-10-29-unity-desktop'))
fidelity = evidence / 'fidelity-1030'
cache = {}

def digest(path):
    path = path.resolve()
    if path not in cache:
        if not path.is_file():
            cache[path] = None
        else:
            h = hashlib.sha256()
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
                    h.update(chunk)
            cache[path] = h.hexdigest()
    return cache[path]

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def compare(entries, base):
    mismatches = []
    for path, expected in entries.items():
        actual = digest(base / path)
        if actual is None or actual.lower() != expected.lower():
            mismatches.append({'path': path, 'expected': expected, 'actual': actual})
    return {'count': len(entries), 'mismatches': mismatches}

def fingerprints(value, output):
    if isinstance(value, dict):
        if 'path' in value and 'sha256' in value and not value['path'].replace('\\', '/').startswith('SoudacheUnity/'):
            output[value['path']] = value['sha256']
        for child in value.values():
            fingerprints(child, output)
    elif isinstance(value, list):
        for child in value:
            fingerprints(child, output)

matrix = read(project / '_planning/migration-1029/current-ui-version/version-matrix.json')
mapped = {}
fingerprints(matrix['rows'], mapped)
all_source = {}
fingerprints(read(project / '_planning/migration-1029/current-ui-version/runtime-source-manifest.json'), all_source)
old_core = read(project / '_planning/migration-1029/current-core-independent/final-closure/inputs-sha256.json')
build = read(project / 'Build/Desktop/build-info.json')
identities = {
    'currentBuildInputs': compare(build['inputs'], project),
    'mappedSourceJsCss': compare(mapped, root),
    'recordedRuntimeSource': compare(all_source, root),
    'core69Source': compare({x['path']: x['sha256'] for x in old_core['source']}, root),
    'core69Production': compare({x['path']: x['sha256'] for x in old_core['core']}, project / 'Assets/Scripts/Sdt.Core'),
}

# Recheck receipt-covered media, without treating historical missing images as live consumers.
provenance = read(project / '_planning/migration-1029/current-final-asset-provenance/receipt-recheck.json')
media = {}
media_count = {'source': 0, 'output': 0}
for row in provenance['rows']:
    for side in ('source', 'output'):
        item = row.get(side)
        if item and item.get('status') == 'matched':
            media[item['path']] = item['expected']
            media_count[side] += 1
identities['receiptCoveredMedia'] = compare(media, root)
identities['receiptCoveredMedia']['receiptEntries'] = media_count
identities['receiptCoveredMedia']['scope'] = 'Only explicit matched primary receipt paths; derived SVG reconstruction and exhaustive dynamic reachability are separate checks.'

current_visual = read(evidence / 'current-visual-10/source-before.json')
identities['oldVisual331'] = compare(current_visual, project)
identities['oldVisual331']['reusePolicy'] = 'Do not reuse the whole old static batch as final acceptance. Only unchanged page geometry/consumers remain bounded historical evidence; changed common mechanisms use new fidelity probes and actual player frames.'

checks = []
for name in ('cjk-1', 'film-flow-3', 'frames-2', 'organizer-focus-2', 'slot-archive-1', 'journey-4', 'shop-source-4', 'pile-3', 'desktop-final-player-2'):
    result = read(fidelity / name / 'result.json')
    process = read(fidelity / name / 'process.json')
    checks.append({'name': name, 'passed': result.get('passed') is True and process.get('exitCode') == 0 and not process.get('timedOut'),
                   'result': str((fidelity / name / 'result.json').relative_to(root)).replace('\\', '/'),
                   'resultSha256': digest(fidelity / name / 'result.json'),
                   'recordCount': len(result.get('records', [])), 'scope': result.get('scope', result.get('input', 'See actual assertions in named Editor validation class.'))})
build_process = read(fidelity / 'desktop-final-build-2/process.json')
checks.append({'name': 'desktop-final-build-2', 'passed': build['result'] == 'Succeeded' and build['errors'] == 0 and build_process['exitCode'] == 0 and build_process['inputsUnchanged'], 'result': 'SoudacheUnity/Build/Desktop/build-info.json', 'resultSha256': digest(project / 'Build/Desktop/build-info.json')})
player = read(fidelity / 'desktop-final-player-2/result.json')
captures = [r['name'] for r in player['records'] if r.get('kind') == 'actual-player-capture']
density = read(fidelity / 'desktop-final-player-2/density-comparison.json')

# Each page family retains its current module and has positive evidence from the
# corresponding source contract / bounded native exercise. This is not a claim
# that every item of the old snapshot's observableCompletion is an exhaustive test.
family_evidence = {
    '01-home': 'desktop-final-player-2: title/startup/returned-title; unchanged TitleScreen/home partial geometry; current code directly binds current seven-wallpaper/footer/credits controls (not a hardware exercise of every control)',
    '02-slots': 'desktop-final-player-2: returned-slots/backup/import-preview/returned-title; slot-archive-1 runtime restore and cross-slot identities',
    '03-base-shell': 'current-visual-10 hub seven-room shell geometry; desktop-final-player-2 stable returned-base; journey-4 returned-base-ready',
    '04-base-home': 'current-visual-10 hub; current-entry-2 new/current/continued slot and preparation; journey-4 and final-player2 stable return',
    '05-base-logistics': 'current-visual-10 logistics/personnel/facilities; source-map current-base; current-entry-2 and prior data/state regressions',
    '06-character': 'current-visual-10 character; current-entry-2; pool now calls common source reader reviewed with recode/reward; class body geometry unchanged',
    '07-departure': 'current-visual-10 departure/preparation; current-entry-2 draft/new/continue/native entry; source departure modules unchanged',
    '08-bag': 'current-visual-10 bag; prior UID/variant/container commands; shop-source-4 actual bag returns and long detail state; CardFace/InlineIconText new common checks',
    '09-safe-pocket': 'current-entry-2 safe; current-receipts-4 settlement branches; organizer-focus-2 real safe moves/failure and UID decisions',
    '10-containers': 'current-bag source contract and 26 data checks; unchanged ContainerScreen family, common card text density/CJK rechecked; no claim of final-player2 container input coverage',
    '11-settings': 'desktop-final-player-2 settings; current-entry-2 native preferences/failure/bindings; four-tab source page retained',
    '12-photo': 'desktop-final-player-2 photo; current-visual-10 library; photo body unchanged except shared reading/density; current-entry-2 global data',
    '13-photo-detail': 'current-entry-2 actual note and failure; current-visual-10 photo-detail; photo-inline density and InputField isolation source checked',
    '14-achievements': 'current-visual-10 achievements; current-slot-achievement contract/source assets; current Meta/Hub reward routes retained',
    '15-trade': 'current-visual-10 trade; current-base source-map; transaction BaseData source consumers unchanged',
    '16-archive': 'current-visual-10 archive; current-base-review-fixes gallery correction; unchanged archive sections/source routing',
    '17-courtyard': 'current-visual-10 courtyard; source-map/current-base; frames-2 clock/cap verification plus Koi reduced clock path',
    '18-events': 'current-receipts-4 entry/event/fire; film-flow-3; desktop-final-player-2 altar/door/passage/recode result+reader+write failure; common node source shell',
    '19-rewards': 'current-receipts-4; shop-source-4 Apollo continuation/write failure; final-player2 real pending reader claim/stale callback/full-bag organizer; organizer-focus-2',
    '20-extraction': 'current-receipts-4; journey-4 real extraction/deposit/stable base; final-player2 extraction; slot-archive-1 sorting cross-slot actual resume',
    '21-settlement': 'current-receipts-4 death/abandon/normal flee; journey-4 final Boss/extract/idempotence; final-player2 settlement and base return',
    '22-map-hud': 'journey-4 30 real moves/four layers/three gates; final-player2 node/battle/shared HUD; source run-hud contracts',
    '23-battle-hud': 'final-player2 battle/pile/return/formation/rules; frames-2 real attack+EndTurn and 264 frame assets; current-battle-ui source contract',
    '24-hand': 'current-battle-ui layout/input source contract; journey-4 real card/end-turn commands; final-player2 battle; Core69 true-source vectors cover payment/target/zone state',
}
families = [{'id': r['id'], 'name': r['name'], 'coverage': family_evidence[r['id']], 'oldMatrixIsBaselineOnly': True} for r in matrix['rows']]

music_source = next(root.glob('*/game/src/audio/sound.music.catalog.js')).read_text(encoding='utf-8')
music_native = (project / 'Assets/Scripts/Sdt.Res/CurrentAssets.cs').read_text(encoding='utf-8')
music_block = music_native.split('IReadOnlyDictionary<string, string> Music', 1)[1].split('};', 1)[0]
native_tracks = dict(re.findall(r'\{\s*"([^"]+)",\s*"Audio/Current/([^"]+)"\s*\}', music_block))
source_tracks = dict(re.findall(r'(title|board|battle|shop): new URL\(\x27\.\./\.\./assets/([^\x27]+)\.ogg\x27', music_source))
legacy_calls = []
for path in (project / 'Assets/Scripts').rglob('*.cs'):
    if re.search(r'\b(?:Res\.)?Res\.Bgm\s*\(', path.read_text(encoding='utf-8-sig')):
        legacy_calls.append(str(path.relative_to(project)).replace('\\', '/'))
music_ok = native_tracks == source_tracks and len(native_tracks) == 4 and not legacy_calls

open_items = []
known_core_changes = {'Cards.cs', 'RunState.cs', 'Data/EventProgress.cs'}
actual_core_changes = {entry['path'].replace('\\', '/') for entry in identities['core69Production']['mismatches']}
if actual_core_changes != known_core_changes:
    open_items.append('Core69 reuse changed outside the three independently read and classified files')
for key in ('currentBuildInputs', 'mappedSourceJsCss', 'recordedRuntimeSource', 'core69Source', 'receiptCoveredMedia'):
    if identities[key]['mismatches']:
        open_items.append(key + ' fingerprint mismatch')
for check in checks:
    if not check['passed']:
        open_items.append(check['name'] + ' failed')
if not density['passed'] or len(captures) != 48:
    open_items.append('Final normal player density/capture coverage incomplete')
if not music_ok:
    open_items.append('Current four-track music mapping mismatch')
if len(families) != 24:
    open_items.append('Page-family map incomplete')

data = {
    'passed': not open_items,
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'scope': 'Independent completion-evidence consistency and explicit scope coverage, current worktree only. Not visual acceptance or a claim of universal source equivalence; the two final image audits and final delivery/docs closure are separate root gates.',
    'confirmedOpenItems': open_items,
    'evidence': checks,
    'fingerprints': identities,
    'pageFamilies': families,
    'finalPlayer': {'buildGUID': player['display']['buildGUID'], 'captures': len(captures), 'width': player['display']['screenWidth'], 'height': player['display']['screenHeight'], 'dpi': player['display']['dpi'], 'canvas': player['display']['canvas'], 'densityPassed': density['passed'], 'densitySamples': len(density['samples'])},
    'currentMusic': {'passed': music_ok, 'source': source_tracks, 'native': native_tracks, 'legacyCallSites': legacy_calls, 'missingClipPolicy': 'AudioService.PlayBgm calls Res.Music; missing clears source and stops playback; no historical fallback.'},
    'core69Reuse': 'Source677 unchanged. Production43: Cards.cs changed in source-order custom upsert, factored same drop selection and new read-only note; current shop104 vectors cover generated stock and subsequent4 real drops/RNG. RunState adds bossId; EventProgress adds commissionAnnounced. Other40 including actual battle implementation unchanged. Do not call this a rerun of69 after those metadata changes.',
    'provenBoundaries': ['Actual player is normal Standalone at current 2560x1440 with ScaleWithScreenSize/ScreenSpaceOverlay and native backbuffer scale1, captured from invisible zero-alpha nonactivating host.', 'Constructed EventSystem inputs/field values and controlled battle/reward fixtures are recorded. No OS hardware input, front control, multi-size or balance proof.', 'Previous 35+18 static frames are retained only for unchanged geometry/consumers; the62 later-changed inputs are exposed above.', 'Agent, Web old saves, research second map and closed workshop are explicitly excluded by MIGRATION.md.', 'No commits, push or release; no production edits or Unity execution by this audit.'],
    'dependentRootGates': ['final_changed_visual_review player2-review.md', 'final_archive_menu_review visual-final-player2.md', 'Final artifact/media manifests, current docs check and registry/task closure.'],
}
(here / 'completion-audit.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': data['passed'], 'openItems': open_items, 'identities': {k: {'count': v['count'], 'mismatchCount': len(v['mismatches'])} for k, v in identities.items()}, 'captures': len(captures), 'music': music_ok}, ensure_ascii=False))
