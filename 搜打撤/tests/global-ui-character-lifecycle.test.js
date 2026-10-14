import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
let UI, idle;
function makeDOM() {
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
}
beforeAll(async () => {
  makeDOM();
  window.SDT = { Icons:{ rich:x=>x }, Sound:{ sfx() {}, scene() {} }, Motion:{ overlayIn() {}, reduceMotion:()=>false } };
  ({ UI } = await import('../game/src/ui/ui.js'));
  idle = await import('../game/src/ui/character-idle.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn=>setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  makeDOM(); UI._overlayInerted=[]; UI._lastMode=null; UI._hideTimer=null; UI.init();
});
afterEach(() => { idle.unmountCharacterIdle(); UI.hideOverlay({ immediate:true }); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('真实 overlay 关闭后释放已断开的角色宿主，不等下一次开页', () => {
  UI.showOverlay('选人', '<section class="cls2-page"><div class="cls2-fullart"><span class="art-figure-wrap figure-wu"><img></span></div></section>', 'page');
  const host = document.querySelector('.cls2-fullart');
  expect(idle.idleMountState()?.host).toBe(host);
  UI.hideOverlay({ immediate:true });
  expect(host.isConnected).toBe(false);
  expect(idle.idleMountState()).toBeNull();
});
it('淡出开始即停止待机；重复关闭幂等', async () => {
  UI.showOverlay('选人', '<div class="cls2-fullart"><span class="art-figure-wrap figure-wu"></span></div>', 'page');
  const host = document.querySelector('.cls2-fullart');
  UI.hideOverlay(); UI.hideOverlay();
  expect(host.isConnected).toBe(true);
  expect(host.classList.contains('idle-stage')).toBe(false);
  expect(idle.idleMountState()).toBeNull();
  await vi.advanceTimersByTimeAsync(230);
  expect(host.isConnected).toBe(false);
});
it('淡出期间新页替换后旧收尾不会卸载新角色', async () => {
  UI.showOverlay('旧选人', '<div class="cls2-fullart"><span class="art-figure-wrap figure-wu"></span></div>', 'page');
  UI.hideOverlay();
  UI.showOverlay('新选人', '<div class="cls2-fullart"><span class="art-figure-wrap figure-baita"></span></div>', 'page');
  const host = document.querySelector('.cls2-fullart');
  await vi.advanceTimersByTimeAsync(300);
  expect(UI.el.overlay.hidden).toBe(false);
  expect(idle.idleMountState()?.host).toBe(host);
  expect(host.dataset.idleMotion).toBe('baita');
});
it('换为其他同模式页面即释放旧宿主', () => {
  UI.showOverlay('选人', '<div class="cls2-fullart"><span class="art-figure-wrap figure-wu"></span></div>', 'page');
  const oldHost = document.querySelector('.cls2-fullart');
  UI.showOverlay('设置', '<div class="settings-page">设置</div>', 'page');
  expect(oldHost.isConnected).toBe(false);
  expect(oldHost.dataset.idleMotion).toBeUndefined();
  expect(idle.idleMountState()).toBeNull();
});
