import fs from 'node:fs';
import postcss from 'postcss';
const photoFile='game/css/photo-studio-unified.css';
const photo=postcss.parse(fs.readFileSync(photoFile,'utf8'));
const sizes=new Map([
  ['.studio-index-heading>span:first-child',20],['.studio-clear',20],['#cardSearch',21],
  ['.studio-choice-trigger',21],['.studio-choice-option',21],['.studio-photo-caption b',21],
  ['.studio-photo-caption .type-badge',19],['.pv-label',20],['.pv-cost',22],['.pv-desc',23],['.pv-pos',20],
]);
photo.walkRules(rule=>{
  for(const [suffix,size] of sizes){
    if(!rule.selector.endsWith(suffix))continue;
    rule.walkDecls(decl=>{
      if(decl.prop==='font')decl.value=decl.value.replace(/\b\d+(?:\.\d+)?px/,`${size}px`);
      if(decl.prop==='font-size')decl.value=`${size}px`;
    });
  }
});
fs.writeFileSync(photoFile,photo.toString());
const path='game/css/departure-selected.css',dep=postcss.parse(fs.readFileSync(path,'utf8'));
const scope='#overlay#overlay #depMain.departure-cover';
function add(suffix,values){const rule=postcss.rule({selector:`${scope} ${suffix}`});for(const [prop,value] of Object.entries(values))rule.append({prop,value});dep.append(rule);}
add('.dep-body > :is(.dep-storage,.dep-pack)',{display:'flex','flex-direction':'column','min-height':'0',overflow:'hidden'});
add('.dep-storage .dep-filters',{flex:'none'});
add('#depPool',{'grid-template-columns':'repeat(auto-fill,minmax(min(235px,100%),1fr))',flex:'1','min-height':'0',gap:'20px'});
add('#depPool .dep-card-face .hs-card',{width:'220px','max-width':'100%',height:'312px','font-size':'20px'});
add('#depPool .dep-quantity',{'font-size':'20px',color:'#bccbd0'});
add('#depBag',{'grid-template-columns':'repeat(auto-fill,minmax(220px,1fr))','min-height':'0'});
add('#depBag .bag-cell',{width:'220px','min-height':'340px'});
add('#depBag .bag-cell > .hs-card',{width:'210px','font-size':'20px'});
add('.dep-pack > :is(.dep-summary,.pet-strip,.camp-pack-note)',{flex:'none'});
fs.writeFileSync(path,dep.toString());
const tradeFile='game/css/base-logistics-trade-v12.css',trade=postcss.parse(fs.readFileSync(tradeFile,'utf8'));
trade.walkRules(rule=>{
  if(rule.selector==='& .trade-v12-categories button')rule.append({'prop':'font-size',value:'21px'});
  if(rule.selector==='& .trade-v12-categories button.on')rule.walkDecls('background',d=>d.value='#9edce7');
});
// Drop the two selectors written for a superseded category class.
trade.walkRules(rule=>{if(rule.selector.includes('.trade-v5-categories button'))rule.remove();});
fs.writeFileSync(tradeFile,trade.toString());
console.log('Photo typography and separate departure browsing panes updated');
