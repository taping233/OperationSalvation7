// @ts-check
// Loaded on the first tooltip interaction. Content and placement retain the shared rules.
import SDT from '../core/sdt-facade.js';
import { BASE_W, BASE_H, scale } from './ui-scale.js';

/** 词条讲解条目（TERM_TIPS 值形状；icon 仅部分词条有，缺省 = 纯文字无图标）。
 * @typedef {{name: string, icon?: string, text: string}} TermMeta
 */

/** @type {Record<string, TermMeta>} */
const TERM_TIPS = {
  // —— 伤害类型（combat.js dealDamage）——
  attackDamage: { name: '攻击伤害', text: '按卡牌数值加你的攻击力结算；目标每有 1 层流血，额外增加 1 点伤害。可被闪避、格挡、减伤、护盾和护甲抵挡。' },
  spellDamage:  { name: '法术伤害', text: '按卡牌数值加你的法伤加成结算，不受攻击力或流血加成。不能被闪避，但可被格挡、减伤、护盾和护甲抵挡。' },
  fixedDamage:  { name: '固定伤害', text: '按标注数值结算，不受攻击力、法伤或流血加成，也不能被闪避。卡牌造成的固定伤害仍会被格挡、减伤、护盾和护甲抵挡；中毒的状态伤害直接扣除生命。' },
  trueDamage:   { name: '真实伤害', text: '按标注数值结算，不受攻击力、法伤或流血加成。无视格挡、减伤、护盾和护甲，也不能被闪避；免疫伤害仍能阻挡。' },
  spellPower:   { name: '法伤', text: '法术伤害的额外加成：每增加 1 点法伤，法术伤害增加 1 点。不影响攻击、固定或真实伤害；卡牌另有倍率说明时按该牌效果计算。' },
  // —— 诅咒（combat.js CURSE_META，key 对齐状态字段）——
  bleed:   { name: '流血', icon: 'blood',   text: '每层使受到的攻击伤害 +1。层数无上限、不会自然衰减。' },
  poison:  { name: '中毒', icon: 'skull',   text: '每层在回合结束时受到 1 点固定伤害。层数无上限、不会自然衰减。' },
  freeze:  { name: '冰冻', icon: 'crystal', text: '1 回合无法行动。' },
  silence: { name: '沉默', icon: 'cross',   text: '1 回合技能无法生效（攻击除外）。' },
  abreak:  { name: '破甲', icon: 'tools',   text: '2 回合内无法减免伤害。' },
  healban: { name: '禁疗', icon: 'heart',   text: '2 回合内无法回复生命。' },
  atkDown: { name: '攻击降低', icon: 'arrow', text: '持续期间攻击力降低，到期归还实际扣减的攻击力。' },
  // —— 祝福（combat.js BUFF_META；形态为 flag 型，本局对战常驻不递减）——
  atkUp:      { name: '攻击强化', icon: 'swords',   text: '攻击伤害 +N，持续到本场战斗结束。' },
  spellUp:    { name: '法术强化', icon: 'crystal',  text: '法术伤害 +N，持续到本场战斗结束。' },
  stealth:    { name: '潜行',     icon: 'runner',   text: '无法成为被攻击对象；造成伤害会破除潜行。' },
  immune:     { name: '免疫伤害', icon: 'sparkles', text: '不受到任何伤害。' },
  reduce:     { name: '减伤',     icon: 'plate',    text: '每次受到的伤害 -N（真实伤害除外）。' },
  dodge:      { name: '闪避',     icon: 'runner',   text: '避开下一段伤害，包括攻击、法术、固定和真实伤害；每段消耗 1 层。未标明持续时间的层数保留至本场战斗结束，限时来源按各自回合数到期。' },
  swordForm:  { name: '剑仙形态', icon: 'sword',    text: '回合开始时额外抽 1 张。形态是开关型祝福，本局对战常驻。' },
  natureForm: { name: '满月形态', icon: 'wood',     text: '回合开始时额外获得 1 点能量。形态是开关型祝福，本局对战常驻。' },
  cosmosForm: { name: '宇宙形态', icon: 'sparkles', text: '本局对战所有卡牌变为 1 费。形态是开关型祝福，本局对战常驻。' },
  // —— 机制词（卡面描述高亮词）——
  curse:      { name: '诅咒',     text: '负面状态的统称：流血、中毒、冰冻、沉默、破甲、禁疗、攻击降低。部分卡牌与「诅咒状态」联动（对被诅咒者增伤、按诅咒种类抽牌等）。' },
  purify:     { name: '净化',     text: '清除身上所有诅咒，层数与剩余回合全部归零。' },
  infuse:     { name: '注能',     text: '打出前消耗指定数量的手牌，启用本牌的注能效果；材料不计入「打出」。有基础效果时可不注能；必须注能的牌需先注能才能打出。' },
  charge:     { name: '充能',     text: '卡面写明「回合开始时，本牌伤害 +N」时，该牌每回合开始累计增加伤害，本场有效。其他充能卡的成长条件以卡面为准。' },
  discover:   { name: '发现',     text: '从三张随机卡牌（可限定卡池）中选择一张并获取。' },
  moves:      { name: '招式',     text: '武术与法术的统称：「所有招式」类效果对两种牌同时生效。' },
  exhaust:    { name: '消耗',     text: '被消耗的牌进入消耗牌堆，不自动洗回牌库，只能由卡牌效果取回。消耗本牌还是其他牌，以卡面说明为准。' },
  equipSkill: { name: '主动技能', text: '装备打出即穿戴；技能在角色信息区以按钮发动，每场战斗限一次。' },
  ability:    { name: '能力卡',   text: '只能收藏，普通战不会进入手牌；仅可编入 BOSS 战牌库使用。' },
  // —— 敌方词缀（battle.core AFFIX）——
  grow:       { name: '军威',     icon: 'arrow',   text: '该敌人每个回合结束时攻击力 +2。' },
  frenzy:     { name: '狂乱',     icon: 'tools',   text: '该敌人每回合攻击两次，每次附加 1 层流血或中毒。' },
  aegis:      { name: '元素庇幕', icon: 'crystal', text: '该敌人偶数回合减免所有伤害；「破甲」可克制。' },
};

