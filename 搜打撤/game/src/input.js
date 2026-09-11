import SDT from './sdt-facade.js';
/* ============================================================
 * input.js —— 动作映射层（input-systems：玩法读动作，不读裸键）
 *
 * 玩法代码只问「actionFor(e) 是哪个动作」，键位是数据：
 * 改键 / 手柄接入 / 提示文案都以这里为唯一挂点。
 * 键位覆写存 localStorage 'sdt-keybinds'（action → key 名，小写）。
 * ============================================================ */


// 动作 → 默认键位（e.key 的小写形式；Space 键名为 ' '）
const DEFAULT_BINDINGS = {
  roll:         [' ', 'enter'],   // 掷骰 / 确认推进
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

let bindings = loadBindings();

function loadBindings() {
  const merged = {};
  Object.entries(DEFAULT_BINDINGS).forEach(([action, keys]) => { merged[action] = [...keys]; });
  try {
    const saved = JSON.parse(localStorage.getItem('sdt-keybinds') || '{}');
    Object.entries(saved).forEach(([action, key]) => {
      if (merged[action] && key) merged[action] = [String(key).toLowerCase()];
    });
  } catch (e) { /* 覆写损坏则用默认键位 */ }
  return merged;
}

// 事件 → 动作名；无匹配返回 null
function actionFor(event) {
  const k = String(event && event.key || '').toLowerCase();
  for (const [action, keys] of Object.entries(bindings)) {
    if (keys.includes(k)) return action;
  }
  return null;
}

// 改键（持久化）；conflict 检测：返回被挤掉的动作名或 null
function rebind(action, key) {
  if (!bindings[action] || !key) return null;
  const k = String(key).toLowerCase();
  const prev = bindings[action][0];
  let conflict = null;
  Object.entries(bindings).forEach(([a, keys]) => {
    if (a !== action && keys.includes(k)) { bindings[a] = keys.filter(x => x !== k); conflict = a; }
  });
  bindings[action] = [k];
  try { localStorage.setItem('sdt-keybinds', JSON.stringify(
    Object.fromEntries(Object.entries(bindings).map(([a, ks]) => [a, ks[0]]))
  )); } catch (e) { /* 存储不可用 */ }
  return conflict;
}

function reset() {
  try { localStorage.removeItem('sdt-keybinds'); } catch (e) { /* 存储不可用 */ }
  bindings = loadBindings();
}

SDT.Input = Object.freeze({ actionFor, rebind, reset, get bindings() { return bindings; }, DEFAULT_BINDINGS });

export { actionFor };
