/* 指向施法：鼠标起拖，单体过线停靠、群体跟随；松空转点击确认，取消回手牌布局。
 * 点击选目标，展开手牌直接阅读；拖拽释放到合法目标直接提交。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { scale as uiScale, viewport as uiViewport } from '../../ui/ui-scale.js';
import { esc } from '../../core/shared.js';
import '../../../css/battle-hand-overhaul.css';
import { commands, getSnapshot, getBattleLiveness, findEffectiveCard as findCard, infuseOf, targetSide } from '../core/battle.core.js';
  const play = (uid, side, forceDirect) => submitCardWithFeedback(uid, side, forceDirect);
  const bagSlam = commands.bagSlam;             // 需求 #9：背包砸击
  const slamSkillOf = commands.slamSkill;       // 2026-10-02 老板：砸击换五职业分化技能（含牧师翻面态）
  const resolveSlam = commands.resolveSlam;
  const useItemCmd = commands.useItem;
  const cancelPendingTarget = commands.cancelPendingTarget;
  function flashCardPickup(el) {
    if (!el) return;
    el.classList.remove('card-pickup-flash');
    void el.offsetWidth;
    el.classList.add('card-pickup-flash');
  }
  function cardPlayBlockedReason(uid, side, forceDirect = false) {
    const availability = commands.getCardPlayAvailability(uid, side, forceDirect);
    return availability.status === 'rejected' ? availability.reason?.message || '当前无法打出这张牌' : '';
  }
  function showCardBlockReason(uid) {
    const snapshot = getSnapshot();
    const entry = findCard(uid);
    if (!snapshot || !entry) return false;
    const reason = cardPlayBlockedReason(uid);
    if (reason) showThoughtBubble(reason);
    return !!reason;
  }
  // 兼容旧调用名；战斗手牌不再打开独立详情层。
  function closeHandCardDetails() { return false; }
  function showHandCardDetails() { return false; }
import { showFoePreview, clearFoePreview, showThoughtBubble, clearThoughtBubble } from './battle.hover.js';
import { createTargetSession, isTargetableEnemy } from '../core/battle.target-session.js';
import { isAreaEffect } from '../effects/battle.target-rules.js';
import { BATTLE_PHASES } from '../runtime/battle.state.js';
  // ---------- 指向施法 ----------
  // 状态分支依据本地 NMouseCardPlay / NTargetManager；DOM 命中与 UI 缩放沿本项目接口。
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e', any: '#d9c07a' };
  const PICKUP_DISTANCE = 6; // 仅独立药水/职业技能沿用原点击容差；手牌按下即起拖。
  function playZoneY(grabY) {
    const line = uiViewport().height * 0.75;
    const scale = uiScale();
    return grabY > line ? Math.max(line, grabY - 100 * scale) : Math.min(line, grabY - 50 * scale);
  }
  function cancelZoneY() { return uiViewport().height * 0.95; }
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 拖动松手被处理的时间戳（抑制随后误触发的 click 锁定）
  let clickSelectedUid = null; // 点击选中的指向卡；拖拽路径仍由 aim 独立处理
  let clickTargetSession = null;
  const returningCards = new Map();
  const submittedCards = new Map();
  let motionFrame = 0, motionTime = 0, consumedPointerClick = null, consumedPointerPress = null;
  function finishCardReturn(el, record) {
    if (returningCards.get(el) !== record) return;
    returningCards.delete(el);
    el.style.transition = record.originalTransition;
    el.style.transform = record.originalTransform;
    el.inert = record.originalInert;
  }
  function suppressConsumedPointerClick(event) {
    const click = consumedPointerClick;
    if (!click || Date.now() > click.until) { consumedPointerClick = null; return; }
    if (event.detail === 0 || event.button !== 0 || Math.abs(event.clientX - click.x) > 3 || Math.abs(event.clientY - click.y) > 3
      || event.pointerId != null && event.pointerId !== click.pointerId) return;
    consumedPointerClick = null;
    event.preventDefault(); event.stopImmediatePropagation();
  }
  function clearConsumedPointerGesture() {
    consumedPointerPress = null; consumedPointerClick = null;
  }
  function finishConsumedPointerPress(event) {
    const press = consumedPointerPress;
    if (!press || event.pointerId !== press.pointerId) return;
    consumedPointerPress = null;
    consumePointerClick(press, event);
  }
  function cancelConsumedPointerPress(event) {
    if (consumedPointerPress?.pointerId === event.pointerId) clearConsumedPointerGesture();
  }
  window.addEventListener('click', suppressConsumedPointerClick, true);
  // 这些模块级监听跨过按下即提交后的换页，直到同一 pointer 真正松开。
  window.addEventListener('pointerdown', clearConsumedPointerGesture, true);
  window.addEventListener('pointerup', finishConsumedPointerPress, true);
  window.addEventListener('pointercancel', cancelConsumedPointerPress, true);
  window.addEventListener('blur', clearConsumedPointerGesture);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelAim();
    submittedCards.forEach(ticket => releaseSubmittedCard(ticket));
    clearConsumedPointerGesture();
    if (motionFrame) cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    returningCards.forEach((record, el) => finishCardReturn(el, record));
    window.removeEventListener('click', suppressConsumedPointerClick, true);
    window.removeEventListener('pointerdown', clearConsumedPointerGesture, true);
    window.removeEventListener('pointerup', finishConsumedPointerPress, true);
    window.removeEventListener('pointercancel', cancelConsumedPointerPress, true);
    window.removeEventListener('blur', clearConsumedPointerGesture);
  });
  function targetSessionBattleCurrent(token) {
    // 视图层不直读战斗运行时（架构守卫）：经 core 轻查询判定场次与阶段。
    // F1（09-30 性能审计）：此判定在拖拽期每帧经 hitAt/setHover 触发 2+ 次，原先每次
    // 都全量组装快照+深签名，而存活只依赖 token/phase 两个标量——改走 getBattleLiveness，
    // 语义与快照口径逐字等价（同源 battleState.token/phase）。
    const live = getBattleLiveness();
    return !!live && live.battleToken === token
      && (live.phase === BATTLE_PHASES.PLAYER || live.phase === BATTLE_PHASES.TARGETING);
  }

  function aimCanvasEnsure() {
    let canvas = document.getElementById('aimArrow');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'aimArrow';
      UI.el.overlay.appendChild(canvas);
    }
    return canvas;
  }
  function aimArrowRemove() {
    const s = document.getElementById('aimArrow');
    if (s) s.remove();
    aimArrowCache = null;
  }
  // 箭头重绘缓存（F9）：坐标/颜色/画布尺寸全等时跳过 clear+全量重绘（拖拽停顿帧不再空转）
  let aimArrowCache = null;
  // 更新弯曲箭头：Canvas 绘制二次贝塞尔上弓与箭头，避免矢量 DOM 资源。
  // vr 可传入调用方缓存的 overlay rect（拖拽高频路径避免每次 pointermove 强制读布局）
  function aimArrowUpdate(x1, y1, x2, y2, color, vr) {
    const canvas = aimCanvasEnsure();
    vr = vr || UI.el.overlay.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const zA = uiScale();
    // CSS retains logical layout size; backing pixels follow the displayed rect.
    // Arrow coordinates already use viewport pixels, so drawing needs only DPR.
    const width = Math.max(1, Math.round(vr.width / zA));
    const height = Math.max(1, Math.round(vr.height / zA));
    const pixelWidth = Math.max(1, Math.round(vr.width * ratio));
    const pixelHeight = Math.max(1, Math.round(vr.height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    if (canvas.style.width !== `${width}px`) canvas.style.width = `${width}px`;
    if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`;
    const cacheKey = `${x1}|${y1}|${x2}|${y2}|${color}|${canvas.width}x${canvas.height}|${ratio}`;
    if (aimArrowCache === cacheKey) return;
    aimArrowCache = cacheKey;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    let px = -dy / len, py = dx / len;
    if (py > 0) { px = -px; py = -py; }               // 弓背朝上
    const bow = Math.min(90, len * 0.3);
    const cx = mx + px * bow, cy = my + py * bow;
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl, wx = -uy, wy = ux;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = .2;
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    ctx.globalAlpha = .95;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2 - ux * 9, y2 - uy * 9); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#080b0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * 17 + wx * 8, y2 - uy * 17 + wy * 8);
    ctx.lineTo(x2 - ux * 17 - wx * 8, y2 - uy * 17 - wy * 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 指针处的有效目标（enemy 卡找活着的敌人 / self 卡找自己的立绘）
  // side 显式传入：endAim 时全局 aim 已清空，不能再依赖它
  // 指向期间沿用当前快照；若战场重绘，resumeAimAfterRender 会换成新快照。
  function aimHoverAt(x, y, session) {
    const hit = session?.hitAt(x, y) || null;
    if (hit?.kind === 'any' && document.elementFromPoint(x, y)?.closest('.sts-hand, .bt-slot, .bt-card, .sts-hand-tools, .battle-skill-help, [data-act], [data-ui-tip]')) return null;
    return hit;
  }
  function makeAimTargetSession(a) {
    return createTargetSession({
      side: a.fieldPlayable ? 'any' : a.side, snapshot: a.snap,
      isBattleCurrent: () => targetSessionBattleCurrent(a.snap.battleToken),
      getTargets: () => getSnapshot().foes,
      onHover(next, previous) {
        if (previous) {
          previous.el.classList.remove('drag-over', 'drop-here', 'drop-any');
          if (previous.kind === 'enemy') clearFoePreview(previous.el);
          if (a.fieldPlayable && a.side === 'enemy') a.stage.querySelectorAll('.bt-foe').forEach(clearFoePreview);
        }
        a.hover = next;
        if (!next) return;
        if (next.kind === 'enemy') {
          next.el.classList.add('drag-over');
          showFoePreview(next.el, next.idx, a.uid, a.card, a.mode === 'clickTarget' ? 'click' : 'drag');
        } else {
          next.el.classList.add('drop-here');
          // 全体牌保持跟手；合法空地预览每名敌人，不提前提交或消耗注能材料。
          if (a.fieldPlayable && a.side === 'enemy') {
            a.stage.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
              const idx = +el.dataset.eidx;
              if (!getSnapshot().foes[idx]?.dead) showFoePreview(el, idx, a.uid, a.card, 'drag');
            });
          }
        }
      },
    });
  }
  function handUid(entry) { return entry && typeof entry === 'object' ? entry.uid : entry; }
  function aimBaseRect(el) {
    // 槽位是布局原点；读取它不会临时撤掉正在拖动的卡牌变换。
    const rect = (el.parentElement || el).getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
  function aimSlotLayout(el) {
    const style = el.parentElement?.style;
    return style ? ['--fx', '--fy', '--frot', '--fs'].map(key => style.getPropertyValue(key)).join('|') : '';
  }
  // 只有拖着同一张、同一手牌位置的卡，才允许跨整屏重绘保留指针交互。
  // 手牌结构或战斗阶段改变时正常取消，避免把旧目标/旧费用带到新状态。
  function canPreserveAim(snapshot) {
    const a = aim;
    if (!a || !a.follow || !a.el.isConnected || a.el.dataset.uid !== a.uid || !a.stage?.isConnected || !snapshot) return false;
    if (snapshot.battleToken !== a.snap.battleToken || snapshot.busy || snapshot.phase !== BATTLE_PHASES.PLAYER
      || snapshot.infusing || snapshot.discovering || snapshot.choosing || snapshot.handSelecting
      || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending
      || snapshot.viewingGrave || snapshot.viewingDeck || snapshot.viewingBag || snapshot.deckSelection
      || snapshot.pendingTarget?.uid !== a.snap.pendingTarget?.uid) return false;
    const oldHand = a.snap.hand || [], newHand = snapshot.hand || [];
    if (oldHand.length !== newHand.length || oldHand.some((entry, i) => handUid(entry) !== handUid(newHand[i]))) return false;
    const entry = findCard(a.uid);
    return !!entry && (targetSide(entry.card) || 'any') === a.side;
  }
  function resumeAimAfterRender(snapshot) {
    const a = aim;
    if (!a) return;
    if (!a.el.isConnected || !a.stage?.isConnected || !a.targetSession?.isCurrent()) { cancelAim(); return; }
    const stage = UI.el.ovBody?.querySelector('.battle-stage');
    const entry = findCard(a.uid);
    if (!stage || !a.el.isConnected || !stage.contains(a.el) || a.el.dataset.uid !== a.uid || !entry) { cancelAim(); return; }
    if (a.moved) a.el.classList.add('aim-lift'); // updateHand 会重写 className
    const baseRect = aimBaseRect(a.el);
    if (a.slotLayout !== aimSlotLayout(a.el)
      || (a.baseRect && ['left', 'top', 'width', 'height'].some(key => Math.abs(baseRect[key] - a.baseRect[key]) > 6))) {
      cancelAim(); // 手牌槽位或尺寸变化时，旧的跟手原点不再可靠
      return;
    }
    a.baseRect = baseRect;
    a.targetSession?.cancel();
    a.hover = null;
    a.snap = snapshot;
    a.card = entry.card;
    a.fieldPlayable = a.follow && (a.side === 'self' || isAreaEffect(entry.card));
    a.stage = stage;
    a.vr = UI.el.overlay.getBoundingClientRect();
    a.playBlockedReason = cardPlayBlockedReason(a.uid, a.side === 'self' ? 'self' : undefined, a.side !== 'any');
    if (a.reasonShown) {
      if (a.playBlockedReason) showThoughtBubble(a.playBlockedReason, true);
      else { clearThoughtBubble(); a.reasonShown = false; }
    }
    a.targetSession = makeAimTargetSession(a);
    if (a.leftDown && a.captureHost?.setPointerCapture && !a.captureHost.hasPointerCapture?.(a.pointerId)) {
      try { a.captureHost.setPointerCapture(a.pointerId); } catch { /* 已松手则由 window pointerup 清理 */ }
    }
    ensureMotionFrame();
  }
  function aimCleanup(a, keepPose = false) {
    if (a) {
      if (!keepPose) a.el.classList.remove('aim-lift');
      if (a.hover) {
        a.hover.el.classList.remove('drag-over', 'drop-here', 'drop-any');
        if (a.hover.kind === 'enemy') clearFoePreview(a.hover.el);
      }
      a.targetSession?.cancel();
    }
    aimArrowRemove();
  }
  function cancelClickSelection() {
    clickTargetSession?.cancel();
    clickTargetSession = null;
    if (clickSelectedUid == null) return false;
    clickSelectedUid = null;
    document.querySelectorAll('.sts-hand .bt-card.click-selected').forEach(el => {
      el.classList.remove('click-selected');
      el.querySelector('.hs-card')?.setAttribute('aria-pressed', 'false');
      el.dataset.handState = el.dataset.blockReason ? 'blocked' : 'ready';
    });
    updateClickSelectionUI();
    syncClickTargetPreviews();
    return true;
  }
  function setTargetable(el, enabled, label) {
    if (!el) return;
    el.classList.toggle('can-target', enabled);
    if (enabled) {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', label);
    } else {
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-label');
    }
  }
  function syncClickTargetPreviews() {
    const snapshot = getSnapshot();
    if (clickSelectedUid != null && !clickTargetSession?.isCurrent()) {
      clickTargetSession?.cancel();
      clickTargetSession = null;
      clickSelectedUid = null;
      document.querySelectorAll('.sts-hand .bt-card.click-selected').forEach(el => {
        el.classList.remove('click-selected');
        el.querySelector('.hs-card')?.setAttribute('aria-pressed', 'false');
        el.dataset.handState = el.dataset.blockReason ? 'blocked' : 'ready';
      });
      updateClickSelectionUI();
    }
    const entry = clickSelectedUid == null ? null : findCard(clickSelectedUid);
    const selectedSide = entry && targetSide(entry.card);
    const pendingEntry = snapshot.pendingTarget && findCard(snapshot.pendingTarget.uid);
    const pendingSide = pendingEntry && targetSide(pendingEntry.card);
    // W5-06（2026-09-27 R2）：道具按目标侧过滤——自用道具（回复类，targetSide!=='enemy'）
    // 不再让全体敌人可点（高亮=攻击性误导，评审读码+W3 复核）；slam/dart 语义正确保留。
    const pendingItemSide = snapshot.pendingItem && snapshot.pendingItem.card ? targetSide(snapshot.pendingItem.card) : null;
    setTargetable(document.getElementById('btSelf'), selectedSide === 'self' || pendingSide === 'self' || pendingItemSide === 'self', '自己，按 Enter 确认目标');
    document.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
      clearFoePreview(el);
      const idx = +el.dataset.eidx;
      const foe = snapshot.foes[idx];
      const targetable = !!(isTargetableEnemy(foe, idx, snapshot.pendingTarget?.excludedTargetIndex) && (selectedSide === 'enemy' || pendingSide === 'enemy' || pendingItemSide === 'enemy' || snapshot.slamPending || snapshot.dartPending));
      setTargetable(el, targetable, `${foe?.name || '敌人'}，按 Enter 确认目标`);
      if (targetable && selectedSide === 'enemy' && el.matches(':hover, :focus')) {
        showFoePreview(el, idx, clickSelectedUid, entry.card, 'click');
      }
    });
  }
  function updateClickSelectionUI() {
    return false; // 选中状态由卡牌与目标高亮表达，不再写顶部操作提示。
  }
  function selectCardByClick(uid, focusTarget = false, { autoSingleTarget = true } = {}) {
    // 键盘/显式点击兼容入口独立于鼠标拖牌会话，不能让两套目标同时存活。
    if (aim) cancelAim();
    const snap = getSnapshot();
    if (clickSelectedUid != null && !clickTargetSession?.isCurrent()) cancelClickSelection();
    if (!snap || snap.busy || snap.infusing || snap.discovering || snap.choosing) return;
    const entry = findCard(uid);
    if (!entry) return;
    if (showCardBlockReason(uid)) { play(uid); return; }
    // 09-20 老板定版：注能卡点卡先进注能态（注能条内可改「不注能直接打出」）——
    // 唯一敌人免选直打捷径对注能卡不适用，必须在选择锁定之前分流
    if (infuseOf(entry.card) > 0) { play(uid); return; }
    const side = targetSide(entry.card);
    if (!side) { play(uid); return; }
    // STS2 TryWebClickPlay：指向敌人的卡在唯一敌人时免选目标，直接打出
    //（尸体占位不算活敌——目标下标取 aliveIdx 而非字面量 0）
    if (side === 'enemy' && autoSingleTarget) {
      const aliveIdx = snap.foes.findIndex(f => !f.dead);
      if (aliveIdx >= 0 && snap.foes.filter(f => !f.dead).length === 1) { play(uid, aliveIdx); return; }
    }
    if (clickSelectedUid === uid) {
      cancelClickSelection();
      if (snap.pendingTarget?.uid === uid) cancelPendingTarget();
      return;
    }
    clickTargetSession?.cancel();
    if ((snap.pendingTarget && snap.pendingTarget.uid !== uid) || snap.pendingItem || snap.slamPending || snap.dartPending) {
      cancelPendingTarget();
    }
    clickSelectedUid = uid;
    clickTargetSession = createTargetSession({
      side, snapshot: snap,
      isBattleCurrent: () => targetSessionBattleCurrent(snap.battleToken),
      getTargets: () => getSnapshot().foes,
    });
    document.querySelectorAll('.sts-hand .bt-card.click-selected').forEach(el => {
      el.classList.remove('click-selected');
      el.querySelector('.hs-card')?.setAttribute('aria-pressed', 'false');
      el.dataset.handState = el.dataset.blockReason ? 'blocked' : 'ready';
    });
    const el = [...document.querySelectorAll('.sts-hand .bt-card')].find(x => x.dataset.uid === uid);
    if (el) {
      el.classList.add('click-selected');
      el.querySelector('.hs-card')?.setAttribute('aria-pressed', 'true');
      el.dataset.handState = 'selected';
      if (focusTarget) flashCardPickup(el);
    }
    // 指针拿起时 startAim 已播放一次；键盘选牌没有 pointerdown，在此补上反馈。
    if (focusTarget) SDT.Sound.sfx('cardSelect');
    updateClickSelectionUI();
    syncClickTargetPreviews();
    if (focusTarget) document.querySelector(side === 'self' ? '#btSelf.can-target' : '.bt-foe.can-target')?.focus();
  }
  function clickSelectedTarget(side, idx) {
    const snapshot = getSnapshot();
    const pending = snapshot.pendingTarget;
    if (clickSelectedUid == null && !pending) return false;
    const uid = pending?.uid ?? clickSelectedUid;
    const entry = findCard(uid);
    if (!entry) { cancelClickSelection(); return false; }
    const need = targetSide(entry.card);
    if (need !== side && !(need == null && side === 'any')) {
      UI.log(`[[icon:cross]] 【${esc(entry.card.name)}】不能对这个目标使用`, 'warn');
      showThoughtBubble(`【${entry.card.name}】不能对这个目标使用`);
      // W3-03（2026-09-27 R2）：误指反馈贴操作点——气泡挂在 #btSelf（英雄侧），
      // 被点的敌人本身零反馈，紧张局里玩家感知不到「点错了哪里」（评审死亡局实录×4）。
      // 呈现层追加：被点敌人红框+抖动一次；拒绝逻辑/log/气泡原样不动。
      const foeEl = document.querySelector(`.bt-foe[data-eidx="${idx}"]`);
      if (foeEl) {
        if (foeEl._misTimer) clearTimeout(foeEl._misTimer);   // 旧 timer 先清：650ms 内重抖不被上一轮腰斩
        foeEl.classList.remove('mis-target');
        void foeEl.offsetWidth;
        foeEl.classList.add('mis-target');
        foeEl._misTimer = setTimeout(() => { foeEl.classList.remove('mis-target'); foeEl._misTimer = 0; }, 650);
      }
      return true;
    }
    if (!clickTargetSession && pending) {
      clickTargetSession = createTargetSession({
        side: need || side, snapshot,
        isBattleCurrent: () => targetSessionBattleCurrent(snapshot.battleToken),
        getTargets: () => getSnapshot().foes,
      });
    }
    if (!clickTargetSession?.isCurrent() || !clickTargetSession.selectDirect(side, idx)) {
      cancelClickSelection();
      return false;
    }
    clickTargetSession = null;
    clickSelectedUid = null;
    play(uid, side === 'enemy' ? idx : side === 'self' ? 'self' : undefined);
    return true;
  }
  // 数字键选牌 / Esc 取消已随 handLayer 依赖迁往 battle.layers.js（2026-09-22 批5 解 aim↔layers 环）

  function startAim(e, el, kind) {
    if (e.button !== 0 || e.isPrimary === false || e.isComposing) return;
    if (document.querySelector('#overlay .bt-hand-detail')) return;
    const snap = getSnapshot();
    const { busy, infusing, discovering, choosing } = snap;
    syncSubmittedCardPoses();
    if (busy || infusing || discovering || choosing || aim || submittedCards.has(el.dataset.uid)) return;
    const uid = el.dataset.uid;
    // 09-20 老板：砸击改拖动释放——按钮无卡牌 uid，喂伪卡复用
    // 药水式非跟手指向（红箭头 + 敌人高亮 + 伤害预览）；能量门槛由按钮 disabled 承担
    // 2026-10-02 老板：伪卡按当前职业技能取文案与数值（战士猛击预览=攻击力）；
    // 无目标技能（法师搜刮/牧师圣疗）不支持拖拽——点击立即生效
    const isSlam = kind === 'slam';
    const skill = isSlam ? slamSkillOf() : null;
    if (isSlam && !skill.needsTarget) return;
    const entry = isSlam ? { card: { name: skill.name, desc: skill.aimDesc,
      dmg: skill.kind === 'attack' ? (snap.player?.atk || 0) : (skill.dmg || 0) } } : findCard(uid);
    if (!entry) return;
    cancelClickSelection();
    const side = (kind === 'potion' || isSlam) ? 'enemy' : (targetSide(entry.card) || 'any');   // null = 无目标招式：拖到中间空地即可
    // Aimed enemy/self plays skip optional infusion; an untargeted pickup keeps
    // the original infusion entry. Match that intent in the read-only query.
    const playBlockedReason = !isSlam && kind !== 'potion'
      ? cardPlayBlockedReason(uid, side === 'self' ? 'self' : undefined, side !== 'any') : '';
    const isCard = kind !== 'potion' && !isSlam;
    const vr = UI.el.overlay.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const returning = isCard && returningCards.get(el);
    const originalTransform = returning ? returning.originalTransform : el.style.transform;
    const originalTransition = returning ? returning.originalTransition : el.style.transition;
    if (returning) returningCards.delete(el);
    aim = {
      uid, card: entry.card, side, el, kind: kind || 'card',
      fieldPlayable: isCard && (side === 'self' || isAreaEffect(entry.card)),
      pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY,
      playBlockedReason, reasonShown: false,
      ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
      sx:e.clientX, sy:e.clientY, moved:isCard, hover:null, leftDown:true,
      snap, vr,   // pointermove 复用；战场重绘后会更新为新快照和 rect
      // 指向卡过出牌线进 target；无目标卡过线进 multi。
      follow: isCard, mode: 'drag',
      restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
      stage: el.closest('.battle-stage'),
      playY: isCard ? playZoneY(e.clientY) : -1,
      hasLeftCancel: false, hasEnteredPlay: false,
      originalTransform, originalTransition, originalInert:returning ? returning.originalInert : el.inert,
      targetMode:'release', motion:{ x:r.left + r.width / 2, y:r.top + r.height / 2, scale:1 },
      reducedMotion: !!SDT.Motion?.reduceMotion?.(),
    };
    aim.targetSession = makeAimTargetSession(aim);
    if (isCard) {
      aim.baseRect = aimBaseRect(el);
      aim.slotLayout = aimSlotLayout(el);
      el.style.transition = 'none';
      el.inert = true;
      el.classList.add('aim-lift');
      paintCardPose(aim);
      SDT.Sound.sfx('cardSelect');
    }
    // 手牌节点随 ovBody 重绘短暂脱离文档；捕获放在常驻 overlay 上，拖动才不会被打断。
    aim.captureHost = isCard ? UI.el.overlay : el;
    if (aim.captureHost?.setPointerCapture) {
      try { aim.captureHost.setPointerCapture(e.pointerId); } catch { /* window 监听仍能完成交互 */ }
    }
    window.addEventListener('pointermove', moveAim, true);
    window.addEventListener('pointerup', endAim, true);
    window.addEventListener('pointercancel', onAimPointerCancel, true);
    window.addEventListener('pointerdown', onAimPointerDown, true);
    document.addEventListener('contextmenu', aimCtxSuppress, true);
    window.addEventListener('blur', cancelAim);
    window.addEventListener('resize', cancelAim);
    document.addEventListener('visibilitychange', onAimVisibilityChange);
    document.addEventListener('compositionstart', cancelAim, true);
    document.addEventListener('keydown', onAimKeydown, true);
    aim.captureHost?.addEventListener('lostpointercapture', onAimLostCapture);
    ensureMotionFrame();
  }
  // 左键只更新状态；指向卡等松手确认，已松键进入的群体模式在下一次按下确认。
  function onAimPointerDown(e) {
    const a = aim;
    if (!a || e.isPrimary === false) return;
    if (e.button === 2) { e.preventDefault(); cancelAim(); return; }
    if (e.button !== 0) return;
    // Mouse, pen and touch may each be primary. A held gesture keeps its owner;
    // after release, a fresh pointer may still confirm the existing pickup.
    if (a.leftDown && e.pointerId !== a.pointerId) return;
    a.pointerId = e.pointerId; a.lastX = e.clientX; a.lastY = e.clientY; a.leftDown = true;
    if (a.follow && a.mode === 'multi' && a.targetMode === 'click') {
      aimPlayedAt = Date.now();
      consumedPointerPress = { pointerId:a.pointerId };
      completeCardTarget(a, e);
    }
  }
  function aimCtxSuppress(e) { if (aim) e.preventDefault(); }
  function cardLayoutBase(el) {
    const rect = (el.parentElement || el).getBoundingClientRect();
    const scale = uiScale();
    const width = el.offsetWidth || rect.width / scale || 260;
    const height = el.offsetHeight || 390;
    return { x:rect.left + ((el.offsetLeft || 0) + width / 2) * scale,
      y:rect.top + ((el.offsetTop || 0) + height / 2) * scale, width, height, scale };
  }
  function paintCardPose(a, base = cardLayoutBase(a.el)) {
    const pose = a.motion;
    const x = (pose.x - base.x) / base.scale;
    // CSS 以卡底为缩放原点；把 holder 中心坐标转换为同一布局坐标。
    const y = (pose.y - base.y) / base.scale + (pose.scale - 1) * base.height / 2;
    a.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${pose.scale.toFixed(4)})`;
  }
  function advanceCardPose(a, target, delta, base = cardLayoutBase(a.el)) {
    const alpha = Math.min(1, delta * 7), scaleAlpha = Math.min(1, delta * 8);
    a.motion.x += (target.x - a.motion.x) * alpha;
    a.motion.y += (target.y - a.motion.y) * alpha;
    a.motion.scale += (target.scale - a.motion.scale) * scaleAlpha;
    const scale = uiScale();
    const atPosition = ((target.x - a.motion.x) ** 2 + (target.y - a.motion.y) ** 2) / (scale * scale) < 1;
    const atScale = Math.abs(target.scale - a.motion.scale) < .002;
    if (atPosition) { a.motion.x = target.x; a.motion.y = target.y; }
    if (atScale) a.motion.scale = target.scale;
    paintCardPose(a, base);
    return atPosition && atScale;
  }
  function targetCardPose(a, base) {
    if (a.mode !== 'target' && a.mode !== 'clickTarget') return { x:a.lastX, y:a.lastY, scale:1 };
    const height = base.height * base.scale;
    return { x:a.vr.left + a.vr.width / 2, y:a.vr.top + a.vr.height - height * .75 / 2, scale:.75 };
  }
  function ensureMotionFrame() {
    if (!motionFrame) motionFrame = requestAnimationFrame(stepMotionFrame);
  }
  function stepMotionFrame(now) {
    motionFrame = 0;
    const delta = motionTime ? Math.max(0, (now - motionTime) / 1000) : 1 / 60;
    motionTime = now;
    if (aim) aimPointerFrame(delta);
    returningCards.forEach((record, el) => {
      if (!el.isConnected || UI.el.overlay.hidden || !record.stage?.isConnected) { finishCardReturn(el, record); return; }
      const base = cardLayoutBase(el), target = {
        x:base.x + record.rest.x * base.scale, y:base.y + record.rest.y * base.scale, scale:record.rest.scale,
      };
      if (advanceCardPose(record, target, delta, base)) finishCardReturn(el, record);
    });
    if (aim || returningCards.size) ensureMotionFrame();
    else motionTime = 0;
  }
  // 指针事件只采样；同一条显示帧时钟推进起拖、停靠及回手牌动画。
  function moveAim(e) {
    if (!aim || e.pointerId !== aim.pointerId) return;
    aim.lastX = e.clientX;
    aim.lastY = e.clientY;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < PICKUP_DISTANCE) return;
    if (!aim.moved) {
      aim.moved = true;
      aim.el.classList.add('aim-lift');
    }
    ensureMotionFrame();
  }
  function aimPointerFrame(delta = 0) {
    const a = aim;
    if (!a) return;
    if (!a.el.isConnected || !a.stage?.isConnected || !a.targetSession?.isCurrent()) { cancelAim(); return; }
    if (!a.follow && !a.moved) return;
    const eX = a.lastX, eY = a.lastY;
    const vr = a.vr;   // 重绘后由 resumeAimAfterRender 更新；帧内复用以免频繁读布局
    const base = a.follow ? cardLayoutBase(a.el) : null;
    if (a.follow) {
      if (a.mode === 'drag' && eY < a.playY) {
        if (a.playBlockedReason) { const reason = a.playBlockedReason; cancelAim(); showThoughtBubble(reason); return; }
        a.mode = a.fieldPlayable ? 'multi' : a.side === 'enemy' || a.side === 'self' ? 'target' : 'multi';
        a.hasEnteredPlay = true;
        a.targetMode = a.leftDown ? 'release' : 'click';
        if (a.targetMode === 'click' && a.mode === 'target') a.mode = 'clickTarget';
      }
      if (a.hasEnteredPlay && eY <= cancelZoneY()) a.hasLeftCancel = true;
      if (a.hasEnteredPlay && a.hasLeftCancel && eY > cancelZoneY()) { cancelAim(); return; }
      if (a.mode === 'multi') a.stage.classList.toggle('drop-any', eY < a.playY);
      advanceCardPose(a, targetCardPose(a, base), delta, base);
    }

    // 悬停检测：瞄准态（含药水全程）高亮目标；drag 态 STS2 无悬停反馈
    const targeting = !a.follow || a.mode === 'target' || a.mode === 'clickTarget'
      || a.mode === 'multi' && a.fieldPlayable && a.side === 'enemy' && eY < a.playY;
    const hit = targeting ? aimHoverAt(eX, eY, a.targetSession) : null;
    if (a.playBlockedReason && a.mode !== 'drag' && !a.reasonShown) {
      showThoughtBubble(a.playBlockedReason, true);
      a.reasonShown = true;
    }
    a.targetSession.setHover(hit);

    // 单体箭头跟随停靠中的卡牌，群体只显示战场提示；药水和技能沿原拎起点指向。
    if (!a.follow || a.mode === 'target' || a.mode === 'clickTarget') {
      const from = a.follow ? { x:a.motion.x - vr.left,
        y:a.motion.y - base.height * base.scale * a.motion.scale / 2 - vr.top + 6 } : { x:a.ax, y:a.ay };
      const tx = eX - vr.left, ty = eY - vr.top; // NTargetingArrow mouse 模式始终追鼠标。
      aimArrowUpdate(from.x, from.y, tx, ty, AIM_COLOR[hit ? hit.kind : a.side], vr);
    }
  }
  function restoreCardPose(a, returnToHand) {
    if (!a.follow) return;
    const el = a.el;
    el.style.transition = 'none';
    el.style.transform = a.originalTransform;
    el.inert = a.originalInert;
    if (!returnToHand || !el.isConnected || !a.stage?.isConnected || UI.el.overlay.hidden) {
      el.style.transition = a.originalTransition;
      return;
    }
    // 回归当前手牌的布局目标；不另开固定时长动画，位置/缩放共用 holder 插值时钟。
    const base = cardLayoutBase(el), target = el.getBoundingClientRect();
    a.rest = { x:(target.left + target.width / 2 - base.x) / base.scale,
      y:(target.top + target.height / 2 - base.y) / base.scale,
      scale:target.width / (base.width * base.scale) || 1 };
    returningCards.set(el, a);
    paintCardPose(a, base);
    ensureMotionFrame();
  }
  function releaseAimCapture(a) {
    if (a.captureHost?.hasPointerCapture?.(a.pointerId)) {
      try { a.captureHost.releasePointerCapture(a.pointerId); } catch { /* 浏览器可能已自动释放。 */ }
    }
  }
  // 拆监听+恢复卡牌+清箭头/指示（打出与取消共用）
  function finishAim(a, returnToHand = false, keepPose = false) {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', onAimPointerCancel, true);
    window.removeEventListener('pointerdown', onAimPointerDown, true);
    document.removeEventListener('contextmenu', aimCtxSuppress, true);
    window.removeEventListener('blur', cancelAim);
    window.removeEventListener('resize', cancelAim);
    document.removeEventListener('visibilitychange', onAimVisibilityChange);
    document.removeEventListener('compositionstart', cancelAim, true);
    document.removeEventListener('keydown', onAimKeydown, true);
    a.captureHost?.removeEventListener('lostpointercapture', onAimLostCapture);
    a.stage?.classList.remove('drop-any');
    aimCleanup(a, keepPose);
    releaseAimCapture(a);
    if (!keepPose) restoreCardPose(a, returnToHand);
    if (a.reasonShown) showThoughtBubble(a.playBlockedReason);
  }
  function consumePointerClick(a, e) {
    aimPlayedAt = Date.now();
    consumedPointerClick = { pointerId:a.pointerId, x:e.clientX, y:e.clientY, until:aimPlayedAt + 300 };
  }
  function submissionStageIsCurrent(ticket) {
    const live = getBattleLiveness();
    if (live?.battleToken !== ticket.battleToken
      || ![BATTLE_PHASES.PLAYER, BATTLE_PHASES.TARGETING, BATTLE_PHASES.RESOLVING].includes(live.phase)
      || UI.el.overlay.hidden) return false;
    const stage = UI.el.ovBody?.querySelector('.battle-stage');
    if (!stage) return false;
    const a = ticket.pose;
    return !a || a.stage === stage && a.el.isConnected && stage.contains(a.el) && a.el.dataset.uid === ticket.uid;
  }
  function releaseSubmittedCard(ticket, returnToHand = false, reason = '') {
    if (submittedCards.get(ticket.uid) !== ticket) return;
    submittedCards.delete(ticket.uid);
    const current = submissionStageIsCurrent(ticket);
    const remains = current && getSnapshot().hand.some(entry => handUid(entry) === ticket.uid);
    if (ticket.pose) {
      ticket.pose.el.classList.remove('aim-lift');
      restoreCardPose(ticket.pose, !!returnToHand && remains);
    }
    if (reason && remains) showThoughtBubble(reason);
  }
  // updateHand calls this after sampling play animations and before restoring focus.
  // A shared stack can keep its element while changing its representative UID.
  function syncSubmittedCardPoses(played = new Set()) {
    const token = getBattleLiveness()?.battleToken;
    submittedCards.forEach(ticket => {
      const a = ticket.pose;
      if (ticket.battleToken !== token || a && (!a.el.isConnected || !a.stage?.isConnected
        || a.el.dataset.uid !== ticket.uid || played.has(ticket.uid))) {
        releaseSubmittedCard(ticket);
      } else if (a) a.el.classList.add('aim-lift');
    });
  }
  function submitCardWithFeedback(uid, side, forceDirect = false, pose = null) {
    syncSubmittedCardPoses();
    if (submittedCards.has(uid)) {
      if (pose) { pose.el.classList.remove('aim-lift'); restoreCardPose(pose, true); }
      return null;
    }
    const ticket = { uid, battleToken:getBattleLiveness()?.battleToken, pose, receipt:null, committed:false };
    submittedCards.set(uid, ticket);
    let submission;
    try { submission = commands.submitCardPlay(uid, side, forceDirect); }
    catch (error) {
      releaseSubmittedCard(ticket, true, '暂时无法打出，请重试');
      console.error('[battle] 出牌提交异常', error);
      return null;
    }
    if (submission.status === 'rejected') {
      releaseSubmittedCard(ticket, true, submission.reason?.message || '当前无法打出这张牌');
    } else if (submission.status === 'needs-input') {
      // The core has already opened its target/infusion/payment interaction.
      // Releasing the old pose must never cancel that newly created interaction.
      releaseSubmittedCard(ticket);
    } else if (submission.status === 'queued') {
      ticket.receipt = submission.receipt;
      submission.settled.then(result => {
        if (submittedCards.get(uid) !== ticket || result.uid !== uid || result.battleToken !== ticket.battleToken
          || result.receipt.actionSeq !== ticket.receipt.actionSeq) return;
        if (result.status === 'committed') {
          ticket.committed = true;
          // Keep a pointer pose until the existing play animation samples it.
          if (!pose || !submissionStageIsCurrent(ticket)) releaseSubmittedCard(ticket);
          else syncSubmittedCardPoses();
        } else {
          releaseSubmittedCard(ticket, true, result.status === 'rejected' ? result.reason?.message || '本次出牌未被接受' : '');
        }
      }).catch(error => {
        if (submittedCards.get(uid) === ticket && !ticket.committed) releaseSubmittedCard(ticket, true, '本次出牌未完成');
        console.error('[battle] 出牌回执异常', error);
      });
    } else {
      releaseSubmittedCard(ticket, true, '出牌结果暂不可用，请重试');
    }
    return submission;
  }
  function completeCardTarget(a, e) {
    const allowed = e.clientY < a.playY && !a.playBlockedReason;
    const hit = allowed ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
    const target = a.side === 'enemy'
      ? hit?.idx ?? getSnapshot().foes.findIndex(foe => !foe.dead && foe.hp > 0)
      : a.side === 'self' ? 'self' : undefined;
    const selected = hit && (a.side !== 'enemy' || target >= 0) && a.targetSession.select(hit);
    aim = null;
    finishAim(a, !selected, !!selected);
    if (selected) submitCardWithFeedback(a.uid, target, false, a);
    else cancelPendingTarget();
  }
  function endAim(e) {
    const a = aim;
    if (!a || e.pointerId !== a.pointerId) return;
    // 最后一次 move 与 up 可在同一帧；先以最终坐标推进状态，再依松手模式确认。
    moveAim(e);
    if (a.moved) aimPointerFrame();
    a.leftDown = false;
    if (aim !== a) return;
    const wasMoved = a.moved;
    if (a.follow || wasMoved) consumePointerClick(a, e);

    // —— 药水 / 砸击（非跟手，原口径）：松手有敌=使用，否则取消 ——
    if (!a.follow) {
      aim = null;
      const hit = wasMoved ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
      const selected = hit?.kind === 'enemy' && a.targetSession.select(hit);
      finishAim(a, !selected);
      if (wasMoved && selected) {
        aimPlayedAt = Date.now();
        if (a.kind === 'slam') { if (!a.snap.slamPending) bagSlam(); resolveSlam(hit.idx); return; }   // 09-20 老板：砸击拖到敌人身上松手=释放（先点选过的不再反转为取消）
        useItemCmd(a.uid, hit.idx);
        return;
      }
      cancelPendingTarget();
      return;
    }

    // 真正越过出牌线之前松键不结束起拖；继续随鼠标，过线后改用点击确认。
    if (a.mode === 'drag') {
      releaseAimCapture(a);
      ensureMotionFrame();
      return;
    }
    if (a.mode === 'multi') {
      if (a.targetMode === 'release') completeCardTarget(a, e);
      return;
    }
    const hit = aimHoverAt(e.clientX, e.clientY, a.targetSession);
    if (a.targetMode === 'release' && !hit) {
      a.targetMode = 'click'; a.mode = 'clickTarget';
      releaseAimCapture(a);
      ensureMotionFrame();
      return;
    }
    completeCardTarget(a, e);
  }
  function cancelAim() {
    const a = aim;
    aim = null;
    if (!a) return;
    aimPlayedAt = Date.now(); // 取消后吞掉本次按压可能产生的合成 click
    finishAim(a, true);
    clearThoughtBubble();
  }
  function onAimPointerCancel(e) { if (aim && e.pointerId === aim.pointerId) cancelAim(); }
  function onAimLostCapture(e) {
    if (aim && e.pointerId === aim.pointerId && (!aim.follow || aim.leftDown)) cancelAim();
  }
  function onAimVisibilityChange() { if (document.hidden) cancelAim(); }
  function onAimKeydown(e) {
    const a = aim;
    if (a?.follow && (a.mode === 'target' || a.mode === 'clickTarget') && e.key === 'Enter'
      && !e.defaultPrevented && !e.isComposing && e.keyCode !== 229 && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey
      && !e.target?.closest?.('input, textarea, select, [contenteditable="true"], button, summary, .hsc-desc, [data-term], [data-ui-tip]')) {
      const hit = a.lastY < a.playY && aimHoverAt(a.lastX, a.lastY, a.targetSession);
      if (!hit) return;
      e.preventDefault(); e.stopImmediatePropagation();
      completeCardTarget(a, { clientX:a.lastX, clientY:a.lastY });
      return;
    }
    if (!aim || e.isComposing || e.keyCode === 229
      || !['Escape', 'Tab', aim.el.dataset.handIndex].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelAim();
  }

function setClickSelectedUid(v) {
  // 仅作清除口（壳 render 在阶段切换时调用）；直接赋非 null 不会建 clickTargetSession，
  // 会被 syncClickTargetPreviews 立刻清掉——选中态只能经 clickSelectedTarget 流程建立
  if (v != null) return;
  cancelClickSelection();
}   // 壳 render 分派改经 setter（ESM 导入绑定不可赋值，2026-09-22 批5 理顺点）
/* W3-03（2026-09-27 R2）：误指敌人红框抖动样式。battle.css 冻结 → 模块级注入
 * head（battle.view.js btFleeArmStyle 同款直接挂法）；outline 不占布局，抖动
 * 0.45s 一次性，类由拒绝分支挂/650ms 自摘。 */
if (!document.getElementById('btMisTargetStyle')) {
  document.head.insertAdjacentHTML('beforeend',
    '<style id="btMisTargetStyle">@keyframes bt-mis-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}45%{transform:translateX(5px)}70%{transform:translateX(-3px)}88%{transform:translateX(2px)}}.bt-foe.mis-target{animation:bt-mis-shake .45s cubic-bezier(.36,.07,.19,.97) both;outline:2px solid #d05b4b;outline-offset:3px;border-radius:6px;filter:drop-shadow(0 0 8px rgba(208,91,75,.65))!important}</style>');
}
export { aim, aimPlayedAt, clickSelectedUid, updateClickSelectionUI, selectCardByClick, clickSelectedTarget, setTargetable, showCardBlockReason, showHandCardDetails, closeHandCardDetails, startAim, cancelAim, canPreserveAim, resumeAimAfterRender, cancelClickSelection, setClickSelectedUid, syncSubmittedCardPoses };
