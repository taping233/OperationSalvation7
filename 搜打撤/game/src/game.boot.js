/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const UI = window.SDT.UI;
const SDT = window.SDT;
import { TYPE_NAME } from './game.notes.js';
import { MAP } from './game.session.js';
import { SLOT_COUNT, buildDerived, cam, canvas, configureGameRuntime, ctx, dpr, game, hasRun, migrateOldSave, openLeaveMenu, openSettings, quitGame, saveGame, setLobby, showTitle, startNewGame, _set_dpr, _set_cam } from './game.session.js';
import { bindRunMixins, devForceBattle, devJumpNode, moveTo, openClassChoice, openShop, showRunTransition } from './game.run.js';
import { PRELOAD_SCENES } from './game.run.data.js';
import { openBaseHub } from './game.hub.js';
import { bindBagMixins, showBackpack, setBagReturnHook } from './game.bag.js';
import { configureShopRuntime } from './game.run.shop.js';
import { bindDevMode, bindNotesMixins, initDevMode, openCellEditor, rebuildNotes, showClearOverlay, showExportOverlay, showImportOverlay, syncDevVisibility } from './game.notes.js';
import { cardPageOpen, closeCardPageTop, openCardDesigner, openCardLibrary } from './game.cardslib.js';
import { renderScheduler } from './render-scheduler.js';
import { nodeHitRadius } from './camera.js';
import { renderMiniMap } from './game.session.js';

  configureGameRuntime({ openClassChoice, openBaseHub, rebuildNotes, resize: () => resize(), showRunTransition, syncDevVisibility });
  configureShopRuntime({ openBag: (onReturn) => {
    setBagReturnHook(onReturn);
    showBackpack(true);
  } });
  function bindInput() {
    let dragging = false, downPos = null, lastPos = null, pointerId = null;
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

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointerId != null) return;
      pointerId = e.pointerId;
      canvas.setPointerCapture?.(pointerId);
      downPos = lastPos = { x: e.clientX, y: e.clientY };
      dragging = false;
      game.camDragging = false;
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (downPos && e.pointerId === pointerId) {
        if (!dragging && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) dragging = true;
        game.camDragging = dragging;   // 拖拽中主循环不得抢镜头（留言：地图无法正常拖动）
        if (dragging) {
          const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y;
          cam.panBy(dx, dy);
          renderScheduler.invalidate();
          canvas.style.cursor = 'grabbing';
          UI.hideTooltip();
          lastPos = { x: e.clientX, y: e.clientY };
          return;
        }
        lastPos = { x: e.clientX, y: e.clientY };
      }
      scheduleHover(e);
    });

    const endPointer = (e, cancelled = false) => {
      if (e.pointerId !== pointerId) return;
      if (downPos && !dragging && !cancelled && e.button === 0 && game.state === 'idle') {
        const r = canvas.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside) {
          // 点击意图形成于 pointerdown 那一刻；自动镜头回中/移动会在 down→up 之间平移相机，
          // 按 up 位置反推世界坐标会点偏到别的节点或落空——节点内容不触发、变成"僵尸节点"。
          // 所以先按 down 时刻的世界坐标取节点，落空再用 up 位置兜底。
          const wDown = cam.screenToWorld(downPos.x - r.left, downPos.y - r.top);
          let n = pickNode(wDown.x, wDown.y, true);
          if (!n) {
            const wUp = cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
            n = pickNode(wUp.x, wUp.y, true);
          }
          if (n) {
            if (isReachable(n)) {
              canvas.style.cursor = 'wait';
              moveTo(n.li, n.idx);
            }
            else if (game.devMode) openCellEditor(n.li, n.idx);
            else showInvalidNode(e, n);
          }
        }
      }
      downPos = null;
      game.camDragging = false;
      canvas.releasePointerCapture?.(pointerId);
      pointerId = null;
      if (dragging) scheduleHover(e);
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', (e) => endPointer(e, true));

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerleave', () => {
      if (pointerId == null) {
        pendingHover = null;
        game.hover = null;
        canvas.style.cursor = 'grab';
        UI.hideTooltip();
      }
    });

    // 滚轮缩放（以光标为锚点，缩放前后光标指向的世界坐标不变）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      cam.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      renderScheduler.invalidate();
    }, { passive: false });

    // 键盘走动作映射层（src/input.js）：玩法读动作，键位是数据（可改键/可接手柄）
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.target?.isContentEditable) return;
      // Native buttons own Space/Enter. Do not let map shortcuts swallow keyboard activation.
      if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('button,[role="button"]')) return;
      const action = SDT.Input && SDT.Input.actionFor(e);
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
          e.preventDefault();
          // 卡牌特写浮层挂在 body（overlay 之外）：Esc 先收回特写，
          // 否则会把底下的背包/整备页一起关掉、特写残留在画面上
          {
            const zoom = document.getElementById('cardZoom');
            if (zoom) { zoom.querySelector('.cz-backdrop')?.click(); break; }
          }
          // 浮层打开时 Esc 优先关浮层（战斗页内部不受影响），否则清移动目标
          if (!UI.el.overlay.hidden && UI.closeTopOverlayByEsc()) break;
          clearTarget();
          break;
        case 'camRotateL': cam.angle -= .2; renderScheduler.invalidate(); break;
        case 'camRotateR': cam.angle += .2; renderScheduler.invalidate(); break;
        case 'camOverview': cam.frameExploration(game, true); renderScheduler.invalidate(); break;
        case 'camFocus': cam.frameExploration(game); renderScheduler.invalidate(); break;
        case 'backpack': showBackpack(); break;
        case 'nodeNumbers': game.toggles.index = !game.toggles.index; if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index; renderScheduler.invalidate(); break;
      }
    });

    UI.el.bagBtn.addEventListener('click', () => showBackpack());
    document.getElementById('routePanel')?.addEventListener('click', e => {
      const button = e.target.closest('button[data-route-index]');
      if (!button || button.disabled || game.state !== 'idle') return;
      clearTarget();
      moveTo(Number(button.dataset.routeLayer), Number(button.dataset.routeIndex));
    });
    // The sidebar is hidden during character selection; draw once it has a real size.
    if (typeof ResizeObserver !== 'undefined') {
      const mini = document.getElementById('miniMap');
      if (mini) new ResizeObserver(() => { if (game.runActive) renderMiniMap(); }).observe(mini);
    }

    // 行动日志收起开关：日志面板盖住左下地图节点，收起后只留标题条（状态持久化）
    const logPanel = document.getElementById('logPanel');
    const logToggle = document.getElementById('logToggle');
    if (logPanel && logToggle) {
      if (localStorage.getItem('sdt-log-collapsed') === '1') logPanel.classList.add('collapsed');
      logToggle.addEventListener('click', () => {
        const collapsed = logPanel.classList.toggle('collapsed');
        localStorage.setItem('sdt-log-collapsed', collapsed ? '1' : '0');
      });
    }

    // 定位按钮：与键盘 F（camFocus）同一动作——镜头立即回到棋子当前位置
    const btnLocate = document.getElementById('btnLocate');
    if (btnLocate) btnLocate.addEventListener('click', () => {
      cam.frameExploration(game); renderScheduler.invalidate();
    });
    document.getElementById('btnMapOverview')?.addEventListener('click', () => {
      cam.frameExploration(game, true); renderScheduler.invalidate();
    });

    // 右上角资源 HUD：悬停显示项目自带提示框（与地图节点同款）
    const vpEl = UI.el.viewport;
    document.querySelectorAll('#resHud .chip-mini[data-tip]').forEach(chip => {
      const show = (e) => {
        const r = vpEl.getBoundingClientRect();
        const coins = chip.querySelector('#charCoins'), atk = chip.querySelector('#charAtk');
        const line = coins ? `当前 <b>${game.coins}</b> 币` : `当前 <b>${game.atk}</b> 点 · 攻击伤害 = 卡面值 + 攻击力`;
        UI.showTooltip(e.clientX - r.left, e.clientY - r.top, chip.dataset.tip, [line]);
      };
      chip.addEventListener('mouseenter', show);
      chip.addEventListener('mousemove', show);
      chip.addEventListener('mouseleave', () => UI.hideTooltip());
    });

    if (UI.el.rollBtn) UI.el.rollBtn.addEventListener('click', () => {
      chooseNextTarget(1);
    });
    if (UI.el.tglIndex) UI.el.tglIndex.addEventListener('change', e => { game.toggles.index = e.target.checked; });
    if (UI.el.btnExport) UI.el.btnExport.addEventListener('click', showExportOverlay);
    if (UI.el.btnImport) UI.el.btnImport.addEventListener('click', showImportOverlay);
    if (UI.el.btnClear) UI.el.btnClear.addEventListener('click', showClearOverlay);
    initDevMode();
    bindDevMode();
    // 开发者一键进战斗（devTools 面板，仅 devMode 可见）
    if (UI.el.devBattle) UI.el.devBattle.addEventListener('click', () => devForceBattle(false));
    if (UI.el.devBoss) UI.el.devBoss.addEventListener('click', () => devForceBattle(true));
    // 开发者节点测试面板（标题页 #titleDev，仅 devMode 可见）：一键跳到商店/事件/BOSS 等各类节点
    if (UI.el.titleDev) UI.el.titleDev.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dev-node]');
      if (btn) devJumpNode(btn.dataset.devNode);
    });

    // 卡牌大页面：Esc 关闭 / 点击深色背景关闭
    // （用 click 而非 mousedown 关背景，保证关闭前 mouseup 仍处于 modal 态，不会误触格子编辑）
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cardPageOpen && !UI.el.overlay.hidden) closeCardPageTop();
    });
    UI.el.overlay.addEventListener('click', (e) => {
      if (e.target === UI.el.overlay && cardPageOpen) closeCardPageTop();
    });
  }

  // 结点命中：以屏幕像素为稳定目标尺寸，并优先当前节点的合法邻居。
  const MIN_NODE_HIT_PX = 28;
  const reachableCache = { nodes: null, layerData: null, layerIdx: -1, trackPos: -1, next: null, result: [] };
  function reachableNodes() {
    const current = game.layerData[game.layerIdx]?.logical[game.trackPos];
    const next = current?.next || [];
    if (reachableCache.nodes === game.nodes && reachableCache.layerData === game.layerData &&
        reachableCache.layerIdx === game.layerIdx && reachableCache.trackPos === game.trackPos &&
        reachableCache.next === next) return reachableCache.result;
    const result = [];
    for (const [li, idx] of next) {
      const node = game.nodes.find(n => n.li === li && n.idx === idx);
      if (node && li === game.layerIdx) result.push(node);
    }
    Object.assign(reachableCache, {
      nodes: game.nodes, layerData: game.layerData, layerIdx: game.layerIdx,
      trackPos: game.trackPos, next, result,
    });
    return result;
  }

  function isReachable(n) {
    return reachableNodes().some(q => q.li === n.li && q.idx === n.idx);
  }

  function pickNode(wx, wy, preferReachable = false) {
    const legal = reachableNodes();
    const fogOn = game.seen && Object.keys(game.seen).length > 0;
    let best = null, bd = Infinity, bestLegal = false;
    for (const n of game.nodes) {
      if (n.li !== game.layerIdx) continue;
      // 迷雾外的节点不可选中：不可点击、无 tooltip（2026-09-09 老板：只见走过的和相邻的）
      if (fogOn && !game.seen[n.li + ',' + n.idx]) continue;
      const d = Math.hypot(n.x - wx, n.y - wy);
      const radius = nodeHitRadius(cam.zoom, MIN_NODE_HIT_PX);
      const nLegal = legal.some(q => q.li === n.li && q.idx === n.idx);
      if (d <= radius && ((preferReachable && nLegal && !bestLegal) || nLegal === bestLegal && d < bd)) {
        bd = d; best = n; bestLegal = nLegal;
      }
    }
    return best;
  }

  function clearTarget() {
    game.moveTarget = null;
    if (game.hover && !isReachable(game.hover)) game.hover = null;
    UI.hideTooltip();
    UI.refresh(game);
    renderScheduler.invalidate();
  }

  function showTarget(n) {
    if (!n) return;
    game.moveTarget = { li: n.li, idx: n.idx };
    game.hover = n;
    UI.refresh(game);
    const r = canvas.getBoundingClientRect();
    const p = cam.worldToScreen ? cam.worldToScreen(n.x, n.y) : { x: r.width / 2, y: r.height / 2 };
    UI.showTooltip(p.x, p.y, `${hoverInfo(n)[0]} · 可前往`, ['按 X 确认，Space/Enter 选择下一个，Z 返回上一个']);
    renderScheduler.invalidate();
  }

  function chooseNextTarget(step = 1) {
    if (game.state !== 'idle') return false;
    const options = reachableNodes();
    if (!options.length) { UI.log('当前节点没有可前往的相邻节点', 'warn'); return false; }
    if (options.length === 1) { clearTarget(); return moveTo(options[0].li, options[0].idx); }
    const key = game.moveTarget && `${game.moveTarget.li},${game.moveTarget.idx}`;
    const at = Math.max(0, options.findIndex(n => `${n.li},${n.idx}` === key));
    showTarget(options[(at + step + options.length) % options.length]);
    return true;
  }

  function confirmTarget() {
    const target = game.moveTarget;
    if (!target) return chooseNextTarget(1);
    clearTarget();
    return moveTo(target.li, target.idx);
  }

  function showInvalidNode(e, n) {
    const r = canvas.getBoundingClientRect();
    UI.showTooltip(e.clientX - r.left, e.clientY - r.top, `${hoverInfo(n)[0]} · 暂不可达`, ['只能前往当前节点相邻的下一节点']);
    UI.log('该节点不是当前节点的相邻路径，无法直接跳转', 'warn');
  }

  function updateHover(e) {
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      game.hover = null;
      UI.hideTooltip();
      return;
    }
    const w = cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
    const n = pickNode(w.x, w.y, true);
    const legal = !!n && game.state === 'idle' && isReachable(n);
    canvas.style.cursor = legal ? 'pointer' : n ? (game.devMode ? 'cell' : 'not-allowed') : 'grab';
    if (n !== game.hover) SDT.Sound.sfx('hover');   // 悬停结点变化时轻提示一声
    game.hover = n;
    if (!n) { UI.hideTooltip(); return; }
    UI.showTooltip(e.clientX - r.left, e.clientY - r.top, ...hoverInfo(n));
  }

  function hoverInfo(node) {
    const lines = [];
    let title;
    if (node.li >= 0) {
      const loc = { layer: game.layerData[node.li], idx: node.idx };
      title = `${loc.layer.name} · #${loc.idx}`;
      const def = node.def;
      const door = (loc.layer.doors || []).find(d => d.at === loc.idx);
      const altarE = (loc.layer.altarEntrances || []).find(a => a.at === loc.idx);
      const eIdx = (loc.layer.entrances || []).indexOf(loc.idx);
      if (eIdx >= 0) lines.push(`[[icon:door]] 出生入口：${loc.layer.entranceNames[eIdx]}`);
      if (door) lines.push(`[[icon:door]] 环间门${door.reverse ? '（返回）' : ''}${door.exit ? ' / 撤离出口' : ''} ⇄ ${game.layerData[door.toLayer]?.name || '下一层'}`);
      if (altarE) lines.push('[[icon:crystal]] 污染核心入口');
      if (def && def.type !== 'entrance') lines.push(`事件：${TYPE_NAME[def.type] || def.type}${def.n ? `（+${def.n}币）` : ''}`);
      else if (eIdx < 0 && !door && !altarE) lines.push('普通格');
    } else {
      title = node.def.name || '中央区';
      if (node.def.type === 'boss') lines.push('经由污染核心挑战（M1 实装战斗）');
      if (node.def.type === 'altar') lines.push('BOSS 巢穴入口');
    }
    const note = SDT.Notes.get(MAP.boardId, node.li, node.idx);
    if (note) lines.push(`[[icon:notes]] ${note}`);
    lines.push('点击结点可编辑备注');
    return [title, lines];
  }

  // ---------- 主循环 ----------
  const ELAPSED_STATES = new Set(['idle', 'rolling', 'moving', 'modal']);
  let lastT = performance.now();
  let coverTitle = null, coverExit = null;   // 标题 / 退出界面（DOMContentLoaded 时缓存）
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // 标题 / 退出界面盖住画布时跳过整帧渲染（省电省 GPU，回来时 dt 已钳制不会跳变）
    if ((coverTitle && !coverTitle.hidden) || (coverExit && !coverExit.hidden)) return;
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
    const ts = (SDT.FX && SDT.FX.timeScale) || 1;
    const sdt = dt * ts;   // hit-stop 冻结世界：逻辑时间缩放，rAF 与恢复计时仍走真实时间
    game.time += sdt;
    if (ELAPSED_STATES.has(game.state)) game.elapsed += sdt;
    // 同步到 body，驱动 CSS 状态样式（提示条显隐 / 掷骰按钮呼吸灯）
    if (document.body.dataset.state !== game.state) document.body.dataset.state = game.state;
    // 标题页无侧栏不变式（2026-09-07 留言：下边栏跑到主页反复出现）：回主页的任何路径
    // 只要漏调 setLobby(true)，下一帧在这里被强制纠正——不再依赖每个流程点自觉
    if (game.state === 'title' && !document.body.classList.contains('lobby')) setLobby(true);
    // 帧率分两档（功耗权衡）：active 120 只留给快节奏状态（掷骰/移动/战斗——
    // 帧率拉满才不掉帧感）；对局站立 idle 的棋盘动画全是慢速环境效果（呼吸/火光/流光
    // 均为 1Hz 量级正弦），60fps 与 120fps 观感无差，功耗直接减半。拖拽/缩放等输入
    // 走 renderScheduler.invalidate() 逐事件触发绘制，不受降档影响。标题等未开局画面
    // 同样 idle 60；战斗页盖在画布上时（自绘场景大图基本不透明，画布只从边缝透出）
    // 也降到 idle 60：底图隔着重度 blur(6px) 无人能分辨帧率，省下的余量让给战斗页动画。
    const active = !battleBehind && (game.battleActive || game.state === 'moving' || game.state === 'rolling');
    // 镜头平滑追随仅在棋子移动中生效（指数趋近，帧率无关；大距离跳变直接贴合）。
    // 站立/拖拽时镜头完全归玩家：早先每帧无差别追随会把玩家拖拽的镜头拉回去，
    // 拖动观感失效（老板留言：地图无法正常拖动）。
    const followCam = game.state === 'moving' && !game.camDragging && cam.frameMode === 'manual';
    if (followCam && cam && game.pos && (cam.cx !== game.pos.x || cam.cy !== game.pos.y)) {
      if (Math.abs(game.pos.x - cam.cx) + Math.abs(game.pos.y - cam.cy) > MAP.tile * 4) {
        cam.cx = game.pos.x; cam.cy = game.pos.y;
      } else {
        const k = 1 - Math.exp(-sdt * 10);
        cam.cx += (game.pos.x - cam.cx) * k;
        cam.cy += (game.pos.y - cam.cy) * k;
      }
      cam.clamp();
    }
    // 模拟按每次 rAF 的真实 dt 更新；绘制可以降频。若只在 draw 帧更新，165 Hz 屏幕上
    // dt 会被丢掉约 2/3，镜头会变慢并呈现不均匀的追赶感。
    if (!renderScheduler.shouldDraw(now, { covered, active })) return;

    // 帧时间分桶（performance-optimization：先测量再优化）——EMA 平滑，供 perf 基准/排查读取
    const t0 = performance.now();
    try { SDT.Renderer.draw(ctx, game); } catch (e) { console.error('渲染异常：', e); }
    const renderMs = performance.now() - t0;
    const stats = SDT.__frameStats || (SDT.__frameStats = { updateMs: 0, renderMs: 0, fps: 0 });
    stats.renderMs = stats.renderMs * 0.9 + renderMs * 0.1;
    stats.updateMs = stats.updateMs * 0.9 + (dt * 1000 - renderMs > 0 ? dt * 1000 - renderMs : 0) * 0.1;
    stats.fps = stats.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1;
    UI.refreshTime(game);
  }

  function resize() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    const dprNow = window.devicePixelRatio || 1;
    // 尺寸与 dpr 都没变就不重设：ResizeObserver 在 canvas.width 赋值后也会触发，防止空转/递归
    if (cam && cam.viewW === cw && cam.viewH === ch &&
        canvas.width === Math.round(cw * dprNow) && canvas.height === Math.round(ch * dprNow)) return;
    _set_dpr(dprNow);
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    // 后备存储是物理像素，而 Renderer.draw 全程用 CSS 坐标；不缩放的话
    // dpr>1 的屏幕（如 150% 缩放的 Edge）只画到左上 1/dpr 区域，其余是未初始化显存（绿噪点）。
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cam) {
      cam.resize(cw, ch);
      if (game.runActive && cam.frameMode !== 'manual') cam.frameExploration(game, cam.frameMode === 'overview');
    }
    renderScheduler.invalidate();
  }

  // ---------- 标题界面按钮绑定 ----------
  let titleControlsBound = false;
  function bindTitle() {
    if (titleControlsBound) return;
    titleControlsBound = true;
    const title = document.getElementById('title');
    document.getElementById('mStart').addEventListener('click', startNewGame);
    document.getElementById('mSettings').addEventListener('click', openSettings);
    document.getElementById('btnCardLib').addEventListener('click', openCardLibrary);
    document.getElementById('btnCardDesigner').addEventListener('click', () => openCardDesigner(null));
    document.getElementById('mBack').addEventListener('click', () => {
      // 告别屏淡出 + 标题页淡入都由 showTitle 内部的屏幕过渡处理（交叉淡切）
      showTitle();
    });
    // 预加载选档页存档卡背景图，避免首次打开时解码卡顿
    const slotBg = new Image();
    slotBg.src = new URL('../assets/slot-bg-knight-fantasy.webp', import.meta.url).href;
    // btnHome 打开「离开对局」三选弹窗（保存 / 放弃 / 继续）——
    // 此前绑定 exitToTitle 导致 openLeaveMenu 成死代码、放弃对局无入口（2026-09-19 交互走查 B1）
    document.getElementById('btnHome').addEventListener('click', openLeaveMenu);
    // 音效/背景乐开关（持久化在 sound.js）
    const btnMute = document.getElementById('btnMute');
    if (btnMute) {
      const syncMute = () => { btnMute.classList.toggle('muted', !!SDT.Sound.muted); };
      btnMute.addEventListener('click', () => {
        SDT.Sound.setMuted(!SDT.Sound.muted);
        syncMute();
      });
      syncMute();
    }
    window.addEventListener('beforeunload', saveGame);
    // 战斗内周期性落盘（2026-09-09 试玩反馈：战斗中刷新丢整场进度）——battle.core 在
    // 动作队列清空/回合开始时调用，把战斗快照写进对局存档（读档由 Battle.restore 续打）
    game.persistSave = saveGame;
    title.dataset.controlsBound = 'true';
  }

  // 模块脚本位于 body 末尾，此时标题 DOM 已存在。首页交互必须先于存档、
  // 画布和卡牌初始化绑定，否则任一后续启动异常都会留下“能看但不能点”的死首页。
  bindTitle();

  // ---------- 后台冻结兜底（2026-09-19 交互走查 B3） ----------
  // 后台标签/最小化窗口时 document 时间线冻结，纯 CSS 入场动画（首帧 opacity:0，
  // 如宝箱 chestFlyIn / 弹层入场）会停在透明态，浮层看似黑屏死机——WAAPI 已有
  // animateSafe 兜底（battle.view.js），CSS 动画补这里：回到前台时把 overlay 与
  // body 直挂浮层（cardZoom/legendGet/cardGet）内的动画跳到终态。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    [document.getElementById('overlay'), document.body].forEach(root => {
      if (!root || !root.getAnimations) return;
      root.getAnimations().forEach(a => {
        try {
          if (a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity) return;   // 雪花等循环动画不碰
          a.finish();
        } catch (e) { /* 已被移除/尚未开始的动画 finish 会抛，忽略 */ }
      });
    });
  });

