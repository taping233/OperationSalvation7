import { appendLocalFeedback, downloadFeedbackRecord, readLocalFeedback } from './feedback.local.js';
/* 标题、选档、离开与设置页面流程。只通过注入端口调用会话能力。 */
function createGameMenuController(deps) {
  const {
    SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
    saveGame, clearAllSlots, getActiveSlot, setActiveSlot, preflightRunMap,
    RunStorage, ensureBattleReady = async () => SDT.Battle, recoverSlotIfPending, terminalCommands,
  } = deps;

  // 存储安全封装（迭代评审 09-20 G-P2）：隐私模式/配额满时裸调 localStorage 会抛异常，
  // 设置页曾直接死按钮。本文件经 deps 注入、无静态导入，工具就地定义
  const storeGet = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const storeSet = (key, val) => { try { localStorage.setItem(key, val); return true; } catch { return false; } };

  // ---------- 标题界面 ----------
  // lobby = 非对局界面（标题/退出屏/基地）：隐藏左侧栏，画面更聚焦
  function setLobby(on) {
    document.body.classList.toggle('lobby', !!on);
    runtime.resize();   // 视口宽度变了，画布需重新适配
  }

  function showTitle() {
    game.state = 'title';
    game.path = null;
    game.runActive = false;
    setActiveSlot(null);
    setLobby(true);
    UI.showScreen(document.getElementById('title'));
    // 告别屏若还亮着（网页版退出→返回）交叉淡出；本就隐藏时立即返回
    UI.hideScreen(document.getElementById('exitScr'));
    bindTitleExtras();
    renderTitleStats();
    SDT.Sound.music('title');
    UI.refresh(game);
  }

  function hideTitle() { UI.hideScreen(document.getElementById('title')); }

  // ---------- AK 风格主页：标题页附加按钮与真实数据 ----------
  let titleExtrasBound = false;
  let titleExtrasBoundGlobal = false;
  function bindTitleExtras() {
    if (titleExtrasBound) return;
    titleExtrasBound = true;
    document.getElementById('mGuide')?.addEventListener('click', openTitleGuide);
    document.getElementById('mAch')?.addEventListener('click', openTitleAchievements);
    const mute = document.getElementById('btnTitleMute');
    if (mute) {
      const syncMute = () => mute.classList.toggle('muted', !!SDT.Sound.muted);
      mute.addEventListener('click', () => { SDT.Sound.setMuted(!SDT.Sound.muted); syncMute(); });
      syncMute();
    }
    // 标题页左上退出键：桌面版走 IPC 退出应用；浏览器版兜底 window.close()
    document.getElementById('btnTitleExit')?.addEventListener('click', () => {
      if (window.sdtDesktop?.isDesktop) window.sdtDesktop.quit();
      else window.close();
    });
    // 右键游戏任意界面 → 针对该位置打开写给 Friday 的建议（自动附上位置信息）
    // 绑定在 document 上一次全局生效；建议层是独立 DOM，叠加在 overlay 页面之上不破坏原界面。
    if (!titleExtrasBoundGlobal) {
      titleExtrasBoundGlobal = true;
      // 圆形入口（收藏图鉴/设置/成就）点击脉冲：:active 按压只在按住时可见，快click也要有可感知反馈
      document.getElementById('title')?.addEventListener('click', (e) => {
        const face = e.target.closest?.('.ak-circle');
        const ring = face?.querySelector('.c-ring');
        if (!ring) return;
        ring.classList.remove('ak-click');
        void ring.offsetWidth;
        ring.classList.add('ak-click');
      });
      // 2026-09-19 留言 #13：标题页可点击互动小动画——字标抖动/撤离次数弹跳/字牌闪金
      document.getElementById('title')?.addEventListener('click', (e) => {
        const play = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
        const wordmark = e.target.closest?.('.winter-wordmark');
        if (wordmark) { play(wordmark, 'wm-jolt'); SDT.Sound.sfx('hover'); return; }
        const sec = e.target.closest?.('.ak-sec');
        if (sec) { play(sec.querySelector('b') || sec, 'sec-pop'); SDT.Sound.sfx('gain'); return; }
        const word = e.target.closest?.('.ak-word');
        if (word) { play(word, 'word-glint'); return; }
        const kicker = e.target.closest?.('.title-kicker');
        if (kicker) { play(kicker, 'kick-blink'); return; }
      });
      document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('#sugLayer')) return;   // 建议层内部右键不重开
        e.preventDefault();
        const page = describeCurrentPage();
        const target = describeTitleTarget(e.target, page);
        const at = { x: Math.round(e.clientX / innerWidth * 100), y: Math.round(e.clientY / innerHeight * 100) };
        openSuggestionBox(target, at, page);
      });
    }
  }

  // 精确识别当前所在的页面/弹层（留言记录用）：
  // 全屏页按稳定容器（hubMain/depMain/卡牌库/制作坊/设置/选人），普通弹层用弹层标题，
  // 都没有再按 game.state 回退。返回 { id: 稳定标识, name: 中文页名 }。
  function describeCurrentPage() {
    const overlay = UI.el && UI.el.overlay;
    if (overlay && !overlay.hidden) {
      const body = UI.el.ovBody;
      const hub = body && body.querySelector('#hubMain');
      if (hub) {
        const tab = Array.from(hub.classList).find(c => c.startsWith('hub-'));
        const key = tab ? tab.slice(4) : '';
        const tabName = { deploy: '出发', stash: '仓库', upgrade: '升级', classes: '人物', ach: '成就·收藏室' }[key] || key;
        return { id: 'hub-' + key, name: `基地 · ${tabName || '主页'}` };
      }
      if (body && body.querySelector('#depMain')) return { id: 'depMain', name: '出征整备' };
      if (body && body.querySelector('.sugin-page')) return { id: 'suginbox', name: '留言库' };
      if (body && body.querySelector('.clib-main')) return { id: 'cardlib', name: '卡牌库' };
      if (body && body.querySelector('.cdes-main')) return { id: 'cardforge', name: '制作坊' };
      if (body && body.querySelector('.settings-page')) return { id: 'settings', name: '设置页' };
      if (body && body.querySelector('.cls2-page')) return { id: 'classselect', name: '选人页' };
      const title = ((UI.el.ovTitle && UI.el.ovTitle.textContent) || '').trim();
      if (title) return { id: 'overlay:' + title, name: title };
      const modeName = { page: '全屏页', battle: '战斗弹层', bag: '背包弹层', bagpage: '背包页', chest: '宝箱浮层', scene: '场景弹层', wide: '宽幅弹层' }[UI._lastMode] || '弹层';
      return { id: 'mode:' + (UI._lastMode || ''), name: modeName };
    }
    // 设置→留言库→返回设置的旧状态恢复会留下 idle，但标题屏本身仍真实可见。
    // 页面识别以可见 DOM 为准，同时保留正常 state:title 的稳定 id。
    const title = document.getElementById('title');
    if (title && !title.hidden && !title._scrHiding) return { id: 'state:title', name: '标题页' };
    const stateName = { boot: '启动', title: '标题页', idle: '对局地图', moving: '对局移动中', modal: '弹层页面', done: '结算页', bossCleanup: 'BOSS 收尾' }[game.state] || game.state;
    return { id: 'state:' + (game.state || ''), name: stateName };
  }

  // 把右键命中的元素翻译成 Friday 可读的位置描述：
  // 优先取按钮文案/标题提示，画布单独说明，其次区域类名，再带上 DOM 路径。
  // 页面前缀由 describeCurrentPage 提供，精确到具体页面/弹层。
  function describeTitleTarget(el, page) {
    const where = page ? page.name : game.state;
    if (el && el.tagName === 'CANVAS') {
      return { name: `游戏画布（${where}）`, selector: 'canvas#' + (el.id || 'viewport') };
    }
    if (!el || el.id === 'title') return { name: `标题页整体`, selector: '#title' };
    const btn = el.closest('button');
    if (btn) {
      const label = btn.getAttribute('title') || btn.textContent.trim().replace(/\s+/g, ' ').slice(0, 20);
      return { name: `${where} · 按钮「${label}」`, selector: btn.id ? `#${btn.id}` : `button.${btn.className}` };
    }
    const zone = el.closest('[class]');
    const zoneName = { 'title-heading': '标题标题区', 'ak-hud': '主页 HUD 区', 'title-quote': '底部引言', 'title-bg': '背景图', 'ov-body': '弹层页面内容区', 'sidebar': '左侧边栏' }[zone?.className] || zone?.className;
    const path = [];
    let cur = el;
    while (cur && cur.id !== 'title' && cur !== document.body && path.length < 4) {
      path.unshift(cur.tagName.toLowerCase() + (cur.className ? '.' + String(cur.className).split(' ')[0] : '') + (cur.id ? '#' + cur.id : ''));
      cur = cur.parentElement;
    }
    return { name: `${where} · ${zoneName || '未命名区域'}`, selector: path.join(' > ') };
  }

  // 最近游玩的档位（按对局存档时间；无对局存档的基地档位排后）
  function pickLatestSlot() {
    let best = null;
    for (let i = 1; i <= SLOT_COUNT; i++) {
      // F1 兜底（2026-09-24）：单档读取异常（如基地档字段类型损坏）不阻塞最近档判定——
      // 标题页数据件与选档页共用本函数，一档抛错会连带卡死整页
      let run = null, base = null;
      try { run = readSlot(i); } catch { /* 坏档按空档处理 */ }
      try { base = SDT.Base.peek(i); } catch { /* 同上 */ }
      if (!run && !base) continue;
      const ts = +run?.savedAt || 0;
      if (!best || ts > best.ts) best = { slot: i, run, base, ts };
    }
    return best;
  }

  // 主页数据件：全部来自真实存档（最近档位的档案号 / 游玩时长 / 成就 / 收藏 / 撤离）
  function renderTitleStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const latest = pickLatestSlot();
    const base = latest?.base || null, run = latest?.run || null;
    const latestTotal = Math.max(base?.stats?.playSeconds || 0, run?.elapsed || 0);
    set('akSlotNo', latest ? `0${latest.slot}` : '--');
    set('akPlaytime', latest ? (latestTotal > 0 ? `游玩 ${fmtPlayTime(latestTotal)}` : '暂无游玩记录') : '暂无档案');
    const tag = document.getElementById('akLastTag');
    if (tag) {
      if (run?.savedAt) {
        const d = new Date(run.savedAt);
        const p = (n) => String(n).padStart(2, '0');
        tag.textContent = `继续对局 · ${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      } else tag.textContent = base ? '基地档案已建立' : '暂无档案 · 等待远征';
    }
    const achN = base ? SDT.Meta.ACHIEVEMENTS.filter(a => SDT.Meta.isUnlocked(a, base)).length : 0;
    set('akAchTag', `${achN}/${SDT.Meta.ACHIEVEMENTS.length}`);
    set('akCollect', String(Object.keys(base?.collection || {}).length));
    set('akExtracts', String(base?.stats?.extracts || 0));
    set('akVerHex', document.getElementById('gameVersion')?.textContent || 'v…');
  }

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
    const close = () => { if (layer._openToken !== token) return; layer._openToken = null; UI.hideScreen(layer, () => { if (layer._openToken === null) game.state = prevState; }); };
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
      document.getElementById('sugWhere').innerHTML = ok
        ? '已保存在本浏览器。请到设置 → 留言库导出此条 JSON，再交给制作者。'
        : '写入失败，输入已保留，请重试。';
      if (ok) fields.forEach(el => { el.value = ''; });
    };
    setTimeout(() => { if (layer._openToken === token) ta.focus(); }, 0);
  }

  // ---------- 留言库：设置页入口，查看历史留言与完成状态，未完成的可删除 ----------
  // 桌面版经 Electron IPC 读写 output/suggestions.json；浏览器版读写 localStorage。
  // done 标记由 Friday 落地每批留言后在 json 里补写；未完成条目显示删除键（两步确认）。
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
    try {
      const list = JSON.parse(localStorage.getItem('sdt-suggestions-v1') || '[]').filter((e) => e?.ts !== ts);
      localStorage.setItem('sdt-suggestions-v1', JSON.stringify(list));
      return true;
    } catch { return false; }
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
    </div>`;
  }

  function renderSugBox() {
    const box = document.getElementById('sugBox');
    if (!box) return;
    if (!Array.isArray(sugCache)) { box.innerHTML = `<p class="ov-empty danger">${esc(sugCache?.message || '留言库读取失败，原数据已保留')}</p>`; return; }
    const list = sugCache.map((entry, index) => ({ entry, index })).reverse();
    const entries = list.map(x => x.entry);
    const pend = list.filter((x) => !x.entry?.done);
    const done = list.filter((x) => x.entry?.done);
    let html = `<p class="hint">共 ${list.length} 条留言 · 待处理 ${pend.length} · 已完成 ${done.length}。已完成的留言是历史档案；未完成的可删除，删除需点两次确认。</p>`;
    if (pend.length) html += `<h3 class="set-h">待处理 <span class="set-en">PENDING · ${pend.length}</span></h3>` + pend.map((x) => sugRowHTML(x.entry, false, x.index)).join('');
    html += `<h3 class="set-h">已完成 <span class="set-en">DONE · ${done.length}</span></h3>`;
    html += done.length ? done.map((x) => sugRowHTML(x.entry, true, x.index)).join('') : '<p class="ov-empty">还没有已完成的留言。</p>';
    if (!entries.length) html = '<p class="ov-empty">还没有本地留言。在游戏任意界面右键可记录，保存后需主动导出交给制作者。</p>';
    box.innerHTML = SDT.Icons.rich(html);
  }

  function openSuggestionInbox() {
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page sugin-page">
        <!-- 09-23 留言：右下 BACK 取消，退出键改左上角，与主页退出键（ak-sq ak-exit）同款同位 -->
        <button class="ak-sq ak-exit sugin-exit" data-act="sugBack" title="返回设置（Esc）" aria-label="返回设置">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M4 12h10M4 12l4-4M4 12l4 4"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <header class="pg-head"><h2>[[icon:book]] 留言库</h2><span class="pg-spacer"></span></header>
        <div class="settings" id="sugBox"><p class="ov-empty">读取中…</p></div>
      </div>`, 'page');
    UI.act('sugBack', () => openSettings());
    UI.act('sugExport', d => {
      const entry = Array.isArray(sugCache) ? sugCache[+d.idx] : null; if (!entry) return;
      const btn = document.querySelector(`[data-act="sugExport"][data-idx="${+d.idx}"]`);
      const result = downloadFeedbackRecord(entry);
      if (btn) btn.textContent = result.ok ? '已导出' : '导出失败，请重试';
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
    loadSuggestions().then((list) => { sugCache = list; renderSugBox(); });
  }

  // 远征手册：只描述当前 Vite 版真实输入与流程
  // U9（2026-09-19 走查）：对局内也可打开（左上 ? 钮）——进入时记下原状态，返回恢复，
  // 不再把对局态改写成 title（标题页调用 prev='title'，行为不变）。
  function openTitleGuide() {
    const prevState = game.state;
    game.state = 'modal';
    UI.showOverlay('[[icon:question]] 远征手册', `
      <!-- 2026-09-25 老板：返回键统一 = 主页左上退出键（ak-sq ak-exit）同款同位 -->
      <button class="ak-sq ak-exit ak-back-tl" data-act="guideBack" title="返回（Esc）" aria-label="返回">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M4 12h10M4 12l4-4M4 12l4 4"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="expedition-manual">
        <p class="manual-lead">从基地整备，沿相邻节点深入，打完战斗后把带回来的东西安全撤离。</p>
        <div class="manual-grid">
          <section class="manual-step"><span class="manual-index">01</span><div><h3>整备</h3><p>在基地选择玩法、挑选背包卡牌与宠物。初始攻击固定占用 1 格；仓库卡只有放入背包才会带进远征。</p></div></section>
          <section class="manual-step"><span class="manual-index">02</span><div><h3>探索</h3><p>直接点击当前节点相邻的下一节点。多条路线时 <b>Space / Enter</b> 切换，单条路线时直接前进；<b>Z</b> 回到上条路线，<b>X</b> 确认前往。</p></div></section>
          <section class="manual-step"><span class="manual-index">03</span><div><h3>战斗</h3><p>手牌按住拖向敌人或自己使用指向卡；没有目标的招式拖到敌我之间空地即可。留意费用与敌方意图，回合结束后敌人会行动。</p></div></section>
          <section class="manual-step"><span class="manual-index">04</span><div><h3>撤离</h3><p>抵达撤离节点并完成结算；安全格中的卡牌会由宠物运回基地，撤离失败时也会抢运安全格卡牌。倒下或放弃会丢失其他本局物资。</p></div></section>
        </div>
        <div class="manual-controls"><span class="manual-control-key">Space / Enter</span><span>切换路线</span><span class="manual-control-key">Z</span><span>上条路线</span><span class="manual-control-key">X</span><span>确认节点</span><span class="manual-control-key">B</span><span>背包</span><span class="manual-control-key">G / F</span><span>全景 / 定位</span><span class="manual-control-key">Esc</span><span>关闭页面</span></div>
        <p class="manual-note">鼠标拖拽平移地图，滚轮缩放。地图只开放当前节点的相邻可通行路线；已探索节点的奖励不会重复刷新。</p>
      </div>`, true);
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
    const rows = SDT.Meta.ACHIEVEMENTS.map(a => {
      const unlocked = base ? SDT.Meta.isUnlocked(a, base) : false;
      const claimed = !!(base?.achClaimed?.[a.id]);
      const mark = claimed ? '[[icon:check]] 已领取' : unlocked ? '[[icon:sparkles]] 已解锁' : '[[icon:lock]] 未解锁';
      return `<div class="ach-row${unlocked ? ' done' : ''}">
        <div class="ach-ico">${a.icon}</div>
        <div class="ach-info"><b>${a.name}</b><span>${a.desc}</span></div>
        <div class="ach-ops"><span class="rw">${mark}</span></div>
      </div>`;
    }).join('');
    const note = latest
      ? `以 <b>档位 0${latest.slot}</b> 的基地档案为准；成就奖励需进入基地领取。`
      : '暂无任何档案——完成一次远征后，成就将随基地档案记录。';
    UI.showOverlay('[[icon:medal]] 成就总览', `
      <!-- 2026-09-25 老板：返回键统一 = 主页左上退出键（ak-sq ak-exit）同款同位 -->
      <button class="ak-sq ak-exit ak-back-tl" data-act="achBack" title="返回（Esc）" aria-label="返回">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M4 12h10M4 12l4-4M4 12l4 4"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <p class="ov-note">${note}</p>
      <div class="ach-list">${rows}</div>`, true);
    UI.act('achBack', () => { UI.hideOverlay(); game.state = 'title'; });
  }

  // ---------- 存档档位选择 ----------
  // mode: 'start' = 开始/继续游戏（进入存档：有未完成对局直接续打，否则先进基地）
  //       'base'  = 从主菜单直达基地（该档有未完成对局时需先续打，不开放）
  function fmtPlayTime(seconds) {
    const sec = Math.max(0, Math.floor(+seconds || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} 小时 ${String(m).padStart(2, '0')} 分` : `${m} 分钟`;
  }

  // ---------- 选档页专用：五个档位的 AK 风格发光 SVG 图标（白体渐变 + 光影） ----------
  const SLOT_ICONS = [
    // 档位1 · 无（侠客）：交叉双刃 + 中心菱形
    `<svg class="ic slot-ico" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="slotG1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9cdc9"/>
      </linearGradient></defs>
      <g stroke="url(#slotG1)" stroke-width="8" stroke-linecap="round">
        <path d="M30 20 L88 90"/><path d="M90 20 L32 90"/>
      </g>
      <g stroke="url(#slotG1)" stroke-width="7" stroke-linecap="round">
        <path d="M44 62 L60 76"/><path d="M76 62 L60 76"/>
      </g>
      <circle cx="60" cy="104" r="6" fill="url(#slotG1)"/>
      <path d="M60 40 l7 12 -7 12 -7 -12 Z" fill="url(#slotG1)"/>
    </svg>`,
    // 档位2 · 常无欲（降临者）：弯檐巫帽 + 坠落的四芒星
    `<svg class="ic slot-ico" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="slotG2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e6efed"/><stop offset="1" stop-color="#b3c8c4"/>
      </linearGradient></defs>
      <path fill="url(#slotG2)" d="M14 82 q46 16 92 0 l-7 -10 q-39 11 -78 0 Z"/>
      <path fill="url(#slotG2)" d="M38 74 Q52 40 74 16 Q70 44 86 72 Q62 80 38 74 Z"/>
      <path fill="url(#slotG2)" d="M92 30 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5 Z"/>
    </svg>`,
    // 档位3 · 白塔（法师）：垛口高塔 + 拱窗 + 旗帜
    `<svg class="ic slot-ico" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="slotG3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bccfcb"/>
      </linearGradient></defs>
      <path fill="url(#slotG3)" d="M44 104 V50 h32 v54 Z"/>
      <path fill="url(#slotG3)" d="M40 50 v-12 h8 v8 h7 v-8 h10 v8 h7 v-8 h8 v12 Z"/>
      <path fill="rgba(16,36,49,.6)" d="M54 104 v-16 a6 8 0 0 1 12 0 v16 Z"/>
      <path d="M76 44 V16" stroke="url(#slotG3)" stroke-width="5" stroke-linecap="round"/>
      <path fill="url(#slotG3)" d="M76 16 l16 5 -16 6 Z"/>
    </svg>`,
    // 档位4 · 黑像（战士）：巨剑 + 一杯热咖啡
    `<svg class="ic slot-ico" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="slotG4" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9cdc9"/>
      </linearGradient></defs>
      <path fill="url(#slotG4)" d="M56 10 l7 13 v52 h-14 v-52 Z"/>
      <path fill="url(#slotG4)" d="M40 75 h40 v7 h-40 Z"/>
      <path fill="url(#slotG4)" d="M52 82 h16 v10 h-16 Z"/>
      <path fill="url(#slotG4)" d="M74 90 h22 v7 a11 11 0 0 1 -22 0 Z"/>
      <path d="M96 92 a6 6 0 1 1 -1 11" fill="none" stroke="url(#slotG4)" stroke-width="4"/>
      <g fill="none" stroke="url(#slotG4)" stroke-width="3.4" stroke-linecap="round">
        <path d="M81 84 q3 -4 0 -8"/><path d="M90 84 q3 -4 0 -8"/>
      </g>
    </svg>`,
    // 档位5 · 星月（牧师）：新月抱星 + 提灯
    `<svg class="ic slot-ico" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="slotG5" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b6cbc7"/>
      </linearGradient></defs>
      <path fill="url(#slotG5)" d="M72 12 A40 40 0 1 0 106 66 A32 32 0 1 1 72 12 Z"/>
      <path fill="url(#slotG5)" d="M88 26 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z"/>
      <path d="M40 76 v10" stroke="url(#slotG5)" stroke-width="4" stroke-linecap="round"/>
      <path fill="url(#slotG5)" d="M40 86 l8 11 -8 11 -8 -11 Z"/>
    </svg>`,
  ];

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
      ? `<div class="si-line si-progress"><em>当前进度</em><b>${run.nestActive ? '研究所远征进行中' :`第 ${(run.layerIdx ?? 0) + 1} 层 · ${esc(run.myClass || '未选人物')}`}</b></div>`
      : '';
    const saved = Number(run?.savedAt) > 0 ? new Date(Number(run.savedAt)) : null;
    const p = (n) => String(n).padStart(2, '0');
    const savedLine = saved && !Number.isNaN(saved.getTime())
      ? `<div class="si-line si-saved"><em>上次保存</em>${p(saved.getMonth() + 1)}-${p(saved.getDate())} ${p(saved.getHours())}:${p(saved.getMinutes())}</div>`
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
    UI.registerHelp('slots', {
      title: '存档说明',
      html: `
        <p class="help-item"><b>独立存档</b>五个档位的基地与进度完全独立（资源/仓库/职业/成就/卡背各自保存）。</p>
        <p class="help-item"><b>继续对局</b>有未完成对局的档位会直接回到那一局；没有对局则先进基地，再从基地出发。</p>`,
      back: () => openSlotPicker(),
    });
    UI.showOverlay('', `
      <div class="pg slot-page">
        <div class="slot-bg" aria-hidden="true">
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          <i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i><i class="bokeh"></i>
          ${SLOT_BG_SILHOUETTES}
        </div>
        <!-- 返回键在左上角（2026-09-19 老板指定；09-10 曾因矮窗口裁切沉到左下角——
             选档卡片改全屏后卡片顶=视口顶、页头 clamp 留白带兜底，裁切前提已不存在）。
             2026-09-25 老板：返回键统一 = 主页左上退出键（ak-sq ak-exit）同款同位，
             原 58px 透明变体（.pg-back）退役 -->
        <button class="ak-sq ak-exit ak-back-tl" data-act="slotBack" aria-label="返回主菜单" title="返回主菜单（Esc）"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <!-- U6（2026-09-19 走查）：帮助「?」从孤悬左上挪进标题行，与标题同排 -->
        <header class="slot-page-head">
          <span class="slot-page-en">选择存档</span>
          <i class="slot-page-rule"></i>
          <span class="slot-page-help">${UI.helpBtn('slots')}</span>
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
    const launch = (slot, fn) => {
      UI.hideOverlay();
      hideTitle();
      UI.clearLog();
      setActiveSlot(slot);
      SDT.Base.use(slot);
      // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：基地仓库/口袋副本同步更名
      const storedCards = (SDT.Base.data.stash || []).concat(SDT.Base.data.pocket || []).map(st => st.card);
      const abilityChanged = SDT.Cards.applyAbilityRename(storedCards);
      const duplicateChanged = SDT.Cards.applyDuplicateRenames(storedCards);
      if (abilityChanged || duplicateChanged) SDT.Base.save();
      const bi = SDT.Base.issue(slot);
      if (bi === 'corrupt') UI.log('[[icon:cross]] 该档位基地数据损坏（原数据已备份），本次以空档案启动', 'warn');
      else if (bi === 'tooNew') UI.log('[[icon:cross]] 该档位基地数据来自更新版本的游戏，已以空档案启动', 'warn');
      fn();
      UI.log(`[[icon:archive]] 已进入 <b>档位 ${slot}</b>（基地与进度独立保存到该档位）`, 'sys');
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
    UI.act('newSlot', (d) => { if (!enteringSlot) launch(+d.slot, () => { SDT.Base.reset(+d.slot); runtime.openBaseHub('deploy'); }); });
    UI.act('enterSlot', async (d) => {
      if (enteringSlot) return;
      const slot = +d.slot;
      if (recoverSlotIfPending) {
        const picker = document.getElementById('slotRestoreError');
        enteringSlot = true;
        try {
          const recovered = await recoverSlotIfPending(slot);
          if (picker && !picker.isConnected) return;
          if (!recovered.ok) {
            restoreError(`${recovered.message || '存档恢复尚未完成'}；原档与恢复记录已保留，请重试进入该档位`);
            return;
          }
        } catch {
          if (!picker || picker.isConnected) restoreError('存档恢复失败；原档与恢复记录已保留，请重试进入该档位');
          return;
        } finally { enteringSlot = false; }
      }
      const hasSavedRun = RunStorage.has(slot);
      if (hasSavedRun) {
        const checked = preflightRunMap(slot);
        if (!checked.ok) {
          const message=`${checked.message || '路线存档无法安全恢复'}，原档已保留；请稍后用兼容版本重试，或显式覆盖档位`;
          restoreError(message);
          return;
        }
      }
      launch(slot, async () => {
        // 上一局未结束 → 直接回到局内（2026-09-07 留言：不进基地换人/重新带卡）；
        // 有存档键但不能安全恢复（损坏/版本过新/地图无证据）→ 保留原串并回标题，不进入整备。
        const resumed = hasSavedRun;
        let inRun;   // 不做冗余初始化：仅 resumed 分支读取，且读取前必先赋值 loaded.ok
        if (resumed) {
          // 2026-09-09：先播转场再读档。战斗中断档在 loadGame 里由 Battle.restore
          // 直接置为战斗 modal 态并渲染战斗界面；若在其后播转场，转场结束会把
          // state 拉回 idle——战斗界面永远出不来，且 battleActive 锁死移动（实测死锁）。
          await runtime.showRunTransition({
            tone: 'door', asset: 'scene-door-bg',
            eyebrow: 'EXPEDITION RESUMED', title: '继续对局',
            detail: '欢迎回到战场',
            duration: 900,
          });
          // 存档可能包含战斗快照；必须先加载战斗域，loadGame 才能同步 restore。
          await ensureBattleReady();
          const loaded = loadGame(slot);
          inRun = loaded.ok;
          if (!inRun) {
            RunStorage.issue(slot);
            UI.log(`${loaded.message || '对局存档读取失败'}，原档已保留，已返回标题`, 'warn');
            showTitle();
            return;
          } else return;   // loadGame 已恢复地图/战斗界面：停留局内，不再进基地整备
        }
        await runtime.showRunTransition({
          tone: 'door', asset: 'scene-door-bg',
          eyebrow: 'BASE LINKED', title: '进入存档',
          detail: '回到基地整备出发',
          duration: 900,
        });
        runtime.openBaseHub('deploy');
      });
    });
    UI.act('overwriteSlot', (d) => {
      if (enteringSlot) return;
      if (!armConfirm(`[data-act="overwriteSlot"][data-slot="${d.slot}"]`, '确认重开？', '覆盖重开')) return;
      clearSlot(+d.slot);
      launch(+d.slot, () => { SDT.Base.reset(+d.slot); runtime.openBaseHub('deploy'); });
    });
    UI.act('delSlot', (d) => {
      if (enteringSlot) return;
      if (!armConfirm(`[data-act="delSlot"][data-slot="${d.slot}"]`, '确认删除？', '删除')) return;
      clearSlot(+d.slot);
      UI.log(`[[icon:trash]] 已删除【档位 ${d.slot}】的存档（含基地数据）`, 'warn');
      openSlotPicker();   // 重绘档位列表
    });
    UI.act('slotBack', () => { UI.hideOverlay(); showTitle(); });
  }

  function startNewGame() { openSlotPicker(); }

  function exitToTitle() {
    // 迭代评审 09-20 客户端岗：守卫收窄不删——仅战斗未收尾时直接 return（不做「同步收战斗
    // 再跳」：battle:end 异步续流会在标题页叠层）；触发点已全是脚本流（龙巢撤离/备战返回/选角退出），
    // 人工入口早已改走 openLeaveMenu。immediate 同步关层消除 210ms 淡出窗口竞态（龙巢撤离死锁根因），
    // 详见 ui.js hideOverlay——曾致撤离后卡巢穴图、可无限重刷 BOSS 奖励
    if (game.battleActive) return;
    UI.hideOverlay({ immediate: true });
    saveGame();   // 内部只在 runActive 时写档
    showTitle();
  }

  // ---------- 离开对局 / 放弃对局（v0.21 设计者规则） ----------
  // 放弃对局：带入本局的卡牌【全部】丢失；对局中获得的卡牌只有安全格里的
  // 会被宠物运回基地；物资/金币/消耗口袋全部散失。
  function openLeaveMenu() {
    game.state = 'modal';
    UI.showOverlay('[[icon:door]] 离开对局？', `
      <p class="ov-note">当前对局进度已自动保存——下次「开始游戏」进入 <b>${getActiveSlot() ? `档位 0${getActiveSlot()}` : '当前档位'}</b> 会直接继续这场对局。</p>
      <p class="ov-note" style="color:#f0b9ae">[[icon:question]] 若选择<b>放弃对局</b>：带入本局的卡牌<b>全部丢失</b>；
        对局中获得的卡牌只有存入<b>安全格</b>的会被宠物运回基地；物资与金币全部散失。</p>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="leaveSave">[[icon:save]] 保存并回主菜单</button>
        <button class="ov-btn danger" data-act="leaveAbandon">[[icon:flag]] 放弃对局</button>
        <button class="ov-btn" data-act="leaveCancel">↩ 继续对局</button>
      </div>`, undefined, { initialFocus: '[data-act="leaveCancel"]' });
    UI.act('leaveSave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); showTitle(); });
    UI.act('leaveCancel', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.act('leaveAbandon', () => {
      const btn = document.querySelector('#ovBody [data-act="leaveAbandon"]');
      if (btn && !btn.dataset.confirm) {
        btn.dataset.confirm = '1'; btn.textContent = '确认放弃？（卡牌将全部丢失）'; btn.classList.add('arm');
        setTimeout(() => {
          if (btn.isConnected) { delete btn.dataset.confirm; btn.innerHTML = `${SDT.Icons.img('flag')} 放弃对局`; btn.classList.remove('arm'); }
        }, 2600);
        return;
      }
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
      const keptHTML = keptList.length
        ? `<p class="ov-note">[[icon:lock]] 宠物从安全格抢运回 <b>${kept.length}</b> 张对局中获得的卡牌：` +
          keptList.map(s => `${esc(s.card.name)}${s.count > 1 ? ' ×' + s.count : ''}`).join('、') + '</p>'
        : '<p class="ov-note">安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。</p>';
      UI.showOverlay('[[icon:flag]] 已放弃对局', `
        <p class="ov-stats">带入本局的 <b>${token.broughtN}</b> 张卡牌全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；
          物资与 <b class="gold">${game.coins} 币</b>一并散失。</p>
        ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
        ${keptHTML}
        <div class="ov-btns">
          <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
          <button class="ov-btn ok" data-act="toTitle">[[icon:archive]] 回主菜单</button>
        </div>`);
      UI.act('goBase', () => { UI.hideOverlay(); runtime.openBaseHub('deploy'); });
      UI.act('toTitle', () => { UI.hideOverlay(); showTitle(); });
      UI.refresh(game);
      return true;
    };
    const showRetry = message => {
      if (!current()) return;
      token.busy = false;
      token.promise = null;
      UI.showOverlay('[[icon:cross]] 终局结算未保存', `<p class="ov-note">${esc(message || '基地与对局尚未完成结算，原对局仍保留。')}</p><button class="ov-btn ok" data-act="retryAbandon">重试结算</button>`);
      UI.act('retryAbandon', () => { if (current() && !token.busy) return run(); });
      UI.refresh(game);
    };
    const run = async () => {
      if (!current() || token.busy) return false;
      token.busy = true;
      token.promise = (async () => {
        try {
          if (token.ephemeral) {
            terminalCommands.projectEphemeral({ command: 'run.abandon', cards: token.cards });
            return finish();
          }
          if (!terminalCommands) { showRetry('终局安全提交服务不可用'); return false; }
          if (!token.attempt) {
            const created = await terminalCommands.createAttempt({ slotId, command: 'run.abandon', cards: token.cards });
            if (!current()) return false;
            if (!created.ok) { showRetry(created.message); return false; }
            if (created.replay) return finish();
            token.attempt = created.attempt;
          }
          const committed = await terminalCommands.commitAttempt(token.attempt);
          if (!current()) return false;
          if (!committed.ok) { showRetry(committed.message); return false; }
          return finish();
        } catch (error) { showRetry(error && error.message); return false; }
      })();
      return token.promise;
    };
    return run();
  }

  function quitGame() {
    saveGame();
    if (window.sdtDesktop && window.sdtDesktop.isDesktop) {
      window.sdtDesktop.quit(); // 桌面版：存档已保留，真正退出程序
      return;
    }
    UI.hideScreen(document.getElementById('title'));
    UI.showScreen(document.getElementById('exitScr'));
    // 网页版无法真正关闭程序：显示告别屏即可（存档已保留，可重新进入继续）
  }

  // ---------- 设置（标题界面调用） ----------
  function openSettings() {
    const prev = game.state;
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page">
        <!-- 2026-09-07 留言：右上叉号去掉。2026-09-25 老板：返回键统一 = 主页左上退出键
             （ak-sq ak-exit）同款同位，底部大返回钮取消，Esc 仍可关 -->
        <button class="ak-sq ak-exit ak-back-tl" data-act="closeSettings" title="返回（Esc）" aria-label="返回">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M4 12h10M4 12l4-4M4 12l4 4"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <header class="pg-head"><h2>[[icon:gear]] 设置</h2><span class="pg-spacer"></span></header>
        <div class="settings">
        <h3 class="set-h">[[icon:gear]] 通用 <span class="set-en">GENERAL</span></h3>
        <label class="chk"><input type="checkbox" id="setIndex" ${game.toggles.index ? 'checked' : ''}> 结点编号 <span class="set-en">NODE NUMBERS</span></label>
        <label class="chk"><input type="checkbox" id="setHint" ${storeGet('sdt-hintbar') !== '0' ? 'checked' : ''}> 底部操作提示条 <span class="set-en">HINT BAR</span></label>
        <label class="chk"><input type="checkbox" id="setBanner" ${storeGet('sdt-banner') !== '0' ? 'checked' : ''}> 环层横幅 <span class="set-en">LAYER BANNER</span></label>
        <label class="chk"><input type="checkbox" id="setDev" ${game.devMode ? 'checked' : ''}> 开发者模式（测试工具 / 卡牌制作） <span class="set-en">DEVELOPER</span></label>
        <label class="chk"><input type="checkbox" id="setShake" ${storeGet('sdt-reduce-shake') === '1' ? '' : 'checked'}> 屏幕震动反馈 <span class="set-en">SCREEN SHAKE</span></label>
        <label class="chk"><input type="checkbox" id="setReduceMotion" ${storeGet('sdt-reduce-motion') === '1' ? 'checked' : ''}> 减少动态效果 <span class="set-en">REDUCE MOTION</span></label>
        <h3 class="set-h">[[icon:gear]] 音频 <span class="set-en">AUDIO</span></h3>
        <label class="chk"><input type="checkbox" id="setMusic" ${SDT.Sound.musicMuted ? '' : 'checked'}> 背景音乐 <span class="set-en">MUSIC</span></label>
        <label class="chk"><span>音乐来源 <span class="set-en">MUSIC SOURCE</span></span><select id="setMusicSource"><option value="scape" ${SDT.Sound.musicSource === 'scape' ? 'selected' : ''}>冬境声景</option><option value="original" ${SDT.Sound.musicSource === 'original' ? 'selected' : ''}>原有曲目</option></select></label>
        <label class="chk vol"><span>音乐音量 <span class="set-en">MUSIC VOL</span></span><input type="range" id="setMusicVol" min="0" max="100" value="${Math.round(SDT.Sound.musicVolume * 100)}"><b id="setMusicVolVal">${Math.round(SDT.Sound.musicVolume * 100)}</b></label>
        <label class="chk"><input type="checkbox" id="setSfx" ${SDT.Sound.sfxMuted ? '' : 'checked'}> 音效 <span class="set-en">SOUND FX</span></label>
        <label class="chk vol"><span>音效音量 <span class="set-en">SFX VOL</span></span><input type="range" id="setSfxVol" min="0" max="100" value="${Math.round(SDT.Sound.sfxVolume * 100)}"><b id="setSfxVolVal">${Math.round(SDT.Sound.sfxVolume * 100)}</b></label>
        <p class="hint">侧边栏的 [[icon:gear]] 按钮为全局静音；这里可分别开关音乐与音效、拖动滑条调音量（自动保存）。</p>
        <h3 class="set-h">[[icon:trophy]] 致谢 <span class="set-en">CREDITS</span></h3>
        <p class="hint">图标来自 game-icons.net —— Lorc、Delapouite、Carl Olsen、Caro Asercion（CC-BY 3.0，详见 assets/icons/game-icons/LICENSE-CC-BY-3.0.md）；音效来自 Kenney.nl（CC0）。</p>
        <h3 class="set-h">[[icon:book]] 留言库 <span class="set-en">SUGGESTION BOX</span></h3>
        <div class="btn-row"><button class="mini-btn" data-act="openInbox">查看历史留言</button></div>
        <h3 class="set-h">危险区 <span class="set-en">DANGER ZONE</span></h3>
        <div class="btn-row">
          <button class="mini-btn danger" data-act="wipeNotes">清空格子备注</button>
          <button class="mini-btn danger" data-act="wipeCards">清空卡牌库</button>
          <button class="mini-btn danger" data-act="wipeSave">清空全部存档</button>
        </div>
        </div><!-- /.settings -->
      </div><!-- /.pg -->`, 'page');
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
      SDT.Notes.clearAll(); runtime.rebuildNotes(); UI.log('已清空全部格子备注', 'warn');
    });
    UI.act('wipeCards', () => {
      if (!armDanger('wipeCards', '确认清空？')) return;
      SDT.Cards.clearAll(); UI.log('已清空卡牌库', 'warn');
    });
    UI.act('wipeSave', () => {
      if (!armDanger('wipeSave', '确认清空全部？')) return;
      clearAllSlots(); UI.log('已清空全部五个档位的存档', 'warn');
    });
    UI.act('openInbox', openSuggestionInbox);
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
    // 音乐 / 音效独立开关（即时生效，随 localStorage 持久化）
    document.getElementById('setMusic').addEventListener('change', (e) => {
      SDT.Sound.setMusicMuted(!e.target.checked);
      if (!e.target.checked) SDT.Sound.sfx('ding');
    });
    document.getElementById('setMusicSource').addEventListener('change', (e) => SDT.Sound.setMusicSource(e.target.value));
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

  return Object.freeze({ setLobby, showTitle, startNewGame, exitToTitle, quitGame, openSettings, openLeaveMenu, openTitleGuide, openSuggestionInbox });
}

export { createGameMenuController };
