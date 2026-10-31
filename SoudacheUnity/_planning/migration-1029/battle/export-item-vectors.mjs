import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../搜打撤');
const {parse}=await import(pathToFileURL(path.join(source,'node_modules/acorn/dist/acorn.mjs')).href);
const packet=JSON.parse(fs.readFileSync(path.join(here,'current-catalog.json'),'utf8'));
const random=await import(pathToFileURL(path.join(source,'game/src/core/random.js')).href);
const {createCombatRuntime}=await import(pathToFileURL(path.join(source,'game/src/battle/core/combat.factory.js')).href);
const Combat=createCombatRuntime();
function extract(file,name){const code=fs.readFileSync(path.join(source,'game/src',file),'utf8'),ast=parse(code,{ecmaVersion:'latest',sourceType:'module'});function walk(node){if(node.type==='FunctionDeclaration'&&node.id.name===name)return code.slice(node.start,node.end);for(const value of Object.values(node))for(const v of Array.isArray(value)?value:[value])if(v&&typeof v==='object'&&v.type){const found=walk(v);if(found)return found;}}return walk(ast);}
const targetFor=new Function('return ('+extract('battle/effects/battle.target-rules.js','itemTargetSideFor')+')')();
const vectors=[];
for(const card of packet.cards.filter(c=>c.type==='道具'&&c.rules?.bag?.use)){
  if(card.rules.bag.use.some(op=>['restoreConsumed','acquire','discover','flee'].includes(op.op)))continue;
  for(const silenced of [false,true]){
    const player={hp:20,maxHp:35,atk:4,spellPower:2,status:{silence:silenced?2:0}},foes=[{name:'target',hp:40,maxHp:40,atk:4,status:{},defense:{armor:0,shield:0,guard:false}},{name:'target2',hp:40,maxHp:40,atk:7,status:{},defense:{armor:0,shield:0,guard:false}}];
    for(const foe of foes)Combat.ensureStatus(foe);let energy=2,draw=0;
    const runtime={G:{log(){},heal:n=>{player.hp=Math.min(35,player.hp+n);}},pstat:player,foes,delayed:[]};
    const ports={instanceRuntime:runtime,alive:()=>foes.filter(f=>!f.dead&&f.hp>0),emitBattlePresentation(){},getTurn:()=>1,esc:value=>value,
      finish(){},healPlayer:n=>{if(!player.status.healban)player.hp=Math.min(35,player.hp+n);},restoreConsumed:()=>0,addEnergy:n=>{energy+=n;},Combat,
      countKinds:foe=>['bleed','poison','freeze','silence','abreak','healban','atkDown'].filter(k=>(foe.status[k]||0)>0).length,
      drawCards:n=>{draw+=n;return n;},Random:random.Random,hitFoe:(foe,_card,amount,type)=>{Combat.dealDamage(player,foe,amount,type);foe.dead=foe.hp<=0;},matchesExecuteCap:(foe,cap)=>(cap.atk==null||foe.atk<=cap.atk)&&(!cap.wounded||foe.hp<foe.maxHp)};
    const resolve=new Function(...Object.keys(ports),'return ('+extract('battle/bag/battle.bag.domain.js','resolveBagOperations')+')')(...Object.values(ports));
    random.setRandomService(new random.SeededRandomService(333));const gen=resolve(card,foes[0]);let step=gen.next();while(!step.done)step=gen.next();
    vectors.push({id:card.id,silenced,targetSide:targetFor(card),hp:player.hp,status:player.status,energy,draw,foes:foes.map(f=>({hp:f.hp,dead:!!f.dead,status:f.status}))});
  }
}
const consumed=await import(pathToFileURL(path.join(source,'game/src/battle/bag/battle.consumed-pile.js')).href);
const pile={hand:['active'],drawPile:['deck'],played:['a','a','active'],consumed:['b','a'],discard:['c','deck'],grave:['d','b']};
const before=consumed.readConsumedPile(pile,['d']),retrieved=consumed.takeConsumedCard(pile,'a','hand');
fs.writeFileSync(path.join(here,'item-source-vectors.json'),JSON.stringify({vectors,consumed:{before,retrieved,after:pile}},null,2)+'\n');
console.log(JSON.stringify({itemVectors:vectors.length,consumedSource:true}));
