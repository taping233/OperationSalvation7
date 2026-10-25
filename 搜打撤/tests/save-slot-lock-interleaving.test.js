import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';

window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT ||= {};
Object.assign(window.SDT, { Icons:{img:() => '',TYPE_ART:{}}, MAP:{rules:RULES,items:{}},
  Sound:{music(){},sfx(){},setDucked(){}}, FX:{feedback(){}} });
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
const { Base } = await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { clearSlot } = await import('../game/src/run/game.session.js');

let locks;
const runKey = RunStorage.key(1), baseKey = Base.SLOT_KEY(1), preservedRunKey = 'sdt-run-1-preserved';
const runRaw = JSON.stringify({version:2,seed:'original',_r2:{runId:'original',revision:2}});
const baseRaw = JSON.stringify({version:2,coins:10});
const newerRun = JSON.stringify({version:2,seed:'other-tab',_r2:{runId:'other-tab',revision:1}});
const newerBase = JSON.stringify({version:2,coins:99});
function serialLocks() {
  const tails = new Map(), active = new Set(), calls = [];
  return { active, calls, request(name, _options, work) {
    calls.push(name);
    const task = (tails.get(name) || Promise.resolve()).then(() => {
      active.add(name);
      try { return work(); } finally { active.delete(name); }
    });
    tails.set(name, task.catch(() => {}));
    return task;
  } };
}
beforeEach(async () => {
  locks = serialLocks();
  Object.defineProperty(navigator, 'locks', {configurable:true,value:locks});
  await RunStorage.flushWrites(); await Base.flushWrites();
  localStorage.clear();
  localStorage.setItem(runKey, runRaw); localStorage.setItem(baseKey, baseRaw);
  RunStorage.invalidateForReplacement(1);
});
afterEach(async () => { await RunStorage.flushWrites(); await Base.flushWrites(); vi.restoreAllMocks(); });

it('覆盖清槽保全和双键删除只有一次租约，期间排队的另一标签新档在清槽后保留', async () => {
  const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  let otherWrite;
  const order = [];
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if ([Base.PRESERVED_KEY(1), preservedRunKey].includes(key)) {
      expect(locks.active.has('sdt-slot-1')).toBe(true); order.push(key);
    }
    const result = set.call(this, key, value);
    if (key === preservedRunKey) {
      otherWrite = locks.request('sdt-slot-1', {mode:'exclusive'}, () => {
        order.push('other-tab'); localStorage.setItem(runKey, newerRun); localStorage.setItem(baseKey, newerBase);
      });
    }
    return result;
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    if ([runKey, baseKey].includes(key)) { expect(locks.active.has('sdt-slot-1')).toBe(true); order.push(key); }
    return remove.call(this, key);
  });
  expect(await clearSlot(1, {preserveAbnormal:true})).toEqual({ok:true,slot:1});
  await otherWrite;
  expect(locks.calls).toEqual(['sdt-slot-1','sdt-slot-1']);
  expect(order.indexOf('other-tab')).toBeGreaterThan(order.indexOf(baseKey));
  expect(localStorage.getItem(preservedRunKey)).toBe(runRaw);
  expect(localStorage.getItem(Base.PRESERVED_KEY(1))).toBe(baseRaw);
  expect(localStorage.getItem(runKey)).toBe(newerRun); expect(localStorage.getItem(baseKey)).toBe(newerBase);
  expect(await Base.reset(1, {overwrite:true})).toBe(false);
  expect(localStorage.getItem(runKey)).toBe(newerRun); expect(localStorage.getItem(baseKey)).toBe(newerBase);
});

it('先排队成功的新档在明确清槽时被完整保全，不保留更旧的预览值', async () => {
  const otherWrite = locks.request('sdt-slot-1', {mode:'exclusive'}, () => {
    localStorage.setItem(runKey, newerRun); localStorage.setItem(baseKey, newerBase);
  });
  const clearing = clearSlot(1, {preserveAbnormal:true});
  await otherWrite; expect(await clearing).toEqual({ok:true,slot:1});
  expect(localStorage.getItem(preservedRunKey)).toBe(newerRun);
  expect(localStorage.getItem(Base.PRESERVED_KEY(1))).toBe(newerBase);
  expect(localStorage.getItem(runKey)).toBeNull(); expect(localStorage.getItem(baseKey)).toBeNull();
});

it('任一保全写失败均在同一租约中停止，两个主档不被删除', async () => {
  const set = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === preservedRunKey) throw new Error('quota');
    return set.call(this, key, value);
  });
  expect(await clearSlot(1, {preserveAbnormal:true})).toMatchObject({ok:false,code:'PRESERVE_FAILED'});
  expect(localStorage.getItem(runKey)).toBe(runRaw); expect(localStorage.getItem(baseKey)).toBe(baseRaw);
  expect(locks.calls).toEqual(['sdt-slot-1']);
});

it('清槽后只有Run被另一标签创建，随后覆盖初始化也不得创建错配基地', async () => {
  expect(await clearSlot(1, {preserveAbnormal:true})).toEqual({ok:true,slot:1});
  await locks.request('sdt-slot-1', {mode:'exclusive'}, () => localStorage.setItem(runKey, newerRun));
  expect(await Base.reset(1, {overwrite:true})).toBe(false);
  expect(localStorage.getItem(runKey)).toBe(newerRun); expect(localStorage.getItem(baseKey)).toBeNull();
});
