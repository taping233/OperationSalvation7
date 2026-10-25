import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Random } from '../game/src/core/random.js';
import { groupHandCards } from '../game/src/battle/core/battle.hand.js';
import { createBattleEquipment } from '../game/src/battle/bag/battle.equipment.js';
import { assertCardRulesExecutable } from '../game/src/battle/effects/battle.rule-guard.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(20, 99, 15, 2, 99, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const piles = await import('../game/src/battle/runtime/battle.runtime.piles.js');
const Cards = window.SDT.Cards;
let game, randomBefore;

beforeAll(() => {
  for (const name of ['ensureSha', 'ensureStarters', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) Cards[name]();
});

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function idle() {
  for (let i = 0; i < 200; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (!state.busy && !state.actionQueueLength) return state;
  }
  throw new Error('equipment skill action did not settle');
}
const canonical = id => {
  const card = Cards.all().find(entry => entry.id === id);
  if (!card) throw new Error(`missing card ${id}`);
  return structuredClone(card);
};

async function start(boss = true) {
  randomBefore = Random.snapshot();
  game = {
    ownedCards: ['tt2-treasuremap', 'starter-attack', 'tt5-galaxy-voyage', 'starter-attack', 'tt7-imitate']
      .map((id, index) => ({ uid: `equip-${index}`, card: canonical(id), safe: false })),
    inventory: [], usedPocket: [], ...playerFields(40, 40, 5, 0, '侠客', null),
    logs: [], log(message) { this.logs.push(message); }, heal() {}, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'equip-target', name: '验证靶', hp: 1000, atk: 0 }],
    { isBoss: boss, directBossStart: boss, name: '装备主动技能合成回归' });
  await idle();
}

async function wearMap(deck = ['equip-3', 'equip-4']) {
  // 固定本测试的内存牌序，复现“初始攻击/寻宝图/银河之旅”开手，不操作浏览器或存档。
  piles.set$hand(['equip-0', 'equip-1', 'equip-2']);
  piles.set$drawPile(deck);
  piles.set$discard([]);
  BattleSession.commands.playCard('equip-0', 'self');
  return idle();
}

afterEach(async () => {
  if (game?.battleActive) { BattleSession.commands.flee(); await idle(); }
  if (randomBefore) Random.restore(randomBefore);
  game = null;
  randomBefore = null;
});

describe('寻宝图真实 BattleSession 主动技能', () => {
  it('洗入1张、抽1张；连续点击和结算后重复点击均不重复发动', async () => {
    await start();
    const before = await wearMap();
    Random.reseed(1);
    BattleSession.commands.useEquipSkill('equip-0');
    BattleSession.commands.useEquipSkill('equip-0');
    const after = await idle();
    expect(piles.granted.filter(entry => entry.card.id === 'cmtn28jv33wx')).toHaveLength(1);
    expect(after.hand.length).toBe(before.hand.length + 1);
    expect(after.drawPile.length).toBe(before.drawPile.length);
    expect(after.equipped.find(entry => entry.uid === 'equip-0').used).toBe(true);
    expect(game.logs.filter(line => line.includes('主动技能发动'))).toHaveLength(1);
    expect(game.logs.some(line => line.includes('抽了 1 张牌'))).toBe(true);
    BattleSession.commands.useEquipSkill('equip-0');
    await idle();
    expect(BattleSession.getSnapshot().hand).toEqual(after.hand);
    expect(piles.granted.filter(entry => entry.card.id === 'cmtn28jv33wx')).toHaveLength(1);
  });

  it('可抽到已有初始攻击的同名牌，手牌总数增加而可见分组数不变', async () => {
    await start();
    const before = await wearMap();
    Random.reseed(3); // 当前 shuffle 随机流：抽到已有同名牌，宝箱仍留在牌库。
    const beforeGroups = groupHandCards(before.hand.map(uid => engine.findCard(uid)));
    BattleSession.commands.useEquipSkill('equip-0');
    const after = await idle();
    const gained = after.hand.filter(uid => !before.hand.includes(uid));
    expect(gained).toEqual(['equip-3']);
    expect(engine.findCard(gained[0]).card.id).toBe('starter-attack');
    const groups = groupHandCards(after.hand.map(uid => engine.findCard(uid)));
    expect(groups).toHaveLength(beforeGroups.length);
    expect(groups.find(group => group.card.id === 'starter-attack').uids).toEqual(['equip-1', 'equip-3']);
    const box = piles.granted.find(entry => entry.card.id === 'cmtn28jv33wx');
    expect(after.drawPile).toContain(box.uid);
    expect(after.hand.length).toBe(before.hand.length + 1);
  });

  it('牌库原本为空时抽到刚洗入的宝箱', async () => {
    await start();
    const before = await wearMap([]);
    BattleSession.commands.useEquipSkill('equip-0');
    const after = await idle();
    const gained = after.hand.filter(uid => !before.hand.includes(uid));
    expect(gained).toHaveLength(1);
    expect(engine.findCard(gained[0]).card.id).toBe('cmtn28jv33wx');
    expect(after.drawPile).toHaveLength(0);
  });

  it('普通战可装备寻宝图，并从本场10张实体牌库抽牌', async () => {
    await start(false);
    const before = BattleSession.getSnapshot();
    expect(engine.unplayableReason(engine.findCard('equip-0').card)).toBeNull();
    BattleSession.commands.playCard('equip-0', 'self');
    const worn = await idle();
    expect(worn.hand).toEqual(before.hand.filter(uid => uid !== 'equip-0'));
    expect(worn.equipped.map(entry => entry.uid)).toEqual(['equip-0']);
    BattleSession.commands.useEquipSkill('equip-0');
    const after = await idle();
    const gained = after.hand.filter(uid => !worn.hand.includes(uid));
    expect(gained).toHaveLength(1);
    const box = piles.granted.find(entry => entry.card.id === 'cmtn28jv33wx');
    expect([...worn.drawPile, box.uid]).toContain(gained[0]);
    expect(after.drawPile).toHaveLength(worn.drawPile.length);
    expect(piles.granted.filter(entry => entry.uid.startsWith('normal-sha-'))).toHaveLength(10);
    expect(after.energy).toBe(before.energy);
    expect(after.equipped[0].used).toBe(true);
  });
});

