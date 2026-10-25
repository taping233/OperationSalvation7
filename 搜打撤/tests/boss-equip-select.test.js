import { battleRules } from './helpers/environment-fixtures.js';
/* BOSS 编组：开战装备勾选制 + 编组门槛（2026-09-10 留言 #34/#35）。
 * 覆盖：开战装备单列且默认不勾选（混沌之眼不再"没选也生效"）；
 * 勾选混沌之眼后牌库上限 +5、开战被动生效；可编卡不足时按实际可编数放行。 */
import { createBattleGameFactory, drainBattle } from './helpers/battle-fixtures.js';
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { ...battleRules(99, 99, 3, 0, 2, 2) },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});


const makeGame = createBattleGameFactory();
const foeDef = () => ({ id: 'infantry', name: '编组靶子', hp: 99999, atk: 1 });
const snap = () => BattleSession.getSnapshot();
const drain = (maxLoops = 200) => drainBattle(BattleSession, maxLoops);
function fillDeck(pool, selected) {
  const need = Math.min(snap().deckSelection.need, snap().deckSelection.cards.length);
  while (snap().deckSelection && snap().deckSelection.selected.length < need) {
    const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
    if (!next) break;
    BattleSession.commands.selectDeckCard(next.uid);
    selected.push(next.uid);
  }
}
const eye = () => C.all().find(c => c.id === 'tt3-chaos-eye' && /对战开始时/.test(String(c.desc || '')));
const filler = () => C.all().find(c => c.name === '初始化斩击' && c.type === '武术')
  || C.all().find(c => c.type === '武术' && !c.unrandom && c.rarity !== '初始' && c.rarity !== '职业');

describe('BOSS 编组 · 开战装备勾选（2026-09-10 #35）', () => {
  it('开战装备并入套牌：骷髅王剑/混沌之眼计入15张（2026-09-16 定版）', async () => {
    const e = eye();
    const f = filler();
    const g = makeGame([e, f, f].filter(Boolean));
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '并入套牌测试' });
    const ds = snap().deckSelection;
    expect(ds).toBeTruthy();
    // 开战装备已并入套牌选择池——骷髅王剑/混沌之眼等不再单独勾选
    const eyeInPool = ds.cards.some(x => x.card.id === 'tt3-chaos-eye');
    expect(eyeInPool, '混沌之眼应在可选池中').toBe(true);
    fillDeck(ds.cards, []);
    BattleSession.commands.confirmDeck();
    await drain();
    expect(snap().deckSelection).toBeFalsy();
    BattleSession.commands.flee();
    await drain(20);
  });

  it('混沌之眼在套牌中：牌库上限 +5、开战被动生效', async () => {
    const e = eye();
    const f = filler();
    const g = makeGame([e, f, f].filter(Boolean));
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '上限测试' });
    const ds = snap().deckSelection;
    expect(ds).toBeTruthy();
    fillDeck(ds.cards, []);
    BattleSession.commands.confirmDeck();
    await drain();
    expect(g.logs.some(l => l.includes('开战被动') && l.includes('混沌之眼'))).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });

    it('可编卡牌不足 15 张时按实际可编数放行（2026-09-10 #34）', async () => {
    const g = makeGame([filler(), filler()]);
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '不足15测试' });
    const ds = snap().deckSelection;
    expect(ds).toBeTruthy();
    fillDeck(ds.cards, []);
    expect(snap().deckSelection.selected.length).toBe(Math.min(3, ds.cards.length));
    BattleSession.commands.confirmDeck();
    await drain();
    expect(snap().deckSelection).toBeFalsy();              // 不再永久卡在编组界面
    BattleSession.commands.flee();
    await drain(20);
  });
});


// FB040: exercise the real deck/lifecycle and the start-passive entry independently.
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { createBattleEquipment } = await import('../game/src/battle/bag/battle.equipment.js');
const talisman = () => C.all().find(c => c.id === 'tt7-talisman');

