/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：指向施法状态机（STS2 NMouseCardPlay 同款：拎起 / 停靠 / 箭头 / 点击确认）。
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
import { battleState, foes } from './battle.runtime.js';
import { BATTLE_PHASES } from './battle.state.js';
  // ---------- 指向施法（STS2 NMouseCardPlay 状态机同款） ----------
  // 拖拽=卡跟手；上拖过「出牌线」（视口75%，按抓取点校正）后：
  //   指向卡 → CenterCard 停靠视口底部中央缩 0.75，箭头自卡指向指针（松手有目标=打出，
  //            无目标=转「点击确认」：箭头保持，点目标打出、点空回手）；
  //   未指向卡 → 继续跟手+战场指示（松手即打出）。
  // 底部 5% 取消区（离开过一次再进入=取消）；右键/Esc 取消。
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e', any: '#d9c07a' };
  function playZoneY(grabY) {
    const line = window.innerHeight * 0.75;
    // 反编译口径：线下抓取=max(75%线, 抓取Y-100)（最多上拖100px）；线上抓取=再上拖50px
    return grabY > line ? Math.max(line, grabY - 100) : Math.min(line, grabY - 50);
  }
  function cancelZoneY() { return window.innerHeight * 0.95; }
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 指向松手刚打出成功的时间戳（抑制随后误触发的 click 锁定）
  let clickSelectedUid = null; // 点击选中的指向卡；拖拽路径仍由 aim 独立处理
  let clickTargetSession = null;
  function targetSessionBattleCurrent(token) {
    return battleState.token === token && (battleState.phase === BATTLE_PHASES.PLAYER || battleState.phase === BATTLE_PHASES.TARGETING);
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
  // snap 可传入指向开始时缓存的快照（见 startAim）——拖拽 pointermove 高频路径
  // 每次都重建整棵冻结快照是纯浪费；指向期间战斗状态不会变（重渲染会 cancelAim）
  function aimHoverAt(x, y, session) { return session?.hitAt(x, y) || null; }
  function makeAimTargetSession(a) {
    return createTargetSession({
      side: a.side, snapshot: a.snap,
      isBattleCurrent: () => targetSessionBattleCurrent(a.snap.battleToken),
      getTargets: () => foes,
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
      getTargets: () => foes,
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
        getTargets: () => foes,
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
      playBlockedReason, reasonShown: false,
      ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
      sx: e.clientX, sy: e.clientY, moved: false, hover: null,
      snap, vr,   // 指向期间的快照/overlay rect 缓存：期间战斗状态不会变（重渲染会 cancelAim），pointermove 高频路径直接复用
      // STS2 状态机：drag（卡跟手）→ 过出牌线 → target（指向卡停靠+箭头）/ multi（未指向卡+指示）
      // → clickTarget（瞄准松手无目标，转点击确认）
      follow: isCard, mode: 'drag',
      restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
      stage: el.closest('.battle-stage'),
      playY: isCard ? playZoneY(e.clientY) : -1,
      hasLeftCancel: false,   // STS2 _hasLeftCardCancelZoneOnce
      dock: null, dockAnchor: null,
      cur: { x: 0, y: 0 }, tgt: { x: 0, y: 0 }, lastT: 0, raf: 0,
    };
    aim.targetSession = makeAimTargetSession(aim);
    el.classList.add('aim-lift');
    if (isCard) {
      flashCardPickup(el);
      SDT.Sound.sfx('cardSelect');
    }
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch { /* 指针可能已释放：捕获失败不影响指向 */ } }
    window.addEventListener('pointermove', moveAim, true);
    window.addEventListener('pointerup', endAim, true);
    window.addEventListener('pointercancel', cancelAim, true);
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
  // LerpToMouse：卡牌每帧向目标位收敛（指数趋近，STS2 Position.Lerp(dt*7) 等效）；
  // 瞄准态目标位=底部中央停靠位，其余=指针。
  // rAF 被遮挡挂起时（IAB 后台/页面覆盖）由 moveAim 事件驱动兜底，双通道等效 STS2 _Process+输入
  function applyAimTransform(dt) {
    if (!aim || !aim.follow) return;
    const docked = aim.mode === 'target' || aim.mode === 'clickTarget';
    const tgt = docked ? aim.dock : aim.tgt;
    const k = 1 - Math.exp(-dt * 0.016);
    aim.cur.x += (tgt.x - aim.cur.x) * k;
    aim.cur.y += (tgt.y - aim.cur.y) * k;
    aim.el.style.transform = `translate(${aim.cur.x.toFixed(1)}px,${aim.cur.y.toFixed(1)}px) scale(${docked ? 0.75 : 1.07})`;
  }
  function aimFollowStep(now) {
    if (!aim || !aim.follow) return;
    const dt = Math.min(48, now - (aim.lastT || now));
    aim.lastT = now;
    applyAimTransform(dt);
    aim.raf = requestAnimationFrame(aimFollowStep);
  }
  function stopAimFollow(a) {
    if (a && a.raf) cancelAnimationFrame(a.raf);
    if (a && a.follow && a.el) a.el.style.transform = '';
    if (a && a.stage) a.stage.classList.remove('drop-any');
  }
  function moveAim(e) {
    if (!aim) return;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < 6) return;
    aim.moved = true;
    const vr = aim.vr;   // 指向期间 overlay 尺寸不变（重渲染会 cancelAim），缓存省去每次 move 的布局读取
    if (e.clientY <= cancelZoneY()) aim.hasLeftCancel = true;   // STS2 _hasLeftCardCancelZoneOnce
    // 指针视口位移 → 卡牌 transform（布局值）：过 UiScale 换算，zoom≠1 才能跟手
    const zNow = uiScale();
    aim.tgt.x = (e.clientX - aim.sx) / zNow;
    aim.tgt.y = (e.clientY - aim.sy) / zNow;

    if (aim.follow) {
      // —— 状态机：drag →（过出牌线）→ target（指向卡）/ multi（未指向卡） ——
      if (aim.mode === 'drag' && e.clientY < aim.playY) {
        if (aim.side === 'enemy' || aim.side === 'self') {
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
      if (aim.mode !== 'drag' && aim.hasLeftCancel && e.clientY > cancelZoneY()) { cancelAim(); return; }
    }

    // 悬停检测：瞄准态（含药水全程）高亮目标；drag 态 STS2 无悬停反馈
    const targeting = !aim.follow || aim.mode === 'target' || aim.mode === 'clickTarget';
    const hit = targeting ? aimHoverAt(e.clientX, e.clientY, aim.targetSession) : null;
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
        const hr = hit.el.getBoundingClientRect();
        tx = hr.left + hr.width / 2 - vr.left;
        ty = hr.top + hr.height / 2 - vr.top;
      }
      aimArrowUpdate(from.x, from.y, tx, ty, AIM_COLOR[hit ? hit.kind : aim.side], vr);
    }
    applyAimTransform(16);   // rAF 挂起兜底：跟随随指针事件同步推进
  }
  // 拆监听+恢复卡牌+清箭头/指示（打出与取消共用）
  function finishAim(a) {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', cancelAim, true);
    window.removeEventListener('pointerdown', aimRightCancel, true);
    document.removeEventListener('contextmenu', aimCtxSuppress, true);
    stopAimFollow(a);
    aimCleanup(a);
    if (a.reasonShown) showThoughtBubble(a.playBlockedReason);
  }
  function endAim(e) {
    const a = aim;
    aim = null;
    if (!a) return;
    const wasMoved = a.moved;
    a.moved = false;
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

    // —— STS2 状态机松手语义 ——
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
      if (a.side === 'enemy' && a.snap.foes.filter(f => !f.dead).length === 1) {
        const idx = a.snap.foes.findIndex(f => !f.dead);
        if (!a.targetSession.selectDirect('enemy', idx)) { finishAim(a); cancelPendingTarget(); return; }
        finishAim(a);
        aimPlayedAt = Date.now();
        play(a.uid, a.snap.foes.findIndex(f => !f.dead));
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
    // 轻点（位移<6px）走 click → play() 的锁定流程
    cancelPendingTarget();
  }
  function cancelAim() {
    const a = aim;
    aim = null;
    if (!a) return;
    finishAim(a);
    clearThoughtBubble();
  }

function setClickSelectedUid(v) {
  if (v == null) { cancelClickSelection(); return; }
  clickSelectedUid = v;
}   // 壳 render 分派改经 setter（ESM 导入绑定不可赋值，2026-09-22 批5 理顺点）
export { aim, aimPlayedAt, clickSelectedUid, selectCardByClick, clickSelectedTarget, setTargetable, showCardBlockReason, startAim, cancelAim, cancelClickSelection, setClickSelectedUid };
