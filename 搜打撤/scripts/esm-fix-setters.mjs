/* ============================================================
 * esm-fix-setters.mjs —— ESM 迁移补充：跨文件可变绑定
 *
 * 原「共享顶层作用域」允许 A 文件给 B 文件的顶层 let 赋值；ESM 导入
 * 绑定只读。本脚本对每个被跨文件赋值的名字：
 *   1. 在 owner 文件生成 `const _set_X = (v) => { X = v; };` 并导出
 *   2. 在赋值方把 `X = expr` 改写为 `_set_X(expr)`，并修正 import
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const DIR = path.resolve(import.meta.dirname, '..', 'prototypes', 'map-system', 'src');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'main.js');

const importsOf = new Map(); // file → Map(name → dep)
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const map = new Map();
  const re = /import\s*\{([^}]+)\}\s*from\s*'\.\/([\w.-]+\.js)'/g;
  let m;
  while ((m = re.exec(src))) for (const n of m[1].split(',').map(s => s.trim()).filter(Boolean)) map.set(n, m[2]);
  importsOf.set(f, map);
}

// name → [{file, ranges:[start,end], exprEnd, op}]
const mutations = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const im = importsOf.get(f);
  if (!im.size) continue;
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && im.has(n.left.name)) {
      if (n.operator !== '=') throw new Error(`${f}: 复合赋值 ${n.left.name} ${n.operator} 需人工处理`);
      const name = n.left.name;
      if (!mutations.has(name)) mutations.set(name, []);
      mutations.get(name).push({ file: f, start: n.start, end: n.end });
    }
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier' && im.has(n.argument.name))
      throw new Error(`${f}: 自增/自减导入绑定 ${n.argument.name}${n.operator} 需人工处理`);
    for (const k of Object.keys(n)) {
      if (['loc', 'range', 'start', 'end'].includes(k)) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v);
    }
  })(ast);
}

// owner 确认：该名字在 dep 中是顶层 let（必须可变）
function ownerDeclKind(dep, name) {
  const ast = parse(fs.readFileSync(path.join(DIR, dep), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  for (const st of ast.body) {
    if (st.type === 'VariableDeclaration')
      for (const d of st.declarations)
        if (d.id.type === 'Identifier' && d.id.name === name) return st.kind;
  }
  return null;
}

const setters = new Map(); // dep → Set(setterName)
const nameOf = new Map();  // file → [{name, start, end, dep, setter}]
for (const [name, ms] of mutations) {
  const deps = new Set(ms.map(x => importsOf.get(x.file).get(name)));
  if (deps.size !== 1) throw new Error(`名字 ${name} 有多个 owner: ${[...deps]}`);
  const dep = [...deps][0];
  const kind = ownerDeclKind(dep, name);
  if (kind !== 'let') throw new Error(`${dep} 中 ${name} 是 ${kind}，不是 let`);
  const setter = '_set_' + name;
  if (!setters.has(dep)) setters.set(dep, new Set());
  setters.get(dep).add(setter);
  for (const x of ms) {
    if (!nameOf.has(x.file)) nameOf.set(x.file, []);
    nameOf.get(x.file).push({ name, start: x.start, end: x.end, dep, setter });
  }
  console.log(`${name}: owner=${dep} setter=${setter} 赋值点=${ms.length}`);
}

// owner 注入 setter 定义 + 导出
for (const [dep, settersSet] of setters) {
  const p = path.join(DIR, dep);
  let src = fs.readFileSync(p, 'utf8');
  let inject = '';
  for (const setter of settersSet) {
    const varName = setter.slice(5);
    inject += `const ${setter} = (v) => { ${varName} = v; };\nexport { ${setter} };\n`;
  }
  src = src.replace(/\s*$/, '\n') + inject;
  fs.writeFileSync(p, src);
}

// 赋值方：按 start 倒序改写（避免偏移失效），再清理 import
for (const [f, list] of nameOf) {
  const p = path.join(DIR, f);
  let s = fs.readFileSync(p, 'utf8');
  list.sort((a, b) => b.start - a.start);
  for (const x of list) {
    s = s.slice(0, x.start) + `${x.setter}(` + s.slice(x.start, x.end).replace(/^[^=]*=/, '').trim() + ')' + s.slice(x.end);
  }
  for (const dep of new Set(list.map(x => x.dep))) {
    const names = new Set(list.filter(x => x.dep === dep).map(x => x.name));
    const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'\\.\\/${dep.replace('.', '\\.').replace('$', '\\$')}'`);
    const m = re.exec(s);
    if (!m) throw new Error(`${f}: 找不到 ${dep} 的 import`);
    const kept = m[1].split(',').map(t => t.trim()).filter(t => t && !names.has(t));
    const setterNames = [...setters.get(dep)].filter(st => list.some(x => x.dep === dep && x.setter === st));
    s = s.replace(re, `import { ${[...kept, ...setterNames].join(', ')} } from './${dep}'`);
  }
  fs.writeFileSync(p, s);
}
console.log('done');
