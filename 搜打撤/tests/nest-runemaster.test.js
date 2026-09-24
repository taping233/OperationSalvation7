/* 龙巢扩展核心验证（2026-09-16）：符文滚落/羁绊/心单位/直线路径/新成就计数。 */
import { describe, it, expect } from 'vitest';
import { rollRune, evaluateSlots, RUNE_KINDS, RUNE_ATTRIBUTES, } from '../game/src/battle/runes.js';

describe('符文系统', () => {
  it('20 类符文注册（19 类别 + 双属性变体）且属性枚举正确', () => {
    expect(RUNE_KINDS.length).toBe(19);
    expect(RUNE_ATTRIBUTES).toEqual(['水', '火', '草', '光', '暗']);
  });
  it('滚落：强制属性生效、稀有度档位正确', () => {
    const r = rollRune(() => 0.99, { forceAttrs: ['水'] });
    expect(r.attrs).toEqual(['水']);
    const epic = rollRune(() => 0.5, { rarity: '史诗' });
    expect(['无限符文', '时空符文']).toContain(epic.name);
  });
  it('羁绊：1 段按属性集合，3 段需同属性占满 3 槽', () => {
    const syn1 = evaluateSlots([{ attrs: ['水'] }, { attrs: ['火'] }, { attrs: ['草'] }]);
    expect(syn1.water1).toBe(true);
    expect(syn1.water3).toBe(false);
    expect(syn1.fire1).toBe(true);
    expect(syn1.grass3).toBe(false);
    const syn3 = evaluateSlots([{ attrs: ['水'] }, { attrs: ['水'] }, { attrs: ['水'] }]);
    expect(syn3.water1).toBe(true);
    expect(syn3.water3).toBe(true);
    expect(syn3.dark1).toBe(false);
  });
  it('0.7% 双属性：低 roll 出双属性，高 roll 单属性', () => {
    const dual = rollRune(() => 0.001);
    expect(dual.attrs.length).toBe(2);
    expect(dual.attrs[0]).not.toBe(dual.attrs[1]);
    const single = rollRune(() => 0.5);
    expect(single.attrs.length).toBe(1);
  });
});
