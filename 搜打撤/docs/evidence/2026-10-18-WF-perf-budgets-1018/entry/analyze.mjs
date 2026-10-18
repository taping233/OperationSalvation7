import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'acorn';
import { transform } from 'esbuild';

const workspace = process.cwd();
const project = path.join(workspace, '.tmp/page-perf-1018/exe-build/project');
const dist = path.join(project, 'desktop-app/game');
const evidence = path.join(workspace, 'docs/evidence/2026-10-18-WF-perf-budgets-1018/entry');
const read = file => readFileSync(file, 'utf8');
const bytes = value => ({ raw: Buffer.byteLength(value), gzip: gzipSync(value).length });
const builtHTML = read(path.join(dist, 'index.html'));
const scripts = [...builtHTML.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match => match[1]);
const preloads = [...builtHTML.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["'][^>]*>/g)].map(match => match[1]);
const initial = [...new Set([...scripts, ...preloads])].map(file => ({ file, ...bytes(read(path.join(dist, file))) }));
const chunks = readdirSync(path.join(dist, 'assets/js')).filter(file => file.endsWith('.js')).map(file => ({ file, ...bytes(read(path.join(dist, 'assets/js', file))) })).sort((a,b) => b.gzip - a.gzip);
const html = read(path.join(project, 'game/index.html'));
const roots = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(match => path.normalize(path.join(project, 'game', match[1])));
const graph = new Map();
function resolveModule(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const absolute = path.normalize(path.resolve(path.dirname(from), specifier.split('?')[0]));
  if (!/\.(js|json)$/.test(absolute) || !existsSync(absolute)) return null;
  return absolute;
}
function visit(file) {
  if (graph.has(file)) return;
  const source = read(file), node = { file, static: [], dynamic: [], bare: [], source };
  graph.set(file, node);
  if (file.endsWith('.json')) return;
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const statement of ast.body) if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(statement.type) && statement.source) {
    const target = resolveModule(file, statement.source.value);
    if (target) { node.static.push(target); visit(target); }
    else if (!statement.source.value.startsWith('.')) node.bare.push(statement.source.value);
  }
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'ImportExpression' && value.source.type === 'Literal') node.dynamic.push(value.source.value);
    for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child);
  }
  walk(ast);
}
roots.forEach(visit);
await Promise.all([...graph.values()].map(async node => {
  node.minified = node.file.endsWith('.json') ? JSON.stringify(JSON.parse(node.source)) : (await transform(node.source, { loader: 'js', minify: true, format: 'esm', target: 'esnext' })).code;
  node.weight = bytes(node.minified);
}));
const relative = file => path.relative(project, file).replaceAll('\\','/');
function closure(cut = new Set()) {
  const seen = new Set(), order = [];
  function walk(file) { if (cut.has(file) || seen.has(file)) return; seen.add(file); graph.get(file)?.static.forEach(walk); order.push(file); }
  roots.forEach(walk); return { seen, order };
}
const baseline = closure();
const catalog = file => /\/game\/src\/(?:cards\/cards\.(?:data|catalog|consts)|core\/data-loader)\.js$/.test(file.replaceAll('\\','/'));
const inEntry = file => !catalog(file);
const stream = list => list.filter(inEntry).map(file => graph.get(file).minified).join('\n');
const estimateBase = bytes(stream(baseline.order));
const actualEntry = initial.find(file => scripts.includes(file.file)).gzip;
const candidates = ['run/game.nest.js','hub/game.bag.js','hub/game.notes.js','run/chests.js','core/renderer.js','core/camera.js','ui/term-tips.js','ui/character-idle.js','hub/base.js','hub/meta.js','audio/sound.js','core/art.js','core/icons-bitmap.js','battle/core/combat.js','cards/cards.js','game.boot.js'];
const rows = candidates.map(candidate => {
  const file = path.join(project, 'game/src', candidate), retained = closure(new Set([file]));
  const removed = baseline.order.filter(file => !retained.seen.has(file));
  const sourceDelta = estimateBase.gzip - bytes(stream(retained.order)).gzip;
  return { file: `game/src/${candidate}`, exclusiveModules: removed.length, sourceCompressedDelta: sourceDelta,
    normalizedEntryEstimate: Math.round(sourceDelta * actualEntry / estimateBase.gzip),
    incoming: [...graph.values()].filter(node => node.static.includes(file)).map(node => relative(node.file)),
    exclusive: removed.map(file => ({ file: relative(file), ...graph.get(file).weight })).sort((a,b) => b.gzip-a.gzip),
  };
}).sort((a,b) => b.normalizedEntryEstimate-a.normalizedEntryEstimate);
const top = [...graph.values()].filter(node => node.file.endsWith('.js')).map(node => ({ file: relative(node.file), ...node.weight, dynamic: node.dynamic, bare: node.bare })).sort((a,b)=>b.gzip-a.gzip);
const report = { project, initial, initialGzip: initial.reduce((sum,row)=>sum+row.gzip,0), chunks, roots:roots.map(relative), staticModuleCount:graph.size,
  sourceStream: estimateBase, actualEntryGzip:actualEntry, estimateBoundary:'Per-module esbuild transform only; no Rollup/build. Source-stream compression deltas are prioritisation estimates, not delivered chunk measurements. Existing catalog manual chunk excluded; bare dependency library bytes are separate actual chunks.', candidates:rows, topModules:top,
  edges:[...graph.values()].map(node=>({file:relative(node.file),static:node.static.map(relative),dynamic:node.dynamic,bare:node.bare})),
};
mkdirSync(evidence,{recursive:true}); writeFileSync(path.join(evidence,'analysis.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({initial,initialGzip:report.initialGzip,staticModuleCount:graph.size,sourceStream:estimateBase,candidates:rows.map(({file,exclusiveModules,sourceCompressedDelta,normalizedEntryEstimate,incoming})=>({file,exclusiveModules,sourceCompressedDelta,normalizedEntryEstimate,incoming})),topModules:top.slice(0,24)},null,2));
