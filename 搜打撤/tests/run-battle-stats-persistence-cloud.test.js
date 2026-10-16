import { beforeEach, describe, expect, it, vi } from 'vitest';

let session, storage, recorder, Base;
async function boot() {
  vi.resetModules();
  document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
  window.SDT = { Icons:{ img:()=>'', TYPE_ART:{} }, Sound:{ music(){},sfx(){},setDucked(){} }, FX:{ feedback(){} } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ RunStorage: storage } = await import('../game/src/hub/game.storage.js'));
  recorder = await import('../game/src/agent/agent.recorder.js');
  Base = window.SDT.Base;
  Object.assign(window.SDT.UI, { log:vi.fn(),refresh:vi.fn(),clearLog(){},hideOverlay(){},hideScreen(){},showScreen(){},showOverlay(){},act(){},registerHelp(){},helpBtn:()=>'' });
  window.SDT.Meta = { setXpMul(){},track(){} };
  session.configureGameRuntime({ openClassChoice:vi.fn() });
}
function seedRun(slot = 1) {
  Base.use(slot); session._set_active_slot(slot);
  session.buildDerived(`stats-cloud-${slot}`);
  Object.assign(session.game, { runActive:true,nestActive:false,battleActive:false,state:'idle',layerIdx:0,
    trackPos:session.game.layerData[0].entrances[0],myClass:'warrior',hp:30,maxHp:30,coins:7,
    ownedCards:[],usedPocket:[],inventory:[],nodeRewards:{},discoveredPairs:new Set(),
    visited:{},entrySupply:null,pendingExtraction:null,extractionPending:null,terminalPending:null });
  expect(session.saveGame()).toBe(true);
  return storage.readIdentity(slot).value.runId;
}
beforeEach(async () => { localStorage.clear(); await boot(); });

