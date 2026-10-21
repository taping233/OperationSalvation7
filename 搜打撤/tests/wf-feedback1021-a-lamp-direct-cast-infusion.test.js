/* 反馈#5（2026-10-21 老板实测 12 条）复现与回归：
 * (a)「神灯的描述一和效果改为发现招式」——定版文案、抉择标签、招式池三处同步；
 * (b)「直接释放词条的效果要把注能视为已注能」（老板 10-21 补充口径：是需求不是 bug）：
 *     直接释放/直接施放词条释放注能卡时视为已注能——允许释放、按已注能效果结算、
 *     不消耗注能材料、不因缺注能被拦；留手规则仅保留给不含释放动作的纯发现效果。
 * 复现场景：神灯抉择 ①（acquire act:'play' → 发现面板直接施放）分别拿到
 *   A 可选注能招式：基础效果与注能加成都生效；
 *   B 纯注能招式：直接施放并按已注能效果结算，不留手。
 * 判定口径同 docs/rules.md：直接释放视为已注能，不消耗材料或增加材料计数；
 * 仅免能量的普通施放仍不自动满足注能条件。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { targetSideFor } from '../game/src/battle/effects/battle.target-rules.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 3, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, infuseOf } = await import('../game/src/battle/core/battle.core.js');
const { findCard } = await import('../game/src/battle/core/battle.engine.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { Random } = await import('../game/src/core/random.js');
const { dataSlice } = await import('../game/src/cards/cards.data.js');
const { BUILTIN_CHOICE_REVISIONS } = await import('../game/src/cards/builtin-choice-execution.js');
const { displayCardDescription } = await import('../game/src/cards/card-description-text.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards, myClass = '侠客') {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
    myClass, characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
  return g;
}
const foeDef = () => ({ id: 'infantry', name: '直释注能靶', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = ms => new Promise(r => setTimeout(r, ms));
const snap = () => BattleSession.getSnapshot();
const logsJoin = g => g.logs.join('\n');
const sideFor = c => {
  const side = targetSideFor(c, C.DMG_TYPES);
  return side === 'enemy' ? 0 : side === 'self' ? 'self' : undefined;
};
const endBattle = g => { try { if (g.battleActive && !snap().busy) BattleSession.commands.flee(); } catch { /* 已终局 */ } };

async function drain(maxLoops = 300, stopPanel = false) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (stopPanel && (s.discovering || s.handSelecting || s.choosing)) return s;
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  return snap();
}

// 可选注能招式：基础 5 伤，注能(1) 时 +3（infuseBonus 声明消费卡面 infuse）
const OPTIONAL = {
  id: 'wf-opt-infuse', name: '直释可选注能靶', type: '法术', cost: 1, rarity: '稀有',
  dmg: 5, dmgType: 'spell', infuse: 1, desc: '造成5点法术伤害；注能(1)：伤害+3。',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amount: 5, target: 'chosenEnemy', infuseBonus: 3 }] } },
};
// 纯注能招式：只有注能后才有效果（文本路径，requiresInfusion 判定）
const PURE = {
  id: 'wf-pure-infuse', name: '直释纯注能靶', type: '法术', cost: 1, rarity: '稀有',
  infuse: 1, heal: 7, desc: '注能（1）：回复7点生命',
};

const lamp = () => C.all().find(card => card.id === 'tt3-magic-lamp');

/** 神灯抉择 ①：固定候选池后开打，返回发现面板与所选候选 id。 */
async function lampChoiceOne(pool) {
  const g = makeGame([lamp()], '侠客');
  BattleSession.start(g, [foeDef()], { isBoss: false, name: '直释注能审计' });
  await drain();
  const randomBefore = Random.snapshot();
  const spy = vi.spyOn(C, 'all').mockReturnValue(pool);
  try {
    Random.reseed('wf-lamp-infusion');
    BattleSession.commands.playCard(g.ownedCards[0].uid, sideFor(lamp()));
    let s = await drain(300, true);
    expect(s.choosing, '神灯应先进入抉择').toBeTruthy();
    const choiceLabels = [...(s.choosing.options || [])];
    BattleSession.commands.pickChoice(0);   // ① 发现（直接施放）
    s = await drain(300, true);
    expect(s.discovering, '抉择①应打开发现面板').toBeTruthy();
    return { g, state: s, choiceLabels };
  } finally {
    spy.mockRestore();
    Random.restore(randomBefore);
  }
}

