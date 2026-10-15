// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

const installer = readFileSync(fileURLToPath(new URL('../scripts/setup-commit-gate.mjs', import.meta.url)));
const roots = [];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
// Windows 上 os.devNull（\\.\nul）无法被 git 作为配置文件打开；用空临时文件隔离全局配置。
const isolatedGitConfig = path.join(os.tmpdir(), `sdt-gate-setup-global-${process.pid}.gitconfig`);
writeFileSync(isolatedGitConfig, '');
Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: isolatedGitConfig, GIT_TERMINAL_PROMPT: '0' });
afterAll(() => { unlinkSync(isolatedGitConfig); });
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8', stdio: 'pipe' }).trim();

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-gate-setup-'));
  roots.push(root);
  const primary = path.join(root, 'primary');
  mkdirSync(primary);
  git(primary, ['init', '-q']);
  git(primary, ['config', '--local', 'user.name', 'gate-fixture']);
  git(primary, ['config', '--local', 'user.email', 'gate-fixture@example.invalid']);
  git(primary, ['config', '--local', 'core.hooksPath', '.git/fixture-no-hooks']);
  const project = path.join(primary, '搜打撤');
  mkdirSync(path.join(project, 'scripts'), { recursive: true });
  mkdirSync(path.join(project, '.githooks'));
  mkdirSync(path.join(project, 'game/src/nested'), { recursive: true });
  writeFileSync(path.join(project, 'scripts/setup-commit-gate.mjs'), installer);
  writeFileSync(path.join(project, '.githooks/pre-commit'), '#!/bin/sh\nexit 0\n');
  git(primary, ['add', '.']);
  git(primary, ['commit', '-qm', 'isolated gate installer fixture']);
  return { root, primary, project };
}

function run(script, cwd) {
  return spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-gate-setup-') || relative.includes(path.sep) || path.isAbsolute(relative)) throw new Error('拒绝清理非自有安装夹具');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('提交门禁安装的 primary checkout 边界', () => {
  it.each(['root', 'project', 'nested'])('primary 从 %s cwd 安装到自身本地配置', cwdKind => {
    const { primary, project } = fixture();
    const cwd = cwdKind === 'root' ? primary : cwdKind === 'project' ? project : path.join(project, 'game/src/nested');
    const result = run(path.join(project, 'scripts/setup-commit-gate.mjs'), cwd);
    expect(result.status, result.stderr).toBe(0);
    expect(git(primary, ['config', '--local', '--get', 'core.hooksPath'])).toBe(path.join(project, '.githooks').replaceAll('\\', '/'));
    expect(result.stdout).toContain('commit gate installed');
  });

  it('从其他仓库 cwd 调用 primary 脚本仍只修改脚本所属仓库', () => {
    const { root, primary, project } = fixture();
    const other = path.join(root, 'other');
    mkdirSync(other);
    git(other, ['init', '-q']);
    git(other, ['config', '--local', 'core.hooksPath', 'other-original-hooks']);
    const before = readFileSync(path.join(other, '.git/config'));
    const result = run(path.join(project, 'scripts/setup-commit-gate.mjs'), other);
    expect(result.status, result.stderr).toBe(0);
    expect(git(primary, ['config', '--local', '--get', 'core.hooksPath'])).toBe(path.join(project, '.githooks').replaceAll('\\', '/'));
    expect(readFileSync(path.join(other, '.git/config'))).toEqual(before);
  });

  it('linked worktree 拒绝安装且不改共享配置或其 hook 文件', () => {
    const { root, primary } = fixture();
    const linked = path.join(root, 'linked');
    git(primary, ['worktree', 'add', '-q', '--detach', linked, 'HEAD']);
    const config = path.join(primary, '.git/config');
    const hook = path.join(linked, '搜打撤/.githooks/pre-commit');
    const configBefore = readFileSync(config);
    const hookBefore = { bytes: readFileSync(hook), mode: statSync(hook).mode };
    const result = run(path.join(linked, '搜打撤/scripts/setup-commit-gate.mjs'), linked);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('primary checkout only');
    expect(readFileSync(config)).toEqual(configBefore);
    expect(readFileSync(hook)).toEqual(hookBefore.bytes);
    expect(statSync(hook).mode).toBe(hookBefore.mode);
  });
});
