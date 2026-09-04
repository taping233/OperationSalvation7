/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { G, pendingHint, pendingTarget, viewingGrave } from './battle.core.js';
import { escAttr } from './shared.js';
import { AFFIX_META, Combat, R, aegisBlocked, busy, dreadShown, floats, cancelInfuse, confirmInfuse, curseChips, discard, discovering, drawPile, effCostOf, endTurn, energy, findCard, flee, foes, grave, hand, infuseOf, infusing, maxEnergy, mode, opts, pdef, pickDiscover, pileTip, play, pstat, refillDrawPile, renderGrave, start, targetSide, toggleInfusePick, turn, unplayableReason, _set_viewingGrave, _set_pendingTarget, _set_pendingHint, _set_dreadShown, _set_floats } from './battle.core.js';
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
    // —— 同名卡堆叠（v0.32 杀戮尖塔式手牌）：同名同描述的卡只占一个位置，显示 ×N ——
    // 注能中：注能主卡单独一块展示，其同名燃料照常成组（点击组 = 消耗组内一张）
    const groups = [];
    const pushGroup = (o) => {
      const g = groups.find(g => g.card.name === o.card.name && g.card.desc === o.card.desc);
      if (g) g.uids.push(o.uid); else groups.push({ card: o.card, uids: [o.uid], self: false });
    };
    if (infusingNow) {
      cards.forEach(o => { if (o.uid !== infusing.uid) pushGroup(o); });
      const infEntry = findCard(infusing.uid);
      if (infEntry) groups.push({ card: infEntry.card, uids: [infusing.uid], self: true });
    } else cards.forEach(pushGroup);
    const N = groups.length;
    const handHTML = N
      ? groups.map((g, i) => {
          const uid = g.uids[0];
          const isSelf = infusingNow && g.self;
          const pickedN = infusingNow ? g.uids.filter(u => infusing.picked.has(u)).length : 0;
          const targeted = !infusingNow && pendingTarget && pendingTarget.uid === uid;
          const effCost = effCostOf(g.card);
          const blocked = infusingNow ? null : unplayableReason(g.card);   // 无法使用的卡：虚化禁用
          const side = (!infusingNow && !blocked) ? targetSide(g.card) : null;
          let cls = '';
          if (infusingNow) cls = isSelf ? ' infuse-self' : (pickedN ? ' sel' : '');
          else if (blocked) cls = ' off';
          else if (targeted) cls = ' targeting';
          else if ((effCost > energy || busy)) cls = ' off';
          const costTip = effCost !== g.card.cost ? `（[[icon:sparkles]] 宇宙形态：按 1 费打出）` : '';
          const tip = infusingNow
            ? (isSelf ? '正在注能的卡牌' : `点击选择消耗（注能）${g.uids.length > 1 ? `· 本叠还有 ${g.uids.length} 张` : ''}`)
            : blocked
              ? `[[icon:cross]] 无法打出：${blocked}`
              : side === 'enemy'
              ? `费用 ${effCost}${costTip} · 拖到敌人身上打出`
              : side === 'self'
                ? `费用 ${effCost}${costTip} · 拖到左侧「你」的立绘上（治疗 / 净化 / 护盾）`
                : `费用 ${effCost}${costTip} · 点击出牌` +
                  (infuseOf(g.card) > 0 ? ` · 注能(${infuseOf(g.card)})：需先选 ${infuseOf(g.card)} 张手牌消耗` : '');
          const badge = side === 'enemy' ? '<span class="bt-tt">[[icon:swords]]</span>'
            : side === 'self' ? '<span class="bt-tt">[[icon:heart]]</span>' : '';
          const costBadge = effCost !== g.card.cost ? '<span class="bt-cost1" title="宇宙形态：所有卡牌 1 费">[[icon:bolt]]1</span>' : '';
          const cnt = g.uids.length > 1 ? `<span class="bt-count" title="同名卡 ${g.uids.length} 张堆叠为一叠">×${g.uids.length}</span>` : '';
          // 扇形手牌：越靠边旋转越大（transform-origin 在卡片上方远处形成圆弧）
          const off = i - (N - 1) / 2;
          const rot = (off * Math.min(5, 44 / N)).toFixed(2);
          const ml = i === 0 ? '0' : (N > 9 ? '-34px' : N > 6 ? '-14px' : '0');
          return `<div class="bt-card${cls}${side ? ' need-target' : ''}" data-act="btPlay" data-uid="${uid}"
            data-aim="${side ? '1' : ''}" data-side="${side || ''}" style="--rot:${rot}deg;margin-left:${ml}" title="${escAttr(tip)}">
            ${SDT.Cards.cardHTML(g.card, 'sm')}
            ${cnt}
            ${badge}
            ${costBadge}
          </div>`;
        }).join('')
      : mode === 'boss'
        ? (drawPile.length + discard.length)
          ? '<p class="ov-empty">手牌打空了……下回合开始会再抽 1 张</p>'
          : '<p class="ov-empty">牌库与弃牌堆都空了——只能结束回合硬抗，或撤退</p>'
        : '<p class="ov-empty">没有能出的卡了……（打出过的卡本场不可再用）</p>';
    const drawPileHTML = mode === 'boss'
      ? `<span class="bt-pile" title="牌库：${escAttr(pileTip(drawPile))}"><span class="bt-pilecard">${SDT.Cards.cardBackHTML()}</span><b>${drawPile.length}</b></span>` : '';
    const pilesHTML = mode === 'boss' ? `
        <span class="bt-pile" title="弃牌堆：${escAttr(pileTip(discard))}（牌库抽空后自动洗回）"><span class="bt-pilecard down">${SDT.Cards.cardBackHTML()}</span><b>${discard.length}</b></span>
        <span class="bt-pile clickable" data-act="btGrave" title="墓地：${escAttr(pileTip(grave))}（被消耗的牌 · 不参与洗回 · 点击查看）"><span class="bt-pilecard down">${SDT.Cards.cardBackHTML()}</span>[[icon:skull]] <b>${grave.length}</b></span>` : '';
    const tip = mode === 'boss'
      ? `开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 弃牌堆抽空后自动洗回 · 墓地（被消耗的牌）不洗回`
      : '普通战斗无需抽牌 ·「抽 N 张牌」效果改为获得 N 张初始攻击 · 指向卡须拖到目标身上（[[icon:swords]]敌人 · [[icon:heart]]自己）';
    const infuseBar = infusingNow ? `
      <div class="bt-infuse">
        [[icon:flask]] <b>注能(${infusing.need})</b>：选择 <b>${infusing.need}</b> 张手牌消耗，才能打出【${esc(infusing.card.name)}】
        （已选 <b>${infusing.picked.size}/${infusing.need}</b> · 同名堆叠每点一次消耗一张 · 被消耗的牌战后进消耗口袋，可在火堆复原）
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
    // —— 我方单位（左下站立；治疗/净化/护盾类卡牌的拖放目标） ——
    const selfPct = Math.max(0, G.hp / G.maxHp * 100);
    const selfLock = pendingTarget && lockSide === 'self';
    const selfHTML = `
      <div class="sts-unit sts-me${selfLock ? ' can-target' : ''}" id="btSelf"
        title="你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出">
        <div class="sts-figure">${G.myClass && SDT.Art.has(G.myClass) ? SDT.Art.classArt(G.myClass) : SDT.Icons.img('helmet')}</div>
        <div class="sts-nameplate">
          <b>${esc(G.myClass || '旅人')}</b><span class="sts-you">你</span>
          <div class="bt-hpwrap sts-hp"><i style="width:${selfPct.toFixed(1)}%"></i><span>${Math.max(0, G.hp)}/${G.maxHp}</span></div>
          <div class="sts-stats">[[icon:swords]] ${G.atk}${pdef.shield ? ' · [[icon:shield]] 盾 ' + pdef.shield : ''}${pdef.armor ? ' · [[icon:plate]] 甲 ' + pdef.armor : ''}${pdef.guard ? ' · 格挡中' : ''}</div>
          ${curseChips(pstat.status) ? `<div class="sts-chips">${curseChips(pstat.status)}</div>` : ''}
        </div>
      </div>`;
    // —— 敌方单位（右下站立横排；意图气泡在头顶；词缀角标；免伤高亮） ——
    const foesHTML = foes.map((f, idx) => {
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      return `<div class="sts-unit sts-foe bt-foe${opts.isBoss || f.affix ? ' is-boss' : ''}${f.dead ? ' dead' : ''}${immune ? ' aegis' : ''}${pendingTarget && lockSide === 'enemy' && !f.dead ? ' can-target' : ''}" data-foe-id="${escAttr(f.id || f.name)}"
          data-eidx="${idx}" title="${aff ? escAttr(aff.name + '：' + aff.desc) : ''}">
          ${!f.dead && f.intent ? `<div class="sts-intent" title="下一回合预告">${f.intent.icon} ${esc(f.intent.label)}${f.intent.damage ? ` · ${f.intent.damage}` : ''}</div>` : ''}
          <div class="sts-figure">${f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime')}</div>
          <div class="sts-nameplate">
            <b>${esc(f.name)}</b>${f.dead ? ' <span class="bt-deadmark">[[icon:cross]]</span>' : ''}
            ${aff ? `<span class="bt-affix" title="${escAttr(aff.desc)}">${aff.icon} ${aff.name}</span>` : ''}
            <div class="bt-hpwrap sts-hp"><i style="width:${Math.max(0, f.hp / f.maxHp * 100).toFixed(1)}%"></i><span>${Math.max(0, f.hp)}/${f.maxHp}</span></div>
            <div class="sts-stats">[[icon:swords]] ${f.atk}${f.affix === 'frenzy' ? ' ×2' : ''}${immune ? ' · [[icon:crystal]] 庇幕免伤中' : ''}</div>
            ${curseChips(f.status) ? `<div class="sts-chips">${curseChips(f.status)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
    const battleAssetKey = opts.isBoss
      ? ({ boss_general: 'battle-boss-general', boss_orc: 'battle-boss-orc', boss_elem: 'battle-boss-element' }[foes[0] && foes[0].id] || 'battle-boss-general')
      : 'battle-normal';
    UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合`, `
      <div class="battle-stage sts" data-asset-key="${battleAssetKey}">
      <div class="battle-stage-shade"></div>
      <div class="sts-arena">
        ${selfHTML}
        <div class="sts-foes">${foesHTML}</div>
      </div>
      ${infuseBar}
      ${targetBar}
      <div class="sts-hud">
        <div class="sts-hud-l">
          <div class="sts-energy" title="能量：每回合固定 ${maxEnergy} 费">[[icon:bolt]] <b>${energy}</b><span>/${maxEnergy}</span></div>
          ${drawPileHTML}
        </div>
        <div class="bt-hand sts-hand" title="${escAttr(tip)}">${handHTML}</div>
        <div class="sts-hud-r">
          ${pilesHTML}
          <button class="ov-btn ghost" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}>[[icon:runner]] 撤退</button>
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'}" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>[[icon:skip]] 结束回合</button>
        </div>
      </div>
      <p class="sts-note">${!opts.isBoss && opts.strategy ? `[[icon:gear]] 敌情预告：${esc(opts.strategy)} · ` : ''}${opts.isBoss
        ? 'BOSS战：卡牌战后完好保留；注能消耗的牌进墓地（不洗回），战胜后整理背包时可放回'
        : '小怪战：打出过的卡战后进入消耗口袋（初始攻击与发现的卡是临时卡，战后消散）'}</p>
      </div>`, 'battle');
    UI.act('btPlay', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 指向松手刚打出，忽略残留 click
      if (infusingNow) return toggleInfusePick(d.uid);
      play(d.uid);   // 指向性卡：点卡只锁定，必须拖到目标身上才打出
    });
    UI.act('btEnd', endTurn);
    UI.act('btFlee', flee);
    UI.act('btGrave', () => { _set_viewingGrave(true); render(); });
    UI.act('btInfuseGo', confirmInfuse);
    UI.act('btInfuseCancel', cancelInfuse);
    UI.act('btPickCancel', () => { _set_pendingTarget(null); _set_pendingHint(''); render(); });
    // —— 指向施法（炉石/杀戮尖塔式）：按住指向卡轻微拎起，弯曲箭头跟随指针 ——
    //    指向敌人 = 红色箭头，指向自己（立绘）= 绿色箭头；松手在目标身上即打出。
    //    轻点卡牌 = 仅锁定（提示条引导），与既有交互兼容。
    const body = UI.el.ovBody;
    body.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
      el.addEventListener('click', () => {
        // 点击敌人不再确认（必须指向松手），只给纠正提示
        if (pendingTarget && lockSide === 'enemy') _set_pendingHint('请按住卡牌「拖向」敌人身上松手');
        else if (pendingTarget && lockSide === 'self') _set_pendingHint('[[icon:heart]] 治疗 / 净化卡要拖到左侧「你」的立绘上');
        if (pendingTarget) render();
      });
    });
    const selfEl = body.querySelector('#btSelf');
    if (selfEl) {
      selfEl.addEventListener('click', () => {
        if (pendingTarget && lockSide === 'self') { play(pendingTarget.uid, 'self'); return; }
        if (pendingTarget) { _set_pendingHint('[[icon:heart]] 这是治疗 / 净化类卡牌——请拖到「你」的立绘上'); render(); }
      });
    }
    body.querySelectorAll('.bt-card[data-aim="1"]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el); });
    });
    // 人物去纸色背景，像模型一样站在场景里（art.js 内按图缓存，二次渲染零成本）
    if (SDT.Art.cutoutFigures) SDT.Art.cutoutFigures(body);
    // BOSS 登场演出：竖线阴影压过场景 2.4s（每场一次）
    if (opts.isBoss && !dreadShown) {
      _set_dreadShown(true);
      const st = body.querySelector('.battle-stage');
      if (st) { st.classList.add('fx-dread'); setTimeout(() => st.classList.remove('fx-dread'), 2500); }
    }
    spawnFloats(body);
    UI.refresh(G);
  }

  // ---------- 战斗特效（v0.32.2）：伤害/受击飘字 + 受击抖动 + 红闪 ----------
  // 飘字挂在 #overlay 层而不是 ovBody——ovBody 每次渲染整块重建，飘字动画会被腰斩
  function spawnFloats(body) {
    if (!floats.length) return;
    const list = floats;
    _set_floats([]);
    const ov = UI.el.overlay;
    const ovR = ov.getBoundingClientRect();
    list.forEach(f => {
      const isSelf = f.unit === 'self';
      const figEl = isSelf
        ? body.querySelector('#btSelf .sts-figure')
        : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
      if (!figEl) return;
      // 受击反馈：单位抖动；自己掉血再叠一层全屏红闪
      figEl.classList.add(isSelf ? 'fx-hit-self' : 'fx-hit');
      setTimeout(() => figEl.classList.remove(isSelf ? 'fx-hit-self' : 'fx-hit'), 480);
      if (isSelf) hurtFlash(ov);
      if (f.warm) {   // 治疗暖色滤镜（表情反馈·零美术）
        figEl.classList.add('fx-warm');
        setTimeout(() => figEl.classList.remove('fx-warm'), 950);
      }
      const stk = (f.cls || '').includes('stk');   // 表情贴纸：挂在头顶而非胸前
      const r = figEl.getBoundingClientRect();
      const span = document.createElement('span');
      span.className = 'sts-float ' + (f.cls || 'dmg');
      span.textContent = f.text;
      span.style.left = (r.left - ovR.left + r.width / 2) + 'px';
      span.style.top = (r.top - ovR.top + r.height * (stk ? 0.02 : 0.32)) + 'px';
      ov.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
      setTimeout(() => span.remove(), 1400);   // 兜底：animationend 偶尔不触发时清掉不可见残骸
    });
  }
  // 全屏受击红闪（径向暗角，600ms 淡出）
  function hurtFlash(ov) {
    if (ov.querySelector('.sts-hurtflash')) return;   // 连续受击不叠层
    const div = document.createElement('div');
    div.className = 'sts-hurtflash';
    ov.appendChild(div);
    div.addEventListener('animationend', () => div.remove(), { once: true });
    setTimeout(() => div.remove(), 1000);   // 兜底清理
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
    if (wasMoved) { _set_pendingTarget({ uid: a.uid, card: a.card }); _set_pendingHint(''); render(); }
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

export { render };
