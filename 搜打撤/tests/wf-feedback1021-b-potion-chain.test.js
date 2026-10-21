// 反馈12条·B组（6/9）：战斗道具/药水使用链路探针——药水栏结算必须真正落到引擎效果。
import { expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({ game: s.game, getActiveSlot: () => null, saveGame: () => true, createRunSavePayload: () => ({}), setBattleSettlementPending() {}, clearBattleSettlementPending() {}, doDeath() {} }));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: async () => {} }));
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} }, UI: { log() {}, hideOverlay() {}, refresh() {}, act() {}, showOverlay() {} }, MAP: { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} }, Meta: { track() {} }, Base: { data: { ammoTaught: true }, recordEggBattle() {}, save() {} }, Chests: { rollDrops: () => [], dropText: () => '', open() {} }, Battle: { presentVictory: async () => {} } };

await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, getSnapshot } = await import('../game/src/battle/core/battle.core.js');
const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
bagSlots.pocketAdd = card => { const p = s.game.usedPocket.find(p => p.card.name === card.name); if (p) p.count++; else s.game.usedPocket.push({ card: { ...card }, count: 1 }); };
const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
bindBagMixins();

function setup(foes) {
  vi.useFakeTimers();
  Object.assign(s.game, {
    ownedCards: [], usedPocket: [], hp: 30, maxHp: 100, atk: 5, coins: 0, spellPower: 0,
    myClass: '战士', state: 'idle', battleActive: false, seed: 'b-probe',
    discoveredPairs: new Set(), visited: {}, layerIdx: 0, trackPos: 1,
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
  });
  BattleSession.start(s.game, foes, { isBoss: false });
}
function give(id) {
  const tpl = C.all().find(c => c.id === id);
  expect(tpl, `card ${id} exists`).toBeTruthy();
  const uid = `probe-${id}`;
  s.game.ownedCards.push({ uid, card: { ...tpl } });
  return uid;
}
async function settle() { await vi.advanceTimersByTimeAsync(2000); }

it('药水栏快照暴露战斗道具且默认可用', async () => {
  try {
    setup([{ id: 'a', name: '甲', hp: 20, atk: 5 }, { id: 'b', name: '乙', hp: 20, atk: 5 }]);
    give('tt3sp-doom'); give('tt3-blue-potion'); give('tt3-iceheart-potion');
    const snap = getSnapshot();
    expect(snap.potionBar.map(p => p.name)).toEqual(expect.arrayContaining(['TNT', '恢复药水', '冰冻药水']));
    expect(snap.potionBar.every(p => p.usable !== false)).toBe(true);
    expect(snap.potionBar.find(p => p.name === '冰冻药水').aim).toBe('enemy');
    expect(snap.potionBar.find(p => p.name === 'TNT').aim).toBe(null);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it('TNT 结算：消灭 2 名攻≤5 非 BOSS 敌人', async () => {
  try {
    setup([{ id: 'a', name: '甲', hp: 20, atk: 5 }, { id: 'b', name: '乙', hp: 20, atk: 5 }, { id: 'c', name: '丙', hp: 20, atk: 5 }]);
    const uid = give('tt3sp-doom');
    BattleSession.commands.usePotion(uid);
    await settle();
    const foes = getSnapshot().foes;
    expect(foes.filter(f => f.dead).length).toBe(2);
    expect(s.game.ownedCards.some(o => o.uid === uid)).toBe(false);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it('单体回复药水直接结算', async () => {
  try {
    setup([{ id: 'a', name: '甲', hp: 20, atk: 5 }]);
    s.game.hp = 10;
    const uid = give('tt3-blue-potion');
    BattleSession.commands.usePotion(uid);
    await settle();
    expect(s.game.hp).toBeGreaterThan(10);
    expect(s.game.ownedCards.some(o => o.uid === uid)).toBe(false);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it('多敌时敌方指向药水进入点选，可由 useItem 带目标结算', async () => {
  try {
    setup([{ id: 'a', name: '甲', hp: 20, atk: 5 }, { id: 'b', name: '乙', hp: 20, atk: 5 }]);
    const uid = give('tt3-iceheart-potion');
    BattleSession.commands.usePotion(uid);
    await settle();
    const snap = getSnapshot();
    expect(snap.pendingItem && snap.pendingItem.uid).toBe(uid);
    BattleSession.commands.useItem(uid, 0);
    await settle();
    expect(getSnapshot().foes[0].status.freeze || 0).toBeGreaterThan(0);
    expect(s.game.ownedCards.some(o => o.uid === uid)).toBe(false);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

// 分叉点记录 + 回归守卫：进点选（引擎 usePotion/bag）的唯一判据是 itemTargetSideFor，
// 它对只有 rules.bag.use 的药水（冰冻/流血）返回 enemy，而 targetSideFor 返回 null。
// 视图曾拿 targetSide 判道具点选高亮 → 一个敌人都不亮、点选收不了口（反馈1021·6/9）。
it('道具点选高亮判据与引擎进点选同源', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const read = file => readFileSync(resolve(process.cwd(), 'game/src/battle/view', file), 'utf8');
  expect(read('battle.aim.js')).toContain('itemTargetSideFor(snapshot.pendingItem.card)');
  expect(read('battle.layers.js')).toContain('itemTargetSideFor(ctx.pendingItem.card)');
  const { targetSide } = await import('../game/src/battle/core/battle.core.js');
  const { itemTargetSideFor } = await import('../game/src/battle/effects/battle.target-rules.js');
  const card = { ...C.all().find(entry => entry.id === 'tt3-iceheart-potion') };
  expect(itemTargetSideFor(card), '引擎进点选').toBe('enemy');
  expect(targetSide(card), '视图不得依赖的旧判据').not.toBe('enemy');
});
