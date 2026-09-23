import { describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from '../game/src/ui/game.menu.js';

function setup(recoverSlotIfPending) {
  const handlers = {};
  const base = { peek: () => ({}), use: vi.fn(), save: vi.fn(), data: { stash: [], pocket: [] }, issue: () => null, reset: vi.fn() };
  const openBaseHub = vi.fn();
  const runStore = { has: vi.fn(() => false), issue: () => null };
  const preflightRunMap = vi.fn(() => ({ ok: true }));
  const clearSlot = vi.fn();
  const UI = {
    showOverlay(_title, html) { document.body.innerHTML = html; },
    hideOverlay() { document.body.innerHTML = ''; },
    registerHelp() {}, helpBtn() { return ''; }, act(name, fn) { handlers[name] = fn; },
    log: vi.fn(), clearLog() {}, hideScreen() {}, showScreen() {}, refresh() {},
  };
  const controller = createGameMenuController({
    SDT: { Base: base, Cards: { applyAbilityRename: () => false, applyDuplicateRenames: () => false }, Sound: { music() {} },
      Meta: { ACHIEVEMENTS: [], isUnlocked: () => false }, Icons: { img: () => '' } },
    UI, game: { state: 'title' }, runtime: { resize() {}, openBaseHub, showRunTransition: async () => {} },
    SLOT_COUNT: 1, esc: String, readSlot: () => null, loadGame: vi.fn(), clearSlot,
    saveGame() {}, syncPlayTime() {}, clearSave() {}, clearAllSlots() {},
    getActiveSlot: () => null, setActiveSlot: vi.fn(), preflightRunMap, hasRun: () => false,
    RunStorage: runStore, recoverSlotIfPending,
  });
  controller.startNewGame();
  return { handlers, base, openBaseHub, runStore, preflightRunMap, clearSlot, UI };
}

describe('选档恢复门禁', () => {
  it('先恢复事务，再检查是否还有进行中对局并载入基地', async () => {
    let finish;
    const recover = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const h = setup(recover);
    const entry = h.handlers.enterSlot({ slot: 1 });
    expect(h.base.use).not.toHaveBeenCalled();
    expect(h.runStore.has).not.toHaveBeenCalled();
    // 未完成的恢复不能与同页覆盖/删除/再次进入并发。
    await h.handlers.enterSlot({ slot: 1 });
    h.handlers.overwriteSlot({ slot: 1 });
    h.handlers.delSlot({ slot: 1 });
    expect(recover).toHaveBeenCalledOnce();
    expect(h.clearSlot).not.toHaveBeenCalled();
    finish({ ok: true, value: null });
    await entry;
    expect(h.runStore.has).toHaveBeenCalledWith(1);
    expect(h.base.use).toHaveBeenCalledWith(1);
    expect(h.openBaseHub).toHaveBeenCalledOnce();
  });

  it('恢复失败保留选档页和原档，允许同页重试', async () => {
    const recover = vi.fn().mockResolvedValueOnce({ ok: false, code: 'SAVE_FAILED', message: '存储空间不足' })
      .mockResolvedValueOnce({ ok: true, value: null });
    const h = setup(recover);
    await h.handlers.enterSlot({ slot: 1 });
    expect(h.base.use).not.toHaveBeenCalled();
    expect(h.clearSlot).not.toHaveBeenCalled();
    expect(document.getElementById('slotRestoreError').textContent).toContain('原档与恢复记录已保留');
    await h.handlers.enterSlot({ slot: 1 });
    expect(h.base.use).toHaveBeenCalledOnce();
  });

  it('等待恢复时离开选档页，迟到结果不会打开旧档位', async () => {
    let finish;
    const h = setup(() => new Promise(resolve => { finish = resolve; }));
    const entry = h.handlers.enterSlot({ slot: 1 });
    h.UI.hideOverlay();
    finish({ ok: true, value: null });
    await entry;
    expect(h.base.use).not.toHaveBeenCalled();
    expect(h.openBaseHub).not.toHaveBeenCalled();
  });
});
