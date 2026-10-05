// Source-edit helper only; not a runtime test, lint or browser check.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const project = process.cwd();
const require = createRequire(path.join(project, 'package.json'));
const postcss = require('postcss');
const prefix = ':where(body[data-ui-cover-context="ordinary"])';
const files = ['cover-system.css', 'cover-details.css', 'cover-run.css', 'cover-battle-shell.css', 'cover-secondary.css'];
for (const file of files) {
  const target = path.join(project, 'game/css', file);
  const root = postcss.parse(readFileSync(target, 'utf8'), { from: target });
  root.walkRules(rule => {
    if (rule.selector === ':root') return;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
    }
    rule.selectors = rule.selectors.map(selector => {
      if (selector.startsWith(prefix)) return selector;
      if (/^body(?=[\s.:#\[]|$)/.test(selector)) return selector.replace(/^body/, prefix);
      return `${prefix} ${selector}`;
    });
  });
  writeFileSync(target, root.toString());
}
