import { describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from './helpers/menu-controller.js';

function setup(recoverSlotIfPending) {
  const handlers = {};
  let activeSlot = null;
  const base = { slot:null, peek: () => ({}), use: vi.fn(slot => { base.slot = slot; }), save: vi.fn(), data: { stash: [], pocket: [] }, issue: () => null, reset: vi.fn(async () => true), applyStoredCardRenames: vi.fn(async () => ({ changed:false, persisted:true })), flushWrites:vi.fn(async () => ({ ok:true })) };
  const openBaseHub = vi.fn();
  const runStore = { has: vi.fn(() => false), issue: () => null };
  const preflightRunMap = vi.fn(() => ({ ok: true }));
  const clearSlot = vi.fn();
  const UI = {
    showOverlay(_title, html) { document.body.innerHTML = `<div id="ovBody">${html}</div>`; },
    hideOverlay() { document.body.innerHTML = ''; },
    registerHelp() {}, helpBtn() { return ''; }, act(name, fn) { handlers[name] = fn; },
    log: vi.fn(), clearLog() {}, hideScreen: vi.fn(), showScreen() {}, refresh() {}, confirmAction:vi.fn(async()=>true),
  };
  const setActiveSlot = vi.fn(slot => { activeSlot = slot; });
  const game = { state: 'title' };
  const controller = createGameMenuController({
    SDT: { Base: base, Cards: { applyAbilityRename: () => false, applyDuplicateRenames: () => false }, Sound: { music() {} },
      Meta: { ACHIEVEMENTS: [], isUnlocked: () => false }, Icons: { img: () => '' } },
    UI, game, runtime: { resize() {}, openBaseHub, showRunTransition: () => Object.assign(Promise.resolve(true), { isCurrent: () => true }) },
    SLOT_COUNT: 1, esc: String, readSlot: () => null, loadGame: vi.fn(), clearSlot,
    saveGame() {}, syncPlayTime() {}, clearSave() {}, clearAllSlots() {},
    getActiveSlot: () => activeSlot, setActiveSlot, preflightRunMap, hasRun: () => false,
    RunStorage: runStore, recoverSlotIfPending,
  });
  controller.startNewGame();
  return { handlers, base, openBaseHub, runStore, preflightRunMap, clearSlot, UI, setActiveSlot, game };
}

describe('选档恢复门禁', () => {
  it.each(['overwriteSlot','delSlot'])('%s确认等待期间来源页面失效，迟到批准不删除或初始化档案',async action=>{
    const h=setup();let approve;
    h.UI.confirmAction.mockImplementation(()=>new Promise(resolve=>{approve=resolve;}));
    const pending=h.handlers[action]({slot:1});
    document.getElementById('ovBody').innerHTML='<section class="settings-page">设置</section>';
    approve(true);expect(await pending).toBe(false);
    expect(h.clearSlot).not.toHaveBeenCalled();expect(h.base.reset).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-page')).not.toBeNull();
  });
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

  it.each(['newSlot', 'overwriteSlot'])('%s 初始化写入失败保留选档页和输入归属，重试成功才进入基地', async action => {
    const h = setup();
    h.base.reset.mockReturnValueOnce(false).mockReturnValue(true);
    const picker = document.querySelector('.slot-page');
    expect(await h.handlers[action]({ slot: 1 })).toBe(false);
    expect(h.openBaseHub).not.toHaveBeenCalled();
    expect(h.setActiveSlot).not.toHaveBeenCalled();
    expect(h.UI.hideScreen).not.toHaveBeenCalled();
    expect(h.game.state).toBe('modal');
    expect(picker.isConnected).toBe(true);
    expect(document.getElementById('slotRestoreError').textContent).toContain('初始化未保存');
    expect(h.UI.log.mock.calls.some(([text]) => text.includes('已进入'))).toBe(false);
    await h.handlers[action]({ slot: 1 });
    expect(h.base.reset).toHaveBeenCalledTimes(2);
    expect(h.openBaseHub).toHaveBeenCalledOnce();
    expect(h.setActiveSlot).toHaveBeenCalledWith(1);
    expect(h.UI.log.mock.calls.filter(([text]) => text.includes('已进入'))).toHaveLength(1);
  });
});


describe('基地异步入口的选档锁和结果', () => {
  it.each(['newSlot', 'delSlot', 'overwriteSlot'])('%s 等待回执时返回标题，即使旧页仍在淡出也不重新导航', async action => {
    const h = setup(); let finish;
    const page = document.querySelector('.slot-page');
    const hide = vi.spyOn(h.UI, 'hideOverlay').mockImplementation(() => {});
    const pendingWrite = new Promise(resolve => { finish = resolve; });
    if (action === 'newSlot') h.base.reset.mockReturnValue(pendingWrite);
    else { h.clearSlot.mockReturnValue(pendingWrite); }
    const pending = h.handlers[action]({ slot:1 });
    if (action !== 'newSlot') await vi.waitFor(()=>expect(h.clearSlot).toHaveBeenCalledOnce());
    h.handlers.slotBack();
    expect(page.isConnected).toBe(true);
    finish(action === 'newSlot' ? true : { ok:true });
    expect(await pending).toBe(false);
    expect(h.openBaseHub).not.toHaveBeenCalled();
    expect(document.querySelector('.slot-page')).toBe(page);
    if (action === 'overwriteSlot') expect(h.base.reset).not.toHaveBeenCalled();
    expect(h.UI.log.mock.calls.some(([text]) => text.includes('已删除') || text.includes('已进入'))).toBe(false);
    hide.mockRestore();
  });
  it('基地迁移写入失败保留档案且不打开基地，重试成功后才进入', async () => {
    const h = setup();
    h.base.applyStoredCardRenames.mockResolvedValueOnce({ changed:true, persisted:false });
    expect(await h.handlers.enterSlot({ slot:1 })).toBe(false);
    expect(h.openBaseHub).not.toHaveBeenCalled();
    expect(document.getElementById('slotRestoreError').textContent).toContain('迁移未保存');
    await h.handlers.enterSlot({ slot:1 });
    expect(h.openBaseHub).toHaveBeenCalledOnce();
  });

  it('等待基地迁移时离开选档，迟到回执不打开旧档位', async () => {
    const h = setup(); let finish;
    h.base.applyStoredCardRenames.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.handlers.enterSlot({ slot:1 });
    document.getElementById('ovBody').innerHTML = '<section class="settings-page">设置</section>';
    finish({ changed:true, persisted:true });
    expect(await pending).toBe(false);
    expect(h.openBaseHub).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-page')).not.toBeNull();
  });

  it('覆盖删除等待时离开选档，已完成删除不会触发迟到初始化', async () => {
    const h = setup(); let finish;
    h.clearSlot.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.handlers.overwriteSlot({ slot:1 });
    await vi.waitFor(()=>expect(h.clearSlot).toHaveBeenCalledOnce());
    document.getElementById('ovBody').innerHTML = '<section class="settings-page">设置</section>';
    finish({ ok:true });
    expect(await pending).toBe(false);
    expect(h.base.reset).not.toHaveBeenCalled();
    expect(h.openBaseHub).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-page')).not.toBeNull();
  });
  it.each(['newSlot', 'enterSlot', 'overwriteSlot'])('%s 等待基地时禁止重复初始化、覆盖、删除或进入', async action => {
    const h = setup();
    let finish;
    h.openBaseHub.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const entry = h.handlers[action]({ slot: 1 });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await h.handlers.newSlot({ slot: 1 });
    await h.handlers.enterSlot({ slot: 1 });
    h.handlers.overwriteSlot({ slot: 1 }); h.handlers.delSlot({ slot: 1 });
    expect(h.openBaseHub).toHaveBeenCalledOnce();
    expect(h.base.reset).toHaveBeenCalledTimes(action === 'enterSlot' ? 0 : 1);
    expect(h.clearSlot).toHaveBeenCalledTimes(action === 'overwriteSlot' ? 1 : 0);
    expect(h.UI.log.mock.calls.some(([text]) => text.includes('已进入'))).toBe(false);
    finish(true); await entry;
    expect(h.UI.log.mock.calls.filter(([text]) => text.includes('已进入'))).toHaveLength(1);
  });

  it.each(['newSlot', 'enterSlot'])('%s 消费异步 false，保留档案、恢复选档和可重试状态', async action => {
    const h = setup();
    h.openBaseHub.mockResolvedValueOnce(false).mockResolvedValue(true);
    expect(await h.handlers[action]({ slot: 1 })).toBe(false);
    expect(document.querySelector('.slot-page')).not.toBeNull();
    expect(document.getElementById('slotRestoreError').textContent).toContain('档案已保留');
    expect(h.clearSlot).not.toHaveBeenCalled();
    expect(h.UI.log.mock.calls.some(([text]) => text.includes('已进入'))).toBe(false);
    await h.handlers.enterSlot({ slot: 1 });
    expect(h.openBaseHub).toHaveBeenCalledTimes(2);
  });

  it.each(['false', 'rejection'])('旧等待 %s 不能把新设置页面拉回选档', async outcome => {
    const h = setup(); let finish;
    h.openBaseHub.mockImplementation(() => new Promise((resolve, reject) => { finish = outcome === 'false' ? () => resolve(false) : () => reject(new Error('late failure')); }));
    const entry = h.handlers.enterSlot({ slot: 1 });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    document.getElementById('ovBody').innerHTML = '<section class="settings-page">设置</section>';
    finish(); expect(await entry).toBe(false);
    expect(document.querySelector('.settings-page')).not.toBeNull();
    expect(document.querySelector('.slot-page')).toBeNull();
  });

  it('异步 rejection 被消费并释放锁，原档保留后可重试', async () => {
    const h = setup(); h.openBaseHub.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(true);
    expect(await h.handlers.enterSlot({ slot: 1 })).toBe(false);
    expect(h.clearSlot).not.toHaveBeenCalled();
    await h.handlers.enterSlot({ slot: 1 });
    expect(h.openBaseHub).toHaveBeenCalledTimes(2);
  });
});
