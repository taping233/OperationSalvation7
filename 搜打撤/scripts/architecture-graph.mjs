import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

const JS_FILE = /\.(?:js|mjs)$/;
// 判据键一律为相对 game/src 的真实文件路径（2026-09-23 目录化后的命名）。
// 2026-09-24 守卫复活：全部键改为精确集合匹配（不再用路径正则），并由
// deadGuardKeys 自检“每个键至少命中一个真实文件”，防止目录再改名时规则死、测试绿。
// 战斗运行时的完整表面：兼容壳 + 各属地状态模块——视图/纯模块一律不得直读。
const RUNTIME_SURFACE = new Set([
  'battle/runtime/battle.runtime.js',
  'battle/runtime/battle.runtime.session.js', 'battle/runtime/battle.runtime.piles.js',
  'battle/runtime/battle.runtime.interaction.js', 'battle/runtime/battle.runtime.effects.js',
  'battle/runtime/battle.runtime.presentation.js',
]);
const EXECUTION_ADAPTERS = new Set(['battle/effects/requested-card-runtime.js', 'battle/effects/effect-steps.m1.js', 'battle/effects/effect-steps.m2.js']);
const RUNTIME_INNER = new Set([
  'battle/core/battle.engine.js', 'battle/core/battle.enemy-phase.js', 'battle/core/battle.selection-flow.js',
  'battle/bag/battle.equipment.js', 'battle/bag/battle.bag.js', 'battle/core/battle.lifecycle.js',
  'battle/core/battle.exec-play.js', 'battle/core/battle.draw.js', 'battle/core/battle.foe-lifecycle.js',
  // M 批结算适配器拥有牌区操作与已登记触发器；不对视图开放状态访问。
  ...EXECUTION_ADAPTERS, 'battle/effects/battle.triggers.m2.js',
]);
const RUNTIME_OWNERS = new Set(['battle/core/battle.core.js', ...RUNTIME_INNER]);
const PURE_MODULES = new Set([
  'battle/effects/battle.card-cost.js', 'battle/core/battle.enemy-intent.js', 'battle/core/battle.resolution.js',
  'battle/runtime/battle.snapshot.js', 'cards/cards.catalog.js',
  'cards/card-rarity.js', 'cards/card-render-context.js',
  'core/rule-config.js', 'hub/base-state.js', 'hub/base-mutation.js',
  'hub/base-economy.js', 'hub/base-progression.commands.js',
  'battle/effects/battle.card-inspection.js', 'battle/core/battle.hand-selection.js',
  'battle/effects/battle.discover-candidates.js', 'battle/effects/hosted-catalog-index.js',
]);
// These feature domains use explicit runtime ports and must stay importable without the browser facade.
const BROWSER_ISOLATED_MODULES = new Set(['battle/core/battle.selection-flow.js']);
const BROWSER_ISOLATION_FORBIDDEN_IMPORTS = new Map([
  ['battle/core/battle.selection-flow.js', new Set(['battle/runtime/battle.staged-playback.js'])],
]);
const SESSION_KERNEL = 'run/game.session.kernel.js';
const SESSION_BROWSER = 'run/game.session.browser.js';
const VIEW_MODULES = new Set([
  'battle/view/battle.view.js', 'battle/view/battle.overlays.js', 'battle/view/battle.layers.js',
  'battle/view/battle.vfx.js', 'battle/view/battle.anim.view.js', 'battle/view/battle.aim.js',
  'battle/view/battle.hover.js', 'battle/view/battle.frames.js', 'battle/view/battle.piles.view.js',
]);
// 流程域（基地/局外 + 局内流程）——纯规则/快照模块不得反向依赖。
const FLOW_PREFIXES = ['hub/', 'run/'];
// 规则里作为“依赖目标”写死的路径，同样纳入防失效自检。
const PROTECTED_TARGETS = new Set([...RUNTIME_SURFACE, 'core/sdt-facade.js', SESSION_KERNEL, SESSION_BROWSER]);
// 照相馆页面是大块首屏外模块，只允许轻门面动态加载；防止新增静态边把页面拉回首屏。
const LAZY_PAGE_ENTRIES = new Map([
  ['hub/game.cardslib.page.js', 'hub/game.cardslib.js'],
  ['hub/game.hub.runtime.js', 'hub/game.hub.js'],
  ['run/game.run.class-choice.page.js', 'run/game.run.class-choice.js'],
]);

// 防再发自检：返回在真实源码树中零命中的判据键；非空即守卫腐化，守卫测试必须红。
export function deadGuardKeys(sources) {
  const dead = [];
  for (const key of [...RUNTIME_OWNERS, ...PURE_MODULES, ...VIEW_MODULES, ...PROTECTED_TARGETS,
    ...BROWSER_ISOLATED_MODULES, ...LAZY_PAGE_ENTRIES.keys(), ...LAZY_PAGE_ENTRIES.values()]) {
    if (!sources.has(key)) dead.push(key);
  }
  for (const [source, targets] of BROWSER_ISOLATION_FORBIDDEN_IMPORTS) {
    if (!sources.has(source)) dead.push(source);
    for (const target of targets) if (!sources.has(target)) dead.push(target);
  }
  for (const prefix of FLOW_PREFIXES) {
    if (![...sources.keys()].some(name => name.startsWith(prefix))) dead.push(prefix);
  }
  return dead;
}

export function readModuleSources(root) {
  const sources = new Map();
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && JS_FILE.test(entry.name)) {
        sources.set(path.relative(root, absolute).split(path.sep).join('/'), readFileSync(absolute, 'utf8'));
      }
    }
  };
  visit(root);
  return sources;
}

