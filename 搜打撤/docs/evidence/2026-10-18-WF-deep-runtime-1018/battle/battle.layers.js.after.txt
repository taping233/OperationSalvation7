import { isTargetableEnemy } from '../core/battle.target-session.js';
import { requiresInfusion } from '../effects/battle.infusion.js';
import { isHandArrivalEvent } from '../core/battle.card-presentation.js';
/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：手牌与单位区常驻层（批次A/B 差分更新）+ 状态角标 statusChips/curseChips（随用迁入）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect, scale as uiScale } from '../../ui/ui-scale.js';
import { characterName } from '../../core/characters.js';
import { esc, escAttr } from '../../core/shared.js';
import { assetUrl } from '../../core/asset-url.js';
import { fanLayout } from '../core/battle.hand.js';
import { createHandHitController } from './battle.hand-hit.js';
import { handDisplayLayout as referenceHandLayout } from './battle.hand-layout.js';
import { calculateEnemyIntent } from '../core/battle.enemy-intent.js';
import { intentViewModel } from './battle.intent.view.js';
import { isAreaEffect } from '../effects/battle.target-rules.js';
import { storeGet, storeSet } from '../../core/storage.js';
/* W5-03（2026-09-27 R2）：首次意图图例样式（battle.css 冻结 → head 注入，W2-01 同款）。 */
if (!document.getElementById('stsIntentLegendStyle')) {
  document.head.insertAdjacentHTML('beforeend',
    '<style id="stsIntentLegendStyle">.sts-intent-legend{position:absolute;top:52px;left:50%;transform:translateX(-50%);z-index:9;padding:8px 16px;border:1px solid rgba(217,187,130,.4);border-radius:999px;background:rgba(8,16,24,.92);color:#ecd9ad;font-size:12px;letter-spacing:.5px;pointer-events:none;white-space:nowrap;animation:stsLegendIn .4s cubic-bezier(.22,1,.36,1) both}@keyframes stsLegendIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%)}}</style>');
}
const unsetIntentLegendToken = Symbol('unset-intent-legend-token');
let lastIsolatedIntentLegendToken = unsetIntentLegendToken;
let lastPlayerIntentLegendToken = unsetIntentLegendToken;
const INTENT_LEGEND_KEY = 'sdt-intent-legend';

function showIntentLegend({ devSample, battleToken }) {
  if (devSample) {
    if (lastIsolatedIntentLegendToken === battleToken) return false;
  } else {
    if (lastPlayerIntentLegendToken === battleToken || storeGet(INTENT_LEGEND_KEY) === '1') return false;
  }

  const host = document.getElementById('overlay') || document.body;
  if (!host || host.querySelector('.sts-intent-legend')) return false;
  const legend = document.createElement('div');
  legend.className = 'sts-intent-legend';
  legend.textContent = '敌方意图 ⚔·数字 = 下回合将对你造成的伤害（冰晶=无法行动）';
  host.appendChild(legend);
  setTimeout(() => legend.remove(), 6000);

  if (devSample) lastIsolatedIntentLegendToken = battleToken;
  else {
    lastPlayerIntentLegendToken = battleToken;
    storeSet(INTENT_LEGEND_KEY, '1');
  }
  return true;
}
import { commands, getSnapshot, AFFIX_META, Combat, aegisBlocked, effCostOf, findEffectiveCard as findCard, infusionFuelReason, infuseOf, targetSide, unplayableReason, handCurseSpecs } from '../core/battle.core.js';
  const resolveSlam = commands.resolveSlam;
  const resolveDart = commands.resolveDart;   // 血毒双镖二段点选（2026-09-16 留言）
  const useItemCmd = commands.useItem;
  const cancelPendingTarget = commands.cancelPendingTarget;
  const HAND_PAGE_SIZE = 9;   // 2026-09-16 老板：每栏最多 9 张（原 battle.view 渲染段，随 updateHand 的 handIndex 落位迁入——批5）
