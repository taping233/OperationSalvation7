import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 30, battleHandMax: 99, bossDeckSize: 30, starterSha: 0,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {},
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const C = window.SDT.Cards;
const PURE_HEAL = { id: 'free-pure-heal', name: '纯注能治疗', type: '法术', cost: 1,
  rarity: '稀有', infuse: 1, heal: 7, desc: '注能（1）：回复7点生命' };
const byId = id => {
  const card = C.all().find(value => value.id === id);
  if (!card) throw new Error(`缺少现役卡 ${id}`);
  return card;
};
beforeAll(() => {
  C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
});
async function drain() {
  for (let i = 0; i < 400; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const state = BattleSession.getSnapshot();
    if (state.discovering || state.handSelecting || state.deckSelection) return state;
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  throw new Error('免注能路径动作队列未结束');
}
async function begin(cards, boss = false) {
  const game = {
    ownedCards: cards.map((card, index) => ({ uid: `free-${index}`, card })),
    hp: 10, maxHp: 1000, atk: 0, spellPower: 0, coins: 0,
    myClass: '降临者', characterId: null, state: 'idle', battleActive: false,
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'free-path-foe', name: '靶子', hp: 9999, atk: 1 }], { isBoss: boss });
  let state = await drain();
  if (state.deckSelection) {
    for (const entry of state.deckSelection.cards) BattleSession.commands.selectDeckCard(entry.uid);
    BattleSession.commands.confirmDeck();
    state = await drain();
  }
  expect(state.hand.length).toBe(cards.length);
  return game;
}
afterEach(async () => {
  vi.restoreAllMocks();
  BattleSession.commands.flee();
  await drain();
});

describe('其他免注能来源与绕过手动出牌的结算路径', () => {
  it('旧日再临后仅剩一张纯注能牌，点卡直接选目标，不要求燃料', async () => {
    const sovereign = byId('tt8-abyss-sovereign');
    const heal = PURE_HEAL;
    const game = await begin([sovereign, heal], true);
    BattleSession.commands.playCard('free-0', 'self');
    await drain();
    expect(R.allSpellsInfused).toBe(true);
    // 旧日再临可能把自身从弃牌洗回；固定为只剩待测牌的合法手牌边界。
    R.set$hand(['free-1']); R.set$discard(['free-0']); R.set$drawPile([]);
    expect(R.hand).toEqual(['free-1']);
    expect(viewApi.infuseOf(heal)).toBe(0);
    const energy = R.energy;
    const hp = game.hp;
    BattleSession.commands.playCard('free-1');
    let state = await drain();
    expect(state.infusing).toBeNull();
    expect(state.pendingTarget?.uid).toBe('free-1');
    BattleSession.commands.playCard('free-1', 'self');
    state = await drain();
    expect(game.hp).toBeGreaterThan(hp);
    expect(state.energy).toBe(energy - heal.cost);
    expect(R.infuseFuels).toBe(0);
    expect(R.grave).toEqual([]);
  });

  it.each(['instance', 'global'])('灰烬符文满手直释读取 %s 免注能状态', async source => {
    const card = { ...PURE_HEAL, ...(source === 'instance' ? { _noInfuse: true } : {}) };
    const game = await begin([card]);
    // 固定满手与牌库边界，调用正式抽牌/灰烬直释路径，不写持久化存档。
    R.set$mode('boss'); R.set$hand(Array.from({ length: 9 }, (_, i) => `full-${i}`));
    R.set$drawPile(['free-0']); R.set$discard([]);
    R.applyRuneFlag('ash');
    R.set$allSpellsInfused(source === 'global');
    const hp = game.hp;
    const energy = R.energy;
    expect(E.drawCards(1)).toBe(1);
    expect(game.hp).toBeGreaterThan(hp);
    expect(R.discard).toEqual(['free-0']);
    expect(R.energy).toBe(energy);
    expect(R.infuseFuels).toBe(0);
  });

  it('免注能临时牌被深红丝袋复制后，两张都触发注能加伤', async () => {
    const pouch = byId('tt3-crimson-pouch');
    const laser = { ...byId('tt3sp-silverthorn'), _noInfuse: true };
    await begin([pouch, laser]);
    BattleSession.commands.playCard('free-0', 'self');
    await drain();
    E.useEquipSkill('free-0');
    expect((await drain()).handSelecting).toBeTruthy();
    BattleSession.commands.pickHandSelect('free-1');
    await drain();
    const copies = R.hand.filter(uid => E.findCard(uid)?.card.id === laser.id);
    expect(copies).toHaveLength(2);
    const before = R.foes[0].hp;
    for (const uid of copies) {
      expect(E.findCard(uid).card._noInfuse).toBe(true);
      BattleSession.commands.playCard(uid, 0);
      await drain();
    }
    expect(before - R.foes[0].hp).toBe(16);
    expect(R.infuseFuels).toBe(0);
  });

  it('noInfuse 洗入牌库、抽出、弃牌洗回后仍触发效果', async () => {
    const heal = PURE_HEAL;
    const game = await begin([]);
    R.set$mode('boss');
    const source = {
      id: 'free-deck-source', name: '免注能洗入测试', type: '法术', cost: 0, desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onPlay: [{ op: 'acquire', n: 1, pool: { kind: '注能' }, dest: 'deck', act: 'noInfuse' }] } },
    };
    vi.spyOn(C, 'all').mockReturnValue([heal]);
    E.resolveCard(source, null, false, 0, null);
    expect(R.drawPile).toHaveLength(1);
    const uid = R.drawPile[0];
    for (let i = 0; i < 2; i++) {
      expect(E.drawCards(1)).toBe(1);
      expect(E.findCard(uid).card._noInfuse).toBe(true);
      const hp = game.hp;
      BattleSession.commands.playCard(uid, 'self');
      await drain();
      expect(game.hp).toBeGreaterThan(hp);
      expect(R.discard).toContain(uid);
    }
    expect(heal._noInfuse).toBeUndefined();
    expect(R.infuseFuels).toBe(0);
  });

  it.each(['free-pure-heal', 'tt3sp-silverthorn', 'tt3sp-bloodstorm'])('法力奔涌默认注能：%s 的治疗、加伤或重施实际生效', async id => {
    const surge = byId('cc-mana-surge');
    const payload = id === PURE_HEAL.id ? PURE_HEAL : byId(id);
    const game = await begin([surge]);
    vi.spyOn(C, 'all').mockReturnValue([payload]);
    vi.spyOn(C, 'isRandomObtainable').mockReturnValue(true);
    const hp = game.hp;
    const before = R.foes[0].hp;
    BattleSession.commands.playCard('free-0', 0);
    await drain();
    if (id === PURE_HEAL.id) expect(game.hp - hp).toBe(28);
    if (id === 'tt3sp-silverthorn') expect(before - R.foes[0].hp).toBe(32);
    if (id === 'tt3sp-bloodstorm') expect(before - R.foes[0].hp).toBe(24);
    expect(R.energy).toBe(30 - surge.cost);
    expect(R.infuseFuels).toBe(0);
    expect(R.consumed).toEqual([]);
  });

  it('只有免费施放的普通牌不会自动获得注能效果', async () => {
    const laser = byId('tt3sp-silverthorn');
    await begin([laser]);
    const before = R.foes[0].hp;
    E.queueCardExecution('free-0', laser, [], R.foes[0], true);
    await drain();
    expect(before - R.foes[0].hp).toBe(5);
    expect(R.energy).toBe(30);
  });
});
