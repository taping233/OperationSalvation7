import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Use Vite's declared parser dependency, including installs where it is nested.
const projectRequire = createRequire(import.meta.url);
const postcss = createRequire(projectRequire.resolve('vite'))('postcss');

// Read-only inventory. Review later values for browser support before deleting
// overwritten declarations. Conditional blocks and nested rules stay untouched.
export function auditCss(source, file = 'input.css', later = new Map()) {
  const root = postcss.parse(source, { from: file });
  const redundant = [];
  for (const rule of [...root.nodes].reverse()) {
    if (rule.type !== 'rule' || rule.nodes.some(node => !['decl', 'comment'].includes(node.type))) continue;
    for (const declaration of [...rule.nodes].reverse()) {
      if (declaration.type !== 'decl') continue;
      const signature = JSON.stringify([rule.selector, declaration.prop, !!declaration.important]);
      if (later.has(signature)) {
        redundant.push({ selector: rule.selector, property: declaration.prop, value: declaration.value,
          line: declaration.source.start.line, start: declaration.source.start.offset,
          end: declaration.source.end.offset, survivor: later.get(signature),
          bytes: Buffer.byteLength(declaration.toString()) });
      } else later.set(signature, { file, line: declaration.source.start.line, value: declaration.value });
    }
  }
  return redundant.reverse();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve('game');
  const sharedCascade = process.argv.includes('--entry');
  const names = sharedCascade
    ? [...readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1])
    : readdirSync(path.join(dir, 'css')).filter(file => file.endsWith('.css')).map(file => `css/${file}`);
  const later = new Map();
  const files = [...names].reverse().map(file => {
    const source = readFileSync(path.join(dir, file), 'utf8');
    const redundant = auditCss(source, file, sharedCascade ? later : new Map());
    return { file, bytes: Buffer.byteLength(source), saved: redundant.reduce((sum, r) => sum + r.bytes, 0), redundant };
  });
  console.log(JSON.stringify({ files: files.length, candidates: files.filter(f => f.saved) }, null, 2));
}
