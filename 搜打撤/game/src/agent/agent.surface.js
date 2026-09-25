/* ============================================================
 * agent.surface.js —— 弹层动作面捕获（零侵入）
 *
 * 全站页面统一经 UI.showOverlay 渲染 HTML + UI.act(name, fn) 注册回调，
 * 按钮携带 data-act 与 dataset。本模块在 observe 时直接扫当前弹层 DOM 的
 * [data-act] 元素得到「此刻玩家可点的动作」——与真人点击走同一分发路径
 * （UI._acts/_baseActs），不注册包装、不改任何页面代码。
 *
 * 无头宿主（jsdom 批跑）同样适用：只要 UI 把 HTML 渲进 #ovBody 即可扫描。
 * ============================================================ */

function overlayBody() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('ovBody');
}

function overlayVisible() {
  const overlay = typeof document !== 'undefined' ? document.getElementById('overlay') : null;
  return !!overlay && !overlay.hidden;
}

const textLabel = (el) => {
  const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > 48 ? text.slice(0, 47) + '…' : text;
};

// 当前弹层可点击动作清单：name=data-act，params=其余 dataset（与点击分发同源）。
// disabled/aria-disabled/off 的按钮不进清单（打不出去的不算可选）。
// 两个合成动作（对应真实关闭机制，页面本身没有 data-act）：
//   czClose      —— 卡牌特写层（挂在 body、ovBody 扫描不到）的点背景关闭
//   closeOverlay —— closeTopOverlayByEsc 同链路的关闭（必选页会拒绝，返回失败即换动作）
function collectUiActions() {
  const out = [];
  const seen = new Set();
  const scan = (root) => {
    if (!root) return;
    for (const el of root.querySelectorAll('[data-act]')) {
      const act = el.getAttribute('data-act');
      if (!act) continue;
      if (el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('off')) continue;
      const params = {};
      for (const [key, value] of Object.entries(el.dataset)) {
        if (key !== 'act') params[key] = value;
      }
      const key = act + JSON.stringify(params);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: 'ui', name: act, params, label: textLabel(el) });
    }
  };
  const zoom = typeof document !== 'undefined' ? document.getElementById('cardZoom') : null;
  if (zoom) out.push({ type: 'ui', name: 'czClose', params: {}, label: '关闭卡牌特写' });
  const body = overlayBody();
  if (body && overlayVisible()) {
    scan(body);
    out.push({ type: 'ui', name: 'closeOverlay', params: {}, label: '关闭当前弹层' });
  }
  return out;
}

// act 执行时按 name+params 反查真实元素：优先直调注册回调（纯接口，不模拟点击），
// 宿主未暴露 _acts（如极简夹具）时退化为元素 click——同一 ovBody 委托路径。
function findUiElement(name, params) {
  const body = overlayBody();
  if (!body) return null;
  for (const el of body.querySelectorAll('[data-act]')) {
    if (el.getAttribute('data-act') !== name) continue;
    const dataset = el.dataset;
    const matched = Object.entries(params || {}).every(([k, v]) => String(dataset[k] ?? '') === String(v ?? ''));
    if (matched) return el;
  }
  return null;
}

export { collectUiActions, findUiElement, overlayVisible, overlayBody };
