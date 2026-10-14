import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { analyzeModule, buildModuleGraph, assertAcyclic, architectureViolations, deadGuardKeys, readModuleSources } from '../scripts/architecture-graph.mjs';

const graphOf = files => buildModuleGraph(new Map(Object.entries(files)));

describe('AST 架构检查的识别与负面场景', () => {
  it('会话内核不能重新接入 DOM 或浏览器适配器', () => {
    const graph = graphOf({
      'run/game.session.kernel.js': "import './game.session.browser.js'; const el = document.getElementById('game');",
      'run/game.session.browser.js': 'export const adapter = true;',
    });
    expect(architectureViolations(graph)).toHaveLength(2);
  });

  it('基地模型与规则配置不得反向读取存储、门面或全局浏览器', () => {
    const graph = graphOf({
      'hub/base-state.js': "import './base.js';",
      'hub/base.js': 'export const base = {};',
      'core/rule-config.js': 'export const rules = window.SDT.RULES;',
    });
    expect(architectureViolations(graph)).toHaveLength(2);
  });
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
      'battle/runtime/battle.runtime.js': 'export let energy = 0;',
      'battle/core/battle.engine.js': "import { energy } from '../runtime/battle.runtime.js';",
      'battle/view/battle.view.js': "import { energy } from '../runtime/battle.runtime.js'; import '../core/battle.engine.js';",
    });
    const problems = architectureViolations(graph);
    expect(problems).toHaveLength(2);
    expect(problems.every(x => x.startsWith('battle/view/battle.view.js:'))).toBe(true);
  });

  it('纯模块不能借全局门面或反向 import 访问运行时，说明文字不误报', () => {
    const graph = graphOf({
      'battle/runtime/battle.runtime.js': 'export const state = {};',
      'battle/core/battle.resolution.js': "import '../runtime/battle.runtime.js'; const state = window['SDT'];",
      'battle/effects/battle.discover-candidates.js': "import '../runtime/battle.runtime.js'; const state = window.SDT;",
      'battle/runtime/battle.snapshot.js': "const comment = 'window.SDT'; export function read(value) { return value; }",
    });
    const problems = architectureViolations(graph);
    expect(problems.some(x => x.includes('全局浏览器对象 window:1'))).toBe(true);
    expect(problems.some(x => x.includes('反向依赖 battle/runtime/battle.runtime.js'))).toBe(true);
    expect(problems.some(x => x.startsWith('battle/effects/battle.discover-candidates.js:'))).toBe(true);
    expect(problems.some(x => x.startsWith('battle/runtime/battle.snapshot.js:'))).toBe(false);
  });

  it('选牌域必须通过装配端口访问服务，不能重新读取浏览器门面', () => {
    const graph = graphOf({
      'battle/core/battle.selection-flow.js': "import '../../core/sdt-facade.js'; const cards = window.SDT.Cards;",
      'core/sdt-facade.js': 'export const SDT = {};',
    });
    const problems = architectureViolations(graph);
    expect(problems).toHaveLength(2);
    expect(problems.some(problem => problem.includes('不能依赖 SDT 浏览器门面'))).toBe(true);
    expect(problems.some(problem => problem.includes('不能读取全局浏览器对象'))).toBe(true);
  });

  it('选牌域不能重新静态导入带 UI 等待的整段播放模块', () => {
    const graph = graphOf({
      'battle/core/battle.selection-flow.js': "import '../runtime/battle.staged-playback.js';",
      'battle/runtime/battle.staged-playback.js': 'export const wait = () => {};',
    });
    expect(architectureViolations(graph)).toEqual([
      'battle/core/battle.selection-flow.js:1: 无浏览器选牌域不能依赖 battle/runtime/battle.staged-playback.js',
    ]);
  });

  it('纯模块不能反向依赖流程域目录（hub/run）', () => {
    const graph = graphOf({
      'battle/core/battle.resolution.js': "import '../../hub/game.bag.js';",
      'hub/game.bag.js': 'export const bag = {};',
    });
    expect(architectureViolations(graph)).toEqual([
      'battle/core/battle.resolution.js:1: 独立规则/快照模块不能反向依赖 hub/game.bag.js',
    ]);
  });

  it('M 批命令适配器仅供 resolver 装配，视图和快照仍不可调用', () => {
    const graph = graphOf({
      'battle/effects/effect-steps.m1.js': "import '../runtime/battle.runtime.piles.js';",
      'battle/runtime/battle.runtime.piles.js': 'export const hand = [];',
      'battle/core/battle.resolution.js': "import '../effects/effect-steps.m1.js';",
      'battle/runtime/battle.snapshot.js': "import '../effects/effect-steps.m1.js';",
      'battle/view/battle.view.js': "import '../effects/effect-steps.m1.js';",
    });
    const problems = architectureViolations(graph);
    expect(problems).toHaveLength(2);
    expect(problems.some(problem => problem.startsWith('battle/runtime/battle.snapshot.js:'))).toBe(true);
    expect(problems.some(problem => problem.startsWith('battle/view/battle.view.js:'))).toBe(true);
  });

  it('独立领域模块不能通过视图切片接入界面', () => {
    const graph = graphOf({
      'battle/core/battle.resolution.js': "import '../view/battle.vfx.js';",
      'battle/view/battle.vfx.js': 'export const float = () => {};',
    });
    expect(architectureViolations(graph)).toEqual([
      'battle/core/battle.resolution.js:1: 独立规则/快照模块不能反向依赖 battle/view/battle.vfx.js',
    ]);
  });

  it.each([
    ['hub/game.cardslib.js', "import './game.cardslib.page.js';", 'static'],
    ['hub/game.cardslib.js', "export { open } from './game.cardslib.page.js';", 'reexport'],
    ['hub/game.hub.js', "import('./game.cardslib.page.js');", 'wrong dynamic entry'],
  ])('照相馆页面仅允许轻门面动态加载（%s, %s）', (source, statement) => {
    const graph = graphOf({
      [source]: statement,
      'hub/game.cardslib.js': source === 'hub/game.cardslib.js' ? statement : 'export const shell = true;',
      'hub/game.cardslib.page.js': 'export const open = true;',
      ...(source === 'hub/game.hub.js' ? { 'hub/game.hub.js': statement } : {}),
    });
    expect(architectureViolations(graph)).toContain(
      `${source}:1: hub/game.cardslib.page.js 只能由 hub/game.cardslib.js 动态加载`,
    );
  });

  it.each([
    ['hub/game.hub.js', "import './game.hub.runtime.js';"],
    ['hub/game.hub.js', "export { open } from './game.hub.runtime.js';"],
    ['game.boot.js', "import('./hub/game.hub.runtime.js');"],
  ])('基地实现只允许基地门面动态加载（%s）', (source, statement) => {
    const graph = graphOf({
      [source]: statement,
      'hub/game.hub.runtime.js': 'export const open = true;',
    });
    expect(architectureViolations(graph)).toContain(
      `${source}:1: hub/game.hub.runtime.js 只能由 hub/game.hub.js 动态加载`,
    );
  });

  it('基地轻门面的动态入口合法', () => {
    expect(architectureViolations(graphOf({
      'hub/game.hub.js': "import('./game.hub.runtime.js');",
      'hub/game.hub.runtime.js': 'export const open = true;',
    }))).toEqual([]);
  });

  it('照相馆轻门面的动态入口合法', () => {
    const graph = graphOf({
      'hub/game.cardslib.js': "import('./game.cardslib.page.js');",
      'hub/game.cardslib.page.js': 'export const open = true;',
    });
    expect(architectureViolations(graph)).toEqual([]);
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
    renamed.delete('battle/runtime/battle.snapshot.js');
    expect(deadGuardKeys(renamed)).toContain('battle/runtime/battle.snapshot.js');
    renamed.set('battle/runtime/battle.snapshot.js', sources.get('battle/runtime/battle.snapshot.js'));
    renamed.delete('hub/game.cardslib.page.js');
    expect(deadGuardKeys(renamed)).toContain('hub/game.cardslib.page.js');
    renamed.set('hub/game.cardslib.page.js', sources.get('hub/game.cardslib.page.js'));
    renamed.delete('hub/game.hub.runtime.js');
    expect(deadGuardKeys(renamed)).toContain('hub/game.hub.runtime.js');
    renamed.delete('hub/game.cardslib.js');
    expect(deadGuardKeys(renamed)).toContain('hub/game.cardslib.js');
  });
});
