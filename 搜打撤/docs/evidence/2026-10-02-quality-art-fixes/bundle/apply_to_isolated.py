"""Check task-start normalized SHA256 before applying only this repair patch."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--root', required=True, help='absolute repository root of an isolated review copy')
parser.add_argument('--apply', action='store_true', help='apply after all preconditions and git apply --check pass')
args = parser.parse_args()
root = pathlib.Path(args.root)
if not root.is_absolute():
    parser.error('--root must be absolute')
bundle = pathlib.Path(__file__).resolve().parent
manifest = json.loads((bundle / 'preconditions.json').read_text(encoding='utf-8'))
patch = bundle / 'repair-only.patch'
if hashlib.sha256(patch.read_bytes()).hexdigest() != manifest['patch_sha256']:
    sys.exit('Patch SHA256 does not match the manifest')
errors = []
for item in manifest['changed_files']:
    relative = pathlib.PurePosixPath(item['path'])
    if relative.is_absolute() or '..' in relative.parts:
        sys.exit('Unsafe manifest path')
    target = root / item['path']
    if item['operation'] == 'add':
        if target.exists() or target.is_symlink():
            errors.append(item['path'] + ': expected absent')
    elif not target.is_file() or target.is_symlink():
        errors.append(item['path'] + ': expected regular baseline file')
    elif hashlib.sha256(target.read_bytes().replace(b'\r\n', b'\n')).hexdigest() != item['before_normalized_sha256']:
        errors.append(item['path'] + ': baseline differs; reconcile isolated copy, do not overwrite')
if errors:
    sys.exit('\n'.join(errors))
result = subprocess.run(['git', 'apply', '--check', str(patch)], cwd=str(root))
if result.returncode:
    sys.exit(result.returncode)
if args.apply:
    result = subprocess.run(['git', 'apply', str(patch)], cwd=str(root))
    if result.returncode:
        sys.exit(result.returncode)
    for item in manifest['changed_files']:
        current = (root / item['path']).read_bytes().replace(b'\r\n', b'\n')
        if hashlib.sha256(current).hexdigest() != item['after_normalized_sha256']:
            sys.exit('After hash differs: ' + item['path'])
    print('Applied only the repair patch; final normalized SHA256 verified.')
else:
    print('All preconditions and git apply --check passed; no files written.')
