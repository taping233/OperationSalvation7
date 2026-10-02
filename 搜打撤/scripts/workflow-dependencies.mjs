import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function importsIn(source) {
  const { parse } = require('acorn'), { simple } = require('acorn-walk');
  const imports = [];
  const add = node => {
    const value = typeof node.source.value === 'string' ? node.source.value
      : node.source.type === 'TemplateLiteral' && !node.source.expressions.length ? node.source.quasis[0].value.cooked : null;
    if (value == null) throw new Error('动态import目标无法确定');
    imports.push({ specifier: value });
  };
  simple(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), {
    ImportDeclaration: add, ImportExpression: add,
    ExportNamedDeclaration: node => { if (node.source) add(node); }, ExportAllDeclaration: add,
  });
  return imports;
}

// Static local imports and explicit file references are tracked. Opaque runtimes fall back wide.
export function dependencyScope(root, inputs) {
  const roots = [...new Set(inputs.map(file => file.replaceAll('\\', '/').replace(/^搜打撤\//, '')))];
  const files = new Set(), queue = [...roots];
  try {
    if (roots.some(file => /^tests\/workflow/.test(file))) {
      for (const name of readdirSync(path.join(root, 'scripts'))) {
        if (/^workflow.*\.mjs$/.test(name) || ['acceptance-gate.mjs', 'architecture-graph.mjs', 'index-validation.mjs'].includes(name)) queue.push('scripts/' + name);
      }
    }
    while (queue.length) {
      const file = path.relative(root, path.resolve(root, queue.shift())).replaceAll('\\', '/');
      if (file === '..' || file.startsWith('../') || path.isAbsolute(file)) throw new Error('依赖越出项目');
      if (files.has(file)) continue;
      const absolute = path.join(root, file);
      if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error('依赖文件不可达：' + file);
      files.add(file);
      if (!/\.(?:js|mjs|cjs)$/.test(file)) continue;
      const source = readFileSync(absolute, 'utf8');
      const imports = importsIn(source);
      const knownWorkflow = /^scripts\/(?:workflow.*|acceptance-gate|architecture-graph|index-validation)\.mjs$/.test(file) || /^tests\/workflow/.test(file);
      if (!knownWorkflow && (imports.some(item => /(?:^|:)child_process$/.test(item.specifier))
        || /\b(?:readFileSync|readFile|readdirSync|readdir)\s*\(/.test(source))) throw new Error('动态进程/文件输入需完整范围：' + file);
      for (const { specifier } of imports) {
        if (!specifier.startsWith('.')) continue;
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.split(/[?#]/)[0])));
      }
      // Explicit black-box inputs belong to tests; do not execute every command literal in a library.
      if (file.startsWith('tests/')) for (const match of source.matchAll(/["'`]((?:game|scripts|tests|docs)\/[^"'`\s$]+\.(?:js|mjs|json|css|html|md))["'`]/g)) {
        if (existsSync(path.join(root, match[1]))) queue.push(match[1]);
      }
    }
    return { mode: 'targeted', roots, files: [...files].sort(), reason: '静态依赖闭包；流程黑盒测试包含项目流程工具与显式输入' };
  } catch (error) {
    return { mode: 'project', roots, files: [], reason: '无法证明完整定向输入，保守扩大：' + error.message };
  }
}
