// One-time materialisation of the approved eighth-draft rose frame.
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';

const source = fs.readFileSync('game/src/rarity-design-lab.js', 'utf8');
const helpersStart = source.indexOf('function crest(');
const helpersEnd = source.indexOf('function jewel(');
const widthStart = source.indexOf('const frameWidths=');
const context = {};
vm.runInNewContext(source.slice(0, source.indexOf('const arts='))
  + '\n' + source.slice(widthStart, source.indexOf(';', widthStart) + 1)
  + '\nlet ornamentSerial=0;\n' + source.slice(helpersStart, helpersEnd)
  + '\nthis.render=wrappedFrame;this.tiers=tiers;this.widths=frameWidths;', context);

const paintRules = [];
postcss.parse(fs.readFileSync('game/css/rarity-design-lab.css', 'utf8')).walkRules(rule => {
  if (rule.selector.startsWith('.ornament-v7 ')) paintRules.push(rule.toString().replaceAll('.ornament-v7 ', ''));
  else if (rule.selector.startsWith('.wrap-')) paintRules.push(rule.toString());
});
const destination = 'game/css/card-frames/rose';
fs.mkdirSync(destination, { recursive: true });
const variants = [
  ['initial', 0, null], ['common', 0, null], ['rare', 1, null],
  ['epic', 2, null], ['legendary', 3, null], ['prism', 4, null],
  ['token', 0, { tone: '#6c9c9f', shine: '#b4dad5' }],
  ['class', 0, { tone: '#364451', shine: '#c4d0d9' }],
];
const baseTier = context.tiers[0];
for (const [name, index, palette] of variants) {
  context.tiers[0] = palette ? { ...baseTier, ...palette } : baseTier;
  const tier = context.tiers[index], w = context.widths[index];
  const markup = context.render('rose', index);
  let svg = markup.slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6);
  svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" ')
    .replace(`viewBox="${-w} ${-w} ${272+w*2} ${406+w*2}"`, `viewBox="${-w-2} ${-w-16} ${272+w*2+9} ${406+w*2+24}"`)
    .replace('style="', `style="--tone:${tier.tone};--shine:${tier.shine};`)
    .replace('<defs>', `<style>${paintRules.join('\n')}</style><defs>`);
  fs.writeFileSync(`${destination}/${name}.svg`, svg + '\n', { flag: 'wx' });
}
const scope = 'body:has(#viewport) :is(#viewport, #overlay, #cardZoom, #cardPreview, body) .hs-card';
const q = n => `${(n/272*100).toFixed(5)}cqw`;
const settings = (name, w) => `--rose-frame:url('./${name}.svg');--rose-top:${q(w+16)};--rose-right:${q(w+7)};--rose-bottom:${q(w+8)};--rose-left:${q(w+2)};`;
let css = '/* Approved rose enclosure. Exported from the eighth-draft design; static SVG, no renderer changes. */\n';
css += `${scope}{${settings('initial', 9)}}\n`;
for (const [className, name, w] of [['rv1','common',9],['rv2','rare',15],['rv3','epic',21],['rv4','legendary',27],['rv5','token',9],['rv6','class',9]]) {
  css += `${scope}.${className}{${settings(name,w)}}\n`;
}
css += `${scope}:is(.rv7,.rv-prism){${settings('prism',32)}}\n`;
css += `${scope}::before{content:''!important;display:block!important;position:absolute!important;inset:calc(-1 * var(--rose-top)) calc(-1 * var(--rose-right)) calc(-1 * var(--rose-bottom)) calc(-1 * var(--rose-left))!important;width:auto!important;height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:var(--rose-frame) center / 100% 100% no-repeat!important;box-shadow:none!important;clip-path:none!important;-webkit-mask:none!important;mask:none!important;animation:none!important;opacity:1!important;z-index:2!important;pointer-events:none!important;filter:drop-shadow(2px 5px 3px #0009);}\n`;
css += `${scope} .rv-beam{display:none!important;}\n`;
fs.writeFileSync(`${destination}/frames.css`, css, { flag: 'wx' });
console.log('已生成蔷薇包框：8张SVG与共用稀有度映射样式。');
