import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

// Static source DOM only. No external resources, application scripts, browser,
// layout, canvas or color-contrast evaluation are executed by this audit.
const rules = ['button-name', 'link-name', 'image-alt', 'label', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-role', 'document-title', 'html-has-lang'];
async function audit(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(axe.source);
  const result = await dom.window.axe.run(dom.window.document, { runOnly: { type: 'rule', values: rules } });
  dom.window.close();
  return result;
}
const control = await audit('<!doctype html><html lang="zh"><head><title>检测能力对照</title></head><body><button></button></body></html>');
if (!control.violations.some(item => item.id === 'button-name')) throw new Error('axe failed to detect an unnamed button in the control');
const result = await audit(fs.readFileSync('game/index.html', 'utf8'));
const report = {
  scope: 'Static game/index.html in JSDOM; no application execution, layout, canvas, color contrast or real-page acceptance',
  version: axe.version,
  rules,
  detectorControl: 'unnamed button detected',
  violations: result.violations.map(({ id, impact, description, helpUrl, nodes }) => ({ id, impact, description, helpUrl, nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })) })),
  incomplete: result.incomplete.map(({ id, helpUrl, nodes }) => ({ id, helpUrl, count: nodes.length, nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })) })),
  passes: result.passes.map(({ id }) => id),
};
const output = 'node_modules/.cache/quality-tools/axe-dom.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, violationRules: report.violations.length, violationNodes: report.violations.reduce((n, v) => n + v.nodes.length, 0), incomplete: report.incomplete, scope: report.scope }, null, 2));
process.exitCode = report.violations.length ? 1 : 0;
