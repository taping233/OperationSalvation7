import { gameplayInputAllowed } from '../ui/screen-owner.js';

/** Own one map pointer/keyboard binding; state and loading ownership remain live. */
export function createGameBootInput({ readState, UI, window, document, renderScheduler,
  updateHover, pickNode, isReachable, confirmTarget, showTarget, showInvalidNode,
  getExpeditionPreview, openCellEditor, openDevConsole, cancelPendingDevTools,
  cancelPendingMenuPageOpen, closeCardPageTop, chooseNextTarget, clearTarget, showBackpack }) {
  let bound = false;
  function bindInput() {
    if (bound) return;
    bound = true;
    let dragging = false, downPos = null, lastPos = null, pointerId = null;
    let downWorld = null;   // down 时刻锁定的世界坐标（见 pointerdown）
    let hoverFrame = 0, pendingHover = null;

    const scheduleHover = (e) => {
      pendingHover = { clientX: e.clientX, clientY: e.clientY };
      if (hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        const point = pendingHover;
        pendingHover = null;
        if (point) updateHover(point);
      });
    };

    readState().canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointerId != null) return;
      readState().cam.cancelPan?.();
      pointerId = e.pointerId;
      readState().canvas.setPointerCapture?.(pointerId);
      downPos = lastPos = { x: e.clientX, y: e.clientY };
      // 点击意图的世界坐标必须在 down 时刻锁定（09-30 深审 INFRA-07）：自动镜头回中/
      // 取景 glide 会在 down→up 之间平移相机，up 时再用「当时相机」反推 down 屏幕点
      // 会得到偏移的世界坐标——快速点击会点偏到别的节点
      const rd = readState().canvas.getBoundingClientRect();
      downWorld = readState().cam.screenToWorld(e.clientX - rd.left, e.clientY - rd.top);
      dragging = false;
      readState().game.camDragging = false;
      e.preventDefault();
    });

    readState().canvas.addEventListener('pointermove', (e) => {
      if (downPos && e.pointerId === pointerId) {
        const startsDrag = !dragging && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8;
        if (startsDrag) { dragging = true; readState().cam.beginPan?.(); }
        readState().game.camDragging = dragging;   // 拖拽中主循环不得抢镜头（留言：地图无法正常拖动）
        if (dragging) {
          const origin = startsDrag ? downPos : lastPos;
          const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
          readState().cam.panBy(dx, dy);
          renderScheduler.invalidate();
          readState().canvas.style.cursor = 'grabbing';
          UI.hideTooltip();
          lastPos = { x: e.clientX, y: e.clientY };
          return;
        }
        lastPos = { x: e.clientX, y: e.clientY };
      }
      scheduleHover(e);
    });

    const releasePointer = () => {
      const ownedPointer = pointerId;
      const wasDragging = dragging;
      // 先解除归属，主动释放产生的 lostpointercapture 不能再结束后继输入。
      pointerId = null;
      downPos = lastPos = downWorld = null;
      dragging = false;
      readState().game.camDragging = false;
      if (ownedPointer != null && readState().canvas.hasPointerCapture?.(ownedPointer) !== false) {
        try { readState().canvas.releasePointerCapture?.(ownedPointer); } catch { /* 指针可能已被浏览器取消 */ }
      }
      return wasDragging;
    };
    const cancelPointer = (id = pointerId) => {
      if (pointerId == null || id !== pointerId) return;
      releasePointer();
      readState().cam.cancelPan?.(true);
      pendingHover = null;
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      hoverFrame = 0;
      if (readState().game.hover) renderScheduler.invalidate();
      readState().game.hover = null;
      readState().canvas.style.cursor = 'grab';
      UI.hideTooltip();
    };
    const endPointer = (e, cancelled = false) => {
      if (e.pointerId !== pointerId) return;
      if (cancelled) { cancelPointer(e.pointerId); return; }
      if (downPos && !dragging && !cancelled && e.button === 0 && readState().game.state === 'idle') {
        const r = readState().canvas.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside) {
          // 点击意图形成于 pointerdown 那一刻（世界坐标已在 down 时锁定）；
          // 落空再用 up 位置兜底（正常点击两者一致）
          let n = downWorld ? pickNode(downWorld.x, downWorld.y, true) : null;
          if (!n) {
            const wUp = readState().cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
            n = pickNode(wUp.x, wUp.y, true);
          }
          if (n) {
            // 2026-09-19 留言 #24：点击脚下所在格 = 反复重开本格内容（离开前不锁格）
            if ((n.li === readState().game.layerIdx && n.idx === readState().game.trackPos) || isReachable(n)) {
              const preview = getExpeditionPreview(readState().game);
              if (preview?.li === n.li && preview?.idx === n.idx) confirmTarget();
              else showTarget(n);
            }
            else if (readState().game.devMode) openCellEditor(n.li, n.idx);
            else showInvalidNode(e, n);
          }
        }
      }
      if (releasePointer()) {
        readState().cam.endPan?.(() => readState().game.state === 'idle' && !readState().game.battleActive && UI.el.overlay.hidden && !document.hidden);
        scheduleHover(e);
      }
    };
    readState().canvas.addEventListener('pointerup', endPointer);
    readState().canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
    readState().canvas.addEventListener('lostpointercapture', (e) => cancelPointer(e.pointerId));
    window.addEventListener('blur', () => { cancelPointer(); readState().cam.cancelPan?.(true); });

    readState().canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    readState().canvas.addEventListener('pointerleave', () => {
      if (pointerId == null) {
        pendingHover = null;
        if (readState().game.hover) renderScheduler.invalidate();
        readState().game.hover = null;
        readState().canvas.style.cursor = 'grab';
        UI.hideTooltip();
      }
    });

    // 滚轮缩放（以光标为锚点，缩放前后光标指向的世界坐标不变）
    readState().canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const r = readState().canvas.getBoundingClientRect();
      readState().cam.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      renderScheduler.invalidate();
    }, { passive: false });

    // 键盘走动作映射层（src/input.js）：玩法读动作，键位是数据（可改键/可接手柄）
    window.addEventListener('keydown', (/** @type {KeyboardEvent & {target: Element & {isContentEditable?:boolean}}} */ e) => {
      if (e.defaultPrevented || (e.key === 'Escape' && e.repeat)) return;
      // #22 开发者控制台：战斗/对局中 Ctrl+L 开关（不走动作映射，避免与改键层耦合）
      if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'l' || e.key === 'L')) {
        // The console owns its source-page checkpoint and all four tabs share one toggle.
        e.preventDefault();
        if (!e.repeat && !e.isComposing && e.keyCode !== 229) openDevConsole();
        return;
      }
      if (e.key === 'Escape' && readState().devToolsLoading) {
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelPendingDevTools();
        return;
      }
      if (e.key === 'Escape' && readState().menuPageLoading) {
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelPendingMenuPageOpen();
        return;
      }
      if (e.key === 'Escape' && (readState().cardPageLoading || readState().baseHubLoading)) {
        // 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是关浮层
        if (e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        closeCardPageTop();
        return;
      }
      const tag = e.target && /** @type {Element} */ (e.target).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || /** @type {HTMLElement} */ (e.target)?.isContentEditable) return;
      // Native buttons own Space/Enter. Do not let map shortcuts swallow keyboard activation.
      if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('button,summary,[role="button"]')) return;
      if (!gameplayInputAllowed() && e.key !== 'Escape') return;
      const action = readState().input && readState().input.actionFor(e);
      if (!action) return;
      switch (action) {
        case 'roll': {
          e.preventDefault();
          chooseNextTarget(1);
          break;
        }
        case 'movePrev': e.preventDefault(); chooseNextTarget(-1); break;
        case 'moveConfirm': e.preventDefault(); confirmTarget(); break;
        case 'moveCancel':
          // IME Escape cancels composition before any overlay or map action.
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          // 卡牌特写浮层挂在 body（overlay 之外）：Esc 先收回特写，
          // 否则会把底下的背包/整备页一起关掉、特写残留在画面上
          {
            const zoom = document.getElementById('cardZoom');
            if (zoom) { /** @type {HTMLElement} */ (zoom.querySelector('.cz-backdrop'))?.click(); break; }
          }
          // 浮层打开时 Esc 优先关浮层（战斗页内部不受影响），否则清移动目标
          if (!UI.el.overlay.hidden && UI.closeTopOverlayByEsc()) break;
          clearTarget();
          break;
        case 'camRotateL': readState().cam.angle -= .2; renderScheduler.invalidate(); break;
        case 'camRotateR': readState().cam.angle += .2; renderScheduler.invalidate(); break;
        case 'camOverview': readState().cam.frameExploration(readState().game, true); renderScheduler.invalidate(); break;
        case 'camFocus': readState().cam.frameExploration(readState().game); renderScheduler.invalidate(); break;
        case 'backpack': showBackpack(); break;
        case 'nodeNumbers': readState().game.toggles.index = !readState().game.toggles.index; if (UI.el.tglIndex) /** @type {HTMLInputElement} */ (UI.el.tglIndex).checked = readState().game.toggles.index; renderScheduler.invalidate(); break;
      }
    });

  }
  return { bindInput };
}
