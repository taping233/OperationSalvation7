import { afterEach, beforeAll, describe, expect, it } from 'vitest';

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

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let activeGame = null;
function makeGame(cards) {
  const logs = [];
  const game = {
    ownedCards: cards.map((card, index) => ({ uid: `hitech-baseline-${index}`, card, safe: false })),
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

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function drain(timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const state = BattleSession.getSnapshot();
    if (state.discovering) {
      BattleSession.commands.pickDiscover(0);
      continue;
    }
    if (state.choosing) {
      BattleSession.commands.pickChoice(0);
      continue;
    }
    if (state.handSelecting) {
      BattleSession.commands.skipHandSelect();
      continue;
    }
    if (!state.busy && state.actionQueueLength === 0) return state;
    await tick();
  }
  throw new Error('BattleSession 未在时限内收敛');
}

async function waitForDiscovery(timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const state = BattleSession.getSnapshot();
    if (state.discovering) return state;
    await tick();
  }
  throw new Error('高端研发没有进入实际发现选择流程');
}

async function finishBattle() {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await drain();
  }
  activeGame = null;
}

afterEach(async () => finishBattle());

describe('tt12-hitechrd legacy BattleSession baseline', () => {
  it('discovers a real 2-cost martial card, decays its effective cost, and reproduces restart-on-read behavior', async () => {
    const research = Cards.all().find(card => card.id === 'tt12-hitechrd');
    expect(research, '现役卡库应包含 tt12-hitechrd').toBeTruthy();
    expect(research.desc).toBe('发现一张2费招式，在每个回合开始时，使其-1费');
    const game = makeGame([research]);
    activeGame = game;
    const foe = { id: 'hitech-baseline-foe', name: '费用测试靶', hp: 99999, atk: 1, noFirstAttack: true };
    BattleSession.start(game, [foe], { isBoss: false, name: '高端研发基线' });
    let state = await drain();
    expect(state.hand).toContain('hitech-baseline-0');
    const researchUid = 'hitech-baseline-0';
    const originalCards = game.ownedCards.map(entry => ({ uid: entry.uid, id: entry.card.id }));

    BattleSession.commands.playCard(researchUid, null);
    state = await waitForDiscovery();
    const options = state.discovering?.options || [];
    const pickIndex = options.findIndex(card => card.type === '武术' && Number(card.cost) === 2);
    expect(pickIndex, `应实际显示 2 费武术候选；当前候选为 ${options.map(card => `${card.id}:${card.type}:${card.cost}`).join(', ')}`).toBeGreaterThanOrEqual(0);
    const selected = options[pickIndex];
    const libraryCard = Cards.all().find(card => card.id === selected.id);
    expect(libraryCard?.cost).toBe(2);

    BattleSession.commands.pickDiscover(pickIndex);
    state = await drain();
    const discoveredUid = state.hand.find(uid => uid !== researchUid);
    expect(discoveredUid, '选择的候选应进入战斗手牌').toBeTruthy();
    expect(viewApi.findCard(discoveredUid).card.id).toBe(selected.id);
    expect(viewApi.findCard(discoveredUid).card.cost).toBe(2);
    expect(viewApi.effCostOf(selected, discoveredUid)).toBe(2);
    expect(game.logs.some(line => line.includes('现 1 费'))).toBe(false);

    BattleSession.commands.endTurn();
    state = await drain();
    expect(state.turn).toBe(2);
    expect(viewApi.findCard(discoveredUid).card.cost).toBe(1);
    expect(viewApi.effCostOf(viewApi.findCard(discoveredUid).card, discoveredUid)).toBe(1);
    expect(game.logs.some(line => line.includes('回合开始时') && line.includes('费用 -1') && line.includes('现 1 费'))).toBe(true);
    expect(libraryCard.cost).toBe(2);

    BattleSession.commands.endTurn();
    state = await drain();
    expect(state.turn).toBe(3);
    expect(viewApi.findCard(discoveredUid).card.cost).toBe(0);
    expect(viewApi.effCostOf(viewApi.findCard(discoveredUid).card, discoveredUid)).toBe(0);

    // BattleSession.serialize stores the deliberate battle-entry restart checkpoint,
    // not the live battle. Restore therefore restarts before discovery/cost-decay progress.
    const save = BattleSession.serialize();
    expect(save.restartVersion).toBe(1);
    expect(save.run.ownedCards.map(entry => ({ uid: entry.uid, id: entry.card.id }))).toEqual(originalCards);
    expect(save).not.toHaveProperty('delayed');
    expect(save).not.toHaveProperty('cardOverrides');
    expect(BattleSession.restore(game, save)).toBe(true);
    state = await drain();
    expect(state.turn).toBe(1);
    expect(state.hand).toContain(researchUid);
    expect(state.hand).not.toContain(discoveredUid);
    expect(game.ownedCards.some(entry => entry.card.id === selected.id && entry.uid === discoveredUid)).toBe(false);
    expect(libraryCard.cost).toBe(2);
  });
});
