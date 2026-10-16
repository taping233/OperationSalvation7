import { beforeEach, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ game:{}, saves:[], capacity:0 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:st.game, MAP:{ rules:{} }, MODES:{}, bagCap:() => st.capacity, usedSlots:() => st.game.ownedCards.length,
  newUid:() => `restore-${st.game.ownedCards.length}`, pick:items => items[0], scaledEnemy:card => card,
  curLayer:() => ({ logical:[{ def:{ type:'altar' } }] }), enterLayer:vi.fn(), getActiveSlot:() => null,
  saveGame:() => { st.saves.push(JSON.parse(JSON.stringify(st.game))); return true; },
}));
vi.mock('../game/src/core/characters.js', () => ({ characterFor:() => null, characterName:() => '' }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub:vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{ tick:vi.fn(), ding:vi.fn() }, _set_cardPageOpen:vi.fn(), cardHTML:c => c.name }));
vi.mock('../game/src/battle/battle-loader.js', () => ({
  startBattle:vi.fn(), captureBattleContext:game => { const token = game.discoveredPairs; return () => token === game.discoveredPairs; },
}));
vi.mock('../game/src/run/game.run.data.js', () => ({
  IMMEDIATE_SCENES:new Set(), NODE_BG:{ altar:'scene-altar-bg' }, PICKUP_BG:{}, PRELOAD_SCENES:[], SCENES:{},
}));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage:{} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun:vi.fn(), readSettlementReceipt:vi.fn(), recoverSlot:vi.fn() }));
vi.mock('../game/src/ui/expedition-feedback.js', () => ({ installExpeditionFeedback:vi.fn() }));

let acts, UI;
const move = { id:'move-a', name:'复原招式', type:'武术', desc:'一张可复原的招式' };
const readSnapshot = () => {
  const saved = structuredClone(st.saves.at(-1));
  Object.assign(st.game, saved, { discoveredPairs:new Set() });
};

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="restore-test"></div>';
  acts = {}; st.capacity = 0; st.saves = [];
  Object.assign(st.game, {
    layerIdx:3, trackPos:0, seed:8, state:'idle', hp:12, maxHp:30, myClass:'武', visited:{ '3,0':1 },
    altarActivated:true, altarRewardPending:true, altarItemSacrificed:false, nodeRewards:{},
    ownedCards:[], usedPocket:[{ card:move, count:4 }], discoveredPairs:new Set(), layerData:[],
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    canReceiveCard:() => st.game.ownedCards.length < st.capacity,
    usedSlots:() => st.game.ownedCards.length, bagCap:() => st.capacity,
  });
  UI = {
    el:{ ovBody:document.getElementById('restore-test') },
    showOverlay:(_title, html) => { UI.el.ovBody.innerHTML = html; },
    hideOverlay:() => { UI.el.ovBody.innerHTML = ''; }, act:(act, fn) => { acts[act] = fn; },
    refresh:vi.fn(), log:vi.fn(), showCardReward:vi.fn(),
  };
  window.SDT = { UI, Sound:{ sfx:vi.fn(), scene:vi.fn() }, Icons:{ rich:x => x },
    Cards:{ all:() => [move], cardHTML:c => c.name, isRandomObtainable:() => true },
    Meta:{ addXpToProgress:vi.fn() }, Base:{ isSha:() => false, bagCap:() => st.capacity },
  };
});

it('祭坛复原：满包返回地图，读档与部分领取后再次读档均保留剩余次数且只回血一次', async () => {
  const { openAltarRitual, resumeNodeRestore } = await import('../game/src/run/game.run.altar.js');
  const { isConsumedMapNode } = await import('../game/src/core/map-node-state.js');
  const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
  openAltarRitual(); acts.altarRewardRestore();
  const record = st.game.nodeRewards['3,0'];
  expect(record).toMatchObject({ source:'altar-reward', total:3, left:3, hpGain:10, finished:false });
  expect(st.game.hp).toBe(22); expect(st.game.altarRewardPending).toBe(false);
  acts.restoreOne({ name:move.name });
  expect(record.left).toBe(3); expect(st.game.usedPocket[0].count).toBe(4);
  expect(document.querySelector('[data-act="restoreReturn"]')).not.toBeNull();
  acts.restoreReturn();
  expect(st.game.state).toBe('idle');
  expect(isConsumedMapNode(st.game, { li:3, idx:0, def:{ type:'altar' } })).toBe(false);
  expect(validateRunSave(st.saves.at(-1)).ok).toBe(true);
  readSnapshot(); st.capacity = 10;
  expect(resumeNodeRestore()).toBe(true);
  const stale = acts.restoreOne;
  acts.restoreOne({ name:move.name }); stale({ name:move.name });
  expect(st.game.nodeRewards['3,0'].left).toBe(2);
  expect(st.game.ownedCards).toHaveLength(1);
  acts.restoreReturn(); readSnapshot();
  expect(resumeNodeRestore()).toBe(true);
  expect(document.body.textContent).toContain('还可复原 2 张');
  acts.restoreOne({ name:move.name }); acts.restoreOne({ name:move.name });
  expect(st.game.ownedCards).toHaveLength(3); expect(st.game.usedPocket[0].count).toBe(1);
  expect(st.game.hp).toBe(22); expect(st.game.nodeRewards['3,0'].finished).toBe(true);
  expect(st.game.state).toBe('idle'); expect(resumeNodeRestore()).toBe(false);
  expect(isConsumedMapNode(st.game, { li:3, idx:0, def:{ type:'altar' } })).toBe(true);
});

it('道具献祭：确认只扣一次，满包暂离并读档后保留两次同名卡复原，完成后仍可激活祭坛', async () => {
  st.game.altarActivated = false; st.game.altarRewardPending = false;
  st.game.ownedCards = [{ uid:'offering', card:{ id:'potion', name:'献祭药水', type:'道具' } }];
  const { openAltarRitual, resumeNodeRestore } = await import('../game/src/run/game.run.altar.js');
  openAltarRitual(); acts.altarItemRestore(); acts.sacPick({ uid:'offering' });
  const confirm = acts.sacConfirm; confirm(); confirm();
  expect(st.game.ownedCards).toHaveLength(0);
  expect(st.game.altarItemSacrificed).toBe(true);
  expect(st.game.nodeRewards['3,0']).toMatchObject({ source:'altar-offering', total:2, left:2, hpGain:0 });
  acts.restoreReturn(); readSnapshot(); st.capacity = 10;
  expect(resumeNodeRestore()).toBe(true);
  acts.restoreOne({ name:move.name }); acts.restoreReturn(); readSnapshot();
  expect(resumeNodeRestore()).toBe(true); acts.restoreOne({ name:move.name });
  expect(st.game.hp).toBe(12); expect(st.game.ownedCards).toHaveLength(2);
  expect(st.game.nodeRewards['3,0']).toMatchObject({ left:0, finished:true, restoredIds:[move.id, move.id] });
  expect(document.querySelector('[data-act="altarOn3"]')).not.toBeNull();
  expect(document.querySelector('[data-act="altarItemUsed"]')).not.toBeNull();
});
