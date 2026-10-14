import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let ui;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  window.SDT = {
    Motion: { reduceMotion: () => false },
    game: { runActive: true, seed: 23, discoveredPairs: new Set() },
    Base: { slot: 1 },
    Cards: { cardHTML: card => `<div>${card.name}</div>` },
    Sound: { sfx: vi.fn() },
  };
  const { cinematicsMethods } = await import('../game/src/ui/cinematics.js');
  ui = { ...cinematicsMethods, _cardGetQueue: [] };
  document.body.innerHTML = '<section id="screen"></section>';
});

describe('card reward run ownership', () => {
  const card = name => ({ name, rarity: '稀有' });

  it('drops an old-run queued card when a new run is already active again', () => {
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('旧局排队卡'));
    document.getElementById('cardGet').click();
    window.SDT.game.runActive = false;
    window.SDT.game.discoveredPairs = new Set(); // Both newRun and loadGame replace this token.
    window.SDT.game.runActive = true;
    vi.advanceTimersByTime(100);
    expect(document.body.textContent).not.toContain('旧局排队卡');
    expect(ui._cardGetQueue).toHaveLength(0);
    expect(ui._cardGetShowing).toBe(false);
  });

  it('preserves the new run reward behind invalid entries, including a same-seed reload', () => {
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('旧局排队卡'));
    document.getElementById('cardGet').click();
    window.SDT.game.discoveredPairs = new Set(); // Reloading the same seed is still a new in-memory session.
    ui.showCardReward(card('新局奖励'));
    vi.advanceTimersByTime(100);
    expect([...document.querySelectorAll('.lg-name')].at(-1)?.textContent).toBe('新局奖励');
    expect(document.body.textContent).not.toContain('旧局排队卡');
    expect(ui._cardGetQueue).toHaveLength(0);
  });

  it('rejects a queued card after switching slots, without requiring a run-active change', () => {
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('原档奖励'));
    document.getElementById('cardGet').click();
    window.SDT.Base.slot = 2;
    ui.showCardReward(card('新档奖励'));
    vi.advanceTimersByTime(100);
    expect(document.body.textContent).not.toContain('原档奖励');
    expect([...document.querySelectorAll('.lg-name')].at(-1)?.textContent).toBe('新档奖励');
  });

  it('rejects the old session after returning to the original slot and seed', () => {
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('返回前奖励'));
    document.getElementById('cardGet').click();
    window.SDT.Base.slot = 2;
    window.SDT.game.discoveredPairs = new Set();
    window.SDT.Base.slot = 1;
    window.SDT.game.discoveredPairs = new Set();
    ui.showCardReward(card('返回后奖励'));
    vi.advanceTimersByTime(100);
    expect(document.body.textContent).not.toContain('返回前奖励');
    expect([...document.querySelectorAll('.lg-name')].at(-1)?.textContent).toBe('返回后奖励');
  });

  it('keeps ordinary same-run ordering when no slot or run token is supplied', () => {
    delete window.SDT.Base;
    delete window.SDT.game.discoveredPairs;
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('第二张'));
    ui.showCardReward(card('第三张'));
    document.getElementById('cardGet').click();
    vi.advanceTimersByTime(420);
    expect(document.querySelector('.lg-name').textContent).toBe('第二张');
    document.getElementById('cardGet').click();
    vi.advanceTimersByTime(420);
    expect(document.querySelector('.lg-name').textContent).toBe('第三张');
    document.getElementById('cardGet').click();
    vi.advanceTimersByTime(3000);
    expect(document.getElementById('cardGet')).toBeNull();
    expect(ui._cardGetShowing).toBe(false);
  });

  it('keeps a same-run reward while its discovered-pair set changes in place', () => {
    ui.showCardReward(card('第一张'));
    ui.showCardReward(card('同局奖励'));
    document.getElementById('cardGet').click();
    window.SDT.game.discoveredPairs.add('new-pair');
    vi.advanceTimersByTime(420);
    expect(document.querySelector('.lg-name').textContent).toBe('同局奖励');
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  delete window.SDT;
});

describe('screen hide lifecycle', () => {
  it('cancels the old hide clock when the screen is reopened', () => {
    const screen = document.getElementById('screen');
    const oldAfter = vi.fn(), nextAfter = vi.fn();
    ui.hideScreen(screen, oldAfter);
    vi.advanceTimersByTime(100);
    ui.showScreen(screen);
    expect(vi.getTimerCount()).toBe(0);
    ui.hideScreen(screen, nextAfter);
    vi.advanceTimersByTime(140);
    expect(screen.hidden).toBe(false);
    expect(screen.style.pointerEvents).toBe('none');
    expect(screen._scrHiding).toBe(true);
    vi.advanceTimersByTime(100);
    expect(screen.hidden).toBe(true);
    expect(oldAfter).not.toHaveBeenCalled();
    expect(nextAfter).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a superseded callback before touching the next hide lock', () => {
    const screen = document.getElementById('screen');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const after = vi.fn();
    ui.hideScreen(screen);
    const oldCallback = timeout.mock.calls.at(-1)[0];
    ui.showScreen(screen);
    ui.hideScreen(screen, after);
    oldCallback(); // A browser task already queued before cancellation can still arrive.
    expect(screen.style.pointerEvents).toBe('none');
    expect(screen._scrHiding).toBe(true);
    ui.hideScreen(screen, after);
    vi.advanceTimersByTime(240);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('keeps reduced-motion completion synchronous and leaves no clock behind', () => {
    const screen = document.getElementById('screen');
    ui.hideScreen(screen);
    ui.showScreen(screen);
    window.SDT.Motion.reduceMotion = () => true;
    const after = vi.fn();
    ui.hideScreen(screen, after);
    expect(screen.hidden).toBe(true);
    expect(screen._scrHiding).toBe(false);
    expect(after).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
