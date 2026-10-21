/* 选人页仅保留 CSS 缓慢水平待机；不创建粒子画布、光效或绘制循环。 */
import SDT from '../core/sdt-facade.js';

function reducedMotion() {
  const fn = SDT && SDT.Motion && SDT.Motion.reduceMotion;
  if (typeof fn === 'function') { try { if (fn()) return true; } catch { /* 门面异常按未降级处理 */ } }
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch { return false; }
}

const IDLE_SPECS = Object.freeze(Object.fromEntries(
  ['wu', 'changwuyu', 'baita', 'heixiang', 'xingyue'].map(id => [id, Object.freeze({ motion: id })]),
));
function idleSpecFor(characterId) { return IDLE_SPECS[characterId] || null; }

let active = null;   // { host, wrap, spec }

function unmountCharacterIdle() {
  if (!active) return;
  const { host } = active;
  host.classList.remove('idle-stage');
  delete host.dataset.idleMotion;
  active = null;
}

function mountCharacterIdle(host) {
  if (!host || typeof host.querySelector !== 'function') return false;
  const wrap = /** @type {HTMLElement} */ (host.querySelector('.art-figure-wrap'));
  const m = wrap && /(?:^|\s)figure-([a-z]+)/.exec(String(wrap.className || ''));
  const spec = m && idleSpecFor(m[1]);
  if (!spec) return false;
  if (active && active.host === host) return true;      // 同宿主重复广播（如皮肤热切不重建）不重挂
  unmountCharacterIdle();
  if (reducedMotion()) return false;                    // 降动效：静态立绘原样
  host.classList.add('idle-stage');
  host.dataset.idleMotion = spec.motion;
  active = { host, wrap, spec };
  return true;
}

function idleMountState() {
  return active ? Object.freeze({ host: active.host, motion: active.spec.motion, spec: active.spec }) : null;
}

/* ---------- 自挂载入口（main.js 副作用 import；node 环境无 document 直跳过） ---------- */
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  // showOverlay 每次重建 ovBody 后广播本事件（ui/overlay.js），选人页开页/切人均会触发；
  // 离开选人页时清理旧宿主标记。
  document.addEventListener('sdt-overlay-mode', () => {
    const host = /** @type {HTMLElement} */ (document.querySelector('.cls2-fullart'));
    if (host) mountCharacterIdle(host);
    else unmountCharacterIdle();
  });
  document.addEventListener('sdt-overlay-close', unmountCharacterIdle);
}

export { IDLE_SPECS, idleSpecFor, mountCharacterIdle, unmountCharacterIdle, idleMountState };
