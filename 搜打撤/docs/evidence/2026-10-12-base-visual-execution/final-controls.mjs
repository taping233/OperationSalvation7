import fs from 'node:fs';
import postcss from 'postcss';
const path='game/css/base-archive-facilities-v12.css',ast=postcss.parse(fs.readFileSync(path,'utf8'));
const root='body #overlay#overlay#overlay#overlay #hubMain.base-frame-v7';
const rules=[
  ['.archive-v12 .av12-directory button',{'font-size':'20px','min-height':'62px',padding:'8px 12px',gap:'10px'}],
  ['.archive-v12 .av12-directory button b',{'font-size':'20px','white-space':'nowrap'}],
  ['.archive-v12 .base-link',{'font-size':'21px','min-height':'44px',padding:'6px 12px'}],
  ['.facilities-v12 .facility-details',{gap:'16px',padding:'24px 30px'}],
  ['.facilities-v12 .facility-benefit',{padding:'12px 0',gap:'8px'}],
  ['.facilities-v12 .facility-benefit b',{color:'#9edce7'}],
  ['.facilities-v12 .facility-v12-costs h4',{'font-size':'24px',margin:'0 0 10px'}],
  ['.facilities-v12 .camp-costs',{margin:'0',padding:'0'}],
  ['.facilities-v12 .facility-v12-confirm',{display:'flex','flex-direction':'column',gap:'8px'}],
  ['.facilities-v12 .facility-v12-confirm .hint',{'font-size':'21px',margin:'0'}],
  ['.facilities-v12 .source-link',{'font-size':'21px','min-height':'36px',padding:'4px 0','align-self':'flex-start',color:'#9edce7'}],
];
for(const [suffix,values] of rules){const rule=postcss.rule({selector:`${root} ${suffix}`});for(const [prop,value] of Object.entries(values))rule.append({prop,value});ast.append(rule);}
fs.writeFileSync(path,ast.toString());
const courtyard='game/src/hub/hub.courtyard-v3.js';
fs.writeFileSync(courtyard,fs.readFileSync(courtyard,'utf8').replace('轻点台面 · 泛起水圈','轻点水面 · 泛起水圈'));
console.log('Final action visibility and scene interaction wording applied');
