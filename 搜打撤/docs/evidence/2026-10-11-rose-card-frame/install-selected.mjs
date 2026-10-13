// Install the approved enclosure and remove the superseded frame rules in place.
import fs from 'node:fs';
import postcss from 'postcss';

const file = 'game/css/card-layout-selected.css';
const root = postcss.parse(fs.readFileSync(file, 'utf8'));
const scope = 'body:has(#viewport) :is(#viewport, #overlay, #cardZoom, #cardPreview, body) .hs-card';
root.walkRules(rule => {
  const obsoleteFrame = rule.selector.includes('.rv-beam')
    || rule.selector.includes('.hs-card::before')
    || rule.selector.includes('.hs-card:is(.rv3, .rv4)::before')
    || rule.nodes.some(node => node.type === 'decl' && node.prop === '--card-ornament')
    || (rule.selector === `${scope} .hsc-art::after` && rule.nodes.some(node => node.prop === 'clip-path'));
  if (obsoleteFrame) { rule.remove(); return; }
  rule.walkDecls('--tier-rim', decl => decl.remove());
  if ([`${scope}.rv2`,`${scope}.rv3`,`${scope}.rv4`,`${scope}:is(.rv7, .rv-prism)`].includes(rule.selector)) {
    rule.walkDecls('box-shadow', decl => decl.remove());
  }
  if (rule.selector === scope) {
    const changed = { border: '0', background: '#263440', 'box-shadow': 'none', overflow: 'visible' };
    rule.walkDecls(decl => { if (changed[decl.prop]) { decl.value = changed[decl.prop]; decl.important = true; } });
    rule.append({ prop:'position', value:'relative', important:true }, { prop:'isolation', value:'isolate' });
  }
  if (rule.selector === `${scope} .hsc-cost`) {
    rule.walkDecls('background', decl => { decl.value = 'linear-gradient(135deg, #a3bec8 0 11%, #436373 12% 38%, #223e50 39% 79%, #122b3c 80%)'; });
  }
});
root.walkAtRules(at => {
  if (at.name === 'keyframes' && at.params === 'cardTierEdgeLight') at.remove();
  else if (at.nodes && !at.nodes.length) at.remove();
});
root.walkComments(comment => {
  if (comment.text.startsWith('Accepted ink ornaments:') || comment.text.startsWith('Let the decorative pseudo-element')) comment.remove();
});
root.first.text = '老板选定的第八稿蔷薇外扩包框；全幅卡面、悬停、放大与飞行克隆共用同一外观。';
root.prepend(postcss.atRule({ name:'import', params:"url('./card-frames/rose/frames.css')" }));
root.append(postcss.parse(`
/* Reserve exterior material in card hosts; the artwork and readable copy remain inside. */
body:has(#viewport) :is(#overlay, #cardZoom, #cardPreview) :is(.pk-card, .shop-slot, .stash-cell, .shelf-visual, .pocket-thumb, .cz-card):has(.hs-card) { overflow: visible !important; }
body:has(#viewport) #overlay :is(.pk-card, .shop-slot, .stash-cell):has(> .hs-card) { padding: 18% 15% 13% !important; }
body:has(#viewport) #overlay :is(.pk-card, .shop-slot, .stash-cell) > .hs-card { max-width: 100% !important; }
body:has(#viewport) #overlay .sts-hand .hs-card { margin-top: 1.7em; margin-bottom: .8em; }
body:has(#viewport) #cardZoom:not(.cz-photo) .cz-card { margin: 36px 42px; overflow: visible !important; }
body:has(#viewport) #cardPreview { overflow: visible !important; }
`));
fs.writeFileSync(file, root.toString());

const legacyFile = 'game/css/cards.css';
const legacy = postcss.parse(fs.readFileSync(legacyFile, 'utf8'));
legacy.walkRules(rule => {
  if (rule.selector.includes('.rv-beam') || rule.selector === '.hs-card.rv7 .hsc-gem, .hs-card.rv-prism .hsc-gem') rule.remove();
  else if (rule.selector === '.hs-card' || rule.selector === '.rv5') {
    rule.walkDecls(decl => { if (['border','background','box-shadow','border-radius'].includes(decl.prop)) decl.remove(); });
  }
});
legacy.walkAtRules(at => { if (at.name === 'keyframes' && ['heroPrism','heroGold'].includes(at.params)) at.remove(); });
legacy.walkComments(comment => {
  if (comment.text.startsWith('能力卡：渐变棱彩') || comment.text.startsWith('background-position 0%') || comment.text.startsWith('棱彩代表色 = 全息幻彩')) comment.remove();
  else if (comment.text.includes('卡面叠加 rv-prism 流转棱彩边框')) comment.text = comment.text.replace('卡面叠加 rv-prism 流转棱彩边框', '卡面外框由 card-layout-selected.css 维护');
  else if (comment.text.includes('石墨框、位图插画窗')) comment.text = '卡牌基础尺寸与内容结构；正式全幅外观由 card-layout-selected.css 维护。';
});
fs.writeFileSync(legacyFile, legacy.toString());

const cropFile = 'game/css/card-v3.css';
const crops = postcss.parse(fs.readFileSync(cropFile, 'utf8'));
crops.walkRules(rule => { if (rule.selector === '.hs-card .rv-beam') rule.remove(); });
fs.writeFileSync(cropFile, crops.toString());
console.log('已接入共用蔷薇包框并移除被替代的银墨饰纹及边框流光规则。');
