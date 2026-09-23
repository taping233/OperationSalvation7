/* R3-b regression: duplicate commands are inert, while a UID that is genuinely
 * back in hand remains reusable and receives a fresh presentation receipt. */
import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 3, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/battle.core.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

let sequence = 0;
function setup(cardId, mode = 'normal', energy = 3, foeCount = 1) {
  const cardIds = Array.isArray(cardId) ? cardId : [cardId];
  const cards = cardIds.map(id => {
    const card = Cards.all().find(entry => entry.id === id);
    if (!card) throw new Error(`卡库缺卡: ${id}`);
    return card;
  });
  const uids = cards.map(() => `r3b-${sequence++}`);
  const uid = uids[0], card = cards[0];
  const logs = [];
  const game = {
    ownedCards: cards.map((ownedCard, index) => ({ uid: uids[index], card: { ...ownedCard }, safe: false })),
    hp: 99, maxHp: 99, atk: 4, spellPower: 0, coins: 0,
    myClass: '战士', characterId: null, state: 'idle', battleActive: false,
    logs, log(message) { logs.push(String(message)); }, heal() {}, addItem() {}, onBattleEnd() {},
  };
  const restored = BattleSession.restore(game, {
    opts: { isBoss: mode === 'boss', name: `R3-b ${mode}` }, mode, turn: 1, maxEnergy: 3, energy,
    hand: uids.filter((_, index) => cards[index].type !== '道具'), drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
    pdef: { shield: 0, armor: 0, guard: false }, pstat: { status: {} },
    foes: Array.from({ length: foeCount }, (_, index) => ({ id: `infantry-${index}`, name: `边界靶${index + 1}`, hp: 50, maxHp: 50, atk: 1, dead: false, status: {},
      defense: { shield: 0, armor: 0, guard: false } })),
    delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [],
  });
  expect(restored).toBe(true);
  return { game, uid, uids, card, cards };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
async function settle(max = 300) {
  for (let i = 0; i < max; i++) {
    await tick();
    const snapshot = BattleSession.getSnapshot();
    if (!snapshot.busy && snapshot.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return BattleSession.getSnapshot();
}

async function playAndSettle(uid) {
  BattleSession.commands.playCard(uid, 0);
  return settle();
}

function leave() {
  if (BattleSession.getSnapshot().player) BattleSession.commands.flee();
}

function playEvents() {
  return viewApi.takeCardAnims().filter(event => event.kind === 'play');
}

describe('R3-b 同 UID 出牌边界', () => {
  it.each(['normal', 'boss'])('%s：合法结算稳定后，迟到的同 UID 命令不得再次扣费或伤害', async mode => {
    const { uid } = setup('starter-attack', mode);
    const once = await playAndSettle(uid);
    expect(once.energy).toBe(2);
    expect(once.foes[0].hp).toBe(46);
    expect(once.hand).not.toContain(uid);
    const firstEvents = playEvents();
    expect(firstEvents).toHaveLength(1);
    expect(firstEvents[0].receipt).toEqual({ battleToken: once.battleToken, actionSeq: 1 });

    const afterDuplicate = await playAndSettle(uid);
    expect({ energy: afterDuplicate.energy, hp: afterDuplicate.foes[0].hp }).toEqual({ energy: 2, hp: 46 });
    expect(playEvents()).toEqual([]);
    leave();
  });

  it('保留在手牌中的同 UID 每次都可合法再次使用', async () => {
    const { uid } = setup('cmtn233trmeg', 'normal');
    const once = await playAndSettle(uid);
    expect(once.hand).toContain(uid);
    expect(once.energy).toBe(2);
    expect(once.foes[0].hp).toBe(45);
    expect(playEvents()[0].receipt).toEqual({ battleToken: once.battleToken, actionSeq: 1 });
    const twice = await playAndSettle(uid);
    expect(twice.hand).toContain(uid);
    expect(twice.energy).toBe(1);
    expect(twice.foes[0].hp).toBe(40);
    expect(playEvents()[0].receipt).toEqual({ battleToken: twice.battleToken, actionSeq: 2 });
    leave();
  });

  it('BOSS 弃牌洗回并重抽后，同 UID 可合法再次使用', async () => {
    const { uid } = setup('starter-attack', 'boss');
    const once = await playAndSettle(uid);
    expect(once.discard).toContain(uid);
    expect(playEvents()[0].receipt).toEqual({ battleToken: once.battleToken, actionSeq: 1 });
    BattleSession.commands.endTurn();
    const redrawn = await settle();
    expect(redrawn.phase).toBe('player');
    expect(redrawn.hand).toContain(uid);
    const twice = await playAndSettle(uid);
    expect(twice.foes[0].hp).toBe(42);
    expect(playEvents()[0].receipt).toEqual({ battleToken: twice.battleToken, actionSeq: 2 });
    leave();
  });

  it('内部直接释放继续入队且每次提交获得独立 receipt', async () => {
    const { uids } = setup(['tt3-frostfall', 'cmtn233trmeg'], 'normal');
    BattleSession.commands.playCard(uids[0], 0);
    const choosing = await settle();
    expect(choosing.handSelecting).toBeTruthy();
    BattleSession.commands.pickHandSelect(uids[1]);
    const done = await settle();
    expect(done.energy).toBe(1); // 只扣剑荡妖邪 2 费；被选武术直接释放免费
    const events = playEvents();
    expect(events.map(event => event.uid)).toEqual(uids);
    expect(events.map(event => event.receipt)).toEqual([
      { battleToken: done.battleToken, actionSeq: 1 },
      { battleToken: done.battleToken, actionSeq: 2 },
    ]);
    leave();
  });

  it('迟到的离手 UID 不取消当前药水点选', async () => {
    const { uids } = setup(['starter-attack', 'tt3-mixed-potion'], 'normal', 3, 2);
    await playAndSettle(uids[0]);
    expect(playEvents()).toHaveLength(1);
    BattleSession.commands.usePotion(uids[1]);
    const pending = BattleSession.getSnapshot();
    expect(pending.pendingItem?.uid).toBe(uids[1]);

    BattleSession.commands.playCard(uids[0], 0);
    const afterLateCommand = BattleSession.getSnapshot();
    expect(afterLateCommand.pendingItem).toEqual(pending.pendingItem);
    expect(afterLateCommand.energy).toBe(pending.energy);
    expect(afterLateCommand.foes.map(foe => foe.hp)).toEqual(pending.foes.map(foe => foe.hp));
    expect(playEvents()).toEqual([]);
    leave();
  });
});
