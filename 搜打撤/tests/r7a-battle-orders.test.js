import {beforeAll,describe,expect,it} from 'vitest';

window.SDT=window.SDT||{Icons:{img:()=>''}}; window.SDT.Icons.TYPE_ART={};
window.SDT.Sound={music(){},sfx(){},setDucked(){},setBoss(){}};
window.SDT.MAP={rules:{battleEnergy:2,battleHandMax:10,bossDeckSize:10,starterSha:0,battleStartDraw:5,battleTurnDraw:1,diceSides:6},items:{rations:{name:'口粮'},wood:{name:'木材'}}};
await import('../game/src/cards/cards.js');
const {BattleSession}=await import('../game/src/battle/battle.core.js');
const {Random,SeededRandomService}=await import('../game/src/core/random.js');
const C=window.SDT.Cards;
beforeAll(()=>{C.ensureSha();C.ensureDmgTypes();});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function drain(){for(let i=0;i<80;i++){await tick();const s=BattleSession.getSnapshot();if(!s.busy&&s.phase==='player')return s;}return BattleSession.getSnapshot();}
async function runEnemyTurn(){let left=false;for(let i=0;i<160;i++){await tick();const s=BattleSession.getSnapshot();if(s.phase!=='player'||s.busy)left=true;if(left&&!s.busy&&s.phase==='player')return s;}return BattleSession.getSnapshot();}
let uid=0;
function game(cards){const chosen=cards||[C.SHA,C.SHA];return{ownedCards:chosen.map(card=>({uid:`r7-${uid++}`,card:{...card}})),hp:50,maxHp:50,atk:4,spellPower:0,coins:0,myClass:null,characterId:null,state:'idle',battleActive:false,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};}
async function play(defs,targets){const g=game();BattleSession.start(g,defs,{isBoss:false,encounterId:'r7-test'});await drain();for(const target of targets){const card=BattleSession.getSnapshot().hand[0];BattleSession.commands.playCard(card,target);await drain();}BattleSession.commands.endTurn();const s=await runEnemyTurn();return{g,s,checkpoint:BattleSession.serialize()};}
const L2=[{id:'archer',name:'联邦射手',atk:5,hp:3,behavior:'volley'},{id:'cavalry',name:'联邦机动兵',atk:5,hp:6,behavior:'charge'}];
const L4=[{id:'fire_el',name:'灼热异变体',atk:10,hp:7,behavior:'burn'},{id:'grass_el',name:'滋生异变体',atk:5,hp:12,behavior:'curse'}];

describe('R7-a legal target orders in real BattleSession',()=>{
  it('L2 low-hp removal costs 5 hp while pressing cavalry costs 10 hp',async()=>{
    const a=await play(L2,[0]); expect(a.g.hp).toBe(45); expect(a.s.foes.filter(f=>!f.dead).map(f=>[f.id,f.hp])).toEqual([['cavalry',6]]); BattleSession.commands.flee();
    const b=await play(L2,[1]); expect(b.g.hp).toBe(40); expect(b.s.foes.map(f=>[f.id,f.hp,f.dead])).toEqual([['archer',3,false],['cavalry',2,false]]); BattleSession.commands.flee();
  });
  it('L4 fire-first and grass-first produce real hp/status differences',async()=>{
    const curseTotal=s=>['bleed','poison','burn'].reduce((n,k)=>n+(s.pstat.status[k]||0),0);
    const a=await play(L4,[0,0]); expect(a.g.hp).toBe(45); expect(a.s.pstat.status.burn||0).toBe(0); expect(curseTotal(a.s)).toBeLessThanOrEqual(1); BattleSession.commands.flee();
    const b=await play(L4,[1,1]); expect(b.g.hp).toBe(35); expect(b.s.pstat.status.burn).toBeGreaterThanOrEqual(1); expect(curseTotal(b.s)).toBeGreaterThanOrEqual(1); BattleSession.commands.flee();
  });
  it('L4 dealt=0 with an explicit initial-defense fixture adds neither burn nor curse',async()=>{
    const statusSeed=Array.from({length:100},(_,i)=>`r7-no-burn-${i}`).find(seed=>new SeededRandomService(seed).random('status')<2/3);
    Random.reseed(statusSeed);
    const g=game(); BattleSession.start(g,L4,{isBoss:false,encounterId:'r7-blocked'}); const snap=await drain();
    const defended=structuredClone(snap); defended.pdef={...defended.pdef,armor:15};
    expect(BattleSession.restore(g,defended)).toBe(true);
    expect(BattleSession.getSnapshot().pdef.armor).toBe(15);
    BattleSession.commands.endTurn(); const s=await runEnemyTurn();
    expect(g.hp).toBe(50); expect(s.pdef.armor).toBe(0);
    expect(s.pstat.status.burn||0).toBe(0);
    expect((s.pstat.status.bleed||0)+(s.pstat.status.poison||0)).toBe(0);
    BattleSession.commands.flee();
  });
  it('restart checkpoint preserves ordered enemy defs and encounter opts',async()=>{
    const out=await play(L2,[]); expect(out.checkpoint.enemyDefs.map(e=>e.id)).toEqual(['archer','cavalry']); expect(out.checkpoint.opts.encounterId).toBe('r7-test');
    const restoredGame=game(); expect(BattleSession.restore(restoredGame,structuredClone(out.checkpoint))).toBe(true); expect(BattleSession.getSnapshot().foes.map(e=>e.id)).toEqual(['archer','cavalry']); expect(BattleSession.getSnapshot().opts.encounterId).toBe('r7-test');
    BattleSession.commands.flee();
  });
});
