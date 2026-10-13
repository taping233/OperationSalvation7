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
  grantEventCard:vi.fn(), openBlankSafePage:st.safe, openPickupPage:vi.fn(), openPocketRestore:vi.fn(), openShop:vi.fn(), preloadCellScene:vi.fn(),
}));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openEntrySupply:st.supply, openDoorModal:vi.fn(), openFireRest:vi.fn(), openAltarRitual:vi.fn(), openBossGate:vi.fn(), openEmergencyModal:vi.fn() }));
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
it('落脚接敌不抽遭遇；返回可重入，确认一次才抽怪与开战，旧回调失效', () => {
  reenter();
  expect(st.encounter).not.toHaveBeenCalled();
  const abandoned = st.acts.nodeBattleEnter;
  st.acts.nodeDecisionLeave();
  reenter(); abandoned();
  expect(st.encounter).not.toHaveBeenCalled();
  const enter = st.acts.nodeBattleEnter;
  enter(); enter();
  expect(st.encounter).toHaveBeenCalledTimes(1);
  expect(st.battle).toHaveBeenCalledTimes(1);
  expect(st.enter).not.toHaveBeenCalled();
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
  expect(st.acts.nodeBattleEnter).toBeTypeOf('function');
});
it('入口全收/收益已消耗的终点显示安全页，不重开收益', () => {
  st.game.entrySupply = { version:1, layerIdx:0, trackPos:0, cardIds:['a'], taken:[0] };
  st.game.visited['0,0'] = 1;
  reenter();
  expect(st.supply).not.toHaveBeenCalled();
  expect(st.encounter).not.toHaveBeenCalled();
  expect(st.safe).toHaveBeenCalledTimes(1);
});
