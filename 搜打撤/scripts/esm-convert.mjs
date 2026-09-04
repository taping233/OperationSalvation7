/* ============================================================
 * esm-convert.mjs —— 一次性迁移工具：全局 script → ES Module
 *
 * 用法：node scripts/esm-convert.mjs [--dry]
 *
 * 输入：prototypes/map-system/src/*.js（23 个全局脚本）
 * 输出：就地改写每个文件
 *   1. IIFE 解包：`(function (…) { … })();` → 顶层语句
 *   2. 依据 acorn 符号分析生成跨文件 `import { … } from './x.js'`
 *   3. 文件末尾追加 `export { … }`（被其他文件引用的顶层声明）
 *
 * 规则：
 *   - `window.SDT.*` 命名空间发布保持不动（运行时行为零变化）
 *   - 引用「尚未执行文件」的顶层取值会在分析报告中告警（TDZ 风险）
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { simple, base } from 'acorn-walk';

const SRC_DIR = path.resolve(import.meta.dirname, '..', 'prototypes', 'map-system', 'src');
const DRY = process.argv.includes('--dry');
// 与原 index.html 一致的加载顺序（shared.js 原本排第 13，其垫片只服务其后的文件）
const ORDER = ['mapData','art','icons-bitmap','sound','camera','notes','cards','combat','base','meta','renderer','ui','shared','battle.core','battle.view','chests','game.core','game.run','game.hub','game.bag','game.notes','game.cardslib','game.boot'];

const files = ORDER.map(n => `${n}.js`);
for (const f of files) if (!fs.existsSync(path.join(SRC_DIR, f))) { console.error(`缺文件: ${f}`); process.exit(1); }

// ---------- 1. IIFE 解包 ----------
function unwrapIIFE(src) {
  let ast;
  try { ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); }
  catch (e) { throw new Error(`parse 失败: ${e.message}`); }
  if (ast.body.length !== 1) return src;
  const only = ast.body[0];
  if (only.type !== 'ExpressionStatement') return src;
  let expr = only.expression;
  // (function(){...})() 或 (function(){...}).call(this) / .apply
  if (expr.type === 'UnaryExpression' && expr.operator === '!') expr = expr.argument;
  let fn = null;
  if (expr.type === 'CallExpression') {
    const c = expr.callee;
    if (c.type === 'FunctionExpression') fn = c;
    else if (c.type === 'MemberExpression' && c.object.type === 'FunctionExpression' &&
             ['call','apply'].includes(c.property.name)) fn = c.object;
  }
  if (!fn || fn.body.body.length === 0) return src;
  const inner = src.slice(fn.body.start + 1, fn.body.end - 1);
  // 校验解包后的代码可独立解析
  parse(inner, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true });
  return inner.replace(/^\n+/, '').replace(/\n[ \t]*$/, '\n');
}

// ---------- 2. 符号分析 ----------
function patternNames(id, out) {
  if (id.type === 'Identifier') out.push(id.name);
  else if (id.type === 'ObjectPattern')
    for (const p of id.properties) patternNames(p.type === 'RestElement' ? p.argument : p.value, out);
  else if (id.type === 'ArrayPattern')
    for (const el of id.elements) if (el) patternNames(el.type === 'RestElement' ? el.argument : el, out);
  else if (id.type === 'AssignmentPattern') patternNames(id.left, out);
  else if (id.type === 'RestElement') patternNames(id.argument, out);
}

function topLevelDecls(src) {
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const names = [];
  for (const st of ast.body) {
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') names.push(st.id.name);
    else if (st.type === 'VariableDeclaration')
      for (const d of st.declarations) patternNames(d.id, names);
  }
  return names;
}

// 作用域感知的引用分析：只有沿作用域链都解析不到的标识符才是「跨文件引用」，
// 函数参数 / 局部 const/let/var / 函数名 / catch 参数等同名绑定不算。
function referencedNames(src) {
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const free = new Set();
  const BUILTIN = new Set(['arguments', 'this', 'undefined']);

  function declare(node, scope) {
    if (!node) return;
    if (node.type === 'Identifier') scope.add(node.name);
    else if (node.type === 'ObjectPattern')
      for (const p of node.properties) declare(p.type === 'RestElement' ? p.argument : p.value, scope);
    else if (node.type === 'ArrayPattern')
      for (const el of node.elements) if (el) declare(el.type === 'RestElement' ? el.argument : el, scope);
    else if (node.type === 'AssignmentPattern') declare(node.left, scope);
    else if (node.type === 'RestElement') declare(node.argument, scope);
  }
  function resolve(name, scopes) {
    if (BUILTIN.has(name)) return true;
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return true;
    return false;
  }

  function visit(node, scopes) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier':
        if (!resolve(node.name, scopes)) free.add(node.name);
        return;
      case 'Program':
      case 'BlockStatement': {
        const s = new Set();
        scopes.push(s);
        for (const st of node.body) visit(st, scopes);
        scopes.pop();
        return;
      }
      case 'VariableDeclaration': {
        for (const d of node.declarations) {
          declare(d.id, scopes[scopes.length - 1]);
          if (d.init) visit(d.init, scopes);
        }
        return;
      }
      case 'FunctionDeclaration': {
        if (node.id) scopes[scopes.length - 1].add(node.id.name); // 函数名在外层作用域
        const s = new Set();
        for (const p of node.params) declare(p, s);
        scopes.push(s);
        visit(node.body, scopes);
        scopes.pop();
        return;
      }
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const s = new Set();
        if (node.id) s.add(node.id.name);
        for (const p of node.params) declare(p, s);
        scopes.push(s);
        visit(node.body, scopes);
        scopes.pop();
        return;
      }
      case 'ClassDeclaration': {
        if (node.id) scopes[scopes.length - 1].add(node.id.name);
        if (node.superClass) visit(node.superClass, scopes);
        for (const el of node.body.body) visit(el, scopes);
        return;
      }
      case 'ClassExpression': {
        const s = new Set();
        if (node.id) s.add(node.id.name);
        scopes.push(s);
        if (node.superClass) visit(node.superClass, scopes);
        for (const el of node.body.body) visit(el, scopes);
        scopes.pop();
        return;
      }
      case 'CatchClause': {
        const s = new Set();
        if (node.param) declare(node.param, s);
        scopes.push(s);
        visit(node.body, scopes);
        scopes.pop();
        return;
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const s = new Set();
        scopes.push(s);
        for (const key of ['init', 'left', 'test', 'update', 'right', 'body'])
          if (node[key]) visit(node[key], scopes);
        scopes.pop();
        return;
      }
      case 'SwitchStatement': {
        visit(node.discriminant, scopes);
        const s = new Set();
        scopes.push(s);
        for (const c of node.cases) {
          if (c.test) visit(c.test, scopes);
          for (const st of c.consequent) visit(st, scopes);
        }
        scopes.pop();
        return;
      }
      case 'MemberExpression': {
        visit(node.object, scopes);
        if (node.computed) visit(node.property, scopes);
        return;
      }
      case 'Property':
      case 'PropertyDefinition': {
        if (node.computed) visit(node.key, scopes);
        // 简写 `{game}` 的 value 与 key 是同一节点，visit(value) 即为引用
        if (node.value) visit(node.value, scopes);
        return;
      }
      case 'MethodDefinition': {
        if (node.computed) visit(node.key, scopes);
        visit(node.value, scopes);
        return;
      }
      case 'LabeledStatement': { visit(node.body, scopes); return; }
      case 'BreakStatement':
      case 'ContinueStatement': return;
      default: {
        for (const key of Object.keys(node)) {
          if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
          const v = node[key];
          if (Array.isArray(v)) for (const c of v) visit(c, scopes);
          else if (v && typeof v === 'object' && typeof v.type === 'string') visit(v, scopes);
        }
      }
    }
  }

  visit(ast, [new Set()]);
  return free;
}

// ---------- 主流程 ----------
const unwrapped = {};   // file → 解包后源码
const decls = {};       // file → Set(顶层声明)
const refs = {};        // file → Set(引用的标识符)
const owner = {};       // name → [files]

for (const f of files) {
  const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const src = unwrapIIFE(raw);
  const changed = src !== raw;
  unwrapped[f] = src;
  decls[f] = new Set(topLevelDecls(src));
  refs[f] = referencedNames(src);
  for (const n of decls[f]) (owner[n] ??= []).push(f);
  console.log(`${f}: 解包=${changed ? '是' : '否'} 顶层声明=${decls[f].size}`);
}

// 声明冲突检查（同名顶层声明出现在多个文件 → 原本就是非法/隐式依赖）
const conflicts = Object.entries(owner).filter(([, fs]) => fs.length > 1);
if (conflicts.length) console.log('\n⚠ 同名顶层声明:', conflicts.map(([n, fs]) => `${n}@${fs.join(',')}`).join('  '));

// ---------- 3. 生成 import / export ----------
const report = [];
for (const f of files) {
  const importsByDep = new Map(); // depFile → Set(name)
  for (const n of refs[f]) {
    if (decls[f].has(n)) continue; // 本文件自己声明了，绝不导入（避免重名冲突）
    const os = (owner[n] ?? []).filter(x => x !== f);
    if (os.length === 1) {
      const dep = os[0];
      if (!importsByDep.has(dep)) importsByDep.set(dep, new Set());
      importsByDep.get(dep).add(n);
    }
  }
  const exports = [...decls[f]].filter(n => (owner[n] ?? []).some(x => x !== f));
  if (!importsByDep.size && !exports.length) continue;

  let src = unwrapped[f];
  const lines = [];
  const importBlock = [...importsByDep.entries()]
    .sort((a, b) => ORDER.indexOf(a[0].replace('.js','')) - ORDER.indexOf(b[0].replace('.js','')))
    .map(([dep, names]) => {
      const sorted = [...names].sort();
      // TDZ 风险告警：依赖文件在原顺序中位于本文件之后，且引用发生在顶层求值期
      const depName = dep.replace('.js', '');
      if (ORDER.indexOf(depName) > ORDER.indexOf(f.replace('.js', '')))
        report.push(`${f} 从后置文件 ${dep} 导入 ${sorted.join(',')}（注意初始化顺序）`);
      return `import { ${sorted.join(', ')} } from './${dep}';`;
    });
  for (const l of importBlock) lines.push(l);
  if (lines.length) lines.push('');
  src = lines.join('\n') + src;
  if (exports.length) src = src.replace(/\s*$/, '\n') + `\nexport { ${exports.sort().join(', ')} };\n`;
  unwrapped[f] = src;
}

for (const r of [...new Set(report)]) console.log('⚠ ' + r);
if (DRY) { console.log('\n[dry] 未写入'); process.exit(0); }
for (const f of files) fs.writeFileSync(path.join(SRC_DIR, f), unwrapped[f]);
console.log('\n✔ 已写入', files.length, '个文件');