/** 词条 key → 讲解条目；未知 key 返回 null。
 * @param {string} key
 * @returns {TermMeta|null}
 */
function termMeta(key) { return TERM_TIPS[key] || null; }

/** @typedef {TermMeta & {note?: string, dynamic?: boolean}} TipMeta */

/** @param {() => void} onHide @param {(el: Element|null) => boolean} isLive */
export function createTermTipRenderer(onHide, isLive) {
/** @type {HTMLDivElement|null} */
let tipEl = null;
/** @type {Element|null} */
let curEl = null;
/** @type {Element|null} */
let describedEl = null;
/** @type {number|null} */
let followFrame = null;
let contentKey = '';

/** @param {Element} el @returns {TipMeta|null} */
function metaFor(el) {
  if (!el.hasAttribute('data-ui-tip')) return termMeta(el.getAttribute('data-term') || '');
  const name = el.getAttribute('data-ui-tip-title') || '';
  const text = el.getAttribute('data-ui-tip-text') || '';
  return name || text ? { name, text, note:el.getAttribute('data-ui-tip-note') || '', dynamic:true } : null;
}

/** Remove only this tooltip's token, preserving other accessibility descriptions. */
function unlinkDescription() {
  if (!describedEl) return;
  const ids = (describedEl.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'sdt-term-tip');
  if (ids.length) describedEl.setAttribute('aria-describedby', ids.join(' '));
  else describedEl.removeAttribute('aria-describedby');
  describedEl = null;
}

/** @param {Element} el */
function linkDescription(el) {
  const target = el.hasAttribute('tabindex') || el.matches('button, a, input')
    ? el : el.querySelector('button, a, input, [tabindex]') || el;
  if (describedEl === target) return;
  unlinkDescription();
  const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  target.setAttribute('aria-describedby', [...new Set([...ids, 'sdt-term-tip'])].join(' '));
  describedEl = target;
}

/** 惰性创建全局讲解浮框（单例，挂在 document.body）。
 * @returns {HTMLDivElement}
 */
function ensureTip() {
  if (tipEl?.isConnected) return tipEl;
  tipEl = document.createElement('div');
  tipEl.id = 'sdt-term-tip';
  tipEl.className = 'term-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  contentKey = '';
  return tipEl;
}

/** @param {HTMLDivElement} tip @param {TipMeta} meta */
function renderContent(tip, meta) {
  const key = JSON.stringify(meta);
  if (key === contentKey) return;
  contentKey = key;
  tip.replaceChildren();
  tip.classList.toggle('is-action-tip', !!meta.dynamic);
  const icon = meta.icon && SDT.Icons && /** @type {{img?: (name: string) => string}} */ (SDT.Icons).img ? /** @type {{img: (name: string) => string}} */ (SDT.Icons).img(meta.icon) : '';
  if (icon) tip.insertAdjacentHTML('beforeend', icon);
  const title = document.createElement('b'); title.textContent = meta.name; tip.appendChild(title);
  if (meta.dynamic) {
    const text = document.createElement('span'); text.className = 'term-tip-text'; text.textContent = meta.text; tip.appendChild(text);
    if (meta.note) { const note = document.createElement('small'); note.textContent = meta.note; tip.appendChild(note); }
  } else {
    const separator = document.createElement('span'); separator.className = 'term-tip-sep'; separator.textContent = '——';
    tip.append(separator, document.createTextNode(meta.text));
  }
}

/** Body-mounted fixed positioning escapes transformed/clipped battle descendants.
 * @param {Element} el @param {HTMLDivElement} tip
 */
function positionTip(el, tip) {
  const sc = scale() || 1;
  const vw = Math.min(BASE_W, window.innerWidth / sc), vh = Math.min(BASE_H, window.innerHeight / sc);
  const inset = 8;
  tip.style.setProperty('--term-tip-max-width', `${Math.max(1, vw - inset * 2)}px`);
  tip.style.setProperty('--term-tip-max-height', `${Math.max(1, vh - inset * 2)}px`);
  const r = el.getBoundingClientRect();
  const x = r.left / sc, y = r.top / sc, w = r.width / sc, h = r.height / sc;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  /** @param {number} value @param {number} size @param {number} bound */
  const clamp = (value, size, bound) => Math.min(Math.max(value, inset), Math.max(inset, bound - size - inset));
  const left = clamp(x + w / 2 - tw / 2, tw, vw);
  const above = y - inset, below = vh - y - h - inset;
  const top = clamp(above >= th || above >= below ? y - th - inset : y + h + inset, th, vh);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** Active only while a tooltip is visible: follow animation transforms and live action state. */
function followAnchor() {
  followFrame = null;
  if (!curEl || !tipEl || tipEl.hidden) return;
  const meta = isLive(curEl) && metaFor(curEl);
  if (!meta) { onHide(); return; }
  renderContent(tipEl, meta); positionTip(curEl, tipEl);
  if (typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
}

// Observe only during display. Removed/replaced anchors disappear at the mutation boundary.
const anchorObserver = new MutationObserver(() => { if (curEl && !isLive(curEl)) onHide(); });

/** @param {Element} el */
function show(el) {
  const meta = isLive(el) && metaFor(el);
  if (!meta) { onHide(); return; }
  const tip = ensureTip();
  // Overlay background isolation may have marked this passive body sibling inert.
  tip.removeAttribute('inert');
  curEl = el; renderContent(tip, meta); linkDescription(el);
  tip.hidden = false; positionTip(el, tip);
  anchorObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden', 'inert', 'aria-hidden'] });
  if (followFrame === null && typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
}


function hide() {
  curEl = null;
  if (followFrame !== null) window.cancelAnimationFrame(followFrame);
  followFrame = null; anchorObserver.disconnect(); unlinkDescription();
  if (tipEl) tipEl.hidden = true;
}
function resize() { if (curEl && tipEl && !tipEl.hidden) positionTip(curEl, tipEl); }
return { show, hide, resize };
}
