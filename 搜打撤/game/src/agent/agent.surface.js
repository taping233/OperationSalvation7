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

import { bindObservedAction, isActionTargetAvailable } from '../ui/action-dispatch.js';

function overlayBody() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('ovBody');
}

function overlayVisible() {
  const overlay = typeof document !== 'undefined' ? document.getElementById('overlay') : null;
  return !!overlay && !overlay.hidden;
}

// label 抽取按元素缓存（09-26 速度优化）：textContent 是每步 DOM 开销大头——
// 同一次渲染内的多步观察（事件/商店等多步同页）全部命中缓存
const labelCache = new WeakMap();
const textLabel = (el) => {
  const hit = labelCache.get(el);
  if (hit !== undefined) return hit;
  const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  // 120：事件选项的收益/风险在 label+detail 里，截太短会丢决策依据
  const val = text.length > 120 ? text.slice(0, 119) + '…' : text;
  labelCache.set(el, val);
  return val;
};

// 当前弹层可点击动作清单：name=data-act，params=其余 dataset（与点击分发同源）。
// disabled/aria-disabled/off 的按钮不进清单（打不出去的不算可选）。
// 两个合成动作（对应真实关闭机制，页面本身没有 data-act）：
//   czClose      —— 卡牌特写层（挂在 body、ovBody 扫描不到）的点背景关闭
//   closeOverlay —— closeTopOverlayByEsc 同链路的关闭（必选页会拒绝，返回失败即换动作）
function collectUiActions() {
  const out = [];
  const seen = new Set();
  // 战斗视图残留过滤（09-26 死锁根因①）：战斗结束 finish() 只清状态不销毁 DOM，
  // sts-* 战斗界面留在 ovBody 里——节点浮层一开，HUD 键（btPlay/btBag/btFlee…）混进
  // 浮层动作面：点击被浮层挡住无效但 handler 存在恒 ok=true，失败保护全失效，
  // LRU 翻完 HUD 后固定连点最后一键直到 spin 熔断（实测 43/44 弃局现场同构）。
  // battle 相不过滤（战斗内弹层「返回战斗」等浮层键 + HUD 本来就是合法操作面）。
  const battleActive = (() => {
    try { return !!window.SDT?.game?.battleActive; } catch { return false; }
  })();
  const scan = (root) => {
    if (!root) return;
    const styles = new Map();
    for (const el of root.querySelectorAll('[data-act]')) {
      const act = el.getAttribute('data-act');
      if (!act) continue;
      if (!isActionTargetAvailable(el, window.SDT?.UI, styles)) continue;
      if (!battleActive && el.closest('.sts-topbar, .sts-hud, .sts-arena, .sts-hand, .sts-tactics')) continue;
      const params = {};
      for (const [key, value] of Object.entries(el.dataset)) {
        if (key !== 'act') params[key] = value;
      }
      const key = act + JSON.stringify(params);
      if (seen.has(key)) continue;
      seen.add(key);
      const action = { type: 'ui', name: act, params, label: textLabel(el) };
      out.push(bindObservedAction(action, el));
    }
  };
  const zoom = typeof document !== 'undefined' ? document.getElementById('cardZoom') : null;
  if (zoom) out.push({ type: 'ui', name: 'czClose', params: {}, label: '关闭卡牌特写' });
  if (zoom) scan(zoom.querySelector('.cz-foot'));
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
  const body = document.getElementById('cardZoom')?.querySelector('.cz-foot') || overlayBody();
  if (!body) return null;
  for (const el of /** @type {NodeListOf<HTMLElement & {disabled?:boolean}>} */ (body.querySelectorAll('[data-act]'))) {
    if (el.getAttribute('data-act') !== name) continue;
    const dataset = el.dataset;
    const matched = Object.entries(params || {}).every(([k, v]) => String(dataset[k] ?? '') === String(v ?? ''));
    if (matched && isActionTargetAvailable(el)) return el;
  }
  return null;
}

// 轻量键扫描（settle 签名用）：只取 data-act+dataset，不碰 textContent——
// settle 轮询每步要算多次签名，label 抽取（textContent）是单局耗时的大头
function collectActionKeys() {
  const out = [];
  const zoom = typeof document !== 'undefined' ? document.getElementById('cardZoom') : null;
  if (zoom) out.push('czClose:{}');
  const body = zoom?.querySelector('.cz-foot') || overlayBody();
  if (!body || (!zoom && !overlayVisible())) return out;
  const styles = new Map();
  for (const el of /** @type {NodeListOf<HTMLElement & {disabled?:boolean}>} */ (body.querySelectorAll('[data-act]'))) {
    const act = el.getAttribute('data-act');
    if (!act) continue;
    if (!isActionTargetAvailable(el, window.SDT?.UI, styles)) continue;
    // 原生 attributes 直读（09-26 均耗时优化）：jsdom 的 el.dataset 是
    // DOMStringMap 代理，Object.entries 会触发 camelCase 转换+ownKeys 全扫
    // （profile 占 ~4% CPU）；签名只做变化检测，data-* 原名拼接语义等价
    let params = '';
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      if (a.name.startsWith('data-') && a.name !== 'data-act') params += `${a.name}=${a.value},`;
    }
    out.push(`${act}:{${params}}`);
  }
  out.push('closeOverlay:{}');
  return out;
}

export { collectUiActions, collectActionKeys, findUiElement, overlayVisible, overlayBody };
