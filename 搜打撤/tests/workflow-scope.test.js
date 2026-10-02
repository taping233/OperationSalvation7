import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fingerprint, freshness, runCheck } from '../scripts/workflow-evidence.mjs';

const roots = [];
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-workflow-scope-')); roots.push(root);
  for (const folder of ['docs/production/management', 'docs/evidence/2026-09-30-fixture', 'game/src']) mkdirSync(path.join(root, folder), { recursive: true });
  writeFileSync(path.join(root, 'game/src/code.js'), 'export const n = 1;');
  for (const file of ['PARALLEL-REGISTRY.md', 'PENDING.md', 'STATUS.md']) writeFileSync(path.join(root, 'docs', file), 'state-v1');
  writeFileSync(path.join(root, 'docs/quality-gates.md'), 'rules-v1');
  writeFileSync(path.join(root, 'docs/roadmap.md'), 'plan-v1');
  writeFileSync(path.join(root, 'docs/production/management/ITERATION-BOARD.md'), 'method-v1');
  writeFileSync(path.join(root, 'docs/evidence/2026-09-30-fixture/task.json'), '{"state":"open"}');
  return root;
}
const evidence = snapshot => ({ schemaVersion: 1, exitCode: 0, before: snapshot, after: snapshot });
afterEach(() => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-workflow-scope-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
    if (existsSync(root) && process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Remove-Item -LiteralPath $env:SDT_SCOPE_TEST_CLEANUP_PATH -Recurse -Force -ErrorAction Stop'], {
      env: { ...process.env, SDT_SCOPE_TEST_CLEANUP_PATH: root } });
  }
});

