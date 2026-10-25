import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

const root = process.cwd();
const output = path.join(root, 'docs/evidence/2026-10-23-backend-audit/phase5/storage');
const src = path.join(root, 'game/src');
const unix = value => value.split(path.sep).join('/');
const relative = value => unix(path.relative(root, value));
function filesOf(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesOf(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);
}
const files = filesOf(src);
const modules = new Map();
const parseErrors = [];
const dynamicImports = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let tree;
  try { tree = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (error) { parseErrors.push({ file: relative(file), message: error.message }); continue; }
  const dependencies = [], exports = [], functions = [];
  const dependency = value => {
    if (typeof value === 'string' && value.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), value.split('?')[0]);
      if (resolved.endsWith('.js')) dependencies.push(resolved);
    }
  };
  walk.simple(tree, {
    ImportDeclaration(node) { dependency(node.source.value); },
    ExportNamedDeclaration(node) {
      if (node.source) dependency(node.source.value);
      if (node.declaration?.id?.name) exports.push(node.declaration.id.name);
      for (const declarator of node.declaration?.declarations || []) if (declarator.id.name) exports.push(declarator.id.name);
      for (const item of node.specifiers || []) exports.push(item.exported.name);
    },
    ExportAllDeclaration(node) { dependency(node.source.value); },
    ImportExpression(node) {
      if (node.source.type === 'Literal') dependency(node.source.value);
      else dynamicImports.push({ file: relative(file), line: node.loc.start.line, expression: text.slice(node.start, node.end) });
    },
    FunctionDeclaration(node) {
      functions.push({ name: node.id?.name, line: node.loc.start.line, lines: node.loc.end.line - node.loc.start.line + 1 });
    },
  });
  modules.set(file, { dependencies: [...new Set(dependencies)], exports, functions, text });
}
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of modules.get(file)?.dependencies || []) visit(dependency);
}
visit(path.join(src, 'main.js'));
const inventory = [...modules].filter(([file]) => /^game\/src\/(hub|core)\//.test(relative(file))).map(([file, data]) => ({
  file: relative(file), lines: data.text.split('\n').length - (data.text.endsWith('\n') ? 1 : 0),
  bytes: Buffer.byteLength(data.text), sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  reachableFromMain: reachable.has(file),
  parents: [...modules].filter(([, value]) => value.dependencies.includes(file)).map(([parent]) => relative(parent)),
  imports: data.dependencies.map(relative), exports: data.exports,
  presentationSignals: [...new Set(data.text.match(/\b(?:document|HTMLElement|HTMLCanvasElement|requestAnimationFrame|innerHTML|querySelector|canvas|CanvasRenderingContext2D)\b/g) || [])],
  largeFunctions: data.functions.filter(fn => fn.lines >= 60),
})).sort((a, b) => b.lines - a.lines);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'module-inventory.json'), JSON.stringify({ root: 'game/src/main.js', totalParsed: modules.size, parseErrors, dynamicImports, inventory }, null, 2) + '\n');
console.log(JSON.stringify({ totalParsed: modules.size, parseErrors, dynamicImports,
  unreachable: inventory.filter(item => !item.reachableFromMain).map(({ file, lines, parents, presentationSignals }) => ({ file, lines, parents, presentationSignals })),
  largest: inventory.slice(0, 28).map(({ file, lines, reachableFromMain, parents, presentationSignals, largeFunctions }) => ({ file, lines, reachableFromMain, parents, presentationSignals, largeFunctions })),
}, null, 2));