// ---------- 启动 ----------
  window.addEventListener('DOMContentLoaded', () => {
    fetch('version.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(manifest => {
        const el = document.getElementById('gameVersion');
        if (/^\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
          if (el) el.textContent = `v${manifest.version}`;
          const hex = document.getElementById('akVerHex');
          if (hex) hex.textContent = `v${manifest.version}`;
          document.title = `升格会的冬日猜想 v${manifest.version}`;
        }
      })
      .catch(error => console.warn('无法读取游戏版本：', error));
    // 全部模块求值完成后才绑定跨文件 mixin（循环导入下各模块体不能在顶层读 game）
    bindRunMixins();
    bindBagMixins();
    bindNotesMixins();
    // 跨拆分文件的调试入口汇总（原 game.js 单文件时靠函数提升）
    Object.assign(game.debug, { openShop, showBackpack, openCardDesigner, openCardLibrary, openBase: openBaseHub });
    UI.init();
    // 应用设置里持久化的界面开关（提示条 / 环层横幅）
    document.body.classList.toggle('no-hintbar', localStorage.getItem('sdt-hintbar') === '0');
    document.body.classList.toggle('no-banner', localStorage.getItem('sdt-banner') === '0');
    coverTitle = document.getElementById('title');
    coverExit = document.getElementById('exitScr');
    resize();
    // 进入对局后底部栏/日志面板会挤压 canvas（窗口尺寸不变），window resize 感知不到；
    // 用 ResizeObserver 盯住 canvas 实际尺寸，配合上面的无变化短路防止递归
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => resize()).observe(canvas);
    }
    window.addEventListener('resize', resize);
    _set_cam(new SDT.Camera(MAP, canvas.clientWidth || 800, canvas.clientHeight || 600));
    game.cam = cam;

    buildDerived();
    rebuildNotes();

    const bw = MAP.cols * MAP.tile, bh = MAP.rows * MAP.tile;
    // 一屏最多看到地图约一半（对角留白），玩家可滚轮缩放 / 拖拽浏览
    cam.zoom = 1.1;
    cam.cx = bw / 2; cam.cy = bh / 2;
    cam.clamp();

    bindInput();
    // 镜头快捷键按钮（旋转/定位/全景）已按 2026-09-06 留言删除，键盘 Q/E/F/G 仍可用
    const quality=document.getElementById('sceneQuality');
    if(quality){if(SDT.Renderer.metrics)quality.value=SDT.Renderer.metrics.quality;quality.addEventListener('change',()=>SDT.Renderer.setQuality?.(quality.value));}
    document.getElementById('sceneFps')?.addEventListener('change',e=>{renderScheduler.activeInterval=1000/Number(e.target.value);renderScheduler.invalidate();});
  SDT.Cards.ensureStarters();    // 补入初始牌（缺失时）
  SDT.Cards.ensureSha();         // 播入初始牌「初始攻击」（只播一次）
  SDT.Cards.ensureTabletop();    // 播入桌游手绘道具卡（只播一次）
  SDT.Cards.ensureDmgTypes();    // 伤害类型词条回填（只补缺失值，不覆盖玩家标注）
  SDT.Cards.ensureEffectFields(); // 抽卡/注能词条回填（只补缺失值，不覆盖玩家标注）
    migrateOldSave();     // 旧版单档对局存档 → 迁入档位 1
    {                     // 旧版全局基地 → 迁入已有对局存档的档位（没有则给档位 1）
      const existing = [];
      for (let i = 1; i <= SLOT_COUNT; i++) if (hasRun(i)) existing.push(i);
      SDT.Base.migrateLegacy(existing);
    }
    rebuildNotes();
    showTitle();          // 开机进入《代号7》标题界面
    // 空闲预热基地壁纸（376KB webp）：老板高频进基地，首次进入时不再付解码卡帧
    const warmHubWallpaper = () => {
      const im = new Image();
      im.decoding = 'async';
      im.src = new URL('../assets/scenes/hub-wallpaper.webp', import.meta.url).href;
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warmHubWallpaper, { timeout: 4000 });
    else setTimeout(warmHubWallpaper, 2000);
    // 全量美术预热（2026-09-08 老板：启动时强制进行，首页显示原因与进度；
    // 2026-09-13 老板：扩大到全部美术资源，立绘/序列帧/场景/卡面/图标全覆盖）：
    // 节点+战斗场景图 → 敌人/角色立绘 → 清单全量（序列帧/剪裁图等，vite 构建期扫描
    // 生成 art-manifest.js）→ 卡面 → 图标，分小批拉进内存并预解码，进度条走完后
    // 牌库/战斗/开箱的 <img> 零首帧请求与解码延迟。解码离主线程，批次间隔让出
    // 主线程，标题页交互不掉帧。
    const warmupTip = document.getElementById('warmupTip');
    const warmupBar = document.getElementById('warmupBar');
    const warmupNum = document.getElementById('warmupNum');
    const urls = [
      ...Object.values(PRELOAD_SCENES),
      ...SDT.Art.collectCardAssets(SDT.Cards.all()),
      ...SDT.Art.collectManifestAssets(),
      ...SDT.Icons.urls(),
    ];
    // CSS 背景图补热（战斗背景/事件/宝箱/远征等全场大图，走 Vite 哈希管线）：
    // CSSOM 里只有相对路径，需按所在样式表 href 解析成绝对 URL。主清单热完后的
    // 空闲期再跑，不和上面的优先队列抢带宽。
    const warmCssBackdropArt = () => {
      const found = new Set();
      const walkRules = (rules, base) => {
        for (const rule of rules || []) {
          if (rule.cssRules) walkRules(rule.cssRules, base);
          const text = rule.cssText || '';
          if (!text.includes('url(')) continue;
          const re = /url\((['"]?)([^'")]+)\1\)/gi;
          let m;
          while ((m = re.exec(text))) {
            const raw = m[2];
            if (!raw || raw.startsWith('data:')) continue;
            if (!/\.(webp|png|jpe?g|gif|svg)([?#]|$)/i.test(raw)) continue;
            try { found.add(new URL(raw, base).href); } catch (_) { /* 相对路径解析失败就跳过 */ }
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try { walkRules(sheet.cssRules, sheet.href || location.href); } catch (_) { /* 读不了规则的样式表跳过 */ }
      }
      // CSS 背景图的解码位图不钉进预热池（retain:false）：CSS background 走浏览器
      // 自带缓存，JS 持引用帮不到渲染，只会把 75 张大场景图的位图白占在内存里。
      if (found.size) { try { SDT.Art.warm(Array.from(found), { retain: false }); } catch (_) {} }
    };
    const scheduleCssWarm = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(warmCssBackdropArt, { timeout: 8000 });
      else setTimeout(warmCssBackdropArt, 4000);
    };
    if (warmupTip && urls.length) {
      warmupTip.hidden = false;
      SDT.Art.warmBatched(urls, (done, total) => {
        if (warmupNum) warmupNum.textContent = `${done}/${total}`;
        if (warmupBar) warmupBar.style.width = `${Math.round(done / total * 100)}%`;
        if (done >= total) setTimeout(() => {
          warmupTip.classList.add('done');
          setTimeout(() => { warmupTip.hidden = true; }, 600);
        }, 350);
      }).then(scheduleCssWarm).catch(scheduleCssWarm);
    } else {
      try { SDT.Art.warmBatched(urls).then(scheduleCssWarm).catch(scheduleCssWarm); } catch (_) { scheduleCssWarm(); }
    }
    requestAnimationFrame(loop);
  });

export { resize };
