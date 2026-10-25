import { sdtDefine } from './sdt-facade.js';
/* ============================================================
 * input.js —— 动作映射层（input-systems：玩法读动作，不读裸键）
 *
 * 玩法代码只问「actionFor(e) 是哪个动作」，键位是数据：
 * 改键 / 手柄接入 / 提示文案都以这里为唯一挂点。
 * 键位覆写存 localStorage 'sdt-keybinds'（action → 小写 key 数组；兼容旧字符串）。
 * ============================================================ */


// 动作 → 默认键位（e.key 的小写形式；Space 键名为 ' '）
const DEFAULT_BINDINGS = {
  roll:         [' ', 'enter'],   // 循环选择相邻路线 / 确认推进
  camRotateL:   ['q'],
  camRotateR:   ['e'],
  camOverview:  ['g'],
  camFocus:     ['f'],
  backpack:     ['b'],
  nodeNumbers:  ['n'],
  moveConfirm:  ['x'],
  moveCancel:   ['escape'],
  movePrev:     ['z'],
  };

const defaultBindings = () => Object.fromEntries(Object.entries(DEFAULT_BINDINGS).map(([action, keys]) => [action, [...keys]]));
let bindings = loadBindings();
let letterShortcutSession = null;

function loadBindings() {
  const merged = defaultBindings();
  try {
    const saved = JSON.parse(localStorage.getItem('sdt-keybinds') || '{}');
    Object.entries(saved).forEach(([action, key]) => {
      if (!Object.hasOwn(merged, action)) return;
      const keys = Array.isArray(key)
        ? key.every(k => typeof k === 'string' && k) ? [...new Set(key.map(k => k.toLowerCase()))] : null
        : typeof key === 'string' && key ? [key.toLowerCase()] : null;
      if (!keys) return;
      // Saved overrides take precedence over defaults, including old saves that omitted an unbound action.
      Object.keys(merged).forEach(other => {
        if (other !== action) merged[other] = merged[other].filter(k => !keys.includes(k));
      });
      merged[action] = keys;
    });
  } catch { /* 覆写损坏则用默认键位 */ }
  return merged;
}

// 事件 → 动作名；无匹配返回 null
function actionFor(event) {
  if (event?.ctrlKey || event?.altKey || event?.metaKey || event?.isComposing || event?.keyCode === 229) return null;
  const k = String(event && event.key || '').toLowerCase();
  if (!lettersEnabled() && /^[a-z]$/.test(k)) return null;
  for (const [action, keys] of Object.entries(bindings)) {
    if (keys.includes(k)) return action;
  }
  return null;
}

// 改键（持久化）；conflict 检测：返回被挤掉的动作名或 null
function rebind(action, key) {
  if (!Object.hasOwn(bindings, action) || !key) return null;
  const k = String(key).toLowerCase();
  let conflict = null;
  Object.entries(bindings).forEach(([a, keys]) => {
    if (a !== action && keys.includes(k)) { bindings[a] = keys.filter(x => x !== k); conflict = a; }
  });
  bindings[action] = [k];
  try { localStorage.setItem('sdt-keybinds', JSON.stringify(
    bindings
  )); } catch { /* 存储不可用 */ }
  notifyBindings();
  return conflict;
}

function reset() {
  try { localStorage.removeItem('sdt-keybinds'); } catch { /* 存储不可用 */ }
  bindings = defaultBindings();
  notifyBindings();
}

function notifyBindings() { if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('sdt-bindings-change')); }
function lettersEnabled() { if (letterShortcutSession !== null) return letterShortcutSession; try { return localStorage.getItem('sdt-letter-shortcuts') !== '0'; } catch { return true; } }
function setLettersEnabled(value) { letterShortcutSession = !!value; try { localStorage.setItem('sdt-letter-shortcuts', letterShortcutSession ? '1' : '0'); letterShortcutSession = null; } catch { /* The session preference remains active. */ } notifyBindings(); }
function bindingLabel(action) {
  const labels = { ' ': '空格', enter: 'Enter', escape: 'Esc', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓' };
  return (bindings[action] || []).map(key => labels[key] || key.toUpperCase()).join(' / ') || '未绑定';
}
export const Input = sdtDefine('Input', Object.freeze({ actionFor, rebind, reset, bindingLabel, setLettersEnabled, get lettersEnabled() { return lettersEnabled(); }, get bindings() { return bindings; }, DEFAULT_BINDINGS }));
