/** Sidebar/HUD controls share the map commands without owning map state. */
export function createGameMapControls({ readState, UI, window, document, renderScheduler,
  isReachable, showTarget, confirmTarget, showBackpackSection, renderMiniMap,
  storeGet, storeSet, showExportOverlay, showImportOverlay, showClearOverlay,
  initDevMode, devForceBattle, devJumpNode, closeCardPageTop }) {
  let bound = false;
  function bindControls() {
    if (bound) return;
    bound = true;
    // 底栏背包按钮已删（2026-09-19）；全局浮动背包键已删（2026-10-15 老板：背包页自带左上退出键）
    // 背包入口=B 快捷键与各流程动作（resBag/chestOpenBag/entrySupplyBag 直调 bagSlots.showBackpack）
    document.getElementById('sidebar')?.addEventListener('click', e => {
      const location = /** @type {Element} */ (e.target).closest('button[data-route-select]');
      if (location) {
        if (/** @type {HTMLButtonElement} */ (location).disabled || readState().game.state !== 'idle') return;
        const li = Number(/** @type {HTMLElement} */ (location).dataset.li), idx = Number(/** @type {HTMLElement} */ (location).dataset.idx);
        const node = readState().game.nodes.find(n => n.li === li && n.idx === idx);
        const fogOn = Object.keys(readState().game.seen || {}).length > 0;
        if (!node || li !== readState().game.layerIdx || (fogOn && readState().game.seen[`${li},${idx}`] !== 1)) return;
        if (idx === readState().game.trackPos || isReachable(node)) showTarget(node);
        return;
      }
      const routeButton = /** @type {Element} */ (e.target).closest('.expedition-map-preview button');
      if (routeButton) {
        if (/** @type {HTMLButtonElement} */ (routeButton).disabled || readState().game.state !== 'idle') return;
        if (/** @type {HTMLElement} */ (routeButton).dataset.routeEnter) { confirmTarget(); return; }
      }
      const button = /** @type {Element} */ (e.target).closest('button[data-expedition-tool]');
      if (!button || /** @type {HTMLButtonElement} */ (button).disabled || readState().game.state !== 'idle') return;
      const tool = /** @type {HTMLElement} */ (button).dataset.expeditionTool;
      if (['bag', 'safe', 'pocket'].includes(tool)) showBackpackSection(tool);
      else if (tool === 'focus' || tool === 'overview') {
        readState().cam.frameExploration(readState().game, tool === 'overview');
        renderScheduler.invalidate();
      }
    });
    // The sidebar is hidden during character selection; draw once it has a real size.
    if (typeof ResizeObserver !== 'undefined') {
      const mini = document.getElementById('miniMap');
      if (mini) new ResizeObserver(() => { if (readState().game.runActive) renderMiniMap(); }).observe(mini);
    }

    // 行动日志收起开关：日志面板盖住左下地图节点，收起后只留标题条（状态持久化）
    const logPanel = document.getElementById('logPanel');
    const logToggle = document.getElementById('logToggle');
    if (logPanel && logToggle) {
      logPanel.classList.toggle('collapsed', storeGet('sdt-log-collapsed') !== '0');
      logToggle.addEventListener('click', () => {
        const collapsed = logPanel.classList.toggle('collapsed');
        storeSet('sdt-log-collapsed', collapsed ? '1' : '0');
      });
    }

    // 定位按钮：与键盘 F（camFocus）同一动作——镜头立即回到棋子当前位置
    const btnLocate = document.getElementById('btnLocate');
    if (btnLocate) btnLocate.addEventListener('click', () => {
      readState().cam.frameExploration(readState().game); renderScheduler.invalidate();
    });
    // 「已知区域」按键已按 09-24 留言 #8 移除；G 键（input.js camOverview）总览保留

    // Resource explanations are click/focus controls owned by the shared top bar.
    if (UI.el.tglIndex) UI.el.tglIndex.addEventListener('change', e => { readState().game.toggles.index = /** @type {HTMLInputElement} */ (e.target).checked; });
    if (UI.el.btnExport) UI.el.btnExport.addEventListener('click', showExportOverlay);
    if (UI.el.btnImport) UI.el.btnImport.addEventListener('click', showImportOverlay);
    if (UI.el.btnClear) UI.el.btnClear.addEventListener('click', showClearOverlay);
    initDevMode();
    // 开发者一键进战斗（devTools 面板，仅 devMode 可见）
    if (UI.el.devBattle) UI.el.devBattle.addEventListener('click', () => devForceBattle(false));
    if (UI.el.devBoss) UI.el.devBoss.addEventListener('click', () => devForceBattle(true));
    // 开发者节点测试面板（标题页 #titleDev，仅 devMode 可见）：一键跳到商店/事件/BOSS 等各类节点
    if (UI.el.titleDev) UI.el.titleDev.addEventListener('click', (e) => {
      const btn = /** @type {Element} */ (e.target).closest('[data-dev-node]');
      if (btn) devJumpNode(/** @type {HTMLElement} */ (btn).dataset.devNode);
    });

    // 卡牌大页面：Esc 关闭 / 点击深色背景关闭
    // （用 click 而非 mousedown 关背景，保证关闭前 mouseup 仍处于 modal 态，不会误触格子编辑）
    window.addEventListener('keydown', (e) => {
      // 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是关大页
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape' && !e.defaultPrevented && readState().cardPageOpen && !readState().cardPageLoading && !UI.el.overlay.hidden) closeCardPageTop();
    });
    UI.el.overlay.addEventListener('click', (e) => {
      if (e.target === UI.el.overlay && readState().cardPageOpen) closeCardPageTop();
    });
  }
  return { bindControls };
}
