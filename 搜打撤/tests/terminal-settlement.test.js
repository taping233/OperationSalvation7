import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGameMenuController } from '../game/src/game.menu.js';

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
    await actions.get('leaveAbandon')(); // 确认：实际结算
    actions.get('leaveAbandon')(); // 同一旧回调迟到重放

    expect(game.runActive).toBe(false);
    expect(depositCards).toHaveBeenCalledOnce();
    expect(depositCards).toHaveBeenCalledWith([{ card, count: 1 }]);
    expect(UI.log).toHaveBeenCalledTimes(2);
  });

});
