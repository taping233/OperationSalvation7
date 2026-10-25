/** The sole map frame scheduler owns clock/coverage, sampling and canvas sizing. */
export function createGameBootLoop({ readState, readRenderer, UI, frameStats, FX, MAP,
  renderScheduler, setLobby, setDpr, window, document, performance }) {
  // ---------- 主循环 ----------
  const ELAPSED_STATES = new Set(['idle', 'moving', 'modal']);
  const IDLE_LOOP_MS = 250;
  let lastT = performance.now();
  let coverTitle = null, coverExit = null;   // 标题 / 退出界面（DOMContentLoaded 时缓存）
  let wasCanvasCovered = true;
  let loopFrame = 0, idleLoopTimer = 0;
  let loopReady = false;

  function requestLoopFrame() {
    // 资源加载或 visibilitychange 可早于 DOMContentLoaded；启动完成前只保留 dirty 状态。
    if (!loopReady) return;
    // 输入法/环境守卫（nightshift U15）：测试环境拆除后 idle 链（scheduleNextLoop 的
    // 250ms setTimeout）仍会触发本函数，node 无 requestAnimationFrame 直接裸引即炸
    // unhandled 并污染同 worker 用例（批次⑥全量实锤）。与 U1/U5-a 守卫同构。
    if (typeof requestAnimationFrame !== "function") return;
    if (idleLoopTimer) {
      clearTimeout(idleLoopTimer);
      idleLoopTimer = 0;
    }
    if (loopFrame) return;
    loopFrame = requestAnimationFrame(now => {
      loopFrame = 0;
      loop(now);
    });
  }

  function scheduleNextLoop(active = false) {
    if (active) {
      requestLoopFrame();
      return;
    }
    if (loopFrame || idleLoopTimer) return;
    idleLoopTimer = setTimeout(() => {
      idleLoopTimer = 0;
      requestLoopFrame();
    }, IDLE_LOOP_MS);
  }

  renderScheduler.setWake(requestLoopFrame);
  document.addEventListener('visibilitychange', requestLoopFrame);

  function loop(now) {
    const realDt = Math.max(0, (now - lastT) / 1000);
    const dt = Math.min(0.05, realDt);
    lastT = now;
    const stats = frameStats();
    stats.loopTicks = (stats.loopTicks || 0) + 1;
    // 标题 / 退出界面盖住画布时跳过整帧渲染（省电省 GPU，回来时 dt 已钳制不会跳变）
    if ((coverTitle && !coverTitle.hidden) || (coverExit && !coverExit.hidden)) {
      wasCanvasCovered = true;
      scheduleNextLoop(false);
      return;
    }
    // 全屏不透明页（事件/节点/背包页/房间战斗）盖住画布时同样跳帧，不重绘被遮挡的画布。
    // 战斗页 room-view 已是完全不透明 #0c0c0c 全屏层（overlays.css），画布根本不可见——
    // 也并入 covered 停画（旧逻辑给战斗页留 60fps 重绘是 backdrop blur 时代的注释，已过时）。
    // 宝箱浮层（chest）底下隔着 blur(6px)，冻结与运动在模糊后无感，停画省下整幅重绘。
    const ov = UI.el.overlay;
    // 战斗页标志由 UI.showOverlay 唯一入口缓存（曾在此每帧 querySelector 全子树扫描）
    const battleBehind = !ov.hidden && !!UI._hasBattleStage;
    const covered = document.hidden || (!ov.hidden &&
      (ov.classList.contains('opaque') || ov.classList.contains('room-view') ||
       battleBehind || UI._lastMode === 'chest'));
    if (covered) wasCanvasCovered = true;
    else if (wasCanvasCovered) {
      wasCanvasCovered = false;
      renderScheduler.invalidate();
    }
    const ts = FX.timeScale || 1;
    const sdt = dt * ts;   // hit-stop 冻结世界：逻辑时间缩放，rAF 与恢复计时仍走真实时间
    // 空闲循环降到 4Hz 后，视觉时钟/游玩计时仍按真实经过时间推进；物理式插值继续用钳制 dt，
    // 避免切回前台时一次性跨过过长时间。
    const clockDt = Math.min(0.5, realDt) * ts;
    readState().game.time += clockDt;
    if (!document.hidden && ELAPSED_STATES.has(readState().game.state)) readState().game.elapsed += clockDt;
    // 同步到 body，驱动 CSS 状态样式（提示条显隐 / 掷骰按钮呼吸灯）
    if (document.body.dataset.state !== readState().game.state) document.body.dataset.state = readState().game.state;
    // 标题页无侧栏不变式（2026-09-07 留言：下边栏跑到主页反复出现）：回主页的任何路径
    // 只要漏调 setLobby(true)，下一帧在这里被强制纠正——不再依赖每个流程点自觉
    if (readState().game.state === 'title' && !document.body.classList.contains('lobby')) setLobby(true);
    // 活动态走 rAF；静态地图只保留 4Hz 状态巡检，输入/状态变化由 invalidate() 立即唤醒。
    // 这样不仅停止 Canvas DrawCall，也停止高刷屏上 144/165Hz 的空主循环 JS 唤醒。
    const active = !battleBehind && (readState().game.battleActive || readState().game.state === 'moving');
    // 路线事务由移动时钟驱动镜头；此处仅保留其他移动入口的旧追随。
    // 站立/拖拽时镜头完全归玩家：早先每帧无差别追随会把玩家拖拽的镜头拉回去，
    // 拖动观感失效（老板留言：地图无法正常拖动）。
    const followCam = readState().game.state === 'moving' && !readState().game.moveTarget?.cameraOwned && !readState().game.camDragging && readState().cam.frameMode === 'manual';
    if (followCam && readState().cam && readState().game.pos && (readState().cam.cx !== readState().game.pos.x || readState().cam.cy !== readState().game.pos.y)) {
      if (Math.abs(readState().game.pos.x - readState().cam.cx) + Math.abs(readState().game.pos.y - readState().cam.cy) > MAP.tile * 4) {
        readState().cam.cx = readState().game.pos.x; readState().cam.cy = readState().game.pos.y;
      } else {
        const k = 1 - Math.exp(-sdt * 10);
        readState().cam.cx += (readState().game.pos.x - readState().cam.cx) * k;
        readState().cam.cy += (readState().game.pos.y - readState().cam.cy) * k;
      }
      readState().cam.clamp();
    }
    // 模拟按每次 rAF 的真实 dt 更新；绘制可以降频。若只在 draw 帧更新，165 Hz 屏幕上
    // dt 会被丢掉约 2/3，镜头会变慢并呈现不均匀的追赶感。
    if (!renderScheduler.shouldDraw(now, { covered, active })) {
      scheduleNextLoop(active);
      return;
    }

    // 帧时间分桶（performance-optimization：先测量再优化）——EMA 平滑，供 perf 基准/排查读取
    const t0 = performance.now();
    try { readRenderer().draw(readState().ctx, readState().game); } catch (e) { console.error('渲染异常：', e); }
    const renderMs = performance.now() - t0;
    stats.renderMs = stats.renderMs * 0.9 + renderMs * 0.1;
    stats.updateMs = stats.updateMs * 0.9 + (dt * 1000 - renderMs > 0 ? dt * 1000 - renderMs : 0) * 0.1;
    stats.fps = stats.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1;
    scheduleNextLoop(active);
  }

  function resize() {
    // 视口口径（getBoundingClientRect 含 UiScale.zoom）：cam/事件坐标全程同口径，
    // 内部分辨率按视口尺寸 × dpr —— zoom≠1 时物理像素密度仍恒等于 dpr，不糊不费。
    const vr = readState().canvas.getBoundingClientRect();
    const cw = vr.width, ch = vr.height;
    if (!cw || !ch) return;
    const dprNow = window.devicePixelRatio || 1;
    // 尺寸与 dpr 都没变就不重设：ResizeObserver 在 canvas.width 赋值后也会触发，防止空转/递归
    if (readState().cam && readState().cam.viewW === cw && readState().cam.viewH === ch &&
        readState().canvas.width === Math.round(cw * dprNow) && readState().canvas.height === Math.round(ch * dprNow)) return;
    setDpr(dprNow);
    readState().canvas.width = Math.round(cw * readState().dpr);
    readState().canvas.height = Math.round(ch * readState().dpr);
    // 后备存储是物理像素，而 Renderer.draw 全程用 CSS 坐标；不缩放的话
    // dpr>1 的屏幕（如 150% 缩放的 Edge）只画到左上 1/dpr 区域，其余是未初始化显存（绿噪点）。
    readState().ctx.setTransform(readState().dpr, 0, 0, readState().dpr, 0, 0);
    if (readState().cam) {
      readState().cam.resize(cw, ch);
      if (readState().game.runActive && readState().cam.frameMode !== 'manual') readState().cam.frameExploration(readState().game, readState().cam.frameMode === 'overview');
    }
    renderScheduler.invalidate();
  }

  return { resize, requestLoopFrame,
    setCovers(title, exit) { coverTitle = title; coverExit = exit; },
    start() { loopReady = true; requestLoopFrame(); } };
}
