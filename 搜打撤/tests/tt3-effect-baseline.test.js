import { beforeAll, describe, expect, it, vi } from 'vitest';
import { KEY as CARDS_KEY, TT10_KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 7, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const Cards = window.SDT.Cards;
const MIGRATION_KEY = 'sdt-cards-tt10-onplay-v1-seeded';

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

const byId = id => {
  const card = Cards.TABLETOP10.find(entry => entry.id === id);
  if (!card) throw new Error(`TABLETOP10 定版缺卡：${id}`);
  return card;
};
const foe = () => ({ id: 'tt3-baseline-foe', name: '旧行为基线靶', hp: 999, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function makeGame(card, uid, hp = 40) {
  const logs = [];
  const effectOrder = [];
  return {
    ownedCards: [{ uid, card, safe: false }],
    hp, maxHp: 50, atk: 5, spellPower: 0, coins: 0,
    myClass: '降临者', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    logs, effectOrder,
    log(message) {
      const line = String(message).replace(/\[\[[^\]]+\]\]/g, '');
      logs.push(line);
      if (line.includes('获得 3 点护甲') || line.includes('获得 5 点护甲')) effectOrder.push('armor');
      if (line.includes('获得 1 张【初始攻击】') || line.includes('抽了 1 张牌')) effectOrder.push('draw');
    },
    heal(amount) { effectOrder.push('heal'); this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
}

async function drain() {
  for (let i = 0; i < 400; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (state.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (state.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (state.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) return state;
  }
  throw new Error('TT3 基线战斗队列等待 400 轮仍未收敛');
}

async function playNormal(cardId, desc) {
  const definition = byId(cardId);
  const card = desc === undefined ? definition : { ...definition, desc };
  const uid = `${cardId}-baseline`;
  const game = makeGame(card, uid);
  BattleSession.start(game, [foe()], { isBoss: false });
  await drain();
  BattleSession.commands.playCard(uid, null);
  let state = BattleSession.getSnapshot();
  if (state.pendingTarget) {
    BattleSession.commands.playCard(uid, 'self');
  }
  state = await drain();
  const outcome = { game, state };
  BattleSession.commands.flee();
  await drain();
  return outcome;
}

async function playSilenced(cardId) {
  const card = byId(cardId);
  const uid = `${cardId}-silenced-baseline`;
  const game = makeGame(card, uid);
  BattleSession.start(game, [foe()], { isBoss: false });
  await drain();
  const restored = BattleSession.restore(game, {
    opts: { isBoss: false }, mode: 'normal', turn: 1, maxEnergy: 7, energy: 7,
    hand: [uid], drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
    foes: [foe()], pdef: { armor: 0 }, pstat: { status: { silence: 1 } }, delayed: [],
  });
  expect(restored).toBe(true);
  BattleSession.commands.playCard(uid, null);
  let state = BattleSession.getSnapshot();
  if (state.pendingTarget) BattleSession.commands.playCard(uid, 'self');
  state = await drain();
  const outcome = { game, state };
  BattleSession.commands.flee();
  await drain();
  return outcome;
}

describe('TABLETOP10 定版卡即时效果（迁移前基线与当前规则）', () => {
  it('吞噬击杀最后一名小怪后结束战斗并清除 busy', async () => {
    const card = byId('tt3sp-devour');
    const uid = 'tt3sp-devour-finish';
    const game = makeGame(card, uid);
    game.onBattleEnd = (_opts, _played, win) => { game.lastBattleEnd = win; };
    BattleSession.start(game, [foe()], { isBoss: false });
    await drain();
    BattleSession.commands.playCard(uid, null);
    if (BattleSession.getSnapshot().pendingTarget) BattleSession.commands.playCard(uid, 0);
    const state = await drain();
    expect(game.lastBattleEnd).toBe(true);
    expect(state.busy).toBe(false);
    expect(state.actionQueueLength).toBe(0);
    expect(game.battleActive).toBe(false);
  });

  it('定版 onPlay 声明旧操作顺序；描述改写后仍按字段结算且不重复', async () => {
    const bandage = byId('tt3-bandage');
    const holdFast = byId('tt3-hold-fast');
    expect(bandage.rules.battle.target).toEqual({ side: 'self', area: false });
    expect(bandage.rules.triggers.onPlay).toEqual([
      { op: 'heal', amountField: 'heal' },
      { op: 'armor', amountField: 'armor' },
    ]);
    expect(holdFast.rules.battle.target).toEqual({ side: 'self', area: false });
    expect(holdFast.rules.triggers.onPlay).toEqual([
      { op: 'armor', amountField: 'armor' },
      { op: 'draw', amountField: 'draw' },
    ]);

    const patched = await playNormal('tt3-bandage', '描述已改写');
    expect(patched.game.hp).toBe(43);
    expect(patched.state.pdef.armor).toBe(3);
    expect(patched.game.effectOrder).toEqual(['heal', 'armor']);

    const hold = await playNormal('tt3-hold-fast', '描述已改写');
    expect(hold.state.pdef.armor).toBe(5);
    expect(hold.state.hand).toHaveLength(1);
    expect(hold.game.effectOrder).toEqual(['armor', 'draw']);
  });

  it('普通遭遇战中包扎回复 3 血并获得 3 甲，坚守获得 5 甲', async () => {
    const bandage = byId('tt3-bandage');
    const holdFast = byId('tt3-hold-fast');
    expect(bandage).toMatchObject({ heal: 3, armor: 3 });
    expect(holdFast).toMatchObject({ armor: 5, draw: 1 });

    const patched = await playNormal('tt3-bandage');
    expect(patched.game.hp).toBe(43);
    expect(patched.state.pdef.armor).toBe(3);

    const hold = await playNormal('tt3-hold-fast');
    expect(hold.state.pdef.armor).toBe(5);
    expect(hold.state.hand).toHaveLength(1);
  });

  it('沉默会封锁包扎的回复/护甲与坚守的护甲/抽牌', async () => {
    const patched = await playSilenced('tt3-bandage');
    expect(patched.game.hp).toBe(40);
    expect(patched.state.pdef.armor).toBe(0);
    expect(patched.game.logs.some(line => line.includes('沉默封印'))).toBe(true);

    const hold = await playSilenced('tt3-hold-fast');
    expect(hold.state.pdef.armor).toBe(0);
    expect(hold.state.hand).toHaveLength(0);
    expect(hold.game.logs.some(line => line.includes('沉默封印'))).toBe(true);
  });

  it('BOSS 战坚守按 armor→draw 顺序结算并从剩余牌库补 1 张', async () => {
    const priorDeckSize = window.SDT.MAP.rules.bossDeckSize;
    const priorStartDraw = window.SDT.MAP.rules.battleStartDraw;
    window.SDT.MAP.rules.bossDeckSize = 7;
    window.SDT.MAP.rules.battleStartDraw = 5;
    const card = byId('tt3-hold-fast');
    const ownedCards = Array.from({ length: 7 }, (_, index) => ({
      uid: `tt3-hold-fast-boss-${index}`,
      card,
      safe: false,
    }));
    const game = makeGame(card, 'tt3-hold-fast-boss-0');
    game.ownedCards = ownedCards;
    try {
      BattleSession.start(game, [foe()], { isBoss: true, name: '坚守抽牌基线' });
      let state = await drain();
      expect(state.deckSelection).toBeTruthy();
      while (state.deckSelection && state.deckSelection.selected.length < state.deckSelection.need) {
        const next = state.deckSelection.cards.find(entry => !state.deckSelection.selected.includes(entry.uid));
        expect(next).toBeTruthy();
        BattleSession.commands.selectDeckCard(next.uid);
        state = BattleSession.getSnapshot();
      }
      BattleSession.commands.confirmDeck();
      state = await drain();
      expect(state.hand).toHaveLength(5);
      const uid = state.hand.find(entry => ownedCards.some(cardEntry => cardEntry.uid === entry));
      expect(uid).toBeTruthy();
      BattleSession.commands.playCard(uid, null);
      state = BattleSession.getSnapshot();
      if (state.pendingTarget) BattleSession.commands.playCard(uid, 'self');
      state = await drain();
      expect(state.pdef.armor).toBe(5);
      expect(state.hand).toHaveLength(5);
      expect(game.effectOrder).toEqual(['armor', 'draw']);
      BattleSession.commands.flee();
      await drain();
    } finally {
      if (BattleSession.getSnapshot().phase !== 'idle') {
        BattleSession.commands.flee();
        await drain();
      }
      window.SDT.MAP.rules.bossDeckSize = priorDeckSize;
      window.SDT.MAP.rules.battleStartDraw = priorStartDraw;
    }
  });

  it('marker 已存在但整卡同步覆盖丢失规则时仍会修复，只填定版规则引用的缺失数值', () => {
    const previousCards = JSON.parse(JSON.stringify(Cards.all()));
    const previousKeys = new Map([CARDS_KEY, TT10_KEY, MIGRATION_KEY].map(key => [key, localStorage.getItem(key)]));
    let save;
    try {
      const oldCards = previousCards.map(card => {
        if (!['tt3-bandage', 'tt3-hold-fast'].includes(card.id)) return card;
        const old = { ...card, name: `玩家-${card.id}`, desc: `玩家文案-${card.id}`, customField: 'keep-me' };
        delete old.rules;
        if (card.id === 'tt3-bandage') { delete old.heal; delete old.armor; }
        else { delete old.armor; delete old.draw; }
        return old;
      });
      expect(Cards.saveAll(oldCards)).toBe(true);
      localStorage.setItem(TT10_KEY, '1');
      localStorage.setItem(MIGRATION_KEY, '1');
      save = vi.spyOn(Cards, 'saveAll');

      Cards.ensureTT10OnPlayRules();
      for (const id of ['tt3-bandage', 'tt3-hold-fast']) {
        const card = Cards.all().find(entry => entry.id === id);
        const definition = Cards.TABLETOP10.find(entry => entry.id === id);
        expect(card.rules).toEqual(definition.rules);
        expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [], pending: [] });
        expect(card).toMatchObject({ name: `玩家-${id}`, desc: `玩家文案-${id}`, customField: 'keep-me' });
      }
      expect(Cards.all().find(card => card.id === 'tt3-bandage')).toMatchObject({ heal: 3, armor: 3 });
      expect(Cards.all().find(card => card.id === 'tt3-hold-fast')).toMatchObject({ armor: 5, draw: 1 });
      expect(localStorage.getItem(MIGRATION_KEY)).toBe('1');
      expect(save).toHaveBeenCalledTimes(1);

      Cards.ensureTT10OnPlayRules();
      expect(save).toHaveBeenCalledTimes(1);
    } finally {
      save?.mockRestore();
      Cards.saveAll(previousCards);
      for (const [key, value] of previousKeys) {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    }
  });

  it('无效旧规则记录 card id/path 且保留原存档、不写 marker', () => {
    const previousRaw = localStorage.getItem(CARDS_KEY);
    const previousMarker = localStorage.getItem(MIGRATION_KEY);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const cards = JSON.parse(previousRaw);
      cards.find(card => card.id === 'tt3-bandage').rules = { version: 1, triggers: { invalidTrigger: [] } };
      const invalidRaw = JSON.stringify(cards);
      Cards.clearAll();
      localStorage.setItem(CARDS_KEY, invalidRaw);
      localStorage.removeItem(MIGRATION_KEY);

      Cards.ensureTT10OnPlayRules();

      expect(localStorage.getItem(CARDS_KEY)).toBe(invalidRaw);
      expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
      expect(errors).toHaveBeenCalledWith(
        '[cards] Structured rule migration failed; marker was not written:',
        expect.stringContaining('tt3-bandage rules.triggers: contains an unknown trigger'),
      );
    } finally {
      errors.mockRestore();
      Cards.clearAll();
      if (previousRaw == null) localStorage.removeItem(CARDS_KEY);
      else localStorage.setItem(CARDS_KEY, previousRaw);
      if (previousMarker == null) localStorage.removeItem(MIGRATION_KEY);
      else localStorage.setItem(MIGRATION_KEY, previousMarker);
    }
    Cards.all();
  });

  it('saveAll 抛出存储异常时记录错误且不写 marker', () => {
    const previousMarker = localStorage.getItem(MIGRATION_KEY);
    const oldCards = JSON.parse(JSON.stringify(Cards.all())).map(card => {
      if (!['tt3-bandage', 'tt3-hold-fast'].includes(card.id)) return card;
      const old = { ...card };
      delete old.rules;
      return old;
    });
    const previousRaw = localStorage.getItem(CARDS_KEY);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const save = vi.spyOn(Cards, 'saveAll').mockImplementation(() => { throw new Error('storage blocked'); });
    try {
      Cards.clearAll();
      localStorage.setItem(CARDS_KEY, JSON.stringify(oldCards));
      localStorage.removeItem(MIGRATION_KEY);
      Cards.ensureTT10OnPlayRules();
      expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
      expect(errors).toHaveBeenCalledWith(
        '[cards] Structured rule migration save failed; marker was not written:',
        expect.objectContaining({ message: 'storage blocked' }),
      );
    } finally {
      save.mockRestore();
      errors.mockRestore();
      Cards.clearAll();
      if (previousRaw == null) localStorage.removeItem(CARDS_KEY);
      else localStorage.setItem(CARDS_KEY, previousRaw);
      if (previousMarker == null) localStorage.removeItem(MIGRATION_KEY);
      else localStorage.setItem(MIGRATION_KEY, previousMarker);
    }
    Cards.all();
  });
});
