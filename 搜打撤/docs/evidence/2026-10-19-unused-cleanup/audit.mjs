import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { full } from 'acorn-walk';
import postcss from 'postcss';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const relative = p => path.relative(root, p).replaceAll('\\', '/');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => {
    const p = path.join(directory, e.name);
    return e.isDirectory() ? walk(p) : e.isSymbolicLink() ? [] : [p];
  });
}
const codeFiles = walk(path.join(root, 'game/src')).filter(p => /\.js$/.test(p));
const cssFiles = walk(path.join(root, 'game/css')).filter(p => /\.css$/.test(p));
const htmlFiles = walk(path.join(root, 'game')).filter(p => /\.html$/.test(p) && !/[/\\](?:assets|art-source)[/\\]/.test(p));
const graph = new Map(), uncertainImports = [], parseErrors = [], cssDuplicates = [];
const resolve = (from, specifier) => {
  const clean = specifier.split(/[?#]/)[0];
  if (!clean.startsWith('.') && !clean.startsWith('/')) return null;
  const p = clean.startsWith('/') ? path.join(root, 'game', clean) : path.resolve(path.dirname(from), clean);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
};
for (const file of codeFiles) {
  const links = [];
  try {
    full(parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' }), n => {
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(n.type) && n.source) {
        if (typeof n.source.value !== 'string') uncertainImports.push(relative(file));
        else { const next = resolve(file, n.source.value); if (next) links.push(next); }
      }
      if (n.type === 'NewExpression' && n.callee.name === 'URL' && typeof n.arguments[0]?.value === 'string') {
        const next = resolve(file, n.arguments[0].value); if (next) links.push(next);
      }
    });
  } catch (error) { parseErrors.push({ file: relative(file), error: error.message }); }
  graph.set(file, links);
}
for (const file of cssFiles) {
  const links = [];
  const ast = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
  ast.walkAtRules('import', n => {
    const match = n.params.match(/(?:url\(\s*)?["']([^"']+)["']/);
    if (match) { const next = resolve(file, match[1]); if (next) links.push(next); }
  });
  ast.walkRules(rule => {
    const seen = new Map();
    for (const n of rule.nodes || []) {
      if (n.type !== 'decl') continue;
      const key = [n.prop, n.value, Boolean(n.important)].join('\0');
      if (seen.has(key)) cssDuplicates.push({ file: relative(file), selector: rule.selector, line: seen.get(key).source.start.line, keptLine: n.source.start.line, property: n.prop, value: n.value, important: Boolean(n.important) });
      seen.set(key, n);
    }
  });
  graph.set(file, links);
}
const roots = [];
for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const match of source.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)) {
    const specifier = match[1].startsWith('.') || match[1].startsWith('/') ? match[1] : './' + match[1];
    const next = resolve(file, specifier); if (next) roots.push(next);
  }
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/json|importmap/i.test(match[1]) || !match[2].trim()) continue;
    try {
      full(parse(match[2], { sourceType: 'module', ecmaVersion: 'latest' }), n => {
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(n.type) && n.source) {
          if (typeof n.source.value !== 'string') uncertainImports.push(relative(file));
          else { const next = resolve(file, n.source.value); if (next) roots.push(next); }
        }
        if (n.type === 'NewExpression' && n.callee.name === 'URL' && typeof n.arguments[0]?.value === 'string') {
          const next = resolve(file, n.arguments[0].value); if (next) roots.push(next);
        }
      });
    } catch (error) { parseErrors.push({ file: relative(file), inlineScript: true, error: error.message }); }
  }
}
function reachable(roots) { const visited = new Set(); const visit = f => { if (visited.has(f)) return; visited.add(f); for (const next of graph.get(f) || []) visit(next); }; roots.forEach(visit); return visited; }
const reachableAllPages = reachable(roots);
const reachableMain = reachable([path.join(root, 'game/src/main.js'), ...[...graph.keys()].filter(f => f.endsWith('.css') && fs.readFileSync('game/index.html', 'utf8').includes(relative(f).replace('game/', '')))]);
const orphanCode = codeFiles.filter(f => !reachableAllPages.has(f) && !f.includes(path.sep + 'generated' + path.sep)).map(f => ({ file: relative(f), bytes: fs.statSync(f).size }));
const orphanCss = cssFiles.filter(f => !reachableAllPages.has(f)).map(f => ({ file: relative(f), bytes: fs.statSync(f).size }));
const assetFiles = walk(path.join(root, 'game/assets')).filter(p => /\.(?:webp|png|jpe?g|svg|ogg|wav|mp3)$/.test(p));
const bySize = new Map();
for (const file of assetFiles) { const size = fs.statSync(file).size; if (!bySize.has(size)) bySize.set(size, []); bySize.get(size).push(file); }
const duplicateAssets = [];
for (const files of bySize.values()) {
  if (files.length < 2) continue;
  const byHash = new Map();
  for (const file of files) { const sha = createHash('sha256').update(fs.readFileSync(file)).digest('hex'); if (!byHash.has(sha)) byHash.set(sha, []); byHash.get(sha).push(relative(file)); }
  for (const [sha256, paths] of byHash) if (paths.length > 1) duplicateAssets.push({ sha256, bytes: fs.statSync(path.join(root, paths[0])).size, paths });
}
const report = { sourceCount: codeFiles.length, cssCount: cssFiles.length, htmlCount: htmlFiles.length, parseErrors, uncertainImports: [...new Set(uncertainImports)], orphanCode, orphanCss, previewOnlyCode: codeFiles.filter(f => reachableAllPages.has(f) && !reachableMain.has(f)).map(relative), cssDuplicates, duplicateAssets };
fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sourceCount: report.sourceCount, cssCount: report.cssCount, parseErrors, uncertainImports: report.uncertainImports, orphanCode, orphanCss, cssDuplicates, duplicateAssetGroups: duplicateAssets.length, duplicateAssetMB: duplicateAssets.reduce((s,g) => s+g.bytes*(g.paths.length-1),0)/1048576 }, null, 2));
