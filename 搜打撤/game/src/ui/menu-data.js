import { linkedBackHTML } from './home-linked-interactions.js';

/** Add page navigation only to the data renderer that owns this opening. */
export function createMenuDataPage({ UI, openDataPage, openSettings, document, readIcons }) {
  // ---------- 跑局数据（W1-01：入口=设置页；W2-06：页头行+布局收敛） ----------
  // agent.data.js 的 openDataPage 渲染 .pg hub 但无页头/返回件（原唯一进入=Alt+9，离开仅靠
  // 隐式 Esc/点背景）。此处包装：
  //   ① 注入 linkedBackHTML 共用返回键（点击=hideOverlay，等价 Esc 语义；
  //      数据页不持有 game.state 无需复位），从设置页进入时返回键回设置页；
  //   ② 注入 .data-pg-head 页头行（W2-06：返回件不再叠「总局数」KPI 卡，KPI 区下让位）；
  //   ③ .data-tuned 类激活 page-datapage.css（导出/清空钮收敛正常尺寸右对齐）。
  // 「清空记录」重建后由本次 renderer 回报新 root，不观察其他页面的 DOM。
  function openDataPageUi(fromSettings = false, returnToSettings = /** @type {(()=>unknown)|null} */ (null),
    { onRender = (_page) => { void _page; }, isCurrent = () => true } = {}) {
    return openDataPage({ isCurrent, onRender:page => {
      const { root:pg } = page;
      if (!page.isCurrent()) return false;
      const fresh = !pg.classList.contains('data-tuned');
      if (fresh) {
        pg.classList.add('data-tuned');
        const head = document.createElement('header');
        head.className = 'pg-head data-pg-head';
        let title = '跑局数据';
        try { title = readIcons().rich('[[icon:chart]] 跑局数据'); } catch { /* 图标宏失败退纯文字 */ }
        head.innerHTML = `<h2>${title}</h2><span class="pg-spacer"></span>`;
        pg.prepend(head);
      }
      if (!/** @type {import("./ui.dom.types.js").UIElement} */ (pg.querySelector('.ak-back-tl'))) {
        const template = document.createElement('template');
        template.innerHTML = linkedBackHTML('dataPageBack', '返回', 'ak-back-tl', 'button', { cancel:true });
        const btn = /** @type {HTMLButtonElement} */ (template.content.firstElementChild);
        btn.addEventListener('click', () => {
          if (!page.isCurrent()) return false;
          // Returning directly lets the shared page transition keep one visual owner.
          if (fromSettings) return returnToSettings ? returnToSettings() : openSettings();
          return UI.hideOverlay();
        });
        pg.prepend(btn);
      }
      return onRender(page);
    } });
  }

  return { openDataPageUi };
}
