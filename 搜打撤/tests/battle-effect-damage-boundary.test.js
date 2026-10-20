import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT ||= {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 9, battleHandMax: 20, bossDeckSize: 15,
  starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); });
afterEach(() => {
  if (R.G?.battleActive) BattleSession.commands.flee();
  vi.clearAllTimers(); vi.useRealTimers();
});

async function start() {
  const game = { ownedCards: [{ uid: 'held', card: { id: 'held', name: '持有牌', type: '武术', cost: 0, desc: '' } }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士',
    state: 'idle', battleActive: false, log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'one', name: '甲', hp: 30, atk: 5 }, { id: 'two', name: '乙', hp: 30, atk: 4 }], { isBoss: false });
  await vi.advanceTimersByTimeAsync(1000);
  R.pstat.status.stealth = 1;
}
const trigger = (desc = '造成 8 点固定伤害') => ({ id: 'text-boundary', name: '文本触发', type: '法术',
  dmgType: 'fixed', desc: `消耗该牌时：${desc}。` });

describe('文本与结构化伤害提交边界', () => {
  it.each(['ordinary', 'protected', 'aegis', 'hearts'])('消耗文本经过%s伤害规则且仅实际伤害破潜行', async kind => {
    await start();
    const target = R.foes[0];
    if (kind === 'protected') { target.protected = true; R.foes[1].protects = true; }
    if (kind === 'aegis') { target.affix = 'aegis'; R.set$turn(2); }
    if (kind === 'hearts') target.heartsMode = true;
    engine.fireConsumeTriggers(trigger(), target);
    const loss = kind === 'ordinary' ? 8 : kind === 'hearts' ? 2 : 0;
    expect(target.hp).toBe(30 - loss);
    expect(R.pstat.status.stealth).toBe(loss ? 0 : 1);
  });

  it('文本冻伤装备加成不被公共提交层再加一次', async () => {
    await start();
    R.foes[0].status.freeze = 1;
    R.equipped.push({ uid: 'frost', card: { type: '装备', rules: { equip: { passive: { cond: { vsFreeze: 2 } } } } } });
    engine.fireConsumeTriggers(trigger(), R.foes[0]);
    expect(R.foes[0].hp).toBe(20);
  });

  it('扰敌文本保留敌人攻击力，后手死亡不反击且不破玩家潜行', async () => {
    await start();
    R.foes[1].hp = 4;
    engine.fireConsumeTriggers(trigger('迫使其相互攻击'), R.foes[0]);
    expect(R.foes[0].hp).toBe(30);
    expect(R.foes[1].hp).toBe(0);
    expect(R.pstat.status.stealth).toBe(1);
  });
});
