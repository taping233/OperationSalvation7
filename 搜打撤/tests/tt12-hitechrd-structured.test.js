import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { decayEffectiveCardCost } from '../game/src/battle/battle.card-cost.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 20, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};

await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/battle.core.js');
const Cards = window.SDT.Cards;
const DISCOVER_RULES_KEY = 'sdt-cards-tt12-discover-v1-seeded';
let originalCards = null;
let originalDiscoverMarker = null;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
  originalDiscoverMarker = localStorage.getItem(DISCOVER_RULES_KEY);
  Cards.ensureTT12DiscoverRules();
  originalCards = JSON.parse(JSON.stringify(Cards.all()));
});

let activeGame = null;

function makeGame(desc = '改写后的发现说明') {
  const canonical = Cards.all().find(card => card.id === 'tt12-hitechrd');
  if (!canonical) throw new Error('现役卡库应包含 tt12-hitechrd');
  const logs = [];
  const game = {
    ownedCards: [{ uid: 'hitech-structured-research', card: { ...canonical, desc }, safe: false }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  return game;
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(resolve => setTimeout(resolve, ms));   // 空闲确认用真实延时（根治负载 flake）
async function drain(timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const state = BattleSession.getSnapshot();
    if (state.discovering) return state;
    if (state.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (state.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
    await tick();
  }
  throw new Error('TT12 结构化费用迁移战斗未在时限内收敛');
}

async function selectFirstTwoCostMove(researchUid) {
  BattleSession.commands.playCard(researchUid, null);
  let state = await drain();
  expect(state.discovering, '改写描述后仍应进入结构化发现').toBeTruthy();
  const options = state.discovering.options || [];
  expect(options.length).toBeGreaterThan(0);
  expect(options.every(card => card.type === '武术' && Number(card.cost) === 2)).toBe(true);
  const selected = options[0];
  BattleSession.commands.pickDiscover(0);
  state = await drain();
  const acquiredUid = state.hand.find(uid => uid !== researchUid);
  expect(acquiredUid).toBeTruthy();
  expect(viewApi.findCard(acquiredUid).card.id).toBe(selected.id);
  expect(viewApi.effCostOf(viewApi.findCard(acquiredUid).card, acquiredUid)).toBe(2);
  return { state, acquiredUid, libraryCard: Cards.all().find(card => card.id === selected.id) };
}

async function endTurn() {
  BattleSession.commands.endTurn();
  return drain();
}

async function finishBattle() {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await drain();
  }
  activeGame = null;
}

afterEach(async () => finishBattle());
afterAll(() => {
  if (originalCards) Cards.saveAll(originalCards);
  if (originalDiscoverMarker == null) localStorage.removeItem(DISCOVER_RULES_KEY);
  else localStorage.setItem(DISCOVER_RULES_KEY, originalDiscoverMarker);
});

describe('tt12-hitechrd canonical rule and old-save backfill', () => {
  it('uses the finalized card rule and backfills a legacy copy by stable id without changing its desc', () => {
    const definition = Cards.TABLETOP12.find(card => card.id === 'tt12-hitechrd');
    const activeCard = Cards.all().find(card => card.id === 'tt12-hitechrd');
    expect(activeCard.rules).toEqual(definition.rules);
    expect(validateCardRules(activeCard)).toMatchObject({ ok: true, errors: [], pending: [] });

    const legacyDesc = '玩家改写的旧档描述';
    const legacyCards = Cards.all().map(card => {
      if (card.id !== 'tt12-hitechrd') return card;
      // eslint-disable-next-line no-unused-vars -- 局部豁免：rest 省略惯用法，剥离 rules 构造旧档缺 rules 的语义（后文断言 ensureTT12DiscoverRules 迁移回填），删绑定会破坏测试
      const { rules, ...legacyCard } = card;
      return { ...legacyCard, desc: legacyDesc };
    });
    expect(Cards.saveAll(legacyCards)).toBe(true);
    localStorage.removeItem(DISCOVER_RULES_KEY);

    Cards.ensureTT12DiscoverRules();
    const migrated = Cards.all().find(card => card.id === 'tt12-hitechrd');
    expect(migrated.desc).toBe(legacyDesc);
    expect(migrated.rules).toEqual(definition.rules);
    expect(validateCardRules(migrated)).toMatchObject({ ok: true, errors: [], pending: [] });
  });
});

describe('tt12-hitechrd structured turn-start cost decay', () => {
  it('uses rules after desc rewrite, decays once per turn, and preserves checkpoint restart semantics', async () => {
    const game = makeGame('这段文案不再描述发现、招式或降费');
    activeGame = game;
    const foe = { id: 'hitech-structured-foe', name: '费用验收靶', hp: 99999, atk: 1, noFirstAttack: true };
    BattleSession.start(game, [foe], { isBoss: false, name: '结构化高端研发' });

    const { acquiredUid, libraryCard } = await selectFirstTwoCostMove('hitech-structured-research');
    let state = await endTurn();
    expect(state.turn).toBe(2);
    expect(viewApi.findCard(acquiredUid).card.cost).toBe(1);
    expect(viewApi.effCostOf(viewApi.findCard(acquiredUid).card, acquiredUid)).toBe(1);
    expect(libraryCard.cost).toBe(2);

    state = await endTurn();
    expect(state.turn).toBe(3);
    expect(viewApi.findCard(acquiredUid).card.cost).toBe(0);
    expect(viewApi.effCostOf(viewApi.findCard(acquiredUid).card, acquiredUid)).toBe(0);

    const checkpoint = BattleSession.serialize();
    expect(checkpoint.restartVersion).toBe(1);
    expect(checkpoint.run.ownedCards.map(entry => entry.uid)).toContain('hitech-structured-research');
    expect(checkpoint).not.toHaveProperty('delayed');
    expect(checkpoint).not.toHaveProperty('cardOverrides');
    expect(BattleSession.restore(game, checkpoint)).toBe(true);
    state = await drain();
    expect(state.turn).toBe(1);
    expect(state.hand).toContain('hitech-structured-research');
    expect(state.hand).not.toContain(acquiredUid);
    expect(libraryCard.cost).toBe(2);
  });

  it('applies the same discovered-card decay in a BOSS battle', async () => {
    const game = makeGame();
    activeGame = game;
    const boss = { id: 'hitech-structured-boss', name: 'BOSS 费用验收靶', hp: 99999, atk: 1, noFirstAttack: true };
    BattleSession.start(game, [boss], { isBoss: true, nest: true, name: '结构化高端研发 BOSS' });
    const { acquiredUid } = await selectFirstTwoCostMove('hitech-structured-research');

    const state = await endTurn();
    expect(state.turn).toBe(2);
    expect(viewApi.findCard(acquiredUid).card.cost).toBe(1);
    expect(viewApi.effCostOf(viewApi.findCard(acquiredUid).card, acquiredUid)).toBe(1);
  });
});

describe('discovered-card cost decay helper', () => {
  it('clamps at zero and leaves the canonical cost source untouched', () => {
    const canonical = { id: 'move-2', cost: 2 };
    const once = decayEffectiveCardCost(canonical, 1);
    const twice = decayEffectiveCardCost(once, 1);
    const noFurtherDecay = decayEffectiveCardCost(twice, 1);

    expect(once).toMatchObject({ cost: 1, _baseCost: 2 });
    expect(twice).toMatchObject({ cost: 0, _baseCost: 2 });
    expect(noFurtherDecay).toBe(twice);
    expect(canonical.cost).toBe(2);
  });
});
