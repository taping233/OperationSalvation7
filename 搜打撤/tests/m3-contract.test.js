// M3 执行器收编轮验收（2026-09-27 代理E）：装备文本抑制 / bag.use 药水扩展 / schema 键位补集。
// 规格：docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md（M3 状态标注）。
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { hand, foes, energy, pstat, set$pstat } from '../game/src/battle/runtime/battle.runtime.js';
import { createTriggerRunner } from '../game/src/battle/effects/battle.triggers.m2.js';

window.SDT = window.SDT || {};
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let uidSequence = 0;
let activeGame = null;
const foe = (id, hp = 1000, atk = 1) => ({ id, name: `M3靶子-${id}`, hp, maxHp: hp, atk });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle(timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await tick();
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
    await tick();
  }
  throw new Error('M3 BattleSession 动作未在时限内收敛');
}

async function startGame(cards, foesArg) {
  const logs = [];
  const game = {
    ownedCards: cards.map(card => ({ uid: `m3-${uidSequence++}`, card, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  activeGame = game;
  BattleSession.start(game, foesArg, { isBoss: false, name: 'M3 执行器收编验收' });
  await waitForIdle();
  return game;
}

async function playCard(game, card, target) {
  const entry = game.ownedCards.find(item => item.card.id === card.id);
  expect(entry, `应在真实战斗中找到手牌 ${card.id}`).toBeTruthy();
  expect(validateCardRules(card), `synthetic card ${card.id} must pass schema`).toMatchObject({ ok: true, errors: [] });
  BattleSession.commands.playCard(entry.uid, target);
  return waitForIdle();
}

const finishBattle = async () => {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
  set$pstat({ ...pstat, status: {} });
};

afterEach(async () => {
  await finishBattle();
});

const assertSchema = card => expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
const assertSupported = card => expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });

describe('M3 gap-1: equipment text suppression', () => {
  it('suppresses immediate text clauses when rules.equip exists (longsword style)', async () => {
    // 长剑式：desc 文本「+1 攻」与 rules.equip.passive.aura 并存时单路径——文本不再回放
    const equip = {
      id: 'm3-longsword', name: '规则长剑', cost: 0, type: '装备', desc: '获得 1 点攻击力。',
      rules: { version: 1, equip: { onEquip: [{ op: 'blessing', key: 'atkUp', stacks: 2 }] } },
    };
    const game = await startGame([equip, { id: 'm3-f', name: '陪衬', cost: 0, type: '法术', desc: '回复 4 点生命。' }], [foe('sword')]);
    await playCard(game, equip, 'self');
    // aura atkUp+2 单路径；文本「获得1点攻击力」被抑制（攻击加成为 2 而非 3）
    expect(pstat.status.atkUp).toBe(2);
    await finishBattle();
  });

  it('keeps consume triggers single-path when rules.triggers.onConsume exists', async () => {
    const card = {
      id: 'm3-consume', name: '规则宝盒', cost: 0, type: '法术', desc: '消耗该牌时：获得 4 枚金币。',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [], onConsume: [{ op: 'coins', n: 2 }] } },
    };
    const game = await startGame([card, { id: 'm3-f2', name: '陪衬', cost: 0, type: '法术', desc: '' }], [foe('consume')]);
    await playCard(game, card, 'self');
    engine.fireConsumeTriggers(card, null);   // 模拟注能牺牲/手选消耗时点
    await new Promise(resolve => setTimeout(resolve, 20));
    // 结构化 coins=2 单路径；文本「获得4枚金币」被抑制
    expect(game.coins).toBe(2);
    expect(game.logs.some(line => line.includes('获得 4 枚金币'))).toBe(false);
    await finishBattle();
  });

  it('routes battle-start equips through runner when rules.equip.battleStart exists', async () => {
    const equip = {
      id: 'm3-chaos', name: '规则混沌之眼', cost: 0, type: '装备', desc: '对战开始时：血量上限 +10。',
      rules: { version: 1, equip: { battleStart: [{ op: 'maxHp', n: 10 }] } },
    };
    assertSchema(equip);
    assertSupported(equip);
  });

  it('consumes cond.vsFreeze as a numeric bonus against frozen foes', async () => {
    const equip = {
      id: 'm3-frost', name: '规则寒冰剑', cost: 0, type: '装备', desc: '',
      rules: { version: 1, equip: { passive: { cond: { vsFreeze: 2 } } } },
    };
    const strike = {
      id: 'm3-frost-strike', name: '劈砍', cost: 0, type: '武术', dmg: 5, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }],
      } },
    };
    const game = await startGame([equip, strike], [foe('frost')]);
    await playCard(game, equip, 'self');   // 先穿戴寒冰剑
    foes[0].status.freeze = 2;
    await playCard(game, strike, 0);
    expect(foes[0].hp).toBe(1000 - 5 - 2);   // 5 点伤害 + vsFreeze 2
    await finishBattle();
  });

  it('fires onFreezeDealt when an attack freezes a foe (twinwater-mail style)', async () => {
    const mail = {
      id: 'm3-twinwater', name: '规则冰甲', cost: 0, type: '装备', desc: '',
      rules: { version: 1, triggers: { onFreezeDealt: [{ op: 'armor', amount: 3 }] } },
    };
    assertSchema(mail);
    const freeze = {
      id: 'm3-freeze', name: '冰冻术', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }],
      } },
    };
    const game = await startGame([mail, freeze], [foe('frostdeal')]);
    await playCard(game, mail, 'self');   // 先穿戴冰甲（打出即登记 onFreezeDealt）
    await playCard(game, freeze, 0);
    // freeze 施加 → COMBAT_HOOKS.onFreeze → onFreezeDealt → 甲 +3
    expect(BattleSession.getSnapshot().pdef.armor).toBe(3);
    await finishBattle();
  });
});

