import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../../搜打撤');
const {createServer}=await import(pathToFileURL(path.join(source,'node_modules/vite/dist/node/index.js')).href);
globalThis.window=globalThis;const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear(),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
globalThis.SDT={Icons:{TYPE_ART:{},img:name=>`<img data-test-icon="${name}">`}};
globalThis.document={body:null,documentElement:{dataset:{},style:{setProperty(){}}},head:{appendChild(){}},addEventListener(){},removeEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},appendChild(){},addEventListener(){}})};
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=()=>0;globalThis.Image=class{addEventListener(){}};globalThis.MutationObserver=class{observe(){}disconnect(){}};
const server=await createServer({root:path.join(source,'game'),configFile:false,cacheDir:path.join(here,'.vite'),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {Cards}=await server.ssrLoadModule('/src/cards/cards.js');
 Cards.STARTERS.forEach((card,index)=>{if(!card.id)card.id=`starter-${index+1}`;});Cards.ensureStarters();Cards.ensureSha();Cards.ensureTabletop();Cards.ensureDmgTypes();Cards.ensureEffectFields();
 const cards=Cards.all(),vectors=[];
 for(const card of cards)for(const hideCost of [false,true])for(const override of [null,0,1,4]){
  const opts={hideCost,...(override==null?{}:{costOverride:{v:override,base:card.cost}})};const html=Cards.cardHTML(card,'sm',opts);
  const cost=html.match(/<div class="hsc-cost(?: cost-mod mod-(down|up))?"[^>]*>(-?\d+)<\/div>/);
  const mark=html.match(/<div class="hsc-dmg[^>]*>(.*?)<\/div>/s);
  vectors.push({id:card.id,hideCost,override,frame:html.match(/data-frame="([^"]+)"/)[1],hasCost:!!cost,cost:cost?Number(cost[2]):null,tone:cost?.[1]??'normal',hasDamage:!!mark,damageText:Cards.dmgMark(card.dmgType,card.dmg??0).text,damageIcon:Cards.dmgMark(card.dmgType,card.dmg??0).icon.match(/data-test-icon="([^"]+)/)?.[1]??'crystal',value:Cards.sellPrice(card)});
 }
 fs.writeFileSync(path.join(here,'source-vectors.json'),JSON.stringify({vectors,frames:JSON.parse(fs.readFileSync(path.join(source,'game/data/card-frame-layout.json'),'utf8'))},null,2)+'\n');
 console.log(JSON.stringify({cards:cards.length,presentationVectors:vectors.length,source:'actual cards.view.js/cardFramePresentation/card-frame-layout.json'}));
}finally{await server.close();}
