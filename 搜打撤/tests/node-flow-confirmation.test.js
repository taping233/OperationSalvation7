import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
const st = vi.hoisted(() => ({ game:{}, layer:{ logical:[] }, acts:{}, encounter:vi.fn(() => [{ name:'敌人' }]), battle:vi.fn(), enter:vi.fn((_kind, done) => done()), chests:vi.fn(), supply:vi.fn(), saved:vi.fn(), safe:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({ MAP:{}, game:st.game, curLayer:() => st.layer,
  getActiveSlot:() => 1, saveGame:st.saved, weighted:x => x[0], pick:x => x[0], gainCoins:vi.fn(), scaledEnemy:x => x,
  cellCenter:() => ({ x:0, y:0 }), markSeen:vi.fn(), modeCfg:() => ({}) }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  nodeShell:spec => { document.getElementById('body').innerHTML = `${spec.body || ''}${spec.foot || ''}`; },
  nodeOpt:(act, label) => `<button data-act="${act}">${label}</button>`, buildEncounter:st.encounter,
  openBattleCell:st.battle, openChestsOnCell:st.chests, enterNode:st.enter,
  finishInstant:() => { st.game.state = 'idle'; }, consumeCurrentCell:vi.fn(), consumeCell:vi.fn(), cancelLegacyChainMove:vi.fn(),
  grantEventCard:vi.fn(), openBlankSafePage:st.safe, openFixedRewardsOnCell:vi.fn(), openPickupPage:vi.fn(), openPocketRestore:vi.fn(), openShop:vi.fn(), preloadCellScene:vi.fn(), resumeChestsOnCell:vi.fn(),
}));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openEntrySupply:st.supply, openDoorModal:vi.fn(), openFireRest:vi.fn(), openAltarRitual:vi.fn(), openBossGate:vi.fn(), openEmergencyModal:vi.fn(), resumeNodeRestore:vi.fn(() => false) }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen:vi.fn() }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle:vi.fn() }));
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler:{ invalidate:vi.fn() } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative:vi.fn(), lastLampNarrative:vi.fn() }));
vi.mock('../game/src/run/game.run.data.js', () => ({ EVENT_SCENE_META:{} }));
let reenter;
beforeAll(async () => {
  window.SDT = { UI:{ act:(name, fn) => { st.acts[name] = fn; }, el:{ get ovBody() { return document.getElementById('body'); } },
    beginRoom:vi.fn(), hideOverlay:() => { document.getElementById('body').replaceChildren(); }, log:vi.fn(), refresh:vi.fn() } };
  ({ reenterCell:reenter } = await import('../game/src/run/game.run.flow.js'));
});
beforeEach(() => {
  document.body.innerHTML = '<div id="body"></div>';
  Object.assign(st.game, { state:'idle', layerIdx:0, trackPos:0, layerData:[], discoveredPairs:new Set(), visited:{}, entrySupply:null, nodeRewards:{} });
  st.acts = {}; st.layer.logical = [{ def:{ type:'battle' } }];
  st.encounter.mockClear(); st.battle.mockClear(); st.enter.mockClear(); st.chests.mockClear(); st.supply.mockClear(); st.safe.mockClear();
});
it('战斗格先走通用节点过场再开战，无确认页且不预抽遭遇', () => {
  let continueEntry;
  st.enter.mockImplementationOnce((_kind, done) => { continueEntry = done; });
  reenter();
  expect(st.enter).toHaveBeenCalledExactlyOnceWith('battle', expect.any(Function));
  expect(st.battle).not.toHaveBeenCalled();
  expect(st.encounter).not.toHaveBeenCalled();
  expect(st.game.state).toBe('modal');
  reenter();
  expect(st.enter).toHaveBeenCalledTimes(1);
  continueEntry();
  expect(st.battle).toHaveBeenCalledTimes(1);
  expect(st.battle.mock.calls[0][0]).toBe(st.layer.logical[0].def);   // 只传 def，遭遇由 openBattleCell 组建
  expect(st.battle.mock.calls[0][1]).toBeUndefined();
  expect(st.encounter).not.toHaveBeenCalled();
  expect(st.acts.nodeBattleEnter).toBeUndefined();  // 确认页按钮不再注册
  expect(st.acts.nodeDecisionLeave).toBeUndefined();
  expect(st.game.state).toBe('modal');              // 战斗接管前锁住地图
});
it('宝箱必须确认搜索；返回不发奖励，双击搜索只打开一次', () => {
  st.layer.logical[0].def.type = 'chest';
  reenter(); expect(st.chests).not.toHaveBeenCalled();
  st.acts.nodeDecisionLeave();
  reenter(); const search = st.acts.nodeChestSearch;
  search(); search();
  expect(st.chests).toHaveBeenCalledTimes(1);
  expect(st.chests.mock.lastCall[2]).toMatchObject({ resourceOnly:true, consumeNode:true });
});
it('点击实际入口才派发补给页，旧档与旁边节点不合成补给', () => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['a'], taken:[] };
  reenter(); expect(st.supply).toHaveBeenCalledTimes(1);
  st.game.entrySupply = null; st.game.state = 'idle';
  reenter(); expect(st.supply).toHaveBeenCalledTimes(1);
  expect(st.enter).toHaveBeenCalledExactlyOnceWith('battle', expect.any(Function));
  expect(st.battle).toHaveBeenCalledTimes(1);   // 补给领完后经通用过场开战，不再弹确认页
});
it('入口全收/收益已消耗的终点直接收尾，不重开收益也不弹安全页', () => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['a'], taken:[0] };
  st.game.visited['0,0'] = 1;
  reenter();
  expect(st.supply).not.toHaveBeenCalled();
  expect(st.encounter).not.toHaveBeenCalled();
  expect(st.battle).not.toHaveBeenCalled();
  expect(st.safe).not.toHaveBeenCalled();   // 空白安全提示页已移除
  expect(st.game.state).toBe('idle');       // 直接收尾，留在地图
});
