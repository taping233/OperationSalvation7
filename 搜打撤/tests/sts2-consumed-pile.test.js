import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumedPileUids } from '../game/src/battle/view/battle.piles.view.js';
import { battlePileBodyHTML } from '../game/src/battle/view/battle.decision-content.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 200, bossDeckSize: 1, starterSha: 0,
    battleStartDraw: 1, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const hit = () => ({ id: 'consumed-owned', name: '打出消耗牌', type: '武术', cost: 1,
  dmg: 2, dmgType: 'fixed', desc: '造成2点固定伤害。',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } });
const payment = () => {
  const card = hit();
  card.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '武术' }];
  return card;
};
const item = () => ({ id: 'consumed-item', name: '道具栏抽牌', type: '道具', cost: 0, desc: '',
  rules: { version: 1, bag: { use: [{ op: 'draw', amount: 1 }] } } });
const settle = () => vi.advanceTimersByTimeAsync(3000);
function start(cards = [], options = {}) {
  const game = { ownedCards: cards.map((card, index) => ({ uid: `owned-${index}`, card: structuredClone(card), safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, turn: 1, myClass: '侠客', characterId: null,
    cardOrder: [], usedPocket: [], eventLog: [], inventory: [], state: 'idle', battleActive: false,
    log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd(opts, played, win, consumed) { this.ended = { opts, played, win, consumed }; } };
  BattleSession.start(game, [{ id: 'consumed-target', name: '牌堆验证靶', hp: 9999, atk: 0 }],
    { isBoss: false, ...options });
  return game;
}
beforeEach(() => { vi.useFakeTimers(); runtime.set$lastDeckSel([]); });
afterEach(() => {
  if (runtime.G?.battleActive) engine.finish(null);
  vi.clearAllTimers(); vi.useRealTimers();
});

describe('battle consumed-pile read model', () => {
  it('combines played and explicitly consumed physical UIDs once without changing their ledgers', () => {
    const state = Object.freeze({ mode: 'normal', played: Object.freeze(['played', 'both']),
      consumed: Object.freeze(['both', 'fuel']), grave: Object.freeze([]) });
    expect(consumedPileUids(state)).toEqual(['played', 'both', 'fuel']);
    expect(state.played).toEqual(['played', 'both']);
    expect(state.consumed).toEqual(['both', 'fuel']);
  });

  it('shows a real played owned card in the inspectable battle pile while keeping restoration ledgers intact', async () => {
    start([hit()]);
    BattleSession.commands.playCard('owned-0', 0); await settle();
    const state = BattleSession.getSnapshot();
    expect(state.played).toContain('owned-0');
    expect(state.consumed).not.toContain('owned-0');
    expect(state.grave).toEqual([]);
    expect(state.discard).toEqual([]);
    expect(consumedPileUids(state)).toContain('owned-0');
    expect(Object.isFrozen(state.played)).toBe(true);
    BattleSession.commands.openGrave();
    expect(BattleSession.getSnapshot().viewingGrave).toBe(true);
    const cards = consumedPileUids(state).map(uid => engine.findEffectiveCard(uid)).filter(Boolean);
    const body = battlePileBodyHTML({ cards, cardHTML: card => `<span>${card.name}</span>`, kind: 'grave', isBoss: false });
    expect(body.html).toContain('打出消耗牌');
    expect(body.stacks).toHaveLength(1);
    expect(runtime.consumed).toEqual([]); // Displaying spent cards does not rewrite played as consumed.
  });

  it('lists both the played source and a genuinely consumed hand payment without duplicates', async () => {
    start([payment(), hit()]);
    BattleSession.commands.playCard('owned-0', 0);
    expect(BattleSession.getSnapshot().handSelecting.act).toBe('payment');
    BattleSession.commands.pickHandSelect('owned-1'); await settle();
    const state = BattleSession.getSnapshot();
    expect(state.played).toContain('owned-0');
    expect(state.consumed).toContain('owned-1');
    expect([...consumedPileUids(state)].sort()).toEqual(['owned-0', 'owned-1']);
    expect(state.grave).toEqual([]);
  });

  it('does not show a keepInHand card as spent after it returns to the hand', async () => {
    const retained = hit(); retained.cost = 0; retained.rules.battle.keepInHand = true;
    start([retained]);
    BattleSession.commands.playCard('owned-0', 0); await settle();
    const state = BattleSession.getSnapshot();
    expect(state.hand).toContain('owned-0');
    expect(state.played).not.toContain('owned-0');
    expect(consumedPileUids(state)).not.toContain('owned-0');
  });

  it('keeps boss ordinary plays in their discard ledger and includes them in the unified consumed pile', async () => {
    start([hit()], { isBoss: true, directBossStart: true });
    expect(BattleSession.getSnapshot().hand).toContain('owned-0');
    BattleSession.commands.playCard('owned-0', 0); await settle();
    const state = BattleSession.getSnapshot();
    expect(state.played).toContain('owned-0');
    expect(state.discard).toContain('owned-0');
    expect(consumedPileUids(state)).toEqual(state.consumedPile);
    expect(consumedPileUids(state)).toContain('owned-0');
  });

  it('allows a played temporary starter from the actual 99-card deck to be inspected but never enters the permanent bag', async () => {
    const game = start();
    expect(engine.drawCards(1)).toBe(1);
    const uid = BattleSession.getSnapshot().hand[0];
    expect(uid.startsWith('normal-sha-')).toBe(true);
    BattleSession.commands.playCard(uid, 0); await settle();
    expect(consumedPileUids(BattleSession.getSnapshot())).toContain(uid);
    expect(engine.findEffectiveCard(uid).card.id).toBe(C.SHA.id);
    engine.finish(true); await settle();
    expect(game.ownedCards).toEqual([]);
    expect(runtime.granted).toEqual([]);
    expect(game.ended.opts.spentCards.some(entry => entry.uid === uid)).toBe(false);
  });

  it('item-dock uses remove permanent ownership and retain both permanent and temporary played sources', async () => {
    const game = start([item()]);
    BattleSession.commands.usePotion('owned-0'); await settle();
    expect(game.ownedCards).toEqual([]);
    expect(consumedPileUids(BattleSession.getSnapshot())).toContain('owned-0');
    const temporaryUid = engine.addTempCard(item());
    BattleSession.commands.usePotion(temporaryUid); await settle();
    expect(consumedPileUids(BattleSession.getSnapshot())).toContain(temporaryUid);
    expect(engine.findEffectiveCard(temporaryUid).card.id).toBe('consumed-item');
    expect(BattleSession.getSnapshot().potionBar.some(entry => entry.uid === temporaryUid)).toBe(false);
  });
});
