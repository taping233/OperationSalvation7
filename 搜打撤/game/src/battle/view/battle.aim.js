/* 指向施法：按真实 STS2 NMouseCardPlay / NHandCardHolder 接入中心跟随、出牌线与取消线。
 * 点击先阅读，拖拽释放到合法目标可直接提交；本片经 battle.core 执行命令。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { scale as uiScale, viewport as uiViewport } from '../../ui/ui-scale.js';
import { esc } from '../../core/shared.js';
import { openHandInspector, closeHandInspector } from './battle.hand-inspector.js';
import '../../../css/battle-hand-overhaul.css';
import { commands, getSnapshot, getBattleLiveness, effCostOf, findCard, infuseOf, targetSide, unplayableReason } from '../core/battle.core.js';
  const play = commands.playCard;
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
  const closeHandCardDetails = closeHandInspector;
  // 单击只阅读；确认使用才进入原有注能/选目标/出牌命令。
  function showHandCardDetails(uid) {
    if (aim) cancelAim();
    cancelClickSelection();
    return openHandInspector(uid, (cardUid, kind) => {
      if (kind === 'infusion') commands.selectInfusion(cardUid);
      else selectCardByClick(cardUid, true, { autoSingleTarget: false });
    });
  }
import { showFoePreview, clearFoePreview, showThoughtBubble, clearThoughtBubble } from './battle.hover.js';
import { createTargetSession } from '../core/battle.target-session.js';
import { BATTLE_PHASES } from '../runtime/battle.state.js';
  // ---------- 指向施法 ----------
  // NMouseCardPlay：中心跟手，跨出牌线后指向卡停靠；松手只提交合法目标。
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e', any: '#d9c07a' };
  const PICKUP_DISTANCE = 6; // CSS 像素：浏览器点击容差；源码鼠标按下即 BeginDrag。
  function playZoneY(grabY) {
    const line = uiViewport().height * 0.75;
    return grabY > line ? Math.max(line, grabY - 100) : Math.min(line, grabY - 50);
  }
  function cancelZoneY() { return uiViewport().height * 0.95; }
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 拖动松手被处理的时间戳（抑制随后误触发的 click 锁定）
  let clickSelectedUid = null; // 点击选中的指向卡；拖拽路径仍由 aim 独立处理
  let clickTargetSession = null;
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
    // vr/坐标全是视口口径；画布布局尺寸=视口/z，绘制矩阵除 z 抵消 → 物理密度恰为 dpr
    const width = Math.max(1, Math.round(vr.width / zA));
    const height = Math.max(1, Math.round(vr.height / zA));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const cacheKey = `${x1}|${y1}|${x2}|${y2}|${color}|${canvas.width}x${canvas.height}`;
    if (aimArrowCache === cacheKey) return;
    aimArrowCache = cacheKey;
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
  function aimHoverAt(x, y, session) {
    const hit = session?.hitAt(x, y) || null;
    if (hit?.kind === 'any' && document.elementFromPoint(x, y)?.closest('.sts-hand, .bt-slot, .bt-card, [data-act]')) return null;
    return hit;
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
        el.setAttribute('aria-pressed', 'false');
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
      const targetable = !!(foe && !foe.dead && (selectedSide === 'enemy' || pendingSide === 'enemy' || pendingItemSide === 'enemy' || snapshot.slamPending || snapshot.dartPending));
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
    if (!entry) {
      cap.textContent = cap.dataset.battleDetail || '';
      cap.removeAttribute('aria-label');
      cap.removeAttribute('title');
      return;
    }
    const selfTarget = targetSide(entry.card) === 'self';
    const target = selfTarget ? '[[icon:heart]] 自己' : '[[icon:swords]] 高亮敌人';
    cap.innerHTML = SDT.Icons.rich(`【${esc(entry.card.name)}】· 选择${target} · Esc 取消`);
    const help = `已选${entry.card.name}，点击${selfTarget ? '自己' : '高亮敌人'}确认；方向键切换目标，Enter 确认，Esc 取消`;
    cap.setAttribute('aria-label', help);
    cap.title = help;
  }
  function selectCardByClick(uid, focusTarget = false, { autoSingleTarget = true } = {}) {
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
      el.setAttribute('aria-pressed', 'false');
      el.dataset.handState = el.dataset.blockReason ? 'blocked' : 'ready';
    });
    const el = [...document.querySelectorAll('.sts-hand .bt-card')].find(x => x.dataset.uid === uid);
    if (el) {
      el.classList.add('click-selected');
      el.setAttribute('aria-pressed', 'true');
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
    if (busy || infusing || discovering || choosing || aim) return;
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
      // 指向卡过出牌线进 target；无目标卡过线进 multi。
      follow: isCard, mode: 'drag',
      restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
      stage: el.closest('.battle-stage'),
      playY: isCard ? playZoneY(e.clientY) : -1,
      hasLeftCancel: false, hasEnteredPlay: false,
      dock: null, dockAnchor: null,
      cur: { x: 0, y: 0 }, tgt: { x: 0, y: 0 }, lastT: performance.now(), raf: 0,
      reducedMotion: !!SDT.Motion?.reduceMotion?.(),
    };
    aim.targetSession = makeAimTargetSession(aim);
    if (isCard) {
      aim.baseRect = aimBaseRect(el);
      aim.slotLayout = aimSlotLayout(el);
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
    window.addEventListener('blur', cancelAim);
    window.addEventListener('resize', cancelAim);
    document.addEventListener('visibilitychange', onAimVisibilityChange);
    document.addEventListener('compositionstart', cancelAim, true);
    document.addEventListener('keydown', onAimKeydown, true);
    aim.captureHost?.addEventListener('lostpointercapture', onAimPointerCancel);
    if (isCard) aim.raf = requestAnimationFrame(aimFollowStep);
  }
  // STS2 CenterCard：指向卡进瞄准态=停靠视口底部中央（09-25 起不缩放），箭头自卡画向指针
  function enterDock(a) {
    const dockCx = uiViewport().width / 2;
    // 09-25 老板：拖出不许变短——停靠态与自由拖同尺寸（scale 1.07），dock 中心按同尺寸
    // 反推让卡底仍贴屏幕底缘（原按 0.75 缩后高度算，卡不缩后底边会伸出屏幕）
    const dockCy = uiViewport().height - (a.restCenter.h * 1.07) / 2;
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
  // NHandCardHolder.AnimPosition delta * 7；指数形式保持不同帧率下相同跟随速度。
  function applyAimTransform(dt) {
    if (!aim || !aim.follow || !aim.moved) return;
    const docked = aim.mode === 'target' || aim.mode === 'clickTarget';
    const tgt = docked ? aim.dock : aim.tgt;
    const alpha = aim.reducedMotion ? 1 : 1 - Math.exp(-7 * dt);
    for (const axis of ['x', 'y']) {
      aim.cur[axis] += (tgt[axis] - aim.cur[axis]) * alpha;
      if (Math.abs(tgt[axis] - aim.cur[axis]) < 0.5) aim.cur[axis] = tgt[axis];
    }
    // 09-25 老板：拖出不许变短——停靠态保持与自由拖同尺寸（原 0.75 缩放移除）
    aim.el.style.transform = `translate(${aim.cur.x.toFixed(1)}px,${aim.cur.y.toFixed(1)}px) scale(1.07)`;
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
  // 高回报率鼠标（125-1000Hz）合帧：pointermove 只采样坐标，命中检测/布局读/箭头重绘
  // 每显示帧一次——原先逐事件全跑，高回报率设备上每秒数百次强制布局+全屏清屏。
  let aimMoveFrame = 0;
  function moveAim(e) {
    if (!aim || e.pointerId !== aim.pointerId) return;
    aim.lastX = e.clientX;
    aim.lastY = e.clientY;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < PICKUP_DISTANCE) return;
    if (!aim.moved) {
      aim.moved = true;
      aim.el.classList.add('aim-lift');
      if (aim.follow) {
        if (!aim.reducedMotion) flashCardPickup(aim.el);
        SDT.Sound.sfx('cardSelect');
      }
    }
    if (!aimMoveFrame) aimMoveFrame = requestAnimationFrame(aimPointerFrame);
  }
  function aimPointerFrame() {
    aimMoveFrame = 0;
    const a = aim;
    if (!a) return;
    if (!a.el.isConnected || !a.stage?.isConnected || !a.targetSession?.isCurrent()) { cancelAim(); return; }
    const eX = a.lastX, eY = a.lastY;
    const vr = a.vr;   // 重绘后由 resumeAimAfterRender 更新；帧内复用以免频繁读布局
    if (eY <= cancelZoneY()) a.hasLeftCancel = true;   // STS2 _hasLeftCardCancelZoneOnce
    // 指针视口位移 → 卡牌 transform（布局值）：过 UiScale 换算，zoom≠1 才能跟手
    const zNow = uiScale();
    a.tgt.x = (eX - a.restCenter.cx) / zNow;
    a.tgt.y = (eY - a.restCenter.cy) / zNow;

    if (a.follow) {
      if (a.side === 'enemy' || a.side === 'self') {
        if (a.mode === 'drag' && eY < a.playY) {
          a.mode = 'target';
          a.hasEnteredPlay = true;
          enterDock(a);
        }
      } else if (a.mode === 'drag' && eY < a.playY) {
        a.mode = 'multi';   // 未指向卡：战场亮环示意可落牌
        a.hasEnteredPlay = true;
        if (a.stage) a.stage.classList.add('drop-any');
      } else if (a.mode === 'multi' && eY >= a.playY) {
        a.mode = 'drag';
        if (a.stage) a.stage.classList.remove('drop-any');
      }
      // 底部取消区：瞄准/指示态拖入即取消（STS2 exitEarly = IsCardInCancelZone）
      if (a.hasEnteredPlay && a.hasLeftCancel && eY > cancelZoneY()) { cancelAim(); return; }
    }

    // 悬停检测：瞄准态（含药水全程）高亮目标；drag 态 STS2 无悬停反馈
    const targeting = !a.follow || a.mode === 'target' || a.mode === 'clickTarget';
    const hit = targeting ? aimHoverAt(eX, eY, a.targetSession) : null;
    if (a.playBlockedReason && a.mode !== 'drag' && !a.reasonShown) {
      showThoughtBubble(a.playBlockedReason, true);
      a.reasonShown = true;
    }
    a.targetSession.setHover(hit);

    // 箭头：药水自拎起位画向指针；指向卡瞄准态自停靠位画向指针（STS2 NTargetingArrow）
    if (!a.follow || a.mode === 'target' || a.mode === 'clickTarget') {
      const from = a.follow ? a.dockAnchor : { x: a.ax, y: a.ay };
      const tx = eX - vr.left, ty = eY - vr.top; // NTargetingArrow mouse 模式始终追鼠标。
      aimArrowUpdate(from.x, from.y, tx, ty, AIM_COLOR[hit ? hit.kind : a.side], vr);
    }
    if (a.reducedMotion) applyAimTransform(0);
    else advanceAimFollow(performance.now()); // rAF 挂起兜底；真实耗时只计算一次
  }
  // 拆监听+恢复卡牌+清箭头/指示（打出与取消共用）
  function finishAim(a) {
    if (aimMoveFrame) { cancelAnimationFrame(aimMoveFrame); aimMoveFrame = 0; }
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', onAimPointerCancel, true);
    window.removeEventListener('pointerdown', aimRightCancel, true);
    document.removeEventListener('contextmenu', aimCtxSuppress, true);
    window.removeEventListener('blur', cancelAim);
    window.removeEventListener('resize', cancelAim);
    document.removeEventListener('visibilitychange', onAimVisibilityChange);
    document.removeEventListener('compositionstart', cancelAim, true);
    document.removeEventListener('keydown', onAimKeydown, true);
    a.captureHost?.removeEventListener('lostpointercapture', onAimPointerCancel);
    stopAimFollow(a);
    aimCleanup(a);
    if (a.captureHost?.hasPointerCapture?.(a.pointerId)) {
      try { a.captureHost.releasePointerCapture(a.pointerId); } catch { /* 捕获已由浏览器释放 */ }
    }
    // 先移除 aim-lift，再清掉位移：手牌原有弹簧 transition 负责飞回原位。
    if (a.follow) a.el.style.transform = '';
    if (a.reasonShown) showThoughtBubble(a.playBlockedReason);
  }
  function endAim(e) {
    const a = aim;
    if (!a || e.pointerId !== a.pointerId) return;
    // 最后一次 move 与 up 可在同一显示帧，松手判定必须用最终坐标。
    moveAim(e);
    if (a.moved) {
      if (aimMoveFrame) { cancelAnimationFrame(aimMoveFrame); aimMoveFrame = 0; }
      aimPointerFrame();
      if (aim !== a) return;
    }
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

    // overlay 捕获 pointerup，轻点只打开详情；真正拖动仍沿原目标释放规则。
    if (!wasMoved) {
      finishAim(a);
      aimPlayedAt = Date.now();
      showHandCardDetails(a.uid);
      return;
    }

    // 对敌卡只有在敌人附近松手才打出；其余位置回手牌，不保留点击确认态。
    if (a.side === 'enemy') {
      const hit = wasMoved && !inCancel && !a.playBlockedReason ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
      const selected = hit && a.targetSession.select(hit);
      finishAim(a);
      if (selected) { play(a.uid, hit.idx); return; }
      cancelPendingTarget();
      return;
    }

    // 自指向卡必须落在自身；无目标卡必须跨线并落在战场，HUD/手牌不是落点。
    const canRelease = !inCancel && !a.playBlockedReason && (a.mode === 'target' || a.mode === 'multi');
    const hit = canRelease ? aimHoverAt(e.clientX, e.clientY, a.targetSession) : null;
    const selected = hit && a.targetSession.select(hit);
    finishAim(a);
    if (selected) { play(a.uid, a.side === 'self' ? 'self' : undefined); return; }
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
  function onAimVisibilityChange() { if (document.hidden) cancelAim(); }
  function onAimKeydown(e) {
    if (!aim || e.isComposing || e.keyCode === 229 || !['Escape', 'Tab'].includes(e.key)) return;
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
export { aim, aimPlayedAt, clickSelectedUid, updateClickSelectionUI, selectCardByClick, clickSelectedTarget, setTargetable, showCardBlockReason, showHandCardDetails, closeHandCardDetails, startAim, cancelAim, canPreserveAim, resumeAimAfterRender, cancelClickSelection, setClickSelectedUid };
