/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：指向施法状态机（参考 STS2 NMouseCardPlay：拎起 / 停靠 / 箭头 / 点击确认）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { scale as uiScale } from '../ui/ui-scale.js';
import { esc } from '../core/shared.js';
import { commands, getSnapshot, effCostOf, findCard, infuseOf, targetSide, unplayableReason } from './battle.core.js';
  const play = commands.playCard;
  const bagSlam = commands.bagSlam;             // 需求 #9：背包砸击
  const resolveSlam = commands.resolveSlam;
  const useItemCmd = commands.useItem;
  const cancelPendingTarget = commands.cancelPendingTarget;
  function flashCardPickup(el) {
    if (!el) return;
    el.classList.remove('card-pickup-flash');
    void el.offsetWidth;
    el.classList.add('card-pickup-flash');
  }
  function cardPlayBlockedReason(uid, card, snapshot) {
    const why = unplayableReason(card);
    if (why) return `无法打出：${why}`;
    const cost = effCostOf(card, uid);
    return cost > snapshot.energy ? `能量不足：需要 ${cost} 点能量，当前 ${snapshot.energy}` : '';
  }
  function showCardBlockReason(uid) {
    const snapshot = getSnapshot();
    const entry = findCard(uid);
    if (!snapshot || !entry) return false;
    const reason = cardPlayBlockedReason(uid, entry.card, snapshot);
    if (reason) showThoughtBubble(reason);
    return !!reason;
  }
