// 09-30 全仓深审 BC-01~10 的修复回归（发现来源：
// docs/evidence/2026-09-30-full-repository-review/battle_cards/findings.json，
// 复现手法沿用其 battle.repro.test.js 的可达路径，断言反转成修复后行为）。
import { describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 },
  items: {},
};
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, getPreviewContext } = await import('../game/src/battle/core/battle.core.js');
const { previewAction } = await import('../game/src/battle/view/battle.preview.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

const waitIdle = async () => {
  for (let n = 0; n < 600; n++) { await new Promise(r => setTimeout(r, 5)); if (!R.busy) return; }
  throw Error('battle action queue timeout');
};

let seq = 0;
function makeGame(cards) {
  return {
    ownedCards: cards.map(card => ({ uid: `rev-${++seq}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
}
function begin(cards, boss = false) {
  const g = makeGame(cards);
  BattleSession.start(g, [{ id: 'dummy', name: '靶子', hp: 1000, atk: 1 }], { isBoss: boss, name: 'review-regression' });
  if (boss) {
    g.ownedCards.forEach(o => BattleSession.commands.selectDeckCard(o.uid));
    BattleSession.commands.confirmDeck();
  }
  return g;
}
const basic = (id, type = '武术') => ({ id, name: id, cost: 0, type, rarity: '古朴', dmg: 1, dmgType: 'fixed', desc: '造成1点固定伤害。' });

describe('09-30 深审 BC 组修复回归', () => {
  it('BC-01 极速符文：打出最左牌后继续回合结束（敌方阶段走完、回合推进）', async () => {
    const g = begin([basic('swift-card'), basic('spare')]);
    R.applyRuneFlag('swift');
    BattleSession.commands.endTurn();
    await waitIdle();
    expect(R.played).toHaveLength(1);          // 最左牌已打出
    expect(R.turn).toBe(2);                    // 回合推进（此前卡在 1）
    expect(R.battleState.phase).toBe('player'); // 敌方阶段走完回玩家
    expect(g.hp).toBe(99);                     // 靶子 atk1 已行动（此前敌方阶段被跳过）
  });

  it('BC-02 灰烬符文：满手直释的牌进入弃牌堆（UID 不再消失）', () => {
    const cards = Array.from({ length: 10 }, (_, i) => basic(`ash-${i}`));
    const g = begin(cards, true);
    R.applyRuneFlag('ash');
    R.set$hand(g.ownedCards.slice(0, 9).map(o => o.uid));
    const uid = g.ownedCards[9].uid;
    R.set$drawPile([uid]);
    R.set$discard([]);
    E.drawCards(1);
    expect(R.foes[0].hp).toBe(999);   // 直释已发生
    expect(R.discard).toContain(uid); // 此前 locations 为空——UID 从所有牌区消失
  });

  it('BC-03 武装：牌库没有装备时不再凭空生成随机装备', async () => {
    const arm = C.all().find(c => c.id === 'tt7-armup');
    const g = begin([arm, basic('plain')], true);
    R.set$hand([g.ownedCards[0].uid]);
    R.set$drawPile([g.ownedCards[1].uid]);   // 牌库只有一张普通武术
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await waitIdle();
    const created = R.hand.map(uid => E.findCard(uid)?.card).filter(c => c?.type === '装备');
    expect(created).toHaveLength(0);   // 此前凭空生成 2 张套牌外装备
    expect(R.granted).toHaveLength(0);
  });

  it('BC-04 挖宝：护甲按所选发现牌价格结算（不再取前次抽牌价格）', async () => {
    const dig = C.all().find(c => c.id === 'tt3-dig-treasure');
    const loot = { ...basic('loot'), cost: 9, value: 9 };
    const g = begin([dig, loot], true);
    R.set$hand([g.ownedCards[0].uid]);
    R.set$drawPile([g.ownedCards[1].uid]);
    R.set$lastDrawnUids([]);   // 前次抽牌为空：旧实现在排队时取价会得 0
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await waitIdle();
    expect(R.pdef.armor).toBe(0);   // 选牌前不结算
    BattleSession.commands.pickDiscover(0);
    expect(R.pdef.armor).toBe(C.sellPrice(loot));   // 按所选牌价格
    expect(R.pdef.armor).toBe(9);
  });

  it('BC-05 搜索大宝箱：牌库底三选一后不再追加随机发现', async () => {
    const chest = C.all().find(c => c.id === 'cmtn28jv33wx');
    const g = begin([chest, basic('bottom1'), basic('bottom2'), basic('bottom3')], true);
    R.set$hand([g.ownedCards[0].uid]);
    R.set$drawPile(g.ownedCards.slice(1).map(o => o.uid));
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await waitIdle();
    expect(R.discovering?.options.map(c => c.name)).toEqual(['bottom1', 'bottom2', 'bottom3']);
    BattleSession.commands.pickDiscover(0);
    expect(R.discovering).toBeNull();   // 此后又排队 2 次随机发现
    expect(R.drawPile.map(uid => E.findCard(uid)?.card?.name)).toEqual(['bottom2', 'bottom3']);   // 其余按原序放回牌库底
  });

  it('BC-06 正午决战：下回合开始四枪真实结算且延迟段清空', async () => {
    const duel = C.all().find(c => c.id === 'tt3-noon-duel');
    const g = begin([duel]);
    BattleSession.commands.playCard(g.ownedCards[0].uid, 0);
    await waitIdle();
    const before = R.foes[0].hp;
    BattleSession.commands.endTurn();
    await waitIdle();
    expect(R.turn).toBe(2);
    expect(R.foes[0].hp).toBe(before - 8);   // 4 段 × 2 固定伤害（此前 TypeError 整段失效）
    expect(R.delayed).toHaveLength(0);       // 一次性延迟段已消费，不再残留
  });

  it('BC-07 黑暗形态：发现只选 1 张（此前误把选择次数 +1 多获得一张）', async () => {
    const dark = C.all().find(c => c.id === 'cmtn1r10xnl1');
    const discovery = C.all().find(c => c.id === 'tt2-jianghu');
    const g = begin([dark, discovery]);
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await waitIdle();
    BattleSession.commands.playCard(g.ownedCards[1].uid, 'self');
    await waitIdle();
    // 候选数下限 3（全量并行下卡池被前序文件改小时 options 可能凑不满 4）；
    // 新旧行为的分界是 n：旧实现入队 n+1=2（选 2 张），修复后恒为 1
    expect(R.discovering?.options.length).toBeGreaterThanOrEqual(3);
    expect(R.discovering?.n).toBe(1);
    // 「其它职业」池允许职业特例（battle.resolution.js:279），永恒绽放类「选中即施放→
    // 重开自己的发现面板」（onPlay acquire dest:'discover' act:'playKeep'）候选会被随机
    // 抽进 options（实测 30 连跑 1 红）：本回归只钉「选 1 张后清场」，pick 时绕开发现链候选
    const reopensDiscover = option => /发现/.test(option.desc || '') ||
      (option.rules?.triggers?.onPlay || []).some(step =>
        step.op === 'acquire' ? (step.dest ?? 'discover') === 'discover' : step.op === 'discover');
    const cleanIdx = R.discovering.options
      .map((option, i) => [option, i]).filter(([o]) => !reopensDiscover(o)).map(([, i]) => i);
    expect(cleanIdx.length, '候选全为发现链卡，无法安全 pick').toBeGreaterThan(0);
    BattleSession.commands.pickDiscover(cleanIdx[0]);
    await waitIdle();
    expect(R.discovering).toBeNull();
  });

  it('BC-08 连续射击预览：动态段数降级 unknown（不再给错误的 exact 数字）', async () => {
    const rapid = C.all().find(c => c.id === 'cc-rapid-fire');
    const g = begin([basic('p1'), basic('p2'), rapid]);
    for (const o of g.ownedCards.slice(0, 2)) {
      BattleSession.commands.playCard(o.uid, 0);
      await waitIdle();
    }
    const uid = g.ownedCards[2].uid;
    const result = previewAction({ snapshot: BattleSession.getSnapshot(), action: { uid, targetIndex: 0 }, cardContext: getPreviewContext(uid, 0) });
    expect(result.confidence).toBe('unknown');   // 此前 exact 且数字错一倍
    expect(result.damage).toBeNull();
  });

  it('BC-09 员工通行证B：消耗后真实获得一张传说卡（不再白耗）', async () => {
    const token = C.all().find(c => c.id === 'tt-token-gold');
    const g = begin([token, basic('token-spare')]);
    const uid = g.ownedCards[0].uid;
    BattleSession.commands.useItem(uid);
    await waitIdle();
    expect(g.ownedCards.some(o => o.uid === uid)).toBe(false);   // 母本已消耗
    expect(R.granted).toHaveLength(1);                            // 此前 0——道具白耗
    expect(R.granted[0].card.rarity).toBe('传说');
    expect(R.discovering).toBeNull();
    expect(R.discoverQueue).toHaveLength(0);                      // 此前残留 1 个无人消费的 job
  });

  it('BC-10 饮血剑：AOE 双杀 +2、砸击第三杀累计 +3（多杀与 null 来源不再漏计）', async () => {
    const sword = C.all().find(c => c.id === 'tt3-blooddrinker');
    const aoe = { ...basic('aoe-kill'), rules: { version: 1, battle: { target: { side: 'enemy', area: true } }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }] } } };
    const g = makeGame([sword, aoe]);
    BattleSession.start(g, [1, 1, 3, 1000].map((hp, i) => ({ id: `multi-${i}`, name: `multi-${i}`, hp, atk: 1 })), { isBoss: false, name: 'kill-regression' });
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await waitIdle();
    BattleSession.commands.playCard(g.ownedCards[1].uid, 0);
    await waitIdle();
    expect(R.foes.filter(f => f.dead)).toHaveLength(2);
    expect(R.pstat.status.atkUp).toBe(2);   // 双杀 +2（此前只 +1）
    BattleSession.commands.bagSlam();
    BattleSession.commands.resolveSlam(2);   // 砸击第三杀（null source，此前不触发）
    await waitIdle();
    expect(R.pstat.status.atkUp).toBe(3);
  });
});
