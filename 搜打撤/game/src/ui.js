import { characterName } from './characters.js';
import { Random } from './random.js';
import { renderExpeditionPanel } from './expedition.view.js';
  const SDT = window.SDT;
  const $ = (id) => document.getElementById(id);

  const UI = {
    el: {},
    _acts: {},   // 弹窗按钮动作表：data-act → 回调
    _baseActs: {},   // 全局基础动作（页面同名动作优先）
    _roomActive: false, // 地图格子的整段结算都保持为全屏房间页
    helpTopics: {},  // pageId -> { title, html, back }（? 帮助弹层主题，页面渲染时注册）

    init() {
      this.el = {
        statTurn: $('statTurn'), statValue: $('statValue'),
        hpBar: $('hpBar'), hpBarWrap: $('hpBarWrap'), hpText: $('hpText'), charCoins: $('charCoins'),
        charAtk: $('charAtk'),
        heroAva: $('heroAva'),
        bagCount: $('bagCount'), bagBtn: $('bagBtn'), btnHome: $('btnHome'),
        rollBtn: $('rollBtn'), diceFace: $('diceFace'), diceHist: $('diceHist'), staminaVal: $('staminaVal'), staminaRow: $('staminaRow'),
        log: $('log'),
        overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'),
        tooltip: $('tooltip'),
        tglIndex: $('tglIndex'),
        btnExport: $('btnExport'), btnImport: $('btnImport'), btnClear: $('btnClear'),
        devTools: $('devTools'), devDice: $('devDice'),
        devBattle: $('devBattle'), devBoss: $('devBoss'),
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
      this.buildDiceCube();
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

    // 搭建真 3D 骰子立方体：六个面（对面和为 7）各自 rotate+translateZ 拼合
    buildDiceCube() {
      const PIP_CELLS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
      const faces = Array.from({ length: 6 }, (_, k) => {
        const v = k + 1;
        const dots = Array.from({ length: 9 }, (_, i) =>
          PIP_CELLS[v].includes(i) ? '<span></span>' : '<i></i>').join('');
        return `<div class="dice-f f${v}">${dots}</div>`;
      }).join('');
      this.el.diceFace.innerHTML =
        `<div class="dice-hop"><div class="dice-tilt"><div class="dice-cube">${faces}</div></div></div>`;
      // 尚未投掷时也摆一颗完整骰子：1 点朝上，作为第一次翻滚的起始姿态。
      this._diceRot = [90, 0, 0];
      this.el.diceFace.querySelector('.dice-cube').style.transform = 'rotateX(90deg) rotateY(0deg) rotateZ(0deg)';
    },

    // 让立方体翻滚着停在 v 点朝上的朝向；外层 tilt 只负责俯视观察，不改变落定点数。
    // force=true：掷骰流程主动调用——与上一点数相同也翻滚（2026-09-07 留言：同面也要有动画）；
    // refresh 的被动同步不带 force，同值跳过避免每次刷新都空转。
    drawDice(v, force) {
      const face = this.el.diceFace, cube = face.querySelector('.dice-cube');
      if (!cube || (!force && v === this._drawn)) return;
      this._drawn = v;
      if (v == null) {
        face.classList.add('idle-dice');
        return;
      }
      face.classList.remove('idle-dice');
      // 与上次点数相同也强制换一条翻转路径：追加的整圈数与方向每次随机
      const spinX = (720 + 360 * Math.floor(Random.random('visual') * 2)) * (Random.random('visual') < .5 ? -1 : 1);
      const spinY = (720 + 360 * Math.floor(Random.random('visual') * 2)) * (Random.random('visual') < .5 ? -1 : 1);
      const spinZ = 360 * (1 + Math.floor(Random.random('visual') * 2)) * (Random.random('visual') < .5 ? -1 : 1);
      const REST = { 1: [90, 0, 0], 6: [-90, 0, 0], 3: [0, 0, -90], 4: [0, 0, 90], 2: [0, 0, 0], 5: [180, 0, 0] };
      const [rx, ry, rz] = REST[v];
      this._diceRot = [this._diceRot[0] + spinX + rx - (this._diceRot[0] % 360),
                       this._diceRot[1] + spinY + ry - (this._diceRot[1] % 360),
                       this._diceRot[2] + spinZ + rz - (this._diceRot[2] % 360)];
      cube.style.transform = `rotateX(${this._diceRot[0]}deg) rotateY(${this._diceRot[1]}deg) rotateZ(${this._diceRot[2]}deg)`;
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
    _cardGetQueue: [],
    _cardGetShowing: false,
    showCardReward(card) {
      if (!card) return;
      this._cardGetQueue.push(card);
      if (this._cardGetShowing) return;
      this._cardGetShowing = true;
      const showNext = () => {
        const next = this._cardGetQueue.shift();
        if (!next) { this._cardGetShowing = false; return; }
        const legendary = next.rarity === '传说';
        const el = document.createElement('div');
        el.id = 'cardGet';
        el.innerHTML = `<div class="lg-beam${legendary ? '' : ' lg-beam-plain'}" aria-hidden="true"></div>
          <span class="lg-kicker">${legendary ? 'LEGENDARY · 传说' : 'REWARD · 获得卡牌'}</span>
          <div class="lg-card">${SDT.Cards.cardHTML(next, 'lg')}</div>
          <b class="lg-name">${next.name}</b>
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
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'cardZoom';
      el.innerHTML = `<div class="cz-backdrop" aria-hidden="true"></div>
        <div class="cz-card">${SDT.Cards.cardHTML(card, 'lg')}</div>
        ${opts.footer ? `<div class="cz-foot">${opts.footer}</div>` : ''}
        <span class="cz-hint">点击任意处收回</span>`;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        // cz-flip 的 animation:none 会一并压掉 czOut，收回前摘掉它恢复出场动画
        // （inline transform/opacity 一并清掉，防中途收回残留）
        const cardEl = el.querySelector('.cz-card');
        if (cardEl) {
          cardEl.classList.remove('cz-flip');
          cardEl.style.transform = '';
          cardEl.style.opacity = '';
        }
        el.classList.add('cz-out');
        setTimeout(() => el.remove(), 260);
      };
      // 特写挂在 body（overlay 之外），footer 按钮的 data-act 走不到 ovBody 的全局委托；
      // 且不用 {once:true}：点按钮会白白消费掉监听，之后（含 bagZoomRemove 的模拟 backdrop
      // 点击）再也关不掉 → 整页卡死（2026-09-07 老板实测）。故监听常驻：非按钮区域总能收回，
      // footer 按钮（如「移出背包」）在本层直接分发。
      el.addEventListener('click', (e) => {
        if (closed) return;
        const btn = e.target.closest('.cz-foot [data-act]');
        if (btn) {
          const fn = this._acts[btn.dataset.act];
          if (fn) fn(btn.dataset);
          return;
        }
        close();
      });
      document.body.appendChild(el);
      const fromR = opts.from && (opts.from.getBoundingClientRect ? opts.from.getBoundingClientRect() : opts.from);
      if (fromR && fromR.width > 0) {
        const cardEl = el.querySelector('.cz-card');
        const toR = cardEl.getBoundingClientRect();
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
    refreshTime(game) {
      // 每帧调用：状态未翻转时不触碰 DOM
      const idle = game.state === 'idle';
      if (this._lastIdle === idle) return;
      this._lastIdle = idle;
      this.el.rollBtn.disabled = !idle;
      // 2026-09-07 老板实测「掷骰按钮文案消失」：存在 state→idle 只经过本函数
      // （refreshTime 只改 disabled）而不触发 refresh() 文案分支的路径，按钮会卡在
      // 「…」。idle 翻转的瞬间同步纠正文案，并同步 _lastRollState 防止 refresh 重复重建。
      if (idle) {
        this._lastRollState = 'idle';
        this.el.rollBtn.innerHTML = SDT.Icons.rich('[[icon:dice]] 掷骰子移动');
      }
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
      }
      const turn = game.turn - 1;
      if (this._lastTurn !== turn) {
        this._lastTurn = turn;
        this.el.statTurn.textContent = turn;
      }
      const valTotal = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
      if (this._lastValue !== valTotal) {
        this.el.statValue.textContent = '¥' + valTotal.toLocaleString();
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
        this.el.bagCount.textContent = bagKey;
        // 2026-09-06 #18：背包满/接近满时图标标红
        if (this.el.bagBtn) this.el.bagBtn.classList.toggle('bag-full', used >= cap);
        else if (this.el.bagCount.parentElement) this.el.bagCount.parentElement.classList.toggle('bag-full', used >= cap);
      }

      // 掷骰按钮：状态未变化时不重建 innerHTML（refresh 调用频繁）
      if (this._lastRollState !== game.state) {
        this._lastRollState = game.state;
        this.el.rollBtn.disabled = game.state !== 'idle';
        this.el.rollBtn.innerHTML = game.state === 'idle' ? SDT.Icons.rich('[[icon:dice]] 掷骰子移动')
          : game.state === 'moving' ? SDT.Icons.rich('[[icon:hourglass]] 移动中…')
          : game.state === 'rolling' ? SDT.Icons.rich('[[icon:dice]] 骰子转动中…') : SDT.Icons.rich('[[icon:hourglass]] …');
      }

      // 体力（2026-09-06 #29）：≤10 标红警告
      if (this.el.staminaVal && game.runActive) {
        const st = game.stamina == null ? SDT.MAP.rules.staminaMax : game.stamina;
        if (this._lastStamina !== st) {
          this._lastStamina = st;
          this.el.staminaVal.textContent = st;
          this.el.staminaRow.classList.toggle('stamina-low', st <= SDT.MAP.rules.staminaWarn);
        }
      }
      // 骰子面：右侧桌上骰子，用点数替代数字
      this.drawDice(game.dice);
      if (this._lastDice !== undefined && game.dice != null && this._lastDice !== game.dice) {
        this.popNum(this.el.diceFace);
      }
      this._lastDice = game.dice;
      const histKey = game.diceHistory.slice(-8).join(',');
      if (histKey !== this._lastHistKey) {
        this._lastHistKey = histKey;
        this.el.diceHist.innerHTML = game.diceHistory.slice(-8)
          .map(d => `<span class="chip">${d}</span>`).join('');
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
      this.el.log.prepend(div);
      while (this.el.log.children.length > 60) this.el.log.lastChild.remove();
    },

    clearLog() { if (this.el.log) this.el.log.innerHTML = ''; },

    showTooltip(clientX, clientY, title, lines) {
      const el = this.el.tooltip;
      const key = title + '\n' + lines.join('\n');
      if (this._tooltipKey !== key) {
        this._tooltipKey = key;
        el.innerHTML = `<b>${SDT.Icons.rich(title)}</b>` + lines.map(l => `<span>${SDT.Icons.rich(l)}</span>`).join('');
        el.hidden = false;
        const r = el.getBoundingClientRect();
        this._tooltipSize = { width: r.width, height: r.height };
      }
      el.hidden = false;
      const vw = this.el.viewport.clientWidth, vh = this.el.viewport.clientHeight;
      const r = this._tooltipSize || { width: 0, height: 0 };
      let x = clientX + 14, y = clientY + 14;
      if (x + r.width > vw - 8) x = clientX - r.width - 10;
      if (y + r.height > vh - 8) y = clientY - r.height - 10;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
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

    showOverlay(title, bodyHtml, mode) {
      // 失败/清空类标题用红色语义
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      const wasOpen = !this.el.overlay.hidden;
      this.el.overlay.classList.remove('closing');
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
      // CSS 动画互相覆盖造成过渡期跳帧——这里只跑 CSS 那套
      if ((!wasOpen || prevMode !== mode) && SDT.Motion && mode !== 'page') SDT.Motion.overlayIn(card);
      // 只在弹窗真正打开/切换模式时播开窗音效——战斗内反复 render 不刷音效
      if (!wasOpen || prevMode !== mode) {
        SDT.Sound.sfx('open');
        // 焦点导航（game-ui-ux）：打开/换页时把焦点交给首个可交互元素，键盘 Tab/Enter/Esc 可操作
        requestAnimationFrame(() => {
          if (this.el.overlay.hidden) return;
          const focusables = this.el.ovBody.querySelectorAll('button:not([disabled]), input:not([type="range"]), [tabindex]:not([tabindex="-1"])');
          if (focusables.length) focusables[0].focus({ preventScroll: true });
        });
      }
    },

    hideOverlay() {
      if (this._hideTimer) return;   // 淡出中，避免重复触发
      this._lastMode = null;
      this._acts = {};
      this._inputHandler = null;
      this._hoverHandler = null;
      SDT.Sound.sfx('close');
      const card = this.el.ovBody.parentElement;
      // 不透明整屏页淡出：boss 留言 #52 要求所有界面退出都有过渡动画（200ms 淡出+下移）
      const instant = this.el.overlay.classList.contains('room-view');
      const finish = () => {
        this._hideTimer = null;
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
        this.el.overlay.hidden = true;
      };
      if (instant) { finish(); return; }
      this.el.overlay.classList.add('closing');
      // 等淡出动画播完再真正隐藏并还原布局类，避免淡出期间跳版；
      // 期间 hidden 仍为 false，输入拦截逻辑不受影响
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
      const cancelBtn = [...this.el.ovBody.querySelectorAll('button')]
        .find(b => !b.disabled && b.offsetParent && (
          /跳过|留下|返回|取消|关闭|离开/.test(b.textContent || '') ||
          /^(closeBag|closeCardPage|closeDesigner|pg-close)$/.test(b.dataset.act || '') ||
          /关闭|返回/.test(b.getAttribute('aria-label') || '') || /关闭|返回/.test(b.getAttribute('title') || '')));
      if (cancelBtn) { cancelBtn.click(); return true; }
      // 场景演出页（点击任意处继续）：走 sceneNext 通道
      if (this.el.ovBody.querySelector('[data-act="sceneNext"]')) { this.act('sceneNext'); return true; }
      // 背包这类只有信息没有按钮的浮层：直接关
      if (mode === 'bag' || mode === 'bagpage') { this.hideOverlay(); return true; }
      return false;
    },
  };

  SDT.UI = UI;

export { SDT, UI };
