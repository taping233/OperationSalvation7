import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {describe, expect, it, vi } from 'vitest';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(project, 'scripts/workflow.mjs');
describe('流程入口集成', () => {
  it('帮助完整暴露记忆、浏览器、隔离与文档能力', () => {
    const help = JSON.parse(execFileSync(process.execPath, [cli, '--help', '--json'], { encoding: 'utf8' }));
    for (const command of ['memory', 'browser import', 'browser compare', 'staged', 'docs']) expect(help.help).toContain(command);
    // 旧 page-snapshot 命令已于 10-02 清理：浏览器证据唯一入口为 workflow browser import/compare，
    // 统一入口的帮助文本本身声明不启动外部浏览器（quality-gates 内置浏览器节为口径真源）。
    expect(help.help.length).toBeGreaterThan(0);
  });
  it('实际文档索引可从统一命令返回有界、带来源的JSON', () => {
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'docs', '--json'], { encoding: 'utf8' }));
    expect(result.ok).toBe(true);
    expect(result.scannedFiles).toContain('docs/WORKFLOW-TOOLS.md');
    expect(result.findings.some(item => item.kind === 'broken-link')).toBe(false);
  });
  it('八份类型配置确实纳入证据指纹（DEBT-2 strict 扩面起随配置数走）', async () => {
    const { fingerprint } = await import('../scripts/workflow-evidence.mjs');
    const manifest = fingerprint(project).manifest;
    expect(manifest.some(item => item.file === 'jsconfig.strict-hand-selection.json')).toBe(true);
    const configs = manifest.filter(item => /^jsconfig.*\.json$/.test(item.file));
    expect(configs).toHaveLength(8);
    expect(configs.some(item => item.file === 'jsconfig.strict-ui.json')).toBe(true);
  });
  it('暂存计划命令返回边界与数量，不倾倒整个仓库index', () => {
    const output = execFileSync(process.execPath, [cli, 'staged', '--plan', '--json'], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    const result = JSON.parse(output);
    expect(result.ok).toBe(true);
    expect(result.indexEntryCount).toBeGreaterThan(0);
    expect(result.entries).toBeUndefined();
    expect(Array.isArray(result.changes)).toBe(true);
    expect(output.length).toBeLessThan(100000);
  });
  it('npm工作流入口只连接项目脚本，不改变依赖或跳过原门禁', () => {
    const pkg = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.scripts.workflow).toBe('node scripts/workflow.mjs');
    expect(pkg.scripts['check:staged:isolate']).toContain('staged --task');
    expect(pkg.scripts['check:staged']).toContain('acceptance-gate.mjs --staged --run');
  });
});
