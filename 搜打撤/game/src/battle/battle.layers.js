/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：手牌与单位区常驻层（批次A/B 差分更新）+ 状态角标 statusChips/curseChips（随用迁入）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect } from '../ui/ui-scale.js';
import { characterName } from '../core/characters.js';
import { esc } from '../core/shared.js';
import { escAttr } from '../core/shared.js';
import { fanLayout } from './battle.hand.js';
import { intentViewModel } from './battle.intents.js';
import { commands, getSnapshot, AFFIX_META, Combat, aegisBlocked, effCostOf, findCard, infuseOf, targetSide, unplayableReason, handCurseSpecs } from './battle.core.js';
  const play = commands.playCard;
  const resolveSlam = commands.resolveSlam;
  const resolveDart = commands.resolveDart;   // 血毒双镖二段点选（2026-09-16 留言）
  const useItemCmd = commands.useItem;
  const cancelPendingTarget = commands.cancelPendingTarget;
  const HAND_PAGE_SIZE = 9;   // 2026-09-16 老板：每栏最多 9 张（原 battle.view 渲染段，随 updateHand 的 handIndex 落位迁入——批5）
import { animateSafe } from './battle.anim.js';
import { aim, clickSelectedUid, selectCardByClick, clickSelectedTarget, setTargetable, startAim, cancelAim, cancelClickSelection } from './battle.aim.js';
import { showFoePreview, clearFoePreview } from './battle.hover.js';
import { cardRuleHint } from './battle.preview.js';
  // 数字键选牌 / Esc 取消（原在 aim 片：需读手牌层 handLayer，随迁本片解 aim↔layers 环——2026-09-22 批5）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (e.defaultPrevented || !UI.el.ovBody?.querySelector('.battle-stage')) return;
      const snap = getSnapshot();
      const pending = snap.pendingTarget || snap.pendingItem || snap.slamPending || snap.dartPending;
      if (aim || clickSelectedUid != null || pending) {
        e.preventDefault(); e.stopPropagation();
        if (aim) cancelAim();
        if (clickSelectedUid != null) cancelClickSelection();
        if (pending) cancelPendingTarget();
      }
      return;
    }
    if (!handLayer || e.defaultPrevented) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!/^[1-9]$/.test(e.key)) return;
    const el = handLayer.querySelector(`.bt-card[data-hand-index="${e.key}"]`);
    if (!el || el.classList.contains('off')) { if (el) play(el.dataset.uid); return; }
    e.preventDefault();
    selectCardByClick(el.dataset.uid, true);
  });
  function onTargetKeydown(e) {
    if (e.target !== e.currentTarget || !e.currentTarget.classList.contains('can-target')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.click();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const targets = [...document.querySelectorAll('#btSelf.can-target, .bt-foe.can-target')];
    if (targets.length < 2) return;
    const index = targets.indexOf(e.currentTarget);
    if (index < 0) return;
    e.preventDefault();
    e.stopPropagation();
    targets[(index + (e.key === 'ArrowRight' ? 1 : -1) + targets.length) % targets.length].focus();
  }
  // 状态角标：祝福（绿）+ 诅咒（红）——2026-09-11 架构批次 1 自 battle.core 外迁（纯视图函数）
  // compact（敌方名牌收纳，迭代评审 09-20）：总数>4 时退化为「图标+层数」——纯图标会丢层数（美术岗复核口径）；
  // 玩家名牌不传 compact，维持原样。09-20 老板：词条触摸讲解——data-term 交 term-tips.js 弹自绘讲解框
  // （系统 title 已被 game.boot 全局移除，触屏也无效），讲解框自带全名+全文，compact 不再需要分叉文案
  function statusChips(status, opts) {
    const compactAll = !!(opts && opts.compact);
    const activeBuffs = Combat.BUFFS.filter(k => (status[k] || 0) > 0);
    const activeCurses = Combat.CURSES.filter(k => (status[k] || 0) > 0);
    const compact = compactAll && (activeBuffs.length + activeCurses.length) > 4;
    const buffs = activeBuffs.map(k => {
      const m = Combat.BUFF_META[k];
      const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
      const label = compact ? `${status[k]}${m.timed ? '回合' : ''}` : `${m.name}${v}`;
      return `<span class="bt-buff b-${k}" data-term="${k}">${m.icon} ${label}</span>`;
    });
    const curses = activeCurses.map(k => {
      const m = Combat.CURSE_META[k];
      const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
      const label = compact ? (m.stack ? `${status[k]}` : `${status[k]}回合`) : txt;
      return `<span class="bt-curse c-${k}" data-term="${k}">${m.icon} ${label}</span>`;
    });
    return buffs.concat(curses).join(' ');
  }
  const curseChips = statusChips;   // 兼容旧调用名
  // ---------- 手牌常驻层（架构批次A：手牌区不随整屏重渲染重建） ----------
  // ovBody 每次渲染整块重建，但 .sts-hand 由本模块持有、跨渲染复用（showOverlay 之后
  // replaceWith 挂回新舞台）。每叠同名卡一个常驻槽位节点：
  //   - 扇形位 = CSS 变量目标值（--fx/--fy/--frot/--fs），位置变化用可取消 WAAPI 补间，
  //     对齐 STS2 NHandCardHolder「SetTargetPosition + 可取消动画 + 误差吸附」结构；
  //   - hover / 指向拎起 / 双击放大只碰类名，不触发重建；
  //   - 卡面内容按序列化签名 diff，内容没变不重写 innerHTML（图片不重载、悬停态不闪）。
  let handLayer = null;
  const handSlots = new Map();   // key -> { slot, card, sig, rect, isNew }
  let handSuspended = false;     // 墓地/背包/发现等战斗中弹层接管期间 = true（手牌被摘下但战斗未结束）
  let battleToken = null;        // 战斗实例令牌（snapshot.battleToken）：换场重置常驻层的唯一依据

  function handSlotKey(g) {
    return (g.self ? 'self|' : '') + g.card.name + '|' + (g.card.desc || '');
  }
  function setSlotVars(slot, L) {
    slot.style.setProperty('--fx', L.x + 'px');
    slot.style.setProperty('--fy', L.y + 'px');
    slot.style.setProperty('--frot', L.rot + 'deg');
    slot.style.setProperty('--fs', L.scale);
  }
  // 单叠手牌的即时视图状态：side/类名/提示语/卡面内容一次算全（原 render 内联计算外提）
  function handGroupState(g, ctx) {
    const { infusingNow, infusing, pendingTarget, energy, busy, spellBonus, mode } = ctx;
    const uid = g.uids[0];
    const isSelf = infusingNow && g.self;
    const pickedN = infusingNow ? g.uids.filter(u => infusing.picked.includes(u)).length : 0;
    const targeted = !infusingNow && pendingTarget && pendingTarget.uid === uid;
    const effCost = effCostOf(g.card, uid);
    const blocked = infusingNow ? null : unplayableReason(g.card);   // 无法使用的卡：虚化禁用
    const rawSide = (!infusingNow && !blocked) ? targetSide(g.card) : null;
    // 2026-09-09 老板 #7：招式若无对敌方施加的效果，拖到敌我中间空地即可打出（side 'any'）
    const side = rawSide || (blocked || infusingNow ? null : 'any');
    let cls = '';
    if (infusingNow) cls = isSelf ? ' infuse-self' : (pickedN ? ' sel' : '');
    else if (blocked) cls = ' off';
    else if (targeted) cls = ' targeting';
    else if ((effCost > energy || busy)) cls = ' off';
    const costTip = effCost !== g.card.cost
      ? (effCost === 0 ? `（[[icon:bolt]] 当前按 0 费打出）` : `（[[icon:sparkles]] 费用变化：按 ${effCost} 费打出）`)
      : '';
    const ruleHint = cardRuleHint(g.card, mode);
    const tip = infusingNow
      ? (isSelf ? '正在注能的卡牌' : `点击选择消耗（注能）${g.uids.length > 1 ? `· 本叠还有 ${g.uids.length} 张` : ''}`)
      : blocked
        ? `[[icon:cross]] 无法打出：${blocked}`
        : infuseOf(g.card) > 0
        ? `费用 ${effCost}${costTip} · 点击进入注能（选 ${infuseOf(g.card)} 张手牌消耗强化打出），注能条内也可「不注能直接打出」${side === 'enemy' ? '或拖到敌人身上直打' : side === 'self' ? '或拖到左侧人物直打' : ''}（悬停看完整描述）`
        : side === 'enemy'
        ? `费用 ${effCost}${costTip} · 点击选中后点敌人，也可拖到敌人身上打出（悬停看完整描述）`
        : side === 'self'
          ? `费用 ${effCost}${costTip} · 点击选中后点自己，也可拖到左侧人物（悬停看完整描述）`
          : side === 'any'
            ? `费用 ${effCost}${costTip} · 点击直接打出，也可拖到战场空地（悬停看完整描述）`
            : `费用 ${effCost}${costTip} · 点击出牌（悬停看完整描述）`;
    const badge = side === 'enemy' ? '<span class="bt-tt">[[icon:swords]]</span>'
      : side === 'self' ? '<span class="bt-tt">[[icon:heart]]</span>'
        : side === 'any' ? '<span class="bt-tt">[[icon:sparkles]]</span>' : '';
    // 需求 #16：费用变动显示在卡牌左上角费用处——降低 = 绿字，提高 = 红字
    // （天狼长弓等「变为0费」的临时卡带 _baseCost：按原费用对比显示绿色 0）
    const baseCost = (g.card._baseCost != null) ? g.card._baseCost : g.card.cost;
    const costDiff = effCost !== baseCost;
    const costBadge = costDiff ? `<span class="bt-cost1 cost-mod ${effCost < baseCost ? 'mod-down' : 'mod-up'}" title="费用变化：按 ${effCost} 费打出（原 ${baseCost} 费）">[[icon:bolt]]${effCost}</span>` : '';
    // 09-20 老板定版：注能卡点卡面即进注能态；角标保留作可见性提示（同入口）
    const infN = infuseOf(g.card);
    const infChip = (!infusingNow && !blocked && infN > 0)
      ? `<button class="bt-infchip" data-act="btInfuseStart" data-uid="${uid}"
          title="注能(${infN})：选 ${infN} 张手牌消耗强化本牌；注能条内也可「不注能直接打出」">[[icon:crystal]] 注能${infN}</button>`
      : '';
    const cnt = g.uids.length > 1 ? `<span class="bt-count" title="同名卡 ${g.uids.length} 张堆叠为一叠">×${g.uids.length}</span>` : '';
    // 诅咒之刃（2026-09-10 需求）：卡面实时显示手牌招式（武术+法术）提供的全部诅咒
    // 09-20 老板：单个诅咒 chip 带 data-term，触摸弹 term-tips 讲解框（title 已被全局移除）
    const curseChip = (g.card.id === 'cc-cursed-blade' && typeof handCurseSpecs === 'function')
      ? (() => {
          const specs = handCurseSpecs();
          if (!specs.length) {
            return `<div class="bt-cursechips empty"><span class="bt-cursechip-i none">无诅咒</span></div>`;
          }
          const items = specs.map(s => {
            const meta = Combat.CURSE_META[s.key] || { name: s.key, icon: '', stack: false, desc: '' };
            return `<span class="bt-cursechip-i" data-term="${s.key}">${meta.icon}${meta.name}${meta.stack ? '×' + s.n : ''}</span>`;
          }).join('');
          return `<div class="bt-cursechips">${items}</div>`;
        })()
      : '';
    const inner = SDT.Cards.cardHTML(g.card, 'sm', {
        ...(costDiff ? { costOverride: { v: effCost, base: baseCost } } : {}),
        ...(spellBonus > 0 && g.card.dmgType === 'spell' && +(g.card.dmg || 0) > 0
          ? { dmgOverride: { bonus: spellBonus } } : {}),
      })
      + cnt + badge + costBadge + infChip + curseChip;
    return { g, uid, side, cls, tip, inner, ruleHint };
  }
  // 挂载：把手牌常驻层接回刚重建的舞台（占位节点 → 常驻节点）。
  // 战斗实例令牌变了 = 上一场战斗已收尾/新战斗开打：清掉旧槽位再开新局。
  // （不能用 isConnected 判定——showOverlay 整块重建 ovBody，常驻层每次挂载前都脱离文档）
  function mountHandLayer(body, tip, token) {
    const mount = body.querySelector('.sts-hud .sts-hand');
    if (!mount) return null;
    if (!handLayer) handLayer = document.createElement('div');
    handLayer.className = 'bt-hand sts-hand';
    if (token !== battleToken) {
      handSlots.forEach(rec => rec.slot.remove());
      handSlots.clear();
    }
    battleToken = token;
    handSuspended = false;
    // 2026-09-19 留言 #19/#7：不再挂原生 title（系统白底黑字提示框）——描述就在卡面上，
    // 黑框 tooltip（UI.showTooltip）也已全局停用
    mount.replaceWith(handLayer);
    return handLayer;
  }
  // 差分更新：新建/保留/移除槽位 + 目标扇形位补间 + 新牌飞入。返回动画时长供飘字延迟取用。
  function updateHand(snapshot, prev, pageGroups, events, extra) {
    if (!handLayer) return { flightMs: 0 };
    const readable = pageGroups.length <= 6 ? 'true' : 'false';
    if (handLayer.dataset.readable !== readable) handLayer.dataset.readable = readable;
    const evs = events || [];
    const drawn = new Set(), played = new Set();
    evs.forEach(ev => { if (ev.kind === 'draw') drawn.add(ev.uid); else if (ev.kind !== 'shuffle' && ev.kind !== 'surge') played.add(ev.uid); });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    const ctx = {
      infusingNow: !!snapshot.infusing, infusing: snapshot.infusing,
      pendingTarget: snapshot.pendingTarget, energy: snapshot.energy, busy: snapshot.busy,
      spellBonus: (extra && extra.spellBonus) || 0,
      mode: extra && extra.mode,
    };
    // 旧槽位现矩形一次量完：目标值更新引发的位移以此为准做补间
    handSlots.forEach(rec => { rec.rect = rec.slot.isConnected ? uiRect(rec.slot) : null; });   // 布局口径
    // —— 第一遍：算状态 / 更新目标值与内容 / 建缺失槽位 ——
    const ordered = [];
    pageGroups.forEach((g, i) => {
      const key = handSlotKey(g);
      const st = handGroupState(g, ctx);
      const L = fanLayout(i, pageGroups.length);
      let rec = handSlots.get(key);
      if (!(rec && rec.slot.isConnected)) {
        rec = { slot: document.createElement('div'), card: document.createElement('div'), sig: '', rect: null, isNew: true };
        rec.slot.className = 'bt-slot';
        rec.card.addEventListener('pointerdown', (e) => {
          // 注能角标是按钮，点击走 ovBody 委托，不进指向（需求 #15）
          if (e.target.closest && e.target.closest('.bt-infchip')) return;
          if (e.button === 0 && rec.card.dataset.aim === '1') startAim(e, rec.card);
        });
        // U8（2026-09-19 走查）：操作指引改 #tooltip 即时提示——原生 title 有 1s 延迟、
        // 移开即消、键盘拿不到；tooltip 常驻组件零延迟跟随。槽位常驻只绑一次。
        rec.card.addEventListener('mouseenter', (e) => {
          if (!rec.__tip) return;
          UI.showTooltip(e.clientX, e.clientY, rec.__name || '', [rec.__tip]);
        });
        rec.card.addEventListener('mouseleave', () => UI.hideTooltip());
        rec.card.addEventListener('keydown', (e) => {
          if ((e.key !== 'Enter' && e.key !== ' ') || e.target.closest('.bt-infchip')) return;
          e.preventDefault();
          selectCardByClick(rec.card.dataset.uid, true);
        });
        rec.slot.appendChild(rec.card);
        handSlots.set(key, rec);
      }
      setSlotVars(rec.slot, L);
      // 紧凑态恒挂（只露牌面+名字）；悬停弹出完整描述由 CSS :hover 驱动
      rec.card.className = 'bt-card compact' + st.cls
        + (st.side === 'enemy' || st.side === 'self' ? ' need-target' : '')
        + (st.side === 'any' ? ' free-drop' : '')
        + (clickSelectedUid === st.uid ? ' click-selected' : '');
      rec.card.dataset.uid = st.uid;
      rec.card.dataset.handIndex = String((i % HAND_PAGE_SIZE) + 1);
      rec.card.dataset.act = 'btPlay';
      rec.card.dataset.aim = st.side ? '1' : '';
      rec.card.dataset.side = st.side || '';
      rec.__tip = st.tip;
      rec.__name = `${g.card.name} · ${effCostOf(g.card, st.uid)} 费`;
      rec.card.setAttribute('role', 'button');
      rec.card.tabIndex = 0;
      rec.card.setAttribute('aria-label', `${rec.__name}。${st.ruleHint ? st.ruleHint + ' ' : ''}${st.tip || '按回车或空格选择这张牌'}`);
      rec.card.setAttribute('aria-disabled', st.cls.includes('off') ? 'true' : 'false');
      // U8：操作指引走 #tooltip（见槽位创建处的 mouseenter），原生 title 不再挂
      rec.card.removeAttribute('title');
      rec.card.setAttribute('aria-pressed', clickSelectedUid === st.uid ? 'true' : 'false');
      // 卡面外的角标（目标侧/费用变化/注能/诅咒）带 [[icon:]] 宏——写入时统一渲染，否则宏原文直接上屏
      const renderSig = `${st.inner}\u0000${st.ruleHint}`;
      if (rec.sig !== renderSig) {
        rec.card.innerHTML = SDT.Icons.rich(st.inner);
        const desc = rec.card.querySelector('.hsc-desc');
        if (desc && st.ruleHint) {
          const hint = document.createElement('span');
          hint.className = 'bt-rulehint';
          hint.textContent = st.ruleHint;
          desc.appendChild(hint);
        }
        rec.sig = renderSig;
      }
      ordered.push(rec);
    });
    // —— 顺序校正（DOM 序 = 扇形叠放序）：失序才搬节点 ——
    const current = [...handLayer.querySelectorAll('.bt-slot')];
    if (current.length !== ordered.length || current.some((el, i) => el !== ordered[i].slot)) {
      ordered.forEach(rec => handLayer.appendChild(rec.slot));
    }
    // —— 空手牌提示（原模板 N=0 分支的等价物） ——
    const emptyHint = handLayer.querySelector('.ov-empty');
    if (!ordered.length) {
      const msg = extra.mode === 'boss'
        ? ((snapshot.drawPile.length + snapshot.discard.length) ? '手牌打空了……下回合开始会再抽 1 张' : '牌库与弃牌堆都空了——只能结束回合硬抗，或撤退')
        : '没有能出的卡了……（打出过的卡本场不可再用）';
      const hint = emptyHint || handLayer.appendChild(Object.assign(document.createElement('p'), { className: 'ov-empty' }));
      if (hint.dataset.k !== msg) { hint.dataset.k = msg; hint.textContent = msg; }
    } else if (emptyHint) emptyHint.remove();
    // —— 第二遍：量新矩形，幸存者归位补间 + 新牌错峰飞入 ——
    const ov = UI.el.overlay;
    const ovR = uiRect(ov);   // 布局口径：飞入位移喂 transform
    let flightMs = 0;
    let drawIdx = 0;
    ordered.forEach(rec => {
      const r = uiRect(rec.slot);
      if (rec.isNew) {
        rec.isNew = false;
        if (drawn.has(rec.card.dataset.uid)) {
          // 发现选卡飞入起点：由壳（battle.view.js）经 extra.discoverSrcRect 传入，
          // 消费后的置空也归壳（render 里调用 updateHand 后统一 discoverSrcRect = null）
          const src = (prev && prev.drawPile) || extra.discoverSrcRect
            || { left: ovR.width - 150, top: ovR.height - 110, width: 56, height: 80 };
          const dx = src.left + src.width / 2 - (r.left + r.width / 2);
          const dy = src.top + src.height / 2 - (r.top + r.height / 2);
          animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.72)`, opacity: 0 },
            { transform: `translate(${dx * 0.18}px,${dy * 0.18}px) rotate(3deg) scale(1.04)`, opacity: 1, offset: 0.72 },
            { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
          ], { duration: 900, delay: drawIdx++ * 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards', composite: 'add' });
          flightMs = Math.max(flightMs, 900 + drawIdx * 300);
        }
      } else if (rec.rect) {
        const dx = rec.rect.left + rec.rect.width / 2 - (r.left + r.width / 2);
        const dy = rec.rect.top + rec.rect.height / 2 - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) >= 2) {
          animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px)` },
            { transform: 'translate(0px,0px)' },
          ], { duration: 210, easing: 'cubic-bezier(.22,.9,.3,1)', composite: 'add' });
        }
      }
      rec.rect = r;
    });
    // —— 移除：本轮不在手牌里的槽位离场（打出/弃置交给克隆飞行，其余下沉淡出） ——
    const keptKeys = new Set(pageGroups.map(handSlotKey));
    handSlots.forEach((rec, key) => {
      if (keptKeys.has(key)) return;
      handSlots.delete(key);
      if (played.has(rec.card.dataset.uid) || !rec.slot.isConnected) { rec.slot.remove(); return; }
      animateSafe(rec.slot, [
        { transform: 'translate(0px,0px)', opacity: 1 },
        { transform: 'translateY(46px)', opacity: 0 },
      ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => rec.slot.remove(), 240);
    });
    // 手牌重建后立即补解码（img 是 lazy）：衍生牌等未走开局预热的卡面防首帧黑窗；
    // 已解码图 decode() 立即兑现，重复调用无副作用。
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(handLayer);
    return { flightMs };
  }

  // ---------- 单位区常驻层（架构批次B：玩家/随从/敌人节点不随整屏重渲染重建） ----------
  // 模式照抄手牌常驻层：ovBody 每次渲染整块重建，单位节点由本模块持有、showOverlay
  // 之后 replaceWith/appendChild 挂回新舞台。立绘、血条、意图、状态角标都是常驻节点
  // 内的局部差分更新（按序列化签名 diff，内容没变不重写 innerHTML，图片不重载），
  // 受击抖动/死亡演出（CSS fx-die）/血条宽度过渡因此只播一次、不被重渲染腰斩。
  let selfUnit = null, selfParts = null, selfSig = null;
  const allySlots = new Map();   // key -> { slot, parts, sig }
  const foeSlots = new Map();    // key -> { slot, parts, sig }

  function mountUnitLayer(body, token) {
    const selfMount = body.querySelector('[data-unit-mount="self"]');
    const alliesMount = body.querySelector('[data-unit-mount="allies"]');
    const foesMount = body.querySelector('[data-unit-mount="foes"]');
    if (!selfMount || !alliesMount || !foesMount) return null;
    // 战斗实例令牌变了 = 上一场战斗已收尾：清掉旧槽位再开新局（口径同手牌层；
    // 不能用 isConnected 判定——ovBody 每次渲染整块重建，挂载前常驻节点必然脱离文档）
    if (selfUnit && token !== battleToken) {
      allySlots.forEach(rec => rec.slot.remove());
      foeSlots.forEach(rec => rec.slot.remove());
      allySlots.clear(); foeSlots.clear();
      selfUnit = null; selfParts = null; selfSig = null;
    }
    battleToken = token;
    if (!selfUnit) {
      selfUnit = document.createElement('div');
      selfUnit.className = 'sts-unit sts-me';
      selfUnit.id = 'btSelf';
      selfUnit.title = '你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出';
      selfUnit.addEventListener('click', (e) => {
        if (e.target.closest('.sts-equip')) return;
        const snap = getSnapshot();
        if (snap.pendingItem || snap.slamPending) return;
        clickSelectedTarget('self');
      });
      selfUnit.addEventListener('keydown', onTargetKeydown);
      selfParts = makeUnitSkeleton(selfUnit, { equips: true });
      selfSig = {};
    }
    selfMount.replaceWith(selfUnit);
    return { alliesMount, foesMount };
  }
  // 单位节点固定骨架：意图(敌) + 立绘 + 名牌(名号/血条/属性/状态角标/装备)，各段按签名差分
  function makeUnitSkeleton(slot, opts = {}) {
    const parts = {};
    if (opts.intent) {
      parts.intent = document.createElement('div');
      parts.intent.className = 'sts-intent';
      parts.intent.style.display = 'none';
      slot.appendChild(parts.intent);
    }
    parts.fig = document.createElement('div');
    parts.fig.className = 'sts-figure';
    slot.appendChild(parts.fig);
    const np = document.createElement('div');
    np.className = 'sts-nameplate';
    parts.head = document.createElement('div');
    parts.head.className = 'sts-headrow';   // 名行 flex 钩子（敌方名牌两行化，迭代评审 09-20）
    parts.hp = document.createElement('div');
    parts.hp.className = 'bt-hpwrap sts-hp';
    parts.hpGhost = document.createElement('i');   // STS2 式幽灵条：掉血时延迟收缩的黄尾
    parts.hpGhost.className = 'sts-hp-ghost';
    parts.hpBar = document.createElement('i');
    parts.hpBar.className = 'sts-hp-main';
    parts.hpTxt = document.createElement('span');
    parts.hp.appendChild(parts.hpGhost);
    parts.hp.appendChild(parts.hpBar);
    parts.hp.appendChild(parts.hpTxt);
    parts.stats = document.createElement('div');
    parts.stats.className = 'sts-stats';
    parts.chips = document.createElement('div');
    parts.chips.className = 'sts-chips';
    np.appendChild(parts.head); np.appendChild(parts.hp); np.appendChild(parts.stats); np.appendChild(parts.chips);
    if (opts.equips) {
      parts.equips = document.createElement('div');
      parts.equips.className = 'sts-equips';
      parts.equips.style.display = 'none';
      np.appendChild(parts.equips);
    }
    slot.appendChild(np);
    return parts;
  }
  // 差分工具：html 变了才重写 innerHTML
  function setSection(el, sig, key, html) {
    if (sig[key] === html) return;
    sig[key] = html;
    el.innerHTML = html;
  }
  // 血条局部更新：主条快速过渡；幽灵条走自身延迟过渡形成掉血拖尾（STS2 NHealthBar 口径）。
  // 首次填充禁用两条的过渡，避免从空/满状态滑到位
  function setUnitHP(parts, sig, hp, maxHp, instant) {
    const pct = Math.max(0, hp / maxHp * 100).toFixed(1) + '%';
    const txt = Math.max(0, hp) + '/' + maxHp;
    if (sig.hpPct !== pct) {
      sig.hpPct = pct;
      if (instant) {
        for (const bar of [parts.hpBar, parts.hpGhost]) {
          bar.style.transition = 'none';
          bar.style.width = pct;
          void bar.offsetWidth;
          bar.style.transition = '';
        }
      } else {
        parts.hpBar.style.width = pct;
        parts.hpGhost.style.width = pct;
      }
    }
    if (sig.hpTxt !== txt) { sig.hpTxt = txt; parts.hpTxt.textContent = txt; }
  }
  function updateUnits(mounts, snapshot, ctx) {
    updateSelfUnit(snapshot, ctx);
    updateAllies(mounts.alliesMount, snapshot.allies || []);
    updateFoes(mounts.foesMount, snapshot.foes || [], ctx);
  }
  function updateSelfUnit(snapshot, ctx) {
    const { player, pdef, pstat, equipped } = snapshot;
    const sig = selfSig;
    setSection(selfParts.fig, sig, 'fig',
      player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet'));
    setSection(selfParts.head, sig, 'head',
      `<b>${esc(characterName(player.characterId || player.myClass))}</b><span class="sts-you">你</span>`);
    setUnitHP(selfParts, sig, player.hp, player.maxHp, !sig.init);
    // 攻击力/法伤含加成显示（2026-09-09 留言 #2：人物图标下要能看到攻/法伤的变化）
    const atkBuff = pstat.status.atkUp || 0, spBuff = pstat.status.spellUp || 0;
    const atkShow = (player.atk || 0) + atkBuff;
    const atkTag = atkBuff ? `<span title="含攻击强化 +${atkBuff}">（含+${atkBuff}）</span>` : '';
    const spShow = (player.spellPower || 0) + spBuff;
    const spTag = spShow > 0
      ? ` · [[icon:crystal]] 法伤 ${spShow}${spBuff ? `<span title="含法术强化 +${spBuff}">（含+${spBuff}）</span>` : ''}` : '';
    setSection(selfParts.stats, sig, 'stats',
      `[[icon:swords]] ${atkShow}${atkTag}${spTag}${pdef.shield ? ' · [[icon:shield]] 盾 ' + pdef.shield : ''}${pdef.armor ? ' · [[icon:plate]] 甲 ' + pdef.armor : ''}${pdef.guard ? ' · 格挡中' : ''}`);
    setSection(selfParts.chips, sig, 'chips', curseChips(pstat.status));
    // 状态挂件（P2）：玩家自己被冰冻/灼烧时同样点亮常驻状态光
    selfUnit.classList.toggle('fx-frozen', (pstat.status.freeze || 0) > 0);
    selfUnit.classList.toggle('fx-burning', (pstat.status.burn || 0) > 0);
    const pendingCard = ctx.pendingTarget && findCard(ctx.pendingTarget.uid);
    const clickCard = clickSelectedUid != null && findCard(clickSelectedUid);
    setTargetable(selfUnit, !!((pendingCard && targetSide(pendingCard.card) === 'self') || (clickCard && targetSide(clickCard.card) === 'self')), '自己，按 Enter 确认目标');
    // 已穿戴装备（2026-09-09 老板 #9）：名称 + 说明 tooltip；带限定技能的可点击发动
    const equipsHTML = (equipped || []).map(e => e.skill
      ? `<button class="sts-equip has-skill${e.used ? ' used' : ''}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}"
          title="${escAttr(`【${e.name}】${e.desc}${e.used ? '（主动技能本场已用过）' : '——点击发动主动技能'}`)}">[[icon:tools]] ${esc(e.name)}${e.used ? '' : ' [[icon:bolt]]'}</button>`
      : `<span class="sts-equip" title="${escAttr(`【${e.name}】${e.desc}`)}">[[icon:tools]] ${esc(e.name)}</span>`).join('');
    setSection(selfParts.equips, sig, 'equips', equipsHTML);
    selfParts.equips.style.display = equipsHTML ? '' : 'none';
    sig.init = true;
  }
  // 随从位（Q4 老板定向：征召步兵等——替你承伤、每回合自动攻击）
  function updateAllies(mount, allies) {
    mount.style.display = allies.length ? '' : 'none';
    const ordered = [];
    const seen = {};
    allies.forEach((a, i) => {
      const base = a.name || ('ally' + i);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = allySlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-ally';
        slot.title = '你的随从：优先替你承受伤害，每回合自动攻击敌人';
        rec = { slot, parts: makeUnitSkeleton(slot), sig: {}, key };
        allySlots.set(key, rec);
      }
      rec.slot.classList.toggle('dead', !!a.dead);
      rec.slot.dataset.allyI = i;
      setSection(rec.parts.fig, rec.sig, 'fig', SDT.Icons.img('runner'));
      setSection(rec.parts.head, rec.sig, 'head', `<b>${esc(a.name)}</b>`);
      // 无攻血场面物件（封印肢体，同天国之门口径）：不显示血条与攻击力
      if (a.statless) {
        setSection(rec.parts.stats, rec.sig, 'stats', '');
      } else {
        setUnitHP(rec.parts, rec.sig, a.hp, a.maxHp, !rec.sig.init);
        setSection(rec.parts.stats, rec.sig, 'stats', `[[icon:swords]] ${a.atk}`);
      }
      setSection(rec.parts.chips, rec.sig, 'chips', '');
      rec.sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的随从 + 按数组序重排（appendChild 已连接节点只是搬移，不重建）
    const kept = new Set(ordered.map(r => r.key));
    allySlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); allySlots.delete(key); }
    });
    ordered.forEach(rec => mount.appendChild(rec.slot));
  }
  // 敌方单位（右下站立横排；意图气泡在头顶；词缀角标；免伤高亮）
  function updateFoes(mount, foes, ctx) {
    const ordered = [];
    const seen = {};
    foes.forEach((f, idx) => {
      const base = f.id || f.name || ('foe' + idx);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = foeSlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-foe bt-foe';
        rec = { slot, parts: makeUnitSkeleton(slot, { intent: true }), sig: {}, key };
        // 常驻节点只绑一次点击：砸击/药水点选（需求 #9 / 药水栏）——点击时读实时快照防闭包过期
        slot.addEventListener('click', () => {
          const snap = getSnapshot();
          if (snap.dartPending) {
            if (!slot.classList.contains('dead')) resolveDart(slot.dataset.eidx);
            return;
          }
          if (snap.slamPending) {
            if (!slot.classList.contains('dead')) resolveSlam(slot.dataset.eidx);
            return;
          }
          if (snap.pendingItem) {
            if (!slot.classList.contains('dead')) useItemCmd(snap.pendingItem.uid, slot.dataset.eidx);
            return;
          }
          if (!slot.classList.contains('dead')) clickSelectedTarget('enemy', +slot.dataset.eidx);
        });
        slot.addEventListener('keydown', onTargetKeydown);
        slot.addEventListener('mouseenter', () => {
          if (clickSelectedUid == null || slot.classList.contains('dead')) return;
          const entry = findCard(clickSelectedUid);
          if (entry && targetSide(entry.card) === 'enemy') showFoePreview(slot, +slot.dataset.eidx, clickSelectedUid, entry.card, 'click');
        });
        slot.addEventListener('mouseleave', () => { if (!slot.matches(':focus')) clearFoePreview(slot); });
        slot.addEventListener('focusin', () => {
          if (clickSelectedUid == null || slot.classList.contains('dead')) return;
          const entry = findCard(clickSelectedUid);
          if (entry && targetSide(entry.card) === 'enemy') showFoePreview(slot, +slot.dataset.eidx, clickSelectedUid, entry.card, 'click');
        });
        slot.addEventListener('focusout', () => { if (!slot.matches(':hover')) clearFoePreview(slot); });
        foeSlots.set(key, rec);
      }
      const slot = rec.slot, parts = rec.parts, sig = rec.sig;
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      slot.classList.toggle('is-boss', !!(ctx.isBoss || f.affix));
      slot.classList.toggle('dead', !!f.dead);
      slot.classList.toggle('bt-death-pending', !!f.deathFxPending);
      slot.classList.toggle('aegis', !!immune);
      const pendingCard = ctx.pendingTarget && findCard(ctx.pendingTarget.uid);
      const clickCard = clickSelectedUid != null && findCard(clickSelectedUid);
      const cardTargetsEnemy = !!((pendingCard && targetSide(pendingCard.card) === 'enemy') || (clickCard && targetSide(clickCard.card) === 'enemy'));
      setTargetable(slot, !!(cardTargetsEnemy || ctx.pendingItem || ctx.slamPending || ctx.dartPending) && !f.dead, `${f.name}，按 Enter 确认目标`);   // dartPending：血毒双镖二段点选也高亮（2026-09-17 留言）
      slot.dataset.foeId = f.id || f.name;
      slot.dataset.eidx = idx;
      slot.style.setProperty('--foe-idle-phase', `${-(idx * 0.61)}s`);
      slot.title = aff ? aff.name + '：' + aff.desc : '';
      // 残留的指向预览气泡清掉（常驻节点上它不会随重建消失）
      const fp = slot.querySelector('.bt-fpreview');
      if (fp) fp.remove();
      if (!f.dead && clickCard && targetSide(clickCard.card) === 'enemy' && slot.matches(':hover, :focus')) {
        showFoePreview(slot, idx, clickSelectedUid, clickCard.card, 'click');
      }
      // 冰冻敌人显示专用意图图标（2026-09-09 玩法定版）：冰冻中无法行动，
      // 用冰晶图标替换原攻击/蓄力预告，解冻后恢复正常意图显示
      const frozen = !f.dead && f.status && (f.status.freeze || 0) > 0;
      // 状态挂件（P2）：诅咒持续期间的常驻视觉——冰冻青晶边光 / 灼烧底部橙焰光
      slot.classList.toggle('fx-frozen', frozen);
      slot.classList.toggle('fx-burning', !f.dead && f.status && (f.status.burn || 0) > 0);
      const intents = frozen
        ? [{ icon: '[[icon:crystal]]', label: '冰冻·无法行动', damage: null, kind: 'frozen' }]
        : intentViewModel(f.intent);
      // 迭代评审 09-20：意图详情并入气泡常驻文本（原生 title 已随手牌侧停用，交互口径统一）；
      // 实算伤害外带窄位流血角标「流血 N 层」；气泡允许两行折行（battle.css .sts-intent）
      if (!f.dead && intents.length) {
        setSection(parts.intent, sig, 'intent',
          intents.map(intent => `${intent.icon} ${esc(intent.label)}${intent.damage == null ? '' : ` · ${intent.damage}${intent.hits > 1 ? ` ×${intent.hits}（共${intent.totalDamage}）` : ''}`}${intent.bleedBonus ? ` · [[icon:blood]]流血 ${intent.bleedBonus} 层` : ''}`).join(' '));
        parts.intent.style.display = '';
      } else parts.intent.style.display = 'none';
      setSection(parts.fig, sig, 'fig', f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime'));
      // 敌方名牌两行化（迭代评审 09-20 美术岗）：名行右侧收敛攻击小徽（狂乱 ×2 并入），
      // stats 行仅剩免伤提示（庇幕高亮本就有 aegis 类）；玩家名牌三行维持——equips 是老板定版技能按钮
      setSection(parts.head, sig, 'head',
        `<b>${esc(f.name)}</b>${f.dead ? ' <span class="bt-deadmark">[[icon:cross]]</span>' : ''}` +
        `<span class="sts-atkbadge"${f.affix === 'frenzy' ? ' data-term="frenzy"' : ''}>[[icon:swords]] ${f.atk}${f.affix === 'frenzy' ? '×2' : ''}</span>` +
        (aff ? `<span class="bt-affix" data-term="${f.affix}">${aff.icon} ${aff.name}</span>` : ''));
      setUnitHP(parts, sig, f.hp, f.maxHp, !sig.init);
      setSection(parts.stats, sig, 'stats', immune ? '[[icon:crystal]] 庇幕免伤中' : '');
      setSection(parts.chips, sig, 'chips', curseChips(f.status, { compact: true }));
      sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的敌人 + 按数组序重排
    const kept = new Set(ordered.map(r => r.key));
    foeSlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); foeSlots.delete(key); }
    });
    ordered.forEach(rec => mount.appendChild(rec.slot));
  }

function setHandSuspended(v) { handSuspended = v; }   // 壳 render 分派改经 setter（ESM 导入绑定不可赋值，2026-09-22 批5 理顺点）
export { handLayer, handSuspended, battleToken, mountHandLayer, updateHand, mountUnitLayer, updateUnits, setHandSuspended, HAND_PAGE_SIZE };
