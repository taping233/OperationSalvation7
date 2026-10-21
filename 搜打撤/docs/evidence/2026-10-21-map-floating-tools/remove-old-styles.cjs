// Scoped migration: remove the superseded map tool-strip cascade, retaining other HUD rules.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname,'../../..');
const receipts = [];
for (const file of ['game/css/page-expedition-hud.css','game/css/feedback-1018.css']) {
  const target = path.join(root,file), ast = postcss.parse(fs.readFileSync(target,'utf8'));
  let removed = 0;
  ast.walkRules(rule => {
    const selector = rule.selector.trim();
    const oldSidebar = file.endsWith('page-expedition-hud.css') &&
      (selector === '#sidebar' || selector === '#sidebar::before' ||
        selector.startsWith('body') && selector.endsWith(' #sidebar') && !selector.includes(','));
    if (selector.includes('.expedition-toolbar') || selector.includes('.expedition-nav-summary') || oldSidebar) {
      rule.remove(); removed++;
    }
  });
  if (file.endsWith('page-expedition-hud.css')) {
    const first = ast.first;
    if (first?.type === 'comment') first.text = '远征HUD：保留资源、生命与节点详情；地图悬浮工具由 map-floating-tools.css 单独维护。';
    ast.walkComments(comment => {
      if (/W1a|连续行动台|底部薄工具带|Map replica/.test(comment.text)) comment.remove();
    });
    ast.walkDecls('top',decl => {
      if (decl.value === 'calc(152px - (var(--game-layout-height,1080px) - 112px))')
        decl.value = 'calc(152px - (var(--game-layout-height,1080px) - 122px))';
    });
  }
  if (!removed) throw new Error(`No old tool rules found in ${file}; stop instead of rewriting.`);
  fs.writeFileSync(target,ast.toString());
  receipts.push({file,removedRules:removed});
}
fs.writeFileSync(path.join(__dirname,'style-migration.json'),JSON.stringify(receipts,null,2));
console.log(JSON.stringify(receipts));
