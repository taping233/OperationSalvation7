import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const assigned = JSON.parse(fs.readFileSync(path.join(here, 'assigned.json'), 'utf8'));
const summaries = [], details = [];
for (const entry of assigned.filter(x => x.owner === 'world_ui' && x.category === 'review-target' && x.file.endsWith('.css'))) {
  const source = fs.readFileSync(path.join(here, '..', 'snapshot', entry.file), 'utf8');
  const tree = postcss.parse(source, { from: entry.file });
  let rules = 0, imports = [], media = [], important = 0, riskRules = 0;
  tree.walkAtRules(a => { if (a.name === 'import') imports.push(a.params); if (a.name === 'media') media.push(a.params); });
  tree.walkRules(r => {
    rules++;
    const declarations = r.nodes.filter(n => n.type === 'decl');
    important += declarations.filter(d => d.important).length;
    const risk = declarations.filter(d => /^(?:pointer-events|overflow(?:-[xy])?|z-index|outline(?:-style|-width)?|display|visibility|position|height|min-height|max-height|min-width|width|max-width)$/.test(d.prop));
    if (risk.length) { riskRules++; details.push({ file: entry.file, line: r.source.start.line, selector: r.selector, context: r.parent.type === 'atrule' ? `${r.parent.name} ${r.parent.params}` : null, declarations: risk.map(d => `${d.prop}:${d.value}${d.important?' !important':''}`) }); }
  });
  summaries.push({ file: entry.file, rules, imports, media, important, riskRules, parse: 'ok' });
}
fs.writeFileSync(path.join(here, 'css-static-scan.json'), JSON.stringify({ summaries, details }, null, 2));
console.log(JSON.stringify(summaries, null, 2));
