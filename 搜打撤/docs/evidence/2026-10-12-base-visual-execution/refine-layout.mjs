import fs from 'node:fs';
import postcss from 'postcss';
const root = '#overlay#overlay #hubMain.pg.hub.base-camp.base-frame-v7.base-subpage';
const strong = 'body #overlay#overlay#overlay#overlay #hubMain.base-frame-v7';
function change(name, rules) {
  const path = `game/css/${name}.css`, ast = postcss.parse(fs.readFileSync(path, 'utf8'));
  for (const [selector,values] of rules) {
    const rule = postcss.rule({selector});
    for (const [prop,value] of Object.entries(values)) rule.append({prop,value});
    ast.append(rule);
  }
  fs.writeFileSync(path,ast.toString());
}
change('base-personnel-v12', [
  [`${root} .personnel-v12 .person-skin img`, {height:'96px'}],
  [`${root} .personnel-v12 .partner-details`, {gap:'6px'}],
  [`${root} .personnel-v12 .warehouse-facts`, {padding:'0',border:'0','min-height':'0'}],
  [`${root} .personnel-v12 .warehouse-facts > div`, {padding:'0',border:'0','min-height':'0','align-items':'center'}],
  [`${root} .personnel-v12 .partner-stage:has(.partner-state.carried) [data-act="selPet"]`, {display:'none'}],
  [`${root} .personnel-v12 .partner-details > section`, {display:'grid','grid-template-columns':'1fr 1fr',gap:'8px 16px'}],
  [`${root} .personnel-v12 .partner-details > section > :is(h4,.companion-growth,.camp-costs,.source-link)`, {'grid-column':'1/-1',margin:'0'}],
  [`${root} .personnel-v12 .partner-details .camp-costs`, {padding:'8px 0','min-height':'0',border:'0'}],
  [`${root} .personnel-v12 .partner-details .camp-costs > div`, {display:'flex','align-items':'center','justify-content':'space-between',padding:'0',gap:'12px',border:'0'}],
  [`${root} .personnel-v12 .partner-details .camp-costs :is(dt,dd)`, {margin:'0','font-size':'22px'}],
  [`${root} .personnel-v12 .partner-details .camp-costs dd`, {display:'flex',gap:'10px','align-items':'baseline'}],
  [`${root} .personnel-v12 .partner-details .hint`, {'align-self':'center',margin:'0'}],
  [`${strong} .personnel-v12 button.source-link`, {'font-size':'20px','min-height':'36px',padding:'2px 0','justify-content':'flex-start',color:'#9edce7',background:'transparent'}],
]);
change('base-logistics-trade-v12', [
  [`${strong} .trade-v12 .trade-v5-balance`, {'font-size':'22px','line-height':'1.5'}],
  [`${strong} .trade-v12 .trade-v5-categories button`, {'font-size':'21px','min-height':'48px'}],
  [`${strong} .trade-v12 .trade-v5-categories button.is-selected`, {background:'#9edce7',color:'#14252b'}],
  [`${strong} .trade-v12 .trade-v5-item-label`, {'font-size':'20px'}],
]);
for (const file of ['game/src/hub/hub.personnel.js','game/src/hub/hub.facilities.js']) {
  const source = fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,source.replaceAll(' data-trade-key="rations"','').replaceAll(' data-trade-key="wood"',''));
}
console.log('First visual pass refinements applied');
