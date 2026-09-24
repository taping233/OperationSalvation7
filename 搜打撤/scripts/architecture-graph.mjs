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
  'battle/battle.runtime.js',
  'battle/battle.runtime.session.js', 'battle/battle.runtime.piles.js',
  'battle/battle.runtime.interaction.js', 'battle/battle.runtime.effects.js',
  'battle/battle.runtime.presentation.js',
]);
const RUNTIME_INNER = new Set([
  'battle/battle.engine.js', 'battle/battle.enemy-phase.js', 'battle/battle.selection-flow.js',
  'battle/battle.equipment.js', 'battle/battle.bag.js', 'battle/battle.lifecycle.js',
]);
const RUNTIME_OWNERS = new Set(['battle/battle.core.js', ...RUNTIME_INNER]);
const PURE_MODULES = new Set([
  'battle/battle.card-cost.js', 'battle/battle.intent.js', 'battle/battle.resolution.js',
  'battle/battle.snapshot.js', 'cards/cards.catalog.js',
]);
const VIEW_MODULES = new Set([
  'battle/battle.view.js', 'battle/battle.overlays.js', 'battle/battle.layers.js',
  'battle/battle.vfx.js', 'battle/battle.anim.js', 'battle/battle.aim.js',
  'battle/battle.hover.js', 'battle/battle.frames.js', 'battle/battle.piles.view.js',
]);
// 流程域（基地/局外 + 局内流程）——纯规则/快照模块不得反向依赖。
const FLOW_PREFIXES = ['hub/', 'run/'];
// 规则里作为“依赖目标”写死的路径，同样纳入防失效自检。
const PROTECTED_TARGETS = new Set([...RUNTIME_SURFACE, 'core/sdt-facade.js']);

// 防再发自检：返回在真实源码树中零命中的判据键；非空即守卫腐化，守卫测试必须红。
export function deadGuardKeys(sources) {
  const dead = [];
  for (const key of [...RUNTIME_OWNERS, ...PURE_MODULES, ...VIEW_MODULES, ...PROTECTED_TARGETS]) {
    if (!sources.has(key)) dead.push(key);
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
    for (const { target, line } of module.dependencies) {
      if (RUNTIME_SURFACE.has(target) && !RUNTIME_OWNERS.has(name) && !RUNTIME_SURFACE.has(name)) {
        violations.push(`${name}:${line}: 战斗运行时仅允许 battle.core 与状态属地模块（engine/enemy-phase/selection-flow/equipment/bag/lifecycle）访问`);
      }
      if (VIEW_MODULES.has(name) && RUNTIME_INNER.has(target)) {
        violations.push(`${name}:${line}: 视图须通过 core 命令与快照访问战斗`);
      }
      if (PURE_MODULES.has(name) && (RUNTIME_OWNERS.has(target) || RUNTIME_SURFACE.has(target) || VIEW_MODULES.has(target)
        || target === 'core/sdt-facade.js' || FLOW_PREFIXES.some(prefix => target.startsWith(prefix)))) {
        violations.push(`${name}:${line}: 独立规则/快照模块不能反向依赖 ${target}`);
      }
    }
    if (PURE_MODULES.has(name) && module.browserGlobals.length) {
      violations.push(`${name}: 独立规则/快照模块不能读取全局浏览器对象 ${module.browserGlobals.join(', ')}`);
    }
  }
  return violations;
}
