// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { isGateRelevantPath, planForPaths } from '../scripts/gate-plan.mjs';

describe('质量配置的可执行正确性边界', () => {
  const eslint = new ESLint();
  it('Vitest 两个环境项目完整且互斥，每个测试文件只收集一次', () => {
    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly', '--json'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 20_000,
    });
    expect(result.status, result.error?.message || result.stderr).toBe(0);
    const collected = JSON.parse(result.stdout);
    const files = collected.map(entry => entry.file.replaceAll('\\', '/')).sort();
    const expected = readdirSync('tests', { recursive: true }).filter(file => file.endsWith('.test.js'))
      .map(file => path.resolve('tests', file).replaceAll('\\', '/')).sort();
    expect(new Set(files).size).toBe(files.length);
    expect(files).toEqual(expected);
    expect(new Set(collected.map(entry => entry.projectName))).toEqual(new Set(['node', 'dom']));
  });
  it.each(['scripts/fixture.js', 'scripts/fixture.mjs', 'scripts/fixture.cjs', 'game/tools/fixture.mjs'])(
    '%s 的未定义变量不能被忽略', async filePath => {
      const [result] = await eslint.lintText('missingQualityVariable();', { filePath });
      expect(result.messages.some(m => m.ruleId === 'no-undef')).toBe(true);
      expect(result.warningCount).toBe(0);
    });
  it('CommonJS与标准Node全局按真实环境检查', async () => {
    const [result] = await eslint.lintText("const fs = require('node:fs'); module.exports = () => { console.log(Buffer.from('x')); setImmediate(() => fs.existsSync('x')); };", { filePath: 'scripts/fixture.cjs' });
    expect(result.messages).toEqual([]);
  });
  it('ESM工具不能凭CommonJS全局声明掩盖require错误', async () => {
    const [result] = await eslint.lintText("require('node:fs');", { filePath: 'scripts/fixture.mjs' });
    expect(result.messages).toContainEqual(expect.objectContaining({ ruleId: 'no-undef' }));
  });
  it.each(['eslint.config.js', 'jsconfig.json', 'jsconfig.strict-ui.json', 'tsconfig.json', 'vitest.config.mjs', 'vite.config.mjs', 'vite.config.cjs', '.githooks/pre-commit'])(
    '%s 不能skip且仍纳入混树守卫', filePath => {
      expect(isGateRelevantPath(filePath)).toBe(true);
      expect(planForPaths([filePath], { root: process.cwd() }).mode).toBe('full');
    });
  it('提交钩子的两种选择都进入暂存验收链', () => {
    const hook = readFileSync('.githooks/pre-commit', 'utf8');
    expect(hook).toContain('acceptance-gate.mjs --staged --force-full --run');
    expect(hook).toContain('acceptance-gate.mjs --staged --run');
    expect(hook).not.toContain('node_modules/vitest');
  });
});
