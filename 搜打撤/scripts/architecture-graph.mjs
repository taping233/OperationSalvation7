import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

const JS_FILE = /\.(?:js|mjs)$/;
const RUNTIME_OWNERS = new Set(['battle.core.js', 'battle.engine.js', 'battle.enemy-phase.js']);
const PURE_MODULES = new Set([
  'battle.card-cost.js', 'battle.intent.js', 'battle.resolution.js',
  'battle.snapshot.js', 'cards.catalog.js',
]);
const VIEW_MODULES = /^battle\.(?:view|overlays|layers|vfx|anim|aim|hover|frames|piles\.view)\.js$/;

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
      if (target === 'battle.runtime.js' && !RUNTIME_OWNERS.has(name)) {
        violations.push(`${name}:${line}: 战斗运行时仅允许 core/engine/enemy-phase 访问`);
      }
      if (VIEW_MODULES.test(name) && ['battle.engine.js', 'battle.enemy-phase.js'].includes(target)) {
        violations.push(`${name}:${line}: 视图须通过 core 命令与快照访问战斗`);
      }
      if (PURE_MODULES.has(name) && (/^battle\.(?:runtime|engine|core|enemy-phase)\.js$/.test(target) || VIEW_MODULES.test(target)
        || target === 'sdt-facade.js' || target.startsWith('game.'))) {
        violations.push(`${name}:${line}: 独立规则/快照模块不能反向依赖 ${target}`);
      }
    }
    if (PURE_MODULES.has(name) && module.browserGlobals.length) {
      violations.push(`${name}: 独立规则/快照模块不能读取全局浏览器对象 ${module.browserGlobals.join(', ')}`);
    }
  }
  return violations;
}