describe('灵符自动装配消耗', () => {
  it('选入BOSS套牌后消耗，离开可用牌区，战后传出一次消耗UID', async () => {
    const g = makeGame([talisman(), eye(), filler()]);
    let ended;
    g.onBattleEnd = (...args) => { ended = args; };
    const uid = g.ownedCards[0].uid;
    const eyeUid = g.ownedCards[1].uid;
    BattleSession.start(g, [foeDef()], { isBoss: true });
    fillDeck(snap().deckSelection.cards, []);
    BattleSession.commands.confirmDeck();
    await drain();
    const consumed = [...runtime.consumed];
    const grave = [...runtime.grave];
    const available = [...runtime.hand, ...runtime.drawPile, ...runtime.discard];
    BattleSession.commands.flee();
    await drain(20);
    expect(consumed).toEqual([uid, eyeUid]);
    expect(grave).toContain(uid);
    expect(available).not.toContain(uid);
    expect(grave).toContain(eyeUid);
    expect(available).not.toContain(eyeUid);
    expect(ended[3]).toEqual([uid, eyeUid]);
  });

  it.each([false, true])('普通战或未选入BOSS时不消耗（BOSS=%s）', async isBoss => {
    const g = makeGame([talisman(), filler(), filler(), filler()]);
    const uid = g.ownedCards[0].uid;
    BattleSession.start(g, [foeDef()], { isBoss });
    if (isBoss) {
      for (const card of snap().deckSelection.cards.filter(o => o.uid !== uid).slice(0, 3)) {
        BattleSession.commands.selectDeckCard(card.uid);
      }
      BattleSession.commands.confirmDeck();
    }
    await drain();
    const consumed = [...runtime.consumed];
    const equipped = [...runtime.equipped];
    BattleSession.commands.flee();
    await drain(20);
    expect(consumed).not.toContain(uid);
    expect(equipped.some(o => o.uid === uid)).toBe(false);
  });

  it('同一UID只触发一次，重复调用不追加墓地；旧无UID不产生消耗记录', () => {
    const card = talisman();
    let draws = 0;
    const api = createBattleEquipment({ triggersM2: { resolveEquipOps() { draws++; } } });
    runtime.set$G(makeGame([card]));
    runtime.set$mode('boss');
    const uid = runtime.G.ownedCards[0].uid;
    runtime.set$sel(new Set([uid]));
    runtime.set$equipped([]);
    runtime.set$consumed([]);
    runtime.set$grave([]);
    runtime.set$hand([uid, 'other']);
    runtime.set$drawPile([uid]);
    runtime.set$discard([uid, uid]);
    api.applyBattleStartPassives();
    api.applyBattleStartPassives();
    expect(draws).toBe(1);
    expect(runtime.consumed).toEqual([uid]);
    expect(runtime.grave).toEqual([uid]);
    expect(runtime.hand).toEqual(['other']);
    expect(runtime.drawPile).toEqual([]);
    expect(runtime.discard).toEqual([]);
    runtime.set$G({ ownedCards: [{ card }], log() {} });
    runtime.set$sel(new Set([undefined]));
    runtime.set$equipped([]);
    runtime.set$consumed([]);
    runtime.set$grave([]);
    api.applyBattleStartPassives();
    expect(runtime.consumed).toEqual([]);
    expect(runtime.grave).toEqual([]);
  });
});

it('开战装备超容量时手选拒绝第三件，最低编组数仍可满足', async () => {
  runtime.set$lastDeckSel([]);
  const g = makeGame([talisman(), eye(), talisman()]);
  BattleSession.start(g, [foeDef()], { isBoss: true });
  expect(snap().deckSelection.need).toBe(2);
  for (const entry of g.ownedCards) BattleSession.commands.selectDeckCard(entry.uid);
  expect(snap().deckSelection.selected).toHaveLength(2);
  BattleSession.commands.confirmDeck(); await drain();
  expect(snap().deckSelection).toBeFalsy();
  expect(runtime.equipped).toHaveLength(2);
  expect(runtime.consumed).toEqual(g.ownedCards.slice(0, 2).map(entry => entry.uid));
  BattleSession.commands.flee(); await drain(20);
});

it('直入自动编组跳过超容量开战装备，继续补入后续合法牌', async () => {
  runtime.set$lastDeckSel([]);
  const g = makeGame([talisman(), eye(), talisman(), filler()]);
  BattleSession.start(g, [foeDef()], { isBoss: true, directBossStart: true });
  await drain();
  expect(snap().deckSelection).toBeFalsy();
  expect(runtime.equipped).toHaveLength(2);
  expect(runtime.sel.has(g.ownedCards[2].uid)).toBe(false);
  expect(runtime.sel.has(g.ownedCards[3].uid)).toBe(true);
  BattleSession.commands.flee(); await drain(20);
});

it('开战效果执行前所有装配UID已退出全部可用牌区，容量外装备不消费', () => {
  const g = makeGame([talisman(), talisman(), talisman()]);
  const ids = g.ownedCards.map(entry => entry.uid);
  runtime.set$G(g); runtime.set$mode('boss'); runtime.set$sel(new Set(ids));
  runtime.set$equipped([]); runtime.set$consumed([]); runtime.set$grave([]);
  runtime.set$hand([...ids]); runtime.set$drawPile([...ids]); runtime.set$discard([...ids]);
  let effects = 0;
  const api = createBattleEquipment({ triggersM2: { resolveEquipOps() {
    effects++;
    expect(runtime.consumed).toEqual(ids.slice(0, 2));
    for (const pile of [runtime.hand, runtime.drawPile, runtime.discard]) expect(pile).toEqual([ids[2]]);
  } } });
  api.applyBattleStartPassives(); api.applyBattleStartPassives();
  expect(effects).toBe(2); expect(runtime.equipped).toHaveLength(2);
  expect(runtime.consumed).toEqual(ids.slice(0, 2));
});

it('合法容量内的不足额BOSS编组重开后仍能开始战斗', async () => {
  runtime.set$lastDeckSel([]);
  const g = makeGame([talisman(), eye(), talisman()]);
  BattleSession.start(g, [foeDef()], { isBoss: true });
  for (const entry of g.ownedCards.slice(0, 2)) BattleSession.commands.selectDeckCard(entry.uid);
  BattleSession.commands.confirmDeck(); await drain();
  const saved = BattleSession.serialize();
  expect(BattleSession.restore(g, saved)).toBe(true); await drain();
  expect(snap().deckSelection).toBeFalsy();
  expect(runtime.equipped).toHaveLength(2);
  expect(runtime.consumed).toEqual(g.ownedCards.slice(0, 2).map(entry => entry.uid));
  BattleSession.commands.flee(); await drain(20);
});
