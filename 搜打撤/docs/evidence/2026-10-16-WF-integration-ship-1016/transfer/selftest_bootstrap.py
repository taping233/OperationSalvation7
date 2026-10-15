"""Tiny offline fixture; retains generated folders for inspection."""
import base64
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import sys

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('bootstrap_git', HERE / 'bootstrap_git.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
workspace = Path(tempfile.mkdtemp(prefix='operation7-git-bootstrap-', dir=sys.argv[1] if len(sys.argv) > 1 else None))
source, destination = workspace / 'source', workspace / 'archive'
source.mkdir()
destination.mkdir()
env = {k: v for k, v in os.environ.items() if not k.upper().startswith('GIT_')}
env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT='0')


def git(*args, data=None):
    return subprocess.run(['git', '-C', str(source), *args], input=data, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env).stdout


git('init', '--quiet', '--template=', '--initial-branch=master')
git('config', 'core.autocrlf', 'false')
files = {'.gitignore': b'kept.dat\n', 'normal.txt': b'hello\n',
         'space unicode \u96ea.txt': b'unicode path\n', 'run.sh': b'#!/bin/sh\nexit 0\n',
         'kept.dat': b'tracked despite ignore\n'}
for name, data in files.items():
    (source / name).write_bytes(data)
    (destination / name).write_bytes(data)
git('add', '-f', '--', *files)
git('update-index', '--chmod=+x', 'run.sh')
link_data = b'normal.txt'
link_object = git('hash-object', '-w', '--stdin', data=link_data).decode().strip()
git('update-index', '--add', '--cacheinfo', '120000,' + link_object + ',link.txt')
git('update-index', '--add', '--cacheinfo', '160000,' + '1' * 40 + ',submodule')
(destination / 'link.txt').write_bytes(link_data)
(destination / 'submodule').mkdir()
tree = git('write-tree').decode().strip()
raw = ('tree ' + tree + '\nparent ' + '2' * 40 + '\nauthor Fixture <fixture@example.invalid> 1 +0000\n'
       'committer Fixture <fixture@example.invalid> 1 +0000\n\nfixture\n').encode()
commit = git('hash-object', '-w', '-t', 'commit', '--stdin', data=raw).decode().strip()
entries = []
for record in git('ls-tree', '-r', '-z', tree).split(b'\0'):
    if not record:
        continue
    info, name = record.split(b'\t', 1)
    mode, kind, obj = info.decode().split()
    entries.append(dict(path=name.decode(), mode=mode, type=kind, object=obj,
                        size=len(link_data) if mode == '120000' else 0 if mode == '160000' else len(files[name.decode()])))
metadata = workspace / 'git-metadata.json'
metadata.write_text(json.dumps(dict(commit=commit, tree=tree,
    raw_commit_base64=base64.b64encode(raw).decode(), entries=entries)), encoding='utf-8')
result = helper.bootstrap(destination, metadata)
try:
    helper.bootstrap(destination, metadata)
    raise AssertionError('Existing .git was accepted')
except ValueError as error:
    assert 'existing .git' in str(error)
# Unsafe paths and wrong bytes must fail before creating metadata.
for label, mutate in [('unsafe', lambda data: data['entries'][0].update(path='../escape')),
                      ('tampered', lambda data: data['entries'][0].update(object='0' * 40))]:
    target = workspace / label
    target.mkdir()
    for name, data in files.items():
        (target / name).write_bytes(data)
    manifest = json.loads(metadata.read_text(encoding='utf-8'))
    mutate(manifest)
    bad = workspace / (label + '.json')
    bad.write_text(json.dumps(manifest), encoding='utf-8')
    try:
        helper.bootstrap(target, bad)
        raise AssertionError(label + ' accepted')
    except ValueError:
        assert not (target / '.git').exists()
print(json.dumps(dict(result=result, fixture=str(workspace),
    checks=['ordinary bytes', 'Unicode/spaces', '100755 index mode', 'tracked ignored file',
            '120000 symlink target blob', '160000 gitlink without submodule objects',
            'existing Git refused', 'unsafe path refused', 'tampered blob refused']), ensure_ascii=False))