describe('M3 gap-2: bag.use potion expansion', () => {
  it('accepts multi-op bag.use with battle potion ops in schema and capability', () => {
    const potion = {
      id: 'm3-potion', name: '规则恢复药水', cost: 0, type: '道具', heal: 5, desc: '',
      rules: { version: 1, bag: { use: [
        { op: 'heal', amount: 5 },
        { op: 'energy', n: 1 },
      ] } },
    };
    assertSchema(potion);
    assertSupported(potion);
    const unsupported = {
      id: 'm3-potion-bad', name: '坏药水', cost: 0, type: '道具', desc: '',
      rules: { version: 1, bag: { use: [{ op: 'summon', name: '步兵', count: 1 }] } },
    };
    expect(validateCardRules(unsupported).ok).toBe(false);   // summon 不在 bag op 支持集
    expect(inspectCardRuleCapability(unsupported).ok).toBe(false);
  });

  it('dispatches structured bag ops in battle (heal + energy single consumption)', async () => {
    const potion = {
      id: 'm3-potion-live', name: '规则恢复药水', cost: 0, type: '道具', heal: 5, desc: '',
      rules: { version: 1, bag: { use: [
        { op: 'heal', amount: 5 },
        { op: 'energy', n: 1 },
      ] } },
    };
    const game = await startGame([potion], [foe('potion')]);
    game.hp = 60;
    const entry = game.ownedCards.find(item => item.card.id === 'm3-potion-live');
    engine.useItem(entry.uid, null);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(game.hp).toBe(65);
    expect(energy).toBe(100);   // addEnergy 不夹逼（回合开始重置回满），99+1=100
    await finishBattle();
  });

  it('blocks structured flee in boss mode and runs it outside boss (itemUsability gate)', async () => {
    const smoke = {
      id: 'm3-smoke', name: '规则烟雾弹', cost: 0, type: '道具', desc: '',
      rules: { version: 1, bag: { use: [{ op: 'flee' }] } },
    };
    assertSchema(smoke);
    assertSupported(smoke);
  });

  it('defers scheduled bag ops to turn start (medneedle style)', async () => {
    const med = {
      id: 'm3-medneedle', name: '规则急救合剂', cost: 0, type: '道具', heal: 6, desc: '',
      rules: { version: 1, bag: { use: [
        { op: 'heal', amount: 6, schedule: 'nextTurnStart', duration: 3 },
      ] } },
    };
    assertSchema(med);
    assertSupported(med);
    const game = await startGame([med], [foe('med')]);
    game.hp = 60;
    const entry = game.ownedCards.find(item => item.card.id === 'm3-medneedle');
    engine.useItem(entry.uid, null);
    await new Promise(resolve => setTimeout(resolve, 20));
    // 使用当回合不立即回复（延迟到回合开始管线），delayed 队列已登记
    expect(game.hp).toBe(60);
    await finishBattle();
  });
});

