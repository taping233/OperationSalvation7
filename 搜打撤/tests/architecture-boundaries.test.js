import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeModule, buildModuleGraph, assertAcyclic, architectureViolations, deadGuardKeys, readModuleSources } from '../scripts/architecture-graph.mjs';

const graphOf = files => buildModuleGraph(new Map(Object.entries(files)));

describe('AST 架构检查的识别与负面场景', () => {
  it('识别静态导入、重导出、动态字面量与嵌套目录，不误判注释', () => {
    const graph = graphOf({
      'entry.js': "import './nested/item.js'; export { value } from './other.js'; import(`./lazy.js`); // import './ghost.js'",
      'nested/item.js': "import '../other.js'; export * from './leaf.js';",
      'nested/leaf.js': 'export const leaf = true;',
      'other.js': 'export const value = 1;',
      'lazy.js': 'export const lazy = true;',
    });
    expect(graph.get('entry.js').dependencies.map(x => x.target)).toEqual(['nested/item.js', 'other.js', 'lazy.js']);
    expect(graph.get('nested/item.js').dependencies.map(x => x.target)).toEqual(['other.js', 'nested/leaf.js']);
    expect(assertAcyclic(graph)).toBe(5);
  });

  it('能定位经动态导入与重导出形成的环', () => {
    const graph = graphOf({ 'a.js': "import('./sub/b.js');", 'sub/b.js': "export * from '../a.js';" });
    expect(() => assertAcyclic(graph)).toThrow('a.js -> sub/b.js -> a.js');
  });

  it('无法分析的动态路径与缺失源码不能悄悄略过', () => {
    expect(() => analyzeModule('import(target)', 'dynamic.js')).toThrow('dynamic.js:1');
    expect(() => graphOf({ 'a.js': "import './missing.js';" })).toThrow('缺少源码模块 missing.js');
  });

  it('数据和 npm 导入不伪装成项目 JS 模块', () => {
    const graph = graphOf({ 'data.js': "import data from '../data/cards.json'; import { parse } from 'acorn';" });
    expect(graph.get('data.js').dependencies).toEqual([]);
  });

  it('允许既有状态装配模块读取 runtime，禁止视图旁路', () => {
    const graph = graphOf({
      'battle/battle.runtime.js': 'export let energy = 0;',
      'battle/battle.engine.js': "import { energy } from './battle.runtime.js';",
      'battle/battle.view.js': "import { energy } from './battle.runtime.js'; import './battle.engine.js';",
    });
    const problems = architectureViolations(graph);
    expect(problems).toHaveLength(2);
    expect(problems.every(x => x.startsWith('battle/battle.view.js:'))).toBe(true);
  });

  it('纯模块不能借全局门面或反向 import 访问运行时，说明文字不误报', () => {
    const graph = graphOf({
      'battle/battle.runtime.js': 'export const state = {};',
      'battle/battle.resolution.js': "import './battle.runtime.js'; const state = window['SDT'];",
      'battle/battle.snapshot.js': "const comment = 'window.SDT'; export function read(value) { return value; }",
    });
    const problems = architectureViolations(graph);
    expect(problems.some(x => x.includes('全局浏览器对象 window:1'))).toBe(true);
    expect(problems.some(x => x.includes('反向依赖 battle/battle.runtime.js'))).toBe(true);
    expect(problems.some(x => x.startsWith('battle/battle.snapshot.js:'))).toBe(false);
  });

  it('纯模块不能反向依赖流程域目录（hub/run）', () => {
    const graph = graphOf({
      'battle/battle.resolution.js': "import '../hub/game.bag.js';",
      'hub/game.bag.js': 'export const bag = {};',
    });
    expect(architectureViolations(graph)).toEqual([
      'battle/battle.resolution.js:1: 独立规则/快照模块不能反向依赖 hub/game.bag.js',
    ]);
  });

  it('独立领域模块不能通过视图切片接入界面', () => {
    const graph = graphOf({
      'battle/battle.resolution.js': "import './battle.vfx.js';",
      'battle/battle.vfx.js': 'export const float = () => {};',
    });
    expect(architectureViolations(graph)).toEqual([
      'battle/battle.resolution.js:1: 独立规则/快照模块不能反向依赖 battle/battle.vfx.js',
    ]);
  });
});

describe('当前源码的架构边界', () => {
  // 源码图构建一次，供边界断言与判据键自检共用。
  const sources = readModuleSources(resolve(process.cwd(), 'game/src'));

  it('战斗状态访问与独立规则模块遵循允许方向', () => {
    expect(architectureViolations(buildModuleGraph(sources))).toEqual([]);
  });

  it('守卫判据键自检：每个键必须命中真实文件，杜绝规则死、测试绿', () => {
    expect(deadGuardKeys(sources)).toEqual([]);
  });

  it('自检本身能红：文件改名（或删除）会让对应判据键被判死', () => {
    const renamed = new Map(sources);
    renamed.delete('battle/battle.snapshot.js');
    expect(deadGuardKeys(renamed)).toContain('battle/battle.snapshot.js');
  });
});
