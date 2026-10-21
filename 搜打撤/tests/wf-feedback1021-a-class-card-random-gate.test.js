/* 反馈#2（2026-10-21 老板实测 12 条）：
 * 「随机获得卡牌不能获得职业卡，只有写能够获取职业卡的效果才能包含职业卡池」。
 * 根因：battle.discover-candidates.js 的指定池（pred）分支历史上只排除
 * 衍生/生物/事件/资源，不叠任何资格门 → 招式/武术/2费…等随机池会漏出职业卡。
 * 本文件锁：指定池与通用池不产出职业卡；显式职业池（本职业/其它职业）仍可得；
 * 火堆/开局类职业卡直发（randomClassCard）不受影响；文本路径同口径。 */
import { describe, it, expect } from 'vitest';
import { buildDiscoverPool } from '../game/src/battle/effects/battle.discover-candidates.js';
import { parsePoolNoun } from '../game/src/battle/effects/effect-steps.ctx.js';
import { isClassCard } from '../game/src/cards/card-rarity.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
const { killsSteps } = await import('../game/src/battle/effects/effect-steps.kills.js');

Cards.ensureStarters();
Cards.ensureSha();
Cards.ensureTabletop();
const CATALOG = Cards.all();
const MY_CLASS = '战士';
const gate = card => Cards.isRandomObtainable(card);
const build = pred => buildDiscoverPool(CATALOG, { myClass: MY_CLASS, pred, isRandomObtainable: gate });

describe('反馈#2 随机获得排除职业卡（统一门）', () => {
  it('指定池谓词（招式/类型/费用/系列…）的池内没有职业卡', () => {
    const nouns = ['招式', '武术', '法术', '装备', '0费招式', '1费招式', '2费招式',
      '能施加诅咒的招式', '能施加诅咒的卡牌', '药水', '箭系列', '火球系列', '传说', '史诗'];
    for (const noun of nouns) {
      const pred = parsePoolNoun(noun, MY_CLASS);
      expect(pred, `${noun} 应可识别`).toBeTypeOf('function');
      const pool = build(pred);
      expect(pool.some(isClassCard), `池「${noun}」不应含职业卡`).toBe(false);
    }
  });

  it('通用随机池（pred=null，随机获得N张牌兜底）不产出职业卡', () => {
    const pool = build(null);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some(isClassCard)).toBe(false);
  });

  it('显式职业池谓词带 allowClassCards 标记，其它职业/本职业仍可得职业卡', () => {
    for (const noun of ['其它职业', '本职业']) {
      const pred = parsePoolNoun(noun, MY_CLASS);
      expect(pred.allowClassCards, `${noun} 谓词应声明职业池`).toBe(true);
      const pool = build(pred);
      expect(pool.length, `${noun} 池应非空`).toBeGreaterThan(0);
      expect(pool.every(card => !!card.cls), `${noun} 池应全部带 cls`).toBe(true);
    }
    const otherPool = build(parsePoolNoun('其它职业', MY_CLASS));
    expect(otherPool.some(card => card.cls !== MY_CLASS)).toBe(true);
  });

  it('带 cls 但稀有度未迁移的卡同样被门排除；能力卡/普通卡口径不变', () => {
    expect(Cards.isRandomObtainable({ id: 'x', name: '自制职业卡', rarity: '古朴', type: '武术', cls: '牧师' })).toBe(false);
    expect(Cards.isRandomObtainable({ id: 'y', name: '自制武卡', rarity: '古朴', type: '武术' })).toBe(true);
    expect(Cards.isRandomObtainable({ id: 'z', name: '英雄', rarity: '稀有', type: '能力卡', cls: '牧师', hero: true })).toBe(false);
    const classCard = CATALOG.find(card => isClassCard(card));
    expect(classCard).toBeTruthy();
    expect(Cards.isRandomObtainable(classCard)).toBe(false);
  });

  it('显式职业池直发不受影响：randomClassCard / classPool 仍返回职业卡', () => {
    const direct = Cards.randomClassCard(MY_CLASS);
    expect(direct).toBeTruthy();
    expect(direct.cls).toBe(MY_CLASS);
    expect(direct.rarity).toBe('职业');
    expect(Cards.classPool(MY_CLASS).length).toBeGreaterThan(0);
  });

  it('文本路径同口径：厄运「随机获取 N 张能施加诅咒的招式」多次抽样不落职业卡', () => {
    const added = [];
    let cursor = 0;
    const step = killsSteps({
      allCards: () => CATALOG,
      random01: () => ((cursor++ * 7) % 41) / 41,
      addTempCard: card => added.push(card),
      log() {},
      esc: String,
    }).find(entry => entry.id === 'hand.curseCards');
    expect(step).toBeTruthy();
    const desc = '随机获取1张能施加诅咒的招式';
    for (let round = 0; round < 41; round++) {
      const ctx = { card: { id: 'cmtn1gfhczzj', name: '厄运', desc }, desc };
      step.run(ctx, step.when(ctx));
    }
    expect(added.length).toBeGreaterThan(0);
    expect(added.some(card => isClassCard(card)), '文本随机获取池不应产出职业卡').toBe(false);
  });
});
