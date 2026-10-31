import { storeGet, storeSet } from '../core/storage.js';

const preferenceKey = 'sdt-courtyard';
export function readCourtyardPreferences() {
  let value;
  try { value = JSON.parse(storeGet(preferenceKey, '{}')) || {}; } catch { value = {}; }
  return { rain:typeof value.rain === 'boolean' ? value.rain : true,
    intensity:value.intensity === 80 ? 80 : 40,
    palette:['slate', 'moss', 'clay'].includes(value.palette) ? value.palette : 'slate', sound:value.sound === true };
}
export const saveCourtyardPreferences = preferences => storeSet(preferenceKey, JSON.stringify(preferences));
const preferenceStore = { read:readCourtyardPreferences, write:saveCourtyardPreferences };

export function courtyardV3HTML() {
  const preferences = readCourtyardPreferences();
  return `<section class="courtyard-v3 courtyard-zzz" data-courtyard="pond">
    <div class="courtyard-zzz-workspace">
    <div class="courtyard-v3-scene"><canvas class="courtyard-v3-backdrop" aria-hidden="true"></canvas>
      <canvas class="courtyard-v3-canvas" tabindex="0" role="button" aria-label="锦鲤池：点击投喂并泛起雨圈"></canvas><canvas class="courtyard-v3-rain-layer" aria-hidden="true"></canvas>
      <span class="courtyard-v3-status" role="status" aria-live="polite"></span>
    </div>
    <aside class="courtyard-v3-controls">
      <div class="courtyard-v3-info"><span class="courtyard-v3-hint">轻点投喂 · 划过锦鲤发现它们</span>
      <div class="courtyard-v3-progress"><span data-pond-found>发现锦鲤 0 / 9</span><span data-pond-eaten>吃食 0 次</span></div></div>
      <button type="button" class="courtyard-v3-rain-toggle" data-courtyard-control="rain" aria-pressed="${preferences.rain}">${preferences.rain ? '关闭雨' : '开启雨'}</button>
      <button type="button" class="courtyard-v3-feed" data-courtyard-control="feed">投喂</button><details class="courtyard-v3-settings"><summary>环境设置</summary><div class="courtyard-v3-settings-content"><h3>雨声与色调</h3><div class="courtyard-v3-settings-actions"><button type="button" data-courtyard-control="interact">雨势：细雨</button><button type="button" data-courtyard-control="sound" aria-pressed="false">声音：关</button><button type="button" data-courtyard-control="pause" aria-pressed="false">暂停</button></div><nav class="courtyard-v3-swatches" aria-label="雨台配色"><button data-courtyard-control="palette" data-palette="slate" aria-pressed="true">冷灰</button><button data-courtyard-control="palette" data-palette="moss" aria-pressed="false">苔绿</button><button data-courtyard-control="palette" data-palette="clay" aria-pressed="false">暖陶</button></nav></div></details>
    </aside></div></section>`;
}

// The page shell and cleanup contract are synchronous; canvas engines are
// loaded only when this feature is mounted. A pending page cannot revive after
// its owner disposes it or replaces its host.
let runtimePromise = null;
let runtimeModule = null;

function loadRuntime() {
  if (!runtimePromise) {
    const loading = import('./hub.courtyard-runtime.js').then(module => {
      runtimeModule = module;
      return module;
    });
    const retryable = loading.catch(error => {
      if (runtimePromise === retryable) runtimePromise = null;
      throw error;
    });
    runtimePromise = retryable;
  }
  return runtimePromise;
}

export function mountCourtyardV3(root) {
  const host = root?.matches?.('[data-courtyard]') ? root : root?.querySelector('[data-courtyard]');
  if (!host) return () => {};
  if (runtimeModule) return runtimeModule.mountCourtyardV3(root, preferenceStore);

  const status = host.querySelector('.courtyard-v3-status');
  const canvas = host.querySelector('.courtyard-v3-canvas');
  const buttons = [...host.querySelectorAll('button')].map(button => [button, button.disabled]);
  const previousBusy = host.getAttribute('aria-busy');
  const previousDisabled = canvas?.getAttribute('aria-disabled');
  const previousStatus = status?.textContent || '';
  const loadingMessage = '正在准备庭院';
  if (status) status.textContent = loadingMessage;
  host.setAttribute('aria-busy', 'true');
  canvas?.setAttribute('aria-disabled', 'true');
  for (const [button] of buttons) button.disabled = true;
  let disposed = false;
  let release = null;
  let loadingReleased = false;
  const releaseLoading = () => {
    if (loadingReleased) return;
    loadingReleased = true;
    if (previousBusy === null) host.removeAttribute('aria-busy');
    else host.setAttribute('aria-busy', previousBusy);
    if (previousDisabled === null) canvas?.removeAttribute('aria-disabled');
    else if (previousDisabled !== undefined) canvas?.setAttribute('aria-disabled', previousDisabled);
    for (const [button, disabled] of buttons) button.disabled = disabled;
    if (status?.textContent === loadingMessage) status.textContent = previousStatus;
  };
  loadRuntime().then(module => {
    releaseLoading();
    if (disposed || !host.isConnected) return;
    release = module.mountCourtyardV3(root, preferenceStore);
  }).catch(error => {
    releaseLoading();
    if (disposed || !host.isConnected) return;
    if (status) status.textContent = '庭院加载失败，请离开后重新进入';
    for (const [button] of buttons) button.disabled = true;
    console.warn('[courtyard] 庭院模块加载失败，可重新进入重试', error);
  });
  return () => {
    if (disposed) return;
    disposed = true;
    releaseLoading();
    release?.();
    release = null;
  };
}