import { animateSafe } from './battle.anim.view.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';
import { aim, clickSelectedUid, clickSelectedTarget, setTargetable, startAim, cancelAim, cancelClickSelection, selectCardByClick, syncSubmittedCardPoses } from './battle.aim.js';
import { showFoePreview, clearFoePreview } from './battle.hover.js';
import { cardRuleHint } from './battle.preview.js';
import { updateHandAcquisitionFeedback } from './battle.effect-feedback.js';
  // 数字键选牌 / Esc 取消（原在 aim 片：需读手牌层 handLayer，随迁本片解 aim↔layers 环——2026-09-22 批5）
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (UI.el.ovBody?.querySelector('.battle-secondary-panel')) return;
    if (e.key === 'Escape') {
      // 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是取消瞄准/点选/注能
      if (e.isComposing || e.keyCode === 229) return;
      if (e.defaultPrevented || !UI.el.ovBody?.querySelector('.battle-stage')) return;
      const snap = getSnapshot();
      const pending = snap.pendingTarget || snap.pendingItem || snap.slamPending || snap.dartPending;
      if (aim || clickSelectedUid != null || pending || snap.infusing) {
        e.preventDefault(); e.stopPropagation();
        if (aim) cancelAim();
        if (clickSelectedUid != null) cancelClickSelection();
        if (pending) cancelPendingTarget();
        if (snap.infusing) commands.cancelInfusion();   // 注能态 Esc 取消（09-25 三批走查：原唯一入口是注能条按钮）
      }
      return;
    }
    if (!handLayer || e.defaultPrevented) return;
    if (e.shiftKey) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!/^[1-9]$/.test(e.key)) return;
    const el = handLayer.querySelector(`.bt-card[data-hand-index="${e.key}"]`);
    if (!el) return;
    e.preventDefault();
    if (getSnapshot().infusing) {
      const rec = [...handSlots.values()].find(entry => entry.card === el);
      const uid = infuseRotateUid(rec?.group, getSnapshot().infusing);
      if (uid) commands.selectInfusion(uid);
    }
    else selectCardByClick(el.dataset.uid, true, { autoSingleTarget: false });
  });
  function onTargetKeydown(e) {
    if (e.target.closest('.sts-hand-tools')) return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.target !== e.currentTarget || !e.currentTarget.classList.contains('can-target')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.click();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const targets = [...document.querySelectorAll('#btSelf.can-target, .bt-foe.can-target')];
    if (targets.length < 2) return;
    const index = targets.indexOf(e.currentTarget);
    if (index < 0) return;
    e.preventDefault();
    e.stopPropagation();
    targets[(index + (e.key === 'ArrowRight' ? 1 : -1) + targets.length) % targets.length].focus();
  }
  // 状态角标：祝福（绿）+ 诅咒（红）——2026-09-11 架构批次 1 自 battle.core 外迁（纯视图函数）
  // compact（敌方名牌收纳，迭代评审 09-20）：总数>4 时退化为「图标+层数」——纯图标会丢层数（美术岗复核口径）；
  // 玩家名牌不传 compact，维持原样。09-20 老板：词条触摸讲解——data-term 交 term-tips.js 弹自绘讲解框
  // （系统 title 已被 game.boot 全局移除，触屏也无效），讲解框自带全名+全文，compact 不再需要分叉文案
  function statusChips(status, opts) {
    const compactAll = !!(opts && opts.compact);
    const activeBuffs = Combat.BUFFS.filter(k => (status[k] || 0) > 0);
    const activeCurses = Combat.CURSES.filter(k => (status[k] || 0) > 0);
    const compact = compactAll && (activeBuffs.length + activeCurses.length) > 4;
    const buffs = activeBuffs.map(k => {
      const m = Combat.BUFF_META[k];
      const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
      const label = compact ? `${status[k]}${m.timed ? '回合' : ''}` : `${m.name}${v}`;
      return `<span class="bt-buff b-${k}" data-term="${k}">${m.icon} ${label}</span>`;
    });
    const curses = activeCurses.map(k => {
      const m = Combat.CURSE_META[k];
      const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
      const label = compact ? (m.stack ? `${status[k]}` : `${status[k]}回合`) : txt;
      return `<span class="bt-curse c-${k}" data-term="${k}">${m.icon} ${label}</span>`;
    });
    return buffs.concat(curses).join(' ');
  }
  const curseChips = statusChips;   // 兼容旧调用名
  // ---------- 手牌常驻层（架构批次A：手牌区不随整屏重渲染重建） ----------
  // ovBody 每次渲染整块重建，但 .sts-hand 由本模块持有、跨渲染复用（showOverlay 之后
  // replaceWith 挂回新舞台）。每叠同名卡一个常驻槽位节点：
  //   - 扇形位 = CSS 变量目标值（--fx/--fy/--frot/--fs），位置变化用可取消 WAAPI 补间，
  //     对齐 STS2 NHandCardHolder「SetTargetPosition + 可取消动画 + 误差吸附」结构；
  //   - hover / 指向拎起 / 双击放大只碰类名，不触发重建；
  //   - 卡面内容按序列化签名 diff，内容没变不重写 innerHTML（图片不重载、悬停态不闪）。
  let handLayer = null, handHit = null, handPlay = null;
  const handSlots = new Map();   // key -> { slot, card, sig, rect, isNew }
  let handLayoutSlots = [], handLayoutWidth = 0, handResizeObserver = null;
  // 两层分别核对拥有者；单位先挂载不能提前替手牌消耗换场检查。
  let handBattleToken = null;
  let unitBattleToken = null;

  function captureHandFocus() {
    const element = document.activeElement;
    if (!element || !handLayer?.contains(element)) return null;
    const entry = [...handSlots.entries()].find(([, rec]) => rec.card.contains(element));
    if (!entry) return null;
    const [key, rec] = entry;
    const rules = rec.card.querySelector('.hsc-desc');
    return { element, key, token:handBattleToken, uid:rec.card.dataset.uid,
      uids:[...(rec.group?.uids || [])], order:handLayoutSlots.map(item => item.slot),
      index:handLayoutSlots.indexOf(rec), reading:!!rules?.contains(element), scrollTop:rules?.scrollTop || 0 };
  }

  function restoreHandFocus(previous, ordered) {
    if (!previous || previous.token !== handBattleToken || !handLayer?.isConnected) return;
    const active = document.activeElement;
    // Rebuilding a focused subtree usually leaves body focused. Any deliberate
    // transfer to a target, another hand control, or an overlay keeps ownership.
    if (active && active !== previous.element && active !== document.body && active !== document.documentElement) return;
    const visible = ordered.filter(rec => rec.slot.isConnected && !rec.slot.closest('[hidden], [aria-hidden="true"], [inert]'));
    const same = visible.find(rec => handSlotKey(rec.group) === previous.key)
      || visible.find(rec => rec.group.uids.includes(previous.uid))
      || visible.find(rec => rec.group.uids.some(uid => previous.uids.includes(uid)));
    if (same?.card.contains(previous.element) && active === previous.element) return;
    let nearest = null, distance = Infinity;
    visible.forEach(rec => {
      const oldIndex = previous.order.indexOf(rec.slot);
      if (oldIndex < 0) return;
      const nextDistance = Math.abs(oldIndex - previous.index);
      if (nextDistance < distance) { nearest = rec; distance = nextDistance; }
    });
    const rec = same || nearest || visible[Math.min(Math.max(previous.index, 0), visible.length - 1)];
    const rules = same?.card.querySelector('.hsc-desc');
    const stage = handLayer.closest('.battle-stage');
    const target = rec
      ? (previous.reading && same ? same.card.querySelector('.hsc-desc[tabindex]') : null) || rec.card.querySelector('.hs-card[role="button"]')
      : stage?.querySelector('.bt-hand-page:not(:disabled)') || stage?.querySelector('.sts-options > summary');
    if (!target) return;
    target.focus({ preventScroll:true });
    if (rules) rules.scrollTop = previous.scrollTop;
  }

  function handSlotKey(g) {
    return (g.self ? 'self|' : '') + g.key;
  }
  function setHandAttribute(node, name, value) {
    if (value === null) {
      if (node.hasAttribute(name)) node.removeAttribute(name);
    } else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
  }
  function setHandVariable(slot, name, value) {
    const text = String(value);
    if (slot.style.getPropertyValue(name) !== text) slot.style.setProperty(name, text);
  }
  function setSlotVars(slot, L) {
    setHandVariable(slot, '--fx', L.x + 'px');
    setHandVariable(slot, '--fy', L.y + 'px');
    setHandVariable(slot, '--frot', L.rot + 'deg');
    setHandVariable(slot, '--counter-rot', -L.rot + 'deg');
    setHandVariable(slot, '--fs', L.scale);
    setHandVariable(slot, '--hand-index', L.index ?? 0);
    setHandVariable(slot, '--hand-rest', (L.rest ?? 64) + 'px');
    setHandVariable(slot, '--hand-visible-width', (L.visibleWidth ?? 204) + 'px');
  }
  // 只改变手牌视图位置；分组、顺序、出牌 UID 与差分槽位保持原语义。
  function handDisplayLayout(index, count, width) {
    if (count > 9) return fanLayout(index, count);
    return referenceHandLayout(index, count, width);
  }
  function syncHandWidth() {
    if (!handLayer?.isConnected) return;
    const width = handLayer.clientWidth;
    if (width <= 0 || width === handLayoutWidth) return;
    handLayoutWidth = width;
    handLayoutSlots.forEach((rec, index) => setSlotVars(rec.slot, handDisplayLayout(index, handLayoutSlots.length, width)));
  }
  function observeHandWidth() {
    if (!handResizeObserver && typeof ResizeObserver !== 'undefined') {
      handResizeObserver = new ResizeObserver(syncHandWidth);
      handResizeObserver.observe(handLayer);
    }
    syncHandWidth();
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { handResizeObserver?.disconnect(); handHit?.dispose(); });
  // N1 视图侧闭环（2026-09-25）：注能选牌态整叠同名卡共享一个槽位节点，点击发的
  // dataset.uid 渲染时固定为叠代表（g.uids[0]）——连点永远发同一个 uid，引擎 per-uid
  // toggle（99daf74）下就是 0→1→0 循环，一叠选不满 need 张。这里按「轮转」算本次
  // 按下应发的 uid：
  //   容量未满且组内有未选 → 从组内最近被选的那张之后（循环）发下一个未选 uid；
  //   容量已满或组内全被选 → 发组内最早被选的 uid（引擎 delete 它 = 取消第一张）。
  // 容量按全局 picked.length vs need 判（引擎 add 校验是全局容量）：组内还有未选但
  // need 已被占满时，发未选 uid 只会被引擎拒收成死点击，改发取消才能「再点轮转回取消」。
  // picked 为快照冻结数组（引擎 Set 插入序 = 点选时间序）；返回 null 表示无需轮转。
  function infuseRotateUid(g, infusing) {
    if (!g || g.self || !infusing || !infusing.picked) return null;
    const uids = g.uids;
    if (!uids?.length) return null;
    if (uids.length === 1) return uids[0];
    const inGroup = infusing.picked.filter(u => uids.includes(u));   // 组内已选，按点选先后
    if (inGroup.length >= uids.length || infusing.picked.length >= infusing.need) return inGroup[0] || null;
    const cursor = inGroup.length ? uids.indexOf(inGroup[inGroup.length - 1]) : -1;
    for (let step = 1; step <= uids.length; step++) {
      const u = uids[(cursor + step) % uids.length];
      if (!infusing.picked.includes(u)) return u;
    }
    return null;
  }
  function infusionStackUid(uid) {
    const group = [...handSlots.values()].find(rec => rec.group?.uids.includes(uid))?.group;
    return infuseRotateUid(group, getSnapshot().infusing);
  }
  // 单叠手牌的即时视图状态：side/类名/提示语/卡面内容一次算全（原 render 内联计算外提）
  function handGroupState(g, ctx) {
    const { infusingNow, infusing, pendingTarget, energy, busy, spellBonus, mode } = ctx;
    const uid = g.uids[0];
    const isSelf = infusingNow && g.self;
    const pickedN = infusingNow ? g.uids.filter(u => infusing.picked.includes(u)).length : 0;
    const targeted = !infusingNow && pendingTarget && pendingTarget.uid === uid;
    const effCost = effCostOf(g.card, uid);
    const blocked = infusingNow ? (!isSelf && infusionFuelReason(uid)) : unplayableReason(g.card);   // 无法使用的卡：虚化禁用
    const blockedReason = blocked || (infusingNow ? '' : busy ? '当前动作正在结算' : effCost > energy ? `能量不足：需要 ${effCost}，当前 ${energy}` : '');
    const rawSide = (!infusingNow && !blocked) ? targetSide(g.card) : null;
    // 2026-09-09 老板 #7：招式若无对敌方施加的效果，拖到敌我中间空地即可打出（side 'any'）
    const side = rawSide || (blocked || infusingNow ? null : 'any');
    let cls = '';
    if (infusingNow) cls = isSelf ? ' infuse-self' : blocked ? ' off' : (pickedN ? ' sel' : '');
    else if (blocked) cls = ' off';
    else if (targeted) cls = ' targeting';
    else if ((effCost > energy || busy)) cls = ' off';
    const costTip = effCost !== g.card.cost
      ? (effCost === 0 ? `（[[icon:bolt]] 当前按 0 费打出）` : `（[[icon:sparkles]] 费用变化：按 ${effCost} 费打出）`)
      : '';
    const dynamic = g.card.rules?.triggers?.onPlay?.find(op => op.op === 'damage' && op.hits?.perPlayedMoves !== undefined);
    const hits = ctx.playedMovesThisTurn || 0;
    const amount = dynamic ? +(dynamic.amount ?? g.card.dmg ?? 0) : 0;
    let ruleHint = dynamic ? `当前 ${hits} 段 × ${amount} 基础伤害，共 ${hits * amount}；目标防御与加成另计。` : cardRuleHint(g.card, mode);
    const tip = infusingNow
      ? (isSelf ? '正在注能的卡牌' : blocked || `点击选择注能材料 · 已选 ${pickedN}/${g.uids.length} 张 · 剩余 ${g.uids.length - pickedN} 张${pickedN && (pickedN === g.uids.length || infusing.picked.length >= infusing.need) ? ' · 再点取消1张' : infusing.picked.length >= infusing.need ? ' · 材料已选满' : ''}`)
      : blockedReason
        ? `无法打出：${blockedReason}`
        : infuseOf(g.card) > 0
        ? `费用 ${effCost}${costTip} · ${requiresInfusion(g.card) ? '必须先注能；点「注能」按钮选材料' : '点「注能」按钮选材料；也可拖拽使用'}；鼠标按卡面拿起，Esc 取消；聚焦卡面按 Enter 选材料`
        : side === 'enemy'
        ? `费用 ${effCost}${costTip} · 点击选择敌人；也可直接拖到${isAreaEffect(g.card) ? '战场空地或敌人身上' : '敌人身上'}使用`
        : side === 'self'
          ? `费用 ${effCost}${costTip} · 点击选择自己；也可直接拖到战场空地或左侧人物使用`
          : side === 'any'
            ? `费用 ${effCost}${costTip} · 拖至战场空地使用；拿起后 Esc 取消；聚焦卡面按 Enter 直接使用`
            : `费用 ${effCost}${costTip} · 规则见卡面`;
    // 需求 #16：费用变动显示在卡牌左上角费用处——降低 = 绿字，提高 = 红字
    // （天狼长弓等「变为0费」的临时卡带 _baseCost：按原费用对比显示绿色 0）
    const baseCost = (g.card._baseCost != null) ? g.card._baseCost : g.card.cost;
    const costDiff = effCost !== baseCost;
    // 注能角标直接进入选材料，不消耗卡牌。
    const infN = infuseOf(g.card);
    const infChip = (!infusingNow && !blocked && infN > 0)
      ? `<button class="bt-infchip" data-act="btInfuseStart" data-uid="${uid}"
          title="开始注能(${infN})，点击手牌选择材料">[[icon:crystal]] 注能${infN}</button>`
      : '';
    const cnt = g.uids.length > 1 ? `<span class="bt-count" title="同名卡 ${g.uids.length} 张堆叠为一叠">×${g.uids.length}</span>` : '';
    // 诅咒之刃（2026-09-10 需求）：卡面规则阅读区显示手牌招式（武术+法术）提供的全部诅咒
    // 诅咒名称与层数作为文字补充，不在插画上叠放图标。
    const curseChip = (g.card.id === 'cc-cursed-blade' && typeof handCurseSpecs === 'function')
      ? (() => {
          const specs = handCurseSpecs();
          if (!specs.length) {
            ruleHint = [ruleHint, '当前手牌无可附加诅咒。'].filter(Boolean).join(' ');
            return '';
          }
          const items = specs.map(s => {
            const meta = Combat.CURSE_META[s.key] || { name: s.key, icon: '', stack: false, desc: '' };
            return `${meta.name}${meta.stack ? '×' + s.n : ''}`;
          }).join('、');
          ruleHint = [ruleHint, `当前附加：${items}。`].filter(Boolean).join(' ');
          return '';
        })()
      : '';
    const inner = SDT.Cards.cardHTML(g.card, 'sm', {
        ...(costDiff ? { costOverride: { v: effCost, base: baseCost } } : {}),
        ...(spellBonus > 0 && g.card.dmgType === 'spell' && +(g.card.dmg || 0) > 0
          ? { dmgOverride: { bonus: spellBonus } } : {}),
      })
      + cnt + infChip + curseChip;
    const handState = infusingNow ? 'infusing' : targeted || clickSelectedUid === uid ? 'selected' : blockedReason ? 'blocked' : 'ready';
    return { g, uid, side, cls, tip, inner, ruleHint, handState, blockedReason, pickedN, infusingNow };
  }
  // 挂载：把手牌常驻层接回刚重建的舞台（占位节点 → 常驻节点）。
  // 战斗实例令牌变了 = 上一场战斗已收尾/新战斗开打：清掉旧槽位再开新局。
  // （不能用 isConnected 判定——showOverlay 整块重建 ovBody，常驻层每次挂载前都脱离文档）
  function mountHandLayer(body, tip, token, onPlay) {
    const mount = body.querySelector('.sts-hud .sts-hand');
    if (!mount) return null;
    handPlay = onPlay || null;
    if (!handLayer) {
      handLayer = document.createElement('div');
      handHit = createHandHitController(handLayer, {
        getCards: () => handLayoutSlots.map(rec => rec.card), scale: uiScale,
        isAiming: () => !!aim,
        onPointerDown: (event, card) => { if (card.dataset.aim === '1') startAim(event, card); },
        onPlay: uid => handPlay?.({ uid }),
      });
    }
    handLayer.className = 'bt-hand sts-hand';
    if (token !== handBattleToken) {
      handHit.reset();
      handSlots.forEach(rec => rec.slot.remove());
      handSlots.clear();
      // 离场动画的槽已退Map但尚留DOM；新场次不可继承这些旧UID点击区。
      handLayer.replaceChildren();
      handLayoutSlots = []; handLayoutWidth = 0;
    }
    handBattleToken = token;
    // 2026-09-19 留言 #19/#7：不再挂原生 title（系统白底黑字提示框）——描述就在卡面上，
    // 黑框 tooltip（UI.showTooltip）也已全局停用
    // The normal stage diff already contains this persistent layer. Replacing
    // it with itself would detach its focused descendant before updateHand.
    if (mount !== handLayer) mount.replaceWith(handLayer);
    observeHandWidth();
    return handLayer;
  }
  // 差分更新：新建/保留/移除槽位 + 目标扇形位补间 + 新牌飞入。返回动画时长供飘字延迟取用。
  function updateHand(snapshot, prev, pageGroups, events, extra) {
    if (!handLayer) return { flightMs: 0 };
    const previousFocus = captureHandFocus();
    const previousUids = new Map([...handSlots.values()].filter(rec => rec.slot.isConnected)
      .map(rec => [rec.slot, new Set(rec.group.uids)]));
    const readable = pageGroups.length <= 6 ? 'true' : 'false';
    if (handLayer.dataset.readable !== readable) handLayer.dataset.readable = readable;
    const evs = events || [];
    const drawn = new Set(), played = new Set();
    evs.forEach(ev => { if (isHandArrivalEvent(ev)) drawn.add(ev.uid); else if (['play', 'dump', 'burn'].includes(ev.kind)) played.add(ev.uid); });
    const submitted = new Set(evs.filter(ev => ev.kind === 'play').map(ev => ev.uid));
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    const ctx = {
      infusingNow: !!snapshot.infusing, infusing: snapshot.infusing,
      pendingTarget: snapshot.pendingTarget, energy: snapshot.energy, busy: snapshot.busy, playedMovesThisTurn: snapshot.playedMovesThisTurn,
      spellBonus: (extra && extra.spellBonus) || 0,
      mode: extra && extra.mode,
    };
    // 旧槽位现矩形一次量完：目标值更新引发的位移以此为准做补间
    handSlots.forEach(rec => { rec.rect = rec.slot.isConnected ? uiRect(rec.slot) : null; });   // 布局口径
    // —— 第一遍：算状态 / 更新目标值与内容 / 建缺失槽位 ——
    const ordered = [];
    const handWidth = handLayer.clientWidth;
    pageGroups.forEach((g, i) => {
      const key = handSlotKey(g);
      const st = handGroupState(g, ctx);
      // Keep card identity and shortcut assignment; close visual gaps after a card leaves.
      const L = handDisplayLayout(i, pageGroups.length, handWidth);
      let rec = handSlots.get(key);
      if (!(rec && rec.slot.isConnected)) {
        rec = { slot: document.createElement('div'), card: document.createElement('div'), sig: '', rect: null, isNew: true };
        rec.slot.className = 'bt-slot';
        // 同槽抬牌负责悬停阅读，规则保留在卡面上。
        rec.card.addEventListener('mouseenter', () => UI.hideTooltip?.());
        rec.card.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return;
          if (e.defaultPrevented || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
          const face = rec.card.querySelector('.hs-card[role="button"]');
          // 阅读区与词条子控件保留自己的键盘行为，只有卡面本身负责选牌。
          if (!face || e.target !== face) return;
          e.preventDefault();
          if (e.shiftKey) return;
          if (getSnapshot().infusing) {
            const uid = infuseRotateUid(rec.group, getSnapshot().infusing);
            if (uid) commands.selectInfusion(uid);
          } else selectCardByClick(rec.card.dataset.uid, true, { autoSingleTarget: false });
        });
        rec.slot.appendChild(rec.card);
        handSlots.set(key, rec);
      }
      rec.group = g;   // 实时分组供 click / 键盘按当前快照逐张选材。
      setSlotVars(rec.slot, L);
      // 紧凑态恒挂；固定选区控制阅读类，键盘焦点保留 CSS 阅读态。
      setHandAttribute(rec.card, 'class', 'bt-card compact' + st.cls
        + (st.side === 'enemy' || st.side === 'self' ? ' need-target' : '')
        + (st.side === 'any' ? ' free-drop' : '')
        + (clickSelectedUid === st.uid ? ' click-selected' : ''));
      setHandAttribute(rec.slot, 'data-uid', st.uid);
      setHandAttribute(rec.slot, 'data-act', 'btPlay');
      setHandAttribute(rec.card, 'data-uid', st.uid);
      setHandAttribute(rec.card, 'data-hand-index', (g.displayIndex ?? i) + 1);
      setHandAttribute(rec.card, 'data-act', 'btPlay');
      setHandAttribute(rec.card, 'data-aim', st.side ? '1' : '');
      setHandAttribute(rec.card, 'data-side', st.side || '');
      setHandAttribute(rec.card, 'data-hand-state', st.handState);
      setHandAttribute(rec.card, 'data-block-reason', st.blockedReason || null);
      rec.__tip = st.tip;
      rec.__name = `${g.card.name} · ${effCostOf(g.card, st.uid)} 费`;
      setHandAttribute(rec.card, 'role', 'group');
      setHandAttribute(rec.card, 'tabindex', -1);
      setHandAttribute(rec.card, 'aria-label', `${rec.__name}。${st.ruleHint ? st.ruleHint + ' ' : ''}${st.tip || '按回车或空格使用'}`);
      // 操作提示由局面说明和可访问名称提供，原生 title 不再挂。
      setHandAttribute(rec.card, 'title', null);
      // 卡面外的角标（目标侧/费用变化/注能/诅咒）带 [[icon:]] 宏——写入时统一渲染，否则宏原文直接上屏
      // One reading hint: a current block takes priority over supplementary rules.
      const readingHint = st.blockedReason ? `无法打出：${st.blockedReason}` : st.ruleHint;
      if (rec.sig !== st.inner) {
        rec.card.innerHTML = SDT.Icons.rich(st.inner);
        rec.sig = st.inner;
        rec.hintSig = null;
      }
      // Busy/energy/target hints change independently of the rendered card face.
      // Keep the face and its controls connected when only the reading hint changes.
      const hintSig = `${st.ruleHint}\u0000${st.blockedReason}`;
      if (rec.hintSig !== hintSig) {
        const desc = rec.card.querySelector('.hsc-desc');
        desc?.querySelector('.bt-rulehint')?.remove();
        if (desc && readingHint && !desc.textContent.includes(st.blockedReason || readingHint)) {
          const hint = document.createElement('span');
          hint.className = 'bt-rulehint';
          hint.textContent = readingHint;
          if (st.blockedReason) desc.prepend(hint);
          else desc.appendChild(hint);
        }
        rec.hintSig = hintSig;
      }
      const face = rec.card.querySelector('.hs-card');
      if (face) {
        setHandAttribute(face, 'role', 'button'); setHandAttribute(face, 'tabindex', 0);
        setHandAttribute(face, 'aria-disabled', st.blockedReason ? 'true' : 'false');
        setHandAttribute(face, 'aria-label', `${rec.__name}。${st.ruleHint} ${st.tip}`);
        setHandAttribute(face, 'aria-pressed', st.infusingNow
          ? st.pickedN === g.uids.length ? 'true' : st.pickedN ? 'mixed' : 'false'
          : clickSelectedUid === st.uid ? 'true' : 'false');
      }
      ordered.push(rec);
    });
    handLayoutSlots = ordered;
    handHit?.sync(handBattleToken);
    handLayoutWidth = handWidth;
    // —— 顺序校正（DOM 序 = 扇形叠放序）：失序才搬节点 ——
    const current = [...handLayer.querySelectorAll('.bt-slot')];
    if (current.length !== ordered.length || current.some((el, i) => el !== ordered[i].slot)) {
      ordered.forEach(rec => handLayer.appendChild(rec.slot));
    }
    // —— 空手牌提示（原模板 N=0 分支的等价物） ——
    const emptyHint = handLayer.querySelector('.ov-empty');
    if (!ordered.length) {
      const msg = snapshot.hand.length ? '本栏已空；切换其他栏继续使用手牌。' : extra.mode === 'boss'
        ? ((snapshot.drawPile.length + snapshot.discard.length) ? '手牌打空了……下回合开始会再抽 1 张' : '牌库与弃牌堆都空了——只能结束回合硬抗，或撤退')
        : '没有能出的卡了……（打出过的卡本场不可再用）';
      const hint = emptyHint || handLayer.appendChild(Object.assign(document.createElement('p'), { className: 'ov-empty' }));
      if (hint.dataset.k !== msg) { hint.dataset.k = msg; hint.textContent = msg; }
    } else if (emptyHint) emptyHint.remove();
    // —— 第二遍：量新矩形，幸存者归位补间 + 新牌错峰飞入 ——
    const ov = UI.el.overlay;
    const ovR = uiRect(ov);   // 布局口径：飞入位移喂 transform
    let flightMs = 0;
    let drawIdx = 0;
    ordered.forEach(rec => {
      const r = uiRect(rec.slot);
      if (rec.isNew) {
        rec.isNew = false;
        if (drawn.has(rec.card.dataset.uid) && !evs.some(event => event.kind === 'draw' && event.acquired && event.uid === rec.card.dataset.uid)) {
          // 发现选卡飞入起点：由壳（battle.view.js）经 extra.discoverSrcRect 传入，
          // 消费后的置空也归壳（render 里调用 updateHand 后统一 discoverSrcRect = null）
          const src = (prev && prev.drawPile) || extra.discoverSrcRect
            || { left: ovR.width - 150, top: ovR.height - 110, width: 56, height: 80 };
          const dx = src.left + src.width / 2 - (r.left + r.width / 2);
          const dy = src.top + src.height / 2 - (r.top + r.height / 2);
          const delay = drawIdx++ * 300;
          if (!SDT.Motion?.reduceMotion?.()) animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.72)`, opacity: 0 },
            { transform: `translate(${dx * 0.18}px,${dy * 0.18}px) rotate(3deg) scale(1.04)`, opacity: 1, offset: 0.72 },
            { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
          ], { duration: 900, delay, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards', composite: 'add' });
          flightMs = Math.max(flightMs, 900 + (drawIdx - 1) * 300);   // drawIdx 已自增：末张 delay=(n-1)×300，旧式多算一档
        }
      } else if (rec.rect) {
        const dx = rec.rect.left + rec.rect.width / 2 - (r.left + r.width / 2);
        const dy = rec.rect.top + rec.rect.height / 2 - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) >= 2) {
          animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px)` },
            { transform: 'translate(0px,0px)' },
          ], { duration: 210, easing: 'cubic-bezier(.22,.9,.3,1)', composite: 'add' });
        }
      }
      rec.rect = r;
    });
    // —— 移除：本轮不在手牌里的槽位离场（打出/弃置交给克隆飞行，其余下沉淡出） ——
    const keptKeys = new Set(pageGroups.map(handSlotKey));
    handSlots.forEach((rec, key) => {
      if (keptKeys.has(key)) return;
      handSlots.delete(key);
      if (played.has(rec.card.dataset.uid) || !rec.slot.isConnected) { rec.slot.remove(); return; }
      animateSafe(rec.slot, [
        { transform: 'translate(0px,0px)', opacity: 1 },
        { transform: 'translateY(46px)', opacity: 0 },
      ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      schedulePresentationMs(() => rec.slot.remove(), 240);
    });
    // 手牌重建后立即补解码（img 是 lazy）：衍生牌等未走开局预热的卡面防首帧黑窗；
    // 已解码图 decode() 立即兑现，重复调用无副作用。
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(handLayer);
    // Pose ownership ends on the original play event even when play + draw
    // cancel the flight animation for a card that immediately returns to hand.
    syncSubmittedCardPoses(submitted);
    restoreHandFocus(previousFocus, ordered);
    updateHandAcquisitionFeedback(handLayer.closest('.battle-stage'), snapshot, ordered, previousUids, evs);
    return { flightMs };
  }

  // ---------- 单位区常驻层（架构批次B：玩家/随从/敌人节点不随整屏重渲染重建） ----------
  // 模式照抄手牌常驻层：ovBody 每次渲染整块重建，单位节点由本模块持有、showOverlay
  // 之后 replaceWith/appendChild 挂回新舞台。立绘、血条、意图、状态角标都是常驻节点
  // 内的局部差分更新（按序列化签名 diff，内容没变不重写 innerHTML，图片不重载），
  // 受击抖动/死亡演出（CSS fx-die）/血条宽度过渡因此只播一次、不被重渲染腰斩。
  let selfUnit = null, selfParts = null, selfSig = null;
  const allySlots = new Map();   // key -> { slot, parts, sig }
  const foeSlots = new Map();    // key -> { slot, parts, sig }

  function mountUnitLayer(body, token) {
    const selfMount = body.querySelector('[data-unit-mount="self"]');
    const alliesMount = body.querySelector('[data-unit-mount="allies"]');
    const foesMount = body.querySelector('[data-unit-mount="foes"]');
    if (!alliesMount || !foesMount) return null;
    // 09-24 起同场战斗走 showBattleStage 复用（ovBody 不重建），self 挂载点首轮已被
    // replaceWith(selfUnit) 消耗——selfUnit 仍在原位时直接复用，不能再因找不到挂载点
    // return null：那会把 updateUnits（敌我血条/意图/死亡演出 dead 类差分）整层冻结，
    // 实机表现即老板 09-25 报的「敌人死亡动画和贴图丢失」。
    const selfAnchor = selfMount
      || (selfUnit && selfUnit.isConnected && body.contains(selfUnit) ? selfUnit : null);
    if (!selfAnchor) return null;
    // 战斗实例令牌变了 = 上一场战斗已收尾：清掉旧槽位再开新局（口径同手牌层；
    // 不能用 isConnected 判定——ovBody 每次渲染整块重建，挂载前常驻节点必然脱离文档）
    if (selfUnit && token !== unitBattleToken) {
      allySlots.forEach(rec => rec.slot.remove());
      foeSlots.forEach(rec => rec.slot.remove());
      allySlots.clear(); foeSlots.clear();
      selfUnit = null; selfParts = null; selfSig = null;
    }
    unitBattleToken = token;
    if (!selfUnit) {
      selfUnit = document.createElement('div');
      selfUnit.className = 'sts-unit sts-me';
      selfUnit.id = 'btSelf';
      selfUnit.title = '你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出';
      selfUnit.addEventListener('click', (e) => {
        if (e.target.closest('.sts-equip, .sts-hand-tools')) return;
        const snap = getSnapshot();
        if (snap.pendingItem || snap.slamPending) return;
        clickSelectedTarget('self');
      });
      selfUnit.addEventListener('keydown', onTargetKeydown);
      selfParts = makeUnitSkeleton(selfUnit, { equips: true });
      selfSig = {};
    }
    if (selfAnchor !== selfUnit) selfAnchor.replaceWith(selfUnit);
    // A rebuilt HUD owns the fresh tools; the retained player may still carry the
    // previous stage's tools. Replace those rather than selecting them first.
    // Incremental renders have no HUD placeholder and keep the live tools intact.
    const careerTools = body.querySelector('.sts-hud > .sts-hand-tools');
    if (careerTools) {
      const previousTools = selfUnit.querySelector(':scope > .sts-hand-tools');
      if (previousTools) previousTools.replaceWith(careerTools);
      else selfUnit.appendChild(careerTools);
    }
    return { alliesMount, foesMount };
  }
  // 单位节点固定骨架：立绘 + 脚下生命条 + 上方属性/状态/装备/敌方意图，各段按签名差分。
  function makeUnitSkeleton(slot, opts = {}) {
    const parts = {};
    if (opts.intent) {
      parts.intent = document.createElement('div');
      parts.intent.className = 'sts-intent';
      parts.intent.style.display = 'none';
      parts.intent.tabIndex = 0;
      parts.intent.setAttribute('role', 'button');
      parts.intent.setAttribute('aria-expanded', 'false');
      parts.intent.addEventListener('click', event => {
        event.stopPropagation(); // 查看意图不触发单位身上的出牌确认
        parts.intent.setAttribute('aria-expanded', String(parts.intent.classList.toggle('is-open')));
      });
      parts.intent.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); event.stopPropagation();
        parts.intent.setAttribute('aria-expanded', String(parts.intent.classList.toggle('is-open')));
      });
    }
    parts.fig = document.createElement('div');
    parts.fig.className = 'sts-figure';
    slot.appendChild(parts.fig);
    const np = document.createElement('div');
    np.className = 'sts-nameplate';
    parts.head = document.createElement('div');
    parts.head.className = 'sts-headrow';
    parts.head.hidden = true;
    parts.head.style.display = 'none';
    parts.hp = document.createElement('div');
    parts.hp.className = 'bt-hpwrap sts-hp';
    parts.hpGhost = document.createElement('i');   // STS2 式幽灵条：掉血时延迟收缩的黄尾
    parts.hpGhost.className = 'sts-hp-ghost';
    parts.hpBar = document.createElement('i');
    parts.hpBar.className = 'sts-hp-main';
    parts.hpTxt = document.createElement('span');
    parts.armor = document.createElement('b');
    parts.armor.className = 'sts-hp-armor';
    parts.armor.hidden = true;
    parts.hp.appendChild(parts.hpGhost);
    parts.hp.appendChild(parts.hpBar);
    parts.hp.appendChild(parts.hpTxt);
    parts.hp.appendChild(parts.armor);
    parts.vitals = document.createElement('div');
    parts.vitals.className = 'sts-unit-vitals';
    parts.vitals.appendChild(parts.hp);
    slot.appendChild(parts.vitals);
    parts.stats = document.createElement('div');
    parts.stats.className = 'sts-stats';
    parts.chips = document.createElement('div');
    parts.chips.className = 'sts-chips';
    np.appendChild(parts.head); np.appendChild(parts.stats); np.appendChild(parts.chips);
    if (opts.equips) {
      parts.equips = document.createElement('div');
      parts.equips.className = 'sts-equips';
      parts.equips.style.display = 'none';
      np.appendChild(parts.equips);
    }
    // 姓名、属性、状态与意图仍同组；生命条独立放在立绘之后，由布局锚定脚下。
    // The intent retains its own input handlers and never confirms a target.
    if (parts.intent) np.appendChild(parts.intent);
    slot.appendChild(np);
    return parts;
  }
  // 差分工具：html 变了才重写 innerHTML
  function setSection(el, sig, key, html) {
    if (sig[key] === html) return;
    sig[key] = html;
    el.innerHTML = SDT.Icons.rich(html);
  }
  // 血条局部更新：主条快速过渡；幽灵条走自身延迟过渡形成掉血拖尾（STS2 NHealthBar 口径）。
  // 首次填充禁用两条的过渡，避免从空/满状态滑到位
  function setUnitHP(parts, sig, hp, maxHp, instant) {
    const pct = Math.max(0, hp / maxHp * 100).toFixed(1) + '%';
    const txt = Math.max(0, hp) + '/' + maxHp;
    if (sig.hpPct !== pct) {
      sig.hpPct = pct;
      if (instant) {
        for (const bar of [parts.hpBar, parts.hpGhost]) {
          bar.style.transition = 'none';
          bar.style.width = pct;
          void bar.offsetWidth;
          bar.style.transition = '';
        }
      } else {
        parts.hpBar.style.width = pct;
        parts.hpGhost.style.width = pct;
      }
    }
    if (sig.hpTxt !== txt) { sig.hpTxt = txt; parts.hpTxt.textContent = txt; }
  }
  function updateUnits(mounts, snapshot, ctx) {
    ctx = { ...ctx, devSample: !!snapshot.opts?.devSample, battleToken: snapshot.battleToken,
      turn: snapshot.turn || 1, playerStatus: snapshot.pstat?.status || null };
    updateSelfUnit(snapshot, ctx);
    updateAllies(mounts.alliesMount, snapshot.allies || []);
    updateFoes(mounts.foesMount, snapshot.foes || [], ctx);
  }
  function updateSelfUnit(snapshot, ctx) {
    const { player, pdef, pstat, equipped } = snapshot;
    const sig = selfSig;
    setSection(selfParts.fig, sig, 'fig',
      player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet'));
    const playerName = characterName(player.characterId || player.myClass);
    selfParts.fig.setAttribute('role', 'img');
    selfParts.fig.setAttribute('aria-label', playerName);
    setUnitHP(selfParts, sig, player.hp, player.maxHp, !sig.init);
    selfParts.armor.hidden = !(pdef.armor > 0);
    selfParts.armor.textContent = `甲 ${pdef.armor || 0}`;
    selfParts.armor.setAttribute('aria-label', `护甲 ${pdef.armor || 0}`);
    // 攻击力/法伤含加成显示（2026-09-09 留言 #2：人物图标下要能看到攻/法伤的变化）
    const atkBuff = pstat.status.atkUp || 0, spBuff = pstat.status.spellUp || 0;
    const atkShow = (player.atk || 0) + atkBuff;
    const atkTag = atkBuff ? `<span title="含攻击强化 +${atkBuff}">（含+${atkBuff}）</span>` : '';
    const spShow = (player.spellPower || 0) + spBuff;
    const spTag = spShow > 0
      ? `<span class="sts-stat">[[icon:crystal]] 法伤 ${spShow}${spBuff ? `<span title="含法术强化 +${spBuff}">（含+${spBuff}）</span>` : ''}</span>` : '';
    setSection(selfParts.stats, sig, 'stats',
      `<span class="sts-stat">[[icon:swords]] 攻 ${atkShow}${atkTag}</span>${spTag}${pdef.shield ? '<span class="sts-stat">[[icon:shield]] 盾 ' + pdef.shield + '</span>' : ''}${pdef.armor ? '<span class="sts-stat">[[icon:plate]] 甲 ' + pdef.armor + '</span>' : ''}${pdef.guard ? '<span class="sts-stat">格挡中</span>' : ''}`);
    setSection(selfParts.chips, sig, 'chips', curseChips(pstat.status));
    // 状态挂件（P2）：玩家自己被冰冻时同样点亮常驻状态光
    selfUnit.classList.toggle('fx-frozen', (pstat.status.freeze || 0) > 0);
    const pendingCard = ctx.pendingTarget && findCard(ctx.pendingTarget.uid);
    const clickCard = clickSelectedUid != null && findCard(clickSelectedUid);
    setTargetable(selfUnit, !!((pendingCard && targetSide(pendingCard.card) === 'self') || (clickCard && targetSide(clickCard.card) === 'self')), `${playerName}，自己，按 Enter 确认目标`);
    if (!selfUnit.classList.contains('can-target')) selfUnit.setAttribute('aria-label', `${playerName}，自己`);
    // 已穿戴装备（2026-09-09 老板 #9）：名称 + 说明 tooltip；带限定技能的可点击发动
    const equipsHTML = (equipped || []).map(e => e.skill
      ? `<button class="sts-equip has-skill${e.used ? ' used' : ''}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}" ${snapshot.busy || e.used ? 'disabled' : ''} aria-label="${escAttr(e.name)}主动技能：${escAttr(e.skill)}${e.used ? '，本场已使用' : ''}"
          title="${escAttr(`【${e.name}】${e.desc}${e.used ? '（主动技能本场已用过）' : '——点击发动主动技能'}`)}">[[icon:tools]] ${esc(e.name)}${e.used ? '' : ' [[icon:bolt]]'}</button>`
      : `<span class="sts-equip" title="${escAttr(`【${e.name}】${e.desc}`)}">[[icon:tools]] ${esc(e.name)}</span>`).join('');
    setSection(selfParts.equips, sig, 'equips', equipsHTML);
    selfParts.equips.style.display = equipsHTML ? '' : 'none';
    sig.init = true;
  }
  // 随从位（Q4 老板定向：征召步兵等——替你承伤、每回合自动攻击）
  function allyFigure(name) {
    if (SDT.game?.nestActive) return SDT.Icons.img('runner');
    const source = {
      '联邦巡防兵': 'assets/portraits/allies/federal-patrol-v1.webp',
      '联邦射手': 'assets/portraits/allies/federal-shooter-v1.webp',
      '封印肢体': 'assets/portraits/allies/sealed-limb-v1.webp',
    }[name];
    return typeof source === 'string'
      ? `<img class="ally-portrait" src="${assetUrl(source)}" alt="" draggable="false" decoding="async">`
      : SDT.Icons.img('runner');
  }

  function updateAllies(mount, allies) {
    mount.style.display = allies.length ? '' : 'none';
    const ordered = [];
    const seen = {};
    allies.forEach((a, i) => {
      const base = a.name || ('ally' + i);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = allySlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-ally';
        slot.title = '你的随从：优先替你承受伤害，每回合自动攻击敌人';
        rec = { slot, parts: makeUnitSkeleton(slot), sig: {}, key };
        allySlots.set(key, rec);
      }
      rec.slot.classList.toggle('dead', !!a.dead);
      rec.slot.dataset.allyI = i;
      setSection(rec.parts.fig, rec.sig, 'fig', allyFigure(a.name));
      rec.slot.setAttribute('aria-label', `${a.name}，你的随从`);
      rec.parts.fig.setAttribute('role', 'img');
      rec.parts.fig.setAttribute('aria-label', a.name);
      // 无攻血场面物件（封印肢体，同天国之门口径）：不显示血条与攻击力
      rec.parts.vitals.hidden = !!a.statless;
      rec.parts.stats.parentElement.hidden = !!a.statless;
      if (a.statless) {
        setSection(rec.parts.stats, rec.sig, 'stats', '');
      } else {
        setUnitHP(rec.parts, rec.sig, a.hp, a.maxHp, !rec.sig.init);
        setSection(rec.parts.stats, rec.sig, 'stats', `[[icon:swords]] 攻 ${a.atk}`);
      }
      setSection(rec.parts.chips, rec.sig, 'chips', '');
      rec.sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的随从 + 按数组序重排（appendChild 已连接节点只是搬移，不重建）
    const kept = new Set(ordered.map(r => r.key));
    allySlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); allySlots.delete(key); }
    });
    ordered.forEach(rec => mount.appendChild(rec.slot));
  }
  // 敌方单位（右下站立横排；意图气泡在头顶；词缀角标；免伤高亮）
  function updateFoes(mount, foes, ctx) {
    mount.style.setProperty('--battle-foe-count', String(Math.max(1, foes.length)));
    mount.dataset.count = String(foes.length);
    const ordered = [];
    const seen = {};
    foes.forEach((f, idx) => {
      const base = f.id || f.name || ('foe' + idx);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = foeSlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-foe bt-foe';
        rec = { slot, parts: makeUnitSkeleton(slot, { intent: true }), sig: {}, key };
        // 常驻节点只绑一次点击：砸击/药水点选（需求 #9 / 药水栏）——点击时读实时快照防闭包过期
        slot.addEventListener('click', () => {
          const snap = getSnapshot();
          if (snap.dartPending) {
            if (!slot.classList.contains('dead')) resolveDart(slot.dataset.eidx);
            return;
          }
          if (snap.slamPending) {
            if (!slot.classList.contains('dead')) resolveSlam(slot.dataset.eidx);
            return;
          }
          if (snap.pendingItem) {
            if (!slot.classList.contains('dead')) useItemCmd(snap.pendingItem.uid, slot.dataset.eidx);
            return;
          }
          if (!slot.classList.contains('dead')) clickSelectedTarget('enemy', +slot.dataset.eidx);
        });
        slot.addEventListener('keydown', onTargetKeydown);
        slot.addEventListener('mouseenter', () => {
          if (clickSelectedUid == null || slot.classList.contains('dead')) return;
          const entry = findCard(clickSelectedUid);
          if (entry && targetSide(entry.card) === 'enemy') showFoePreview(slot, +slot.dataset.eidx, clickSelectedUid, entry.card, 'click');
        });
        slot.addEventListener('mouseleave', () => { if (!slot.matches(':focus')) clearFoePreview(slot); });
        slot.addEventListener('focusin', () => {
          if (clickSelectedUid == null || slot.classList.contains('dead')) return;
          const entry = findCard(clickSelectedUid);
          if (entry && targetSide(entry.card) === 'enemy') showFoePreview(slot, +slot.dataset.eidx, clickSelectedUid, entry.card, 'click');
        });
        slot.addEventListener('focusout', () => { if (!slot.matches(':hover')) clearFoePreview(slot); });
        foeSlots.set(key, rec);
      }
      const slot = rec.slot, parts = rec.parts, sig = rec.sig;
      // Damage feedback stages hpBefore on this persistent node. An overlay can replace
      // ovBody before queued hpAfter feedback finds the foe again, leaving the detached
      // node stale while this signature still matches the authoritative snapshot.
      // Reconcile the whole HP presentation when that node is mounted again.
      const reattached = !slot.isConnected;
      if (reattached) { sig.hpPct = null; sig.hpTxt = null; }
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      slot.classList.toggle('is-boss', !!(ctx.isBoss || f.affix));
      slot.classList.toggle('dead', !!f.dead);
      slot.classList.toggle('bt-death-pending', !!f.deathFxPending);
      slot.classList.toggle('aegis', !!immune);
      const pendingCard = ctx.pendingTarget && findCard(ctx.pendingTarget.uid);
      const clickCard = clickSelectedUid != null && findCard(clickSelectedUid);
      const cardTargetsEnemy = !!((pendingCard && targetSide(pendingCard.card) === 'enemy') || (clickCard && targetSide(clickCard.card) === 'enemy'));
      // W5-06（2026-09-27 R2）：道具按目标侧过滤——自用道具不再高亮敌人（与 aim.js 同式）
      const itemTargetsEnemy = !!(ctx.pendingItem && ctx.pendingItem.card && targetSide(ctx.pendingItem.card) === 'enemy');
      setTargetable(slot, !!(cardTargetsEnemy || itemTargetsEnemy || ctx.slamPending || ctx.dartPending) && isTargetableEnemy(f, idx, ctx.pendingTarget?.excludedTargetIndex), `${f.name}，按 Enter 确认目标`);   // dartPending：血毒双镖二段点选也高亮（2026-09-17 留言）
      if (!slot.classList.contains('can-target')) slot.setAttribute('aria-label', `${f.name}${f.dead ? '，已倒下' : '，敌方单位'}`);
      slot.dataset.foeId = f.id || f.name;
      slot.dataset.eidx = idx;
      slot.style.setProperty('--foe-idle-phase', `${-(idx * 0.61)}s`);
      slot.title = aff ? aff.name + '：' + aff.desc : '';
      // 残留的指向预览气泡清掉（常驻节点上它不会随重建消失）
      const fp = slot.querySelector('.bt-fpreview');
      if (fp) fp.remove();
      if (!f.dead && clickCard && targetSide(clickCard.card) === 'enemy' && slot.matches(':hover, :focus')) {
        showFoePreview(slot, idx, clickSelectedUid, clickCard.card, 'click');
      }
      // 冰冻敌人显示专用意图图标（2026-09-09 玩法定版）：冰冻中无法行动，
      // 用冰晶图标替换原攻击/蓄力预告，解冻后恢复正常意图显示
      const frozen = !f.dead && f.status && (f.status.freeze || 0) > 0;
      // 状态挂件（P2）：诅咒持续期间的常驻视觉——冰冻青晶边光
      slot.classList.toggle('fx-frozen', frozen);
      const intents = frozen
        ? [{ icon: '[[icon:crystal]]', label: '冰冻·无法行动', damage: null, kind: 'frozen' }]
        // 意图伤害渲染时现算（U12-b/2026-09-29 夜班 F2）：foe.intent 仍是回合末快照
        // （快照序列化/读档/AI 顾问消费契约不动），角标按实时 foe.atk+玩家流血重算——
        // 玩家回合内挂 atkDown 后显示值与 playerTakeHit 实伤一致（STS2 RefreshIntents 的渲染层等价）。
        : intentViewModel(calculateEnemyIntent(f, ctx.turn || 1, ctx.playerStatus));
      // 常驻摘要保留实际动作与阶段条件，完整详情可悬停、聚焦或点击展开。
      // 基础攻击、流血来源和总伤放在同一份详情内，不挤占姓名行。
      if (!f.dead && intents.length) {
        const intentDetail = intents.map(intent => `${intent.label}${intent.damage == null ? '' : ` · ${intent.damage}${intent.hits > 1 ? ` ×${intent.hits}（共${intent.totalDamage}）` : ''}`}${intent.bleedBonus ? ` · 流血 ${intent.bleedBonus} 层` : ''}`).join('；') + (f.affix === 'aegis' ? '。元素庇幕：偶数回合减免所有伤害；对其施加破甲可克制。' : '');
        const baseAttack = `基础攻击 ${f.atk}${f.affix === 'frenzy' ? '×2' : ''}`;
        setSection(parts.intent, sig, 'intent',
          intents.map(intent => {
            // 摘要保留复合效果；流血加成来源与多段总伤仍在完整说明中。
            const [actionLabel, ...conditions] = intent.label.split(/[·并]/);
            const action = intent.kind === 'frozen' ? '冰冻中' : actionLabel;
            const condition = intent.kind === 'frozen' ? '' : conditions.join('·').replace(/^施加/, '');
            const actionText = `${action}${intent.damage == null ? '' : ` ${intent.damage}${intent.hits > 1 ? `×${intent.hits}` : ''}`}`;
            return `<span class="bt-intent-part" data-intent-kind="${escAttr(intent.kind)}">${intent.icon}<span class="bt-intent-short"><span class="bt-intent-action">${esc(actionText)}</span>${condition ? `<span class="bt-intent-condition"> · ${esc(condition)}</span>` : ''}</span></span>`;
          }).join('') +
          `<span class="bt-intent-detail"><span class="sts-atkbadge"${f.affix === 'frenzy' ? ' data-term="frenzy"' : ''}>[[icon:swords]] ${esc(baseAttack)}</span><span class="bt-intent-rules">${esc(intentDetail)}</span></span>`);
        parts.intent.setAttribute('aria-label', `${f.name}的意图：${intentDetail}。${baseAttack}。点击查看完整说明`);
        parts.intent.style.display = '';
        // W5-03（2026-09-27 R2，B-4）：一次性解释图例；QA/devSample 与玩家偏好隔离。
        try { showIntentLegend({ devSample: !!ctx.devSample, battleToken: ctx.battleToken }); }
        catch { /* 页面销毁等 DOM 异常时不影响战斗渲染 */ }
      } else parts.intent.style.display = 'none';
      setSection(parts.fig, sig, 'fig', f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime'));
      parts.fig.setAttribute('role', 'img');
      parts.fig.setAttribute('aria-label', f.name);
      // 姓名保留在可访问身份中；上方呈现攻击、意图和状态，生命条仍在脚下。
      setUnitHP(parts, sig, f.hp, f.maxHp, reattached || !sig.init);
      const simpleAttack = intents.length === 1 && intents[0].label === '攻击'
        && intents[0].damage === Math.max(0, f.atk || 0) && intents[0].hits === 1 && !intents[0].bleedBonus;
      const attackStat = simpleAttack ? '' : `<span class="sts-stat">[[icon:swords]] 攻 ${f.atk}${f.affix === 'frenzy' ? '×2' : ''}</span>`;
      setSection(parts.stats, sig, 'stats', `${attackStat}${immune ? '<span class="sts-stat">[[icon:crystal]] 庇幕免伤中</span>' : ''}`);
      setSection(parts.chips, sig, 'chips', (aff ? `<span class="bt-affix" data-term="${f.affix}">${aff.icon} ${aff.name}</span>` : '') + curseChips(f.status, { compact: true }));
      sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的敌人 + 按数组序重排（appendChild 已连接节点只是搬移，不重建）
    // 09-25：顺序没变的槽位不再重复 appendChild——同节点搬移会重置 CSS 动画，
    // 把 fx-die/foeDieVanish 死亡演出反复打回起点，尸体永远停在白闪前收不了尾。
    const kept = new Set(ordered.map(r => r.key));
    foeSlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); foeSlots.delete(key); }
    });
    ordered.forEach((rec, i) => {
      if (mount.children[i] !== rec.slot) mount.appendChild(rec.slot);
    });
  }

export { mountHandLayer, updateHand, mountUnitLayer, updateUnits, showIntentLegend, HAND_PAGE_SIZE, infusionStackUid };
