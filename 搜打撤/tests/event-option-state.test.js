import { describe, expect, it, vi } from 'vitest';
import { eventOptionHTML, eventOptionState } from '../game/src/ui/event-option-state.js';

describe('事件选项实时预告', () => {
  it('满包仍保留原动作，整理后重新渲染使用实际准入结果', () => {
    let fits = false;
    const run = vi.fn();
    const choice = { label:'领取木材', capacityCard:{ id:'tt-wood' }, canRun:() => fits, run };
    const game = { hp:6, coins:2 };
    const root = document.createElement('div');
    root.innerHTML = eventOptionHTML(choice, 0, game);
    expect(root.querySelector('button').disabled).toBe(false);
    expect(root.querySelector('button').dataset.act).toBe('evtChoice');
    expect(root.textContent).toContain('当前背包装不下，选择后可整理背包');
    fits = true;
    root.innerHTML = eventOptionHTML(choice, 0, game);
    expect(root.textContent).toContain('背包可容纳');
    expect(root.querySelector('button').dataset.optionState).toBe('ready');
    expect(root.querySelector('.evt-opt-index').textContent).toBe('01');
    expect(root.querySelector('.evt-opt-state').textContent).toBe('可选择');
    expect(root.querySelector('.evt-opt-detail').textContent).toContain('背包可容纳');
    expect(run).not.toHaveBeenCalled();
    expect(game).toEqual({ hp:6, coins:2 });
  });

  it('金币随返回页面后的余额重算，预告不会预扣或阻断原回调', () => {
    const choice = { label:'支付', coinCost:3 };
    const game = { hp:10, coins:2 };
    expect(eventOptionState(choice, game)).toEqual({ state:'limited', note:'金币不足：还差 1 币（当前 2）' });
    game.coins = 5;
    expect(eventOptionState(choice, game).note).toBe('支付 3 币后剩余 2');
    expect(game.coins).toBe(5);
  });

  it('不按文案推测代价，并转义动态说明而不注入HTML', () => {
    const choice = { label:'<img onerror=alert(1)>', detail:'失去999生命', run:vi.fn() };
    const root = document.createElement('div');
    root.innerHTML = eventOptionHTML(choice, 0, { hp:1, coins:0 });
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('button').dataset.optionState).toBe('ready');
    expect(root.querySelector('b').textContent).toBe(choice.label);
    expect(root.querySelector('[data-ui-tip], [data-ui-tip-title], [data-ui-tip-text], [title]')).toBeNull();
  });
});
