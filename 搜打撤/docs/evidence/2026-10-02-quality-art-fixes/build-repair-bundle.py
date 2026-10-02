import difflib
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[4]
EVIDENCE = pathlib.Path(__file__).resolve().parent
EXISTING = [
    'NovelAI生图功能手册-AI接手版.md',
    '搜打撤/.githooks/pre-commit', '搜打撤/eslint.config.js', '搜打撤/package.json',
    '搜打撤/scripts/acceptance-gate.mjs', '搜打撤/scripts/gate-plan.mjs',
    '搜打撤/scripts/workflow-gate-receipt.mjs', '搜打撤/tests/workflow-gate-receipt.test.js',
    '搜打撤/tests/acceptance-gate.test.js', '搜打撤/tests/workflow-staged.test.js',
    '搜打撤/tools/nai_gen.py', '搜打撤/scripts/asset-audit.cjs',
    '搜打撤/game/assets/asset-manifest.json', '搜打撤/scripts/generate-compendium.mjs',
    '搜打撤/tests/compendium.test.js', '搜打撤/docs/game-compendium.md',
    '搜打撤/docs/roadmap.md', '搜打撤/docs/quality-gates.md',
    '搜打撤/scripts/compile-narrative.mjs', '搜打撤/scripts/esm-convert.mjs',
    '搜打撤/scripts/iab-drive.mjs', '搜打撤/scripts/perf-benchmark.cjs',
    '搜打撤/scripts/workflow-staged.mjs', '搜打撤/scripts/workflow-evidence.mjs',
    '搜打撤/scripts/workflow.mjs', '搜打撤/tests/workflow-scope.test.js',
    '搜打撤/tests/workflow-cli-integration.test.js', '搜打撤/tests/workflow-dependencies.test.js',
]
NEW = [
    '搜打撤/tests/quality-config.test.js', '搜打撤/tools/nai_guard.py',
    '搜打撤/tools/tests/test_nai_guard.py', '搜打撤/scripts/asset-audit-lib.cjs',
    '搜打撤/tests/asset-audit.test.js', '搜打撤/docs/asset-audit-debt.md',
    '搜打撤/docs/asset-audit-debt.json',
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def normalized(data):
    return data.replace(b'\r\n', b'\n')


bundle = EVIDENCE / 'bundle'
bundle.mkdir(exist_ok=True)
changes, patches = [], []
for name in EXISTING + NEW:
    current = (ROOT / name).read_bytes()
    before = None if name in NEW else (EVIDENCE / 'baseline' / name).read_bytes()
    if before is not None and normalized(before) == normalized(current):
        continue
    provenance = 'saved before this task edited the file'
    if name.endswith('/scripts/workflow.mjs'):
        provenance = 'reconstructed only the recorded one-line freshness call; normalized before hash is authoritative, original raw-byte hash was not captured'
    item = {'path': name, 'operation': 'add' if before is None else 'modify',
            'before_sha256': None if before is None or name.endswith('/scripts/workflow.mjs') else digest(before),
            'before_normalized_sha256': None if before is None else digest(normalized(before)),
            'after_sha256': digest(current), 'after_normalized_sha256': digest(normalized(current)),
            'baseline_provenance': 'must be absent' if before is None else provenance}
    changes.append(item)
    patches.append('diff --git a/' + name + ' b/' + name + '\n')
    if before is None:
        patches.append('new file mode 100644\n')
    patches.extend(difflib.unified_diff([] if before is None else normalized(before).decode('utf-8').splitlines(keepends=True),
                                      normalized(current).decode('utf-8').splitlines(keepends=True),
                                      fromfile='/dev/null' if before is None else 'a/' + name,
                                      tofile='b/' + name))
patch = ''.join(patches).encode('utf-8')
(bundle / 'repair-only.patch').write_bytes(patch)
style = '搜打撤/tools/nai_style.py'
assert (ROOT / style).read_bytes() == (EVIDENCE / 'baseline' / style).read_bytes()
manifest = {'schema_version': 1, 'base_head': 'c6ee20684056240fd219fe179cacf5204a6445a4',
            'baseline': 'task-start dirty workspace, NOT HEAD; unrelated pre-existing edits are excluded',
            'patch_sha256': digest(patch), 'changed_files': changes,
            'unchanged_proof': [{'path': style, 'sha256': digest((ROOT / style).read_bytes())}],
            'excluded': ['all other original workspace changes', 'PARALLEL-REGISTRY local ownership row',
                         'task state and source baselines', 'other sessions evidence', 'all media binaries and credentials']}
(bundle / 'preconditions.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(bundle / 'new-files.txt').write_text('\n'.join(NEW) + '\n', encoding='utf-8')

# Validate against a separate explicit baseline copy. Do not modify this checkout/index.
fixture = pathlib.Path(tempfile.mkdtemp(prefix='sdt-repair-patch-check-'))
for item in changes:
    if item['operation'] == 'modify':
        destination = fixture / item['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(normalized((EVIDENCE / 'baseline' / item['path']).read_bytes()))
check = subprocess.run(['git', 'apply', '--check', str(bundle / 'repair-only.patch')], cwd=str(fixture),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8')
if check.returncode:
    raise RuntimeError(check.stderr)
(bundle / 'patch-check.json').write_text(json.dumps({'command': ['git', 'apply', '--check', 'repair-only.patch'],
    'exit_code': check.returncode, 'isolated_baseline_copy': str(fixture), 'checkout_and_index_unchanged': True},
    ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for name in ['static-offline-validation.json', 'assets-docs-validation.md', 'receipt-staged-local-result.json',
             'receipt-crossline-fixtures-result.json', 'receipt-staged-final.log', 'receipt-crossline-fixtures.log']:
    source = EVIDENCE / name
    if source.exists():
        target = bundle / 'evidence' / name
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(str(source), str(target))
reports = []
for file in EVIDENCE.glob('*.json'):
    value = json.loads(file.read_text(encoding='utf-8'))
    if isinstance(value, dict) and value.get('kind') == 'automated-local-check' and value.get('outcome') == 'passed':
        reports.append((value['endedAt'], file, value))
if reports:
    _, source, report = sorted(reports)[-1]
    shutil.copyfile(str(source), str(bundle / 'evidence' / 'final-targeted-report.json'))
    shutil.copyfile(str(ROOT / '搜打撤' / report['log']), str(bundle / 'evidence' / 'final-targeted.log'))

archive = EVIDENCE / 'quality-art-repair-2026-10-02.zip'
with zipfile.ZipFile(str(archive), 'w', zipfile.ZIP_DEFLATED) as z:
    for file in sorted(bundle.rglob('*')):
        if file.is_file():
            z.write(str(file), file.relative_to(bundle).as_posix())
print(json.dumps({'patch_files': len(changes), 'new_files': len(NEW), 'patch_bytes': len(patch),
                  'patch_sha256': digest(patch), 'archive': str(archive),
                  'archive_bytes': archive.stat().st_size, 'archive_sha256': digest(archive.read_bytes()),
                  'patch_check_exit': check.returncode, 'passed_report_included': bool(reports)}, ensure_ascii=False))
