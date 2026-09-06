/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const UI = window.SDT.UI;
const SDT = window.SDT;
import { TYPE_NAME } from './game.notes.js';
import { MAP } from './game.session.js';
import { SLOT_COUNT, buildDerived, cam, canvas, configureGameRuntime, ctx, dpr, exitToTitle, game, hasRun, migrateOldSave, openSettings, quitGame, saveGame, showTitle, startNewGame, _set_dpr, _set_cam } from './game.session.js';
import { bindRunMixins, openClassChoice, openShop, roll } from './game.run.js';
import { openBaseHub } from './game.hub.js';
import { bindBagMixins, showBackpack } from './game.bag.js';
import { bindDevMode, bindNotesMixins, initDevMode, openCellEditor, rebuildNotes, showClearOverlay, showExportOverlay, showImportOverlay } from './game.notes.js';
import { cardPageOpen, closeCardPageTop, openCardDesigner, openCardLibrary } from './game.cardslib.js';
import { renderScheduler } from './render-scheduler.js';

configureGameRuntime({ openClassChoice, openBaseHub, rebuildNotes, resize: () => resize() });
  function bindInput() {
    let dragging = false, downPos = null, lastPos = null;
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
    canvas.addEventListener('mouseleave', () => { pendingHover = null; game.hover = null; UI.hideTooltip(); });

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
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const action = SDT.Input && SDT.Input.actionFor(e);
      if (!action) return;
      switch (action) {
        case 'roll': e.preventDefault(); roll(); break;
        case 'camRotateL': cam.angle -= .2; renderScheduler.invalidate(); break;
        case 'camRotateR': cam.angle += .2; renderScheduler.invalidate(); break;
        case 'camOverview': cam.cx=720; cam.cy=720; cam.zoom=1.1; renderScheduler.invalidate(); break;
        case 'camFocus': cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp(); renderScheduler.invalidate(); break;
        case 'backpack': showBackpack(); break;
        case 'nodeNumbers': game.toggles.index = !game.toggles.index; if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index; renderScheduler.invalidate(); break;
      }
    });

    UI.el.bagBtn.addEventListener('click', () => showBackpack());

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

    UI.el.rollBtn.addEventListener('click', roll);
    if (UI.el.tglIndex) UI.el.tglIndex.addEventListener('change', e => { game.toggles.index = e.target.checked; });
    if (UI.el.btnExport) UI.el.btnExport.addEventListener('click', showExportOverlay);
    if (UI.el.btnImport) UI.el.btnImport.addEventListener('click', showImportOverlay);
    if (UI.el.btnClear) UI.el.btnClear.addEventListener('click', showClearOverlay);
    initDevMode();
    bindDevMode();

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
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      game.hover = null;
      UI.hideTooltip();
      return;
    }
    canvas.style.cursor = 'crosshair';
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
    // 全屏不透明页（事件/节点/背包页/房间战斗）盖住画布时同样跳帧，不重绘被遮挡的画布
    const ov = UI.el.overlay;
    const covered = document.hidden || (!ov.hidden && !ov.querySelector('.battle-stage') && (ov.classList.contains('opaque') || ov.classList.contains('room-view')));
    const ts = (SDT.FX && SDT.FX.timeScale) || 1;
    const sdt = dt * ts;   // hit-stop 冻结世界：逻辑时间缩放，rAF 与恢复计时仍走真实时间
    game.time += sdt;
    if (ELAPSED_STATES.has(game.state)) game.elapsed += sdt;
    // 同步到 body，驱动 CSS 状态样式（提示条显隐 / 掷骰按钮呼吸灯）
    if (document.body.dataset.state !== game.state) document.body.dataset.state = game.state;
    const fxActive = SDT.FX && (SDT.FX.floats.length || SDT.FX.pulses.length || SDT.FX.shakes.length);
    // 对局内（含站立 idle：棋盘火光/结点呼吸是持续动画）一律 active 120；标题等未开局画面走 idle 60
    const active = game.runActive || game.battleActive || game.state === 'moving' || game.state === 'rolling' || !!fxActive;
    // 镜头帧率无关地平滑追随棋子（指数趋近，勿用每帧固定 0.1 的 lerp）；大距离跳变（读档/新局/切层）直接贴合
    if (cam && game.pos && (cam.cx !== game.pos.x || cam.cy !== game.pos.y)) {
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
    _set_dpr(window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    if (cam) cam.resize(canvas.clientWidth, canvas.clientHeight);
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
      document.getElementById('exitScr').hidden = true;
      showTitle();
    });
    // 预加载选档页存档卡背景图，避免首次打开时解码卡顿
    const slotBg = new Image();
    slotBg.src = new URL('../assets/slot-bg-knight-fantasy.webp', import.meta.url).href;
    document.getElementById('btnHome').addEventListener('click', exitToTitle);
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
    title.dataset.controlsBound = 'true';
  }

  // 模块脚本位于 body 末尾，此时标题 DOM 已存在。首页交互必须先于存档、
  // 画布和卡牌初始化绑定，否则任一后续启动异常都会留下“能看但不能点”的死首页。
  bindTitle();

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
    for (const [id,key] of [['sceneRotateL','q'],['sceneRotateR','e'],['sceneFocus','f'],['sceneOverview','g']]) document.getElementById(id)?.addEventListener('click',()=>window.dispatchEvent(new KeyboardEvent('keydown',{key})));
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
    requestAnimationFrame(loop);
  });

export { resize };
