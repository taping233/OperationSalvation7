import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(project, 'scripts/workflow.mjs');
describe('流程入口集成', () => {
  it('帮助完整暴露记忆、浏览器、隔离与文档能力，旧命令不再启外部浏览器', () => {
    const help = JSON.parse(execFileSync(process.execPath, [cli, '--help', '--json'], { encoding: 'utf8' }));
    for (const command of ['memory', 'browser import', 'browser compare', 'staged', 'docs']) expect(help.help).toContain(command);
    const legacy = path.join(project, 'scripts/page-snapshot.mjs');
    const legacyHelp = JSON.parse(execFileSync(process.execPath, [legacy, '--help', '--json'], { encoding: 'utf8' }));
    expect(legacyHelp.help).toContain('不启动');
    const external = spawnSync(process.execPath, [legacy, '--port', '5338', '--json'], { encoding: 'utf8' });
    expect(external.status).not.toBe(0);
    expect(JSON.parse(external.stdout).ok).toBe(false);
  });
  it('实际文档索引可从统一命令返回有界、带来源的JSON', () => {
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'docs', '--json'], { encoding: 'utf8' }));
    expect(result.ok).toBe(true);
    expect(result.scannedFiles).toContain('docs/WORKFLOW-TOOLS.md');
    expect(result.findings.some(item => item.kind === 'broken-link')).toBe(false);
  });
  it('七份类型配置确实纳入证据指纹', async () => {
    const { fingerprint } = await import('../scripts/workflow-evidence.mjs');
    const manifest = fingerprint(project).manifest;
    expect(manifest.some(item => item.file === 'jsconfig.strict-hand-selection.json')).toBe(true);
    const configs = manifest.filter(item => /^jsconfig.*\.json$/.test(item.file));
    expect(configs).toHaveLength(7);
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
