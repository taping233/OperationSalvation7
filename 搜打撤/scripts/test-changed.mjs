import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { toProjectPath } from './gate-plan.mjs';

// Read both index and working changes conservatively, plus non-ignored new files.
// Git's project pathspec and NUL framing preserve spaces/Chinese and ignore siblings.
export function changedProjectPaths(root) {
  const commands = [
    ['diff', '--name-only', '--no-renames', '--relative', '-z', '--', '.'],
    ['diff', '--cached', '--name-only', '--no-renames', '--relative', '-z', '--', '.'],
    ['ls-files', '--others', '--exclude-standard', '-z', '--', '.'],
  ];
  const paths = [];
  for (const args of commands) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('无法读取当前项目改动：' + (result.error?.message || result.stderr).trim());
    for (const file of result.stdout.split('\0').filter(Boolean)) paths.push(toProjectPath(file, root));
  }
  return [...new Set(paths)].sort();
}

export function changedCommand(args) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    plan: { type: 'boolean' }, json: { type: 'boolean' }, paths: { type: 'string', multiple: true },
  } });
  const paths = [...(values.paths ?? []), ...positionals].flatMap(value => value.split(',').map(x => x.trim()).filter(Boolean));
  if (values.paths && !paths.length) throw new Error('--paths 后必须指定项目内路径');
  return ['scripts/acceptance-gate.mjs', ...(paths.length ? ['--paths', ...paths] : ['--changed']),
    values.plan ? '--plan' : '--run', ...(values.json ? ['--json'] : [])];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = spawnSync(process.execPath, changedCommand(process.argv.slice(2)), {
      cwd: root, stdio: 'inherit', windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.signal) process.stderr.write('[tests] 检查被信号中断：' + result.signal + '\n');
    process.exitCode = result.status ?? 1;
  } catch (error) {
    process.stderr.write('[tests] ' + error.message + '\n');
    process.exitCode = 1;
  }
}
