import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../../../..');
const game = path.join(root, '搜打撤/game');
const require = createRequire(path.join(root, '搜打撤/package.json'));
const acorn = require('acorn');
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const fingerprint = p => {
  const bytes = fs.readFileSync(p);
  return { path: rel(p), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, lines: bytes.toString('utf8').split(/\r?\n/).length };
};
const files = new Map(), edges = [], missing = [], errors = [], postorder = [];
function imports(text) {
  const result = [];
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) result.push({ specifier: node.source.value, kind: 'static', offset: node.start });
    if (node.type === 'ImportExpression' && node.source.type === 'Literal') result.push({ specifier: node.source.value, kind: 'dynamic', offset: node.start });
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return result.sort((a,b) => a.offset-b.offset);
}
function walk(p, parent, kind) {
  p = path.resolve(p);
  if (parent) edges.push({ from: rel(parent), to: rel(p), kind });
  if (files.has(p)) return;
  if (!fs.existsSync(p)) { missing.push(rel(p)); return; }
  files.set(p, fingerprint(p));
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  let deps = [];
  if (p.endsWith('.js')) {
    try { deps = imports(text); } catch (error) { errors.push({ path:rel(p), error:error.message }); }
  } else if (p.endsWith('.css')) {
    deps = [...text.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)].map(m => ({specifier:m[1],kind:'css-import'}));
  }
  for (const dependency of deps) {
    if (dependency.specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(p), dependency.specifier);
      if (['.js','.css','.json'].includes(path.extname(target))) walk(target,p,dependency.kind);
    }
  }
  postorder.push(rel(p));
}
const entry = path.join(game,'index.html');
const html = fs.readFileSync(entry,'utf8').replace(/<!--[\s\S]*?-->/g,'');
const htmlStyles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m=>path.join(game,m[1]));
for (const style of htmlStyles) walk(style,entry,'html-style');
walk(path.join(game,'src/main.js'),entry,'html-module');
files.set(entry,fingerprint(entry));
function walkDirectory(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkDirectory(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const unityUiFiles = walkDirectory(path.join(root,'SoudacheUnity/Assets/Scripts/Sdt.UI')).filter(p=>p.endsWith('.cs')).map(fingerprint);
const manifest = { capturedUtc: new Date().toISOString(), basis:'Current working-tree bytes. Acorn AST literal static/dynamic imports; CSS @import; HTML comment links excluded. Dynamic reachability is not page visitation. Dependency postorder is not browser computed cascade; specificity and page selector state still determine winning declarations.', entry:fingerprint(entry), htmlStylesheetOrder:htmlStyles.map(rel), reachableFiles:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)), edges, dependencyPostorder:postorder, cssFirstVisitDependencyPostorder:postorder.filter(p=>p.endsWith('.css')), missing:[...new Set(missing)], parseErrors:errors, unityUiFiles };
fs.writeFileSync(path.join(import.meta.dirname,'runtime-source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:files.size,css:manifest.cssFirstVisitDependencyPostorder.length,edges:edges.length,missing:manifest.missing,parseErrors:errors,unityUi:unityUiFiles.length}));
