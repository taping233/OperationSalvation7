  function bindInput() {
    let dragging = false, downPos = null, lastPos = null;

    canvas.addEventListener('mousedown', (e) => {
      downPos = lastPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (downPos) {
        if (!dragging && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) dragging = true;
        if (dragging) {
          const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y;
          cam.panBy(dx, dy);
          canvas.style.cursor = 'grabbing';
          UI.hideTooltip();
          lastPos = { x: e.clientX, y: e.clientY };
          return;
        }
        lastPos = { x: e.clientX, y: e.clientY };
      }
      updateHover(e);
    });

    window.addEventListener('mouseup', (e) => {
      if (downPos && !dragging && e.button === 0 && game.state === 'idle') {
        const r = canvas.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right &&
                       e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside) {
          const w = cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
          const n = pickNode(w.x, w.y);
          if (n) openCellEditor(n.li, n.idx);
        }
      }
      downPos = null;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mouseleave', () => { game.hover = null; UI.hideTooltip(); });

    // 滚轮缩放（以光标为锚点，缩放前后光标指向的世界坐标不变）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      cam.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); roll(); }
      else if (e.key === 'b' || e.key === 'B') showBackpack();
      else if (e.key === 'f' || e.key === 'F') {
        cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp();
      }
      else if (e.key === 'n' || e.key === 'N') { game.toggles.index = !game.toggles.index; if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index; }
    });

    UI.el.bagBtn.addEventListener('click', () => showBackpack());

    UI.el.rollBtn.addEventListener('click', roll);
    if (UI.el.tglIndex) UI.el.tglIndex.addEventListener('change', e => { game.toggles.index = e.target.checked; });
    if (UI.el.btnExport) UI.el.btnExport.addEventListener('click', showExportOverlay);
    if (UI.el.btnImport) UI.el.btnImport.addEventListener('click', showImportOverlay);
    if (UI.el.btnClear) UI.el.btnClear.addEventListener('click', showClearOverlay);
    initDevMode();
    bindDevMode();

    // 已发现门/祭坛的快捷前往
    UI.el.stairsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-godoor],[data-goaltar]');
      if (!btn || game.state !== 'idle') return;
      if (btn.dataset.godoor) {
        const door = (curLayer().doors || []).find(d => d.pair === btn.dataset.godoor);
        if (!door) return;
        UI.log(`穿过环间门 → <b>${MAP.layers[door.toLayer].name}</b>`, 'sys');
        enterLayer(door.toLayer, door.arriveAt);
      } else {
        const ae = (curLayer().altarEntrances || []).find(a => a.pair === btn.dataset.goaltar);
        if (!ae) return;
        game.altarFrom = { li: game.layerIdx, idx: game.trackPos, pair: ae.pair };
        game.pos = { ...game.centerPos[0] };   // 中央祭坛结点
        UI.log('踏入<b>祭坛</b>……', 'sys');
        openAltarModal();
      }
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

  // 结点命中：世界坐标附近最近结点（阈值内才算中）
  const NODE_HIT_R = 34;
  function pickNode(wx, wy) {
    let best = null, bd = 1e9;
    for (const n of game.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < bd) { bd = d; best = n; }
    }
    return bd <= NODE_HIT_R ? best : null;
  }

  function updateHover(e) {
    canvas.style.cursor = 'crosshair';
    const r = canvas.getBoundingClientRect();
    const w = cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
    const n = pickNode(w.x, w.y);
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
      if (door) lines.push(`[[icon:door]] 环间门${door.reverse ? '（返回）' : ''}${door.exit ? ' / 撤离出口' : ''} ⇄ ${MAP.layers[door.toLayer].name}`);
      if (altarE) lines.push('[[icon:crystal]] 祭坛入口');
      if (def && def.type !== 'entrance') lines.push(`事件：${TYPE_NAME[def.type] || def.type}${def.n ? `（+${def.n}币）` : ''}`);
      else if (eIdx < 0 && !door && !altarE) lines.push('普通格');
    } else {
      title = node.def.name || '中央区';
      if (node.def.type === 'boss') lines.push('经由祭坛挑战（M1 实装战斗）');
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
    game.time += dt;
    if (ELAPSED_STATES.has(game.state)) game.elapsed += dt;
    // 移动时镜头平滑跟随棋子
    if (game.state === 'moving') {
      const k = Math.min(1, dt * 5);
      cam.cx += (game.pos.x - cam.cx) * k;
      cam.cy += (game.pos.y - cam.cy) * k;
      cam.clamp();
    }
    // 同步到 body，驱动 CSS 状态样式（提示条显隐 / 掷骰按钮呼吸灯）
    if (document.body.dataset.state !== game.state) document.body.dataset.state = game.state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { SDT.Renderer.draw(ctx, game); } catch (e) { console.error('渲染异常：', e); }
    UI.refreshTime(game);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    if (cam) cam.resize(canvas.clientWidth, canvas.clientHeight);
  }

  // ---------- 标题界面按钮绑定 ----------
  function bindTitle() {
    document.getElementById('mStart').addEventListener('click', startNewGame);
    document.getElementById('mSettings').addEventListener('click', openSettings);
    document.getElementById('mExit').addEventListener('click', quitGame);
    document.getElementById('mBack').addEventListener('click', () => {
      document.getElementById('exitScr').hidden = true;
      showTitle();
    });
    UI.el.btnHome.addEventListener('click', exitToTitle);
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
  }

    // 跨拆分文件的调试入口汇总（原 game.js 单文件时靠函数提升，现放到全部模块加载后执行）
  Object.assign(game.debug, { openShop, showBackpack, openCardDesigner, openCardLibrary, openBase: openBaseHub });

// ---------- 启动 ----------
  window.addEventListener('DOMContentLoaded', () => {
    UI.init();
    coverTitle = document.getElementById('title');
    coverExit = document.getElementById('exitScr');
    resize();
    cam = new SDT.Camera(MAP, canvas.clientWidth || 800, canvas.clientHeight || 600);
    game.cam = cam;

    buildDerived();
    rebuildNotes();

    const bw = MAP.cols * MAP.tile, bh = MAP.rows * MAP.tile;
    // 一屏最多看到地图约一半（对角留白），玩家可滚轮缩放 / 拖拽浏览
    cam.zoom = Math.min(2.4, Math.max(1.0, cam.viewW / (bw * 0.55), cam.viewH / (bh * 0.55)));
    cam.cx = bw / 2; cam.cy = bh / 2;
    cam.clamp();

    bindInput();
    bindTitle();
  SDT.Cards.ensureStarters();    // 补入初始牌（缺失时）
  SDT.Cards.ensureSha();         // 播入初始牌「杀」（只播一次）
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
    requestAnimationFrame(loop);
  });