describe('反馈#5(b) 直接释放注能卡视为已注能（老板 10-21 定版口径）', () => {
  it('神灯①直接施放可选注能招式：按已注能效果结算（5+注能3+法伤2=10），材料不消耗', async () => {
    expect(infuseOf(OPTIONAL)).toBe(1);
    const { g, state } = await lampChoiceOne([lamp(), OPTIONAL, PURE]);
    const index = state.discovering.options.findIndex(card => card.id === OPTIONAL.id);
    expect(index, '候选池应含可选注能靶').toBeGreaterThanOrEqual(0);
    const hpBefore = snap().foes[0].hp;
    BattleSession.commands.pickDiscover(index);
    await drain();
    const dealt = hpBefore - snap().foes[0].hp;
    // 视为已注能 → 注能(1) 的 +3 加成生效：基础 5 + 3 + 法伤 2 = 10
    expect(dealt, `直释注能卡应按已注能结算（5+3+法伤2=10），实际 ${dealt}`).toBe(10);
    expect(logsJoin(g)).toContain('并直接施放');
    expect(logsJoin(g), '注能卡直释应提示视为已注能').toContain('视为已注能');
    expect(R.infuseFuels, '视为已注能：不消耗注能材料、不增加累计计数').toBe(0);
    endBattle(g);
    await drain();
  });

  it('神灯①遇纯注能招式：视为已注能直接施放（不再留手），效果照常结算', async () => {
    expect(infuseOf(PURE)).toBe(1);
    const { g, state } = await lampChoiceOne([lamp(), PURE, OPTIONAL]);
    const index = state.discovering.options.findIndex(card => card.id === PURE.id);
    expect(index, '候选池应含纯注能靶').toBeGreaterThanOrEqual(0);
    g.hp = 50;   // 留出回复空间，观察已注能效果结算
    BattleSession.commands.pickDiscover(index);
    await drain();
    const s = snap();
    expect(logsJoin(g)).toContain('并直接施放');
    expect(logsJoin(g), '注能卡直释应提示视为已注能').toContain('视为已注能');
    expect(logsJoin(g), '纯注能牌不再未注能留手').not.toContain('未施放，保留在手牌中等待注能');
    expect(g.hp, '纯注能牌按已注能结算：回复 7 点生命').toBe(57);
    expect(s.consumedPile.filter(uid => findCard(uid)?.card.id === PURE.id), '直释后进入消耗牌堆').toHaveLength(1);
    endBattle(g);
    await drain();
  });

  it('灰烬符文满手直释：注能卡视为已注能直接释放并按注能效果结算', async () => {
    const game = makeGame([PURE], '侠客');
    const uid = game.ownedCards[0].uid;
    BattleSession.start(game, [foeDef()], { isBoss: true, name: '灰烬直释注能审计' });
    await drain();
    if (snap().deckSelection) {
      for (const entry of snap().deckSelection.cards) BattleSession.commands.selectDeckCard(entry.uid);
      BattleSession.commands.confirmDeck();
      await drain();
    }
    // 固定满手与牌库边界，走正式抽牌/灰烬直释路径
    game.hp = 50;
    R.set$mode('boss');
    R.set$hand(Array.from({ length: 9 }, (_, i) => `full-${i}`));
    R.set$drawPile([uid]);
    R.set$discard([]);
    R.applyRuneFlag('ash');
    R.set$allSpellsInfused(false);
    const drawn = E.drawCards(1);
    expect(drawn, '满手直释应释放该注能卡').toBe(1);
    expect(R.discard, '直释视同已打出：进入弃牌/消耗簿记').toContain(uid);
    expect(game.hp, '视为已注能：纯注能牌效果照常结算（回复 7）').toBe(57);
    endBattle(game);
    await drain();
  });
});

describe('反馈#5(a) 神灯第 1 项改为发现招式', () => {
  it('定版两处定义与展示文案同步为「发现招式」，抉择标签与招式池一致', () => {
    const canonical10 = dataSlice.TABLETOP10.find(card => card.id === 'tt3-magic-lamp');
    const canonical3 = dataSlice.TABLETOP3.find(card => card.id === 'tt3-magic-lamp');
    expect(canonical10.desc).toContain('发现招式');
    expect(canonical3.desc).toContain('发现招式');
    expect(canonical10.desc).not.toContain('发现 1 张牌');
    const choice = BUILTIN_CHOICE_REVISIONS['tt3-magic-lamp'].rules.triggers.onPlay[0];
    expect(choice.options[0].label).toContain('发现招式');
    expect(choice.options[0].ops[0]).toMatchObject({ op: 'acquire', pool: { kind: '招式' }, dest: 'discover', act: 'play' });
    // 展示层：reviewed 文案同样只说招式
    expect(displayCardDescription(canonical10.desc, 'tt3-magic-lamp', canonical10)).toContain('招式');
    expect(displayCardDescription(canonical10.desc, 'tt3-magic-lamp', canonical10)).not.toContain('张卡牌');
  });

  it('抉择①发现面板只给招式（武术/法术），装备与道具不进池', async () => {
    const move = { id: 'wf-lamp-move', name: '直释招式靶', type: '武术', cost: 1, rarity: '古朴', dmg: 1, dmgType: 'attack', desc: '造成 1 点攻击伤害' };
    const equip = { id: 'wf-lamp-equip', name: '直释装备靶', type: '装备', cost: 1, rarity: '古朴', desc: '装备：无效果' };
    const item = { id: 'wf-lamp-item', name: '直释道具靶', type: '道具', cost: 1, rarity: '古朴', desc: '无效果' };
    const { g, state, choiceLabels } = await lampChoiceOne([lamp(), move, equip, item]);
    expect(choiceLabels[0], '抉择标签应为发现招式').toContain('发现招式');
    const optionIds = state.discovering.options.map(card => card.id);
    expect(optionIds).toContain(move.id);
    expect(optionIds.some(id => id === equip.id || id === item.id),
      '装备/道具不得进入招式池').toBe(false);
    expect(state.discovering.options.every(card => ['武术', '法术'].includes(card.type))).toBe(true);
    endBattle(g);
    await drain();
  });
});
