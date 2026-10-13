import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const postcss = require('postcss');
const target = path.resolve('game/css/base-camp-rework.css');
const prefix = '#overlay #hubMain.pg.hub.base-camp';
const existing = postcss.parse(fs.readFileSync(target, 'utf8'));
const updates = postcss.parse(fs.readFileSync(new URL(process.argv[2] || './style-iteration.css', import.meta.url), 'utf8'));
let replaced = 0, added = 0, removed = 0;
existing.walkRules(rule => {
  if (rule.selector.includes('.person-collection') || rule.selector.includes('.warehouse-item-art') || rule.selector.includes('[data-rarity=') || rule.selector.includes('.hub-tabs') || rule.selector.includes('.hub-tab') || rule.selector.includes('.camp-navigation-indicator') || rule.selector === `${prefix} .warehouse-search > span` || rule.selector === `${prefix} .warehouse-toolbar > .mini-btn`) { rule.remove(); removed++; }
});
updates.walkRules(rule => { rule.selectors = rule.selectors.map(selector => selector === '&' ? prefix : `${prefix} ${selector}`); });
for (const node of [...updates.nodes]) {
  if (node.type === 'rule') {
    const previous = existing.nodes.find(rule => rule.type === 'rule' && rule.selector === node.selector);
    if (previous) { previous.replaceWith(node); replaced++; }
    else { existing.append(node); added++; }
  } else existing.append(node);
}
const result = existing.toString();
postcss.parse(result);
fs.writeFileSync(target, result + '\n');
console.log(JSON.stringify({ replaced, added, removed, bytes:Buffer.byteLength(result) }));
