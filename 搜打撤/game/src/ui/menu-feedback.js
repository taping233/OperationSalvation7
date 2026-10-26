import { appendLocalFeedback, completeLocalFeedback, downloadFeedbackRecord, downloadFeedbackRecords, readLocalFeedback, removeLocalFeedback } from './feedback.local.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { linkedBackHTML } from './home-linked-interactions.js';
import { bindDialogSurface } from './dialog-surface.js';
import { transitionRegion } from './region-transition.js';
import { waitPageVisual } from './page-visual-ready.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from './overlay-return-state.js';

const SUG_PAGE_SIZE = 20;

/** Feedback form and inbox own their source-page and asynchronous request guards. */
export function createMenuFeedbackPages({ UI, game, esc, getActiveSlot, openSettings, document, desktop, readSound, readIcons }) {
  // ---------- 首页留言：右键任意位置写给 Friday 的建议 ----------
  // 桌面版经 Electron IPC 写入仓库 output/suggestions.json；浏览器版退回 localStorage。
  // 每条建议携带 page（所在页面/弹层）、target（右键命中的 UI 位置）与 at（屏幕百分比坐标）。
  async function saveSuggestion(fields, target, at, page) {
    const entry = { ts: new Date().toISOString(), version: document.getElementById('gameVersion')?.textContent?.trim() || '未知',
      page: page || null, target: target || null, at: at || null, ...fields };
    if (desktop()?.appendSuggestion) {
      try {
        const result = await desktop().appendSuggestion(entry);
        return result === true || typeof result === 'object' && result?.ok === true;
      } catch { return false; }
    }
    return appendLocalFeedback(entry).ok;
  }

  function openSuggestionBox(target, at, page) {
    const layer = /** @type {import("./ui.dom.types.js").UIElement} */ (document.getElementById('sugLayer'));
    if (!layer || !layer.hidden) return;   // 已打开则忽略
    const sourceFocus = document.activeElement;
    const originalParent = layer.parentNode, originalNext = layer.nextSibling;
    // A regular layer must live inside an open native dialog to appear above its top layer.
    const nativeDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    const portalHost = nativeDialog || document.body;
    if (layer.parentNode !== portalHost) portalHost.append(layer);
    const prevState = game.state;
    const sourceOverlay = UI.el?.overlay, sourceBody = UI.el?.ovBody;
    const sourceRoot = sourceBody?.firstElementChild, sourceHidden = sourceOverlay?.hidden;
    const sourceRevision = UI._overlayRevision;
    const sourceContext = captureBattleContext(game, getActiveSlot);
    const sourceCurrent = () => sourceContext() && game.state === 'modal' &&
      sourceOverlay?.isConnected && sourceBody?.isConnected &&
      UI.el?.overlay === sourceOverlay && UI.el?.ovBody === sourceBody &&
      sourceBody.firstElementChild === sourceRoot && sourceOverlay.hidden === sourceHidden &&
      UI._overlayRevision === sourceRevision;
    game.state = 'modal';                  // 暂停对局输入，返回时恢复
    document.getElementById('sugHead').innerHTML = readIcons().rich('[[icon:book]] 记录试玩反馈');
    document.getElementById('sugWhere').innerHTML = target
      ? `针对位置：<b>${esc(target.name)}</b>${at ? `（屏幕 ${at.x}%, ${at.y}%）` : ''}`
      : '';
    const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('sugText'));
    const fields = ['sugText', 'sugSteps', 'sugExpected', 'sugActual'].map(id => /** @type {HTMLTextAreaElement} */ (document.getElementById(id)));
    fields.forEach(el => { el.value = ''; });
    layer.inert = false;
    UI.showScreen(layer);
    const token = Symbol('suggestion'); layer._openToken = token;
    const saveBtn = /** @type {HTMLButtonElement} */ (document.getElementById('sugSaveBtn')); saveBtn.disabled = false;
    saveBtn.removeAttribute('aria-busy');
    let releaseDialog = /** @type {ReturnType<typeof bindDialogSurface>} */ (() => {});
    const close = () => {
      if (layer._openToken !== token) return;
      // 逻辑返回不等视觉淡出；较新页面或换局已经接管时只收起本留言层。
      const restore = sourceCurrent();
      layer._openToken = null;
      releaseDialog({ restoreFocus:restore });
      if (restore) game.state = prevState;
      layer.inert = true;
      UI.hideScreen(layer, () => {
        if (layer.parentNode === portalHost && originalParent?.isConnected) {
          originalParent.insertBefore(layer, originalNext?.parentNode === originalParent ? originalNext : null);
        }
      });
    };
    /** @type {HTMLButtonElement} */ (document.getElementById('sugCancelBtn')).onclick = close;
    let busy = false;
    saveBtn.onclick = async () => {
      if (busy || layer._openToken !== token) return;
      const text = ta.value.trim();
      if (!text) return;
      busy = true; saveBtn.disabled = true;
      saveBtn.setAttribute('aria-busy', 'true');
      const payload = { text, steps: fields[1].value.trim(), expected: fields[2].value.trim(), actual: fields[3].value.trim() };
      let ok;   // 不做冗余初始化：try 内必赋值，catch 置 false，两路都在读取前完成赋值
      try { ok = await saveSuggestion(payload, target, at, page); }
      catch { ok = false; }
      if (layer._openToken !== token) return;
      busy = false; saveBtn.disabled = false;
      saveBtn.removeAttribute('aria-busy');
      if (ok) {
        // 保存成功即自动退出留言界面、回原页面（close 的 token 守卫保证只退一次）；
        // 导出指引常驻表单下方静态提示，无需停留展示
        fields.forEach(el => { el.value = ''; });
        close();
        return;
      }
      document.getElementById('sugWhere').innerHTML = '写入失败，输入已保留，请重试。';
    };
    releaseDialog = bindDialogSurface(layer, { initialFocus:ta, returnFocus:sourceFocus, onBack:close });
  }

  // ---------- 留言库：设置页入口，查看历史留言与完成状态，未完成的可删除 ----------
  // 桌面版经 Electron IPC 读写 output/suggestions.json；浏览器版走 feedback.local.js 封装。
  // 浏览器留言可标记完成并保留原文；删除沿公共确认框。
  async function loadSuggestions() {
    if (desktop()?.readSuggestions) {
      try {
        const r = await desktop().readSuggestions();
        if (r?.ok && Array.isArray(r.list)) return r.list;
      } catch { /* 落回 localStorage */ }
    }
    const read = readLocalFeedback();
    return read.ok ? read.value : read;
  }

  async function removeSuggestion(ts) {
    if (desktop()?.deleteSuggestion) {
      try {
        const result = await desktop().deleteSuggestion(ts);
        return result === true || typeof result === 'object' && result?.ok === true;
      } catch { return false; }
    }
    return removeLocalFeedback(ts);   // 存储收口批 2026-09-25：原内联直读写移入封装层，行为逐点等价
  }

  const fmtSugTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const setButtonLabel = (button, text) => {
    const label = button?.querySelector('.ui-control-label') || button;
    if (label) label.textContent = text;
  };

  let feedbackPage = 0;
  let sugCache = null;   // 留言库打开期间的数据副本，删除后本地同步
  function sugRowHTML(e, done, index) {
    const page = e?.page?.name || (e?.target?.name ? String(e.target.name).split(' · ')[0] : '未知位置');
    const where = e?.target?.name || '';
    return `<div class="sugin-row${done ? ' done' : ''}" data-feedback-id="${esc(e?.ts || '')}">
      <div class="sugin-top">
        <span class="sugin-mark">${done ? '[[icon:check]]' : '[[icon:book]]'}</span>
        <span class="sugin-time">${fmtSugTime(e?.ts)}</span>
        <span class="sugin-page-name">${esc(page)}</span>
        <button class="mini-btn" data-act="sugExport" data-idx="${index}"><span class="ui-control-label">导出此条</span></button>
        ${done ? '' : `<button class="mini-btn danger sugin-del" data-act="sugDel" data-ts="${esc(e?.ts || '')}"><span class="ui-control-label">删除</span></button>`}
      </div>
      <div class="sugin-text">${esc(e?.text || '')}</div>
      <div class="sugin-where">版本：${esc(e?.version || '未知')}</div>
      ${e?.steps ? `<div class="sugin-detail"><b>复现步骤</b>${esc(e.steps)}</div>` : ''}
      ${e?.expected ? `<div class="sugin-detail"><b>期望结果</b>${esc(e.expected)}</div>` : ''}
      ${e?.actual ? `<div class="sugin-detail"><b>实际结果</b>${esc(e.actual)}</div>` : ''}
      ${where ? `<div class="sugin-where">${esc(where)}</div>` : ''}
      ${done || desktop()?.readSuggestions ? '' : `<button class="mini-btn sugin-complete" data-act="sugDone" data-ts="${esc(e?.ts || '')}"><span class="ui-control-label">标记完成</span></button>`}
    </div>`;
  }

  function updateSugBox(box, html, canExport, { resetScroll = false } = {}) {
    const page = box.closest('.sugin-page') || box;
    const revision = UI._overlayRevision;
    const current = () => document.getElementById('sugBox') === box && UI._overlayRevision === revision
      && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    const sourceFocus = document.activeElement;
    const snapshot = captureOverlayReturnState(page, sourceFocus);
    if (resetScroll) snapshot.scroll = snapshot.scroll.map(saved => ({ ...saved, top:0, left:0 }));
    const sourceRow = sourceFocus instanceof Element ? /** @type {HTMLElement} */ (sourceFocus.closest('.sugin-row')) : null;
    const rows = [...box.querySelectorAll('.sugin-row')];
    const rowIndex = rows.indexOf(sourceRow);
    const sourceId = sourceRow?.dataset.feedbackId;
    const richHTML = readIcons().rich(html);
    return transitionRegion(box, () => {
      box.innerHTML = richHTML;
      const exportAll = /** @type {HTMLButtonElement} */ (page.querySelector('[data-act="sugExportAll"]'));
      if (exportAll) { exportAll.disabled = !canExport; setButtonLabel(exportAll, '全部导出'); }
      restoreOverlayReturnState(page, { ...snapshot, focus:null });
      if (resetScroll) box.scrollTop = 0;
    }, { direction:0, isCurrent:current,
      prepare:signal => waitPageVisual(box, { signal, timeout:600 }),
    }).then(changed => {
      if (!changed || !current() || sourceFocus?.isConnected && document.activeElement !== sourceFocus) return changed;
      if (document.activeElement !== document.body && document.activeElement !== sourceFocus
        && !box.contains(document.activeElement)) return changed;
      restoreOverlayReturnState(page, { scroll:[], disclosures:[], focus:snapshot.focus });
      if (rowIndex >= 0 && !page.contains(document.activeElement)) {
        const remaining = [...box.querySelectorAll('.sugin-row')];
        const row = remaining.find(node => node.dataset.feedbackId === sourceId)
          || remaining[Math.min(rowIndex, remaining.length - 1)];
        const next = row?.querySelector('button:not(:disabled)') || page.querySelector('[data-act="sugBack"]');
        next?.focus({ preventScroll:true });
      }
      if (!page.contains(document.activeElement) && sourceFocus instanceof Element && sourceFocus.closest('[data-feedback-pager]')) {
        page.querySelector('[data-feedback-pager] button:not(:disabled)')?.focus({ preventScroll:true });
      }
      return changed;
    });
  }

  function renderSugBox({ resetScroll = false } = {}) {
    const box = document.getElementById('sugBox');
    if (!box) return;
    if (!Array.isArray(sugCache)) return updateSugBox(box, `<p class="ov-empty danger">${esc(sugCache?.message || '留言信箱读取失败，原数据已保留')}</p><button class="mini-btn" data-act="sugRetry"><span class="ui-control-label">重新读取</span></button>`, false);
    const list = sugCache.map((entry, index) => ({ entry, index })).reverse();
    const entries = list;
    const pend = list.filter((x) => !x.entry?.done);
    const done = list.filter((x) => x.entry?.done);
    const pageCount = Math.max(1, Math.ceil(list.length / SUG_PAGE_SIZE));
    feedbackPage = Math.max(0, Math.min(feedbackPage, pageCount - 1));
    const visible = [...pend, ...done].slice(feedbackPage * SUG_PAGE_SIZE, (feedbackPage + 1) * SUG_PAGE_SIZE);
    const visiblePend = visible.filter(item => !item.entry?.done), visibleDone = visible.filter(item => item.entry?.done);
    let html = `<p class="hint">共 ${list.length} 条留言 · 待处理 ${pend.length} · 已完成 ${done.length} · 删除需再次确认</p>`;
    if (visiblePend.length) html += '<h3 class="set-h">待处理</h3>' + visiblePend.map(x => sugRowHTML(x.entry, false, x.index)).join('');
    if (visibleDone.length) html += '<h3 class="set-h">已完成</h3>' + visibleDone.map(x => sugRowHTML(x.entry, true, x.index)).join('');
    if (pageCount > 1) html += `<footer class="sugin-pager" data-feedback-pager aria-label="留言分页">
      <button type="button" class="mini-btn" data-act="sugPagePrev"${feedbackPage === 0 ? ' disabled' : ''}><span class="ui-control-label">上一页</span></button>
      <span aria-live="polite">第 ${feedbackPage + 1} / ${pageCount} 页</span>
      <button type="button" class="mini-btn" data-act="sugPageNext"${feedbackPage >= pageCount - 1 ? ' disabled' : ''}><span class="ui-control-label">下一页</span></button>
    </footer>`;
    if (!entries.length) html = `<div class="sugin-empty">
        <img class="se-art" data-visual-critical src="assets/ui/sugin-mail-empty.webp" alt="雪地邮筒" draggable="false">
        <div class="se-text">
          <b>邮筒还是空的</b>
          <span>在游戏任意界面<b>点击右键</b>，就能给制作者写一张留言。</span>
          <span>保存后可点「全部导出」，一次导出所有留言的 JSON 交给制作者；处理完的留言会盖「已完成」章归档。</span>
        </div>
      </div>`;
    return updateSugBox(box, html, !!entries.length, { resetScroll });
  }

  // W1-11：fromTitle=true（标题页入口进入）时，返回键回标题而非设置页
  function openSuggestionInbox(fromTitle = false, returnToSettings = /** @type {(()=>unknown)|null} */ (null),
    { onRender = (_page) => { void _page; }, isCurrent = () => true } = {}) {
    if (!isCurrent()) return false;
    sugCache = null; feedbackPage = 0;
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page sugin-page">
        <!-- 09-23 留言：右下 BACK 取消，退出键改左上角，与主页退出键（ak-sq ak-exit）同款同位 -->
        ${linkedBackHTML('sugBack', fromTitle ? '返回' : '返回设置', 'sugin-exit')}
        <header class="pg-head"><h2>[[icon:book]] 留言信箱</h2><span class="pg-spacer"></span><button class="mini-btn" data-act="sugExportAll" title="导出全部待处理和已完成留言到一个 JSON 文件" disabled><span class="ui-control-label">全部导出</span></button></header>
        <div class="settings" id="sugBox" data-region-managed><p class="ov-empty">读取中…</p></div>
      </div>`, 'page');
    const inboxBody = document.getElementById('sugBox');
    const inboxRoot = inboxBody.closest('.sugin-page');
    const inboxRevision = UI._overlayRevision;
    const inboxContext = captureBattleContext(game, getActiveSlot);
    let deleting = false, readRevision = 0;
    const inboxCurrent = () => isCurrent() && inboxContext() && UI._overlayRevision === inboxRevision
      && document.getElementById('sugBox') === inboxBody && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    const readInbox = box => {
      if (deleting || !inboxCurrent()) return;
      const revision = ++readRevision;
      return loadSuggestions().then(list => {
        if (!inboxCurrent() || box !== inboxBody || revision !== readRevision) return;
        sugCache = list; renderSugBox();
      });
    };
    UI.act('sugBack', () => {
      if (!inboxCurrent()) return false;
      if (fromTitle) { UI.hideOverlay(); game.state = 'title'; return; }
      return returnToSettings ? returnToSettings() : openSettings();
    });
    const turnPage = delta => {
      if (deleting || !inboxCurrent() || !Array.isArray(sugCache)) return;
      const next = Math.max(0, Math.min(Math.max(0, Math.ceil(sugCache.length / SUG_PAGE_SIZE) - 1), feedbackPage + delta));
      if (next === feedbackPage) return;
      feedbackPage = next;
      void renderSugBox({ resetScroll:true });
    };
    UI.act('sugPagePrev', () => turnPage(-1));
    UI.act('sugPageNext', () => turnPage(1));
    UI.act('sugExport', d => {
      const entry = Array.isArray(sugCache) ? sugCache[+d.idx] : null; if (!entry) return;
      const btn = document.querySelector(`[data-act="sugExport"][data-idx="${+d.idx}"]`);
      const result = downloadFeedbackRecord(entry);
      setButtonLabel(btn, result.ok ? '已导出' : '导出失败，请重试');
    });
    UI.act('sugExportAll', () => {
      if (!Array.isArray(sugCache) || !sugCache.length) return;
      const btn = /** @type {HTMLButtonElement} */ (document.querySelector('[data-act="sugExportAll"]'));
      const result = downloadFeedbackRecords(sugCache);
      setButtonLabel(btn, result.ok ? `已导出 ${sugCache.length} 条` : '导出失败，请重试');
    });
    UI.act('sugRetry', () => {
      if (deleting || !inboxCurrent()) return;
      const box = document.getElementById('sugBox');
      if (!box) return;
      void updateSugBox(box, '<p class="ov-empty">读取中…</p>', false);
      readInbox(box);
    });
    UI.act('sugDone', d => {
      if (deleting || !inboxCurrent() || desktop()?.readSuggestions || !d?.ts) return;
      const result = completeLocalFeedback(d.ts);
      if (result.ok === false) {
        const button = [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.sugin-complete'))].find(el => el.dataset.ts === d.ts);
        setButtonLabel(button, result.message);
        return;
      }
      ++readRevision;
      sugCache = result.value;
      renderSugBox();
    });
    UI.act('sugDel', async (d) => {
      if (deleting || !inboxCurrent()) return;
      const ts = d?.ts;
      // Keep deletion tied to this inbox across confirmation and desktop writes.
      const btn = [.../** @type {NodeListOf<HTMLElement>} */ (inboxBody.querySelectorAll('.sugin-del'))].find((b) => b.dataset.ts === ts);
      if (!ts || !btn) return;
      const current = inboxCurrent;
      deleting = true;
      try {
        const accepted = await UI.confirmAction({ title:'删除这条留言？', message:'删除后无法恢复，可先导出这条留言。', confirmLabel:'删除留言',
          onConfirm: async () => {
            if (!current() || !Array.isArray(sugCache) || !sugCache.some(entry => entry?.ts === ts && !entry.done)) return false;
            // A read started before this write must never resurrect its deleted row.
            ++readRevision;
            if (!await removeSuggestion(ts)) throw new Error('删除失败，留言已保留，请重试。');
            return true;
          } });
        if (!accepted || !current()) return;
        sugCache = (sugCache || []).filter((e) => e?.ts !== ts);
        readSound().sfx('confirm');
        renderSugBox();
      } finally { deleting = false; }
    });
    onRender({ root:inboxRoot, revision:inboxRevision, isCurrent:inboxCurrent });
    readInbox(inboxBody);
    return inboxRoot;
  }

  return { openSuggestionInbox, openSuggestionBox };
}