describe('验收指纹按范围复用', () => {
  it('显式full的预检、执行与报告都保持full；只执行临时fixture runner', async () => {
    const root = fixture();
    mkdirSync(path.join(root, 'scripts'));
    writeFileSync(path.join(root, 'scripts/acceptance-gate.mjs'), "if (!process.argv.includes('--full')) process.exit(99); if(process.argv.includes('--plan')) console.log(JSON.stringify({mode:'full',paths:[],tests:[],reasons:['fixture']})); else console.log('fixture full executed');");
    const gitAt = args => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: root, stdio: 'pipe' });
    gitAt(['init', '-q']); gitAt(['add', '.']);
    gitAt(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@test', 'commit', '-qm', 'base']);
    const result = await runCheck(root, { task: 'full-mode', date: '2026-10-02', full: true, json: true });
    const report = JSON.parse(readFileSync(path.join(root, result.report), 'utf8'));
    expect(result.validation.mode).toBe('full');
    expect(report.command.slice(1)).toEqual(['scripts/acceptance-gate.mjs', '--full', '--run']);
    expect(report.validation).toMatchObject({ mode: 'full', executed: true });
    expect(report.outcome).toBe('passed');
  });
  it('三份明确台账与唯一目录 task.json 的变化不使代码候选失效', () => {
    const root = fixture();
    for (const file of ['docs/PARALLEL-REGISTRY.md', 'docs/PENDING.md', 'docs/STATUS.md', 'docs/evidence/2026-09-30-fixture/task.json']) {
      const before = fingerprint(root, { documents: true });
      writeFileSync(path.join(root, file), readFileSync(path.join(root, file), 'utf8') + '\nupdate');
      const current = fingerprint(root, { documents: true });
      const result = freshness(evidence(before), current);
      expect(current.groups.code).toBe(before.groups.code); expect(current.groups.docs).toBe(before.groups.docs);
      expect(current.groups.state).not.toBe(before.groups.state);
      expect(result.result).toBe('state-changed'); expect(result.eligibleForReview).toBe(true);
      expect(result.codeEligibleForReview).toBe(true); expect(result.recheck).toEqual(['state']);
      expect(result.parts.state.status).toBe('stale'); expect(result.parts.state.eligibleForReview).toBe(false);
    }
  });
  it('规则、roadmap、迭代办法和归档文档变化只要求文档重核', () => {
    const root = fixture(); mkdirSync(path.join(root, 'docs/archive'), { recursive: true });
    writeFileSync(path.join(root, 'docs/archive/old-rule.md'), 'history-v1');
    for (const file of ['docs/quality-gates.md', 'docs/roadmap.md', 'docs/production/management/ITERATION-BOARD.md', 'docs/archive/old-rule.md']) {
      const before = fingerprint(root, { documents: true });
      writeFileSync(path.join(root, file), 'updated');
      const result = freshness(evidence(before), fingerprint(root, { documents: true }));
      expect(result.result).toBe('stale'); expect(result.eligibleForReview).toBe(false);
      expect(result.codeEligibleForReview).toBe(true); expect(result.parts.code.status).toBe('candidate');
      expect(result.parts.docs.status).toBe('stale'); expect(result.recheck).toEqual(['docs']);
    }
  });
  it('代码和工程配置变化仍使代码证据失效', () => {
    const root = fixture();
    mkdirSync(path.join(root, '.githooks'));
    for (const file of ['game/src/code.js', 'vite.config.js', 'package-lock.json', 'eslint.config.cjs',
      'vitest.config.mjs', 'jsconfig.tools.json', '.githooks/pre-commit']) {
      const before = fingerprint(root, { documents: true }); writeFileSync(path.join(root, file), 'changed');
      const result = freshness(evidence(before), fingerprint(root, { documents: true }));
      expect(result.result).toBe('stale'); expect(result.codeEligibleForReview).toBe(false);
      expect(result.recheck).toEqual(['code']); expect(result.parts.docs.status).toBe('candidate');
    }
  });
  it('资产检查候选锁定字节、新增路径及历史债，显式测试可保留自己的范围', () => {
    const root = fixture(); mkdirSync(path.join(root, 'game/assets'), { recursive: true });
    writeFileSync(path.join(root, 'game/assets/sample.png'), 'fixture-image');
    writeFileSync(path.join(root, 'docs/asset-audit-debt.json'), '{}');
    const before = fingerprint(root, { assets: true });
    writeFileSync(path.join(root, 'game/assets/sample.png'), 'modified-image');
    expect(freshness(evidence(before), fingerprint(root, { assets: true })).codeEligibleForReview).toBe(false);
    const modified = fingerprint(root, { assets: true });
    writeFileSync(path.join(root, 'game/assets/new.png'), 'new-image');
    expect(freshness(evidence(modified), fingerprint(root, { assets: true })).codeEligibleForReview).toBe(false);
    const added = fingerprint(root, { assets: true });
    writeFileSync(path.join(root, 'docs/asset-audit-debt.json'), '{"changed":true}');
    expect(freshness(evidence(added), fingerprint(root, { assets: true })).codeEligibleForReview).toBe(false);
    expect(fingerprint(root).manifest.some(entry => entry.file.startsWith('game/assets'))).toBe(false);
  });
  it('环境变化独立显示，不能使用旧代码证据', () => {
    const root = fixture(), before = fingerprint(root, { documents: true });
    const current = structuredClone(before); current.environment.node = 'different-node';
    const result = freshness(evidence(before), current);
    expect(result.result).toBe('stale'); expect(result.codeEligibleForReview).toBe(false);
    expect(result.parts.code.status).toBe('candidate'); expect(result.parts.environment.status).toBe('stale');
    expect(result.recheck).toEqual(['code', 'environment']);
  });
  it('失败、信号中断与指纹采集失败不能成为候选', () => {
    const root = fixture(), current = fingerprint(root, { documents: true });
    for (const extra of [{ exitCode: 1 }, { exitCode: null }, { signal: 'SIGTERM' }, { error: 'spawn failed' }]) {
      const result = freshness({ ...evidence(current), ...extra }, current);
      expect(result.result).toBe('failed'); expect(result.codeEligibleForReview).toBe(false); expect(result.eligibleForReview).toBe(false);
    }
    const invalid = freshness({ ...evidence(current), after: { ...current, error: 'fingerprint failed' } }, current);
    expect(invalid.result).toBe('unverifiable'); expect(invalid.codeEligibleForReview).toBe(false);
  });
  it('检查过程中代码变化不能被结束时指纹匹配掩盖，台账变化仅廉价重核', () => {
    const root = fixture(), before = fingerprint(root, { documents: true });
    writeFileSync(path.join(root, 'game/src/code.js'), 'during-check');
    const after = fingerprint(root, { documents: true });
    const result = freshness({ ...evidence(before), after }, after);
    expect(result.result).toBe('changed-during-check'); expect(result.codeEligibleForReview).toBe(false);
    expect(result.parts.code.changedDuringCheck).toBe(true);
    const stableCode = after;
    writeFileSync(path.join(root, 'docs/STATUS.md'), 'completed');
    const updatedState = fingerprint(root, { documents: true });
    const stateResult = freshness({ ...evidence(stableCode), after: updatedState }, updatedState);
    expect(stateResult.result).toBe('state-changed'); expect(stateResult.codeEligibleForReview).toBe(true);
    expect(stateResult.recheck).toEqual(['state']);
  });
  it('代码定向报告不假装覆盖规则文档，历史日志不会影响候选', () => {
    const root = fixture(), before = fingerprint(root);
    writeFileSync(path.join(root, 'docs/quality-gates.md'), 'new-rule');
    writeFileSync(path.join(root, 'docs/evidence/2026-09-30-fixture/report.json'), '{"exitCode":1}');
    const current = fingerprint(root);
    const result = freshness(evidence(before), current);
    expect(result.result).toBe('candidate'); expect(result.parts.docs.status).toBe('not-covered');
    expect(current.sha256).toBe(before.sha256); expect(result.recheck).toEqual([]);
  });
  it('不能靠缺失当前文档范围将已覆盖文档降级为通过', () => {
    const root = fixture(), before = fingerprint(root, { documents: true });
    const result = freshness(evidence(before), fingerprint(root));
    expect(result.codeEligibleForReview).toBe(true); expect(result.eligibleForReview).toBe(false);
    expect(result.parts.docs.status).toBe('unverifiable'); expect(result.recheck).toEqual(['docs']);
  });
  it('schema 1 原报告可由 manifest/环境重新分组，无manifest旧报告保守整体比较', () => {
    const root = fixture(), before = fingerprint(root, { documents: true }); delete before.groups;
    writeFileSync(path.join(root, 'docs/STATUS.md'), 'state-v2');
    const result = freshness(evidence(before), fingerprint(root, { documents: true }));
    expect(result.result).toBe('state-changed'); expect(result.codeEligibleForReview).toBe(true);
    expect(result.recheck).toEqual(['state']);
    const legacy = { sha256: 'legacy' };
    expect(freshness(evidence(legacy), legacy).eligibleForReview).toBe(true);
    const unmatched = freshness(evidence(legacy), { sha256: 'changed' });
    expect(unmatched.result).toBe('stale'); expect(unmatched.codeEligibleForReview).toBe(false);
    expect(unmatched.parts.code.status).toBe('unknown');
  });
});
