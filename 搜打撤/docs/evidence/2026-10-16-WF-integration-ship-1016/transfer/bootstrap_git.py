#!/usr/bin/env python3
"""Rebuild credential-free Git metadata for an independently verified archive.

Usage: python bootstrap_git.py PROJECT_ROOT /outside/project/git-metadata.json
The manifest uses SHA-1 Git object IDs and contains commit, tree,
raw_commit_base64 and entries[{path,mode,type,object,size}].
No remote, credentials, global configuration, templates or hooks are copied.
On failure, any newly created .git is retained for inspection; nothing is deleted.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys


def object_id(kind, data):
    return hashlib.sha1(kind.encode() + b' ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def bootstrap(root, metadata):
    root = Path(root).resolve(strict=True)
    require(root.is_dir(), 'Project root must be a directory')
    require(not os.path.lexists(root / '.git'), 'Refusing existing .git')
    metadata = Path(metadata).resolve(strict=True)
    require(root not in metadata.parents, 'Metadata must be outside project root')
    manifest = json.loads(metadata.read_text(encoding='utf-8'))
    commit = manifest['commit']
    tree = manifest['tree']
    oid = re.compile(r'^[0-9a-f]{40}$')
    require(oid.fullmatch(commit) and oid.fullmatch(tree), 'Expected SHA-1 commit/tree IDs')
    raw = base64.b64decode(manifest['raw_commit_base64'], validate=True)
    require(object_id('commit', raw) == commit, 'Raw commit SHA mismatch')
    require(raw.split(b'\n', 1)[0] == b'tree ' + tree.encode(), 'Raw commit tree mismatch')
    checked, seen, folded = [], set(), set()
    for entry in manifest['entries']:
        name = entry['path']
        require(isinstance(name, str) and name and '\0' not in name and '\\' not in name,
                'Invalid manifest path')
        parts = name.split('/')
        require(all(p not in ('', '.', '..') and ':' not in p and p.casefold() != '.git'
                    for p in parts), 'Unsafe path: ' + name)
        require(not any(p.endswith((' ', '.')) for p in parts), 'Nonportable path: ' + name)
        require(name not in seen and name.casefold() not in folded, 'Duplicate/case-colliding path: ' + name)
        seen.add(name)
        folded.add(name.casefold())
        path = root.joinpath(*parts)
        resolved_parent = path.parent.resolve(strict=True)
        require(resolved_parent == root or root in resolved_parent.parents,
                'Parent escapes project root: ' + name)
        for parent in list(path.parents)[:-1]:
            if parent == root:
                break
            require(not parent.is_symlink(), 'Symlink parent: ' + name)
        mode = str(entry['mode'])
        entry['mode'] = mode
        expected_type = 'commit' if mode == '160000' else 'blob'
        require(mode in ('100644', '100755', '120000', '160000') and entry['type'] == expected_type,
                'Unsupported mode/type: ' + name)
        require(oid.fullmatch(entry['object']), 'Invalid object ID: ' + name)
        data = None
        if mode == '160000':
            require(path.is_dir() and not path.is_symlink(), 'Gitlink must be an existing directory: ' + name)
        else:
            info = path.lstat()
            if mode == '120000' and stat.S_ISLNK(info.st_mode):
                data = os.fsencode(os.readlink(path))
            else:
                require(stat.S_ISREG(info.st_mode), 'Expected regular archive file: ' + name)
                data = path.read_bytes()
            require(len(data) == entry['size'], 'Blob size mismatch: ' + name)
            require(object_id('blob', data) == entry['object'], 'Blob SHA mismatch: ' + name)
        checked.append((entry, path, data if mode == '120000' else None))
    require(not any('/'.join(n.split('/')[:i]) in seen for n in seen
                    for i in range(1, len(n.split('/')))), 'File/directory manifest collision')

    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
               GIT_TERMINAL_PROMPT='0')

    def git(*args, data=None):
        result = subprocess.run(['git', '-C', str(root), *args], input=data,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        if result.returncode:
            raise RuntimeError('git ' + args[0] + ': ' + result.stderr.decode('utf-8', 'replace'))
        return result.stdout

    # Exclusive creation protects an existing repository; failure leaves this new directory intact.
    (root / '.git').mkdir()
    git('init', '--quiet', '--template=', '--initial-branch=master', '--object-format=sha1')
    git('config', 'core.autocrlf', 'false')
    git('config', 'core.filemode', 'false' if os.name == 'nt' else 'true')
    archived_links = [p for e, p, _ in checked if e['mode'] == '120000' and not p.is_symlink()]
    if archived_links:
        git('config', 'core.symlinks', 'false')

    # hash-object --stdin-paths uses Git's C quoted pathname format, never shell interpolation.
    regular = [(e, p) for e, p, _ in checked if e['mode'] in ('100644', '100755')]
    if regular:
        def quoted(name):
            return b'"' + b''.join(('\\%03o' % byte).encode() for byte in name.encode('utf-8')) + b'"\n'
        hashes = git('hash-object', '-w', '--no-filters', '--stdin-paths',
                     data=b''.join(quoted(e['path']) for e, _ in regular)).decode().splitlines()
        require(hashes == [e['object'] for e, _ in regular], 'Files changed during object import')
    for entry, path, link_data in checked:
        if entry['mode'] == '120000':
            imported = git('hash-object', '-w', '--stdin', data=link_data).decode().strip()
            require(imported == entry['object'], 'Symlink object import mismatch')
        if entry['mode'] == '100755' and os.name != 'nt':
            path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    records = b''.join((e['mode'] + ' ' + e['type'] + ' ' + e['object'] + '\t').encode()
                       + e['path'].encode('utf-8') + b'\0' for e, _, _ in checked)
    git('update-index', '-z', '--index-info', data=records)
    require(git('write-tree').decode().strip() == tree, 'Rebuilt tree SHA mismatch')
    require(git('hash-object', '-w', '-t', 'commit', '--stdin', data=raw).decode().strip() == commit,
            'Imported commit SHA mismatch')
    (root / '.git' / 'shallow').write_text(commit + '\n', encoding='ascii')
    git('update-ref', 'refs/heads/master', commit)
    git('symbolic-ref', 'HEAD', 'refs/heads/master')
    require(git('rev-parse', 'HEAD').decode().strip() == commit, 'HEAD mismatch')
    require(not git('status', '--porcelain=v1', '--untracked-files=all'),
            'Working tree has extra/changed files; retained without deletion')
    require(not git('remote'), 'Unexpected remote configuration')
    return {'commit': commit, 'tree': tree, 'status': 'clean', 'remote': None}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root')
    parser.add_argument('metadata')
    arguments = parser.parse_args()
    try:
        print(json.dumps(bootstrap(arguments.root, arguments.metadata), ensure_ascii=False))
    except (ValueError, OSError, RuntimeError, KeyError, TypeError) as error:
        print('Refused: ' + str(error), file=sys.stderr)
        sys.exit(1)
