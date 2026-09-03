/* ============================================================
 * 搜打撤 v0.3 —— 侧边栏 UI 与弹窗
 * （骰子 / 环层与币统计 / 已发现门快捷前往 / 背包 / 日志 / 覆盖层）
 * ============================================================ */
(function () {
  const SDT = window.SDT;
  const $ = (id) => document.getElementById(id);

  const UI = {
    el: {},
    _acts: {},   // 弹窗按钮动作表：data-act → 回调
    _roomActive: false, // 地图格子的整段结算都保持为全屏房间页

    init() {
      this.el = {
        statLayer: $('statLayer'),
        statTurn: $('statTurn'), statValue: $('statValue'),
        hpBar: $('hpBar'), hpBarWrap: $('hpBarWrap'), hpText: $('hpText'), charCoins: $('charCoins'),
        charAtk: $('charAtk'),
        heroAva: $('heroAva'), heroCls: $('heroCls'),
        bagCount: $('bagCount'), bagBtn: $('bagBtn'), btnHome: $('btnHome'),
        rollBtn: $('rollBtn'), diceFace: $('diceFace'), diceHist: $('diceHist'),
        stairsPanel: $('stairsPanel'), stairsList: $('stairsList'),
        log: $('log'),
        overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'),
        tooltip: $('tooltip'),
        tglIndex: $('tglIndex'),
        btnExport: $('btnExport'), btnImport: $('btnImport'), btnClear: $('btnClear'),
        tglDev: $('tglDev'), devTools: $('devTools'), devDice: $('devDice'),
        btnCardDesigner: $('btnCardDesigner'), btnCardLib: $('btnCardLib'),
        btnCombatTest: $('btnCombatTest'), btnDevRes: $('btnDevRes'),
        viewport: $('viewport'),
      };
      this.el.ovBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn && this._acts[btn.dataset.act]) this._acts[btn.dataset.act](btn.dataset);
      });
      // 设计器等表单的实时输入回调
      this.el.ovBody.addEventListener('input', (e) => {
        if (this._inputHandler) this._inputHandler(e);
      });
      // 卡牌库等页面的悬停回调（大图预览）
      this.el.ovBody.addEventListener('mouseover', (e) => {
        if (this._hoverHandler) this._hoverHandler(e);
      });
    },

    act(name, fn) { this._acts[name] = fn; },

    // 数值变化时弹跳一下（retrigger 动画）
    popNum(el) {
      if (!el) return;
      el.classList.remove('popnum');
      void el.offsetWidth;
      el.classList.add('popnum');
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
      this.el.statLayer.textContent = layer ? layer.name : '—';
      this.el.statTurn.textContent = game.turn - 1;
      const valTotal = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
      this.el.statValue.textContent = '¥' + valTotal.toLocaleString();
      if (this._lastValue != null && this._lastValue !== valTotal) this.popNum(this.el.statValue);
      this._lastValue = valTotal;

      // 人物：血条 + 经济 + 背包格数
      const pct = Math.max(0, game.hp / game.maxHp);
      this.el.hpBar.style.width = (pct * 100).toFixed(1) + '%';
      this.el.hpBar.style.background = pct > 0.5 ? 'linear-gradient(90deg,#4e8a52,#6fae6e)'
        : pct > 0.25 ? 'linear-gradient(90deg,#b08238,#d4a44e)' : 'linear-gradient(90deg,#b8453a,#d97a52)';
      this.el.hpBarWrap.classList.toggle('low', pct <= 0.25 && game.hp > 0);
      this.el.hpText.textContent = `${game.hp}/${game.maxHp}`;
      this.el.charCoins.textContent = game.coins;
      if (this._lastCoins != null && this._lastCoins !== game.coins) this.popNum(this.el.charCoins);
      this._lastCoins = game.coins;
      this.el.charAtk.textContent = game.atk;
      if (this._lastAtk != null && this._lastAtk !== game.atk) this.popNum(this.el.charAtk);
      this._lastAtk = game.atk;
      // 头像与职业（选职业后同步；头像使用职业立绘）
      const cls = game.myClass || '';
      if (this._lastHeroCls !== cls) {
        this._lastHeroCls = cls;
        this.el.heroCls.textContent = cls;
        this.el.heroAva.innerHTML = (cls && SDT.Art) ? SDT.Art.classArt(cls) : '旅';
      }
      // 物资 + 卡牌混占背包格；安全格 / 消耗口袋见背包弹窗，容量由基地决定
      const used = game.usedSlots ? game.usedSlots() : game.inventory.length;
      const cap = game.bagCap ? game.bagCap() : game.map.rules.bagSize;
      this.el.bagCount.textContent = `${used}/${cap}`;

      this.el.rollBtn.disabled = game.state !== 'idle';
      this.el.rollBtn.innerHTML = game.state === 'idle' ? SDT.Icons.rich('[[icon:dice]] 掷骰子移动')
        : game.state === 'moving' ? SDT.Icons.rich('[[icon:hourglass]] 移动中…')
        : game.state === 'rolling' ? SDT.Icons.rich('[[icon:dice]] 骰子转动中…') : SDT.Icons.rich('[[icon:hourglass]] …');

      this.el.diceFace.textContent = game.dice == null ? '·' : game.dice;
      if (this._lastDice !== undefined && game.dice != null && this._lastDice !== game.dice) {
        this.popNum(this.el.diceFace);
      }
      this._lastDice = game.dice;
      this.el.diceHist.innerHTML = game.diceHistory.slice(-8)
        .map(d => `<span class="chip">${d}</span>`).join('');

      // 已发现的门 / 祭坛入口（只显示当前环层的）
      const doors = ((layer && layer.doors) || []).filter(d => game.discoveredPairs.has(d.pair));
      const altars = ((layer && layer.altarEntrances) || []).filter(a => game.discoveredPairs.has(a.pair));
      if (doors.length || altars.length) {
        this.el.stairsPanel.hidden = false;
        let html = '';
        for (const d of doors) {
          const target = game.map.layers[d.toLayer];
          html += `<div class="stairs-row"><span>${d.reverse ? '↩' : '↪'} ${target.name}</span>` +
            `<button data-godoor="${d.pair}">前往</button></div>`;
        }
        for (const a of altars) {
          html += `<div class="stairs-row"><span>[[icon:crystal]] 祭坛</span>` +
            `<button data-goaltar="${a.pair}">进入</button></div>`;
        }
        this.el.stairsList.innerHTML = SDT.Icons.rich(html);
      } else {
        this.el.stairsPanel.hidden = true;
        this.el.stairsList.innerHTML = '';
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
      el.innerHTML = `<b>${SDT.Icons.rich(title)}</b>` + lines.map(l => `<span>${SDT.Icons.rich(l)}</span>`).join('');
      el.hidden = false;
      const vw = this.el.viewport.clientWidth, vh = this.el.viewport.clientHeight;
      const r = el.getBoundingClientRect();
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
      this.el.ovTitle.classList.toggle('bad', /失败|清空|删除|倒下/.test(title));
      this.el.ovTitle.innerHTML = SDT.Icons.rich(title);
      this.el.ovBody.innerHTML = SDT.Icons.rich(bodyHtml);
      const card = this.el.ovBody.parentElement;
      card.classList.toggle('wide', mode === true || mode === 'wide');
      card.classList.toggle('bag-modal', mode === 'bag');
      card.classList.toggle('page', mode === 'page');
      card.classList.toggle('scene', mode === 'scene');
      card.classList.toggle('room', this._roomActive && mode !== 'page' && mode !== 'bag');
      this.el.overlay.classList.toggle('room-view', this._roomActive);
      this.el.overlay.classList.toggle('opaque', mode === 'page');
      this.el.overlay.hidden = false;
      SDT.Sound.sfx('open');
    },

    hideOverlay() {
      this.el.overlay.hidden = true;
      const card = this.el.ovBody.parentElement;
      card.classList.remove('wide');
      card.classList.remove('bag-modal');
      card.classList.remove('page');
      card.classList.remove('scene');
      card.classList.remove('room');
      this.el.overlay.classList.remove('opaque');
      this._acts = {};
      this._inputHandler = null;
      this._hoverHandler = null;
      SDT.Sound.sfx('close');
    },
  };

  SDT.UI = UI;
})();
