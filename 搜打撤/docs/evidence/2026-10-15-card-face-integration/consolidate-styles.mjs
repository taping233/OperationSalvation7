import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const removed = [];
const faceProperties = /^(?:height|min-height|max-height|aspect-ratio|display|grid-template-.*|padding(?:-.*)?|border(?:-.*)?|background(?:-.*)?|box-shadow|overflow(?:-.*)?|container-type)$/;
for (const entry of fs.readdirSync('game/css', { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
  const file = path.join(entry.parentPath || entry.path, entry.name).replaceAll('\\', '/');
  if (file.endsWith('/card-layout-selected.css') || file.includes('/card-frames/')) continue;
  const original = fs.readFileSync(file, 'utf8');
  if (!/hs-card|hsc-/.test(original)) continue;
  const ast = postcss.parse(original, { from: file });
  let changed = false;
  ast.walkRules(rule => {
    if (!/hs-card|hsc-/.test(rule.selector)) return;
    const keep = [];
    const subjects = postcss.list.comma(rule.selector);
    for (const selector of subjects) {
      const imageCrop = /img\[/.test(selector) && /hsc-art/.test(selector);
      const negativeArt = /cz-neg/.test(selector);
      if (/hsc-/.test(selector) && !imageCrop && !negativeArt) {
        removed.push({ file, selector, reason: 'shared face owns card internals' }); changed = true;
      } else keep.push(selector);
    }
    if (!keep.length) { rule.remove(); return; }
    if (keep.length !== subjects.length) rule.selector = keep.join(',\n');
    const roots = keep.every(selector => !/:has\([^)]*\.hs-card/.test(selector) && /\.hs-card(?:\.[\w-]+|:[\w-]+(?:\([^)]*\))?)*\)*$/.test(selector));
    if (roots) rule.walkDecls(decl => {
      if (faceProperties.test(decl.prop)) {
        removed.push({ file, selector: rule.selector, declaration: decl.toString(), reason: 'shared card shape/material' });
        decl.remove(); changed = true;
      }
    });
    if (!rule.nodes.length) rule.remove();
  });
  if (changed) fs.writeFileSync(file, ast.toString());
}
fs.writeFileSync('docs/evidence/2026-10-15-card-face-integration/removed-style-rules.json', JSON.stringify(removed, null, 2));
console.log(JSON.stringify({ removed: removed.length, files: [...new Set(removed.map(row => row.file))] }, null, 1));
