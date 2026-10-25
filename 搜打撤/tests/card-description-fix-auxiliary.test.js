import { battleRules } from './helpers/environment-fixtures.js';
import { describe, expect, it } from 'vitest';

// 通过当前正常迁移后的卡库与真实战斗道具入口验证，不以历史审查快照提供规则。
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(99, 99, 8, 0, 2, 1) },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const Combat = await import('../game/src/battle/core/combat.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const byId = id => {
  const card = C.all().find(card => card.id === id);
  if (!card) throw new Error(`当前卡库缺卡：${id}`);
  return structuredClone(card);
};
async function drain() {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 10));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) return state;
  }
  throw new Error('道具动作未在时限内收口');
}
let activeItemUid = null;
async function start(itemId, { boss = false, enemies = [{ id: 'aux-target', name: '道具靶', hp: 100, atk: 1 }] } = {}) {
  const cards = [byId(itemId), ...Array.from({ length: 4 }, () => byId('tt3-fireball'))];
  const game = {
    ownedCards: cards.map((card, i) => ({ uid: `aux-${i}`, card })), inventory: [], usedPocket: [],
    hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0, state: 'idle', battleActive: false, myClass: '战士',
    log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, onBattleEnd() {},
  };
  BattleSession.start(game, enemies, { isBoss: boss, nest: boss });
  await drain();
  // 首脑快捷栏只接受战斗中生成的临时道具；永久背包道具不进入该入口。
  activeItemUid = boss ? engine.addTempCard(byId(itemId)) : 'aux-0';
  expect(BattleSession.getSnapshot().potionBar.some(item => item.uid === activeItemUid)).toBe(true);
  return game;
}
async function useItem(target = 0) {
  BattleSession.commands.useItem(activeItemUid, target);
  return drain();
}

function expectItemConsumed(game, boss = false) {
  expect(BattleSession.getSnapshot().potionBar.some(item => item.uid === activeItemUid)).toBe(false);
  if (boss) {
    expect(runtime.played.filter(uid => uid === activeItemUid)).toHaveLength(1);
    // 临时道具使用不动背包里的同名永久母本。
    expect(game.ownedCards.some(item => item.uid === 'aux-0')).toBe(true);
  } else expect(game.ownedCards.some(item => item.uid === activeItemUid)).toBe(false);
}

describe('卡面描述修复：战斗道具消费者', () => {
  it.each([false, true])('精神药水抽2张，普通战转初始攻击，首脑从真实牌库抽取（首脑=%s）', async boss => {
    const game = await start('tt3-mind-potion', { boss });
    const before = BattleSession.getSnapshot();
    expect(before.hand).toHaveLength(boss ? 2 : 4);
    if (boss) expect(before.drawPile).toHaveLength(2);
    const after = await useItem();
    expect(after.hand.length - before.hand.length).toBe(2);
    expectItemConsumed(game, boss);
    if (boss) {
      expect(after.drawPile).toHaveLength(0);
      expect(new Set(after.hand)).toEqual(new Set(['aux-1', 'aux-2', 'aux-3', 'aux-4']));
    } else {
      const extra = after.hand.filter(uid => !before.hand.includes(uid));
      expect(extra.map(uid => runtime.granted.find(entry => entry.uid === uid)?.card.id))
        .toEqual([C.SHA.id, C.SHA.id]);
    }
  });

  it('火焰药水全敌2点法伤，法伤与spellUp各加一次，再正常结算减伤及护甲', async () => {
    const game = await start('tt3-python-potion', { enemies: [
      { id: 'plain', name: '无防御靶', hp: 100, atk: 1 },
      { id: 'reduce', name: '减伤靶', hp: 100, atk: 1 },
      { id: 'armor', name: '护甲减伤靶', hp: 100, atk: 1 },
    ] });
    game.spellPower = 1;
    Combat.addBlessing(runtime.pstat, 'spellUp', 3);
    Combat.addBlessing(runtime.foes[1], 'reduce', 1);
    Combat.addBlessing(runtime.foes[2], 'reduce', 1);
    runtime.foes[2].defense.armor = 2;
    const state = await useItem(1);
    // 同一全体效果：2基础+1面板法伤+3法术强化=6，然后按各目标防御减免。
    expect(state.foes.map(foe => foe.hp)).toEqual([94, 95, 97]);
    expectItemConsumed(game);
  });

  it('TNT跳过低攻首脑和高攻目标，只消灭至多2个攻击力不超过5的普通敌人', async () => {
    const game = await start('tt3sp-doom', { boss: true, enemies: [
      { id: 'boss', name: '低攻首脑', hp: 100, atk: 1, affix: 'grow' },
      { id: 'high', name: '高攻普通敌人', hp: 100, atk: 6 },
      { id: 'low-four', name: '攻击4普通敌人', hp: 100, atk: 4 },
      { id: 'low-five', name: '攻击5普通敌人', hp: 100, atk: 5 },
      { id: 'low-three', name: '第三个合资格普通敌人', hp: 100, atk: 3 },
    ] });
    const state = await useItem(0);
    expect(state.foes.map(foe => foe.dead)).toEqual([false, false, true, true, false]);
    expect(state.foes.filter(foe => !foe.dead).map(foe => [foe.id, foe.hp]))
      .toEqual([['boss', 100], ['high', 100], ['low-three', 100]]);
    expectItemConsumed(game, true);
  });

  it('未声明dmgType的混合药水保留固定2伤害，不吃法伤或spellUp', async () => {
    const game = await start('tt3-mixed-potion');
    game.spellPower = 7;
    Combat.addBlessing(runtime.pstat, 'spellUp', 9);
    Combat.addBlessing(runtime.foes[0], 'reduce', 1);
    const state = await useItem();
    expect(state.foes[0].hp).toBe(99); // 固定2减去1减伤，不能变成18点法伤。
    expect(state.foes[0].status.bleed).toBe(1);
    expectItemConsumed(game);
  });
});
