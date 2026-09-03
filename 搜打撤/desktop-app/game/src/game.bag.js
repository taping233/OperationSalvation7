
  function cardHealAmount(card) {
    const m = /回复\s*(\d+)\s*点生命/.exec(card.desc || '');
    return m ? +m[1] : 0;
  }

  function pocketAdd(card) {
    const s = game.usedPocket.find(p => p.card.name === card.name);
    if (s) s.count++;
    else game.usedPocket.push({ card: { ...card }, count: 1 });
  }

  function useOwnedCard(uid) {
    const i = game.ownedCards.findIndex(o => o.uid === uid);
    if (i < 0) return;
    const card = game.ownedCards[i].card;
    if (card.type === '事件') { UI.log('[[icon:dice]] 事件卡只能在事件格中触发，无法在背包中使用（背包只记录触发历史）', 'warn'); return; }
    if (card.type !== '道具') { UI.log('只有道具卡可以直接使用', 'warn'); return; }
    const desc = card.desc || '';
    // 能源水晶：就地复原消耗口袋中最多 3 张卡牌
    if (card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc)) {
      if (!game.usedPocket.length) { UI.log('消耗口袋是空的，无需复原', 'warn'); return; }
      game.ownedCards.splice(i, 1);
      let cnt = 0;
      game.usedPocket.splice(0, 3).forEach(p => {
        for (let k = 0; k < p.count; k++) game.ownedCards.push({ uid: newUid(), card: { ...p.card } });
        cnt += p.count;
      });
      UI.log(`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗口袋中的 <b>${cnt}</b> 张卡牌`, 'ok');
      showBackpack(true);
      return;
    }
    // 资源卡：口粮 / 木材（直接转化为背包物资，可用于基地升级）
    const rm = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
    const wm = desc.match(/木材\s*[×x]\s*(\d+)/);
    if (rm) {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(MAP.items.rations, +rm[1]);
      showBackpack(true);
      return;
    }
    if (wm) {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(MAP.items.wood, +wm[1]);
      showBackpack(true);
      return;
    }
    const heal = cardHealAmount(card);
    if (heal <= 0) { UI.log(`道具卡【${card.name}】的效果将在 M1 战斗中实装`, 'warn'); return; }
    if (game.hp >= game.maxHp) { UI.log('生命值已满，暂时不需要使用', 'warn'); return; }
    game.ownedCards.splice(i, 1);
    UI.log(`使用道具卡【<b>${esc(card.name)}</b>】`, 'sys');
    game.heal(heal);
    showBackpack(true); // 刷新背包
  }

  // 整堆移动：背包格 ⇄ 安全格（同名卡一起移动）
  function moveStackSafe(name, toSafe) {
    // 初始牌「杀」不能带出背包：不入安全格（也就不会经宠物运回仓库）
    if (toSafe && name === SDT.Cards.SHA.name) {
      UI.log('[[icon:cross]] 初始牌「杀」无法移出背包——每局固定携带，不入安全格 / 仓库', 'warn');
      return;
    }
    const list = game.ownedCards.filter(o => !!o.safe !== !!toSafe && o.card.name === name);
    if (!list.length) return;
    if (toSafe) {
      const merges = game.ownedCards.some(o => o.safe && o.card.name === name);
      if (!merges && safeUsed() >= safeCap()) {
        UI.log(`[[icon:lock]] 安全格已满（${safeUsed()}/${safeCap()} 格），可在基地用口粮升级`, 'warn');
        return;
      }
    } else {
      const merges = game.ownedCards.some(o => !o.safe && o.card.name === name);
      if (!merges && usedSlots() >= bagCap()) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），取不出来`, 'warn');
        return;
      }
    }
    list.forEach(o => { o.safe = toSafe; });
    UI.log(toSafe
      ? `[[icon:lock]] 【${esc(name)}】×${list.length} 已存入安全格（撤离失败时安全运回）`
      : `[[icon:upload]] 【${esc(name)}】×${list.length} 已从安全格取出`, 'sys');
    showBackpack(true);
  }

  // ---------- 背包显示顺序（v0.21：卡牌堆可拖拽排序，随存档保存） ----------
  // cardOrder = 卡名列表；新出现的堆追加到末尾，已消失的堆自动移除
  function syncCardOrder() {
    const known = [];
    cardStacks(false).forEach(s => known.push(s.card.name));
    cardStacks(true).forEach(s => known.push(s.card.name));
    const ord = (game.cardOrder || []).filter(n => known.includes(n));
    known.forEach(n => { if (!ord.includes(n)) ord.push(n); });
    game.cardOrder = ord;
  }

  function sortStacksByOrder(stacks) {
    const ord = game.cardOrder || [];
    const idx = (n) => ord.indexOf(n);
    return stacks.slice().sort((a, b) => idx(a.card.name) - idx(b.card.name));
  }

  // 把 srcName 的堆移到 beforeName 之前（beforeName 缺省 = 移到末尾）
  function moveStackOrder(srcName, beforeName) {
    syncCardOrder();
    const ord = game.cardOrder.filter(n => n !== srcName);
    const di = beforeName ? ord.indexOf(beforeName) : -1;
    ord.splice(di < 0 ? ord.length : di, 0, srcName);
    game.cardOrder = ord;
  }

  function closeBackpack() {
    backpackOpen = false;
    UI.hideOverlay();
    game.state = 'idle';
    UI.refresh(game);
  }

  function discardOwnedCard(name, fromSafe) {
    if (name === SDT.Cards.SHA.id || name === SDT.Cards.SHA.name) {
      UI.log('[[icon:pen]] 初始牌「杀」不可丢弃', 'warn');
      return false;
    }
    const i = game.ownedCards.findIndex(o => !!o.safe === !!fromSafe && o.card.name === name);
    if (i < 0) return false;
    const card = game.ownedCards[i].card;
    game.ownedCards.splice(i, 1);
    UI.log(`[[icon:trash]] 已丢弃【<b>${esc(card.name)}</b>】×1（无法取回）`, 'warn');
    saveGame();
    return true;
  }

  function showDiscardConfirm(name, fromSafe) {
    backpackOpen = false;
    game.state = 'modal';
    UI.showOverlay('[[icon:question]] 丢弃卡牌？', `
      <p class="ov-note">你把【<b>${esc(name)}</b>】拖到了背包外。确认后将永久丢弃 1 张，无法从消耗口袋或墓地取回。</p>
      <div class="ov-btns">
        <button class="ov-btn danger" data-act="confirmDragDiscard">确认丢弃</button>
        <button class="ov-btn" data-act="cancelDragDiscard">取消，放回背包</button>
      </div>`);
    UI.act('confirmDragDiscard', () => { discardOwnedCard(name, fromSafe); showBackpack(true); });
    UI.act('cancelDragDiscard', () => showBackpack(true));
  }

  function showBagCardDetail(name, fromSafe) {
    const o = game.ownedCards.find(x => !!x.safe === !!fromSafe && x.card.name === name);
    if (!o) { showBackpack(true); return; }
    const usable = !fromSafe && o.card.type === '道具';
    backpackOpen = false;
    game.state = 'modal';
    UI.showOverlay('[[icon:cards]] 卡牌详情', `
      <div class="bag-card-detail">
        ${SDT.Cards.cardHTML(o.card, 'lg')}
        <p class="ov-note">${esc(o.card.name)} · ${esc(o.card.type)} · ${esc(o.card.rarity || '')}${fromSafe ? ' · 位于安全格' : ''}</p>
      </div>
      <div class="ov-btns">
        ${usable ? '<button class="ov-btn ok" data-act="useDetailCard">使用这张道具</button>' : ''}
        ${fromSafe ? '<button class="ov-btn" data-act="detailFromSafe">移回背包</button>' :
          (o.card.id === SDT.Cards.SHA.id ? '' : '<button class="ov-btn" data-act="detailToSafe">移入安全格</button>')}
        ${o.card.id === SDT.Cards.SHA.id ? '' : '<button class="ov-btn danger" data-act="detailDiscard">丢弃 1 张</button>'}
        <button class="ov-btn" data-act="detailBack">返回背包</button>
      </div>`, true);
    UI.act('useDetailCard', () => useOwnedCard(o.uid));
    UI.act('detailFromSafe', () => moveStackSafe(name, false));
    UI.act('detailToSafe', () => moveStackSafe(name, true));
    UI.act('detailDiscard', () => showDiscardConfirm(name, fromSafe));
    UI.act('detailBack', () => showBackpack(true));
  }

  function showBackpack(refreshOnly) {
    if (!game.runActive) return;   // v0.21：只有对局中才有背包（基地/标题界面不响应 B）
    if (game.battleActive || game.bossCleanupPending) {
      UI.log(game.battleActive
        ? '[[icon:lock]] 战斗中无法打开背包；请使用手牌完成战斗或撤退'
        : '[[icon:bag]] 请先完成 BOSS 战后的「整理背包」', 'warn');
      return;
    }
    if (!refreshOnly && backpackOpen && game.state === 'modal' && !UI.el.overlay.hidden) {
      closeBackpack();
      return;
    }
    if (game.state !== 'idle' && game.state !== 'modal') return;
    // 拖拽进行中重开背包：清理浮影等残留状态
    if (bagDrag) {
      if (bagDrag.ghost) bagDrag.ghost.remove();
      if (bagDrag.cell) bagDrag.cell.classList.remove('dragging');
      bagDrag = null;
    }
    game.state = 'modal';
    backpackOpen = true;
    cardPageOpen = false;
    syncCardOrder();
    const cap = bagCap(), sCap = safeCap();
    const total = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    const supplies = game.inventory;
    const stacks = sortStacksByOrder(cardStacks(false));
    let cells = '';
    for (let i = 0; i < cap; i++) {
      if (i < supplies.length) {
        const it = supplies[i];
        cells += `<div class="bag-slot filled tier-bd-${it.tier}" title="${it.name}">
             <b>${it.name}${it.count > 1 ? ` ×${it.count}` : ''}</b>
             <span>¥${it.value * it.count}</span>
             <i class="tier tier-${it.tier}">${it.tier}</i>
           </div>`;
      } else if (i - supplies.length < stacks.length) {
        const st = stacks[i - supplies.length];
        const isSha = st.card.id === SDT.Cards.SHA.id;
        cells += `<div class="bag-slot filled card-slot flip3d" data-stack="${escAttr(st.card.name)}"
              title="${escAttr(st.card.name)} ×${st.count} · 点击查看详情 · 按住拖动整理">
             <div class="flip-inner">
               <div class="flip-face flip-front" data-act="inspectStack" data-name="${escAttr(st.card.name)}" data-safe="0">
                 ${SDT.Cards.cardHTML(st.card)}
                 <span class="stack-count">×${st.count}${isSha ? ' · [[icon:pen]]' : ''}</span>
               </div>
               <div class="flip-face flip-back">${SDT.Cards.cardBackHTML()}</div>
             </div>
           </div>`;
      } else cells += '<div class="bag-slot empty"></div>';
    }
    // 安全格：宠物看守，撤离失败时里面的卡牌安全运回基地
    const safeStacks = sortStacksByOrder(cardStacks(true));
    let safeCells = '';
    for (let i = 0; i < sCap; i++) {
      if (i < safeStacks.length) {
        const st = safeStacks[i];
        safeCells += `<div class="bag-slot filled safe-slot flip3d" data-stack="${escAttr(st.card.name)}"
          title="${escAttr(st.card.name)} ×${st.count} · 点击查看详情 · 拖回背包可取出">
          <div class="flip-inner">
            <div class="flip-face flip-front" data-act="inspectStack" data-name="${escAttr(st.card.name)}" data-safe="1">
              ${SDT.Cards.cardHTML(st.card)}
              <span class="stack-count">×${st.count} · [[icon:lock]]</span>
            </div>
            <div class="flip-face flip-back">${SDT.Cards.cardBackHTML()}</div>
          </div>
        </div>`;
      } else safeCells += '<div class="bag-slot empty safe-empty"></div>';
    }
    // 消耗口袋：容量无限，未复原不能再用
    const pkN = game.usedPocket.reduce((a, b) => a + b.count, 0);
    const pocketHTML = game.usedPocket.length
      ? game.usedPocket.map(p => `
          <div class="pk-row"><span>[[icon:cards]] <b>${esc(p.card.name)}</b>${p.count > 1 ? ` ×${p.count}` : ''}</span>
          <span class="dim">${p.card.cost}费 · 无法使用</span></div>`).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（空——对小怪使用过的卡牌会进入这里）</p>';
    // 事件记录：本局触发过的事件卡（事件卡只能经棋盘事件格触发）
    const evLog = game.eventLog || [];
    const eventHTML = evLog.length
      ? evLog.map(e => `
          <div class="pk-row"><span>[[icon:dice]] <b>${esc(e.name)}</b></span>
          <span class="dim">${esc(e.desc || '')}${e.turn ? ` · 第 ${e.turn} 轮` : ''}</span></div>`).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（还没有触发过事件——事件卡只能在棋盘的事件格触发）</p>';
    UI.showOverlay('[[icon:bag]] 背包', `<div class="bag-view">
      <p class="ov-stats">物资+卡牌 <b>${usedSlots()}/${cap}</b> 格（¥${total.toLocaleString()}） · [[icon:lock]] 安全格 <b>${safeStacks.length}/${sCap}</b> · [[icon:pocket]] 消耗口袋 <b>${pkN}</b> 张
        <span class="dim">· 双击卡牌翻面看卡背 · 按住卡牌拖动可整理顺序 / 拖入安全格</span></p>
      <div class="bag-grid">${cells}</div>
      <h3 class="set-h">[[icon:lock]] 安全格 <span class="set-tip">宠物看守 · 撤离失败时里面的卡牌安全运回基地 · 容量在基地用口粮升级</span></h3>
      <div class="bag-grid safe-grid">${safeCells}</div>
      <h3 class="set-h">[[icon:pocket]] 消耗口袋 <span class="set-tip">对小怪用过的卡 / 注能消耗的卡 · 容量无限 · 复原后才能继续使用（基地免费复原 / 火堆复原 2 张 / 能源水晶就地复原 3 张）· 丢弃的牌无法取回</span></h3>
      <div class="pk-list">${pocketHTML}</div>
      <h3 class="set-h">[[icon:dice]] 事件记录 <span class="set-tip">本局触发过的事件卡 · 共 ${evLog.length} 次</span></h3>
      <div class="pk-list">${eventHTML}</div>
      <p class="bag-drop-note">点击卡牌查看完整说明；按住拖动整理，拖到背包面板外的空地可申请丢弃。</p>
      <div class="ov-btns"><button class="ov-btn ok" data-act="closeBag">合上背包</button></div></div>`, 'bag');
    UI.act('inspectStack', (d) => showBagCardDetail(d.name, d.safe === '1'));
    UI.act('closeBag', closeBackpack);
    bindBagDrag();   // v0.21：3D 拖拽排序 / 双击翻卡背
  }

  // ---------- 背包拖拽（v0.21）：3D 立体手感 · 堆排序 · 拖入/拖出安全格 ----------
  let bagDrag = null;   // {name, fromSafe, cell, ghost, card3d, sx, sy, lx, ly, vx, vy, moved}
  let bagTiltBound = false;   // 悬停倾斜是 document 级委托，只绑一次（避免重复打开背包时叠加监听）

  function bindBagDrag() {
    const body = UI.el.ovBody;
    const bagGrid = body.querySelector('.bag-grid:not(.safe-grid)');
    const safeGrid = body.querySelector('.safe-grid');
    if (!bagGrid) return;

    // 悬停 3D 倾斜：卡牌跟随指针微微转动（立体感）
    if (!bagTiltBound) {
      bagTiltBound = true;
      document.addEventListener('mousemove', (e) => {
        if (bagDrag || UI.el.overlay.hidden) return;
        const root = UI.el.ovBody;
        root.querySelectorAll('.card-slot.tilted, .safe-slot.tilted').forEach(c => {
          c.classList.remove('tilted');
          const inner = c.querySelector('.flip-inner');
          if (inner) inner.style.transform = c.classList.contains('flipped') ? 'rotateY(180deg)' : '';
        });
        const cell = e.target.closest && e.target.closest('#ovBody .card-slot, #ovBody .safe-slot');
        if (!cell || (e.target.closest && e.target.closest('button'))) return;
        const r = cell.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        const flip = cell.classList.contains('flipped') ? 180 : 0;
        const inner = cell.querySelector('.flip-inner');
        if (inner) {
          cell.classList.add('tilted');
          inner.style.transform = `rotateY(${(flip + px * 16).toFixed(1)}deg) rotateX(${(-py * 14).toFixed(1)}deg)`;
        }
      });
    }
    // 双击翻面：正面 ⇄ 当前装备的卡背
    const onDbl = (e) => {
      const cell = e.target.closest('.card-slot, .safe-slot');
      if (!cell || e.target.closest('button')) return;
      cell.classList.toggle('flipped');
      const inner = cell.querySelector('.flip-inner');
      if (inner) inner.style.transform = cell.classList.contains('flipped') ? 'rotateY(180deg)' : '';
      SDT.Sound.sfx('click');
    };
    bagGrid.addEventListener('dblclick', onDbl);
    if (safeGrid) safeGrid.addEventListener('dblclick', onDbl);
    // 按住拖动（pointer 事件，鼠标/触屏通用）
    const onDown = (e, fromSafe) => {
      if (e.button !== 0 || bagDrag) return;
      if (e.target.closest('button')) return;   // 格内按钮优先
      const cell = e.target.closest(fromSafe ? '.safe-slot' : '.card-slot');
      if (!cell || !cell.dataset.stack) return;
      e.preventDefault();
      bagDrag = {
        name: cell.dataset.stack, fromSafe, cell,
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        vx: 0, vy: 0, moved: false, ghost: null, card3d: null,
      };
      cell.classList.add('dragging');
      window.addEventListener('pointermove', onBagDragMove);
      window.addEventListener('pointerup', onBagDragUp, { once: true });
    };
    bagGrid.addEventListener('pointerdown', (e) => onDown(e, false));
    if (safeGrid) safeGrid.addEventListener('pointerdown', (e) => onDown(e, true));
  }

  // 拖拽浮影：真正的卡面 + 跟随速度的 3D 姿态
  function makeBagGhost(name) {
    const o = game.ownedCards.find(x => x.card.name === name);
    if (!o || !bagDrag) return;
    const ghost = document.createElement('div');
    ghost.className = 'bag-ghost';
    ghost.innerHTML = `<div class="bag-ghost-3d">${SDT.Cards.cardHTML(o.card, 'sm')}</div>`;
    document.body.appendChild(ghost);
    bagDrag.ghost = ghost;
    bagDrag.card3d = ghost.querySelector('.bag-ghost-3d');
  }

  function bagDropTarget(x, y, srcCell) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const safeCell = el.closest('#ovBody .safe-grid .bag-slot');
    if (safeCell) return { kind: 'safe', el: safeCell };
    const cell = el.closest('#ovBody .bag-grid:not(.safe-grid) .bag-slot');
    if (!cell) return null;
    if (cell.classList.contains('card-slot') && cell !== srcCell) {
      return { kind: 'stack', el: cell, name: cell.dataset.stack };
    }
    return { kind: 'area', el: cell };   // 空格 / 物资格 = 放到卡牌区末尾
  }

  function onBagDragMove(e) {
    if (!bagDrag) return;
    const dx = e.clientX - bagDrag.lx, dy = e.clientY - bagDrag.ly;
    bagDrag.vx = bagDrag.vx * 0.72 + dx * 0.9;   // 平滑速度 → 3D 倾角
    bagDrag.vy = bagDrag.vy * 0.72 + dy * 0.9;
    bagDrag.lx = e.clientX; bagDrag.ly = e.clientY;
    if (!bagDrag.moved) {
      if (Math.hypot(e.clientX - bagDrag.sx, e.clientY - bagDrag.sy) < 5) return;
      bagDrag.moved = true;
      makeBagGhost(bagDrag.name);
    }
    if (bagDrag.ghost) {
      bagDrag.ghost.style.left = e.clientX + 'px';
      bagDrag.ghost.style.top = e.clientY + 'px';
      const ry = Math.max(-30, Math.min(30, bagDrag.vx * 1.5));
      const rx = Math.max(-22, Math.min(22, -bagDrag.vy * 1.4));
      bagDrag.card3d.style.transform =
        `translate(-50%, -62%) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) scale(1.07)`;
    }
    document.querySelectorAll('#ovBody .drop-here').forEach(el => el.classList.remove('drop-here'));
    const t = bagDropTarget(e.clientX, e.clientY, bagDrag.cell);
    if (t && t.el) t.el.classList.add('drop-here');
  }

  function onBagDragUp(e) {
    window.removeEventListener('pointermove', onBagDragMove);
    document.querySelectorAll('#ovBody .drop-here').forEach(el => el.classList.remove('drop-here'));
    const d = bagDrag;
    bagDrag = null;
    if (!d) return;
    d.cell.classList.remove('dragging');
    if (d.ghost) d.ghost.remove();
    if (!d.moved) return;   // 原地按住未拖动 = 无操作
    const t = bagDropTarget(e.clientX, e.clientY, d.cell);
    if (!t) { showDiscardConfirm(d.name, d.fromSafe); return; }
    if (t.kind === 'safe') {
      if (!d.fromSafe) moveStackSafe(d.name, true);   // 拖入安全格
      return;
    }
    if (d.fromSafe) {
      // 从安全格拖回背包：落点之前插入并取出
      moveStackOrder(d.name, t.kind === 'stack' ? t.name : null);
      moveStackSafe(d.name, false);
      return;
    }
    if (t.kind === 'stack') moveStackOrder(d.name, t.name);
    else moveStackOrder(d.name, null);   // 空格/物资格 = 移到卡牌区末尾
    saveGame();
    showBackpack(true);
  }

  // BOSS 胜利后统一整理本局卡牌。墓地牌仍以原 uid 留在 ownedCards 中，
  // 因而可与现有背包/宝箱新牌一起选择；未选中的实例会在确认时明确永久丢弃。
  function showBossPackCleanup(consumedUids, done) {
    const candidates = game.ownedCards.slice();
    const graveSet = new Set(consumedUids || []);
    const keep = new Set(candidates.map(o => o.uid)); // 安全默认：先全部带走，玩家主动点选丢弃
    game.bossCleanupPending = true;

    const renderCleanup = () => {
      game.state = 'bossCleanup';
      const keptN = candidates.filter(o => keep.has(o.uid)).length;
      const dropN = candidates.length - keptN;
      const graveN = candidates.filter(o => graveSet.has(o.uid)).length;
      const cardsHTML = candidates.length ? candidates.map(o => {
        const kept = keep.has(o.uid);
        const fromGrave = graveSet.has(o.uid);
        return `<div class="bt-card${kept ? ' sel' : ''}" data-act="bossPackToggle" data-uid="${escAttr(o.uid)}"
          title="${kept ? '已带走；点击改为丢弃' : '将丢弃；点击改为带走'}${fromGrave ? ' · 本场从墓地回收' : ''}">
          ${SDT.Cards.cardHTML(o.card, 'sm')}
          <span class="bt-tt">${fromGrave ? '[[icon:skull]]' : (o.safe ? '[[icon:lock]]' : '[[icon:bag]]')}</span>
        </div>`;
      }).join('') : '<p class="ov-empty">没有可整理的卡牌。</p>';
      UI.showOverlay('[[icon:bag]] 击败 BOSS · 整理背包', `
        <p class="ov-stats">点击卡牌切换「带走 / 丢弃」 · 已选带走 <b>${keptN}</b> 张 · 将丢弃 <b>${dropN}</b> 张</p>
        <p class="ov-note">[[icon:skull]] 本场墓地可回收 <b>${graveN}</b> 张，已与原背包及 BOSS 宝箱新牌一起列出。<b>未选中的牌确认后永久丢弃，无法从火堆取回。</b></p>
        <div class="bt-hand">${cardsHTML}</div>
        <div class="ov-btns">
          <button class="ov-btn" data-act="bossPackAll">全部带走</button>
          <button class="ov-btn" data-act="bossPackNone">全部丢弃</button>
          <button class="ov-btn ok" data-act="bossPackConfirm">[[icon:check]] 带走 ${keptN} 张 · 丢弃 ${dropN} 张</button>
        </div>`, true);
      UI.act('bossPackToggle', (d) => {
        if (keep.has(d.uid)) keep.delete(d.uid); else keep.add(d.uid);
        renderCleanup();
      });
      UI.act('bossPackAll', () => { candidates.forEach(o => keep.add(o.uid)); renderCleanup(); });
      UI.act('bossPackNone', () => { keep.clear(); renderCleanup(); });
      UI.act('bossPackConfirm', () => {
        const discarded = candidates.filter(o => !keep.has(o.uid));
        const discardedUids = new Set(discarded.map(o => o.uid));
        const recovered = candidates.filter(o => graveSet.has(o.uid) && keep.has(o.uid)).length;
        game.ownedCards = game.ownedCards.filter(o => !discardedUids.has(o.uid));
        game.bossCleanupPending = false;
        syncCardOrder();
        UI.log(`[[icon:bag]] 整理完成：带走 <b>${keep.size}</b> 张（其中墓地回收 <b>${recovered}</b> 张），丢弃 <b>${discarded.length}</b> 张`, discarded.length ? 'warn' : 'ok');
        saveGame();
        done();
      });
      UI.refresh(game);
    };
    renderCleanup();
  }

  // ---------- 战后结算（battle.js 回调） ----------
  // win = true 胜利 / false 战败 / null 撤退。
  // 小怪战：使用过的卡进消耗口袋；BOSS 战：卡牌完好保留；
  // 注能消耗的卡（consumedUids）：无论战斗类型都进消耗口袋（可在火堆复原）。
  // 胜利 100% 掉宝箱（按所在环层 / BOSS 固定 BOSS宝箱），开完宝箱再续流。
  game.onBattleEnd = function (opts, playedUids, win, consumedUids) {
    UI.hideOverlay();
    if (win === false) { game.bossCleanupPending = false; doDeath(); return; }
    const toPocket = (uids, why) => {
      const moved = [];
      uids.forEach(uid => {
        const i = game.ownedCards.findIndex(o => o.uid === uid);
        if (i < 0) return;   // 战斗内临时卡（杀/发现/随机卡）战后消散，自动跳过
        moved.push(game.ownedCards[i].card);
        game.ownedCards.splice(i, 1);
      });
      moved.forEach(card => pocketAdd(card));
      if (moved.length && why) {
        UI.log(`[[icon:archive]] ${why}：<b>${moved.length}</b> 张卡牌进入消耗口袋（本局无法再用，基地/火堆可复原）`, 'sys');
      }
      return moved.length;
    };
    if (!opts.isBoss && playedUids.length) {
      toPocket(playedUids, '使用过的卡牌');
    }
    // 普通战/撤出 BOSS：消耗牌仍进消耗口袋；击败 BOSS 时则留给整理背包回收或丢弃。
    if (consumedUids && consumedUids.length && (!opts.isBoss || win !== true)) {
      toPocket(consumedUids, '注能消耗的卡牌');
    }
    // 开完宝箱后的续流：BOSS 战回祭坛，普通战回待机
    const settle = () => {
      if (opts.returnTo === 'altar') { openAltarModal(); saveGame(); return; }
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
    };
    if (win !== true) {   // 撤退：不发宝箱、不发事件奖励
      game.bossCleanupPending = false;
      game.pendingEventLoot = null;
      if (opts.returnTo === 'altar') UI.log('[[icon:runner]] 你撤出了 BOSS战', 'sys');
      settle();
      return;
    }
    UI.log(opts.isBoss ? '[[icon:trophy]] <b>BOSS战胜利！</b>' : '[[icon:trophy]] 战斗胜利！', 'ok');
    game.bossCleanupPending = !!opts.isBoss;
    // 击杀统计/经验：按击败的敌人数计（BOSS 逐个记名，供祭坛征服者成就）
    const foeNames = (opts.foeNames && opts.foeNames.length) ? opts.foeNames : [opts.name || '敌人'];
    foeNames.forEach((n, i) => {
      SDT.Meta.track('kill', { boss: !!opts.isBoss && i === 0, name: n, cls: game.myClass });
    });
    // 事件奖励（如盗匪横行的中宝箱 ×2，开真宝箱）
    let eventChests = [];
    if (game.pendingEventLoot) {
      const loot = game.pendingEventLoot;
      game.pendingEventLoot = null;
      if (loot.items && loot.items.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        loot.items.forEach(it => game.addItem(it));
      }
      if (loot.chests && loot.chests.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        eventChests = loot.chests.map(k => ({ kind: k }));
      }
    }
    // 战胜 100% 掉宝箱（按所在环层 / BOSS 宝箱）
    const afterRewards = () => {
      if (opts.isBoss) { showBossPackCleanup(consumedUids || [], settle); return; }
      settle();
    };
    const drops = SDT.Chests.rollDrops(opts);
    const all = eventChests.concat(drops);
    if (all.length) {
      UI.log(`[[icon:archive]] 战利品掉落：${SDT.Chests.dropText(all)}`, 'loot');
      SDT.Chests.open(game, all, afterRewards);
      return;
    }
    afterRewards();
  };

