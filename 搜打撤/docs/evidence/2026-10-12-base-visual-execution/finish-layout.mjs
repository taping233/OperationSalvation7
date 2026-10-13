import fs from 'node:fs';
import postcss from 'postcss';
function write(name, update) {
  const path = `game/css/${name}.css`, ast = postcss.parse(fs.readFileSync(path, 'utf8'));
  const set = (suffix, values) => {
    let count = 0;
    ast.walkRules(rule => {
      if (!rule.selector.endsWith(suffix)) return;
      count++;
      for (const [prop,value] of Object.entries(values)) {
        const d = rule.nodes.find(node => node.type === 'decl' && node.prop === prop);
        if (d) d.value = value; else rule.append({prop,value});
      }
    });
    if (!count) throw new Error(`Missing rule: ${suffix}`);
  };
  const add = (selector, values) => {
    const rule = postcss.rule({ selector });
    for (const [prop,value] of Object.entries(values)) rule.append({prop,value});
    ast.append(rule);
  };
  update(set,add);
  fs.writeFileSync(path, ast.toString());
}
const root = '#overlay#overlay #hubMain.pg.hub.base-camp.base-frame-v7.base-subpage';
write('base-personnel-v12', (set) => {
  set('.personnel-v12 .companion-hatch', { background:'rgba(20,29,35,.82)', border:'1px solid #d2e3e32e', 'border-radius':'14px', 'box-shadow':'none' });
  set('.personnel-v12 .companion-hatch p', { 'font-size':'22px', 'line-height':'1.55' });
});
write('base-logistics-trade-v12', (set,add) => {
  set('.trade-v12 :is(.trade-v5-thumb,.trade-v5-art) .hs-card', { width:'210px', height:'298px' });
  set('& .trade-v5-thumb', { height:'310px', 'min-height':'310px' });
  add('#overlay#overlay#overlay #hubMain.pg.hub.base-frame-v7 .trade-v12 .trade-v5-art .hs-card', { width:'174px', height:'246px' });
  add(`${root} .trade-v12 .trade-v5-item`, { 'min-height':'390px', 'max-width':'260px', 'justify-self':'center', width:'100%' });
});
write('base-archive-facilities-v12', (set,add) => {
  set('.courtyard-v12 .courtyard-v12-workspace', { 'grid-template-columns':'180px minmax(0,1fr)' });
  set('.courtyard-v12 .courtyard-v3-controls', { 'grid-column':'2', 'grid-row':'1', 'justify-self':'end', 'align-self':'start', width:'300px', height:'auto', 'max-height':'100%', padding:'18px 22px', gap:'12px', 'z-index':'2', background:'rgba(20,29,35,.9)' });
  set('.courtyard-v12 .courtyard-v3-hint', { 'font-size':'20px' });
  set('.courtyard-v12 .courtyard-v3-settings summary', { 'font-size':'21px' });
  set('.courtyard-v12 .courtyard-v3-settings h3', { 'font-size':'22px' });
  set('.courtyard-v12 .courtyard-v3-settings-actions button', { 'font-size':'21px' });
  add(`${root} .courtyard-v12 .courtyard-v3-feed`, { 'min-height':'50px', 'font-size':'22px', border:'1px solid #9edce766', 'border-radius':'8px', color:'#14252b', background:'#9edce7' });
  add(`${root} .courtyard-v12 .courtyard-v3-backdrop`, { position:'absolute', inset:'0', width:'100%', height:'100%', 'z-index':'0' });
});
const selection = '#overlay#overlay .card.page .pg.cls2-page[data-base-departure="true"]';
const dep = '#overlay#overlay #depMain.camp-detail.departure-cover';
write('base-camp-roster', (_set, add) => {
  // Only colors and reading controls: retain the approved portrait geometry.
  add(selection, { '--camp-paper':'#192a31', '--camp-sheet':'rgba(20,29,35,.9)', '--camp-ink':'#f0f4f3', '--camp-sub':'#bccbd0', '--camp-line':'#d2e3e32e', '--camp-blue':'#9edce7' });
  add(`${selection} .cls2-stage`, { background:'#192a31' });
  add(`${selection} .cls2-panel`, { background:'rgba(20,29,35,.9)', color:'#f0f4f3' });
  add(`${selection} .cls2-fullart::after`, { background:'linear-gradient(90deg,#192a31,transparent 18%)' });
  add(`${selection} .cls2-strip`, { background:'#192a31' });
  add(`${selection} .cls2-confirm`, { background:'#9edce7', color:'#14252b', 'border-radius':'9px' });
  add(`${selection} .cls2-face b`, { background:'#20333c', color:'#f0f4f3', 'font-size':'20px' });
  add(`${selection} .cls2-face.sel b`, { background:'#9edce7', color:'#14252b' });
  add(`${selection} .cls2-skin-btn`, { background:'#20333c', color:'#f0f4f3', 'font-size':'20px', 'min-height':'44px' });
  add(`${selection} .cls2-skin-btn.sel`, { background:'#9edce7', color:'#14252b' });
  add(dep, { '--camp-paper':'#192a31', '--camp-sheet':'rgba(20,29,35,.86)', '--camp-ink':'#f0f4f3', '--camp-sub':'#bccbd0', '--camp-blue':'#9edce7', '--camp-line':'#d2e3e32e', color:'#f0f4f3', background:"linear-gradient(#15202866,#15202880),url('../assets/scenes/base-operations-v5.webp') center/cover" });
  add(`${dep} .dep-body > :is(.dep-storage,.dep-pack)`, { background:'rgba(20,29,35,.86)', color:'#f0f4f3', 'border-radius':'14px' });
  add(`${dep} :is(.dep-head,.dep-foot)`, { background:'rgba(20,29,35,.92)', color:'#f0f4f3', 'border-color':'#d2e3e32e' });
  add(`${dep} .dep-body > section > h3`, { color:'#f0f4f3', 'font-size':'26px' });
  add(`${dep} :is(.dep-summary,.dep-filters,.camp-pack-note,.pet-strip)`, { color:'#bccbd0', 'font-size':'21px', 'line-height':'1.55' });
  add(`${dep} .dep-filters :is(select,button)`, { color:'#f0f4f3', background:'#20333c', 'font-size':'20px', 'min-height':'46px', 'border-radius':'8px' });
  add(`${dep} .dep-foot .ov-btn.ok`, { color:'#14252b', background:'#9edce7', 'font-size':'24px', 'border-radius':'9px' });
});
console.log('Courtyard presentation and departure shell updated');
