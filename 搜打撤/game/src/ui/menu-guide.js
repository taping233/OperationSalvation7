import { achievementGalleryHTML, bindAchievementGallery } from './achievement-gallery.js';
import { beginnerGuideHTML, beginnerGuidePageCount, updateBeginnerGuide, setBeginnerGuideImageReading } from './beginner-guide.js';
import { enterAchievementCut } from './camp-entry.js';
import { reduceMotion } from '../core/motion.js';
import { createOverlayReturn } from './overlay-return-state.js';

/** Guide and achievements preserve their entry/return presentation lifecycle. */
export function createMenuGuidePages({ UI, game, pickLatestSlot, document, readMeta, readCards, readBattle }) {
  // One guide serves title and system-menu entries; the caller owns its return.
  function openTitleGuide(options = {}) {
    if (typeof options.isCurrent === 'function' && !options.isCurrent()) return false;
    const prevState = game.state;
    game.state = 'modal';
    const pageCount = beginnerGuidePageCount();
    let currentPage = 0;
    let renderVersion = 0;
    let guideRoot = null;
    let guideRevision = null;
    const overlayOpen = () => !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    const contextCurrent = () => typeof options.isCurrent !== 'function' || options.isCurrent();
    const guideCurrent = () => contextCurrent() && overlayOpen() && UI._overlayRevision === guideRevision
      && !!guideRoot?.isConnected && guideRoot === UI.el.ovBody.querySelector('.beginner-guide');
    const renderPage = async () => {
      if (!guideCurrent() || guideRoot.classList.contains('is-reading-image')) return false;
      const version = ++renderVersion;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeAction = active?.dataset?.act;
      const activePageIndex = active?.dataset?.pageIndex;
      let focusMoved = false;
      const noteFocusMove = event => {
        if (event.type === 'focusin' && event.target === document.body) return;
        if (event.target instanceof Node && event.target !== active && !active?.contains(event.target)) focusMoved = true;
      };
      document.addEventListener('focusin', noteFocusMove, true);
      document.addEventListener('pointerdown', noteFocusMove, true);
      const root = guideRoot;
      try {
        if (!await updateBeginnerGuide(root, currentPage)) return;
      } finally {
        document.removeEventListener('focusin', noteFocusMove, true);
        document.removeEventListener('pointerdown', noteFocusMove, true);
      }
      if (!guideCurrent() || version !== renderVersion || root.closest('[hidden],[inert],[aria-hidden="true"]')) return;
      const disabledPager = (activeAction === 'guidePrev' || activeAction === 'guideNext') && active?.matches(':disabled')
        && (document.activeElement === document.body || document.activeElement === active);
      if (focusMoved || active?.isConnected && document.activeElement !== active && !disabledPager) return;
      if (activeAction && activeAction !== 'guideBack') {
        const selector = activeAction === 'guidePage' && /^\d+$/.test(activePageIndex || '')
          ? `[data-act="guidePage"][data-page-index="${activePageIndex}"]`
          : `[data-act="${activeAction}"]`;
        const nextFocus = root.querySelector(selector);
        (nextFocus?.disabled ? root.querySelector('.bg-nav-item[aria-current="step"]') : nextFocus)?.focus({ preventScroll: true });
      }
    };
    UI.showOverlay('生存指南', beginnerGuideHTML(currentPage), 'page');
    guideRoot = UI.el.ovBody.querySelector('.beginner-guide');
    guideRevision = UI._overlayRevision;
    if (guideCurrent() && typeof options.onPage === 'function') options.onPage(guideCurrent);
    UI.act('guidePrev', () => { if (!guideCurrent()) return false; currentPage = Math.max(0, currentPage - 1); return renderPage(); });
    UI.act('guideNext', () => { if (!guideCurrent()) return false; currentPage = Math.min(pageCount - 1, currentPage + 1); return renderPage(); });
    UI.act('guidePage', data => {
      if (!guideCurrent()) return false;
      const requested = Number.parseInt(data.pageIndex, 10);
      if (!Number.isFinite(requested)) return;
      currentPage = Math.max(0, Math.min(pageCount - 1, requested));
      return renderPage();
    });
    UI.act('guideImageOpen', () => guideCurrent() && setBeginnerGuideImageReading(guideRoot, true));
    UI.act('guideImageClose', () => guideCurrent() && setBeginnerGuideImageReading(guideRoot, false));
    UI.act('guideBack', createOverlayReturn({
      revision:guideRevision, getRevision:() => UI._overlayRevision, isOpen:overlayOpen,
      back:commit => {
        if (!guideCurrent()) return false;
        if (typeof options.returnTo === 'function') return options.returnTo(render => {
          if (!guideCurrent()) return false;
          return commit(render);
        });
        UI.hideOverlay();
        game.state = (prevState === 'modal' && !game.battleActive) ? 'idle' : prevState;
        if (game.battleActive) readBattle()?.commands?.refreshView?.();
        return true;
      },
      restore:targetCurrent => {
        if (typeof options.restoreReturn === 'function') options.restoreReturn(targetCurrent);
      },
      onFailure:() => { if (guideCurrent()) UI.log('返回未完成，请重试。', 'warn'); },
    }));
    return guideRoot;
  }

  // 成就总览：以最近游玩档位的基地档案为准（只读；领奖需进入基地）
  function openTitleAchievements() {
    const latest = pickLatestSlot();
    const base = latest?.base || null;
    game.state = 'modal';
    UI.showOverlay('成就总览', achievementGalleryHTML({
      achievements: readMeta().ACHIEVEMENTS, base, slot: latest?.slot,
      isUnlocked: (achievement, snapshot) => readMeta().isUnlocked(achievement, snapshot),
      backs: readCards().CARD_BACKS || [], cards: readCards().all(),
    }), 'page');
    const page = /** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.achievement-gallery'));
    bindAchievementGallery(page, { deferEntry:true });
    const clearCut = enterAchievementCut(page, reduceMotion());
    UI.act('achBack', () => {
      clearCut();
      UI.hideOverlay(); game.state = 'title';
    });
  }

  return { openTitleGuide, openTitleAchievements };
}
