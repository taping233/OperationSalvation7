  const RARITIES = SDT.Cards.RARITIES;
  const TYPES = SDT.Cards.TYPES;
  const TYPE_ICON = SDT.Cards.TYPE_ICON;
  const DMG_TYPES = SDT.Cards.DMG_TYPES;
  let editingCard = null;        // 制作坊正在编辑的原卡（null = 新建）
  let designerReturnLib = false; // 关闭制作坊时是否回到卡牌库
  let cardPageOpen = false;      // 卡牌大页面打开中（Esc / 点击背景可关闭）
  let cardPagePrevState = null;  // 打开库/制作坊前的游戏状态（从标题界面打开时关回 'title'）
  let lastSavedId = null;        // 刚保存的卡，库中高亮
  let libCards = [];             // 库页面缓存（悬停预览用）
  let libFilter = { tab: '全部', rar: '全部', q: '' };
  let draft = null;              // 制作坊草稿


  // 音效统一走 SDT.Sound（sound.js：程序化音效 + 生成式背景乐）；保留别名兼容旧调用
  const Sfx = {
    tick() { SDT.Sound.sfx('hover'); },
    ding() { SDT.Sound.sfx('ding'); },
  };

  // 卡面渲染（已迁至 SDT.Cards.cardHTML，卡牌库/商店/背包/战斗共用）
  const cardHTML = (c, cls) => SDT.Cards.cardHTML(c, cls);

  // ======== 卡牌收藏页（卡牌库） ========
  function openCardLibrary() {
    if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
    if (game.state !== 'modal') cardPagePrevState = game.state;   // 记录来源（idle/title），关闭时还原
    game.state = 'modal';
    renderCardLibrary();
  }

  function libFiltered() {
    const q = libFilter.q.trim().toLowerCase();
    return libCards.filter(c =>
      (libFilter.tab === '全部' || c.type === libFilter.tab) &&
      (libFilter.rar === '全部' || c.rarity === libFilter.rar) &&
      (!q || (c.name || '').toLowerCase().includes(q) || (c.desc || '').toLowerCase().includes(q))
    ).sort((a, b) => (a.cost - b.cost) ||
      (RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)) ||
      String(a.name).localeCompare(b.name, 'zh'));
  }

  function libPreviewHTML(c) {
    if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">把鼠标悬停在右侧卡牌上<br>这里会显示大图预览</p>';
    const dmgTxt = DMG_TYPES.includes(c.type) ? `<br>伤害词条：<b class="dmg-num">${c.dmg || 0}</b>${c.dmgType ? ' · ' + (SDT.Cards.DMG_TYPE_META[c.dmgType] || {}).name : ''}` : '';
    const drawN = +(c.draw || 0) || SDT.Cards.deriveDraw(c);
    const infN = +(c.infuse || 0) || SDT.Cards.deriveInfuse(c);
    const healN = +(c.heal || 0) || SDT.Cards.deriveHeal(c);
    const armorN = +(c.armor || 0) || SDT.Cards.deriveArmor(c);
    const kw = [drawN ? `抽卡 ${drawN}` : '', infN ? `注能(${infN})` : '',
      healN ? `回复 ${healN}` : '', armorN ? `护甲 ${armorN}` : ''].filter(Boolean).join(' · ');
    const kwTxt = kw ? `<br>效果词条：<b>${kw}</b>` : '';
    return `${cardHTML(c, 'lg')}<p class="pv-hint">${esc(c.type)} · ${esc(c.rarity)}${dmgTxt}${kwTxt}<br>点击卡牌进入制作坊编辑</p>`;
  }

  function libGridHTML() {
    const cards = libFiltered();
    if (!cards.length) {
      return `<div class="clib-empty"><div class="clib-empty-icon">[[icon:archive]]</div>
        <p>${libCards.length ? '没有符合筛选条件的卡牌' : '收藏还是空的，点右上角「＋ 制作新卡」开始设计'}</p></div>`;
    }
    return cards.map(c => `
      <div class="lib-item${c.id === lastSavedId ? ' saved' : ''}">
        <div class="lib-cardwrap" data-act="editCard" data-card="${c.id}" title="点击编辑">${cardHTML(c)}</div>
        <div class="lib-actions">
          <button class="hs-btn sm" data-act="editCard" data-id="${c.id}">编辑</button>
          <button class="hs-btn sm danger" data-act="delCard" data-id="${c.id}">删除</button>
        </div>
      </div>`).join('');
  }

  function renderCardLibrary() {
    cardPageOpen = true;
    libCards = SDT.Cards.all();
    const counts = {};
    libCards.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    const tabs = ['全部'].concat(TYPES).map(t =>
      `<button class="type-tab${libFilter.tab === t ? ' on' : ''}" data-act="libTab" data-t="${t}">
        <i>${SDT.Icons.img(t === '全部' ? 'archive' : (SDT.Cards.TYPE_ART[t] || 'question'))}</i>${t}<em>${t === '全部' ? libCards.length : (counts[t] || 0)}</em>
      </button>`).join('');
    UI.showOverlay('', `
      <div class="pg">
        <button class="pg-close" data-act="closeCardPage" title="关闭（Esc）">[[icon:cross]]</button>
        <header class="pg-head">
          <h2>[[icon:book]] 卡牌收藏</h2>
          <input id="cardSearch" class="clib-search" placeholder="搜索名称 / 效果…" value="${escAttr(libFilter.q)}">
          <select id="libRar" class="pg-select" title="按稀有度筛选">
            <option value="全部">全部稀有度</option>
            ${RARITIES.map(r => `<option value="${r}"${libFilter.rar === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
          <span class="pg-spacer"></span>
          <span class="clib-count">共 <b>${libCards.length}</b> 张</span>
          <button class="hs-btn gold" data-act="newCard">＋ 制作新卡</button>
          <button class="hs-btn" data-act="exportCards">[[icon:upload]] 导出</button>
          <button class="hs-btn" data-act="importCards">[[icon:download]] 导入</button>
        </header>
        <div class="clib-tabs">${tabs}</div>
        <div class="clib-main">
          <aside class="clib-preview" id="libPreview">${libPreviewHTML(null)}</aside>
          <div class="lib-grid" id="libGrid">${libGridHTML()}</div>
        </div>
      </div>`, 'page');
    lastSavedId = null;
    UI.act('closeCardPage', closeLibPage);
    UI.act('newCard', () => openCardDesigner(null));
    UI.act('libTab', (d) => { libFilter.tab = d.t; renderCardLibrary(); });
    UI.act('editCard', (d) => {
      const card = SDT.Cards.all().find(c => c.id === (d.card || d.id));
      if (card) openCardDesigner(card);
    });
    UI.act('delCard', (d) => {
      const btn = document.querySelector(`#libGrid [data-act="delCard"][data-id="${d.id}"]`);
      if (btn && !btn.dataset.confirm) {
        btn.dataset.confirm = '1'; btn.textContent = '确认删除？'; btn.classList.add('arm');
        setTimeout(() => {
          if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = '删除'; btn.classList.remove('arm'); }
        }, 2600);
        return;
      }
      const card = libCards.find(c => c.id === d.id);
      SDT.Cards.remove(d.id);
      Sfx.tick();
      UI.log(`[[icon:trash]] 已删除卡牌【<b>${esc(card ? card.name : '')}</b>】`, 'warn');
      renderCardLibrary();
    });
    UI.act('exportCards', () => showCardsExportOverlay());
    UI.act('importCards', () => showCardsImportOverlay());
    // 搜索 / 稀有度筛选：只重绘卡格，保持输入焦点
    UI._inputHandler = (e) => {
      if (e.target.id === 'cardSearch') { libFilter.q = e.target.value; }
      else if (e.target.id === 'libRar') { libFilter.rar = e.target.value; }
      else return;
      const grid = document.getElementById('libGrid');
      if (grid) grid.innerHTML = libGridHTML();
    };
    // 悬停大图预览（炉石式）
    UI._hoverHandler = (e) => {
      const w = e.target.closest ? e.target.closest('[data-card]') : null;
      if (!w) return;
      const card = libCards.find(c => c.id === w.dataset.card);
      const pv = document.getElementById('libPreview');
      if (card && pv) { pv.innerHTML = libPreviewHTML(card); Sfx.tick(); }
    };
    UI.refresh(game);
  }

  function closeLibPage() {
    cardPageOpen = false;
    UI.hideOverlay();
    game.state = cardPagePrevState || 'idle';   // 从标题界面打开则回到标题，其余维持原 'idle' 行为
    cardPagePrevState = null;
    UI.refresh(game);
  }

  // ======== 卡牌制作坊 ========
  function openCardDesigner(card) {
    if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
    if (game.state !== 'modal') cardPagePrevState = game.state;   // 同 openCardLibrary：记录来源
    game.state = 'modal';
    // 当前顶层正是卡牌库页面 → 关闭制作坊时回到库
    designerReturnLib = cardPageOpen && !!document.getElementById('libGrid');
    cardPageOpen = true;
    editingCard = card || null;
    draft = {
      id: card ? card.id : null,
      name: card ? card.name : '',
      cost: card ? card.cost : 1,
      rarity: card ? card.rarity : '古朴',
      type: card ? card.type : '武术',
      dmg: card ? Math.max(0, +card.dmg || 0) : 0,
      // 伤害类型词条：已标注优先，其次按描述推导，新建默认攻击（法术类型切换时补默认）
      dmgType: card
        ? (SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType
          : (SDT.Cards.deriveDmgType(card) || 'fixed'))
        : 'attack',
      // 抽卡 / 注能词条：已标注优先，其次按描述回填，新建默认 0
      draw: card ? Math.max(0, +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0) : 0,
      infuse: card ? Math.max(0, +(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0) : 0,
      heal: card ? Math.max(0, +(card.heal || 0) || SDT.Cards.deriveHeal(card) || 0) : 0,
      armor: card ? Math.max(0, +(card.armor || 0) || SDT.Cards.deriveArmor(card) || 0) : 0,
      desc: card ? (card.desc || '') : '',
      value: card ? Math.max(0, +card.value || 0) : 0,
      // 出售资格：默认不可出售；编辑旧卡时按 isSellable 回显（含「可出售」备注推导）
      sellable: card ? SDT.Cards.isSellable(card) : false,
    };
    renderDesigner();
  }

  function renderDesigner() {
    const isDmgType = DMG_TYPES.includes(draft.type);
    UI.showOverlay('', `
      <div class="pg cdes">
        <button class="pg-close" data-act="closeDesigner" title="${designerReturnLib ? '返回卡牌库（Esc）' : '关闭（Esc）'}">[[icon:cross]]</button>
        <header class="pg-head">
          <h2>[[icon:cards]] 卡牌制作坊</h2>
          <span class="sub">${editingCard ? `正在编辑「${esc(editingCard.name)}」` : '设计一张属于你的卡牌，左侧实时预览'}</span>
          <span class="pg-spacer"></span>
          ${designerReturnLib ? '<button class="hs-btn" data-act="closeDesigner">← 返回卡牌库</button>' : ''}
          <button class="hs-btn gold" data-act="saveCard">[[icon:save]] ${editingCard ? '保存修改' : '保存到卡牌库'}</button>
        </header>
        <div class="cdes-main">
          <div class="cdes-stage" id="cdesStage">
            <div id="cardTilt"><div id="cardPreview"></div></div>
            <p class="stage-hint">[[icon:mouse]] 移动鼠标可以转动卡牌</p>
          </div>
          <div class="cdes-form">
            <div class="cdes-row"><label>卡牌名称</label>
              <input id="cardName" type="text" maxlength="12" value="${escAttr(draft.name)}" placeholder="起个名字（≤12 字）"></div>
            <div class="cdes-row"><label>类型 <span class="row-tip">决定卡牌边框与图腾</span></label>
              <div class="seg type-seg">${TYPES.map(t =>
                `<button data-act="pickType" data-t="${t}" class="${draft.type === t ? 'on' : ''}">${SDT.Icons.img(SDT.Cards.TYPE_ART[t] || 'question')}${t}</button>`).join('')}</div></div>
            <div class="cdes-row" id="rowDmg" ${isDmgType ? '' : 'hidden'}><label>伤害词条 <span class="row-tip">武术 / 法术专属 · 四类伤害体系（design.md §3）</span></label>
              <div class="seg dmgtype-seg">${SDT.Cards.DMG_TYPE_ORDER.map(dt => {
                const m = SDT.Cards.DMG_TYPE_META[dt];
                return `<button data-act="pickDmgType" data-dt="${dt}" class="${draft.dmgType === dt ? 'on' : ''}" title="${escAttr(m.tip)}"><i>${m.icon}</i>${m.name}</button>`;
              }).join('')}</div>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="dmgAdj" data-v="-1" title="减少">−</button>
                <input id="cardDmg" type="number" min="0" max="99" value="${draft.dmg}">
                <button class="hs-btn round" data-act="dmgAdj" data-v="1" title="增加">＋</button>
                <span class="dmg-hint">显示为卡牌左下角的<span class="dmg-num">红色伤害宝石</span></span>
              </div></div>
            <div class="cdes-row"><label>抽卡 / 注能 <span class="row-tip">抽卡 N：BOSS 战从牌库抽 N 张 · 普通战斗改为获得 N 张杀 ｜ 注能 N：打出前需先选择 N 张手牌消耗</span></label>
              <div class="dmg-ctl">
                <span class="dmg-hint" style="margin-right:4px">[[icon:cards]] 抽卡</span>
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.draw === v ? ' on' : ''}" data-act="pickDraw" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint" style="margin:0 4px 0 14px">[[icon:flask]] 注能</span>
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.infuse === v ? ' on' : ''}" data-act="pickInfuse" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint">0 = 无该词条；卡面类型行下方会显示角标</span>
              </div></div>
            <div class="cdes-row"><label>回复 / 护甲 <span class="row-tip">简单词条 · 战斗中拖到自己身上打出；禁疗会阻止回复</span></label>
              <div class="dmg-ctl">
                <span class="dmg-hint" style="margin-right:4px">[[icon:heart]] 回复</span>
                <input id="cardHeal" type="number" min="0" max="99" value="${draft.heal}">
                <span class="dmg-hint" style="margin:0 4px 0 14px">[[icon:plate]] 护甲</span>
                <input id="cardArmor" type="number" min="0" max="99" value="${draft.armor}">
                <span class="dmg-hint">0 = 无该词条；可与描述中的其他效果组合</span>
              </div></div>
            <div class="cdes-row"><label>费用</label>
              <div class="seg">${[0, 1, 2, 3, 4, 5].map(v =>
                `<button class="cost-gem${draft.cost === v ? ' on' : ''}" data-act="pickCost" data-v="${v}">${v}</button>`).join('')}</div></div>
            <div class="cdes-row"><label>稀有度 <span class="row-tip">影响卡面宝石、边框光效与商店价格</span></label>
              <div class="seg">${RARITIES.map((r, i) =>
                `<button class="rar-dot rv${i}${draft.rarity === r ? ' on' : ''}" data-act="pickRar" data-r="${r}"><i></i>${r}</button>`).join('')}</div></div>
            <div class="cdes-row" id="rowValue"><label>币值 [[icon:coin]] <span class="row-tip">卡牌右下角金色角标 · 商店收购参考价</span></label>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="valAdj" data-v="-1" title="减少">−</button>
                <input id="cardValue" type="number" min="0" max="99" value="${draft.value}">
                <button class="hs-btn round" data-act="valAdj" data-v="1" title="增加">＋</button>
                <label class="sellable-tgl" title="所有卡牌默认不可出售，勾选后才能在商店卖掉"><input type="checkbox" id="cardSellable" ${draft.sellable ? 'checked' : ''}> 可出售</label>
                <span class="dmg-hint">0 = 不显示角标；勾「可出售」才能卖给商店</span>
              </div></div>
            <div class="cdes-row"><label>效果描述 <span class="row-tip">可选</span></label>
              <textarea id="cardDesc" rows="4" maxlength="100" placeholder="描述这张卡的效果，例如：攻（+3），附加流血。">${esc(draft.desc)}</textarea></div>
            <p class="dmg-hint">[[icon:lantern]] 保存后可在商店刷出、在战斗中实装；数据保存在本浏览器。</p>
          </div>
        </div>
      </div>`, 'page');
    updateDesignerPreview();
    bindDesignerTilt();
    UI._inputHandler = (e) => {
      if (e.target.id === 'cardName') draft.name = e.target.value;
      else if (e.target.id === 'cardDesc') draft.desc = e.target.value;
      else if (e.target.id === 'cardDmg') draft.dmg = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardHeal') draft.heal = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardArmor') draft.armor = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardValue') draft.value = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardSellable') { draft.sellable = e.target.checked; return; }
      else return;
      updateDesignerPreview();
    };
    UI.act('closeDesigner', closeDesigner);
    UI.act('pickType', (d) => {
      draft.type = d.t;
      if (!DMG_TYPES.includes(d.t)) draft.dmg = 0;
      else if (!SDT.Cards.DMG_TYPE_META[draft.dmgType]) draft.dmgType = d.t === '法术' ? 'spell' : 'attack';
      Sfx.tick(); syncDesignerForm();
    });
    UI.act('pickDmgType', (d) => { draft.dmgType = d.dt; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickCost', (d) => { draft.cost = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickDraw', (d) => { draft.draw = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickInfuse', (d) => { draft.infuse = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickRar', (d) => { draft.rarity = d.r; Sfx.tick(); syncDesignerForm(); });
    UI.act('dmgAdj', (d) => { draft.dmg = Math.max(0, Math.min(99, draft.dmg + (+d.v))); syncDesignerForm(); });
    UI.act('valAdj', (d) => { draft.value = Math.max(0, Math.min(99, draft.value + (+d.v))); syncDesignerForm(); });
    UI.act('saveCard', saveDraftCard);
  }

  function syncDesignerForm() {
    document.querySelectorAll('#ovBody .type-seg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === draft.type));
    document.querySelectorAll('#ovBody [data-act="pickDmgType"]').forEach(b => b.classList.toggle('on', b.dataset.dt === draft.dmgType));
    document.querySelectorAll('#ovBody [data-act="pickCost"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.cost));
    document.querySelectorAll('#ovBody [data-act="pickDraw"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.draw));
    document.querySelectorAll('#ovBody [data-act="pickInfuse"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.infuse));
    document.querySelectorAll('#ovBody [data-act="pickRar"]').forEach(b => b.classList.toggle('on', b.dataset.r === draft.rarity));
    const row = document.getElementById('rowDmg');
    if (row) row.hidden = !DMG_TYPES.includes(draft.type);
    const dmgInput = document.getElementById('cardDmg');
    if (dmgInput) dmgInput.value = draft.dmg;
    const healInput = document.getElementById('cardHeal');
    if (healInput) healInput.value = draft.heal;
    const armorInput = document.getElementById('cardArmor');
    if (armorInput) armorInput.value = draft.armor;
    const valRow = document.getElementById('rowValue');
    if (valRow) valRow.hidden = false;
    const valInput = document.getElementById('cardValue');
    if (valInput) valInput.value = draft.value;
    updateDesignerPreview();
  }

  function updateDesignerPreview() {
    const el = document.getElementById('cardPreview');
    if (!el) return;
    el.innerHTML = cardHTML({ ...draft, name: draft.name.trim(), _preview: true }, 'xl');
  }

  function bindDesignerTilt() {
    const stage = document.getElementById('cdesStage');
    const tilt = document.getElementById('cardTilt');
    if (!stage || !tilt) return;
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${(px * 24).toFixed(1)}deg) rotateX(${(-py * 18).toFixed(1)}deg)`;
    });
    stage.addEventListener('mouseleave', () => { tilt.style.transform = 'rotateY(0deg) rotateX(0deg)'; });
  }

  function saveDraftCard() {
    if (!draft.name.trim()) { UI.log('卡牌名称不能为空', 'warn'); return; }
    const wasEditing = !!editingCard;
    const card = SDT.Cards.upsert({
      id: draft.id || undefined,
      name: draft.name.trim(),
      cost: draft.cost,
      rarity: draft.rarity,
      type: draft.type,
      dmg: DMG_TYPES.includes(draft.type) ? draft.dmg : 0,
      dmgType: DMG_TYPES.includes(draft.type) && draft.dmg > 0 ? draft.dmgType : undefined,
      draw: draft.draw > 0 ? draft.draw : undefined,      // 抽卡词条（0 = 不带词条）
      infuse: draft.infuse > 0 ? draft.infuse : undefined, // 注能词条（0 = 不带词条）
      heal: draft.heal > 0 ? draft.heal : undefined,       // 回复词条（0 = 不带词条）
      armor: draft.armor > 0 ? draft.armor : undefined,    // 护甲词条（0 = 不带词条）
      desc: draft.desc.trim(),
      value: draft.value,
      sellable: draft.sellable === true,  // 显式记录出售资格（缺省 false = 默认不可出售）
    });
    lastSavedId = card.id;
    Sfx.ding();
    UI.log(`[[icon:cards]] 卡牌【<b>${esc(card.name)}</b>】已${wasEditing ? '更新' : '保存到卡牌库'}`, 'ok');
    if (designerReturnLib) renderCardLibrary();
    else closeLibPage();
  }

  function closeDesigner() {
    if (designerReturnLib) renderCardLibrary();
    else closeLibPage();
  }

  // Esc / 点击页面外深色背景 → 关闭大页面（制作坊先回库 / 基地 / 出征整备回基地）
  function closeCardPageTop() {
    if (document.getElementById('cdesStage')) closeDesigner();
    else if (document.getElementById('depMain')) { deployPick = null; renderHub(); }
    else if (document.getElementById('hubMain')) closeBase();
    else closeLibPage();
  }

  function showCardsExportOverlay() {
    cardPageOpen = false;
    const json = JSON.stringify({ game: 'sdt', format: 'cards', version: 2, cards: SDT.Cards.all() }, null, 2);
    UI.showOverlay('[[icon:upload]] 导出卡牌', `
      <p class="ov-note">把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。</p>
      <textarea id="ovExport" class="ov-textarea" readonly>${esc(json)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="copyCards">复制到剪贴板</button>
        <button class="ov-btn" data-act="downloadCards">下载文件</button>
        <button class="ov-btn" data-act="backLib">← 返回卡牌库</button>
      </div>`);
    UI.act('copyCards', async () => {
      try { await navigator.clipboard.writeText(json); UI.log('卡牌 JSON 已复制', 'ok'); }
      catch (e) { UI.log('复制失败，请手动全选复制', 'warn'); }
    });
    UI.act('downloadCards', () => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sdt-cards.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    UI.act('backLib', () => openCardLibrary());
  }

  function showCardsImportOverlay() {
    cardPageOpen = false;
    UI.showOverlay('[[icon:download]] 导入卡牌', `
      <p class="ov-note">粘贴卡牌 JSON（按 id 合并覆盖）。</p>
      <textarea id="ovImport" class="ov-textarea" placeholder='{"game":"sdt","cards":[…]}'></textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doImportCards">导入</button>
        <button class="ov-btn" data-act="backLib2">取消</button>
      </div>`);
    UI.act('doImportCards', () => {
      const ta = document.getElementById('ovImport');
      try {
        const parsed = JSON.parse(ta.value);
        const cards = Array.isArray(parsed) ? parsed : parsed.cards;
        if (!Array.isArray(cards)) throw new Error('缺少 cards 数组');
        for (const c of cards) {
          if (!c.name) continue;
          SDT.Cards.upsert({
            id: c.id, name: String(c.name).slice(0, 12),
            cost: [0, 1, 2, 3, 4, 5].includes(+c.cost) ? +c.cost : 1,
            rarity: RARITIES.includes(c.rarity) ? c.rarity : '古朴',
            type: TYPES.includes(c.type) ? c.type : '武术',
            dmg: Math.max(0, Math.min(99, +c.dmg || 0)),
            dmgType: SDT.Cards.DMG_TYPE_META[c.dmgType] ? c.dmgType : undefined,
            draw: Math.max(0, Math.min(99, +c.draw || 0)) || undefined,
            infuse: Math.max(0, Math.min(99, +c.infuse || 0)) || undefined,
            heal: Math.max(0, Math.min(99, +c.heal || 0)) || undefined,
            armor: Math.max(0, Math.min(99, +c.armor || 0)) || undefined,
            desc: String(c.desc || '').slice(0, 100),
            value: Math.max(0, Math.min(99, +c.value || 0)),
            sellable: typeof c.sellable === 'boolean' ? c.sellable : undefined,
          });
        }
        UI.log('卡牌导入完成', 'ok');
        openCardLibrary();
      } catch (err) { UI.log('导入失败：' + err.message, 'warn'); }
    });
    UI.act('backLib2', () => openCardLibrary());
  }

  // ---------- 输入 ----------
