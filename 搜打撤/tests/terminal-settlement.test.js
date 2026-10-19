import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runTerminalSettlement } from '../game/src/ui/terminal-settlement.js';
import { createGameMenuController } from './helpers/menu-controller.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('终局入口幂等', () => {
  it('放弃确认后的迟到重复动作不会再次搬运安全格卡牌', async () => {
    const actions = new Map();
    const card = { id: 'safe-card', name: '安全卡' };
    const game = {
      state: 'idle', runActive: true, ownedCards: [{ card, safe: true, brought: false }],
      coins: 9,
    };
    const depositCards = vi.fn();
    const UI = {
      showOverlay(_title, html) {
        document.body.innerHTML = `<div id="ovBody">${html}</div>`;
      },
      act(name, fn) { actions.set(name, fn); },
      hideOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
    };
    const SDT = {
      Base: { depositCards }, Sound: { sfx: vi.fn(), music: vi.fn() },
      Icons: { img: () => '' },
      Cards: { cardHTML: () => '<div class="hs-card">安全卡</div>' },
    };
    const controller = createGameMenuController({
      SDT, UI, game, runtime: { resize: vi.fn(), openBaseHub: vi.fn() },
      SLOT_COUNT: 1, esc: String, getActiveSlot: () => null, setActiveSlot: vi.fn(),
      syncPlayTime: vi.fn(), clearSave: vi.fn(), saveGame: vi.fn(),
      readSlot: vi.fn(), loadGame: vi.fn(), clearSlot: vi.fn(), clearAllSlots: vi.fn(),
      preflightRunMap: vi.fn(), hasRun: vi.fn(), RunStorage: {},
      terminalCommands: { projectEphemeral: ({ cards }) => depositCards(cards) },
    });

    controller.openLeaveMenu();
    actions.get('leaveAbandon')(); // 首次点击：进入二次确认
    const confirmAbandon = actions.get('leaveAbandonConfirm');
    await confirmAbandon(); // 独立确认动作：实际结算
    confirmAbandon(); // 同一旧回调迟到重放

    expect(game.runActive).toBe(false);
    expect(depositCards).toHaveBeenCalledOnce();
    expect(depositCards).toHaveBeenCalledWith([{ card, count: 1 }]);
    expect(UI.log).toHaveBeenCalledTimes(2);
  });

});


describe('shared terminal retry feedback', () => {
  it.each([
    ['run.death', 'retryDeath'], ['run.abandon', 'retryAbandon'],
  ])('%s shows pending feedback and restores retry after failed persistence', async (command, retryAct) => {
    document.body.innerHTML = '<div id="ovBody"></div>';
    const root = document.getElementById('ovBody'), actions = new Map();
    let settle;
    const pending = new Promise(resolve => { settle = resolve; });
    const commands = {
      createAttempt: vi.fn().mockResolvedValueOnce({ ok: false, message: '请重试' })
        .mockResolvedValue({ ok: true, attempt: { id: 'one-attempt' } }),
      commitAttempt: vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ ok: true }),
    };
    const finish = vi.fn(() => { root.textContent = '结算完成'; return true; });
    const token = { busy: false, promise: null };
    const UI = { el: { ovBody: root }, showOverlay(_title, html) { root.innerHTML = html; },
      act(name, action) { actions.set(name, action); }, refresh() {} };
    await runTerminalSettlement({ token, current: () => true, game: {}, UI, finish,
      command, retryAct, terminalCommands: commands });
    const retry = root.querySelector('button');
    expect(retry.disabled).toBe(false);
    const result = actions.get(retryAct)();
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute('aria-busy')).toBe('true');
    expect(retry.textContent).toBe('正在结算…');
    expect(root.querySelector('[role="status"]').textContent).toContain('正在保存结算');
    actions.get(retryAct)(); await Promise.resolve();
    expect(commands.createAttempt).toHaveBeenCalledTimes(2);
    expect(commands.commitAttempt).toHaveBeenCalledOnce();
    settle({ ok: false, message: '仍未保存' }); await result;
    expect(root.querySelector('button').disabled).toBe(false);
    expect(root.querySelector('button').textContent).toBe('重试结算');
    expect(root.querySelector('[role="status"]').textContent).toBe('');
    expect(root.textContent).toContain('仍未保存');
    expect(finish).not.toHaveBeenCalled();
    expect(await actions.get(retryAct)()).toBe(true);
    expect(commands.createAttempt).toHaveBeenCalledTimes(2);
    expect(commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenCalledOnce();
    expect(root.textContent).toBe('结算完成');
  });
});
