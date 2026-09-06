import { characterName } from './characters.js';
import { Random } from './random.js';
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
        heroAva: $('heroAva'), heroName: $('heroName'),
        bagCount: $('bagCount'), bagBtn: $('bagBtn'), btnHome: $('btnHome'),
        rollBtn: $('rollBtn'), diceFace: $('diceFace'), diceHist: $('diceHist'),
        log: $('log'),
        overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'),
        tooltip: $('tooltip'),
        tglIndex: $('tglIndex'),
        btnExport: $('btnExport'), btnImport: $('btnImport'), btnClear: $('btnClear'),
        devTools: $('devTools'), devDice: $('devDice'),
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
      this.buildDiceCube();
    },

    act(name, fn) { this._acts[name] = fn; },

    // ---------- ? 帮助弹层：页面说明文字统一收进二级界面 ----------
    // 页面渲染时 registerHelp(id, {title, html, back})，并在页头放 helpBtn(id)；
    // 点 ? 打开帮助，点「返回」执行 back() 重绘原页面。
    registerHelp(id, def) { this.helpTopics[id] = def; },
    helpBtn(id) {
      return `<button class="help-btn" data-act="openHelp" data-page="${id}" title="查看说明">？</button>`;
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
    drawDice(v) {
      const face = this.el.diceFace, cube = face.querySelector('.dice-cube');
      if (!cube || v === this._drawn) return; // 同值跳过，避免刷新时重置翻转动画
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
    refreshTime(game) {
      // 每帧调用：状态未翻转时不触碰 DOM
      const idle = game.state === 'idle';
      if (this._lastIdle === idle) return;
      this._lastIdle = idle;
      this.el.rollBtn.disabled = !idle;
    },

    refresh(game) {
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
        this.el.heroAva.innerHTML = (cls && SDT.Art) ? SDT.Art.classArt(cls) : '旅';
        this.el.heroName.textContent = characterName(game.characterId || cls);
      }
      // 物资 + 卡牌混占背包格；安全格 / 消耗口袋见背包弹窗，容量由基地决定
      const used = game.usedSlots ? game.usedSlots() : game.inventory.length;
      const cap = game.bagCap ? game.bagCap() : game.map.rules.bagSize;
      const bagKey = `${used}/${cap}`;
      if (this._lastBagKey !== bagKey) {
        this._lastBagKey = bagKey;
        this.el.bagCount.textContent = bagKey;
      }

      // 掷骰按钮：状态未变化时不重建 innerHTML（refresh 调用频繁）
      if (this._lastRollState !== game.state) {
        this._lastRollState = game.state;
        this.el.rollBtn.disabled = game.state !== 'idle';
        this.el.rollBtn.innerHTML = game.state === 'idle' ? SDT.Icons.rich('[[icon:dice]] 掷骰子移动')
          : game.state === 'moving' ? SDT.Icons.rich('[[icon:hourglass]] 移动中…')
          : game.state === 'rolling' ? SDT.Icons.rich('[[icon:dice]] 骰子转动中…') : SDT.Icons.rich('[[icon:hourglass]] …');
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
      this.el.ovBody.innerHTML = SDT.Icons.rich(bodyHtml);
      const card = this.el.ovBody.parentElement;
      card.classList.toggle('wide', mode === true || mode === 'wide' || mode === 'chest');
      card.classList.toggle('battle', mode === 'battle');
      card.classList.toggle('bag-modal', mode === 'bag');
      card.classList.toggle('bag-page', mode === 'bagpage');
      card.classList.toggle('page', mode === 'page');
      card.classList.toggle('scene', mode === 'scene');
      // 宝箱浮层悬在原画面上：即使处于房间结算流也不吃全屏 room 样式
      card.classList.toggle('room', this._roomActive && mode !== 'page' && mode !== 'bag' && mode !== 'bagpage' && mode !== 'chest');
      // 战斗弹窗也按房间页处理：主循环据此冻结棋盘渲染/暂停壁纸解码，
      // 并关掉 #overlay 的大面积 backdrop blur（非房间路径开战时的卡顿源）
      // 宝箱浮层例外：不吃 room-view，保留暗纱+blur 衬托悬浮面板
      this.el.overlay.classList.toggle('room-view', mode === 'battle' || (this._roomActive && mode !== 'chest'));
      this.el.overlay.classList.toggle('bag-full', mode === 'bagpage');
      this.el.overlay.classList.toggle('opaque', mode === 'page' || mode === 'bagpage');
      // 已打开状态下且弹窗模式变化（场景→战斗→结算等）时重播滑入动画；
      // 战斗内反复 render（同模式）不重播，避免每出一张卡就闪一次
      if (wasOpen && this._lastMode !== mode) {
        card.classList.remove('swap');
        void card.offsetWidth;
        card.classList.add('swap');
      }
      const prevMode = this._lastMode;
      this._lastMode = mode;
      this.el.overlay.hidden = false;
      if ((!wasOpen || prevMode !== mode) && SDT.Motion) SDT.Motion.overlayIn(card);
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
  };

  SDT.UI = UI;

export { SDT, UI };
