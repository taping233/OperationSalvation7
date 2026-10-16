import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = { Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  MAP:{rules:{battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:1,battleStartDraw:5,battleTurnDraw:1,diceSides:6},items:{}} };
await import('../game/src/cards/cards.js');
const recorder = await import('../game/src/agent/agent.recorder.js');
window.SDT.Agent = {recorder};
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { finish } = await import('../game/src/battle/core/battle.engine.js');
const { registerDefeatPresenter } = await import('../game/src/battle/core/battle.presentation.js');
const { brief } = await import('../game/src/agent/agent.stats.js');
const seen = [];
let game;
const tick = () => new Promise(resolve => setTimeout(resolve,1));
async function idle() {
  for(let i=0;i<300;i++) {
    await tick();
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) return s;
  }
  throw new Error('battle did not settle');
}
function makeGame(onBattleEnd = () => seen.push(recorder.snapshotRunBattles())) {
  return { ownedCards:[{uid:'attack',card:structuredClone(window.SDT.Cards.all().find(card=>card.id==='starter-attack'))}],
    inventory:[],usedPocket:[],cardOrder:[],eventLog:[],layerIdx:0,trackPos:1,
    hp:30,maxHp:30,atk:5,spellPower:0,coins:0,turn:1,state:'idle',battleActive:false,
    myClass:'侠客',log(){},heal(){},addItem(){},onBattleEnd };
}
async function start(options = {}, active = game, hp = 1, atk = 0) {
  BattleSession.start(active,[{id:'recorder-target',name:'统计靶子',hp,atk,behavior:'strike'}],options);
  await idle();
}
async function win(options = {}, active = game) {
  await start(options,active);
  const card = BattleSession.getSnapshot().hand[0];
  BattleSession.commands.playCard(card,0);
  await idle();
  expect(active.battleActive).toBe(false);
}
beforeAll(() => {
  for(const key of ['ensureSha','ensureStarters','ensureTabletop','ensureDmgTypes','ensureEffectFields']) window.SDT.Cards[key]();
});
beforeEach(() => {
  localStorage.clear(); recorder.resetRunCounters(); seen.length=0;
  game=makeGame(); window.SDT.game=game;
  recorder.snapshotRunBattles('lifecycle-player-run');
});
afterEach(() => { registerDefeatPresenter(null); if(game?.battleActive) BattleSession.commands.flee(); vi.restoreAllMocks(); });

describe('真实 BattleSession 收尾与统计先后顺序', () => {
  it('正常出牌完成6胜，快照重载后首脑击杀玩家，末战在同步终局记录前已记入', async () => {
    for(let i=0;i<6;i++) { game.trackPos=i; await win(); }
    expect(recorder.snapshotRunBattles()).toMatchObject({fought:6,won:6});
    expect(seen.map(s=>s.fought)).toEqual([1,2,3,4,5,6]);
    const saved=JSON.parse(JSON.stringify(recorder.snapshotRunBattles()));
    recorder.resetRunCounters();
    expect(recorder.restoreRunBattles(saved,'lifecycle-player-run')).toBe(true);
    let terminal;
    game.onBattleEnd=()=>{ terminal=recorder.recordRun('death'); };
    await start({isBoss:true,directBossStart:true},game,1000,999);
    const checkpoint=BattleSession.serialize();
    expect(BattleSession.restore(game,checkpoint)).toBe(true);
    expect(BattleSession.restore(game,checkpoint)).toBe(true);
    await idle();
    expect(recorder.getBattleCount()).toBe(6); // 重开未完成战斗不记一场
    BattleSession.commands.endTurn(); await idle();
    expect(terminal.battles).toEqual({fought:7,won:6});
    expect(terminal.lastBattles.at(-1)).toMatchObject({w:0,mode:'lose'});
    expect(brief([terminal]).battleWinRate).toBe(85.7);
    expect(recorder.getBattleCount()).toBe(0);
  });

  it('重复finish/撤退通知只结算和计数一次，不给下一局遗留一场', async () => {
    game.onBattleEnd=vi.fn(()=>recorder.recordRun('extract'));
    await win();
    finish(true); BattleSession.commands.flee(); finish(false);
    expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
    expect(recorder.listRuns()).toHaveLength(1);
    expect(recorder.listRuns()[0].battles).toEqual({fought:1,won:1});
    expect(recorder.getBattleCount()).toBe(0);
  });

  it('倒地展示等待时已记败场，等待中重复提交不二次入账，展示结束记录一次', async () => {
    let release, terminal;
    registerDefeatPresenter(()=>new Promise(resolve=>{release=resolve;}));
    game.onBattleEnd=vi.fn(()=>{terminal=recorder.recordRun('death');});
    await start();
    BattleSession.commands.surrender(); finish(false);
    expect(recorder.snapshotRunBattles()).toMatchObject({fought:1,won:0});
    expect(game.onBattleEnd).not.toHaveBeenCalled();
    release(); await tick();
    expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
    expect(terminal.battles).toEqual({fought:1,won:0});
  });

  it('QA/devSample胜负不混入正在进行的玩家计数，辅助局原来源标记保留', async () => {
    await win();
    const player=recorder.snapshotRunBattles();
    const sample=makeGame(()=>{});
    await win({devSample:true},sample);
    await start({devSample:true},sample);
    BattleSession.commands.surrender();
    expect(recorder.snapshotRunBattles()).toEqual(player);
    recorder.noteIntervention('debug-command','已授权辅助样本');
    const terminal=recorder.recordRun('extract');
    expect(terminal.battles).toEqual({fought:1,won:1});
    expect(terminal.provenance.driver).toBe('mixed');
    expect(terminal.provenance.interventions).toHaveLength(1);
  });
});
