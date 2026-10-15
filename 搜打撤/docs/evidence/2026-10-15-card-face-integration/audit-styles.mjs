import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
const directory = 'game/css';
const list = [];
for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
  const file = path.join(entry.parentPath || entry.path, entry.name).replaceAll('\\', '/');
  const css = fs.readFileSync(file, 'utf8');
  if (!/hs-card|hsc-/.test(css)) continue;
  postcss.parse(css, { from: file }).walkRules(rule => {
    if (!/hs-card|hsc-/.test(rule.selector)) return;
    list.push({ file, line: rule.source.start.line, selector: rule.selector, declarations: rule.nodes.filter(n => n.type === 'decl').map(n => `${n.prop}:${n.value}${n.important ? '!important' : ''}`) });
  });
}
fs.writeFileSync('docs/evidence/2026-10-15-card-face-integration/style-audit.json', JSON.stringify(list, null, 2));
for (const row of list.filter(row => /hsc-/.test(row.selector) && !row.file.includes('card-layout-selected') && !row.file.endsWith('/cards.css'))) console.log(`${row.file}:${row.line} ${row.selector} { ${row.declarations.join(';')} }`);
