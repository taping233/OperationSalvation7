import { createGameBootInput } from './core/game-boot-input.js';
import { createGameMapSelection } from './core/game-map-selection.js';
import { createGameBootLoop } from './core/game-boot-loop.js';
import { createGameMapControls } from './ui/game-map-controls.js';
import { createGameTitleController } from './ui/game-title-controller.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const UI = window.SDT.UI;
const SDT = window.SDT;
import { TYPE_NAME } from './hub/game.notes.js';
import { menuPageLoading, cancelPendingMenuPageOpen, preloadMenuPages } from './ui/game.menu.js';
import { MAP } from './run/game.session.js';
import { FX } from './core/renderer.fx.js';
import { SLOT_COUNT, buildDerived, cam, canvas, configureGameRuntime, ctx, dpr, game, hasRun, migrateOldSave, openLeaveMenu, openSettings, openTitleGuide, saveGame, setLobby, showTitle, startNewGame, saveSession, _set_dpr, _set_cam } from './run/game.session.js';
import { bindRunMixins, devForceBattle, devJumpNode, moveTo, openDevConsole, reenterCell, openClassChoice, openShop, showRunTransition, resumeChestsOnCell, resumeEventCardChoice } from './run/game.run.js';
import { entrySupplyGate } from './run/node-reward-state.js';
import { devToolsLoading, cancelPendingDevTools } from './run/game.run.dev-loader.js';
import { PRELOAD_SCENES } from './run/game.run.data.js';
import { resumeExtraction } from './run/game.run.altar.js';
import { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS } from './core/performance-budgets.js';
import { planStartupArtPreload } from './core/art-preload-plan.js';
import { openBaseHub, preloadBaseHub, baseHubLoading } from './hub/game.hub.js';
import { bindBagMixins, resumeBattleRewards, showBackpack, showBackpackSection, setBagReturnHook } from './hub/game.bag.js';
import { configureShopRuntime } from './run/game.run.shop.js';
import { bindNotesMixins, initDevMode, openCellEditor, rebuildNotes, showClearOverlay, showExportOverlay, showImportOverlay, syncDevVisibility } from './hub/game.notes.js';
import { cardPageOpen, cardPageLoading, closeCardPageTop, openCardDesigner, openCardLibrary, preloadCardLibrary } from './hub/game.cardslib.js';
import { renderScheduler } from './core/render-scheduler.js';
import { storeGet, storeSet } from './core/storage.js';
import { renderMiniMap } from './run/game.session.js';
import { getExpeditionPreview, setExpeditionPreview } from './run/expedition.view.js';
import './agent/agent.js';   // SDT.Agent 接口链（observe/act/step）：随启动挂载，供外部决策端驱动
import './ui/quick-nav.js';  // 全页面快捷进入键（Alt+数字系，非法状态拒绝并提示）
import { createGameCanvas } from './run/game.session.browser.js';

  configureGameRuntime({
    ...createGameCanvas(document),
    log: (message, kind) => UI.log(message, kind),
    openClassChoice, openBaseHub, preloadBaseHub, rebuildNotes, resize: () => resize(), showRunTransition, syncDevVisibility, resumeExtraction, resumeChestsOnCell, resumeBattleRewards, resumeEventCardChoice,
  });
  configureShopRuntime({ openBag: (onReturn) => {
    setBagReturnHook(onReturn);
    showBackpack(true);
  } });
  const readBootState = () => ({ game, cam, canvas, ctx, dpr, input: SDT.Input,
    devToolsLoading, menuPageLoading, cardPageOpen, cardPageLoading, baseHubLoading });
  const readBootServices = () => ({ renderer: SDT.Renderer, sound: SDT.Sound, notes: SDT.Notes });
  const selection = createGameMapSelection({ readState: readBootState, readServices: readBootServices, UI, MAP, TYPE_NAME,
    renderScheduler, getExpeditionPreview, setExpeditionPreview, moveTo, reenterCell,
    entrySupplyGate });
  const { resize, setCovers, start: startLoop } = createGameBootLoop({
    readState: readBootState, readRenderer: () => SDT.Renderer, UI,
    frameStats: () => SDT.__frameStats || (SDT.__frameStats = { updateMs: 0, renderMs: 0, fps: 0, loopTicks: 0 }),
    FX, MAP, renderScheduler, setLobby, setDpr: _set_dpr, window, document, performance });
  const { bindInput } = createGameBootInput({ readState: readBootState, UI, window,
    document, renderScheduler, ...selection, getExpeditionPreview, openCellEditor,
    openDevConsole, cancelPendingDevTools, cancelPendingMenuPageOpen, closeCardPageTop, showBackpack });
  const { bindControls } = createGameMapControls({ readState: readBootState, UI, window,
    document, renderScheduler, ...selection, showBackpackSection, renderMiniMap,
    storeGet, storeSet, showExportOverlay, showImportOverlay, showClearOverlay,
    initDevMode, devForceBattle, devJumpNode, closeCardPageTop });
  const { bindTitle, bindVisibilityRecovery, observeNativeTitles } = createGameTitleController({
    readState: readBootState, readSound: () => SDT.Sound, UI, document, window,
    startNewGame, openSettings, openCardLibrary, showTitle, openLeaveMenu,
    openTitleGuide, saveSession: () => saveSession(), saveGame,
    slotBackgroundUrl: new URL('../assets/slot-bg-knight-fantasy.webp', import.meta.url).href });

  // Bind the existing title before storage, canvas and card initialization can fail.
  bindTitle();
  bindVisibilityRecovery();

  window.addEventListener('DOMContentLoaded', async () => {
    observeNativeTitles();
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
    document.body.classList.toggle('no-hintbar', storeGet('sdt-hintbar') === '0');
    document.body.classList.toggle('no-banner', storeGet('sdt-banner') === '0');
    setCovers(document.getElementById('title'), document.getElementById('exitScr'));
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
    bindControls();
    // 镜头快捷键按钮（旋转/定位/全景）已按 2026-09-06 留言删除，键盘 Q/E/F/G 仍可用
    const quality=document.getElementById('sceneQuality');
    if(quality){if(SDT.Renderer.metrics)/** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (quality).value=SDT.Renderer.metrics.quality;quality.addEventListener('change',()=>SDT.Renderer.setQuality?.(/** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (quality).value));}
    // sceneFps 死监听删除（迭代评审 09-20 D-P3）：该元素在 index.html/ui.js 中均不存在，
    // 且直改 activeInterval 绕过封装无校验；若将来恢复节奏档，走战斗设置 2× 档（battle.pace.js）
  SDT.Cards.ensureStarters();    // 补入初始牌（缺失时）
  SDT.Cards.ensureSha();         // 播入初始牌「初始攻击」（只播一次）
  SDT.Cards.ensureTabletop();    // 播入桌游手绘道具卡（只播一次）
  SDT.Cards.ensureDmgTypes();    // 伤害类型词条回填（只补缺失值，不覆盖玩家标注）
  SDT.Cards.ensureEffectFields(); // 抽卡/注能词条回填（只补缺失值，不覆盖玩家标注）
    migrateOldSave();     // 旧版单档对局存档 → 迁入档位 1
    {                     // 旧版全局基地 → 迁入已有对局存档的档位（没有则给档位 1）
      const existing = [];
      for (let i = 1; i <= SLOT_COUNT; i++) if (hasRun(i)) existing.push(i);
      let migrated;
      try { migrated = await SDT.Base.migrateLegacy(existing); }
      catch { migrated = false; }
      if (migrated === false) UI.log('旧版基地迁移未保存，原数据已保留；请检查存储后重新进入。', 'warn');
    }
    rebuildNotes();
    showTitle();          // 开机进入《代号7》标题界面
    // The title covers the map loop; desktop readiness must not wait for that loop.
    document.body.dataset.state = game.state;
    if (new URLSearchParams(location.search).get('runtimeTrace') === '1') {
      import('./core/runtime-trace.local.js')
        .then(({ installRuntimeTrace }) => installRuntimeTrace())
        .catch(() => console.warn('[runtime-trace] 本地诊断加载失败'));
    }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('perfProbe')) {
      import('./core/perf-probe.local.js')
        .then(({ installPerfProbe }) => installPerfProbe({ SDT, game, canvas, renderScheduler }))
        .catch(error => console.warn('[vite-perf] 探针加载失败', error));
    }
    // 预热当前基地首页背景，沿现有受限解码池保留，避免首进再准备旧壁纸之外的图片。
    const warmHubWallpaper = () => {
      SDT.Art.warm?.([new URL('../assets/scenes/base-operations-v5.webp', import.meta.url).href]);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmHubWallpaper, { timeout: 4000 });
    else /** @type {Window} */ (window).setTimeout(warmHubWallpaper, 2000);
    // Prepare menu code/CSS while the title is idle; no page factory, DOM or
    // save action runs here. A failed preload remains retryable on real entry.
    const prepareMenu = () => {
      if (game.state !== 'title' || document.hidden) return;
      preloadMenuPages().then(() => {
        // Use a separate idle turn: gallery CSS/module work must not share the
        // menu preparation frame or run after the player has left the title.
        const prepareLibrary = () => {
          if (game.state !== 'title' || document.hidden) return;
          preloadCardLibrary().catch(() => {});
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(prepareLibrary);
        else /** @type {Window} */ (window).setTimeout(prepareLibrary, 2000);
      }).catch(() => {});
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(prepareMenu);
    else /** @type {Window} */ (window).setTimeout(prepareMenu, 2000);
    // 启动只HTTP预取六张常见场景和现行卡框；图片解码沿页面入口按需执行。
    const warmupTip = document.getElementById('warmupTip');
    const warmupBar = document.getElementById('warmupBar');
    const warmupNum = document.getElementById('warmupNum');
    const sceneUrls = STARTUP_SCENE_KEYS.map(key => PRELOAD_SCENES[key]).filter(Boolean);
    if (sceneUrls.length > PERFORMANCE_BUDGETS.startupPreloadMax) {
      throw new Error(`首轮场景预热超预算：${sceneUrls.length}/${PERFORMANCE_BUDGETS.startupPreloadMax}`);
    }
    const urls = planStartupArtPreload({ sceneUrls });
    if (warmupTip && urls.length) {
      warmupTip.hidden = false;
      SDT.Art.prefetchBatched(urls, (done, total) => {
        if (warmupNum) warmupNum.textContent = `${done}/${total}`;
        if (warmupBar) warmupBar.style.width = `${Math.round(done / total * 100)}%`;
      }, 4).then(() => setTimeout(() => {
        warmupTip.classList.add('done');
        setTimeout(() => { warmupTip.hidden = true; }, 600);
      }, 350)).catch(error => console.warn('[warmup] 首屏资源预取未完成', error));
    } else {
      try { SDT.Art.prefetchBatched(urls, null, 4).catch(error => console.warn('[warmup] 首屏资源预取未完成', error)); } catch { /* 预取降级失败：不阻塞启动 */ }
    }
    startLoop();
  }, { once: true });
