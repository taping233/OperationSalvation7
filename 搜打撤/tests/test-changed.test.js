// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { changedCommand, changedProjectPaths } from '../scripts/test-changed.mjs';

const repos = [];
function fixture() {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'sdt-changed-test-')); repos.push(repo);
  const root = path.join(repo, '搜打撤'); mkdirSync(path.join(root, 'tests'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(path.join(repo, '.gitignore'), 'ignored/\n');
  for (const file of ['staged', 'working', 'deleted', 'old name']) writeFileSync(path.join(root, file), 'base');
  git('add', '.'); git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'base');
  return { repo, root, git };
}
afterEach(() => {
  for (const repo of repos.splice(0)) {
    const relative = path.relative(os.tmpdir(), repo);
    if (!relative.startsWith('sdt-changed-test-') || relative.includes(path.sep)) throw new Error('非自有测试目录');
    rmSync(repo, { recursive: true, force: true });
  }
});

it('默认沿用选择器；指定路径及计划预览不会转成默认全量', () => {
  expect(changedCommand([])).toEqual(['scripts/acceptance-gate.mjs', '--changed', '--run']);
  expect(changedCommand(['--paths', 'game/src/a.js,tests/b.test.js', '--plan', '--json']))
    .toEqual(['scripts/acceptance-gate.mjs', '--paths', 'game/src/a.js', 'tests/b.test.js', '--plan', '--json']);
  expect(changedCommand(['tests/有 空格.test.js'])).toContain('tests/有 空格.test.js');
  expect(() => changedCommand(['--paths', ''])).toThrow('必须指定');
  expect(() => changedCommand(['--unknown'])).toThrow();
});

it('合并暂存、工作树、新文件、删除和改名，限定项目目录且保留中文空格', () => {
  const f = fixture();
  writeFileSync(path.join(f.root, 'staged'), 'staged'); f.git('add', '搜打撤/staged');
  writeFileSync(path.join(f.root, 'working'), 'working');
  unlinkSync(path.join(f.root, 'deleted'));
  renameSync(path.join(f.root, 'old name'), path.join(f.root, '新 名称'));
  writeFileSync(path.join(f.repo, 'outside'), 'not in project');
  mkdirSync(path.join(f.root, 'ignored')); writeFileSync(path.join(f.root, 'ignored/cache'), 'ignored');
  expect(changedProjectPaths(f.root)).toEqual(['deleted', 'old name', 'staged', 'working', '新 名称']);
});

it('无改动时明确skip，只有测试文件变更时选择该测试；不执行检查或写入报告', () => {
  const f = fixture(); mkdirSync(path.join(f.root, 'scripts'));
  writeFileSync(path.join(f.root, 'package.json'), '{"type":"module"}');
  for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs', 'test-changed.mjs'])
    copyFileSync(path.resolve('scripts', name), path.join(f.root, 'scripts', name));
  writeFileSync(path.join(f.root, 'scripts/architecture-graph.mjs'), 'export const analyzeModule=()=>({imports:[]});');
  f.git('add', '.'); f.git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'fixture gate');
  const run = (...args) => spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--changed', ...args, '--json'], {
    cwd: f.root, encoding: 'utf8', timeout: 10_000,
  });
  const clean = run('--run'); expect(clean.status, clean.stderr).toBe(0);
  expect(JSON.parse(clean.stdout)).toMatchObject({ mode: 'skip', paths: [], tests: [] });
  writeFileSync(path.join(f.root, 'tests/新增.test.js'), '// a new test');
  const planned = run('--plan'); expect(planned.status, planned.stderr).toBe(0);
  expect(JSON.parse(planned.stdout)).toMatchObject({ mode: 'quick', tests: ['tests/新增.test.js'] });
  expect(f.git('diff', '--cached', '--name-only')).toBe('');
  expect(readFileSync(path.join(f.root, 'tests/新增.test.js'), 'utf8')).toBe('// a new test');
  writeFileSync(path.join(f.root, 'tests/removed.test.js'), '// deleted test');
  f.git('add', '搜打撤/tests/removed.test.js');
  f.git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'tracked test');
  unlinkSync(path.join(f.root, 'tests/removed.test.js'));
  const deleted = run('--plan'); expect(deleted.status, deleted.stderr).toBe(0);
  expect(JSON.parse(deleted.stdout)).toMatchObject({ mode: 'full', paths: expect.arrayContaining(['tests/removed.test.js']) });
});
