import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
const out = path.resolve('docs/evidence/2026-09-30-full-repository-review');
const assigned = JSON.parse(fs.readFileSync(path.join(out, 'root/assigned.json'), 'utf8')).filter(row => row.owner === 'root' && row.category === 'review-target');
const reports = assigned.map(row => {
  const code = fs.readFileSync(path.join(out, 'snapshot', row.file), 'utf8');
  const report = { file: row.file, lines: row.lines, bytes: row.bytes, functions: [], riskAnchors: [] };
  if (row.file.endsWith('.json')) {
    const value = JSON.parse(code); report.json = { kind: Array.isArray(value) ? 'array' : typeof value, keys: Object.keys(value), items: Array.isArray(value) ? value.length : null };
  } else if (/\.(js|mjs|cjs)$/.test(row.file)) {
    const tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    simple(tree, { FunctionDeclaration(node) { report.functions.push({ name: node.id?.name, line: node.loc.start.line, async: node.async }); },
      CallExpression(node) { const name = code.slice(node.callee.start, node.callee.end); if (/(save|write|remove|mutate|commit|act$|then$|setTimeout|setInterval|innerHTML|spawn|exec|readFor|hydrate|append)/i.test(name)) report.riskAnchors.push({ name, line: node.loc.start.line }); } });
  } else report.typeDeclaration = true;
  return report;
});
fs.writeFileSync(path.join(out, 'root/static-survey.json'), JSON.stringify(reports, null, 2));
console.log(JSON.stringify({ files: reports.length, parsedJson: reports.filter(r => r.json).length, parsedScripts: reports.filter(r => r.functions.length || r.riskAnchors.length).length }));
