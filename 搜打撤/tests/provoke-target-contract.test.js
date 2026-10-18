// Characterization of the current hosted provoke contract; does not decide a new balance rule.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }


function start(enemies) {
  const card = canonical('tt7-provoke');
  const game = makeGame([card, card]);
  BattleSession.start(game, enemies.map((f, i) => ({ id: `foe-${i}`, name: `敌人${i}`, behavior: 'strike', ...f })), { isBoss: false });
  return game;
}
async function play(first, second) { BattleSession.commands.playCard('runtime-0', first); BattleSession.commands.playCard('runtime-0', second); await settle(); }
it('现役hosted卡选择两名不同敌人，三敌中可跳过自动顺序首位', async () => {
  const game = start([{ hp: 20, atk: 2 }, { hp: 20, atk: 3 }, { hp: 20, atk: 4 }]);
  await play(2, 1);
  expect(R.foes.map(f => f.hp)).toEqual([20, 16, 17]);
  expect(game.logs.join(' ')).toContain('敌人2 被迫攻击 敌人1');
  expect(game.logs.join(' ')).toContain('敌人1 被迫反击 敌人2');
});
it('首击致死时不产生死者反击，锚点保持生命', async () => {
  const game = start([{ hp: 4, atk: 4 }, { hp: 4, atk: 4 }]);
  await play(1, 0);
  expect(R.foes[0].dead).toBe(true);
  expect(R.foes[1].hp).toBe(4);
  expect(game.logs.join(' ')).not.toContain('被迫反击');
});
it('首击未致死才反击；互殴不使用玩家攻击力', async () => {
  start([{ hp: 30, atk: 2 }, { hp: 30, atk: 3 }]);
  await play(1, 0);
  expect(R.foes.map(f => f.hp)).toEqual([27, 28]);
});
it('死亡占位不影响两名存活敌的显式选择', async () => {
  start([{ hp: 30, atk: 2 }, { hp: 30, atk: 3 }, { hp: 30, atk: 4 }]);
  R.foes[0].hp = 0; R.foes[0].dead = true;
  await play(2, 1);
  expect(R.foes.map(f => f.hp)).toEqual([0, 26, 27]);
});
it('仅一名存活敌人时无互殴伤害并给出不足两名反馈', async () => {
  const game = start([{ hp: 30, atk: 2 }]);
  await play(0, 0);
  expect(R.foes[0].hp).toBe(30);
  expect(game.logs.join(' ')).toContain('场上敌人不足两名');
});
it('首选及重复点击不扣费、不移牌、不造成伤害，取消可重新选择', async () => {
  start([{ hp: 30, atk: 2 }, { hp: 30, atk: 3 }, { hp: 30, atk: 4 }]);
  const energy = R.energy;
  const first = BattleSession.commands.submitCardPlay('runtime-0', 2);
  expect(first.status).toBe('needs-input');
  expect(R.hand).toContain('runtime-0'); expect(R.energy).toBe(energy);
  expect(R.foes.map(f => f.hp)).toEqual([30, 30, 30]);
  expect(BattleSession.getSnapshot().pendingTarget.excludedTargetIndex).toBe(2);
  expect(BattleSession.commands.submitCardPlay('runtime-0', 2).status).toBe('needs-input');
  expect(R.energy).toBe(energy);
  BattleSession.commands.cancelCardInteraction();
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  await play(0, 1);
  expect(R.foes.map(f => f.hp)).toEqual([27, 28, 30]);
  expect(R.energy).toBe(energy - 1);
  expect(R.hand).not.toContain('runtime-0');
});
it('首选目标中途死亡后重新选择，不复用失效目标或暗中替换', async () => {
  start([{ hp: 30, atk: 2 }, { hp: 30, atk: 3 }, { hp: 30, atk: 4 }]);
  BattleSession.commands.playCard('runtime-0', 0);
  R.foes[0].dead = true; R.foes[0].hp = 0;
  BattleSession.commands.playCard('runtime-0', 1);
  expect(R.hand).toContain('runtime-0');
  expect(R.foes.map(f => f.hp)).toEqual([0, 30, 30]);
  BattleSession.commands.playCard('runtime-0', 2); await settle();
  expect(R.foes.map(f => f.hp)).toEqual([0, 26, 27]);
});
it('施放重放锁定原两敌，首击致死后不暗中换打第三敌', async () => {
  start([{ hp: 2, atk: 2 }, { hp: 30, atk: 3 }, { hp: 30, atk: 4 }]);
  R.set$nextSpellTwice(2);
  await play(2, 0);
  expect(R.foes.map(f => f.hp)).toEqual([0, 30, 30]);
});
it('临时选敌信息不会写入持有卡牌或存档序列化', async () => {
  const game = start([{ hp: 30, atk: 2 }, { hp: 30, atk: 3 }]);
  const original = JSON.stringify(game.ownedCards);
  BattleSession.commands.playCard('runtime-0', 0);
  expect(JSON.stringify(game.ownedCards)).toBe(original);
  BattleSession.commands.playCard('runtime-0', 1); await settle();
  expect(JSON.stringify(game.ownedCards)).toBe(original);
  expect(Object.getOwnPropertySymbols(game.ownedCards[0].card)).toHaveLength(0);
});


it('同种敌人首选不写入检查点，恢复重新选取新实例而非旧对象', async () => {
  const game = start([{ id:'grass_el', hp:12, atk:5 }, { id:'grass_el', hp:12, atk:5 }]);
  const originalFirst = R.foes[0];
  const checkpointBefore = BattleSession.serialize();
  BattleSession.commands.playCard('runtime-0', 0);
  expect(BattleSession.getSnapshot().pendingTarget.excludedTargetIndex).toBe(0);
  const checkpoint = BattleSession.serialize();
  expect(checkpoint).toEqual(checkpointBefore);
  expect(BattleSession.restore(game, checkpoint)).toBe(true);
  expect(R.foes[0]).not.toBe(originalFirst);
  expect(R.foes.map(f => f.id)).toEqual(['grass_el', 'grass_el']);
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  BattleSession.commands.playCard('runtime-0', 1);
  expect(BattleSession.getSnapshot().pendingTarget.excludedTargetIndex).toBe(1);
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes.map(f => f.hp)).toEqual([7, 7]);
});
