import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { bindSlotArchive } from '../game/src/ui/save-management.js';
import { confirmAction } from '../game/src/ui/confirm-dialog.js';

let actions, archive, refresh, UI;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><main class="slot-page"><button id="source">恢复</button></main></div></div>';
  actions = {}; archive = { recoverImport:vi.fn(async () => ({ok:true})) }; refresh = vi.fn();
  UI = { el:{ovBody:document.getElementById('ovBody')}, act:(name, action) => { actions[name] = action; }, confirmAction };
  bindSlotArchive({ UI, saveArchive:archive, previewRunBackup:() => ({ok:false}), restoreRunBackup:vi.fn(), refresh, onError:vi.fn() });
  document.getElementById('source').focus();
});
afterEach(() => { document.querySelector('[data-confirm-cancel]')?.click(); });
it('中断导入恢复入口在明确确认后调用恢复端口，再刷新档位', async () => {
  const pending = actions.recoverSlotImport({slot:'2'});
  expect(archive.recoverImport).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alertdialog"]').textContent).toContain('恢复中断导入前的原档');
  document.querySelector('[data-confirm-submit]').click();
  expect(await pending).toBe(true);
  expect(archive.recoverImport).toHaveBeenCalledExactlyOnceWith(2, {confirm:true});
  expect(refresh).toHaveBeenCalledOnce();
});
it('取消中断导入恢复不修改档案', async () => {
  const pending = actions.recoverSlotImport({slot:'1'});
  document.querySelector('[data-confirm-cancel]').click();
  expect(await pending).toBe(false); expect(archive.recoverImport).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});
it('等待确认期间来源页失效，不能恢复或刷新旧档位', async () => {
  const pending = actions.recoverSlotImport({slot:'1'});
  document.querySelector('.slot-page').replaceWith(document.createElement('main'));
  document.querySelector('[data-confirm-submit]').click();
  await vi.waitFor(() => expect(document.querySelector('[data-confirm-submit]').disabled).toBe(false));
  expect(archive.recoverImport).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  document.querySelector('[data-confirm-cancel]').click(); expect(await pending).toBe(false);
});
