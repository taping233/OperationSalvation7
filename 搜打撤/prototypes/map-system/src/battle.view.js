/* battle.view.js —— 战斗渲染：战场 DOM/手牌/指向施法箭头/拖拽预览 */
  // ---------- 渲染 ----------
  function render() {
    if (aim) cancelAim();   // 重渲染时中止进行中的指向（DOM 将重建）
    if (viewingGrave) { renderGrave(); return; }
    if (discovering) {
      const optsHTML = discovering.options.map((c, i) => `
        <div class="bt-card" data-act="btDiscover" data-i="${i}" title="点击置入手牌">
          ${SDT.Cards.cardHTML(c, 'sm')}
        </div>`).join('');
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 发现`, `
        <p class="ov-stats">从随机 <b>${discovering.options.length}</b> 张卡牌中选择 <b>1</b> 张置入手牌</p>
        <div class="bt-hand">${optsHTML}</div>
        <p class="ov-note">发现的卡是战斗内临时卡，战后消散、不进背包。</p>`, true);
      UI.act('btDiscover', (d) => pickDiscover(d.i));
      UI.refresh(G);
      return;
    }
    const cards = hand.map(findCard).filter(Boolean);
    const infusingNow = !!infusing;
    const handHTML = cards.length
      ? cards.map(o => {
          const isSelf = infusingNow && o.uid === infusing.uid;
          const picked = infusingNow && infusing.picked.has(o.uid);
          const targeted = !infusingNow && pendingTarget && pendingTarget.uid === o.uid;
          const effCost = effCostOf(o.card);
          const blocked = infusingNow ? null : unplayableReason(o.card);   // 无法使用的卡：虚化禁用
          const side = (!infusingNow && !blocked) ? targetSide(o.card) : null;
          let cls = '';
          if (infusingNow) cls = isSelf ? ' infuse-self' : (picked ? ' sel' : '');
          else if (blocked) cls = ' off';
          else if (targeted) cls = ' targeting';
          else if ((effCost > energy || busy)) cls = ' off';
          const costTip = effCost !== o.card.cost ? `（[[icon:sparkles]] 宇宙形态：按 1 费打出）` : '';
          const tip = infusingNow
            ? (isSelf ? '正在注能的卡牌' : '点击选择消耗（注能）')
            : blocked
              ? `[[icon:cross]] 无法打出：${blocked}`
              : side === 'enemy'
              ? `费用 ${effCost}${costTip} · 拖到敌人身上打出`
              : side === 'self'
                ? `费用 ${effCost}${costTip} · 拖到左侧「你」的立绘上（治疗 / 净化 / 护盾）`
                : `费用 ${effCost}${costTip} · 点击出牌` +
                  (infuseOf(o.card) > 0 ? ` · 注能(${infuseOf(o.card)})：需先选 ${infuseOf(o.card)} 张手牌消耗` : '');
          const badge = side === 'enemy' ? '<span class="bt-tt">[[icon:swords]]</span>'
            : side === 'self' ? '<span class="bt-tt">[[icon:heart]]</span>' : '';
          const costBadge = effCost !== o.card.cost ? '<span class="bt-cost1" title="宇宙形态：所有卡牌 1 费">[[icon:bolt]]1</span>' : '';
          return `<div class="bt-card${cls}${side ? ' need-target' : ''}" data-act="btPlay" data-uid="${o.uid}"
            data-aim="${side ? '1' : ''}" data-side="${side || ''}" title="${escAttr(tip)}">
            ${SDT.Cards.cardHTML(o.card, 'sm')}
            ${badge}
            ${costBadge}
          </div>`;
        }).join('')
      : mode === 'boss'
        ? (drawPile.length + discard.length)
          ? '<p class="ov-empty">手牌打空了……下回合开始会再抽 1 张</p>'
          : '<p class="ov-empty">牌库与弃牌堆都空了——只能结束回合硬抗，或撤退</p>'
        : '<p class="ov-empty">没有能出的卡了……（打出过的卡本场不可再用）</p>';
    const pilesHTML = mode === 'boss' ? `
        <span class="bt-pile" title="牌库：${escAttr(pileTip(drawPile))}"><span class="bt-pilecard">${SDT.Cards.cardBackHTML()}</span>牌库 <b>${drawPile.length}</b></span>
        <span class="bt-pile" title="弃牌堆：${escAttr(pileTip(discard))}（牌库抽空后自动洗回）"><span class="bt-pilecard down">${SDT.Cards.cardBackHTML()}</span>[[icon:recycle]] 弃牌 <b>${discard.length}</b></span>
        <span class="bt-pile clickable" data-act="btGrave" title="墓地：${escAttr(pileTip(grave))}（被消耗的牌 · 不参与洗回 · 点击查看）"><span class="bt-pilecard down">${SDT.Cards.cardBackHTML()}</span>[[icon:skull]] 墓地 <b>${grave.length}</b></span>` : '';
    const tip = mode === 'boss'
      ? `开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 弃牌堆抽空后自动洗回 · 墓地（被消耗的牌）不洗回 · 点击「墓地」查看`
      : '普通战斗无需抽牌 ·「抽 N 张牌」效果改为获得 N 张杀 · 指向卡须拖到目标身上（[[icon:swords]]敌人 · [[icon:heart]]自己）';
    const infuseBar = infusingNow ? `
      <div class="bt-infuse">
        [[icon:flask]] <b>注能(${infusing.need})</b>：选择 <b>${infusing.need}</b> 张手牌消耗，才能打出【${esc(infusing.card.name)}】
        （已选 <b>${infusing.picked.size}/${infusing.need}</b> · 被消耗的牌战后进消耗口袋，可在火堆复原）
        <button class="mini-btn ok" data-act="btInfuseGo" ${infusing.picked.size !== infusing.need ? 'disabled' : ''}>[[icon:swords]] 发动</button>
        <button class="mini-btn" data-act="btInfuseCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    const lockSide = pendingTarget ? targetSide(pendingTarget.card) : null;
    const targetBar = pendingTarget ? `
      <div class="bt-infuse bt-pick">
        ${lockSide === 'self'
          ? `[[icon:heart]] 已选【<b>${esc(pendingTarget.card.name)}</b>】——把它<b>拖到左侧「你」的立绘上</b>打出（治疗 / 净化 / 护盾）`
          : `[[icon:swords]] 已选【<b>${esc(pendingTarget.card.name)}</b>】——把它<b>拖到某个敌人身上</b>打出`}
        ${pendingHint ? `<span class="bt-hint-warn">[[icon:question]] ${pendingHint}</span>` : ''}
        <button class="mini-btn" data-act="btPickCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // —— 我方立绘（治疗/净化/护盾类卡牌的拖放目标） ——
    const selfPct = Math.max(0, G.hp / G.maxHp * 100);
    const selfLock = pendingTarget && lockSide === 'self';
    const selfHTML = `
      <div class="bt-foe bt-self${selfLock ? ' can-target' : ''}" id="btSelf"
        title="你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出">
        <span class="bt-self-tag">你</span>
        <div class="bt-fportrait">${G.myClass && SDT.Art.has(G.myClass) ? SDT.Art.classArt(G.myClass) : SDT.Icons.img('helmet')}</div>
        <div class="bt-finfo">
          <b>${esc(G.myClass || '流放者')}</b>
          <div class="bt-hpwrap"><i style="width:${selfPct.toFixed(1)}%"></i><span>${Math.max(0, G.hp)}/${G.maxHp}</span></div>
          <span class="bt-tags">[[icon:swords]] ${G.atk}${pdef.shield ? ' · [[icon:shield]] 盾 ' + pdef.shield : ''}${pdef.armor ? ' · [[icon:plate]] 甲 ' + pdef.armor : ''}${pdef.guard ? ' · 格挡中' : ''}</span>
        </div>
      </div>`;
    // —— 敌人区（多敌人横排；词缀角标；免伤高亮） ——
    const foesHTML = foes.map((f, idx) => {
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      return `<div class="bt-foe${opts.isBoss || f.affix ? ' bt-boss' : ''}${f.dead ? ' dead' : ''}${immune ? ' aegis' : ''}${pendingTarget && lockSide === 'enemy' && !f.dead ? ' can-target' : ''}" data-foe-id="${escAttr(f.id || f.name)}"
          data-eidx="${idx}" title="${aff ? escAttr(aff.name + '：' + aff.desc) : ''}">
          <div class="bt-fportrait">${f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime')}</div>
          <div class="bt-finfo">
            <b>${esc(f.name)}</b>${f.dead ? ' <span class="bt-deadmark">[[icon:cross]]</span>' : ''}
            ${aff ? `<span class="bt-affix" title="${escAttr(aff.desc)}">${aff.icon} ${aff.name}</span>` : ''}
          ${!f.dead && f.intent ? `<span class="bt-intent" data-intent="${escAttr(f.intent.kind)}" title="下一回合预告">${f.intent.icon} ${esc(f.intent.label)}${f.intent.damage ? ` · ${f.intent.damage}` : ''}</span>` : ''}
          <div class="bt-hpwrap"><i style="width:${Math.max(0, f.hp / f.maxHp * 100).toFixed(1)}%"></i><span>${Math.max(0, f.hp)}/${f.maxHp}</span></div>
          <span class="bt-tags">[[icon:swords]] ${f.atk}${f.affix === 'frenzy' ? ' ×2' : ''}${immune ? ' · [[icon:crystal]] 庇幕免伤中' : ''}${curseChips(f.status) ? ' · ' + curseChips(f.status) : ''}</span>
        </div>
      </div>`;
    }).join('');
    const battleAssetKey = opts.isBoss
      ? ({ boss_general: 'battle-boss-general', boss_orc: 'battle-boss-orc', boss_elem: 'battle-boss-element' }[foes[0] && foes[0].id] || 'battle-boss-general')
      : 'battle-normal';
    UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合`, `
      <div class="battle-stage" data-asset-key="${battleAssetKey}">
      <div class="battle-stage-shade"></div>
      <div class="bt-foes">${selfHTML}${foesHTML}
        <div class="bt-ops-col">
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'}" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>[[icon:skip]] 结束回合</button>
          <button class="ov-btn" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}>[[icon:runner]] 撤退</button>
        </div>
      </div>
      <div class="bt-player">
        [[icon:heart]] <b>${G.hp}/${G.maxHp}</b> · [[icon:bolt]] 能量 <b>${energy}/${maxEnergy}</b>
        ${pilesHTML}
        ${pdef.shield ? ` · [[icon:shield]] 盾 ${pdef.shield}` : ''}${pdef.armor ? ` · [[icon:plate]] 甲 ${pdef.armor}` : ''}${pdef.guard ? ' · [[icon:shield]] 格挡中' : ''}
        ${curseChips(pstat.status) ? ' · ' + curseChips(pstat.status) : ''}
        <span class="bt-tip">${tip}</span>
      </div>
      ${infuseBar}
      ${targetBar}
      <div class="bt-hand">${handHTML}</div>
      <p class="ov-note">${!opts.isBoss && opts.strategy ? `[[icon:gear]] 敌情预告：${esc(opts.strategy)} · ` : ''}${opts.isBoss
        ? 'BOSS战：使用过的卡牌战后完好保留；注能消耗的牌进墓地（不洗回），战胜 BOSS 后整理背包时可放回'
        : '小怪战：打出过的卡战后进入消耗口袋（获得的杀与发现的卡是临时卡，战后消散）'}</p>
      </div>`, true);
    UI.act('btPlay', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 指向松手刚打出，忽略残留 click
      if (infusingNow) return toggleInfusePick(d.uid);
      play(d.uid);   // 指向性卡：点卡只锁定，必须拖到目标身上才打出
    });
    UI.act('btEnd', endTurn);
    UI.act('btFlee', flee);
    UI.act('btGrave', () => { viewingGrave = true; render(); });
    UI.act('btInfuseGo', confirmInfuse);
    UI.act('btInfuseCancel', cancelInfuse);
    UI.act('btPickCancel', () => { pendingTarget = null; pendingHint = ''; render(); });
    // —— 指向施法（炉石/杀戮尖塔式）：按住指向卡轻微拎起，弯曲箭头跟随指针 ——
    //    指向敌人 = 红色箭头，指向自己（立绘）= 绿色箭头；松手在目标身上即打出。
    //    轻点卡牌 = 仅锁定（提示条引导），与既有交互兼容。
    const body = UI.el.ovBody;
    body.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
      el.addEventListener('click', () => {
        // 点击敌人不再确认（必须指向松手），只给纠正提示
        if (pendingTarget && lockSide === 'enemy') pendingHint = '请按住卡牌「拖向」敌人身上松手';
        else if (pendingTarget && lockSide === 'self') pendingHint = '[[icon:heart]] 治疗 / 净化卡要拖到左侧「你」的立绘上';
        if (pendingTarget) render();
      });
    });
    const selfEl = body.querySelector('#btSelf');
    if (selfEl) {
      selfEl.addEventListener('click', () => {
        if (pendingTarget && lockSide === 'self') { play(pendingTarget.uid, 'self'); return; }
        if (pendingTarget) { pendingHint = '[[icon:heart]] 这是治疗 / 净化类卡牌——请拖到「你」的立绘上'; render(); }
      });
    }
    body.querySelectorAll('.bt-card[data-aim="1"]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el); });
    });
    UI.refresh(G);
  }

  // ---------- 指向施法：拎起 + 弯曲箭头 ----------
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e' };
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 指向松手刚打出成功的时间戳（抑制随后误触发的 click 锁定）

  function aimCanvasEnsure() {
    let canvas = document.getElementById('aimArrow');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'aimArrow';
      UI.el.overlay.appendChild(canvas);
    }
    return canvas;
  }
  function aimArrowRemove() {
    const s = document.getElementById('aimArrow');
    if (s) s.remove();
  }
  // 更新弯曲箭头：Canvas 绘制二次贝塞尔上弓与箭头，避免矢量 DOM 资源。
  function aimArrowUpdate(x1, y1, x2, y2, color) {
    const canvas = aimCanvasEnsure();
    const vr = UI.el.overlay.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(vr.width));
    const height = Math.max(1, Math.round(vr.height));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    let px = -dy / len, py = dx / len;
    if (py > 0) { px = -px; py = -py; }               // 弓背朝上
    const bow = Math.min(90, len * 0.3);
    const cx = mx + px * bow, cy = my + py * bow;
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl, wx = -uy, wy = ux;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = .2;
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    ctx.globalAlpha = .95;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2 - ux * 9, y2 - uy * 9); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#080b0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * 17 + wx * 8, y2 - uy * 17 + wy * 8);
    ctx.lineTo(x2 - ux * 17 - wx * 8, y2 - uy * 17 - wy * 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 指针处的有效目标（enemy 卡找活着的敌人 / self 卡找自己的立绘）
  // side 显式传入：endAim 时全局 aim 已清空，不能再依赖它
  function aimHoverAt(x, y, side) {
    const elAt = document.elementFromPoint(x, y);
    if (!elAt || !side) return null;
    if (side === 'enemy') {
      const foeEl = elAt.closest('.bt-foe[data-eidx]');
      if (foeEl) {
        const idx = +foeEl.dataset.eidx;
        if (!foes[idx].dead) return { kind: 'enemy', idx, el: foeEl };
      }
      return null;
    }
    const selfEl = elAt.closest('#btSelf');
    return selfEl ? { kind: 'self', el: selfEl } : null;
  }
  function aimClearHover() {
    if (!aim || !aim.hover) return;
    aim.hover.el.classList.remove('drag-over', 'drop-here');
    if (aim.hover.kind === 'enemy') clearFoePreview(aim.hover.el);
    aim.hover = null;
  }
  function aimCleanup(a) {
    if (a) {
      a.el.classList.remove('aim-lift');
      if (a.hover) {
        a.hover.el.classList.remove('drag-over', 'drop-here');
        if (a.hover.kind === 'enemy') clearFoePreview(a.hover.el);
      }
    }
    aimArrowRemove();
  }
  function startAim(e, el) {
    if (busy || infusing || discovering || aim) return;
    const uid = el.dataset.uid;
    const entry = findCard(uid);
    if (!entry) return;
    const side = targetSide(entry.card);
    if (!side) return;
    if (effCostOf(entry.card) > energy) return;   // 能量不足：不进入指向（点击会有提示）
    const vr = UI.el.overlay.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    aim = {
      uid, card: entry.card, side, el,
      ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
      sx: e.clientX, sy: e.clientY, moved: false, hover: null,
    };
    el.classList.add('aim-lift');
    SDT.Sound.sfx('hover');
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    window.addEventListener('pointermove', moveAim, true);
    window.addEventListener('pointerup', endAim, true);
    window.addEventListener('pointercancel', cancelAim, true);
  }
  function moveAim(e) {
    if (!aim) return;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < 6) return;
    aim.moved = true;
    const vr = UI.el.overlay.getBoundingClientRect();
    const hit = aimHoverAt(e.clientX, e.clientY, aim.side);
    if (aim.hover && (!hit || hit.el !== aim.hover.el)) aimClearHover();
    let tx = e.clientX - vr.left, ty = e.clientY - vr.top;
    if (hit) {
      const hr = hit.el.getBoundingClientRect();
      tx = hr.left + hr.width / 2 - vr.left;
      ty = hr.top + hr.height / 2 - vr.top;
      if (hit.kind === 'enemy') { hit.el.classList.add('drag-over'); showFoePreview(hit.el, hit.idx, aim.card); }
      else hit.el.classList.add('drop-here');
      aim.hover = hit;
    }
    aimArrowUpdate(aim.ax, aim.ay, tx, ty, AIM_COLOR[hit ? hit.kind : aim.side]);
  }
  function endAim(e) {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', cancelAim, true);
    const a = aim;
    aim = null;
    if (!a) return;
    const wasMoved = a.moved;
    a.moved = false;
    const hit = wasMoved ? aimHoverAt(e.clientX, e.clientY, a.side) : null;
    aimCleanup(a);
    if (wasMoved && hit) {
      aimPlayedAt = Date.now();
      if (hit.kind === 'enemy') play(a.uid, hit.idx);
      else play(a.uid, 'self');
      return;
    }
    // 轻点 = 锁定（提示条引导）；拖了但没拖到目标 = 保持锁定，可再指一次
    if (wasMoved) { pendingTarget = { uid: a.uid, card: a.card }; pendingHint = ''; render(); }
  }
  function cancelAim() {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', cancelAim, true);
    const a = aim;
    aim = null;
    aimCleanup(a);
  }

  // ---------- 指向悬停效果预览（松手前暗示打出结果；card = 指向中的卡） ----------
  function showFoePreview(el, idx, card) {
    if (el.querySelector('.bt-fpreview')) return;   // 已显示则不重建（move 连续触发）
    const foe = foes[idx];
    const useCard = card || (pendingTarget && pendingTarget.card) || null;
    if (!foe || foe.dead || !useCard) return;
    const desc = String(useCard.desc || '');
    const tm = desc.match(/(?:攻击|命中)\s*(\d+)\s*次/) || desc.match(/(\d+)\s*段/);
    const times = tm ? Math.max(1, +tm[1]) : 1;
    let main, sub = '';
    if (aegisBlocked(foe)) {
      main = '[[icon:crystal]] 将被元素庇幕完全减免';
      sub = '先挂「破甲」再打才能造成伤害';
    } else {
      const type = SDT.Cards.DMG_TYPE_META[useCard.dmgType] ? useCard.dmgType : Combat.TYPES.FIXED;
      const amount = +useCard.dmg || 0;
      // 预览结算（克隆快照，不改动真实状态）
      const snap = { hp: foe.hp, status: Object.assign({}, foe.status),
        defense: { shield: foe.defense.shield, armor: foe.defense.armor, guard: foe.defense.guard } };
      const r = Combat.previewDamage({ atk: G.atk, spellPower: G.spellPower || 0 }, snap, amount, type);
      if (r.stealthed) {
        main = `[[icon:runner]] <b>${esc(foe.name)}</b> 潜行中——伤害无法命中`;
        sub = '等潜行结束，或先用非伤害卡过渡';
      } else {
        const total = r.dealt * times;
        main = `[[icon:bolt]] 预计造成 <b>${total}</b> 点${Combat.TYPE_NAME[type]}` + (times > 1 ? `（${r.dealt} × ${times} 段）` : '');
        sub = r.log.length ? r.log.join(' · ') : '无加成';
        if (foe.hp - total <= 0) { main = `[[icon:skull]] 预计击倒 ${esc(foe.name)}！`; }
      }
    }
    const div = document.createElement('div');
    div.className = 'bt-fpreview';
    div.innerHTML = `<b>${main}</b><span>${sub}</span><span class="bt-fpreview-tip">—— 松手打出 ——</span>`;
    el.appendChild(div);
    SDT.Sound.sfx('hover');
  }
  function clearFoePreview(el) {
    const p = el.querySelector('.bt-fpreview');
    if (p) p.remove();
  }

  window.SDT = window.SDT || {};
  window.SDT.Battle = { start, _test: { refillDrawPile } };
