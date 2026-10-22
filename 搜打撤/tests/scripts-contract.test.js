/* 脚本契约测试（R2，2026-10-01 老板拍板应用）：
 * 1) scripts/ 全部脚本可解析（acorn 语法契约）——未映射脚本回退跑本测试的下限保障；
 * 2) 映射完整性守卫——scripts/ 每个脚本必须在 acceptance-gate 的 WORKFLOW_TESTS 映射
 *    或 EXEMPT_SCRIPTS 豁免清单里显式登记；新增脚本漏登记时本测试红，倒逼显式决策
 *    （映射进快速门，或豁免并接受契约测试下限），不再无声回退全量。 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { EXEMPT_SCRIPTS, WORKFLOW_TESTS } from '../scripts/acceptance-gate.mjs';

const SCRIPTS_DIR = path.resolve('scripts');
const scriptFiles = readdirSync(SCRIPTS_DIR).filter(f => f.endsWith('.mjs') || f.endsWith('.cjs'));

describe('脚本契约：语法可解析（未映射脚本回退下限）', () => {
  for (const file of scriptFiles) {
    it(`${file} 语法可解析`, () => {
      const source = readFileSync(path.join(SCRIPTS_DIR, file), 'utf8');
      // cjs 用非模块 goal，mjs 用 module goal；解析失败即红，语法是契约测试的硬下限。
      parse(source, { ecmaVersion: 'latest', sourceType: file.endsWith('.mjs') ? 'module' : 'script' });
    });
  }
});

describe('映射完整性守卫：新脚本必须显式登记', () => {
  it('dependency audit uses a native Vitest bridge, never a Node-only file or exemption', () => {
    const script = 'scripts/dependency-audit-diagnostics.mjs';
    expect(EXEMPT_SCRIPTS.has(script)).toBe(false);
    expect(WORKFLOW_TESTS.get(script)).toEqual(['tests/dependency-audit-diagnostics.test.js']);
  });

  it('每个脚本都已映射专属测试或登记豁免', () => {
    const unregistered = scriptFiles
      .map(file => 'scripts/' + file)
      .filter(projectPath => !WORKFLOW_TESTS.has(projectPath) && !EXEMPT_SCRIPTS.has(projectPath));
    expect(unregistered, '新脚本须在 acceptance-gate.mjs 的 WORKFLOW_TESTS 加映射（推荐，定向更快），'
      + '或加入 EXEMPT_SCRIPTS 豁免（接受语法契约+引用搜索下限）。未登记：' + unregistered.join(', '))
      .toEqual([]);
  });

  it('映射与豁免指向的脚本/测试真实存在（防清单腐坏）', () => {
    for (const [script, tests] of WORKFLOW_TESTS) {
      if (!script.startsWith('scripts/')) continue;  // game/tools 映射由各自定向测试守护
      expect(scriptFiles, '映射指向不存在的脚本：' + script).toContain(script.replace('scripts/', ''));
      for (const test of tests) {
        expect(existsSync(test), '映射测试文件缺失：' + test).toBe(true);
      }
    }
    for (const script of EXEMPT_SCRIPTS) {
      expect(scriptFiles, '豁免清单指向不存在的脚本：' + script).toContain(script.replace('scripts/', ''));
    }
  });
});