function skillHarness(card, run = async steps => { for (const step of steps) void step; }) {
  const worn = { uid: 'skill-fixture', card, used: false };
  piles.set$equipped([worn]);
  const synthetic = [];
  let pending;
  const runStagedSteps = vi.fn(run);
  const queueBattleAction = vi.fn(execute => { pending = Promise.resolve().then(() => execute(new AbortController().signal)); });
  const equipment = createBattleEquipment({
    clearTargetSession() {}, requestBattleRender() {},
    queueBattleAction,
    runStagedSteps, throwIfActionCancelled() {},
    *resolveCardSteps(value) { synthetic.push(value); assertCardRulesExecutable(value); yield value; },
    alive: () => [{ id: 'skill-target', hp: 100 }], sweepDead() {}, finish() {},
    processChoice() {}, processDiscoverQueue() {}, processHandSelect() {},
  });
  return { worn, synthetic, runStagedSteps, queueBattleAction, use() { equipment.useEquipSkill(worn.uid); return pending; } };
}

describe('结构化装备主动技能共同合成边界', () => {
  it('全部正式结构化主动装备生成合法onPlay，不修改卡面字段或原规则', async () => {
    await start();
    const cards = Cards.all().filter(card => card.rules?.equip?.skill?.ops?.length);
    expect(cards.map(card => card.id).sort()).toEqual(['tt2-treasuremap', 'tt3-holy-staff', 'tt3-light-mail', 'tt12-raygun',
      'tt3-fate-wheel', 'tt3-crimson-pouch', 'tt3-reverse-bow', 'tt3eq-mistbox', 'tt7-naturestaff', 'tt13-magazine'].sort());
    for (const source of cards) {
      const card = structuredClone(source);
      const original = JSON.stringify(card);
      const harness = skillHarness(card);
      await harness.use();
      expect(harness.synthetic, source.id).toHaveLength(1);
      expect(harness.worn.used, source.id).toBe(true);
      expect(JSON.stringify(card), source.id).toBe(original);
      const ops = harness.synthetic[0].rules.triggers.onPlay;
      expect(ops.every(op => !['heal', 'armor', 'draw'].includes(op.op) || op.amountField === undefined), source.id).toBe(true);
    }
  });

  it('结算失败保留次数并能重试，只有成功结算后才消耗本场次数', async () => {
    await start();
    const harness = skillHarness(canonical('tt2-treasuremap'));
    harness.runStagedSteps.mockRejectedValueOnce(new Error('injected equipment resolution failure'));
    await expect(harness.use()).rejects.toThrow('injected equipment resolution failure');
    expect(harness.worn.used).toBe(false);
    expect(game.logs.some(line => line.includes('本场次数未消耗'))).toBe(true);
    await harness.use();
    expect(harness.worn.used).toBe(true);
    await harness.use();
    expect(harness.runStagedSteps).toHaveBeenCalledTimes(2);
  });

  it('非法规则在任何效果前拒绝，不消耗次数也不掩盖字段错误', async () => {
    await start();
    const invalid = canonical('tt2-treasuremap');
    invalid.draw = 0;
    const harness = skillHarness(invalid);
    // 全卡预检已前移到动作入队前；拒绝信息保留具体字段，且不创建失败动作。
    expect(harness.use()).toBeUndefined();
    expect(game.logs.some(line => line.includes('规则格式非法') && line.includes('draw'))).toBe(true);
    expect(harness.worn.used).toBe(false);
    expect(harness.synthetic).toEqual([]);
    expect(harness.queueBattleAction).not.toHaveBeenCalled();
    expect(harness.runStagedSteps).not.toHaveBeenCalled();
  });
});
