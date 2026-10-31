import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../搜打撤/game/src');
const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
const random=await load('core/random.js'),combat=(await load('battle/core/combat.factory.js')).createCombatRuntime();
const bosses=await load('battle/core/battle.boss-mechanics.js');
const witness=[];
for(const type of ['attack','spell','fixed','true'])for(const silence of [0,1])for(const healban of [0,1])for(const amount of [3,100]){
 const target={hp:20,maxHp:30,atk:1,behavior:'witness_pope',status:{silence,healban},defense:{armor:2,shield:0,guard:false}};
 const attacker={atk:4,spellPower:2,status:{}};const input=structuredClone(target);const result=combat.dealDamage(attacker,target,amount,type);witness.push({type,amount,input,after:{hp:target.hp,atk:target.atk},dealt:result.dealt});
}
const capped=[];
for(const type of ['attack','spell','true'])for(const abreak of [0,1])for(const necroticExposure of [0,2,8]){
 const target={hp:100,maxHp:100,atk:1,damageCap:4,status:{abreak,necroticExposure},defense:{armor:2,shield:0,guard:false}},input=structuredClone(target);
 const result=combat.dealDamage({atk:4,spellPower:2,status:{}},target,9,type);capped.push({type,input,dealt:result.dealt,hp:target.hp});
}
const summons=[];
for(const mode of ['standard','elite']){
 random.setRandomService(new random.SeededRandomService(333));
 const runtime={turn:1,foes:[{name:'mother',hp:45,maxHp:45,atk:6,behavior:'mutation_mother',status:{}}],allies:[],G:{mode,log(){}}};
 for(const turn of [2,4,6]){runtime.turn=turn;bosses.applyBossTurnStart({runtime,combat,random:random.Random,engine:{intentFor:()=>({})}});const f=runtime.foes.at(-1);summons.push({mode,turn,foe:{id:f.id,hp:f.hp,atk:f.atk,eliteSkill:f.eliteSkill??null,stealth:f.status.stealth??0}});}
}
const necro=[];const runtime={turn:1,foes:[{name:'necro',hp:75,maxHp:75,atk:5,behavior:'necromancer',status:{}}],drawPile:['d0','d1','d2','d3','d4','d5','d6'],grave:[],cardAnims:[],G:{log(){}}};
for(const turn of [3,6,9]){runtime.turn=turn;bosses.applyBossTurnStart({runtime,combat,random:random.Random,engine:{findCard:()=>null}});necro.push({turn,drawPile:[...runtime.drawPile],grave:[...runtime.grave],exposure:runtime.foes[0].status.necroticExposure});}
fs.writeFileSync(path.join(here,'boss-source-vectors.json'),JSON.stringify({witness,capped,summons,necro,summonPool:bosses.BOSS_SUMMON_POOL},null,2)+'\n');console.log(JSON.stringify({witness:witness.length,capped:capped.length,summons:summons.length,necro:necro.length}));
