import { linkedBackHTML } from './home-linked-interactions.js';

/** Wrap the data page without changing its state or mutation observer ownership. */
export function createMenuDataPage({ UI, openDataPage, openSettings, document, readIcons }) {
  // ---------- 跑局数据（W1-01：入口=设置页；W2-06：页头行+布局收敛） ----------
  // agent.data.js 的 openDataPage 渲染 .pg hub 但无页头/返回件（原唯一进入=Alt+9，离开仅靠
  // 隐式 Esc/点背景）。此处包装：
  //   ① 注入 linkedBackHTML 共用返回键（点击=hideOverlay，等价 Esc 语义；
  //      数据页不持有 game.state 无需复位），从设置页进入时返回键回设置页；
  //   ② 注入 .data-pg-head 页头行（W2-06：返回件不再叠「总局数」KPI 卡，KPI 区下让位）；
  //   ③ .data-tuned 类激活 page-datapage.css（导出/清空钮收敛正常尺寸右对齐）。
  // 「清空记录」会整页重渲染——MutationObserver 防丢：ovBody 一有变动就补注。
  // 全仓只保有一个活观察器；inject 带 .doom-stats 内容校验——台面上的 .pg 确为
  // 跑局数据页才注入。旧实现只认 .pg：设置→数据→返回键回设置页时，hideOverlay 的
  // 210ms 淡出期间观察器仍活着，设置页一换上就被误注数据页页头（2026-09-28 修复）。
  let dataPageMo = null;
  function openDataPageUi(fromSettings = false, returnToSettings = /** @type {(()=>void)|null} */ (null)) {
    openDataPage();
    const ovBody = UI.el && UI.el.ovBody;
    if (!ovBody) return;
    const inject = () => {
      if (!UI.el.overlay || UI.el.overlay.hidden) return;
      const pg = /** @type {import("./ui.dom.types.js").UIElement} */ (ovBody.querySelector('.pg'));
      if (!pg || !/** @type {import("./ui.dom.types.js").UIElement} */ (pg.querySelector('.doom-stats'))) return;
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
          if (!pg.isConnected || ovBody.querySelector('.pg') !== pg || UI.el.overlay.hidden
            || UI.el.overlay.classList.contains('closing')) return;
          // Returning directly lets the shared page transition keep one visual owner.
          if (fromSettings) { if (returnToSettings) returnToSettings(); else openSettings(); }
          else UI.hideOverlay();
        });
        pg.prepend(btn);
      }
    };
    inject();
    if (dataPageMo) dataPageMo.disconnect();
    const mo = new MutationObserver(() => {
      if (!UI.el.overlay || UI.el.overlay.hidden) { mo.disconnect(); if (dataPageMo === mo) dataPageMo = null; return; }
      inject();
    });
    dataPageMo = mo;
    mo.observe(ovBody, { childList: true, subtree: false });
  }

  return { openDataPageUi };
}