// 从 AST 读取依赖；注释、日志、模板正文中的 import 字样不构成依赖。
export function analyzeModule(source, filename = '<module>') {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const imports = [];
  const browserGlobals = [];
  const add = (node, kind) => {
    const specifier = typeof node.source.value === 'string' ? node.source.value
      : node.source.type === 'TemplateLiteral' && !node.source.expressions.length
        ? node.source.quasis[0].value.cooked : null;
    if (specifier == null) throw new Error(`${filename}:${node.loc.start.line}: 无法静态确定 import 目标`);
    imports.push({ specifier, kind, line: node.loc.start.line });
  };
  simple(ast, {
    ImportDeclaration: node => add(node, 'static'),
    ExportNamedDeclaration: node => { if (node.source) add(node, 'reexport'); },
    ExportAllDeclaration: node => add(node, 'reexport'),
    ImportExpression: node => add(node, 'dynamic'),
    Identifier: node => {
      if (['window', 'document', 'globalThis'].includes(node.name)) {
        browserGlobals.push(`${node.name}:${node.loc.start.line}`);
      }
    },
  });
  return { imports, browserGlobals };
}

export function buildModuleGraph(sources) {
  const graph = new Map();
  for (const [filename, source] of sources) {
    const analysis = analyzeModule(source, filename);
    const dependencies = [];
    for (const edge of analysis.imports) {
      if (!edge.specifier.startsWith('.')) continue; // npm 包属于外部依赖
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), edge.specifier.split(/[?#]/)[0]));
      if (sources.has(target)) dependencies.push({ ...edge, target });
      else if (JS_FILE.test(target)) throw new Error(`${filename}:${edge.line}: 缺少源码模块 ${target}`);
    }
    graph.set(filename, { ...analysis, dependencies });
  }
  return graph;
}

export function assertAcyclic(graph) {
  const visited = new Set();
  const active = new Set();
  const visit = (name, trail) => {
    if (active.has(name)) throw new Error(`循环依赖：${[...trail, name].join(' -> ')}`);
    if (visited.has(name)) return;
    active.add(name);
    for (const { target } of graph.get(name).dependencies) visit(target, [...trail, name]);
    active.delete(name);
    visited.add(name);
  };
  for (const name of graph.keys()) visit(name, []);
  return visited.size;
}

export function architectureViolations(graph) {
  const violations = [];
  for (const [name, module] of graph) {
    for (const { target, line, kind } of module.dependencies) {
      const lazyEntry = LAZY_PAGE_ENTRIES.get(target);
      if (lazyEntry && (name !== lazyEntry || kind !== 'dynamic')) {
        violations.push(`${name}:${line}: ${target} 只能由 ${lazyEntry} 动态加载`);
      }
      if (target === SESSION_BROWSER && name !== 'game.boot.js') {
        violations.push(`${name}:${line}: 会话浏览器适配器只能由启动层装配`);
      }
      if (name === SESSION_KERNEL && (target.startsWith('ui/') || VIEW_MODULES.has(target))) {
        violations.push(`${name}:${line}: 会话内核不得依赖视图 ${target}`);
      }
      if (RUNTIME_SURFACE.has(target) && !RUNTIME_OWNERS.has(name) && !RUNTIME_SURFACE.has(name)) {
        violations.push(`${name}:${line}: 战斗运行时仅允许 battle.core 与已登记的状态属地、结算适配模块访问`);
      }
      if (VIEW_MODULES.has(name) && RUNTIME_INNER.has(target)) {
        violations.push(`${name}:${line}: 视图须通过 core 命令与快照访问战斗`);
      }
      // resolution 仅可调用两件 M 批命令适配器；其余纯模块仍禁止进入运行态，视图也禁止调用适配器。
      const effectCommand = name === 'battle/core/battle.resolution.js' && EXECUTION_ADAPTERS.has(target);
      if (PURE_MODULES.has(name) && !effectCommand && (RUNTIME_OWNERS.has(target) || RUNTIME_SURFACE.has(target) || VIEW_MODULES.has(target)
        || target === 'core/sdt-facade.js' || FLOW_PREFIXES.some(prefix => target.startsWith(prefix)))) {
        violations.push(`${name}:${line}: 独立规则/快照模块不能反向依赖 ${target}`);
      }
      if (BROWSER_ISOLATED_MODULES.has(name) && target === 'core/sdt-facade.js') {
        violations.push(`${name}:${line}: 显式端口模块不能依赖 SDT 浏览器门面`);
      }
      if (BROWSER_ISOLATION_FORBIDDEN_IMPORTS.get(name)?.has(target)) {
        violations.push(`${name}:${line}: 无浏览器选牌域不能依赖 ${target}`);
      }
    }
    if (PURE_MODULES.has(name) && module.browserGlobals.length) {
      violations.push(`${name}: 独立规则/快照模块不能读取全局浏览器对象 ${module.browserGlobals.join(', ')}`);
    }
    if (BROWSER_ISOLATED_MODULES.has(name) && module.browserGlobals.length) {
      violations.push(`${name}: 显式端口模块不能读取全局浏览器对象 ${module.browserGlobals.join(', ')}`);
    }
    if (name === SESSION_KERNEL && module.browserGlobals.length) {
      violations.push(`${name}: 会话内核必须通过注入端口访问浏览器 ${module.browserGlobals.join(', ')}`);
    }
  }
  return violations;
}
