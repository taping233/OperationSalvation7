// @ts-check
// Preserve the eager UiScale registration used by synchronous UI/card-zoom consumers.
import './ui-scale.js';
import { TERM_KEYWORDS } from './term-definitions.js';
import { allowsTermTip } from './term-tip-policy.js';
/* 词条与动作说明浮框；卡面和卡牌详情中的词条共用触摸与悬停介绍。
 * 全局单例 + 事件委托：战斗状态角标（bt-curse/bt-buff、
 * 诅咒之刃 chips、敌方狂乱角标）统一由 document 级委托接管，渲染点零改动自动生效。
 * 桌面悬停或键盘聚焦显示；触屏按下显示、松手收起。data-ui-tip 提供动态动作说明。
 * data-term 的 click 与键盘激活在同步捕获层拦截；动态动作说明保留按钮的原始点击与拖动。
 * 首个词条交互加载渲染模块；加载期间仅保留当前有效意图，取消后不会迟到显示。
 * 讲解文案以机制代码为底稿：诅咒/祝福 = combat.js CURSE_META/BUFF_META；注能 = 出牌结算 fuel 链；
 * 发现 = 三选一置入手牌；消耗 = 进入消耗牌堆，只能由卡牌效果取回；主动技能 = 装备穿戴后角色信息区按钮发动（每场一次）；
 * 狂乱 = battle.core AFFIX 表。 */
// 卡面描述文本词 → 词条 key；具体伤害类型有讲解，生命/回合等常识词保持纯高亮。
/** @type {Record<string, string>} */
const TERM_ALIAS = {
  ...TERM_KEYWORDS,
  '攻击伤害': 'attackDamage', '法术伤害': 'spellDamage', '固定伤害': 'fixedDamage', '真实伤害': 'trueDamage', '法伤': 'spellPower',
  '冰冻': 'freeze', '冻结': 'freeze', '中毒': 'poison',
  '流血': 'bleed', '沉默': 'silence', '禁疗': 'healban', '诅咒': 'curse', '净化': 'purify', '充能': 'charge',
  '招式': 'moves',
  '潜行': 'stealth',
  '注能': 'infuse', '发现': 'discover', '消耗': 'exhaust', '限定': 'equipSkill', '主动技能': 'equipSkill',
};

/** 卡面描述文本词 → 词条 key；未收录词返回 null。
 * @param {string} word
 * @returns {string|null}
 */
export function termKeyFor(word) { return TERM_ALIAS[word] || null; }
// The eager shell owns all interaction state. Loading only paints the latest live
// trigger once; it never redispatches an input event into cards or buttons.
/** @type {ReturnType<typeof import('./term-tips.runtime.js').createTermTipRenderer>|null} */
let renderer = null;
/** @type {Promise<void>|null} */
let loading = null;
/** @type {Element|null} */
let curEl = null;
/** @type {Element|null} */
let hoverEl = null;
/** @type {Element|null} */
let focusEl = null;
/** @type {number|null} */
let pressedPointer = null;
/** @type {number|null} */
let hoverExitTimer = null;

function cancelHoverExit() {
  if (hoverExitTimer !== null) window.clearTimeout(hoverExitTimer);
  hoverExitTimer = null;
}

/** @param {EventTarget|null} target */
function isTip(target) {
  return target instanceof Element && !!target.closest('#sdt-term-tip');
}

/** @param {Element|null} el @returns {el is Element} */
function isLive(el) {
  return el !== null && el.isConnected && !el.closest('[hidden], [inert], [aria-hidden="true"]')
    && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}


const coldObserver = new MutationObserver(() => { if (curEl && !isLive(curEl)) hide(); });

/** @param {Element} el */
function show(el) {
  if (!isLive(el)) { hide(); return; }
  curEl = el;
  if (renderer) { renderer.show(el); return; }
  coldObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden', 'inert', 'aria-hidden'] });
  if (loading) return;
  loading = import('./term-tips.runtime.js').then(module => {
    renderer = module.createTermTipRenderer(hide, isLive);
    coldObserver.disconnect();
    if (curEl) renderer.show(curEl);
  }).catch(error => {
    hide();
    console.warn('[term-tips] Tooltip loading failed; the next interaction can retry.', error);
  }).finally(() => { loading = null; });
}

