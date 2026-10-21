import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 10, battleHandMax: 99, starterSha: 0, battleStartDraw: 5, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const { requiresInfusion, missingInfusionReason } = await import('../game/src/battle/effects/battle.infusion.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

async function drain() {
  for (let i = 0; i < 400; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  throw new Error('免注能出牌队列未结束');
}

afterEach(async () => {
  vi.restoreAllMocks();
  BattleSession.commands.flee();
  await drain();
});

const cardById = id => Cards.all().find(card => card.id === id);
async function start(card, extra = [Cards.SHA, Cards.SHA], storedEntries = []) {
  const game = {
    ownedCards: [...[card, ...extra].map((card, i) => ({ uid: `u${i}`, card })), ...storedEntries],
    hp: 20, maxHp: 50, atk: 0, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log: vi.fn(),
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'foe', name: '靶子', hp: 999, atk: 1 }], { isBoss: false });
  await drain(); return game;
}
const resources = () => ({ hand: [...runtime.hand], energy: runtime.energy, discard: [...runtime.discard],
  consumed: [...runtime.consumed], grave: [...runtime.grave], infuseFuels: runtime.infuseFuels });

describe('required infusion is validated before every payment and direct-play entry', () => {
  it.each(['tt12-raydragon', 'tt12-felguard', 'tt7-holyheal', 'tt7-meteorstrong'])(
    '%s rejects uninfused manual, direct, free and queue entries without spending', async id => {
      const card = cardById(id); expect(requiresInfusion(card)).toBe(true);
      const game = await start(card);
      const before = resources();
      expect(BattleSession.commands.getCardPlayAvailability('u0', 'self', true).reason.code).toBe('INFUSION_REQUIRED');
      expect(BattleSession.commands.submitCardPlay('u0', 0, true).reason.code).toBe('INFUSION_REQUIRED');
      BattleSession.commands.playDirect('u0');
      E.queueCardExecution('u0', card, [], runtime.foes[0], true);
      await drain();
      expect(resources()).toEqual(before);
      expect(game.log.mock.calls.flat().join(' ')).toContain('需要先注能');
      expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
    });

  it('zero available materials cannot start or bypass required infusion', async () => {
    await start(cardById('tt12-raydragon'), []);
    const before = resources();
    expect(BattleSession.commands.getCardPlayAvailability('u0').reason.code).toBe('INFUSION_MATERIALS');
    BattleSession.commands.playCard('u0'); BattleSession.commands.playDirect('u0');
    await drain(); expect(resources()).toEqual(before);
  });

  it('direct button command retains selected materials; cancel spends nothing; valid infusion spends once', async () => {
    await start(cardById('tt12-raydragon'));
    const before = resources();
    BattleSession.commands.beginInfusion('u0'); BattleSession.commands.selectInfusion('u1');
    BattleSession.commands.playDirect('u0');
    expect(BattleSession.getSnapshot().infusing.picked).toEqual(['u1']);
    expect(resources()).toEqual(before);
    BattleSession.commands.cancelInfusion(); expect(resources()).toEqual(before);
    BattleSession.commands.beginInfusion('u0'); BattleSession.commands.selectInfusion('u1');
    BattleSession.commands.confirmInfusion(); await drain();
    expect(runtime.foes[0].hp).toBe(988);
    expect(runtime.hand).toEqual(['u2']); expect(runtime.energy).toBe(before.energy - 2);
    expect(runtime.infuseFuels).toBe(1);
  });

  it.each(['tt3sp-silverthorn', 'tt3sp-bloodstorm'])('%s retains its uninfused base effect', async id => {
    const card = cardById(id); expect(requiresInfusion(card)).toBe(false);
    await start(card);
    BattleSession.commands.playCard('u0', 0, true); await drain();
    expect(runtime.hand).not.toContain('u0'); expect(runtime.infuseFuels).toBe(0);
    expect(runtime.foes[0].hp).toBeLessThan(999);
  });

  it('does not reject a base-effect card just because the target is immune', async () => {
    await start(cardById('tt3sp-silverthorn'));
    runtime.foes[0].status.immune = 1;
    expect(BattleSession.commands.getCardPlayAvailability('u0', 0, true).status).toBe('ready');
    BattleSession.commands.playCard('u0', 0, true); await drain();
    expect(runtime.hand).not.toContain('u0'); expect(runtime.foes[0].hp).toBe(999);
  });

  it.each(['instance', 'global'])('%s infusion waiver still permits pure infusion', async kind => {
    const card = { ...cardById('tt12-raydragon'), ...(kind === 'instance' ? { _noInfuse: true } : {}) };
    await start(card, []); runtime.set$allSpellsInfused(kind === 'global');
    BattleSession.commands.playCard('u0', 0); await drain();
    expect(runtime.foes[0].hp).toBe(988); expect(runtime.hand).toEqual([]);
    expect(runtime.infuseFuels).toBe(0);
  });

  it('explicit pouch release grants infusion, consumes only its stored source and spends no fuel', async () => {
    const dragon = { ...cardById('tt12-raydragon'), pouchUid: 'stored-dragon' };
    const pouch = { id: 'pouch-test', name: '锦囊', type: '装备', cost: 0, desc: '', _pouch: [dragon] };
    const storedSource = { uid: 'stored-dragon', card: dragon, pouchOf: pouch.id };
    const game = await start(pouch, [Cards.SHA], [storedSource]);
    const before = resources();
    expect(before.hand).not.toContain(storedSource.uid);
    expect(game.ownedCards).toContain(storedSource);
    runtime.set$discovering({ options: [dragon], n: 1, act: 'pouch', pouchUid: 'u0', pred: null });
    BattleSession.commands.pickDiscover(0); await drain();
    expect(runtime.foes[0].hp).toBe(988);
    expect(resources()).toEqual(before);
    expect(pouch._pouch).toEqual([]);
    expect(game.ownedCards.map(entry => entry.uid)).toEqual(['u0', 'u1']);
    expect(game.ownedCards[0].card).toBe(pouch);
    expect(game.ownedCards[1].card).toBe(Cards.SHA);
    expect(runtime.discovering).toBeNull();
    const consumed = BattleSession.getSnapshot().consumedPile;
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).not.toBe(storedSource.uid);
    expect(E.findCard(consumed[0])?.card.id).toBe(dragon.id);
    expect(game.log.mock.calls.flat().join(' ')).toContain('视为已注能，不消耗注能材料');
  });

  it('rechecks required infusion after queue acceptance before touching resources', async () => {
    const card = { id: 'late-gate', name: '可变旧卡', type: '法术', cost: 1, desc: '回复7点生命', heal: 7 };
    await start(card); const before = resources(); let queued;
    const { createBattleExecPlay } = await import('../game/src/battle/core/battle.exec-play.js');
    const flow = createBattleExecPlay({ queueBattleAction: action => { queued = action; }, requestBattleRender() {},
      findCard: E.findCard, effCostOf: E.effCostOf });
    flow.queueCardExecution('u0', card, [], null, true);
    card.desc = '注能（1）：回复7点生命'; card.infuse = 1;
    await queued(new AbortController().signal);
    expect(resources()).toEqual(before);
  });

  it('uses hosted rules despite edited descriptions, and preserves independent structured or legacy effects', () => {
    expect(requiresInfusion({ ...cardById('tt12-raydragon'), desc: '造成11点伤害' })).toBe(true);
    expect(requiresInfusion({ ...cardById('tt3sp-silverthorn'), desc: '注能（1）：造成11点伤害' })).toBe(false);
    const pure = { name: '旧卡', type: '法术', infuse: 1, desc: '注能（1）：回复7点生命', heal: 7 };
    expect(requiresInfusion(pure)).toBe(true);
    expect(requiresInfusion({ ...pure, desc: `${pure.desc}；抽1张牌` })).toBe(false);
    expect(requiresInfusion({ ...pure, rules: { triggers: { onPlay: [{ op: 'heal', amount: 7 }] } } })).toBe(false);
    expect(requiresInfusion({ ...pure, type: '装备' })).toBe(false);
    expect(missingInfusionReason({ ...pure, _noInfuse: true })).toBe('');
    expect(missingInfusionReason({ ...pure, rules: { battle: { requirements: [{ kind: 'infused' }] } } }, 0, true)).toBe('');
  });
});
