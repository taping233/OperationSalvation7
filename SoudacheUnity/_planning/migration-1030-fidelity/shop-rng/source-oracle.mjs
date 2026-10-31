import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const unity=path.resolve(here,'../../..'), source=path.resolve(unity,'../搜打撤/game');
const {createServer}=await import(pathToFileURL(path.resolve(source,'../node_modules/vite/dist/node/index.js')));
globalThis.window=globalThis;globalThis.SDT={Icons:{img:()=>''}};
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,v)=>memory.set(key,String(v)),removeItem:key=>memory.delete(key)};
globalThis.document={body:null,head:{appendChild(){}},addEventListener(){},removeEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},appendChild(){},addEventListener(){}})};
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=()=>0;
globalThis.Image=class{addEventListener(){}};globalThis.MutationObserver=class{observe(){}disconnect(){}};
const server=await createServer({root:source,configFile:false,cacheDir:path.join(here,'.vite'),optimizeDeps:{noDiscovery:true,include:[]},plugins:[{name:'no-card-view',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/cards/cards.view.js'))return 'export const cardHTML=()=>"";export const cardBackHTML=()=>"";'}}],server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const load=rel=>server.ssrLoadModule('/src/'+rel);
 const random=await load('core/random.js');const {Cards}=await load('cards/cards.js');
 Cards.STARTERS.forEach((card,index)=>{if(!card.id)card.id=`starter-${index+1}`});
 Cards.ensureStarters();Cards.ensureSha();Cards.ensureTabletop();Cards.ensureDmgTypes();Cards.ensureEffectFields();
 const baseline=structuredClone(Cards.all());
 const sourceFile=path.join(source,'src/run/game.run.shop.js'),code=fs.readFileSync(sourceFile,'utf8');
 const begin=code.indexOf('  function generateShopStock() {'),end=code.indexOf('\n  function openShop(',begin);
 if(begin<0||end<begin)throw Error('active generateShopStock boundary missing');
 const generate=new Function('SDT','Random',code.slice(begin,end)+'\nreturn generateShopStock;')(SDT,random.Random);
 const heal=baseline.find(c=>c.id==='tt4-woodify');
 const make=(id,name,rarity='古朴',type='武术',extra={})=>({id,name,rarity,type,cost:1,...extra});
 const eligibility=[heal,...Array.from({length:10},(_,i)=>make('eligible-'+i,'合格'+i,['古朴','稀有','史诗','传说'][i%4],['武术','法术','道具','装备','资源'][i%5])),
   make('bad-initial','初始','初始'),make('bad-token','衍生','衍生'),make('bad-class','职业','职业'),make('bad-cls','归属','古朴','法术',{cls:'法师'}),make('bad-unrandom','禁随机','古朴','道具',{unrandom:true}),make('bad-ability','能力','古朴','能力卡'),make('bad-creature','生物','古朴','生物'),make('bad-prism','棱彩','棱彩'),make('tt-token-color','旧碎片','古朴','道具')];
 const originalAll=Cards.all;
 const edits=[{...baseline[5],name:'同位覆盖商品',type:'装备',rarity:'稀有'},make('fidelity-shop-new','追加新商品','古朴','道具')];
 for(const edit of edits)Cards.upsert(edit);
 const upsert=structuredClone(Cards.all());Cards.all=originalAll;
 const catalogs={baseline,upsert,eligibility,scarce:[heal],empty:[],duplicate:[heal,make('duplicate-1',heal.name),make('duplicate-2',heal.name,'稀有','道具')]};
 const rows=[];
 function run(kind,catalog,version,seed,catFree){
   Cards.all=()=>catalog;SDT.Base={carriedPet:()=>catFree?{effect:{shopFree:true}}:null};
   const svc=new random.SeededRandomService(seed);svc.restore({version,seed,streams:{}});
   const calls=[];random.setRandomService({random(stream,purpose){calls.push([stream,purpose??null]);return svc.random(stream,purpose)},reseed:s=>svc.reseed(s),snapshot:()=>svc.snapshot(),restore:s=>svc.restore(s)});
   for(const [stream,purpose,count]of [['shop','reward',seed%3],['loot','reward',seed%5],['battle','target',2],['scene',null,1]])for(let n=0;n<count;n++)random.Random.random(stream,purpose??undefined);
   const initial=svc.snapshot();calls.length=0;
   const generated=generate(),shaCloned=generated[7].card!==Cards.SHA,shaName=Cards.SHA.name;
   generated[7].card.name='clone-independence-probe';const shaCloneIndependent=Cards.SHA.name===shaName;generated[7].card.name=shaName;
   const stock=generated.map(slot=>({cardId:slot.card?.id??null,price:slot.price||0,sold:!!slot.sold,empty:!!slot.empty,mystery:!!slot.mystery,free:!!slot.free,label:slot.label??null,shaReplenish:slot.shaReplenish??null}));
   const after=svc.snapshot();
   const stockCallCounts={};for(const [stream,purpose]of calls){const key=stream+'/'+purpose;stockCallCounts[key]=(stockCallCounts[key]||0)+1;}
   const drops=[];for(let n=0;n<4;n++)drops.push(Cards.randomDropCard(new Set(drops.filter(Boolean)))?.id??null);
   return {id:`${kind}:v${version}:seed${seed}:cat${catFree}`,kind,catFree,initial,stock,shaCloned,shaCloneIndependent,after,stockCallCounts,drops,afterDrops:svc.snapshot()};
 }
 for(const [kind,catalog]of Object.entries(catalogs))for(const version of [1,2])for(const seed of [0,1,2,42,123,999,4294967295])for(const catFree of kind==='baseline'?[false,true]:[false])rows.push(run(kind,catalog,version,seed,catFree));
 // Seven off-weight rarities force six normal fallback draws; one name remains
 // for the mystery slot. Find actual seeded first-hit-at-50 and exhaustion cases.
 const boundary=[heal,...Array.from({length:200},(_,i)=>make('same-'+i,heal.name)),...Array.from({length:7},(_,i)=>make('off-weight-'+i,'特殊商品'+i,'自制档','道具'))];
 catalogs.boundary=boundary;
 for(const version of [1,2]){
  const found=new Set();
  for(let seed=0;seed<5000&&found.size<3;seed++){
   const row=run('boundary',boundary,version,seed,false),mysteryDraws=row.stockCallCounts['shop/reward']-306;
   const edge=row.stock[8].empty?'exhaust50':mysteryDraws===50?'success50':'successEarly';
   if(!found.has(edge)){row.boundary=edge;row.mysteryDraws=mysteryDraws;rows.push(row);found.add(edge);}
  }
  if(found.size!==3)throw Error('could not cover all seeded mystery boundary cases v'+version);
 }
 Cards.all=originalAll;
 const sourcePaths=[...new Set(['src/run/game.run.shop.js','src/core/random.js','src/core/random-service.js','src/core/random-core.js','src/core/random-streams.js','src/core/data-loader.js','data/cards-sync.json',...fs.readdirSync(path.join(source,'src/cards')).filter(file=>file.endsWith('.js')).map(file=>'src/cards/'+file)])];
 const narrow=card=>Object.fromEntries(['id','name','rarity','type','cls','unrandom','hero','tokenOf'].filter(k=>card[k]!==undefined).map(k=>[k,card[k]]));
 const output={catalogs:Object.fromEntries(Object.entries(catalogs).map(([key,cards])=>[key,cards.map(narrow)])),edits:edits.map(narrow),rows,sourceHashes:sourcePaths.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex')}))};
 fs.writeFileSync(path.join(here,'source-results.json'),JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({baseline:baseline.length,upsert:upsert.length,cases:rows.length,catalogKinds:Object.keys(catalogs)}));
}finally{await server.close();}
