import { recordRestoreStage, traceRestoreStep } from '../core/flight-recorder.local.js';
import { performanceSettingsHTML, bindPerformanceSettings } from './performance-settings.js';
import { cancelPendingPageEntries } from './page-entry-cancellation.js';
import { appendLocalFeedback, completeLocalFeedback, downloadFeedbackRecord, downloadFeedbackRecords, readLocalFeedback, removeLocalFeedback } from './feedback.local.js';
import { captureBattleContext, invalidateBattleContext } from '../battle/battle-loader.js';
import { runTerminalSettlement } from './terminal-settlement.js';
import { storeGet, storeSet } from '../core/storage.js';
import { achievementGalleryHTML, bindAchievementGallery } from './achievement-gallery.js';
import { beginnerGuideHTML, beginnerGuidePageCount, updateBeginnerGuide } from './beginner-guide.js';
import { SLOT_EMBLEMS } from './slot-emblems.js';
import { bindSettingsAudio } from './settings-audio.js';
import { initSettingsNavigation } from './settings-navigation.js';
import { enterAchievementCut } from './camp-entry.js';
import { reduceMotion } from '../core/motion.js';
import '../../css/title-achievements.css';
import '../../css/beginner-guide.css';
import '../../css/archive-back.css';
import '../../css/leave-run.css';
import { linkedBackHTML } from './home-linked-interactions.js';
/* 标题、选档、离开与设置页面流程。只通过注入端口调用会话能力。 */