describe('本局真实保存/装载链中的战斗统计', () => {
  it('六胜经真正模块重载与读档保留，终局再负一场为6/7；重复读档仅替换', async () => {
    const runId = seedRun();
    for (let i=0;i<6;i++) recorder.noteBattle(true,{ foe:`常规战${i}`,li:i%3,mode:'win' });
    expect(session.saveGame()).toBe(true);
    expect(storage.read(1).runBattleStats).toMatchObject({ version:1,runId,fought:6,won:6 });
    await boot();
    expect(recorder.getBattleCount()).toBe(0);
    session._set_active_slot(1);
    expect(session.loadGame(1).ok).toBe(true);
    expect(recorder.getBattleCount()).toBe(6);
    expect(session.loadGame(1).ok).toBe(true);
    expect(recorder.getBattleCount()).toBe(6);
    recorder.noteBattle(false,{ foe:'首脑',li:3,mode:'lose' });
    const terminal = recorder.recordRun('death');
    expect(terminal).toMatchObject({ runId,battles:{fought:7,won:6},provenance:{driver:'human'} });
    const { aggregate } = await import('../game/src/agent/agent.stats.js');
    expect(aggregate(recorder.listRuns()).overall.battleWinRate).toBe(85.7);
    const { dataPanelHTML } = await import('../game/src/agent/agent.data.js');
    expect(dataPanelHTML()).toMatch(/战斗胜率[\s\S]*?85\.7%/);
    expect(recorder.getBattleCount()).toBe(0);
  });

  it.each(['missing','invalid','wrong-run'])('%s统计不猜历史胜场，装载后为0', kind => {
    const runId = seedRun();
    const raw = storage.read(1);
    raw.runBattleStats = kind === 'missing' ? undefined : { version:1,runId:kind==='wrong-run'?'another-run':runId,fought:3,won:4,log:[] };
    if (kind === 'wrong-run') raw.runBattleStats.won = 2;
    expect(storage.write(1,raw)).toBe(true);
    recorder.noteBattle(true);
    expect(session.loadGame(1).ok).toBe(true);
    expect(recorder.snapshotRunBattles()).toMatchObject({runId,fought:0,won:0,log:[]});
  });

  it('切换档位恢复各自计数，新开局不继承上一局', () => {
    const firstId = seedRun(1);
    recorder.noteBattle(true); expect(session.saveGame()).toBe(true);
    recorder.resetRunCounters();
    const secondId = seedRun(2);
    recorder.noteBattle(false); expect(session.saveGame()).toBe(true);
    session._set_active_slot(1);
    expect(session.loadGame(1).ok).toBe(true);
    expect(recorder.snapshotRunBattles()).toMatchObject({runId:firstId,fought:1,won:1});
    session._set_active_slot(2);
    expect(session.loadGame(2).ok).toBe(true);
    expect(recorder.snapshotRunBattles()).toMatchObject({runId:secondId,fought:1,won:0});
    expect(storage.remove(2)).toBe(true);
    session.newRun('standard',[],{skipClassChoice:true});
    expect(recorder.snapshotRunBattles()).toMatchObject({fought:0,won:0,log:[]});
  });

  it('末40场有界、白名单克隆不泄漏引用，终局仍保留原末10场口径', () => {
    const runId = seedRun();
    const deck = ['测试武术'];
    for (let i=0;i<45;i++) recorder.noteBattle(true,{foe:`战斗${i}`,mode:'win',deck,unrelated:'不保存'});
    expect(session.saveGame()).toBe(true);
    const saved = storage.read(1).runBattleStats;
    expect(saved).toMatchObject({runId,fought:45,won:45});
    expect(saved.log).toHaveLength(40);
    expect(saved.log[0].foe).toBe('战斗5');
    expect(saved.log[0]).not.toHaveProperty('unrelated');
    saved.log[0].deck.push('外部修改');
    expect(recorder.snapshotRunBattles().log[0].deck).toEqual(deck);
    const terminal = recorder.recordRun('extract');
    expect(terminal.lastBattles).toHaveLength(10);
    expect(terminal.lastBattles[0].foe).toBe('战斗35');
  });

  it('不能把旧runId的内存计数盖章给其他局，暂时取不到身份也不清零', () => {
    const runId=seedRun(); recorder.noteBattle(true);
    recorder.snapshotRunBattles(runId);
    expect(recorder.snapshotRunBattles(null)).toMatchObject({runId,fought:1,won:1});
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    expect(recorder.snapshotRunBattles('different-run')).toMatchObject({runId:'different-run',fought:0,won:0,log:[]});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('未沿用其他对局'));
    warn.mockRestore();
  });

  it('同会话重复装载保留既有辅助来源，快照中的名字与编组有上限', () => {
    seedRun();
    recorder.setDriver('greedy'); recorder.setDriver('human');
    recorder.noteIntervention('debug-command','辅助状态');
    recorder.noteBattle(true,{foe:'名'.repeat(300),deck:Array(50).fill('卡'.repeat(300)),mode:'win'});
    expect(session.saveGame()).toBe(true);
    const saved=storage.read(1).runBattleStats;
    expect(saved.log[0].foe).toHaveLength(256);
    expect(saved.log[0].deck).toHaveLength(40);
    expect(saved.log[0].deck[0]).toHaveLength(256);
    expect(session.loadGame(1).ok).toBe(true);
    expect(session.loadGame(1).ok).toBe(true);
    expect(recorder.recordRun('extract').provenance).toMatchObject({driver:'mixed',agentDriver:'greedy',interventions:[{action:'辅助状态'}]});
  });

  it.each([
    {fought:-1}, {fought:1.5}, {won:Infinity}, {version:2}, {log:Array(41).fill({})},
    {log:[{w:1,foe:'坏条目',mode:'win',hp:'坏值',deck:null}]},
    {log:[{w:1,foe:'a'.repeat(257),mode:'win',deck:null}]},
    {log:[{w:1,foe:'坏条目',mode:'lose',deck:null}]},
  ])('异常快照不可带入计数：%j', patch => {
    const runId = seedRun(); recorder.noteBattle(true);
    const data = {...recorder.snapshotRunBattles(runId),...patch};
    expect(recorder.restoreRunBattles(data,runId)).toBe(false);
    expect(recorder.getBattleCount()).toBe(0);
  });
});
