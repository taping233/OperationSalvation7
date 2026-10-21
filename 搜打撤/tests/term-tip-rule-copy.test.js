import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURSES, CURSE_META } from '../game/src/battle/core/combat.js';
import '../game/src/ui/term-tips.js';

beforeEach(async () => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ x: 0, y: 0, width: 80, height: 20 }]);
  document.body.insertAdjacentHTML('beforeend', '<span id="rule-copy-term" data-term="poison"></span>');
  document.getElementById('rule-copy-term').dispatchEvent(new MouseEvent('pointerover', { bubbles:true }));
  await vi.dynamicImportSettled();
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
});
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  document.getElementById('rule-copy-term')?.remove();
  vi.restoreAllMocks();
});

function showTerm(key) {
  const term = document.getElementById('rule-copy-term');
  term.setAttribute('data-term', key);
  term.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
  const tip = document.querySelector('.term-tip');
  expect(tip?.hidden).toBe(false);
  return tip.textContent;
}

describe('通用词条讲解与当前规则边界', () => {
  it('诅咒概述包含战斗状态表的全部负面状态', () => {
    const text = showTerm('curse');
    for (const key of CURSES) expect(text).toContain(CURSE_META[key].name);
  });

  it.each(CURSES)('状态角标 %s 有对应的独立讲解', key => {
    const text = showTerm(key);
    expect(text).toContain(CURSE_META[key].name);
    if (key === 'atkDown') expect(text).toContain('到期归还实际扣减的攻击力');
  });

  it('注能说明区分可选注能与必须注能，并保留材料不算打出', () => {
    const text = showTerm('infuse');
    expect(text).toContain('材料不计入「打出」');
    expect(text).toContain('有基础效果时可不注能');
    expect(text).toContain('必须注能的牌需先注能才能打出');
    expect(text).not.toContain('不注能则按弱效果直接打出');
  });

  it('消耗说明使用统一牌堆和取回规则，并区分消耗对象', () => {
    const text = showTerm('exhaust');
    expect(text).toContain('被消耗的牌进入消耗牌堆');
    expect(text).toContain('不自动洗回牌库，只能由卡牌效果取回');
    expect(text).toContain('消耗本牌还是其他牌，以卡面说明为准');
    expect(text).not.toContain('此牌打出后进入墓地');
  });

  it('充能只解释明确的回合成长句式，不把同名卡当作相同规则', () => {
    const text = showTerm('charge');
    expect(text).toContain('卡面写明「回合开始时，本牌伤害 +N」时');
    expect(text).toContain('本场有效');
    expect(text).toContain('其他充能卡的成长条件以卡面为准');
    expect(text).not.toContain('充能火山');
  });

  it.each([
    ['natureForm', '满月形态', '回合开始时额外获得 1 点能量'],
    ['cosmosForm', '宇宙形态', '本局对战所有卡牌变为 1 费'],
  ])('保留既有形态讲解 %s，不在本轮改动状态语义', (key, name, effect) => {
    const text = showTerm(key);
    expect(text).toContain(name);
    expect(text).toContain(effect);
  });
});
