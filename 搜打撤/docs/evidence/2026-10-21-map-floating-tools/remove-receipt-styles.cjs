// Remove only the deleted reward receipt's rules; leave reward layout and claim controls intact.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname,'../../..');
const file = path.join(root,'game/css/chest-reward-overview.css');
const css = postcss.parse(fs.readFileSync(file,'utf8'));
let removed = 0;
css.walkRules(rule => {
  if (rule.selector.includes('.cqo-receipt')) { rule.remove(); removed++; }
});
css.walkComments(comment => {
  if (/Current reward receipts|Persistent receipt uses settled/.test(comment.text)) comment.remove();
});
fs.writeFileSync(file,css.toString());
fs.writeFileSync(path.join(__dirname,'receipt-style-removal.json'),JSON.stringify({file:'game/css/chest-reward-overview.css',removedRules:removed},null,2));
console.log(`Removed ${removed} obsolete reward receipt rules.`);
