import { characterName } from './characters.js';
import { esc } from './shared.js';
import { renderExpeditionPanel } from './expedition.view.js';
  const SDT = window.SDT;
  const $ = (id) => document.getElementById(id);

  const UI = {
    el: {},
    _acts: {},   // 弹窗按钮动作表：data-act → 回调
    _baseActs: {},   // 全局基础动作（页面同名动作优先）
    _roomActive: false, // 地图格子的整段结算都保持为全屏房间页
    helpTopics: {},  // pageId -> { title, html, back }（? 帮助弹层主题，页面渲染时注册）
    _overlayReturnFocus: null,
    _overlayInerted: [],

    init() {
      this.el = {
        statTurn: $('statTurn'), statValue: $('statValue'),
        hpBar: $('hpBar'), hpBarWrap: $('hpBarWrap'), hpText: $('hpText'), charCoins: $('charCoins'),
        charAtk: $('charAtk'),
        heroAva: $('heroAva'),
        bagBtnFloat: $('bagBtnFloat'), bagCountFloat: $('bagCountFloat'),
        log: $('log'),
        logPanel: $('logPanel'),
        overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'), ovCloseX: $('ovCloseX'),
        tooltip: $('tooltip'),
        tglIndex: $('tglIndex'),
        btnExport: $('btnExport'), btnImport: $('btnImport'), btnClear: $('btnClear'),
        devTools: $('devTools'),
        devBattle: $('devBattle'), devBoss: $('devBoss'),
        titleDev: $('titleDev'),
        btnCardDesigner: $('btnCardDesigner'), btnCardLib: $('btnCardLib'),
        viewport: $('viewport'),
        layerZh: $('layerBannerZh'), layerEn: $('layerBannerEn'),
      };
      this.el.ovBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const fn = this._acts[btn.dataset.act] || this._baseActs[btn.dataset.act];
        if (fn) fn(btn.dataset);
      });
      // 面板右上角 × 与遮罩点击（09-20 老板 P1-1）：都走 closeTopOverlayByEsc 同一条链，
      // 必选流程（事件必选/BOSS 编组/战斗页）探测不到取消语义时按钮自动隐藏、遮罩点击无效。
      this.el.ovCloseX?.addEventListener('click', () => this.closeTopOverlayByEsc());
      this.el.overlay.addEventListener('click', (e) => {
        if (e.target !== this.el.overlay) return;
        if (this._canCancelOverlay()) this.closeTopOverlayByEsc();
      });
      // 帮助弹层（? 按钮）：所有页面共用的基础动作，页面可注册自己的帮助主题
      this._baseActs.openHelp = (d) => this.showHelp(d.page);
      // 设计器等表单的实时输入回调
      this.el.ovBody.addEventListener('input', (e) => {
        if (this._inputHandler) this._inputHandler(e);
      });
      // 卡牌库等页面的悬停回调（大图预览）
      this.el.ovBody.addEventListener('mouseover', (e) => {
        if (this._hoverHandler) this._hoverHandler(e);
      });
      // Overlay 是真正的模态对话框：Tab 不能穿透到背后的地图，Esc 仍遵循
      // closeTopOverlayByEsc 的战斗/必选流程规则。用捕获阶段保证输入框里的 Esc
      // 也能工作，而不会和游戏快捷键互相抢事件。
      this.el.overlay.addEventListener('keydown', (e) => {
        if (this.el.overlay.hidden) return;
        if (e.key === 'Tab') {
          this._trapOverlayFocus(e);
          return;
        }
        if (e.key === 'Escape') {
          if (this.closeTopOverlayByEsc()) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);
      // 彩蛋（2026-09-07 留言）：连按两下以上头像，左右抖动一下
      let avaTaps = 0, avaTapTimer = null;
      this.el.heroAva.addEventListener('click', () => {
        avaTaps++;
        clearTimeout(avaTapTimer);
        avaTapTimer = setTimeout(() => { avaTaps = 0; }, 600);
        if (avaTaps < 2) return;
        avaTaps = 0;
        const ava = this.el.heroAva;
        ava.classList.remove('ava-shake');
        void ava.offsetWidth;
        ava.classList.add('ava-shake');
      });
    },

    act(name, fn) { this._acts[name] = fn; },

    // ---------- ? 帮助弹层：页面说明文字统一收进二级界面 ----------
    // 页面渲染时 registerHelp(id, {title, html, back})，并在页头放 helpBtn(id)；
    // 点 ? 打开帮助，点「返回」执行 back() 重绘原页面。
    registerHelp(id, def) { this.helpTopics[id] = def; },
    helpBtn(id) {
      // 2026-09-07 留言：全角"？ "字形墨迹不居中，换 SVG 问号保证几何居中
      return `<button class="help-btn" data-act="openHelp" data-page="${id}" title="查看说明"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8.1 9a3.9 3.9 0 1 1 6.05 3.27c-1.25.83-2.15 1.55-2.15 3.03v.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="19.7" r="1.35" fill="currentColor"/></svg></button>`;
    },
    showHelp(page) {
      const t = this.helpTopics[page];
      if (!t) return;
      this.showOverlay(`[[icon:question]] ${t.title}`, `
        <div class="help-body">${t.html}</div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="helpBack">↩ 返回</button></div>`, true);
      this.act('helpBack', () => { if (typeof t.back === 'function') t.back(); });
    },

    // 数值变化时弹跳一下（retrigger 动画）
    popNum(el) {
      if (!el) return;
      if (SDT.Motion) { SDT.Motion.pop(el); return; }
      el.classList.remove('popnum');
      void el.offsetWidth;
      el.classList.add('popnum');
    },


    // 传说卡获得特写（2026-09-07 留言：获得传说物品没有提示和界面）：
    // 全屏暗幕 + 金色光柱 + 大卡面揭晓，点击任意处或 2.8s 后自动收场。
    showLegendGet(card) {
      if (!card) return;
      const old = document.getElementById('legendGet');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'legendGet';
      el.innerHTML = `<div class="lg-beam" aria-hidden="true"></div>
        <span class="lg-kicker">LEGENDARY · 传说</span>
        <div class="lg-card">${SDT.Cards.cardHTML(card, 'lg')}</div>
        <b class="lg-name">${card.name}</b>
        <span class="lg-hint">点击任意处继续</span>`;
      const close = () => { el.classList.add('lg-out'); setTimeout(() => el.remove(), 420); };
      el.addEventListener('click', close, { once: true });
      document.body.appendChild(el);
      SDT.Sound.sfx('legend');
      setTimeout(() => { if (el.isConnected) close(); }, 2800);
    },

    // 卡牌获得奖励演出（2026-09-13 老板：事件发卡要有奖励动画，不能静默进背包）：
    // 与传说特写同壳（#cardGet 复用 #legendGet 的样式与动画），传说卡保留金色光柱与
    // legend 音效，其余卡为中性演出 + gain 音效。多张连发走队列逐张播放。
    // reason：可选的获得原因文字（2026-09-20 老板——发牌点要说明为什么给这张牌）
    _cardGetQueue: [],
    _cardGetShowing: false,
    showCardReward(card, reason) {
      if (!card) return;
      this._cardGetQueue.push({ card, reason });
      if (this._cardGetShowing) return;
      this._cardGetShowing = true;
      const showNext = () => {
        const next = this._cardGetQueue.shift();
        if (!next) { this._cardGetShowing = false; return; }
        const legendary = next.card.rarity === '传说';
        const el = document.createElement('div');
        el.id = 'cardGet';
        el.innerHTML = `<div class="lg-beam${legendary ? '' : ' lg-beam-plain'}" aria-hidden="true"></div>
          <span class="lg-kicker">${legendary ? 'LEGENDARY · 传说' : 'REWARD · 获得卡牌'}</span>
          <div class="lg-card">${SDT.Cards.cardHTML(next.card, 'lg')}</div>
          <b class="lg-name">${next.card.name}</b>
          ${next.reason ? `<span class="lg-reason">${esc(next.reason)}</span>` : ''}
          <span class="lg-hint">点击任意处继续</span>`;
        let closed = false;
        const close = () => {
          if (closed || !el.isConnected) return;
          closed = true;
          el.classList.add('lg-out');
          setTimeout(() => el.remove(), 420);
          setTimeout(showNext, 100);
        };
        el.addEventListener('click', close, { once: true });
        document.body.appendChild(el);
        SDT.Sound.sfx(legendary ? 'legend' : 'gain');
        setTimeout(close, legendary ? 2800 : 2200);
      };
      showNext();
    },

    // 卡牌放大特写（2026-09-07 留言：背包卡面点击放大查看）：
    // 背景虚化压暗，卡牌 lg 大面居中弹出，点击任意处缩回；opts.footer 可挂额外按钮。
    // 2026-09-12 留言：opts.from 传来源卡元素（或 rect）时走 FLIP——从来源卡的位置与
    // 尺寸放大到居中位，替代统一的中央淡入；未传 from 的调用点维持原 czIn 动画。
    showCardZoom(card, opts = {}) {
      if (!card) return;
      const old = document.getElementById('cardZoom');
      if (old) {
        if (typeof old._closeCardZoom === 'function') old._closeCardZoom(true);
        else old.remove();
      }
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const inertHost = this.el.overlay;
      const overlayWasInert = !!inertHost?.inert;
      if (inertHost) inertHost.inert = true;
      // 2026-09-19 留言 #29：特写多一个「馆方记录」区，展示老板手写的正式记录（卡牌库可编辑）
      const note = (opts.note != null ? opts.note : (card.note || '')) || '';
      const noteLabel = opts.noteLabel || '备注';
      const notePlaceholder = opts.notePlaceholder || '点击这里写备注……';
      const noteHTML = opts.noteEditable ? `
        <label class="cz-note${note ? ' has' : ''} editable">
          <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>
          <textarea class="cz-note-input" maxlength="240" rows="3" placeholder="${esc(notePlaceholder)}" aria-label="${esc(noteLabel)}">${esc(note)}</textarea>
          <span class="cz-note-status" aria-live="polite">${note ? '已存档' : '尚未撰写'}</span>
        </label>` : `
        <div class="cz-note${note ? ' has' : ''}">
          <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>
          <p class="cz-note-text">${note ? esc(note) : '暂无备注'}</p>
        </div>`;
      const el = document.createElement('div');
      el.id = 'cardZoom';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', `${card.name || '卡牌'}大图与${noteLabel}`);
      el.tabIndex = -1;
      el.innerHTML = `<div class="cz-backdrop" aria-hidden="true"></div>
        <span class="cz-flash" aria-hidden="true"></span>
        <button type="button" class="cz-close" aria-label="关闭卡牌大图">[[icon:cross]]</button>
        <div class="cz-card">${SDT.Cards.cardHTML(card, 'lg')}</div>
        ${noteHTML}
        ${opts.footer ? `<div class="cz-foot">${opts.footer}</div>` : ''}
        <span class="cz-hint">Esc 或点击背景收回</span>`;
      let closed = false;
      let noteSaveTimer = null;
      const noteInput = el.querySelector('.cz-note-input');
      const noteStatus = el.querySelector('.cz-note-status');
      const saveNote = () => {
        if (!noteInput || typeof opts.onNoteSave !== 'function') return;
        const saved = opts.onNoteSave(noteInput.value);
        if (noteStatus) noteStatus.textContent = saved ? '已存档' : '尚未撰写';
        // 存档章跟随真实内容（批次四：写空=章摘下，写了=章盖上）
        el.querySelector('.cz-note')?.classList.toggle('has', !!(saved && noteInput.value.trim()));
      };
      if (noteInput) {
        noteInput.addEventListener('input', () => {
          if (noteStatus) noteStatus.textContent = '保存中…';
          clearTimeout(noteSaveTimer);
          noteSaveTimer = setTimeout(saveNote, 240);
        });
        noteInput.addEventListener('blur', () => { clearTimeout(noteSaveTimer); saveNote(); });
      }
      const close = (immediate = false) => {
        if (closed) return;
        clearTimeout(noteSaveTimer);
        saveNote();
        closed = true;
        // cz-flip 的 animation:none 会一并压掉 czOut，收回前摘掉它恢复出场动画
        // （inline transform/opacity 一并清掉，防中途收回残留）
        const cardEl = el.querySelector('.cz-card');
        if (cardEl) {
          cardEl.classList.remove('cz-flip');
          cardEl.style.transform = '';
          cardEl.style.opacity = '';
        }
        if (inertHost) inertHost.inert = overlayWasInert;
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        if (immediate) {
          el.remove();
          return;
        }
        el.classList.add('cz-out');
        setTimeout(() => el.remove(), 260);
      };
      el._closeCardZoom = close;
      // 特写挂在 body（overlay 之外），footer 按钮的 data-act 走不到 ovBody 的全局委托；
      // 且不用 {once:true}：点按钮会白白消费掉监听，之后（含 bagZoomRemove 的模拟 backdrop
      // 点击）再也关不掉 → 整页卡死（2026-09-07 老板实测）。故监听常驻：非按钮区域总能收回，
      // footer 按钮（如「移出背包」）在本层直接分发。
      el.addEventListener('click', (e) => {
        if (closed) return;
        if (e.target.closest('.cz-close')) { close(); return; }
        const btn = e.target.closest('.cz-foot [data-act]');
        if (btn) {
          const fn = this._acts[btn.dataset.act];
          if (fn) fn(btn.dataset);
          return;
        }
        if (e.target.closest('.cz-note')) return;
        close();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
          return;
        }
        if (e.key !== 'Tab') return;
        const focusable = [...el.querySelectorAll('button,textarea,[href],[tabindex]:not([tabindex="-1"])')]
          .filter(node => !node.disabled && node.getClientRects().length);
        if (!focusable.length) { e.preventDefault(); el.focus(); return; }
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }, true);
      document.body.appendChild(el);
      // 大图显式解码，防 IAB 合成黑窗（同池页首屏/战斗手牌修法；2026-09-20 走查实锤特写黑窗）
      if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(el);
      // 彩蛋：长按大图 600ms「看底片」（挂 cz-neg，负片样式 scoped 在照相馆入口），松开恢复
      const zoomCard = el.querySelector('.cz-card');
      let negTimer = null;
      const clearNeg = () => { clearTimeout(negTimer); el.classList.remove('cz-neg'); };
      zoomCard?.addEventListener('pointerdown', () => {
        clearTimeout(negTimer);
        negTimer = setTimeout(() => el.classList.add('cz-neg'), 600);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
        zoomCard?.addEventListener(ev, clearNeg));
      el.querySelector('.cz-close')?.focus({ preventScroll: true });
      // FLIP 起点终点都取布局口径（UiScale.rect）：dx/dy 喂 transform（布局值），zoom≠1 才不错位
      const fromR = opts.from && (opts.from.getBoundingClientRect ? SDT.UiScale.rect(opts.from) : opts.from);
      if (fromR && fromR.width > 0) {
        const cardEl = el.querySelector('.cz-card');
        const toR = SDT.UiScale.rect(cardEl);
        if (toR.width > 0) {
          // FLIP：先摆到来源卡位置与等比尺寸（中心对齐），下一帧过渡到居中位。
          // 起步带低透明度 + 缓和曲线（.22,.61）：观感是"卡从原位浮现长大"，
          // 快曲线会让卡像从屏幕外冲进来（2026-09-12 老板复验反馈）。
          const s = fromR.width / toR.width;
          const dx = (fromR.left + fromR.width / 2) - (toR.left + toR.width / 2);
          const dy = (fromR.top + fromR.height / 2) - (toR.top + toR.height / 2);
          cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
          cardEl.style.opacity = '0.25';
          cardEl.classList.add('cz-flip');
          // 强制 reflow 落定初态再清空即触发过渡——不能用双 rAF：后台窗口 rAF
          // 停转会永远冻在起点（2026-09-12 实测），reflow 同步触发无此依赖。
          void cardEl.offsetWidth;
          cardEl.style.transform = '';
          cardEl.style.opacity = '';
        }
      }
      SDT.Sound.sfx('hover');
    },

    refresh(game) {
      renderExpeditionPanel($('routePanel'), game, name => SDT.Icons.img(name));
      // 格子结算链回到 idle，才真正退出房间页；战斗→宝箱等中间切页不会闪回地图。
      if (game.state === 'idle' && this._roomActive) this.endRoom();
      const layer = game.curLayer ? game.curLayer() : null;
      // 顶部居中环层横幅：仅在换层时触碰 DOM
      if (this._lastBannerLayer !== layer) {
        this._lastBannerLayer = layer;
        this.el.layerZh.textContent = layer ? layer.name : '—';
        this.el.layerEn.textContent = layer && layer.nameEn ? layer.nameEn : '';
        // 换层演出：横幅重播一次滑入（一次性动画走合成器；reduce-motion 由 CSS 豁免）
        const banner = this.el.layerZh.closest('#layerBanner');
        if (banner) {
          banner.classList.remove('lb-swap');
          void banner.offsetWidth;
          banner.classList.add('lb-swap');
        }
      }
      const turn = game.turn - 1;
      if (this._lastTurn !== turn) {
        this._lastTurn = turn;
        this.el.statTurn.textContent = turn;
      }
      const valTotal = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
      if (this._lastValue !== valTotal) {
        this.el.statValue.textContent = valTotal.toLocaleString();
        if (this._lastValue != null) this.popNum(this.el.statValue);
        this._lastValue = valTotal;
      }

      // 人物：血条 + 经济 + 背包格数
      const pct = Math.max(0, game.hp / game.maxHp);
      const hpKey = `${game.hp}/${game.maxHp}`;
      if (this._lastHpKey !== hpKey) {
        this._lastHpKey = hpKey;
        this.el.hpBar.style.width = (pct * 100).toFixed(1) + '%';
        this.el.hpBar.style.background = pct > 0.5 ? 'linear-gradient(90deg,#2f6f9f,#55a4d6)'
          : pct > 0.25 ? 'linear-gradient(90deg,#b08238,#d4a44e)' : 'linear-gradient(90deg,#b8453a,#d97a52)';
        this.el.hpBarWrap.classList.toggle('low', pct <= 0.25 && game.hp > 0);
        this.el.hpText.innerHTML = `${game.hp}<span class="hp-rest">/${game.maxHp}</span>`;
      }
      if (this._lastCoins !== game.coins) {
        this.el.charCoins.textContent = game.coins;
        if (this._lastCoins != null) this.popNum(this.el.charCoins);
        this._lastCoins = game.coins;
      }
      if (this._lastAtk !== game.atk) {
        this.el.charAtk.textContent = game.atk;
        if (this._lastAtk != null) this.popNum(this.el.charAtk);
        this._lastAtk = game.atk;
      }
      // 头像与职业（选职业后同步；头像使用职业立绘）
      const cls = game.myClass || '';
      if (this._lastHeroCls !== cls) {
        this._lastHeroCls = cls;
        this.el.heroAva.innerHTML = (cls && SDT.Art) ? SDT.Art.classAvatarArt(cls) : '旅';
      }
      // 物资 + 卡牌混占背包格；安全格 / 消耗口袋见背包弹窗，容量由基地决定
      const used = game.usedSlots ? game.usedSlots() : game.inventory.length;
      const cap = game.bagCap ? game.bagCap() : game.map.rules.bagSize;
      const bagKey = `${used}/${cap}`;
      if (this._lastBagKey !== bagKey) {
        this._lastBagKey = bagKey;
        // 底栏背包按钮已删（2026-09-19）：入口收敛到全局浮动键，满载警示也移到浮动键上
        if (this.el.bagCountFloat) this.el.bagCountFloat.textContent = bagKey;
        if (this.el.bagBtnFloat) this.el.bagBtnFloat.classList.toggle('bag-full', used >= cap);
      }
      // #27 全局浮动背包键：对局中（且已选角色）任何界面显示；标题/基地/整备/选人时隐藏
      if (this.el.bagBtnFloat) {
        this.el.bagBtnFloat.hidden = !(game.runActive && game.myClass);
      }
    },

    log(msg, cls) {
      if (!this.el.log) return;   // 日志面板已从前台移除，仅保留内部记录入口
      const div = document.createElement('div');
      div.className = 'log-line' + (cls ? ' ' + cls : '');
      const t = new Date();
      const hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0'), ss = String(t.getSeconds()).padStart(2, '0');
      div.title = `${hh}:${mm}:${ss}`;   // 时间戳收进悬浮提示，减少视觉拥挤
      div.innerHTML = SDT.Icons.rich(msg);
      // U10（2026-09-19 走查）：空面板只占位不干活——首条日志进来时自动展开
      if (this.el.logPanel && this.el.log.children.length === 0) {
        this.el.logPanel.classList.remove('collapsed');
        localStorage.setItem('sdt-log-collapsed', '0');
      }
      this.el.log.prepend(div);
      while (this.el.log.children.length > 60) this.el.log.lastChild.remove();
    },

    clearLog() {
      if (!this.el.log) return;
      this.el.log.innerHTML = '';
      // U10：清空后回折叠态（U10 空态收起，避免开局左下大块空面板）
      if (this.el.logPanel) {
        this.el.logPanel.classList.add('collapsed');
        localStorage.setItem('sdt-log-collapsed', '1');
      }
    },

    showTooltip(clientX, clientY, title, lines) {
      // 2026-09-19 留言 #7：任意界面鼠标停留都不再弹解释框——入口保留但整体空转，
      // 地图节点/顶栏/手牌等调用点零改动，#tooltip 元素永不显示
      void clientX; void clientY; void title; void lines;
    },

    hideTooltip() { this.el.tooltip.hidden = true; },

    beginRoom() {
      this._roomActive = true;
      this.el.overlay.classList.add('room-view');
    },

    endRoom() {
      this._roomActive = false;
      this.el.overlay.classList.remove('room-view');
      const card = this.el.ovBody && this.el.ovBody.parentElement;
      if (card) card.classList.remove('room');
    },

    // ---------- 顶层屏幕进出（标题页/告别屏/留言信箱这类 hidden 直切元素） ----------
    // boss 留言 #52（所有界面退出都有过渡动画）延伸到屏幕级：入场动画由 CSS 在
    // display:none→显示时自动重播，这里只负责退场类与隐藏时机；reduce-motion 瞬时完成。
    showScreen(el) {
      if (!el) return;
      el._scrToken = (el._scrToken || 0) + 1;   // 作废进行中的隐藏计时
      el._scrHiding = false;
      el.classList.remove('scr-out');
      el.style.pointerEvents = '';
      el.hidden = false;
    },

    hideScreen(el, after) {
      if (!el) return;
      if (el.hidden) { if (after) after(); return; }
      if (el._scrHiding) return;   // 淡出中防重入
      el._scrHiding = true;
      el._scrToken = (el._scrToken || 0) + 1;
      const token = el._scrToken;
      if (SDT.Motion && SDT.Motion.reduceMotion()) {
        el._scrHiding = false;
        el.hidden = true;
        if (after) after();
        return;
      }
      el.classList.add('scr-out');
      el.style.pointerEvents = 'none';   // 淡出窗口内拦截点击，防连点重入
      setTimeout(() => {
        el.style.pointerEvents = '';
        el._scrHiding = false;
        if (el._scrToken !== token) return;   // 期间被 showScreen 重新拉起
        el.classList.remove('scr-out');
        el.hidden = true;
        if (after) after();
      }, 240);
    },

    showOverlay(title, bodyHtml, mode, options = {}) {
      // 失败/清空类标题用红色语义
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      const wasOpen = !this.el.overlay.hidden;
      if (!wasOpen) {
        const active = document.activeElement;
        this._overlayReturnFocus = active && active !== document.body ? active : null;
      }
      this.el.overlay.classList.remove('closing');
      this.el.overlay.setAttribute('role', 'dialog');
      this.el.overlay.setAttribute('aria-modal', 'true');
      this.el.overlay.setAttribute('aria-labelledby', 'ovTitle');
      this.el.ovTitle.classList.toggle('bad', /失败|清空|删除|倒下/.test(title));
      this.el.ovTitle.innerHTML = SDT.Icons.rich(title);
      // 2026-09-06 #17：战利品结算页 = 战斗胜利动画（1.4s 强调入场）
      const victoryCard = this.el.ovBody.parentElement;
      if (victoryCard && /搜刮！/.test(title)) { victoryCard.classList.remove('fx-victory'); void victoryCard.offsetWidth; victoryCard.classList.add('fx-victory'); }
      this.el.ovBody.innerHTML = SDT.Icons.rich(bodyHtml);
      // 广播当前弹层模式：战斗序列帧层据此做白名单（只有 battle 模式可见，2026-09-13 留言）
      document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
      // 主循环每帧读此标志判断“战斗页是否盖在画布上”；battle-stage 只会经这里进
      // overlay（ovBody 无其他写入点），按内容缓存一次，免去每帧全子树 querySelector
      this._hasBattleStage = bodyHtml.includes('battle-stage');
      const card = this.el.ovBody.parentElement;
      card.classList.toggle('wide', mode === true || mode === 'wide' || mode === 'chest' || mode === 'discover');
      card.classList.toggle('chest', mode === 'chest');   // 战利品/开箱浮层专属类（2026-09-09 重做放大）
      card.classList.toggle('discover', mode === 'discover');   // 发现浮层（2026-09-09 留言 #12：虚化背景而非纯黑）
      card.classList.toggle('battle', mode === 'battle');
      card.classList.toggle('bag-modal', mode === 'bag');
      card.classList.toggle('bag-page', mode === 'bagpage');
      card.classList.toggle('page', mode === 'page');
      card.classList.toggle('scene', mode === 'scene');
      // 宝箱浮层悬在原画面上：即使处于房间结算流也不吃全屏 room 样式
      card.classList.toggle('room', this._roomActive && mode !== 'page' && mode !== 'bag' && mode !== 'bagpage' && mode !== 'chest' && mode !== 'discover');
      // 战斗弹窗也按房间页处理：主循环据此冻结棋盘渲染/暂停壁纸解码，
      // 并关掉 #overlay 的大面积 backdrop blur（非房间路径开战时的卡顿源）
      // 宝箱/发现浮层例外：不吃 room-view，保留暗纱+blur 衬托悬浮面板
      this.el.overlay.classList.toggle('room-view', mode === 'battle' || (this._roomActive && mode !== 'chest' && mode !== 'discover'));
      this.el.overlay.classList.toggle('bag-full', mode === 'bagpage');
      this.el.overlay.classList.toggle('opaque', mode === 'page' || mode === 'bagpage');
      // 发现/选卡浮层（discover/chest，2026-09-15）：背景一律半透明暗纱 + 全屏虚化，
      // 不再吃 room-view 的整屏不透明灰（样式见 winter.css「发现/选卡浮层统一重做」块）
      this.el.overlay.classList.toggle('pick-veil', mode === 'discover' || mode === 'chest');
      // 撤离失败页（2026-09-13 留言：UI 重做 + 背景透明）：标记在 overlay 上，
      // 让该页脱离 room-view 的整屏不透明底，改走半透明暗纱 + 玻璃面板
      this.el.overlay.classList.toggle('fx-doom', mode === 'doom');
      // 玻璃确认浮层（2026-09-19 留言 #25「丢弃卡牌？」等小确认页背景透明）：
      // 同 fx-doom 的暗纱透底，面板走中性色调玻璃卡
      this.el.overlay.classList.toggle('fx-glass', mode === 'glass');
      // 已打开状态下且弹窗模式变化（场景→战斗→结算等）时重播滑入动画；
      // 战斗内反复 render（同模式）不重播，避免每出一张卡就闪一次
      // 2026-09-12 留言 #33：page 页之间的返回/前进导航也重播入场动画（battle/bag 等高频重绘模式除外）
      if (wasOpen && (this._lastMode !== mode || mode === 'page')) {
        card.classList.remove('swap');
        void card.offsetWidth;
        card.classList.add('swap');
      }
      const prevMode = this._lastMode;
      this._lastMode = mode;
      this.el.overlay.hidden = false;
      // 右上角 × 显隐：只有能被取消类入口安全关闭的浮层才显示（必选流程/战斗页自动隐藏）。
      // 卡牌库整页头部自带关闭钮（photo-studio v3 的 pg-close），全局 × 与它并排重复
      // （2026-09-20 老板：卡牌库有两个退出键）——该页隐藏全局 ×，Esc 仍走页内钮关闭
      if (this.el.ovCloseX) this.el.ovCloseX.hidden = !this._canCancelOverlay() || !!this.el.ovBody.querySelector('.card-library-page');
      this._isolateOverlayBackground();
      // 全屏覆盖型页面（卡牌库/整备整页/战斗房间/宝箱）：被盖住的主页动画一律暂停
      // （2026-09-07 老板：动画不出现在画面中就暂停，回到页面再恢复）。
      // 实测卡牌库打开时标题雪花+余烬继续跑，帧率被拖到 10fps。
      // 半透明弹窗（背包/事件/场景）底下画面可见，不置位。
      document.body.classList.toggle('page-covered',
        this.el.overlay.classList.contains('opaque') ||
        this.el.overlay.classList.contains('room-view') ||
        mode === 'chest');
      // 替代 winter.css 的 body:has(#overlay.opaque) 选择器：:has 会在 overlay 子树
      // 每次重建时放大整页样式失效范围，body 类只触发一次单类切换
      document.body.classList.toggle('page-opaque', this.el.overlay.classList.contains('opaque'));
      // page 全屏页自带 CSS 入场动画（.card.page 的 pgIn），WAAPI 再叠一层会与
      // CSS 动画互相覆盖造成过渡期跳帧——这里只跑 CSS 那套。
      // bagpage 背包页同理（2026-09-19 留言 #3：展开动画走 .card.bag-page 的 bagIn）
      if ((!wasOpen || prevMode !== mode) && SDT.Motion && mode !== 'page' && mode !== 'bagpage') SDT.Motion.overlayIn(card);
      // 只在弹窗真正打开/切换模式时播开窗音效——战斗内反复 render 不刷音效
      if (!wasOpen || prevMode !== mode) {
        SDT.Sound.sfx('open');
        // 焦点导航（game-ui-ux）：显式首焦点优先；否则优先安全的取消/返回
        // 语义，避免确认页默认把不可逆动作放在 Enter 的第一击上。
        requestAnimationFrame(() => {
          if (this.el.overlay.hidden) return;
          const target = this._resolveOverlayInitialFocus(options.initialFocus);
          if (target) target.focus({ preventScroll: true });
          else this.el.overlay.focus({ preventScroll: true });
        });
      }
      // U1（2026-09-19 交互走查）：整页节点/场景壳的背景大图首次打开才发请求，
      // 解码期间页面近乎纯黑、无任何反馈。这里读出 data-asset-key 元素的背景 URL，
      // 未就绪时挂 bg-loading 类（CSS 显示「正在进入…」微提示），图片到齐后自动摘除。
      this._checkPageBg();
    },

    // U1：整页背景就绪检测。_bgReady 缓存已确认加载过的 URL，重复打开零开销。
    _bgReady: null,
    _checkPageBg() {
      const host = this.el.ovBody.querySelector('[data-asset-key]');
      if (!host) return;
      const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(host).backgroundImage || '');
      if (!m) return;
      const url = m[1];
      if (this._bgReady && this._bgReady.has(url)) return;
      if (!this._bgReady) this._bgReady = new Set();
      const probe = new Image();
      const done = () => {
        this._bgReady.add(url);
        // 页面可能在加载期间被换掉：只摘当前在台面上的 loading 类
        if (!this.el.overlay.hidden && this.el.ovBody.contains(host)) host.classList.remove('bg-loading');
      };
      probe.onload = done;
      if (probe.complete && probe.naturalWidth > 0) { done(); return; }
      host.classList.add('bg-loading');
      probe.src = url;
    },

    // 跳转代际令牌（迭代评审 09-20 QA 岗）：exitToTitle 的 immediate 关层即「跳转发生」；
    // 计划在跳转后迟到的 showOverlay 可自留 token 并用 layerValid() 自检，失败即放弃开层
    _jumpSeq: 0,
    layerToken() { return ++this._jumpSeq; },
    layerValid(t) { return t === this._jumpSeq; },
    // 背包关闭回调（game.bag bindBagMixins 晚绑定注册，避免 ui→bag 静态成环）：
    // Esc/遮罩关背包必须走 closeBackpack 的状态复位，直接 hideOverlay 会把 game.state 卡死在 modal
    _bagCloseHook: null,

    hideOverlay(opts) {
      const immediate = !!(opts && opts.immediate);
      // 已关闭且无挂起收尾：短路（迭代评审 09-20 客户端岗）——迟到的 transition/chest 收尾
      // 不再空跑 finish、重放 close 音
      if (!this._hideTimer && this.el.overlay.hidden) return;
      // 淡出中重复触发：普通调用忽略；immediate 调用清掉挂起收尾改为同步执行——
      // 消灭「210ms 淡出窗口内二次跳转/开层被旧 finish 撕掉」竞态（龙巢撤离死锁根因）
      if (this._hideTimer) {
        if (!immediate) return;
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      this._lastMode = null;
      this._acts = {};
      this._inputHandler = null;
      this._hoverHandler = null;
      SDT.Sound.sfx('close');
      const card = this.el.ovBody.parentElement;
      // 不透明整屏页淡出：boss 留言 #52 要求所有界面退出都有过渡动画（200ms 淡出+下移）；
      // room-view（战斗/房间页）例外保持瞬隐——留言 #33 实测整屏淡出每帧全屏重合成是
      // 「继续」卡顿来源，性能口径优先（overlays.css 有同步注释）。
      // immediate（exitToTitle 收口）同样走同步：跳转不允许留任何异步尾巴
      const instant = immediate || this.el.overlay.classList.contains('room-view');
      const finish = () => {
        this._hideTimer = null;
        this._finishHide = null;
        document.body.classList.remove('page-covered');
        document.body.classList.remove('page-opaque');
        card.classList.remove('wide');
        card.classList.remove('battle');
        card.classList.remove('bag-modal');
        card.classList.remove('bag-page');
        card.classList.remove('page');
        card.classList.remove('scene');
        card.classList.remove('swap');
        card.classList.remove('room');
        this.el.overlay.classList.remove('closing');
        this.el.overlay.classList.remove('opaque');
        this.el.overlay.classList.remove('bag-full');
        this.el.overlay.classList.remove('fx-doom');
        this.el.overlay.classList.remove('fx-glass');
        this.el.overlay.hidden = true;
        this._restoreOverlayBackground();
        // 隐藏不等于释放：卡牌库一次可生成 5k+ DOM 节点与数百张 <img>。关闭后若仍留在
        // ovBody，会长期占用 JS/DOM/图片资源，反复开关虽不线性叠加但峰值永不回落。
        // showOverlay 每次都会完整重建内容，因此关闭动画完成后可以安全清空。
        this.el.ovBody.replaceChildren();
        this._hasBattleStage = false;
        // 关闭不透明页面后，Canvas 从低频巡检态立即醒来补一帧，避免最多 250ms 的回图延迟。
        SDT.RenderScheduler?.invalidate?.();
        const returnFocus = this._overlayReturnFocus;
        this._overlayReturnFocus = null;
        if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[inert]') && !returnFocus.hidden) {
          returnFocus.focus({ preventScroll: true });
        }
      };
      if (instant) { finish(); return; }
      this.el.overlay.classList.add('closing');
      // 等淡出动画播完再真正隐藏并还原布局类，避免淡出期间跳版；
      // 期间 hidden 仍为 false，输入拦截逻辑不受影响
      this._finishHide = finish;
      this._hideTimer = setTimeout(finish, 210);
    },

    // Esc 关闭当前浮层（2026-09-09 老板：浮层要能按 Esc 关）。
    // 返回 true 表示已处理。战斗页与结算类页面（没有取消按钮可代点）一律不关，
    // 避免把必须做出选择的流程（撤离失败 / 宝箱强选 / BOSS 编组）跳过。
    closeTopOverlayByEsc() {
      if (this.el.overlay.hidden) return false;
      const mode = this._lastMode;
      if (mode === 'battle') return false;   // 战斗中 Esc 只清瞄准，不退战斗
      // 优先模拟页面上的「取消语义」按钮：宝箱「跳过」、环间门「留下」、商店「离开」等。
      // 图标关闭钮（背包 × / 卡池 ×）文本为空，按 data-act 与 aria-label/title 兜底匹配
      const cancelBtn = this._findCancelBtn();
      if (cancelBtn) { cancelBtn.click(); return true; }
      // 场景演出页（点击任意处继续）：走 sceneNext 通道
      if (this.el.ovBody.querySelector('[data-act="sceneNext"]')) { this.act('sceneNext'); return true; }
      // 背包这类只有信息没有按钮的浮层：走 bag 侧注册的关闭回调（closeBackpack 唯一收口，
      // 复位 game.state）；钩子未注册时（启动早期）退回直接关
      if (mode === 'bag' || mode === 'bagpage') { if (this._bagCloseHook) this._bagCloseHook(); else this.hideOverlay(); return true; }
      return false;
    },

    // 面板内「取消语义」按钮探测（Esc / 右上角 × / 遮罩点击共用）
    _findCancelBtn() {
      return [...this.el.ovBody.querySelectorAll('button')]
        .find(b => !b.disabled && !b.closest('[hidden], [aria-hidden="true"]') && (
          /跳过|留下|返回|取消|关闭|离开/.test(b.textContent || '') ||
          /^(closeBag|closeCardPage|closeDesigner|pg-close)$/.test(b.dataset.act || '') ||
          /关闭|返回/.test(b.getAttribute('aria-label') || '') || /关闭|返回/.test(b.getAttribute('title') || '')));
    },

    // 当前浮层是否可通过取消类入口关闭（决定右上角 × 的显隐）
    _canCancelOverlay() {
      if (this.el.overlay.hidden || this._lastMode === 'battle') return false;
      if (this._findCancelBtn()) return true;
      if (this.el.ovBody.querySelector('[data-act="sceneNext"]')) return false;   // 点击任意处继续，无需 ×
      const m = this._lastMode;
      return m === 'bag' || m === 'bagpage';
    },

    _overlayFocusable() {
      const root = this.el.ovBody || this.el.overlay;
      return [...root.querySelectorAll(
        'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
        'select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], ' +
        '[tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.closest('[hidden], [aria-hidden="true"]'));
    },

    _resolveOverlayInitialFocus(initialFocus) {
      const root = this.el.ovBody || this.el.overlay;
      let target = null;
      if (initialFocus && initialFocus.nodeType === 1 && root.contains(initialFocus)) target = initialFocus;
      if (!target && typeof initialFocus === 'string') {
        try { target = root.querySelector(initialFocus); } catch (_) { target = null; }
      }
      // HTML 中的 data-initial-focus 是调用方无需接触 DOM 引用的安全显式入口。
      if (!target) target = root.querySelector('[data-initial-focus]');
      if (target && !target.matches('button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]')) target = null;
      if (target && (target.disabled || target.closest('[hidden], [aria-hidden="true"]'))) target = null;
      const focusables = this._overlayFocusable();
      if (!target) {
        // 取消/保留/返回优先；同一规则覆盖「确认丢弃」「放弃对局」等危险弹窗。
        target = focusables.find((el) => {
          const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.dataset.act || ''}`;
          return /取消|返回|关闭|继续|放回|保留|不删除|不清空|留下/.test(text);
        });
      }
      return target || focusables[0] || null;
    },

    _trapOverlayFocus(e) {
      const focusables = this._overlayFocusable();
      if (!focusables.length) {
        e.preventDefault();
        this.el.overlay.focus({ preventScroll: true });
        return;
      }
      const active = document.activeElement;
      const index = focusables.indexOf(active);
      if (e.shiftKey) {
        if (index <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus({ preventScroll: true }); }
      } else if (index < 0 || index === focusables.length - 1) {
        e.preventDefault(); focusables[0].focus({ preventScroll: true });
      }
    },

    _isolateOverlayBackground() {
      if (this._overlayInerted.length) return;
      let node = this.el.overlay;
      while (node && node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling === node || sibling.hasAttribute('inert')) continue;
          sibling.setAttribute('inert', '');
          this._overlayInerted.push(sibling);
        }
        node = node.parentElement;
      }
    },

    _restoreOverlayBackground() {
      for (const el of this._overlayInerted.splice(0)) el.removeAttribute('inert');
    },
  };

  SDT.UI = UI;

export { SDT, UI };