// 非首屏面板工厂；依赖会话能力与标题回调注入，不静态导入启动/会话模块。
export function createGameMenuPages(deps, shell) {
  const { SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
    saveGame, clearAllSlots, getActiveSlot, setActiveSlot, preflightRunMap,
    RunStorage, ensureBattleReady = async () => SDT.Battle, recoverSlotIfPending, terminalCommands, openDataPage } = deps;
  const { showTitle, hideTitle, pickLatestSlot, fmtPlayTime } = shell;


  // ---------- 首页留言：右键任意位置写给 Friday 的建议 ----------
  // 桌面版经 Electron IPC 写入仓库 output/suggestions.json；浏览器版退回 localStorage。
  // 每条建议携带 page（所在页面/弹层）、target（右键命中的 UI 位置）与 at（屏幕百分比坐标）。
  async function saveSuggestion(fields, target, at, page) {
    const entry = { ts: new Date().toISOString(), version: document.getElementById('gameVersion')?.textContent?.trim() || '未知',
      page: page || null, target: target || null, at: at || null, ...fields };
    if (window.sdtDesktop?.appendSuggestion) {
      try {
        const result = await window.sdtDesktop.appendSuggestion(entry);
        return result === true || result?.ok === true;
      } catch { return false; }
    }
    return appendLocalFeedback(entry).ok;
  }

  function openSuggestionBox(target, at, page) {
    const layer = document.getElementById('sugLayer');
    if (!layer || !layer.hidden) return;   // 已打开则忽略
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
    document.getElementById('sugHead').innerHTML = SDT.Icons.rich('[[icon:book]] 记录试玩反馈');
    document.getElementById('sugWhere').innerHTML = target
      ? `针对位置：<b>${esc(target.name)}</b>${at ? `（屏幕 ${at.x}%, ${at.y}%）` : ''}`
      : '';
    const ta = document.getElementById('sugText');
    const fields = ['sugText', 'sugSteps', 'sugExpected', 'sugActual'].map(id => document.getElementById(id));
    fields.forEach(el => { el.value = ''; });
    layer.hidden = false;
    const token = Symbol('suggestion'); layer._openToken = token;
    const saveBtn = document.getElementById('sugSaveBtn'); saveBtn.disabled = false;
    const close = () => {
      if (layer._openToken !== token) return;
      // 逻辑返回不等视觉淡出；较新页面或换局已经接管时只收起本留言层。
      if (sourceCurrent()) game.state = prevState;
      layer._openToken = null;
      UI.hideScreen(layer);
    };
    document.getElementById('sugCancelBtn').onclick = close;
    let busy = false;
    saveBtn.onclick = async () => {
      if (busy || layer._openToken !== token) return;
      const text = ta.value.trim();
      if (!text) return;
      busy = true; saveBtn.disabled = true;
      const payload = { text, steps: fields[1].value.trim(), expected: fields[2].value.trim(), actual: fields[3].value.trim() };
      let ok;   // 不做冗余初始化：try 内必赋值，catch 置 false，两路都在读取前完成赋值
      try { ok = await saveSuggestion(payload, target, at, page); }
      catch { ok = false; }
      if (layer._openToken !== token) return;
      busy = false; saveBtn.disabled = false;
      if (ok) {
        // 保存成功即自动退出留言界面、回原页面（close 的 token 守卫保证只退一次）；
        // 导出指引常驻表单下方静态提示，无需停留展示
        fields.forEach(el => { el.value = ''; });
        close();
        return;
      }
      document.getElementById('sugWhere').innerHTML = '写入失败，输入已保留，请重试。';
    };
    setTimeout(() => { if (layer._openToken === token) ta.focus(); }, 0);
  }

  // ---------- 留言库：设置页入口，查看历史留言与完成状态，未完成的可删除 ----------
  // 桌面版经 Electron IPC 读写 output/suggestions.json；浏览器版走 feedback.local.js 封装。
  // 浏览器留言可标记完成并保留原文；未完成条目显示删除键（两步确认）。
  async function loadSuggestions() {
    if (window.sdtDesktop?.readSuggestions) {
      try {
        const r = await window.sdtDesktop.readSuggestions();
        if (r?.ok && Array.isArray(r.list)) return r.list;
      } catch { /* 落回 localStorage */ }
    }
    const read = readLocalFeedback();
    return read.ok ? read.value : read;
  }

  async function removeSuggestion(ts) {
    if (window.sdtDesktop?.deleteSuggestion) {
      try {
        const result = await window.sdtDesktop.deleteSuggestion(ts);
        return result === true || result?.ok === true;
      } catch { return false; }
    }
    return removeLocalFeedback(ts);   // 存储收口批 2026-09-25：原内联直读写移入封装层，行为逐点等价
  }

  const fmtSugTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  let sugCache = null;   // 留言库打开期间的数据副本，删除后本地同步
  function sugRowHTML(e, done, index) {
    const page = e?.page?.name || (e?.target?.name ? String(e.target.name).split(' · ')[0] : '未知位置');
    const where = e?.target?.name || '';
    return `<div class="sugin-row${done ? ' done' : ''}">
      <div class="sugin-top">
        <span class="sugin-mark">${done ? '[[icon:check]]' : '[[icon:book]]'}</span>
        <span class="sugin-time">${fmtSugTime(e?.ts)}</span>
        <span class="sugin-page-name">${esc(page)}</span>
        <button class="mini-btn" data-act="sugExport" data-idx="${index}">导出此条</button>
        ${done ? '' : `<button class="mini-btn danger sugin-del" data-act="sugDel" data-ts="${esc(e?.ts || '')}">删除</button>`}
      </div>
      <div class="sugin-text">${esc(e?.text || '')}</div>
      <div class="sugin-where">版本：${esc(e?.version || '未知')}</div>
      ${e?.steps ? `<div class="sugin-detail"><b>复现步骤</b>${esc(e.steps)}</div>` : ''}
      ${e?.expected ? `<div class="sugin-detail"><b>期望结果</b>${esc(e.expected)}</div>` : ''}
      ${e?.actual ? `<div class="sugin-detail"><b>实际结果</b>${esc(e.actual)}</div>` : ''}
      ${where ? `<div class="sugin-where">${esc(where)}</div>` : ''}
      ${done || window.sdtDesktop?.readSuggestions ? '' : `<button class="mini-btn sugin-complete" data-act="sugDone" data-ts="${esc(e?.ts || '')}">标记完成</button>`}
    </div>`;
  }

  function renderSugBox() {
    const box = document.getElementById('sugBox');
    if (!box) return;
    const exportAll = document.querySelector('[data-act="sugExportAll"]');
    if (exportAll) {
      exportAll.disabled = !Array.isArray(sugCache) || !sugCache.length;
      exportAll.textContent = '全部导出';
    }
    if (!Array.isArray(sugCache)) { box.innerHTML = `<p class="ov-empty danger">${esc(sugCache?.message || '留言信箱读取失败，原数据已保留')}</p><button class="mini-btn" data-act="sugRetry">重新读取</button>`; return; }
    const list = sugCache.map((entry, index) => ({ entry, index })).reverse();
    const entries = list.map(x => x.entry);
    const pend = list.filter((x) => !x.entry?.done);
    const done = list.filter((x) => x.entry?.done);
    let html = `<p class="hint">共 ${list.length} 条留言 · 待处理 ${pend.length} · 已完成 ${done.length}。已完成的留言是历史档案；未完成的可删除，删除需点两次确认。</p>`;
    if (pend.length) html += `<h3 class="set-h">待处理 <span class="set-en">PENDING · ${pend.length}</span></h3>` + pend.map((x) => sugRowHTML(x.entry, false, x.index)).join('');
    html += `<h3 class="set-h">已完成 <span class="set-en">DONE · ${done.length}</span></h3>`;
    html += done.length ? done.map((x) => sugRowHTML(x.entry, true, x.index)).join('') : '<p class="ov-empty">还没有已完成的留言。</p>';
    if (!entries.length) html = `<div class="sugin-empty">
        <img class="se-art" src="assets/ui/sugin-mail-empty.webp" alt="雪地邮筒" draggable="false">
        <div class="se-text">
          <b>邮筒还是空的</b>
          <span>在游戏任意界面<b>点击右键</b>，就能给制作者写一张留言。</span>
          <span>保存后可点「全部导出」，一次导出所有留言的 JSON 交给制作者；处理完的留言会盖「已完成」章归档。</span>
        </div>
      </div>`;
    box.innerHTML = SDT.Icons.rich(html);
  }

  // W1-11：fromTitle=true（标题页入口进入）时，返回键回标题而非设置页
  let sugFromTitle = false;
  function openSuggestionInbox(fromTitle = false) {
    sugFromTitle = !!fromTitle;
    sugCache = null;
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page sugin-page">
        <!-- 09-23 留言：右下 BACK 取消，退出键改左上角，与主页退出键（ak-sq ak-exit）同款同位 -->
        ${linkedBackHTML('sugBack', fromTitle ? '返回' : '返回设置', 'sugin-exit')}
        <header class="pg-head"><h2>[[icon:book]] 留言信箱</h2><span class="pg-spacer"></span><button class="mini-btn" data-act="sugExportAll" title="导出全部待处理和已完成留言到一个 JSON 文件" disabled>全部导出</button></header>
        <div class="settings" id="sugBox"><p class="ov-empty">读取中…</p></div>
      </div>`, 'page');
    UI.act('sugBack', () => {
      if (sugFromTitle) { sugFromTitle = false; UI.hideOverlay(); game.state = 'title'; return; }
      openSettings();
    });
    UI.act('sugExport', d => {
      const entry = Array.isArray(sugCache) ? sugCache[+d.idx] : null; if (!entry) return;
      const btn = document.querySelector(`[data-act="sugExport"][data-idx="${+d.idx}"]`);
      const result = downloadFeedbackRecord(entry);
      if (btn) btn.textContent = result.ok ? '已导出' : '导出失败，请重试';
    });
    UI.act('sugExportAll', () => {
      if (!Array.isArray(sugCache) || !sugCache.length) return;
      const btn = document.querySelector('[data-act="sugExportAll"]');
      const result = downloadFeedbackRecords(sugCache);
      if (btn) btn.textContent = result.ok ? `已导出 ${sugCache.length} 条` : '导出失败，请重试';
    });
    UI.act('sugRetry', () => {
      const box = document.getElementById('sugBox');
      if (!box) return;
      box.innerHTML = '<p class="ov-empty">读取中…</p>';
      loadSuggestions().then(list => {
        if (document.getElementById('sugBox') !== box) return;
        sugCache = list;
        renderSugBox();
      });
    });
    UI.act('sugDone', d => {
      if (window.sdtDesktop?.readSuggestions || !d?.ts) return;
      const result = completeLocalFeedback(d.ts);
      if (!result.ok) {
        const button = [...document.querySelectorAll('.sugin-complete')].find(el => el.dataset.ts === d.ts);
        if (button) button.textContent = result.message;
        return;
      }
      sugCache = result.value;
      renderSugBox();
    });
    UI.act('sugDel', async (d) => {
      const ts = d?.ts;
      // UI.act 只回传 dataset，按钮要按 ts 从 DOM 反查（同 openSettings 的 armDanger 模式）
      const btn = [...document.querySelectorAll('#ovBody .sugin-del')].find((b) => b.dataset.ts === ts);
      if (!ts || !btn) return;
      if (!btn.dataset.confirm) {   // 两步确认：首次点击变「确认删除」，2.6 秒后还原
        btn.dataset.confirm = '1'; btn.textContent = '确认删除'; btn.classList.add('arm');
        setTimeout(() => {
          if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = '删除'; btn.classList.remove('arm'); }
        }, 2600);
        return;
      }
      if (await removeSuggestion(ts)) {
        sugCache = (sugCache || []).filter((e) => e?.ts !== ts);
        SDT.Sound.sfx('confirm');
        renderSugBox();
      } else {
        btn.textContent = '删除失败';
        setTimeout(() => { if (btn.isConnected) btn.textContent = '删除'; }, 1500);
      }
    });
    const inboxBody = document.getElementById('sugBox');
    loadSuggestions().then(list => {
      if (document.getElementById('sugBox') !== inboxBody) return;
      sugCache = list;
      renderSugBox();
    });
  }

  // 远征手册：只描述当前 Vite 版真实输入与流程
  // U9（2026-09-19 走查）：对局内也可打开（左上 ? 钮）——进入时记下原状态，返回恢复，
  // 不再把对局态改写成 title（标题页调用 prev='title'，行为不变）。
  function openTitleGuide() {
    const prevState = game.state;
    game.state = 'modal';
    const pageCount = beginnerGuidePageCount();
    let currentPage = 0;
    const renderPage = () => {
      const active = document.activeElement;
      const activeAction = active?.dataset?.act;
      const activePageIndex = active?.dataset?.pageIndex;
      const root = UI.el.ovBody.querySelector('.beginner-guide');
      if (root) updateBeginnerGuide(root, currentPage);
      else UI.showOverlay('远征新手指南', beginnerGuideHTML(currentPage), 'page');
      if (activeAction && activeAction !== 'guideBack') {
        const selector = activeAction === 'guidePage' && /^\d+$/.test(activePageIndex || '')
          ? `[data-act="guidePage"][data-page-index="${activePageIndex}"]`
          : `[data-act="${activeAction}"]`;
        const nextFocus = UI.el.ovBody.querySelector(selector);
        (nextFocus?.disabled ? UI.el.ovBody.querySelector('.bg-nav-item[aria-current="step"]') : nextFocus)?.focus({ preventScroll: true });
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
      if (game.battleActive && SDT.Battle && SDT.Battle.commands && SDT.Battle.commands.refreshView) {
        SDT.Battle.commands.refreshView();
      }
    });
  }

  // 成就总览：以最近游玩档位的基地档案为准（只读；领奖需进入基地）
  function openTitleAchievements() {
    const latest = pickLatestSlot();
    const base = latest?.base || null;
    game.state = 'modal';
    UI.showOverlay('成就总览', achievementGalleryHTML({
      achievements: SDT.Meta.ACHIEVEMENTS, base, slot: latest?.slot,
      isUnlocked: (achievement, snapshot) => SDT.Meta.isUnlocked(achievement, snapshot),
      backs: SDT.Cards.CARD_BACKS || [], cards: SDT.Cards.all(),
    }), 'page');
    const page = UI.el.ovBody.querySelector('.achievement-gallery');
    const gallery = bindAchievementGallery(page);
    const clearCut = enterAchievementCut(page, reduceMotion());
    UI.act('achBack', () => {
      if (gallery.closeDetail()) return;
      clearCut();
      UI.hideOverlay(); game.state = 'title';
    });
  }

  // 选档徽记：透明底蓝金切角印章，五种图形在独立美术模块中维护。
  const SLOT_ICONS = SLOT_EMBLEMS;

  // 选档页背景：CSS/SVG 手绘（蓝紫雾气 + 发光鹿马剪影 + 鸟群 + 光斑，缓慢漂移呼吸）
  const SLOT_BG_SILHOUETTES = `
    <svg class="sil sil-horse" viewBox="0 0 200 170" aria-hidden="true">
      <path fill="currentColor" d="M52 148 l4-52 c-16-6-24-18-22-34 2-14 14-24 30-26
        6-16 22-26 40-24 l4-14 8 16 c16 4 26 14 28 28 l22 4 c8 2 12 9 8 15 l-20 6
        -6 34 -8 47 h-10 l-2-46 -28 4 -4 42 h-10 l-3-42 -14 1 -5 41 Z"/>
    </svg>
    <svg class="sil sil-deer" viewBox="0 0 220 190" aria-hidden="true">
      <g stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M120 44 C112 30 112 20 118 8 M118 22 l-12-10 M118 16 l12-12 M116 30 l-10 2 M118 26 l12 0"/>
        <path d="M104 46 C96 34 94 24 98 12 M99 26 l-11-8 M98 18 l10-10"/>
      </g>
      <path fill="currentColor" d="M118 44 c20-2 36 8 42 24 l26 4 c9 2 12 10 7 16 l-22 7
        -7 30 -7 52 h-10 l-3-50 -34 4 -4 46 h-10 l-4-46 -18-2 -7 48 h-10 l-3-50
        c-14-6-21-17-19-30 2-15 15-25 32-26 10-16 30-25 51-27 Z"/>
    </svg>
    <svg class="sil-birds" viewBox="0 0 420 70" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <path d="M10 40 q9-11 18 0 q9-11 18 0"/>
        <path d="M90 18 q7-9 14 0 q7-9 14 0"/>
        <path d="M180 44 q8-10 16 0 q8-10 16 0"/>
        <path d="M300 22 q6-8 12 0 q6-8 12 0"/>
        <path d="M370 46 q7-9 14 0 q7-9 14 0"/>
      </g>
    </svg>`;

  // 档位卡信息：进行中对局的进度、最近保存时间、累计游玩时间和成就。
  function slotInfoHTML(baseData, run) {
    if (!baseData && !run) return '<span class="slot-empty">尚未建立存档</span>';
    const total = Math.max(baseData?.stats?.playSeconds || 0, run?.elapsed || 0);
    const names = baseData
      ? SDT.Meta.ACHIEVEMENTS.filter(a => SDT.Meta.isUnlocked(a, baseData)).map(a => a.name)
      : [];
    const prog = run
      ? `<div class="si-line si-progress"><em>PROGRESS</em>当前进度<b>${run.nestActive ? '研究所远征进行中' :`第 ${(run.layerIdx ?? 0) + 1} 层 · ${esc(run.myClass || '未选人物')}`}</b></div>`
      : '';
    const saved = Number(run?.savedAt) > 0 ? new Date(Number(run.savedAt)) : null;
    const p = (n) => String(n).padStart(2, '0');
    const savedLine = saved && !Number.isNaN(saved.getTime())
      ? `<div class="si-line si-saved"><em>SAVED</em>上次保存 ${p(saved.getMonth() + 1)}-${p(saved.getDate())} ${p(saved.getHours())}:${p(saved.getMinutes())}</div>`
      : '';
    return prog +
      savedLine +
      `<div class="si-line"><em>PLAYTIME</em>游玩时间 <b class="num">${total > 0 ? fmtPlayTime(total) : '暂无记录'}</b></div>` +
      `<div class="si-line"><em>ACHIEVEMENTS</em>已解锁成就 <b class="num">${names.length}</b>` +
      `${names.length ? `<span class="si-sub">${esc(names.join('、'))}</span>` : ''}</div>`;
  }

  // 选档页：参照明日方舟「选择分队」的横排暗色卡片（居中发光图标 + 档名 + 分隔线 + 描述）。
  // 空档 = 压暗的箱柜图标，点击开新档；有档 = 发亮的存档图标，点击直接进入。
  function openSlotPicker() {
    cancelPendingPageEntries('menu');
    game.state = 'modal';
    const cards = [];
    const slotErrors = [];
    const latest = pickLatestSlot();
    for (let i = 1; i <= SLOT_COUNT; i++) {
      // F1 兜底（2026-09-24）：单档渲染异常只降级该档卡片并给出可见错误，
      // 不再让整个选档页卡死在 game.state='modal'；catch 内不写任何档，原档保留
      try {
        const run = readSlot(i);
        const baseData = SDT.Base.peek(i);
        const exists = !!run || !!baseData;
        const recent = !!run?.savedAt && latest?.slot === i && latest.ts > 0;
        const state = run ? 'run' : baseData ? 'base' : 'empty';
        const status = recent ? '最近游玩 · 对局进行中' : run ? '对局进行中' : baseData ? '基地档案' : '空档位';
        const cta = !exists ? '开新档 <i class="en">NEW GAME</i>'
          : run ? '继续对局 <i class="en">CONTINUE</i>' : '进入存档 <i class="en">ENTER</i>';
       cards.push(`<article class="slot-card slot-art-${i} slot-state-${state}${exists ? ' filled' : ''}${recent ? ' slot-recent' : ''}">
        <i class="slot-card-bg" aria-hidden="true"></i>
        <i class="slot-card-light" aria-hidden="true"></i>
        <i class="slot-card-flakes" aria-hidden="true">${'<i></i>'.repeat(7)}</i>
        <span class="slot-card-art">${SLOT_ICONS[i - 1]}<i class="slot-card-spark"></i></span>
        <b class="slot-card-name">档位 0${i}</b>
        <span class="slot-card-sub">SLOT 0${i}</span>
        <span class="slot-card-status">${status}</span>
        <i class="slot-card-rule"></i>
        <span class="slot-card-desc">${slotInfoHTML(baseData, run)}</span>
       <button class="slot-card-cta" data-act="${exists ? 'enterSlot' : 'newSlot'}" data-slot="${i}" aria-label="${exists ? '进入档位 0' + i : '在档位 0' + i + ' 开始新游戏'}">${cta}</button>
        ${exists ? `<span class="slot-card-ops">
          <button class="mini-btn" data-act="overwriteSlot" data-slot="${i}">覆盖重开</button>
          <button class="mini-btn danger" data-act="delSlot" data-slot="${i}">删除</button>
        </span>` : ''}
     </article>`);
      } catch (e) {
        // 异常档渲染为不可进入的降级卡片（不给破坏性入口），页面继续展示其余档位
        console.warn(`[menu] 档位 ${i} 存档渲染异常，原档已保留未写回：`, e);
        slotErrors.push(i);
        cards.push(`<article class="slot-card slot-art-${i} slot-state-empty">
        <i class="slot-card-bg" aria-hidden="true"></i>
        <b class="slot-card-name">档位 0${i}</b>
        <span class="slot-card-sub">SLOT 0${i}</span>
        <span class="slot-card-status">档案数据异常</span>
        <i class="slot-card-rule"></i>
        <span class="slot-card-desc">该档位数据读取失败，原档已保留未写回；请重试或联系开发者排查</span>
       </article>`);
      }
    }
    UI.showOverlay('', `
      <div class="pg slot-page">
        <div class="slot-bg" aria-hidden="true">
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          ${SLOT_BG_SILHOUETTES}
        </div>
        <!-- 选档、基地、地图退出键统一沿 archive-back.css。 -->
        <button class="archive-back" data-act="slotBack" aria-label="返回主菜单" title="返回主菜单（Esc）"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <header class="slot-page-head">
          <span class="section-kicker">SELECT ARCHIVE</span>
          <span class="slot-page-en">选择存档</span>
          <i class="slot-page-rule"></i>
        </header>
        <p id="slotRestoreError" class="slot-restore-error" role="alert" aria-live="assertive" hidden></p>
        <div class="slot-deck">${cards.join('')}</div>
      </div>`, 'page');
    // F1 兜底（2026-09-24）：有档位渲染异常时在页面上给出可见提示（不阻塞其余档位）
    if (slotErrors.length) {
      const msg = `档位 ${slotErrors.map(i => '0' + i).join('、')} 存档数据异常，已保留原档未写回`;
      console.warn('[menu] ' + msg);
      const errEl = document.getElementById('slotRestoreError');
      if (errEl) { errEl.hidden = false; errEl.textContent = msg; }
    }
    // 进入档位：加载该档基地并执行后续（续打 / 进基地）
    const launch = async (slot, fn, keepPicker = false) => {
      invalidateBattleContext(game);
      // 基地直接承接选档画面，由视觉层保留退场副本；续局仍沿既有关闭流程。
      if (!keepPicker) UI.hideOverlay();
      hideTitle();
      UI.clearLog();
      setActiveSlot(slot);
      SDT.Base.use(slot);
      // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：仓库/口袋副本同步更名
      // 2026-09-29 收敛：直改 Base.data 后保存的迁移块移入 Base.applyStoredCardRenames
      SDT.Base.applyStoredCardRenames();
      const bi = SDT.Base.issue(slot);
      if (bi === 'corrupt') UI.log('[[icon:cross]] 该档位基地数据损坏（原数据已备份），本次以空档案启动', 'warn');
      else if (bi === 'tooNew') UI.log('[[icon:cross]] 该档位基地数据来自更新版本的游戏，已以空档案启动', 'warn');
      const result = await fn();
      if (result === false) return false;
      UI.log(`[[icon:archive]] 已进入 <b>档位 ${slot}</b>（基地与进度独立保存到该档位）`, 'sys');
      return result;
    };
    // 两步确认（首次点击变为「确认？」，2.6 秒后还原）
    const armConfirm = (sel, armedText, normalText) => {
      const btn = document.querySelector(`#ovBody ${sel}`);
      if (!btn || btn.dataset.confirm) return true;
      btn.dataset.confirm = '1'; btn.textContent = armedText; btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = normalText; btn.classList.remove('arm'); }
      }, 2600);
      return false;
    };
    let enteringSlot = false;
    const restoreError = message => {
      UI.log(`[[icon:cross]] ${message}`, 'warn');
      const visible = document.getElementById('slotRestoreError');
      if (visible) { visible.hidden = false; visible.textContent = message; visible.tabIndex = -1; visible.focus(); }
    };
    const returnToPicker = message => {
      showTitle();
      openSlotPicker();
      restoreError(message);
      return false;
    };
    const resetAndLaunch = async slot => {
      if (enteringSlot) return false;
      enteringSlot = true;
      const picker = document.querySelector('.slot-page');
      let currentContext;
      try {
        // 初始化先确认落盘；等待页面期间连点不能再次重置档案。
        SDT.Base.use(slot);
        if (SDT.Base.reset(slot) === false) {
          restoreError('档位初始化未保存，请检查存储空间或档位变化后重试；尚未进入基地');
          return false;
        }
        return await launch(slot, async () => {
          currentContext = captureBattleContext(game, getActiveSlot);
          const opened = await runtime.openBaseHub('deploy');
          if (opened === false && currentContext() && picker?.isConnected) {
            return returnToPicker('基地尚未打开，可重新进入；档案已保留');
          }
          return opened;
        }, true);
      } catch {
        if (currentContext?.() && picker?.isConnected) return returnToPicker('进入基地失败，请重试；档案已保留');
        return false;
      } finally { enteringSlot = false; }
    };
    UI.act('newSlot', (d) => resetAndLaunch(+d.slot));
    UI.act('enterSlot', async (d) => {
      if (enteringSlot) return false;
      enteringSlot = true;
      try {
        const slot = +d.slot;
        const pickerPage = document.querySelector('.slot-page');
        const pickerContext = captureBattleContext(game, getActiveSlot);
        if (recoverSlotIfPending) {
          const picker = document.getElementById('slotRestoreError');
          try {
            const recovered = await recoverSlotIfPending(slot);
            if (!pickerContext() || (picker && !picker.isConnected)) return false;
            if (!recovered.ok) {
              restoreError(`${recovered.message || '存档恢复尚未完成'}；原档与恢复记录已保留，请重试进入该档位`);
              return false;
            }
          } catch {
            if (pickerContext() && (!picker || picker.isConnected)) restoreError('存档恢复失败；原档与恢复记录已保留，请重试进入该档位');
            return false;
          }
        }
        const hasSavedRun = RunStorage.has(slot);
        if (hasSavedRun) {
          const checked = preflightRunMap(slot);
          if (!checked.ok) {
            const message=`${checked.message || '路线存档无法安全恢复'}，原档已保留；请稍后用兼容版本重试，或显式覆盖档位`;
            restoreError(message);
            return false;
          }
        }
        return await launch(slot, async () => {
          // launch 已切到目标档位；之后合法的 modal/idle 切换不更换归属。
          const currentContext = captureBattleContext(game, getActiveSlot);
          // 仅供 Agent 对本次 enterSlot 的合法换局做核验；不代表已持久化。
          const completed = () => ({ ok: true, commandContext: {
            slot: getActiveSlot(), runToken: game.discoveredPairs, nestToken: game.nestRunes,
            runActive: game.runActive, nestActive: game.nestActive,
          } });
          let transition;
          try {
            // 上一局未结束直接回局内；有档但恢复失败则保留原档回标题。
            if (hasSavedRun) {
              // 先播转场再读档，避免转场结束改写 Battle.restore 的 modal 状态。
              transition = runtime.showRunTransition({
                tone: 'door', asset: 'scene-door-bg',
                eyebrow: 'EXPEDITION RESUMED', title: '继续对局',
                detail: '欢迎回到战场',
                duration: 900,
                presentation: 'city-cut',
                holdVisual: true,
              });
              if (import.meta.env.DEV) recordRestoreStage('transition-mounted');
              // 显示过场后立即预热，模块和地图素材加载与演出重叠。
              const resources = Promise.all([
                import.meta.env.DEV ? traceRestoreStep('battle-module', () => ensureBattleReady()) : ensureBattleReady(),
                import.meta.env.DEV ? traceRestoreStep('map-warm', () => SDT.Renderer?.warm?.()) : SDT.Renderer?.warm?.(),
              ])
                .then(() => ({ ok: true }), error => ({ ok: false, error }));
              if (await transition === false || !transition.isCurrent() || !currentContext()) return false;
              // 存档可能包含战斗快照；必须先加载战斗域，loadGame 才能同步 restore。
              const warmed = await resources;
              if (!warmed.ok) throw warmed.error;
              if (!transition.isCurrent() || !currentContext()) return false;
              const loaded = loadGame(slot);
              if (!loaded.ok) {
                RunStorage.issue(slot);
                return returnToPicker(`${loaded.message || '对局存档读取失败'}；原档已保留，请重试进入该档位`);
              }
              const resumedContext = captureBattleContext(game, getActiveSlot);
              if (loaded.classChoiceEntry) {
                const sourceBody = document.getElementById('ovBody');
                const sourceRoot = sourceBody?.firstElementChild;
                const sourceHidden = UI.el.overlay.hidden;
                if (await loaded.classChoiceEntry === false) {
                  if (resumedContext() && document.getElementById('ovBody') === sourceBody &&
                    sourceBody?.firstElementChild === sourceRoot && UI.el.overlay.hidden === sourceHidden) return returnToPicker('人物选择尚未打开，可重试进入；对局进度已保留');
                  return false;
                }
                if (!resumedContext()) return false;
              }
              if (game.state === 'idle' && game.runActive && !game.nestActive && !game.battleActive) {
                // 等对局布局落定，遮层下面画好目标尺寸/镜头的首帧，再揭幕。
                await new Promise(resolve => {
                  const timer = setTimeout(resolve, 160);
                  requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
                });
                if (!resumedContext()) return false;
                runtime.resize();
                await SDT.Renderer?.prepare?.(game, resumedContext);
                if (!resumedContext()) return false;
              }
              await transition.release?.();
              return completed();
            }
            if (await runtime.openBaseHub('deploy') === false) {
              if (currentContext() && pickerPage?.isConnected) return returnToPicker('基地尚未打开，可重新进入；档案已保留');
              return false;
            }
            return completed();
          } catch {
            if (!currentContext() || (transition && !transition.isCurrent()) || (!hasSavedRun && !pickerPage?.isConnected)) return false;
            return returnToPicker('进入档位失败，请刷新页面后重试；原档已保留');
          } finally {
            // 异常或取消时也释放自有遮层；不会收掉恢复流程打开的新页面。
            await transition?.release?.({ immediate: true });
          }
        }, !hasSavedRun);
      } finally { enteringSlot = false; }
    });
    UI.act('overwriteSlot', (d) => {
      if (enteringSlot) return;
      if (!armConfirm(`[data-act="overwriteSlot"][data-slot="${d.slot}"]`, '确认重开？', '覆盖重开')) return;
      const cleared = clearSlot(+d.slot);
      if (cleared === false || cleared?.ok === false) {
        restoreError(`档位 ${d.slot} ${cleared?.message || '删除未完成，请重试'}；尚未重开`);
        return false;
      }
      return resetAndLaunch(+d.slot);
    });
    UI.act('delSlot', (d) => {
      if (enteringSlot) return;
      if (!armConfirm(`[data-act="delSlot"][data-slot="${d.slot}"]`, '确认删除？', '删除')) return;
      const cleared = clearSlot(+d.slot);
      if (cleared === false || cleared?.ok === false) {
        restoreError(`档位 ${d.slot} ${cleared?.message || '删除未完成，请重试'}`);
        return false;
      }
      UI.log(`[[icon:trash]] 已删除【档位 ${d.slot}】的存档（含基地数据）`, 'warn');
      openSlotPicker();   // 重绘档位列表
    });
    UI.act('slotBack', () => { UI.hideOverlay(); showTitle(); });
  }

  function startNewGame() { openSlotPicker(); }

  // ---------- 离开对局 / 放弃对局（v0.21 设计者规则） ----------
  // 放弃对局：带入本局的卡牌【全部】丢失；对局中获得的卡牌只有安全格里的
  // 会被宠物运回基地；物资/金币/消耗区全部散失。
  let leaveView = null;
  function leavePanel(title, step, content, initialFocus) {
    const view = { step, busy:false };
    leaveView = view;
    UI.showOverlay(title, `<section class="leave-run-panel glass-panel" data-leave-step="${step}">${content}</section>`, 'glass', { initialFocus, motionKey: `leave/${step}` });
    return view;
  }
  function leaveViewCurrent(view) {
    return leaveView === view && !view.busy && !!document.querySelector(`[data-leave-step="${view.step}"]`);
  }
  function setLeaveBusy(view, busy) {
    view.busy = busy;
    const panel = document.querySelector('.leave-run-panel');
    panel?.setAttribute('aria-busy', String(busy));
    panel?.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  function openLeaveMenu() {
    game.state = 'modal';
    const slot = getActiveSlot();
    const place = game.layerData?.[game.layerIdx]?.name || '本次远征';
    const view = leavePanel('离开对局', 'choice', `
      <div class="leave-run-context"><span>${slot ? `档位 ${String(slot).padStart(2, '0')}` : '临时对局'}</span><span>${esc(place)}</span></div>
      <p class="leave-run-description">${slot ? '保存这次远征，返回主菜单。下次进入此档位时，可从当前进度继续。' : '当前对局未关联档位，无法保存。你仍可继续游玩。'}</p>
      <p class="leave-run-status" role="status" aria-live="polite" hidden></p>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveCancel" aria-label="返回对局，继续游玩">继续游玩</button>
        <button type="button" class="leave-run-save" data-act="leaveSave"${slot ? '' : ' disabled'}>[[icon:save]] 保存并退出</button>
      </div>
      <div class="leave-run-secondary"><button type="button" data-act="leaveAbandon">放弃本次对局 <span aria-hidden="true">→</span></button></div>`, '[data-act="leaveCancel"]');
    UI.act('leaveSave', async () => {
      if (!leaveViewCurrent(view) || !getActiveSlot()) return false;
      setLeaveBusy(view, true);
      const button = document.querySelector('[data-act="leaveSave"]');
      if (button) button.textContent = '正在保存…';
      game.state = 'idle';
      let saved = false;
      try { saved = await saveGame(); }
      catch (error) { console.error('[leave-run] 保存退出失败', error); }
      if (leaveView !== view) return false;
      if (saved !== true) {
        game.state = 'modal';
        setLeaveBusy(view, false);
        if (button) button.textContent = '重试保存并退出';
        const status = document.querySelector('.leave-run-status');
        if (status) { status.hidden = false; status.textContent = '本次进度未能保存。当前对局仍在，可重试或继续游玩。'; }
        return false;
      }
      leaveView = null;
      UI.hideOverlay();
      showTitle();
      return true;
    });
    UI.act('leaveCancel', () => {
      if (!leaveViewCurrent(view)) return;
      leaveView = null; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game);
    });
    UI.act('leaveAbandon', () => {
      if (leaveViewCurrent(view)) openAbandonConfirmation();
    });
  }

  function openAbandonConfirmation() {
    const safeCount = game.ownedCards.filter(card => card.safe && !card.brought).length;
    const view = leavePanel('确认放弃本次对局？', 'abandon', `
      <p class="leave-run-warning">放弃后，本次远征将结束。</p>
      <dl class="leave-run-consequences">
        <div><dt>将失去</dt><dd>带入的全部卡牌、未存入安全格的本局所得，以及金币、物资和消耗区。</dd></div>
        <div><dt>可带回</dt><dd>本局获得并已存入安全格的卡牌${safeCount ? `（${safeCount} 张）` : '（当前没有）'}。</dd></div>
      </dl>
      <div class="leave-run-actions">
        <button type="button" class="leave-run-continue" data-act="leaveReviewBack">返回</button>
        <button type="button" class="leave-run-danger" data-act="leaveAbandonConfirm">确认放弃</button>
      </div>`, '[data-act="leaveReviewBack"]');
    UI.act('leaveReviewBack', () => { if (leaveViewCurrent(view)) openLeaveMenu(); });
    UI.act('leaveAbandonConfirm', () => {
      if (!leaveViewCurrent(view)) return false;
      setLeaveBusy(view, true);
      leaveView = null;
      const button = document.querySelector('[data-act="leaveAbandonConfirm"]');
      if (button) button.textContent = '正在结算…';
      return abandonRun();
    });
  }

  function abandonRun() {
    if (!game.runActive || game.terminalPending) return false;
    const slotId = getActiveSlot();
    const token = {
      kind: 'abandon', slotId, cards: game.ownedCards.filter(o => o.safe && !o.brought).map(o => ({ card: o.card, count: 1 })),
      broughtN: game.ownedCards.filter(o => o.brought).length, attempt: null, busy: false, promise: null, ephemeral: !slotId,
    };
    game.terminalPending = token;
    game.state = 'terminalPending';
    const current = () => game.terminalPending === token && getActiveSlot() === token.slotId;
    const finish = () => {
      if (!current()) return false;
      game.terminalPending = null;
      game.state = 'done';
      game.runActive = false;
      SDT.Agent?.recorder?.recordRun('abandon', { savedCards: token.cards });   // 跑局统计（数据分析系统）
      SDT.Sound.sfx('defeat');
      SDT.Sound.music('title');
      if (token.ephemeral) UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
      const kept = token.cards;
      const keptMap = new Map();
      kept.forEach(o => {
        const k = o.card.name;
        if (!keptMap.has(k)) keptMap.set(k, { card: o.card, count: 0 });
        keptMap.get(k).count++;
      });
      const keptList = [...keptMap.values()];
      UI.log('<b>[[icon:flag]] 已放弃对局</b>：带入的卡牌全部遗失，物资与金币散失', 'warn');
      // 抢运回的卡用卡面网格（A5-ABANDON-01，与死亡页 doom-loot 同构；样式复用 overlays.css 无作用域
      // 的 .doom-loot/.doom-cards 家族；禁止套死亡页的外层 doom 玻璃容器——会改变放弃页标准弹层外观）；
      // 散失损失仍走 ov-stats/ov-note 文本行（散失=文本是既定口径）
      const keptHTML = keptList.length
        ? `<div class="doom-loot"><p class="doom-loot-h">[[icon:lock]] 宠物从安全格抢运回 <b>${kept.length}</b> 张对局中获得的卡牌</p><div class="doom-cards">${keptList.slice(0, 6).map((s, i) =>
            `<span class="doom-card" style="--i:${i}">${SDT.Cards.cardHTML(s.card, 'sm')}</span>`).join('')}${keptList.length > 6 ? `<span class="doom-more">还有 ${keptList.slice(6).reduce((n, s) => n + s.count, 0)} 张</span>` : ''}</div></div>`
        : '<p class="ov-note">安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。</p>';
      UI.showOverlay('已放弃对局', `<section class="leave-run-panel glass-panel" data-leave-step="complete">
        <p class="ov-stats">带入本局的 <b>${token.broughtN}</b> 张卡牌全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；
          物资与 <b class="gold">${game.coins} 币</b>一并散失。</p>
        ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
        ${keptHTML}
        <div class="leave-run-actions">
          <button type="button" class="leave-run-continue" data-act="goBase">回基地</button>
          <button type="button" class="leave-run-save" data-act="toTitle">回主菜单</button>
        </div></section>`, 'glass', { initialFocus:'[data-act="goBase"]' });
      UI.act('goBase', () => runtime.openBaseHub('deploy'));
      UI.act('toTitle', () => { UI.hideOverlay(); showTitle(); });
      UI.refresh(game);
      return true;
    };
    return runTerminalSettlement({
      token, current, game, UI, finish: () => finish(),
      command: 'run.abandon', retryAct: 'retryAbandon',
      slotId, terminalCommands,
    });
  }

  // ---------- 跑局数据（W1-01：入口=设置页；W2-06：页头行+布局收敛） ----------
  // agent.data.js 的 openDataPage 渲染 .pg hub 但无页头/返回件（原唯一进入=Alt+9，离开仅靠
  // 隐式 Esc/点背景）。此处包装：
  //   ① 注入全站统一 .ak-sq.ak-exit.ak-back-tl 返回键（点击=hideOverlay，等价 Esc 语义；
  //      数据页不持有 game.state 无需复位），从设置页进入时返回键回设置页；
  //   ② 注入 .data-pg-head 页头行（W2-06：返回件不再叠「总局数」KPI 卡，KPI 区下让位）；
  //   ③ .data-tuned 类激活 page-datapage.css（导出/清空钮收敛正常尺寸右对齐）。
  // 「清空记录」会整页重渲染——MutationObserver 防丢：ovBody 一有变动就补注。
  // 全仓只保有一个活观察器；inject 带 .doom-stats 内容校验——台面上的 .pg 确为
  // 跑局数据页才注入。旧实现只认 .pg：设置→数据→返回键回设置页时，hideOverlay 的
  // 210ms 淡出期间观察器仍活着，设置页一换上就被误注数据页页头（2026-09-28 修复）。
  let dataPageMo = null;
  function openDataPageUi(fromSettings = false) {
    openDataPage();
    const ovBody = UI.el && UI.el.ovBody;
    if (!ovBody) return;
    const inject = () => {
      if (!UI.el.overlay || UI.el.overlay.hidden) return;
      const pg = ovBody.querySelector('.pg');
      if (!pg || !pg.querySelector('.doom-stats')) return;
      const fresh = !pg.classList.contains('data-tuned');
      if (fresh) {
        pg.classList.add('data-tuned');
        const head = document.createElement('header');
        head.className = 'pg-head data-pg-head';
        let title = '跑局数据';
        try { title = SDT.Icons.rich('[[icon:chart]] 跑局数据'); } catch { /* 图标宏失败退纯文字 */ }
        head.innerHTML = `<span class="section-kicker">RUN DATA // 09</span><h2>${title}</h2><span class="pg-spacer"></span>`;
        pg.prepend(head);
      }
      if (!pg.querySelector('.ak-back-tl')) {
        const btn = document.createElement('button');
        btn.className = 'ak-sq ak-exit ak-back-tl';
        btn.title = '返回（Esc）';
        btn.setAttribute('aria-label', '返回');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">'
          + '<path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
          + '<path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btn.addEventListener('click', () => {
          UI.hideOverlay();
          if (fromSettings) openSettings();   // 从设置页进来：返回键回设置页，而非落到标题
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

  // ---------- 设置（标题界面调用） ----------
  function openSettings() {
    cancelPendingPageEntries('menu');
    const prev = game.state;
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page">
        <!-- 2026-09-07 留言：右上叉号去掉。2026-09-25 老板：返回键统一 = 主页左上退出键
             （ak-sq ak-exit）同款同位，底部大返回钮取消，Esc 仍可关 -->
        ${linkedBackHTML('closeSettings', '返回', 'ak-back-tl')}
        <header class="pg-head"><h2>设置</h2><span class="pg-spacer"></span></header>
        <div class="settings settings-layout">
        <section class="settings-group settings-general">
        <h3 class="set-h">[[icon:gear]] 通用 <span class="set-en">GENERAL</span></h3>
        <label class="chk"><input type="checkbox" id="setIndex" ${game.toggles.index ? 'checked' : ''}> 结点编号 <span class="set-en">NODE NUMBERS</span></label>
        <label class="chk"><input type="checkbox" id="setHint" ${storeGet('sdt-hintbar') !== '0' ? 'checked' : ''}> 底部操作提示条 <span class="set-en">HINT BAR</span></label>
        <label class="chk"><input type="checkbox" id="setBanner" ${storeGet('sdt-banner') !== '0' ? 'checked' : ''}> 环层横幅 <span class="set-en">LAYER BANNER</span></label>
        <label class="chk"><input type="checkbox" id="setDev" ${game.devMode ? 'checked' : ''}> 开发者模式（测试工具） <span class="set-en">DEVELOPER</span></label>
        </section>
        <section class="settings-group settings-display">
        <h3 class="set-h">[[icon:gear]] 画面与反馈 <span class="set-en">DISPLAY &amp; ACCESS</span></h3>
        ${performanceSettingsHTML()}
        <label class="chk"><input type="checkbox" id="setShake" ${storeGet('sdt-reduce-shake') === '1' ? '' : 'checked'}> 屏幕震动反馈 <span class="set-en">SCREEN SHAKE</span></label>
        <label class="chk"><input type="checkbox" id="setReduceMotion" ${storeGet('sdt-reduce-motion') === '1' ? 'checked' : ''}> 减少动态效果 <span class="set-en">REDUCE MOTION</span></label>
        </section>
        <section class="settings-group settings-audio">
        <h3 class="set-h">[[icon:gear]] 音频 <span class="set-en">AUDIO</span></h3>
        <label class="chk"><input type="checkbox" id="setMusic" ${SDT.Sound.musicMuted ? '' : 'checked'}> 背景音乐 <span class="set-en">MUSIC</span></label>
        <label class="chk vol"><span>音乐音量 <span class="set-en">MUSIC VOL</span></span><input type="range" id="setMusicVol" min="0" max="100" value="${Math.round(SDT.Sound.musicVolume * 100)}"><b id="setMusicVolVal">${Math.round(SDT.Sound.musicVolume * 100)}</b></label>
        <div class="settings-music-recovery">
          <p class="hint" id="setMusicStatus" role="status" aria-live="polite"></p>
          <button class="mini-btn" type="button" id="setMusicRetry" hidden>重试加载音乐</button>
        </div>
        <label class="chk"><input type="checkbox" id="setSfx" ${SDT.Sound.sfxMuted ? '' : 'checked'}> 音效 <span class="set-en">SOUND FX</span></label>
        <label class="chk vol"><span>音效音量 <span class="set-en">SFX VOL</span></span><input type="range" id="setSfxVol" min="0" max="100" value="${Math.round(SDT.Sound.sfxVolume * 100)}"><b id="setSfxVolVal">${Math.round(SDT.Sound.sfxVolume * 100)}</b></label>
        <p class="hint">音乐与音效可分别调节，修改自动保存。侧边栏按钮控制全局静音。</p>
        </section>
        <section class="settings-group settings-credits">
        <h3 class="set-h">[[icon:trophy]] 致谢 <span class="set-en">CREDITS</span></h3>
        <p class="hint"><strong>图标</strong><span>game-icons.net · Lorc、Delapouite、Carl Olsen、Caro Asercion<br><span class="license">CC-BY 3.0</span></span></p>
        <p class="hint"><strong>战斗音效</strong><span>rubberduck、Tinysized、Kenney 等创作者<br><span class="license">CC0</span></span></p>
        <p><a class="ov-btn" href="./assets/sfx/battle/SOURCES.md" target="_blank" rel="noopener">查看音效来源 <span class="settings-external" aria-hidden="true">↗</span></a></p>
        </section>
        <section class="settings-group settings-records">
        <h3 class="set-h">[[icon:book]] 留言信箱 <span class="set-en">SUGGESTION BOX</span></h3>
        <div class="btn-row"><button class="mini-btn" data-act="openInbox">查看历史留言</button></div>
        <h3 class="set-h">[[icon:chart]] 跑局数据 <span class="set-en">RUN DATA</span></h3>
        <!-- W1-01：数据页原唯一入口=Alt+9 不可发现，设置页加可见入口 -->
        <div class="btn-row"><button class="mini-btn" data-act="openDataPageUi">查看跑局数据</button></div>
        </section>
        <section class="settings-group settings-danger">
        <h3 class="set-h">危险区 <span class="set-en">DANGER ZONE</span></h3>
        <!-- W1-08：三枚不可逆钮原同排等权——按危险度分级：低危两枚一排，清档独占一排加重 -->
        <div class="btn-row">
          <button class="mini-btn danger" data-act="wipeNotes">清空格子备注</button>
          <button class="mini-btn danger" data-act="wipeCards">清空卡牌库</button>
        </div>
        <div class="btn-row danger-row">
          <button class="mini-btn danger danger-max" data-act="wipeSave">清空全部存档</button>
        </div>
        <p class="hint">清空操作需点击两次确认，完成后无法恢复。<br>「清空全部存档」会删除五个档位的全部档案。</p>
        </section>
        </div><!-- /.settings -->
      </div><!-- /.pg -->`, 'page');
    initSettingsNavigation(UI.el.ovBody.querySelector('.settings-page'));
    bindPerformanceSettings(UI.el.ovBody);
    const sync = () => {
      if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index;
      runtime.syncDevVisibility();
    };
    // 危险操作两步确认：首次点击变为「确认？」，2.6 秒后还原
    const armDanger = (act, armedText) => {
      const btn = document.querySelector(`#ovBody [data-act="${act}"]`);
      if (!btn || btn.dataset.confirm) { SDT.Sound.sfx('confirm'); return true; }
      const normal = btn.textContent;
      btn.dataset.confirm = '1'; btn.textContent = armedText; btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = normal; btn.classList.remove('arm'); }
      }, 2600);
      return false;
    };
    UI.act('wipeNotes', () => {
      if (!armDanger('wipeNotes', '确认清空？')) return;
      if (SDT.Notes.clearAll() === false) {
        UI.log('备注清空失败，原内容已保留；请先恢复未完成迁移或检查存储访问后重试', 'warn');
        return false;
      }
      runtime.rebuildNotes(); UI.log('已清空全部格子备注', 'warn');
    });
    UI.act('wipeCards', () => {
      if (!armDanger('wipeCards', '确认清空？')) return;
      SDT.Cards.clearAll(); UI.log('已清空卡牌库', 'warn');
    });
    UI.act('wipeSave', () => {
      if (!armDanger('wipeSave', '确认清空全部？')) return;
      const cleared = clearAllSlots();
      if (cleared === false || cleared?.ok === false) {
        const failed = cleared?.results?.filter(result => !result.ok) || [];
        const message = failed.map(result => `档位 ${result.slot} ${result.message}`).join('；');
        UI.log(`[[icon:cross]] ${message || '部分档位删除未完成，请重试'}，尚未清空全部存档`, 'warn');
        return false;
      }
      UI.log('已清空全部五个档位的存档', 'warn');
    });
    // 设置页入口固定为「返回设置」语义：UI 点击委托会把按钮 dataset 对象当作首参传入，
    // 直接挂函数引用时 fromTitle=!!dataset 恒为真，返回键误回标题页（09-30 深审 WORLD-004）
    UI.act('openInbox', () => openSuggestionInbox(false));
    UI.act('openDataPageUi', () => openDataPageUi(true));
    UI.act('closeSettings', () => { UI.hideOverlay(); game.state = prev === 'modal' ? 'idle' : prev; });
    // 勾选即时生效并同步侧边栏
    document.getElementById('setIndex').addEventListener('change', (e) => { game.toggles.index = e.target.checked; sync(); });
    // 提示条 / 环层横幅开关（随 localStorage 持久化；写入走安全封装，配额满不抛异常）
    document.getElementById('setHint').addEventListener('change', (e) => {
      storeSet('sdt-hintbar', e.target.checked ? '1' : '0');
      document.body.classList.toggle('no-hintbar', !e.target.checked);
    });
    document.getElementById('setBanner').addEventListener('change', (e) => {
      storeSet('sdt-banner', e.target.checked ? '1' : '0');
      document.body.classList.toggle('no-banner', !e.target.checked);
    });
    document.getElementById('setDev').addEventListener('change', (e) => {
      game.devMode = e.target.checked;
      storeSet('sdt-dev', e.target.checked ? '1' : '0');
      runtime.syncDevVisibility();
    });
    // 屏幕震动开关（无障碍；顿帧/音效/飘字不受影响，FX.shake 读取该键）
    document.getElementById('setShake').addEventListener('change', (e) => {
      storeSet('sdt-reduce-shake', e.target.checked ? '0' : '1');
    });
    document.getElementById('setReduceMotion').addEventListener('change', (e) => {
      storeSet('sdt-reduce-motion', e.target.checked ? '1' : '0');
      document.body.classList.toggle('reduce-motion', e.target.checked);
      if (SDT.Motion?.refreshReduceMotion) SDT.Motion.refreshReduceMotion();   // 失效缓存（09-20 D-P3），下一次动画立即生效
    });
    bindSettingsAudio(UI.el.ovBody.querySelector('.settings-page'), UI.el.overlay, SDT.Sound);
    // 音乐 / 音效独立开关（即时生效，随 localStorage 持久化）
    document.getElementById('setMusic').addEventListener('change', (e) => {
      SDT.Sound.setMusicMuted(!e.target.checked);
      if (!e.target.checked) SDT.Sound.sfx('ding');
    });
    document.getElementById('setSfx').addEventListener('change', (e) => {
      SDT.Sound.setSfxMuted(!e.target.checked);
      SDT.Sound.sfx('ding');   // 开启时给一声反馈（关闭时无感）
    });
    // 音乐 / 音效音量滑条（拖动即时生效；松手播一声试听音效）
    const musicVolEl = document.getElementById('setMusicVol');
    const sfxVolEl = document.getElementById('setSfxVol');
    musicVolEl.addEventListener('input', (e) => {
      SDT.Sound.setMusicVolume(+e.target.value / 100);
      document.getElementById('setMusicVolVal').textContent = e.target.value;
    });
    sfxVolEl.addEventListener('input', (e) => {
      SDT.Sound.setSfxVolume(+e.target.value / 100);
      document.getElementById('setSfxVolVal').textContent = e.target.value;
    });
    sfxVolEl.addEventListener('change', () => SDT.Sound.sfx('ding'));
  }
  return Object.freeze({ startNewGame, openSettings, openLeaveMenu, openTitleGuide, openTitleAchievements, openSuggestionInbox, openSuggestionBox, openDataPageUi });
}
