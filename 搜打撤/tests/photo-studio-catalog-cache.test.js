// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createPhotoCatalogCache } from '../game/src/hub/photo-studio-catalog-cache.js';

describe('照相馆跨次访问的目录准备', () => {
  it('相同内容重新打开复用索引，新的等值数组也不重做', () => {
    const cache=createPhotoCatalogCache(), prepare=vi.fn(), art=()=>{};
    const cards=[{id:'one',name:'甲',desc:'抽1张牌',cost:1}];
    expect(cache.update(cards,art,prepare)).toBe(true);
    expect(cache.update(cards,art,prepare)).toBe(false);
    expect(cache.update(JSON.parse(JSON.stringify(cards)),art,prepare)).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
  it('同数量换卡、原地改描述/数值、次序变化或画图函数更换均刷新', () => {
    const cache=createPhotoCatalogCache(), prepare=vi.fn(), art=()=>{};
    const cards=[{id:'one',name:'甲',desc:'抽1张牌',cost:1},{id:'two',name:'乙'}];
    cache.update(cards,art,prepare);
    cards[0].desc='抽2张牌'; expect(cache.update(cards,art,prepare)).toBe(true);
    cards[0].cost=2; expect(cache.update(cards,art,prepare)).toBe(true);
    cards[0]={id:'three',name:'丙'}; expect(cache.update(cards,art,prepare)).toBe(true);
    cards.reverse(); expect(cache.update(cards,art,prepare)).toBe(true);
    expect(cache.update(cards,()=>{},prepare)).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(6);
  });
  it('准备抛错不记成缓存成功，下次仍重新准备', () => {
    const cache=createPhotoCatalogCache(), cards=[{id:'one'}], art=()=>{};
    const prepare=vi.fn().mockImplementationOnce(()=>{throw new Error('failed');});
    expect(()=>cache.update(cards,art,prepare)).toThrow('failed');
    expect(cache.update(cards,art,prepare)).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(2);
  });
});