/** Clear both cold intent and the visible tooltip. */
function hide() {
  pressedPointer = null; curEl = null; hoverEl = null; focusEl = null;
  cancelHoverExit();
  coldObserver.disconnect(); renderer?.hide();
}

function syncTrigger() {
  if (!isLive(hoverEl)) hoverEl = null;
  if (!isLive(focusEl)) focusEl = null;
  const trigger = hoverEl || focusEl;
  if (trigger) show(trigger); else hide();
}

/** 自事件目标向上找最近的带 data-term 的词条元素。
 * @param {EventTarget|null} t
 * @returns {Element|null}
 */
function closestTerm(t) {
  if (!(t instanceof Element) || !allowsTermTip(t)) return null;
  return t.closest('[data-term]');
}

/** @param {EventTarget|null} t @returns {Element|null} */
function closestTrigger(t) {
  if (!(t instanceof Element) || !allowsTermTip(t)) return null;
  return t.closest('[data-term], [data-ui-tip]');
}

/** document 级事件委托接管全部词条触发（悬停即显/按压即显/点击只讲解/滚动收起）。 */
function initTermTips() {
  document.addEventListener('pointerover', (e) => {
    if (hoverExitTimer !== null && !closestTrigger(e.target) && !isTip(e.target)) return;
    cancelHoverExit();
    if (isTip(e.target)) return;
    const trigger = closestTrigger(e.target);
    if (trigger === hoverEl) return;
    hoverEl = trigger; syncTrigger();
  });
  document.addEventListener('pointerout', (e) => {
    if (isTip(e.target)) {
      if (isTip(e.relatedTarget)) return;
      hoverEl = closestTrigger(e.relatedTarget); syncTrigger();
      return;
    }
    if (closestTrigger(e.target) === closestTrigger(e.relatedTarget)) return;
    if (isTip(e.relatedTarget)) return;
    // Keep an already-painted panel open across its small anchor gap. A new
    // trigger cancels this timer and replaces the old content immediately.
    if (renderer && hoverEl && !closestTrigger(e.relatedTarget)) {
      cancelHoverExit();
      hoverExitTimer = window.setTimeout(() => {
        hoverExitTimer = null; hoverEl = null; syncTrigger();
      }, 120);
      return;
    }
    hoverEl = closestTrigger(e.relatedTarget); syncTrigger();
  });
  document.addEventListener('focusin', (e) => {
    focusEl = closestTrigger(e.target); syncTrigger();
  });
  document.addEventListener('focusout', (e) => {
    focusEl = closestTrigger(e.relatedTarget); syncTrigger();
  });
  document.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') hide();
    // Keep activation out of parent card handlers even before the chunk arrives.
    if ((e.key === 'Enter' || e.key === ' ') && closestTerm(e.target)) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  // 动作说明的鼠标悬停不随松键清除；触屏和原词条沿用按下显示、松手收起。
  document.addEventListener('pointerdown', (e) => {
    const t = closestTrigger(e.target);
    if (!t) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    show(t);
    pressedPointer = e.pointerType === 'mouse' && t.hasAttribute('data-ui-tip') ? null : e.pointerId;
  });
  /** @param {PointerEvent} e */
  const end = e => { if (pressedPointer !== null && e.pointerId === pressedPointer) hide(); };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // A cold touch that has moved away must not open a delayed tooltip. The
  // already-visible reading gesture retains its original release lifecycle.
  document.addEventListener('pointermove', e => {
    if (renderer || pressedPointer === null || pressedPointer !== e.pointerId) return;
    // Touch implicit capture keeps e.target on the original word after moving away.
    const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
    if (closestTrigger(hit) !== curEl) hide();
  });
  // 点在词条上只讲解：捕获层拦掉 click，不触发卡面特写/出牌/按钮
  document.addEventListener('click', (e) => {
    if (!closestTerm(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // 其他容器滚动即收；浮框自身滚动用于阅读长说明。
  window.addEventListener('scroll', e => { if (!isTip(e.target)) hide(); }, true);
  window.addEventListener('resize', () => { renderer?.resize(); });
  document.addEventListener('sdt-overlay-mode', hide);
  document.addEventListener('sdt-overlay-close', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('blur', hide);
}

// main.js 为 ESM defer 链，模块执行时 DOM 已解析，直接挂
initTermTips();