import { showFoePreview, clearFoePreview, showThoughtBubble, clearThoughtBubble } from './battle.hover.js';
import { createTargetSession } from './battle.target-session.js';
import { BATTLE_PHASES } from './battle.state.js';
  // ---------- 指向施法 ----------
  // 对敌卡全程跟手，仅靠近存活敌人时停靠并出现箭头；拖离目标恢复跟手，空处松手回手牌。
  // 自指向卡与无目标卡仍沿用出牌线；右键/Esc 取消。
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e', any: '#d9c07a' };
  const ENEMY_AIM_ENTER_PX = 72;
  const ENEMY_AIM_EXIT_PX = 108; // 稍宽的退出范围，避免箭头在边缘抖动
  function playZoneY(grabY, side) {
    if (side === 'self') {
      // 自指向卡沿用上次扩大的拖动范围。
      return Math.min(window.innerHeight * 0.6, grabY - 180);
    }
    const line = window.innerHeight * 0.75;
    // 无需选目标的卡沿用原出牌线与抓取点校正，避免改变其拖放落牌距离。
    return grabY > line ? Math.max(line, grabY - 100) : Math.min(line, grabY - 50);
  }
  function cancelZoneY() { return window.innerHeight * 0.95; }
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 拖动松手被处理的时间戳（抑制随后误触发的 click 锁定）
  let clickSelectedUid = null; // 点击选中的指向卡；拖拽路径仍由 aim 独立处理
  let clickTargetSession = null;
  function targetSessionBattleCurrent(token) {
    // 视图层不直读战斗运行时（架构守卫）：经 core 的快照判定场次与阶段。
    const snapshot = getSnapshot();
    return !!snapshot && snapshot.battleToken === token
      && (snapshot.phase === BATTLE_PHASES.PLAYER || snapshot.phase === BATTLE_PHASES.TARGETING);
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
  }
  // 更新弯曲箭头：Canvas 绘制二次贝塞尔上弓与箭头，避免矢量 DOM 资源。
  // vr 可传入调用方缓存的 overlay rect（拖拽高频路径避免每次 pointermove 强制读布局）
  function aimArrowUpdate(x1, y1, x2, y2, color, vr) {
    const canvas = aimCanvasEnsure();
    vr = vr || UI.el.overlay.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const zA = uiScale();
    // vr/坐标全是视口口径；画布布局尺寸=视口/z，绘制矩阵除 z 抵消 → 物理密度恰为 dpr
    const width = Math.max(1, Math.round(vr.width / zA));
    const height = Math.max(1, Math.round(vr.height / zA));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio / zA, 0, 0, ratio / zA, 0, 0);
    ctx.clearRect(0, 0, width, height);
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
  function aimHoverAt(x, y, session) { return session?.hitAt(x, y) || null; }
  function enemyNearAt(x, y, a, radius) {
    if (!a.stage || !a.targetSession?.isCurrent()) return null;
    let nearest = null;
    let nearestDistance = radius;
    for (const el of a.stage.querySelectorAll('.bt-foe[data-eidx]')) {
      const idx = +el.dataset.eidx;
      if (!a.snap.foes[idx] || a.snap.foes[idx].dead || el.classList.contains('dead')) continue;
      const figure = el.querySelector('.sts-figure');
      if (!figure) continue;
      const rect = figure.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { kind: 'enemy', idx, el };
      }
    }
    return nearest;
  }
  function makeAimTargetSession(a) {
    return createTargetSession({
      side: a.side, snapshot: a.snap,
      isBattleCurrent: () => targetSessionBattleCurrent(a.snap.battleToken),
      getTargets: () => getSnapshot().foes,
      onHover(next, previous) {
        if (previous) {
          previous.el.classList.remove('drag-over', 'drop-here', 'drop-any');
          if (previous.kind === 'enemy') clearFoePreview(previous.el);
        }
        a.hover = next;
        if (!next) return;
        if (next.kind === 'enemy') {
          next.el.classList.add('drag-over');
          showFoePreview(next.el, next.idx, a.uid, a.card, a.mode === 'clickTarget' ? 'click' : 'drag');
        } else next.el.classList.add('drop-here');
      },
    });
  }
  function handUid(entry) { return entry && typeof entry === 'object' ? entry.uid : entry; }
  function aimBaseRect(el) {
    const transform = el.style.transform;
    el.style.transform = '';
    const rect = el.getBoundingClientRect();
    el.style.transform = transform;
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
    const stage = UI.el.ovBody?.querySelector('.battle-stage');
    const entry = findCard(a.uid);
    if (!stage || !a.el.isConnected || !stage.contains(a.el) || a.el.dataset.uid !== a.uid || !entry) { cancelAim(); return; }
    a.el.classList.add('aim-lift'); // updateHand 会重写 className
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
    a.stage = stage;
    a.vr = UI.el.overlay.getBoundingClientRect();
    a.playBlockedReason = cardPlayBlockedReason(a.uid, a.card, snapshot);
    if (a.reasonShown) {
      if (a.playBlockedReason) showThoughtBubble(a.playBlockedReason, true);
      else { clearThoughtBubble(); a.reasonShown = false; }
    }
    a.targetSession = makeAimTargetSession(a);
    if (a.mode === 'target' || a.mode === 'clickTarget') enterDock(a);
    if (a.captureHost?.setPointerCapture && !a.captureHost.hasPointerCapture?.(a.pointerId)) {
      try { a.captureHost.setPointerCapture(a.pointerId); } catch { /* 已松手则由 window pointerup 清理 */ }
    }
    if (a.moved) moveAim({ pointerId: a.pointerId, clientX: a.lastX, clientY: a.lastY });
  }
  function aimClearHover() {
    if (!aim) return;
    aim.targetSession?.setHover(null);
  }
  function aimCleanup(a) {
    if (a) {
      a.el.classList.remove('aim-lift');
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
      el.setAttribute('aria-pressed', 'false');
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
        el.setAttribute('aria-pressed', 'false');
      });
      updateClickSelectionUI();
    }
    const entry = clickSelectedUid == null ? null : findCard(clickSelectedUid);
    const selectedSide = entry && targetSide(entry.card);
    const pendingEntry = snapshot.pendingTarget && findCard(snapshot.pendingTarget.uid);
    const pendingSide = pendingEntry && targetSide(pendingEntry.card);
    setTargetable(document.getElementById('btSelf'), selectedSide === 'self' || pendingSide === 'self', '自己，按 Enter 确认目标');
    document.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
      clearFoePreview(el);
      const idx = +el.dataset.eidx;
      const foe = snapshot.foes[idx];
      const targetable = !!(foe && !foe.dead && (selectedSide === 'enemy' || pendingSide === 'enemy' || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending));
      setTargetable(el, targetable, `${foe?.name || '敌人'}，按 Enter 确认目标`);
      if (targetable && selectedSide === 'enemy' && el.matches(':hover, :focus')) {
        showFoePreview(el, idx, clickSelectedUid, entry.card, 'click');
      }
    });
  }
  function updateClickSelectionUI() {
    const cap = document.querySelector('.sts-arena-caption span');
    if (!cap) return;
    const entry = clickSelectedUid == null ? null : findCard(clickSelectedUid);
    if (!entry) { cap.textContent = cap.dataset.battleDetail || ''; return; }
    // U8：选中提示条带目标图标（敌人=红剑 / 自己=绿心），与单位区高亮框同色系
    const target = targetSide(entry.card) === 'self' ? '[[icon:heart]] 自己（绿框立绘）' : '[[icon:swords]] 敌人（红框）';
    cap.innerHTML = SDT.Icons.rich(`已选【${esc(entry.card.name)}】——点击 ${target} 确认，或用方向键切换目标、Enter 确认，Esc 取消`);
  }
  function selectCardByClick(uid, focusTarget = false) {
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
    if (side === 'enemy') {
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
      el.setAttribute('aria-pressed', 'false');
    });
    const el = [...document.querySelectorAll('.sts-hand .bt-card')].find(x => x.dataset.uid === uid);
    if (el) {
      el.classList.add('click-selected');
      el.setAttribute('aria-pressed', 'true');
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
    const snap = getSnapshot();
    const { busy, infusing, discovering, choosing } = snap;
    if (busy || infusing || discovering || choosing || aim) return;
    const uid = el.dataset.uid;
    // 09-20 老板：砸击改拖动释放——按钮无卡牌 uid，喂伪卡（4 点固定伤害）复用
    // 药水式非跟手指向（红箭头 + 敌人高亮 + 伤害预览）；能量门槛由按钮 disabled 承担
    const isSlam = kind === 'slam';
    const entry = isSlam ? { card: { name: '背包砸击', desc: '4 点固定伤害', dmg: 4 } } : findCard(uid);
    if (!entry) return;
    const side = (kind === 'potion' || isSlam) ? 'enemy' : (targetSide(entry.card) || 'any');   // null = 无目标招式：拖到中间空地即可
    const playBlockedReason = !isSlam && kind !== 'potion' ? cardPlayBlockedReason(uid, entry.card, snap) : '';
    const isCard = kind !== 'potion' && !isSlam;
    const vr = UI.el.overlay.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    aim = {
      uid, card: entry.card, side, el, kind: kind || 'card',
      pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY,
      playBlockedReason, reasonShown: false,
      ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
      sx: e.clientX, sy: e.clientY, moved: false, hover: null,
      snap, vr,   // pointermove 复用；战场重绘后会更新为新快照和 rect
      // 对敌卡靠近敌人进 target；自指向卡/无目标卡过出牌线进 target/multi。
      // clickTarget 兼容原有点击确认流程；对敌拖拽不会进入该状态。
      follow: isCard, mode: 'drag',
      restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
      stage: el.closest('.battle-stage'),
      playY: isCard && side !== 'enemy' ? playZoneY(e.clientY, side) : -1,
      hasLeftCancel: false,   // STS2 _hasLeftCardCancelZoneOnce
      dock: null, dockAnchor: null,
      cur: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, tgt: { x: 0, y: 0 }, lastT: performance.now(), raf: 0,
    };
    aim.targetSession = makeAimTargetSession(aim);
    el.classList.add('aim-lift');
    if (isCard) {
      aim.baseRect = aimBaseRect(el);
      aim.slotLayout = aimSlotLayout(el);
    }
    if (isCard) {
      flashCardPickup(el);
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
    window.addEventListener('pointerdown', aimRightCancel, true);
    document.addEventListener('contextmenu', aimCtxSuppress, true);
    if (isCard) aim.raf = requestAnimationFrame(aimFollowStep);
  }
  // STS2 CenterCard：指向卡进瞄准态=停靠视口底部中央、缩 0.75，箭头自卡画向指针
  function enterDock(a) {
    const dockCx = window.innerWidth / 2;
    const dockCy = window.innerHeight - (a.restCenter.h * 0.75) / 2;
    const zD = uiScale();   // dock 喂 transform（布局值），dockAnchor 留视口口径喂箭头
    a.dock = { x: (dockCx - a.restCenter.cx) / zD, y: (dockCy - a.restCenter.cy) / zD };
    a.dockAnchor = { x: dockCx - a.vr.left, y: dockCy - a.vr.top };
    aimClearHover();
  }
  // 右键取消指向（STS2：鼠标右键 CancelPlayCard）；拖拽期间压制右键菜单
  function aimRightCancel(e) {
    if (!aim || e.button !== 2) return;
    e.preventDefault();
    cancelAim();
  }
  function aimCtxSuppress(e) { if (aim) e.preventDefault(); }
  // 临界阻尼弹簧：位置和速度连续，拖动时有重量感，切换到停靠位时也保留惯性。
  // rAF 与 pointermove 共用时钟，避免高回报率鼠标每次事件都额外推进一帧。
  function applyAimTransform(dt) {
    if (!aim || !aim.follow) return;
    const docked = aim.mode === 'target' || aim.mode === 'clickTarget';
    const tgt = docked ? aim.dock : aim.tgt;
    const omega = docked ? 16 : 11; // 停靠稍快；自由拖动约 0.4 秒稳定到指针附近
    const decay = Math.exp(-omega * dt);
    for (const axis of ['x', 'y']) {
      const offset = aim.cur[axis] - tgt[axis];
      const spring = (aim.vel[axis] + omega * offset) * dt;
      aim.cur[axis] = tgt[axis] + (offset + spring) * decay;
      aim.vel[axis] = (aim.vel[axis] - omega * spring) * decay;
    }
    aim.el.style.transform = `translate(${aim.cur.x.toFixed(1)}px,${aim.cur.y.toFixed(1)}px) scale(${docked ? 0.75 : 1.07})`;
  }
  function advanceAimFollow(now) {
    if (!aim || !aim.follow) return;
    const elapsed = now - aim.lastT;
    if (!(elapsed > 0)) return;
    aim.lastT = now;
    applyAimTransform(Math.min(48, elapsed) / 1000);
  }
  function aimFollowStep(now) {
    if (!aim || !aim.follow) return;
    advanceAimFollow(now);
    aim.raf = requestAnimationFrame(aimFollowStep);
  }
  function stopAimFollow(a) {
    if (a && a.raf) cancelAnimationFrame(a.raf);
    if (a && a.stage) a.stage.classList.remove('drop-any');
  }
  function moveAim(e) {
    if (!aim || e.pointerId !== aim.pointerId) return;
    aim.lastX = e.clientX;
    aim.lastY = e.clientY;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < 6) return;
    aim.moved = true;
    const vr = aim.vr;   // 重绘后由 resumeAimAfterRender 更新；移动时复用以免频繁读布局
    if (e.clientY <= cancelZoneY()) aim.hasLeftCancel = true;   // STS2 _hasLeftCardCancelZoneOnce
    // 指针视口位移 → 卡牌 transform（布局值）：过 UiScale 换算，zoom≠1 才能跟手
    const zNow = uiScale();
    aim.tgt.x = (e.clientX - aim.sx) / zNow;
    aim.tgt.y = (e.clientY - aim.sy) / zNow;

    let nearEnemy = null;
    if (aim.follow) {
      if (aim.side === 'enemy') {
        nearEnemy = enemyNearAt(e.clientX, e.clientY, aim,
          aim.mode === 'target' ? ENEMY_AIM_EXIT_PX : ENEMY_AIM_ENTER_PX);
        if (aim.mode === 'drag' && nearEnemy) {
          aim.mode = 'target';
          enterDock(aim);
        } else if (aim.mode === 'target' && !nearEnemy) {
          aim.mode = 'drag';
          aim.dock = null;
          aim.dockAnchor = null;
          aimArrowRemove();
        }
      } else if (aim.mode === 'drag' && e.clientY < aim.playY) {
        if (aim.side === 'self') {
          aim.mode = 'target';
          enterDock(aim);
        } else {
          aim.mode = 'multi';   // 未指向卡：战场亮环示意可落牌
          if (aim.stage) aim.stage.classList.add('drop-any');
        }
      } else if (aim.mode === 'multi' && e.clientY >= aim.playY) {
        aim.mode = 'drag';
        if (aim.stage) aim.stage.classList.remove('drop-any');
      }
      // 底部取消区：瞄准/指示态拖入即取消（STS2 exitEarly = IsCardInCancelZone）
      if (aim.side !== 'enemy' && aim.mode !== 'drag' && aim.hasLeftCancel && e.clientY > cancelZoneY()) { cancelAim(); return; }
    }

    // 悬停检测：瞄准态（含药水全程）高亮目标；drag 态 STS2 无悬停反馈
    const targeting = !aim.follow || aim.mode === 'target' || aim.mode === 'clickTarget';
    const hit = aim.follow && aim.side === 'enemy'
      ? (aim.mode === 'target' ? nearEnemy : null)
      : (targeting ? aimHoverAt(e.clientX, e.clientY, aim.targetSession) : null);
    if (aim.playBlockedReason && aim.mode !== 'drag' && !aim.reasonShown) {
      showThoughtBubble(aim.playBlockedReason, true);
      aim.reasonShown = true;
    }
    aim.targetSession.setHover(hit);

    // 箭头：药水自拎起位画向指针；指向卡瞄准态自停靠位画向指针（STS2 NTargetingArrow）
    if (!aim.follow || aim.mode === 'target' || aim.mode === 'clickTarget') {
      const from = aim.follow ? aim.dockAnchor : { x: aim.ax, y: aim.ay };
      let tx = e.clientX - vr.left, ty = e.clientY - vr.top;
      if (hit) {
        const hr = (hit.kind === 'enemy' ? hit.el.querySelector('.sts-figure') : hit.el).getBoundingClientRect();
        tx = hr.left + hr.width / 2 - vr.left;
        ty = hr.top + hr.height / 2 - vr.top;
      }
      aimArrowUpdate(from.x, from.y, tx, ty, AIM_COLOR[hit ? hit.kind : aim.side], vr);
    }
    advanceAimFollow(performance.now()); // rAF 挂起兜底；真实耗时只计算一次
  }
  // 拆监听+恢复卡牌+清箭头/指示（打出与取消共用）
  function finishAim(a) {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', onAimPointerCancel, true);
    window.removeEventListener('pointerdown', aimRightCancel, true);
    document.removeEventListener('contextmenu', aimCtxSuppress, true);
    stopAimFollow(a);
    aimCleanup(a);
    if (a.follow && a.captureHost?.hasPointerCapture?.(a.pointerId)) {
      try { a.captureHost.releasePointerCapture(a.pointerId); } catch { /* 捕获已由浏览器释放 */ }
    }
    // 先移除 aim-lift，再清掉位移：手牌原有弹簧 transition 负责飞回原位。
    if (a.follow) a.el.style.transform = '';
    if (a.reasonShown) showThoughtBubble(a.playBlockedReason);
  }
  function endAim(e) {
    const a = aim;
    if (!a || e.pointerId !== a.pointerId) return;
    aim = null;
    const wasMoved = a.moved;
    a.moved = false;
    if (wasMoved) aimPlayedAt = Date.now(); // 拖空回手也要吞掉随后由 pointerup 合成的 click
    const inCancel = a.follow && a.hasLeftCancel && e.clientY > cancelZoneY();

    // —— 药水 / 砸击（非跟手，原口径）：松手有敌=使用，否则取消 ——
    if (!a.follow) {
      const hit = wasMoved ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
      const selected = hit?.kind === 'enemy' && a.targetSession.select(hit);
      finishAim(a);
      if (wasMoved && selected) {
        aimPlayedAt = Date.now();
        if (a.kind === 'slam') { if (!a.snap.slamPending) bagSlam(); resolveSlam(hit.idx); return; }   // 09-20 老板：砸击拖到敌人身上松手=释放（先点选过的不再反转为取消）
        useItemCmd(a.uid, hit.idx);
        return;
      }
      cancelPendingTarget();
      return;
    }

    // overlay 捕获了卡牌的 pointerup，轻点时主动走选牌流程；合成 click 由时间戳吞掉。
    if (!wasMoved) {
      finishAim(a);
      aimPlayedAt = Date.now();
      selectCardByClick(a.uid);
      return;
    }

    // 对敌卡只有在敌人附近松手才打出；其余位置回手牌，不保留点击确认态。
    if (a.side === 'enemy') {
      const hit = wasMoved
        ? enemyNearAt(e.clientX, e.clientY, a, a.mode === 'target' ? ENEMY_AIM_EXIT_PX : ENEMY_AIM_ENTER_PX) : null;
      const selected = hit && a.targetSession.select(hit);
      finishAim(a);
      if (selected) { play(a.uid, hit.idx); return; }
      cancelPendingTarget();
      return;
    }

    // 自指向卡与无目标卡沿用原松手语义。
    if (a.mode === 'target') {
      const hit = wasMoved ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
      if (hit && a.targetSession.select(hit)) {   // 松手在目标上=打出
        finishAim(a);
        aimPlayedAt = Date.now();
        play(a.uid, hit.kind === 'enemy' ? hit.idx : 'self');
        return;
      }
      if (hit) { finishAim(a); cancelPendingTarget(); return; }
      if (inCancel) { finishAim(a); cancelPendingTarget(); return; }
      // 2026-09-15 老板定向：无歧义目标（self 卡 / 唯一活敌）拖到空白处松手=直接打出；
      // 多活敌仍转「点击确认」（STS2 ReleaseMouseToTarget→ClickMouseToTarget），避免打错目标
      if (a.side === 'self') {
        if (!a.targetSession.selectDirect('self')) { finishAim(a); cancelPendingTarget(); return; }
        finishAim(a);
        aimPlayedAt = Date.now();
        play(a.uid, 'self');
        return;
      }
      // 多活敌：松手无目标=箭头保持，转「点击确认」
      a.mode = 'clickTarget';
      a.targetSession.setHover(null);
      aim = a;
      return;
    }
    if (a.mode === 'clickTarget') {
      // 确认点击：点到目标=打出，点空=取消回手（STS2 FinishTargeting(null)→TryPlayCard(null)）
      const hit = aimHoverAt(e.clientX, e.clientY, a.targetSession);
      const selected = hit && a.targetSession.select(hit);
      if (!selected) a.targetSession.cancel();
      finishAim(a);
      if (selected) { aimPlayedAt = Date.now(); play(a.uid, hit.kind === 'enemy' ? hit.idx : 'self'); return; }
      cancelPendingTarget();
      return;
    }
    finishAim(a);
    if (a.mode === 'multi') {   // 未指向卡指示态：松手即打出；底部取消区=取消
      if (inCancel) { cancelPendingTarget(); return; }
      aimPlayedAt = Date.now();
      play(a.uid);
      return;
    }
    // drag（未过线松手）：卡回手牌。cancelInteraction 幂等（批次C）：
    // 无进行中交互（普通卡拖空）时是 no-op，落回动画保持完整。
    // 轻点已在上方 pointerup 分支主动走选牌流程。
    cancelPendingTarget();
  }
  function cancelAim() {
    const a = aim;
    aim = null;
    if (!a) return;
    aimPlayedAt = Date.now(); // 取消后吞掉本次按压可能产生的合成 click
    finishAim(a);
    clearThoughtBubble();
  }
  function onAimPointerCancel(e) { if (aim && e.pointerId === aim.pointerId) cancelAim(); }

function setClickSelectedUid(v) {
  if (v == null) { cancelClickSelection(); return; }
  clickSelectedUid = v;
}   // 壳 render 分派改经 setter（ESM 导入绑定不可赋值，2026-09-22 批5 理顺点）
export { aim, aimPlayedAt, clickSelectedUid, selectCardByClick, clickSelectedTarget, setTargetable, showCardBlockReason, startAim, cancelAim, canPreserveAim, resumeAimAfterRender, cancelClickSelection, setClickSelectedUid };