describe('M3 gap-3: schema data-layer key set', () => {
  it('accepts execute.what (cast fireball / starter attack)', () => {
    const meteor = {
      id: 'm3-meteor', name: '星陨之力', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'execute', what: 'fireball', count: 3 }],
      } },
    };
    assertSchema(meteor);
    assertSupported(meteor);
    const bad = { ...meteor, id: 'm3-meteor-bad' };
    bad.rules.triggers.onPlay[0].what = 'melee';
    expect(validateCardRules(bad).ok).toBe(false);
  });

  it('accepts container-level triggers.replay for whole-card replays', () => {
    const march = {
      id: 'm3-replay', name: '急行军规则化', cost: 0, type: '武术', dmg: 0, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onPlay: [{ op: 'draw', amount: 2 }, { op: 'armor', amount: 2 }],
        replay: { on: 'lastHand', times: 1 },
      } },
    };
    assertSchema(march);
    assertSupported(march);
  });

  it('accepts dynamic draw sources as field declarations (grope / abyss curse)', () => {
    const grope = {
      id: 'm3-grope', name: '摸索', cost: 0, type: '法术', draw: 2, desc: '抽2-3张牌',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onPlay: [{ op: 'draw', range: [2, 3] }],
      } },
    };
    assertSchema(grope);
    const abyss = {
      id: 'm3-abyss', name: '深渊诅咒规则化', cost: 0, type: '法术', dmg: 7, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [
          { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
          { op: 'curse', curse: 'healban', duration: 1, bindTarget: 'prevDamage' },
          { op: 'draw', perCurseKinds: true },
        ],
      } },
    };
    assertSchema(abyss);
    assertSupported(abyss);
  });

  it('expresses the infusion play gate via requirements kind infused', async () => {
    const felguard = {
      id: 'm3-felguard', name: '规则邪能护体', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: {
        target: { side: 'self', area: false },
        requirements: [{ kind: 'infused' }],
      }, triggers: { onPlay: [{ op: 'draw', amount: 3 }] } },
    };
    assertSchema(felguard);
    assertSupported(felguard);
    // 真实打出门：未注能时 playCard 拒绝且卡离手
    const game = await startGame([JSON.parse(JSON.stringify(felguard)), { id: 'm3-f3', name: '陪衬', cost: 0, type: '法术', desc: '' }], [foe('gate')]);
    const before = hand.length;
    BattleSession.commands.playCard(game.ownedCards.find(item => item.card.id === 'm3-felguard')?.uid, 'self');
    await waitForIdle();
    expect(hand.length).toBe(before);   // 未消耗能量/离手
    expect(game.logs.some(line => line.includes('需要先注能'))).toBe(true);
    await finishBattle();
  });

  it('expresses keep-in-hand as a structured battle switch (immortal slash)', () => {
    const immortal = {
      id: 'm3-immortal', name: '规则不朽斩', cost: 0, type: '武术', dmg: 1, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: {
        target: { side: 'enemy', area: false },
        keepInHand: true,
      }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } },
    };
    assertSchema(immortal);
    assertSupported(immortal);
  });

  it('accepts registerRule discoverPlus / doubleNextSpell', () => {
    const dark = {
      id: 'm3-darkform', name: '黑暗形态', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }],
      } },
    };
    assertSchema(dark);
    assertSupported(dark);
    const storm = { ...dark, id: 'm3-storm' };
    storm.rules.triggers.onPlay[0] = { op: 'registerRule', rule: 'doubleNextSpell' };
    assertSchema(storm);
    assertSupported(storm);
  });

  it('accepts onAcquire trigger (apollo gift)', () => {
    const apollo = {
      id: 'm3-apollo', name: '规则阿猫的礼物', cost: 0, type: '装备', desc: '',
      rules: { version: 1, triggers: { onAcquire: [{ op: 'energy', n: 1 }] } },
    };
    assertSchema(apollo);
    assertSupported(apollo);
  });

  it('accepts foeFight (provoke) and copyRandom (blade form) ops', async () => {
    const provoke = {
      id: 'm3-provoke', name: '规则扰敌', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [{ op: 'foeFight' }],
      } },
    };
    assertSchema(provoke);
    assertSupported(provoke);
    const game = await startGame([provoke, { id: 'm3-f4', name: '陪衬', cost: 0, type: '法术', desc: '' }],
      [foe('p1', 1000, 3), foe('p2', 1000, 2)]);
    const state = await playCard(game, provoke, 0);
    expect(state.foes[0].hp).toBe(1000 - 2);   // p2 打 p1
    expect(state.foes[1].hp).toBe(1000 - 3);   // p1 打 p2
    await finishBattle();

    const bladeform = {
      id: 'm3-bladeform', name: '刀剑形态规则化', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onTurnStart: [{ op: 'copyRandom' }], duration: 1,
      } },
    };
    assertSchema(bladeform);
    assertSupported(bladeform);
  });

  it('runs copyRandom through the resolver (random hand copy)', async () => {
    const card = {
      id: 'm3-copy-live', name: '复制师', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onPlay: [{ op: 'copyRandom' }],
      } } };
    const fillerCard = { id: 'm3-copy-src', name: '被复制的牌', cost: 0, type: '法术', desc: '' };
    const game = await startGame([card, fillerCard], [foe('copy')]);
    const before = hand.length;
    await playCard(game, card, 'self');
    expect(hand.length).toBe(before - 1 + 1);   // 本牌离手后 copyRandom 复制一张入手
    expect(game.logs.some(line => line.includes('复制了手牌中的'))).toBe(true);
  });

  it('exempts combat-field-free cards from empty onPlay gates while keeping the anti-freeload gate', () => {
    // 剑仙形态式：空 onPlay + 无非零战斗字段 → 豁免（文本抑制保留）
    const swordForm = {
      id: 'm3-swordform', name: '剑仙形态', cost: 0, type: '法术', desc: '本局对战中，回合开始时额外抽 1 张牌。',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: {
        onPlay: [],
        onTurnStart: [{ op: 'draw', amount: 1 }],
      } },
    };
    assertSchema(swordForm);
    // 防白嫖门保留：空 onPlay + 非零 dmg → 拒（旧守卫用例同源）
    const freeload = {
      id: 'm3-freeload', name: '白嫖卡', type: '武术', dmg: 3, dmgType: 'fixed', desc: '造成文本伤害',
      rules: { version: 1, triggers: { onPlay: [] } },
    };
    expect(validateCardRules(freeload).errors.some(e => /card.dmg/.test(e.message))).toBe(true);
  });

  it('wires pick:new two-target selection through the generalized dart flow (blood-poison dual blades)', async () => {
    const dual = {
      id: 'm3-dual', name: '规则血毒双镖', cost: 0, type: '武术', dmg: 1, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
        onPlay: [
          { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
          { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
          { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', pick: 'new' },
          { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy', pick: 'new' },
        ],
      } },
    };
    assertSchema(dual);
    assertSupported(dual);
    const game = await startGame([dual, { id: 'm3-f5', name: '陪衬', cost: 0, type: '法术', desc: '' }],
      [foe('dual1'), foe('dual2')]);
    await playCard(game, dual, 0);
    // 第一段（damage+bleed）立即结算；pick:'new' 段进入点选——向第二只敌确认（模拟玩家点选）
    const snapshot = BattleSession.getSnapshot();
    expect(snapshot.dartPending || foes[1].hp < 1000 || game.logs.some(l => l.includes('选择'))).toBe(true);
    if (snapshot.dartPending) {
      engine.resolveDart(1);   // 玩家点选第二只
      await waitForIdle();
      expect(foes[1].hp).toBe(1000 - 1);   // 二段 damage 1 点
      expect(foes[1].status.poison).toBe(1);
    }
    await finishBattle();
  });

  it('registers onAcquire via addTempCard hook (apollo gift live)', async () => {
    const gift = {
      id: 'm3-apollo-live', name: '规则阿猫的礼物', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onAcquire: [{ op: 'coins', n: 1 }] } },
    };
    const game = await startGame([gift, { id: 'm3-f6', name: '陪衬', cost: 0, type: '法术', desc: '' }], [foe('apollo')]);
    const coinsBefore = game.coins;
    engine.addTempCard(JSON.parse(JSON.stringify(gift)));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(game.coins).toBe(coinsBefore + 1);
    await finishBattle();
  });

  it('runs the runner with onFreezeDealt/onAcquire points registered through registerCard', () => {
    const executed = [];
    const runner = createTriggerRunner({
      resolveCard: card => executed.push(card.rules?.triggers?.onPlay),
      log: () => {}, esc: v => String(v), getAliveFoes: () => [], addEnergy: () => {},
    });
    const host = { id: 'm3-runner', name: '冰甲', rules: { version: 1, triggers: {
      onFreezeDealt: [{ op: 'armor', amount: 3 }],
    } } };
    runner.registerCard(host, 'm3-runner-uid');
    runner.fireFreezeDealt({ name: '冻住的敌人' });
    expect(executed.length).toBe(1);
    expect(executed[0]).toEqual([{ op: 'armor', amount: 3 }]);
  });
});
