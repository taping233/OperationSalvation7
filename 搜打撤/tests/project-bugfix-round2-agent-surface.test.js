import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectUiActions } from '../game/src/agent/agent.surface.js';
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><button data-act="buy">购买，价格 10</button></div></div>';
  window.SDT = { game: { battleActive: false }, UI: {} };
});
afterEach(() => { document.body.innerHTML = ''; });
describe('动作标签的原地更新', () => {
  it('同一按钮内容更新后读取当前价格与收益', () => {
    const button = document.querySelector('button');
    expect(collectUiActions()[0].label).toBe('购买，价格 10');
    button.textContent = '购买，价格 20';
    expect(collectUiActions()[0].label).toBe('购买，价格 20');
  });
  it('可访问标签更新或移除后不会沿用上次内容', () => {
    const button = document.querySelector('button'); button.setAttribute('aria-label', '领取一张卡');
    expect(collectUiActions()[0].label).toBe('领取一张卡');
    button.setAttribute('aria-label', '奖励已领取'); expect(collectUiActions()[0].label).toBe('奖励已领取');
    button.removeAttribute('aria-label'); expect(collectUiActions()[0].label).toBe('购买，价格 10');
  });
});
