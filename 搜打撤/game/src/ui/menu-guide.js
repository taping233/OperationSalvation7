import { achievementGalleryHTML, bindAchievementGallery } from './achievement-gallery.js';
import { beginnerGuideHTML, beginnerGuidePageCount, updateBeginnerGuide } from './beginner-guide.js';
import { enterAchievementCut } from './camp-entry.js';
import { reduceMotion } from '../core/motion.js';

/** Guide and achievements preserve their entry/return presentation lifecycle. */
export function createMenuGuidePages({ UI, game, pickLatestSlot, document, readMeta, readCards, readBattle }) {
  // 远征手册：只描述当前 Vite 版真实输入与流程
  // U9（2026-09-19 走查）：对局内也可打开（左上 ? 钮）——进入时记下原状态，返回恢复，
  // 不再把对局态改写成 title（标题页调用 prev='title'，行为不变）。
  function openTitleGuide() {
    const prevState = game.state;
    game.state = 'modal';
    const pageCount = beginnerGuidePageCount();
    let currentPage = 0;
    let renderVersion = 0;
    const renderPage = async () => {
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
      const root = /** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.beginner-guide'));
      try {
        if (root) {
          if (!await updateBeginnerGuide(root, currentPage)) return;
        } else UI.showOverlay('远征新手指南', beginnerGuideHTML(currentPage), 'page');
      } finally {
        document.removeEventListener('focusin', noteFocusMove, true);
        document.removeEventListener('pointerdown', noteFocusMove, true);
      }
      if (version !== renderVersion || root && (!root.isConnected || root.closest('[hidden],[inert],[aria-hidden="true"]')
        || UI.el.overlay.hidden || UI.el.overlay.classList.contains('closing'))) return;
      const disabledPager = (activeAction === 'guidePrev' || activeAction === 'guideNext') && active?.matches(':disabled')
        && (document.activeElement === document.body || document.activeElement === active);
      if (focusMoved || active?.isConnected && document.activeElement !== active && !disabledPager) return;
      if (activeAction && activeAction !== 'guideBack') {
        const selector = activeAction === 'guidePage' && /^\d+$/.test(activePageIndex || '')
          ? `[data-act="guidePage"][data-page-index="${activePageIndex}"]`
          : `[data-act="${activeAction}"]`;
        const nextFocus = UI.el.ovBody.querySelector(selector);
        (nextFocus?.disabled ? /** @type {import("./ui.dom.types.js").UIElement} */ (UI.el.ovBody.querySelector('.bg-nav-item[aria-current="step"]')) : nextFocus)?.focus({ preventScroll: true });
      }
    };
    UI.showOverlay('远征新手指南', beginnerGuideHTML(currentPage), 'page');
    UI.act('guidePrev', () => { currentPage = Math.max(0, currentPage - 1); renderPage(); });
    UI.act('guideNext', () => { currentPage = Math.min(pageCount - 1, currentPage + 1); renderPage(); });
    UI.act('guidePage', data => {
      const requested = Number.parseInt(data.pageIndex, 10);
      if (!Number.isFinite(requested)) return;
      currentPage = Math.max(0, Math.min(pageCount - 1, requested));
      renderPage();
    });
    UI.act('guideBack', () => {
      UI.hideOverlay();
      // 战斗 modal 态不可降级为 idle（战斗界面会丢）：口径同 showRunTransition 的恢复守卫
      game.state = (prevState === 'modal' && !game.battleActive) ? 'idle' : prevState;
      // 战斗被手册整页覆盖后 ovBody 已被清：返回战斗态时补一次重绘（U9）
      if (game.battleActive && readBattle() && readBattle().commands && readBattle().commands.refreshView) {
        readBattle().commands.refreshView();
      }
    });
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
