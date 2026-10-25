import { configureRunTopBar } from './run-top-bar.js';
/** Early title interactions and browser lifecycle recovery stay usable if boot fails. */
export function createGameTitleController({ readState, readSound, UI, document, window,
  startNewGame, openSettings, openCardLibrary, showTitle, openLeaveMenu,
  openTitleGuide, saveSession, saveGame, slotBackgroundUrl }) {
  // ---------- 标题界面按钮绑定 ----------
  let titleControlsBound = false;
  function bindTitle() {
    if (titleControlsBound) return;
    titleControlsBound = true;
    const title = document.getElementById('title');
    document.getElementById('mStart').addEventListener('click', startNewGame);
    document.getElementById('mSettings').addEventListener('click', openSettings);
    document.getElementById('btnCardLib').addEventListener('click', openCardLibrary);
    document.getElementById('mBack').addEventListener('click', () => {
      // 告别屏淡出 + 标题页淡入都由 showTitle 内部的屏幕过渡处理（交叉淡切）
      showTitle();
    });
    // 预加载选档页存档卡背景图，避免首次打开时解码卡顿
    const slotBg = new Image();
    slotBg.src = slotBackgroundUrl;
    // btnHome 打开「离开对局」三选弹窗（保存 / 放弃 / 继续）——
    // 此前绑定 exitToTitle 导致 openLeaveMenu 成死代码、放弃对局无入口（2026-09-19 交互走查 B1）
    configureRunTopBar(UI, { readState, readSound, openLeaveMenu, document });
    // U9（2026-09-19 走查）：对局内帮助入口——左上 ? 打开远征手册，返回恢复对局
    document.getElementById('btnHelp')?.addEventListener('click', openTitleGuide);
    UI._retrySave = () => saveSession();
    document.addEventListener('visibilitychange', () => { if (document.hidden && readState().game.runActive) void saveSession(); });
    window.addEventListener('pagehide', () => { if (readState().game.runActive) void saveSession(); });
    // 战斗内周期性落盘——battle.core 保存本场入场检查点；读档由 Battle.restore 从战斗开头重开
    readState().game.persistSave = saveGame;
    title.dataset.controlsBound = 'true';
  }

  // ---------- 后台冻结兜底（2026-09-19 交互走查 B3） ----------
  // 后台标签/最小化窗口时 document 时间线冻结，纯 CSS 入场动画（首帧 opacity:0，
  // 如宝箱 chestFlyIn / 弹层入场）会停在透明态，浮层看似黑屏死机——WAAPI 已有
  // animateSafe 兜底（battle.view.js），CSS 动画补这里：回到前台时把 overlay 与
  // body 直挂浮层（cardZoom/legendGet/cardGet）内的动画跳到终态。
  function bindVisibilityRecovery() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      [document.getElementById('overlay'), document.body].forEach(root => {
        if (!root || !root.getAnimations) return;
        root.getAnimations().forEach(a => {
          try {
            if (a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity) return;   // 雪花等循环动画不碰
            a.finish();
          } catch { /* 已被移除/尚未开始的动画 finish 会抛，忽略 */ }
        });
      });
    });

  }
  function stripNativeTitles(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
    if (root.nodeType === 1 && root.hasAttribute('title')) root.removeAttribute('title');
  }
  function observeNativeTitles() {
    stripNativeTitles(document);
    // 整页重建（卡牌库/背包/战斗换槽）一批会塞进数百 addedNodes，此前逐节点即时
    // querySelectorAll；改为收集去重 + rAF 合帧后每根一次性处理（同 icons-bitmap
    // 观察器的做法）。title 只在悬停时可见，一帧内延迟摘除无感知差异。
    let titleFlushQueued = false;
    const titleDirtyRoots = new Set();
    const flushTitleRoots = () => {
      titleFlushQueued = false;
      const roots = new Set([...titleDirtyRoots].filter(root => root.isConnected));
      titleDirtyRoots.clear();
      for (const root of roots) {
        let parent = root.parentElement;
        while (parent && !roots.has(parent)) parent = parent.parentElement;
        if (!parent) stripNativeTitles(root);
      }
    };
    const titleObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          // 单点属性变更即时摘除（无子树扫描成本）
          if (m.target && /** @type {Element} */ (m.target).getAttribute && /** @type {Element} */ (m.target).getAttribute('title') != null) /** @type {Element} */ (m.target).removeAttribute('title');
        } else if (m.type === 'childList') {
          m.addedNodes.forEach(n => { if (n.nodeType === 1) titleDirtyRoots.add(n); });
        }
      }
      if (!titleFlushQueued && titleDirtyRoots.size) {
        titleFlushQueued = true;
        (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(flushTitleRoots);
      }
    });
    titleObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  }
  return { bindTitle, bindVisibilityRecovery, observeNativeTitles };
}
