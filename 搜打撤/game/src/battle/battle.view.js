/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

import { sdtDefine } from '../core/sdt-facade.js';
import { rect as uiRect } from '../ui/ui-scale.js';
import { esc } from '../core/shared.js';
import { escAttr } from '../core/shared.js';
import { Random } from '../core/random.js';
import { groupHandCards } from './battle.hand.js';
import { getPace, setPace } from './battle.pace.js';
import { schedulePresentationMs } from './battle.clock.js';
import { renderCombatPiles } from './battle.piles.view.js';
import { attach as attachUnitFrames, hide as hideUnitFrames, cacheStats as frameCacheStats } from './battle.frames.js';
import { BattleSession, commands, configureBattleRenderer, getSnapshot, R, effCostOf, findCard, markDreadShown, pileTip, refillDrawPile, takeCardAnims, unplayableReason, matchHandSelectKey } from './battle.core.js';
import { renderDeckSelection, renderGrave, renderBattleBag, renderDeckPileView } from './battle.overlays.js';
import { mountHandLayer, updateHand, mountUnitLayer, updateUnits, setHandSuspended, HAND_PAGE_SIZE } from './battle.layers.js';
import { spawnFloats } from './battle.vfx.js';
import { captureBattleView, animateBattleTransition } from './battle.anim.js';
import { aim, aimPlayedAt, selectCardByClick, showCardBlockReason, startAim, cancelAim, canPreserveAim, resumeAimAfterRender, setClickSelectedUid } from './battle.aim.js';

/* battle.view.js —— 战斗渲染：战场 DOM/手牌/指向施法箭头/拖拽预览 */
  const play = commands.playCard;
  const playDirect = commands.playDirect;       // 09-20：注能条「不注能直接打出」
  const cancelInfuse = commands.cancelInfusion;
  const confirmInfuse = commands.confirmInfusion;
  const beginInfuse = commands.beginInfusion;   // 需求 #15：卡面「注能」角标入口
  const bagSlam = commands.bagSlam;             // 需求 #9：背包砸击
  const endTurn = commands.endTurn;
  const surrender = commands.surrender;   // 玩法定版：主动撤离视为本局失败
  const openGrave = commands.openGrave;
  const openDeckView = commands.openDeckView;
  const closeDeckView = commands.closeDeckView;
  const openBagCmd = commands.openBag;
  const cancelPendingTarget = commands.cancelPendingTarget;
  const pickDiscover = commands.pickDiscover;
  const pickChoice = commands.pickChoice;
  const toggleInfusePick = commands.selectInfusion;
  const pickHandSelect = commands.pickHandSelect;
  const skipHandSelect = commands.skipHandSelect;
  const usePotion = commands.usePotion;
  const useEquipSkill = commands.useEquipSkill;
  // 双击放大已退役（2026-09-12 老板定向：紧凑手牌 + 单击展开完整卡面取代）

  // ---------- 渲染 ----------
  // 手牌分栏（2026-09-10 留言 #27）：一栏最多 12 叠，放不下的进第二栏，用按钮切换
  // 2026-09-12 紧凑手牌：卡变窄后一栏放宽到 16 叠（分栏按钮大概率不再出现）
  let handPage = 0;
  // HAND_PAGE_SIZE 已随 updateHand 迁往 battle.layers.js（壳经 import 引入——批5）
  // 紧凑手牌（2026-09-12 老板二次定向）：常态只露牌面+名字，**悬停**弹出完整描述，
  // 点击保持直接出牌/选目标——弹出纯 CSS :hover 驱动，不走 JS 状态
  // 发现选卡的飞入起点（2026-09-10 留言 #36）：发现浮层会整块替换战斗视图，抽卡动画取样不到
  // 旧手牌位——点中候选卡的瞬间记下它的屏幕矩形，让新卡从「被选中的那张卡」飞回手牌
  let discoverSrcRect = null;

  function combatStateCopy(snapshot) {
    const { phase = 'player', energy = 0, hand = [], infusing, choosing, handSelecting,
      pendingTarget, pendingItem, slamPending, dartPending, busy } = snapshot;
    if (phase === 'enemy') return { label: '敌方行动', detail: '敌人正在行动，准备迎接下一轮攻势。', tone: 'foe' };
    if (busy || phase === 'resolving') return { label: '结算中', detail: '当前动作正在结算，命中反馈结束后可继续操作。', tone: 'focus' };
    if (infusing) return { label: '注能中', detail: '选择手牌作为燃料，或点“取消注能”返回。', tone: 'focus' };
    if (choosing || handSelecting) return { label: '选择中', detail: '完成当前选择后才能继续行动。', tone: 'focus' };
    if (pendingTarget || pendingItem || slamPending || dartPending) return { label: '选择目标', detail: '点击目标确认，按 Esc 取消；砸击或药水也可再次点击取消。', tone: 'focus' };
    // Resolve UID entries exactly as the hand renderer does, including per-card cost overrides.
    const handCards = hand.map(entry => entry && typeof entry === 'object' ? entry : findCard(entry)).filter(Boolean);
    const playable = handCards.some(entry => {
      if (unplayableReason(entry.card)) return false;
      return effCostOf(entry.card, entry.uid) <= energy;
    });
    if (playable) return { label: '你的行动', detail: '点选手牌后点击目标 · 支持拖拽 · 1–9 选牌 · 方向键切换目标 · Esc 取消', tone: 'self' };
    if (energy > 0) return { label: '你的行动', detail: '当前没有可用卡牌，可以检查手牌或结束回合。', tone: 'warn' };
    return { label: '你的行动', detail: '能量已耗尽，结束回合让敌人行动。', tone: 'warn' };
  }

  // 对战开始时效果卡牌浮现 2 秒（2026-09-16 老板：含对战开始时效果的卡牌在对战开始时在中心浮现卡牌外观然后消失）
  let flashedBattleToken = null;
  function showBattleStartEquipFlash(equippedList, battleToken) {
    if (flashedBattleToken === battleToken || !equippedList || !equippedList.length) return;
    const cards = equippedList.filter(e => e.card && /对战开始时/.test(String(e.card.desc || '')));
    if (!cards.length) return;
    flashedBattleToken = battleToken;
    const container = document.createElement('div');
    container.className = 'bt-start-equip-flash';
    container.innerHTML = cards.map(e => {
      const wrap = document.createElement('div');
      wrap.className = 'bt-start-equip-card';
      wrap.innerHTML = SDT.Cards.cardHTML(e.card, 'sm');
      const label = document.createElement('span');
      label.className = 'bt-start-equip-label';
      label.textContent = e.card.name;
      wrap.appendChild(label);
      return wrap.outerHTML;
    }).join('');
    document.body.appendChild(container);
    schedulePresentationMs(() => { container.classList.add('fade-out'); }, 2000);
    schedulePresentationMs(() => { container.remove(); }, 2600);
  }
  // 只在同一场战斗的主舞台仍在屏幕上时复用外壳。弹层/设置页会通过
  // showOverlay 更新模式、焦点和遮罩；从它们返回时必须重新走该入口。
  function syncBattleSlot(stage, previous, next, selector, before) {
    const oldNode = previous.querySelector(selector);
    const nextNode = next.querySelector(selector);
    if ((oldNode?.outerHTML || '') === (nextNode?.outerHTML || '')) return;
    const liveNode = stage.querySelector(selector);
    if (!nextNode) { liveNode?.remove(); return; }
    const replacement = nextNode.cloneNode(true);
    if (liveNode) liveNode.replaceWith(replacement);
    else stage.querySelector(before).before(replacement);
  }
  function showBattleStage(html, token) {
    const body = UI.el.ovBody;
    const stage = body.firstElementChild;
    const canReuse = !UI.el.overlay.hidden && UI._lastMode === 'battle'
      && stage?.matches('.battle-stage.sts') && stage._battleToken === token
      && stage._battleTemplate && stage.isConnected;
    if (!canReuse) {
      UI.showOverlay('', html, 'battle');
      const fresh = body.firstElementChild;
      fresh._battleToken = token;
      fresh._battleTemplate = fresh.cloneNode(true);
      return;
    }
    const template = document.createElement('template');
    template.innerHTML = SDT.Icons.rich(html);
    const next = template.content.firstElementChild;
    const previous = stage._battleTemplate;
    // 战场皮肤属于场次；异常切换时回到 showOverlay，保证背景与模式标志同步。
    if (stage.dataset.assetKey !== next.dataset.assetKey || stage.dataset.boss !== next.dataset.boss) {
      UI.showOverlay('', html, 'battle');
      const fresh = body.firstElementChild;
      fresh._battleToken = token;
      fresh._battleTemplate = fresh.cloneNode(true);
      return;
    }
    if (stage.dataset.phase !== next.dataset.phase) {
      stage.classList.remove(`phase-${stage.dataset.phase}`);
      stage.classList.add(`phase-${next.dataset.phase}`);
      stage.dataset.phase = next.dataset.phase;
    }
    // 模板之间比较，避免把动画临时加的类（牌堆脉冲、受击等）当成状态变化。
    // 单位、装备与手牌由 battle.layers 的差分层维护，绝不替换其挂载点。
    syncBattleSlot(stage, previous, next, ':scope > .bt-potions', '.sts-topbar');
    syncBattleSlot(stage, previous, next, '.sts-encounter');
    syncBattleSlot(stage, previous, next, '.sts-hud-l');
    syncBattleSlot(stage, previous, next, '.sts-hud-r');
    syncBattleSlot(stage, previous, next, '.sts-arena-caption');
    syncBattleSlot(stage, previous, next, ':scope > .bt-infuse:not(.bt-pick)', ':scope > .bt-infuse.bt-pick, .sts-hud');
    syncBattleSlot(stage, previous, next, ':scope > .bt-infuse.bt-pick', '.sts-hud');
    syncBattleSlot(stage, previous, next, '.sts-energy-wrap');
    syncBattleSlot(stage, previous, next, '.bt-hand-page', '.bt-slam-btn');
    syncBattleSlot(stage, previous, next, '.bt-slam-btn');
    syncBattleSlot(stage, previous, next, '.sts-tactics');
    stage._battleTemplate = next;
  }
  function render(snapshot = getSnapshot()) {
    const prevView = captureBattleView();   // 重建前的手牌/牌堆位：供飞行与归位动画取样
    const preserveAim = !!aim && canPreserveAim(snapshot);
    if (snapshot.phase !== 'player' || snapshot.busy || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending) setClickSelectedUid(null);
    const {
      mode, turn, energy, maxEnergy, busy, phase = 'player', opts, player, pstat,
      foes, hand, drawPile, discard, grave, infusing, discovering, handSelecting, choosing,
      pendingTarget, viewingGrave, viewingBag, dreadShown, deckSelection,
      potionBar, pendingItem, slamPending, dartPending, viewingDeck,
    } = snapshot;
    if (aim && !preserveAim) cancelAim();
    UI.hideTooltip();   // U8：重渲染摘换手牌节点时 mouseleave 不触发，防 tooltip 残留
    // 战斗中弹层接管（墓地/背包/抉择/选牌/发现）：序列帧层挂在 overlay 直下不随 ovBody
    // 销毁，不藏会浮在弹层之上（09-12 实机：背包弹层上残留玩家序列帧立绘）——
    // 卸下 sprite 恢复静态立绘，关闭弹层走主渲染 attach 自动恢复
    if (viewingGrave || viewingBag || choosing || handSelecting || discovering) hideUnitFrames();
    if (deckSelection) { setHandSuspended(false); renderDeckSelection(snapshot); return; }   // 战前编组：允许下次挂载时重置手牌层
    if (viewingGrave) { setHandSuspended(true); renderGrave(snapshot); return; }
    if (viewingDeck) { setHandSuspended(true); renderDeckPileView(snapshot); return; }
    if (viewingBag) { setHandSuspended(true); renderBattleBag(snapshot); return; }
    if (choosing) {
      setHandSuspended(true);   // 抉择/选牌/发现都是战斗中弹层：手牌层摘下挂起，回来继续用
      // 2026-09-08 抉择面板：人工 N 选一（复用发现面板的弹层交互）
      const choiceHTML = choosing.options.map((text, i) => `
        <button class="ov-btn choice-opt" data-act="btChoicePick" data-i="${i}">
          [[icon:question]] ${esc(text)}
        </button>`).join('');
      UI.showOverlay(`${opts && opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 抉择`, `
        <p class="ov-stats">【${esc(choosing.cardName)}】——从 <b>${choosing.options.length}</b> 个选项中选择 <b>1</b> 项，只有选中项结算</p>
        <div class="ov-btns choice-list">${choiceHTML}</div>`, 'discover');
      UI.act('btChoicePick', (d) => pickChoice(d.i));
      UI.refresh(SDT.game);
      return;
    }
    if (handSelecting) {
      setHandSuspended(true);
      // 2026-09-06 #24/#25：从手牌选择卡牌施放/消耗的通用弹层
      const isPayment = handSelecting.act === 'payment';
      const unavailable = isPayment
        ? new Set([...(handSelecting.excludedUids || []), ...(handSelecting.selectedUids || [])])
        : null;
      const pool = hand.map(findCard).filter(o => o && matchHandSelectKey(o.card, handSelecting.type)
        && (!unavailable || !unavailable.has(o.uid)));
      const optsHTML = pool.map(o => `
        <div class="bt-card" data-act="btPickHand" data-uid="${o.uid}" title="点击选择">
          ${SDT.Cards.cardHTML(o.card, 'sm')}
        </div>`).join('');
      const paymentName = handSelecting.payment?.card?.name;
      const paymentLabel = isPayment
        ? `支付代价${paymentName ? `：为【${esc(paymentName)}】选择` : ''}`
        : '选择手牌';
      const paymentNote = isPayment
        ? '<p class="ov-note">已选手牌和本次牌/燃料不在候选池中；选取后会作为支付代价消耗。</p>'
        : '<p class="ov-note">必须选满燃料后才会发动。</p>';
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:cards]] ${paymentLabel}`, `
        <p class="ov-stats">${isPayment ? '还需支付：' : '从手牌中选择 '}<b>${handSelecting.n}</b> 张${handSelecting.type ? `<b>${handSelecting.type}</b>` : '卡牌'}${handSelecting.act === 'play' ? '打出（不扣费）' : isPayment ? '作为支付代价' : '消耗'}</p>
        <div class="bt-hand">${optsHTML || '<p class="ov-empty">手牌中没有符合条件的卡牌</p>'}</div>
        ${handSelecting.mandatory ? paymentNote : '<p class="ov-note"><button class="ov-btn ghost" data-act="btPickHandSkip">跳过该效果</button></p>'}`, 'discover');
      UI.act('btPickHand', (d) => pickHandSelect(d.uid));
      if (!handSelecting.mandatory) UI.act('btPickHandSkip', () => skipHandSelect());
      UI.refresh(SDT.game);
      return;
    }
    if (discovering) {
      setHandSuspended(true);
      const optsHTML = discovering.options.map((c, i) => `
        <div class="bt-card" data-act="btDiscover" data-i="${i}" title="${escAttr(`${c.name}${c.desc ? '：' + c.desc : ''}——点击置入手牌`)}">
          ${SDT.Cards.cardHTML(c, 'sm')}
        </div>`).join('');
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 发现`, `
        <p class="ov-stats">选 <b>1</b> 张置入手牌 · 战后消散</p>
        <div class="bt-hand">${optsHTML}</div>`, 'discover');
      UI.act('btDiscover', (d) => {
        const el = document.querySelector(`.bt-card[data-act="btDiscover"][data-i="${d.i}"]`);
        if (el) { discoverSrcRect = uiRect(el); }   // 布局口径：消费端喂 transform
        pickDiscover(d.i);
      });
      UI.refresh(SDT.game);
      return;
    }
    const cards = hand.map(findCard).filter(Boolean);
    const infusingNow = !!infusing;
    // —— 法伤加成同步（2026-09-09 需求）：有法伤加成时，造成法术伤害的招式卡面
    // 数值实时显示为「卡面值 + 法伤加成」，数字略微放大（口径同 combat.dealDamage）
    const spellBonus = (player.spellPower || 0) + ((pstat.status && pstat.status.spellUp) || 0);
    // —— 同名卡堆叠（v0.32 杀戮尖塔式手牌）：同名同描述的卡只占一个位置，显示 ×N ——
    // 注能中：注能主卡单独一块展示，其同名燃料照常成组（点击组 = 消耗组内一张）
    const groups = groupHandCards(cards, infusingNow ? infusing : null);
    const N = groups.length;
    // 分栏切页：只渲染当前栏的 12 叠，扇形布局按本栏实际张数计算
    const handPages = Math.max(1, Math.ceil(N / HAND_PAGE_SIZE));
    if (handPage >= handPages) handPage = handPages - 1;
    if (handPage < 0) handPage = 0;
    const pageGroups = groups.slice(handPage * HAND_PAGE_SIZE, handPage * HAND_PAGE_SIZE + HAND_PAGE_SIZE);
    // 手牌 DOM 由常驻层差分维护（见 mountHandLayer / updateHand）：这里只算分组与目标扇形位，
    // 不再拼整段手牌 HTML（批次A 架构对齐：手牌区不随整屏重渲染重建）
    const pileView = renderCombatPiles({
      mode,
      drawCount: drawPile,
      discardCount: discard,
      graveCount: grave,
      pileTip,
      cardBackHTML: SDT.Cards.cardBackHTML(),
      escAttr,
    });
    const drawPileHTML = pileView.draw;
    const pilesHTML = pileView.rest;
    const tip = mode === 'boss'
      ? `开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 弃牌堆抽空后自动洗回 · 墓地（被消耗的牌）不洗回`
      : '普通战斗无需抽牌 ·「抽 N 张牌」效果改为获得 N 张初始攻击 · 指向卡可点击选中后再点目标，也可直接拖拽（[[icon:swords]]敌人 · [[icon:heart]]自己）；无对敌效果的招式点击即可打出';
    const infuseBar = infusingNow ? `
      <div class="bt-infuse">
        [[icon:flask]] <b>注能(${infusing.need})</b>：选择 <b>${infusing.need}</b> 张手牌消耗，才能打出【${esc(infusing.card.name)}】
        （已选 <b>${infusing.picked.length}/${infusing.need}</b> · 同名堆叠每点一次消耗一张 · 被消耗的牌战后进消耗口袋，可在火堆复原）
        <button class="mini-btn" data-act="btInfuseDirect" data-uid="${infusing.uid}">不注能直接打出</button>
        <button class="mini-btn ok" data-act="btInfuseGo" ${infusing.picked.length !== infusing.need ? 'disabled' : ''}>[[icon:swords]] 发动</button>
        <button class="mini-btn" data-act="btInfuseCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // 药水栏点选提示条（点敌人使用 / 取消）
    const itemBar = pendingItem ? `
      <div class="bt-infuse bt-pick">
        [[icon:flask]] 已选【<b>${esc(pendingItem.card.name)}</b>】——<b>点击一名敌人</b>使用（或直接拖到敌人身上）
        <button class="mini-btn" data-act="btPickCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // —— 道具栏（2026-09-12 老板定向）：战斗界面上方常驻，点击使用 / 拖到敌人身上 ——
    // 2026-09-09 玩法定版：BOSS 战没有道具栏（背包里的道具无法使用）
    // 09-20 P1-7：空道具时整栏隐藏——顶部不再常驻「背包里没有道具」占位
    // 09-20 老板：药水说明不再挂系统 title（悬停延迟且触屏无效），改为自绘文字栏——
    // 悬停 / 按下药水时在药水栏正下方弹出（data-potion-idx 对应 potions 数组下标）
    const potions = potionBar || [];
    const showItemBar = mode !== 'boss' && potions.length > 0;
    const potionsHTML = showItemBar ? `
      <div class="bt-potions">
        <span class="bt-potions-label">[[icon:flask]] 道具</span>
        ${potions.length ? potions.map((p, pi) => p.usable === false
          ? `<div class="bt-potion off" data-potion-idx="${pi}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`
          : `<div class="bt-potion${p.aim === 'enemy' ? ' need-target' : ''}" data-act="btPotion" data-uid="${p.uid}"
              ${p.aim === 'enemy' ? 'data-potion-aim="1"' : ''}
              data-potion-idx="${pi}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`).join('')
          : '<span class="bt-potions-empty">背包里没有道具</span>'}
        <div class="bt-potion-tip" data-potion-tip hidden></div>
      </div>` : '';
    const battleAssetKey = opts.isBoss
      ? ({ boss_general: 'battle-boss-general', boss_orc: 'battle-boss-orc', boss_elem: 'battle-boss-element' }[foes[0] && foes[0].id] || 'battle-boss-general')
      : 'battle-normal';
    const combatState = combatStateCopy(snapshot);
    // 战斗标题文字去掉（2026-09-13 留言）
    showBattleStage(`
      <div class="battle-stage sts phase-${escAttr(phase)}" data-phase="${escAttr(phase)}" data-asset-key="${battleAssetKey}" data-boss="${opts.isBoss ? '1' : '0'}">
      <div class="battle-stage-shade"></div>
      ${potionsHTML}
      <div class="sts-topbar">
        <div class="sts-encounter">
          <span class="sts-encounter-kicker">${opts.isBoss ? '冬核深处 · 首脑遭遇' : '冬境街区 · 遭遇'}</span>
          <b>第 ${turn} 回合</b><span class="sts-phase-dot ${escAttr(combatState.tone)}"></span><span>${esc(combatState.label)}</span>
        </div>
        <div class="sts-hud-l">
          ${drawPileHTML}
        </div>
        <div class="sts-hud-r">
          ${pilesHTML}
        </div>
      </div>
      <div class="sts-arena">
        <div class="sts-arena-caption" aria-live="polite"><b>${esc(combatState.label)}</b><span>${esc(combatState.detail)}</span></div>
        <div data-unit-mount="self"></div>
        <div class="sts-allies" data-unit-mount="allies"></div>
        <div class="sts-foes" data-unit-mount="foes"></div>
      </div>
      ${infuseBar}
      ${itemBar}
      <div class="sts-hud">
        <div class="sts-energy-wrap">
          <div class="sts-energy" title="能量：每回合固定 ${maxEnergy} 费">[[icon:bolt]] <b>${energy}</b><span>/${maxEnergy}</span></div>
        </div>
        ${handPages > 1 ? `<button class="bt-hand-page has-more" data-act="btHandPage" aria-label="还有另一栏手牌，当前第 ${handPage + 1} 栏，共 ${handPages} 栏"
          title="手牌分栏：每栏最多 ${HAND_PAGE_SIZE} 叠，放不下的进第二栏——点击切换第一栏/第二栏">[[icon:cards]] 第 ${handPage + 1}/${handPages} 栏</button>` : ''}
        <button class="bt-slam-btn${slamPending ? ' active' : ''}" data-act="btSlam"
          ${busy || infusingNow || (energy < 2 && !slamPending) ? 'disabled' : ''}
          title="背包砸击：2 费 · 4 点固定伤害 · 按住拖到敌人身上松手直接释放，也可点击后再点敌人">[[icon:bag]] 砸击</button>
        <div class="bt-hand sts-hand"></div>
        <div class="sts-tactics" aria-label="战术操作">
          <div class="sts-tactics-secondary">
            <button class="ov-btn ghost${mode === 'boss' ? ' dis' : ''}" data-act="btBag" ${busy || infusingNow ? 'disabled' : ''}
              ${mode === 'boss' ? 'title="BOSS 战为牌库制：道具与资源不参战，背包不可打开"' : 'title="打开战斗背包（B）"'}>[[icon:bag]] 背包</button>
            <button class="ov-btn ghost${mode === 'boss' ? ' dis' : ''}" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}
              ${mode === 'boss' ? 'title="BOSS 战不可撤离——击败首脑或战败即终局"' : 'title="撤离将视为本局失败（安全格中的卡牌会抢运回基地，其余丢失）"'}>[[icon:runner]] 撤离（判负）</button>
            <button class="ov-btn ghost" data-act="btSettings" title="战斗设置（音频 / 震动）">[[icon:gear]] 设置</button>
          </div>
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'} sts-end-turn" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>[[icon:skip]] 结束回合</button>
        </div>
       </div>`, snapshot.battleToken);
    const caption = UI.el.ovBody.querySelector('.sts-arena-caption span');
    if (caption) caption.dataset.battleDetail = combatState.detail;
    // 手牌分栏切换（2026-09-10 留言 #27）
    UI.act('btHandPage', () => { handPage = (handPage + 1) % handPages; render(); });
    // sts-note 底部说明行已删（留言 2026-09-06：把下面的文字都去掉）
    UI.act('btPlay', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 指向松手刚打出，忽略残留 click
      if (infusingNow) return toggleInfusePick(d.uid);
      const el = [...document.querySelectorAll('.sts-hand .bt-card')].find(x => x.dataset.uid === d.uid);
      // 指向性卡支持点击选中，再点击目标；无目标卡保持点击即出牌。
      if (el && el.dataset.aim && el.dataset.side !== 'any') return selectCardByClick(d.uid);
      showCardBlockReason(d.uid);
      play(d.uid);
    });
    UI.act('btEnd', endTurn);
    // 战斗设置（2026-09-13 留言：战斗界面保留设置键）——轻量浮层，不动 game.state，
    // 关闭直接重渲染战斗（openSettings 全功能版会清 overlay 导致战斗界面丢失）
    UI.act('btSettings', () => {
      UI.showOverlay('[[icon:gear]] 战斗设置', `
        <div class="bt-settings">
          <label class="chk"><input type="checkbox" id="btSetMusic" ${SDT.Sound.musicMuted ? '' : 'checked'}> 背景音乐</label>
          <label class="chk"><input type="checkbox" id="btSetSfx" ${SDT.Sound.sfxMuted ? '' : 'checked'}> 音效</label>
          <label class="chk"><input type="checkbox" id="btSetShake" ${localStorage.getItem('sdt-reduce-shake') === '1' ? '' : 'checked'}> 屏幕震动反馈</label>
          <label class="chk"><input type="checkbox" id="btSetPace" ${getPace() === 2 ? 'checked' : ''}> 2× 战斗节奏（敌方行动加速）</label>
          <p class="ov-note">完整设置可在基地 / 标题页打开。关闭后回到战斗。</p>
          <div class="ov-btns"><button class="ov-btn ok" data-act="btSettingsBack">[[icon:cross]] 返回战斗</button></div>
        </div>`, true);
      // 迭代评审 09-20：删除无参 setDucked()——它被 setDucked 内部 !!v 强转成 false，
      // 战斗中关音乐会静默解除侧链压低；setMusicMuted 内部已走 syncBgm，无需额外调用
      const syncMusic = (on) => { SDT.Sound.setMusicMuted(!on); };
      document.getElementById('btSetMusic').addEventListener('change', (e) => syncMusic(e.target.checked));
      document.getElementById('btSetSfx').addEventListener('change', (e) => { SDT.Sound.setSfxMuted(!e.target.checked); });
      document.getElementById('btSetShake').addEventListener('change', (e) => { localStorage.setItem('sdt-reduce-shake', e.target.checked ? '0' : '1'); });
      // 2× 演示倍率（迭代评审 09-20）：单一倍率同步缩放步进/序列帧/前摇/飘字四处时长（battle.pace.js）
      document.getElementById('btSetPace').addEventListener('change', (e) => { setPace(e.target.checked ? 2 : 1); });
      UI.act('btSettingsBack', () => render());
    });
    // U4（2026-09-19 走查）：BOSS 态两钮不再 disabled——点了给 log+音效说明原因，
    // 不再让玩家对着灰按钮悬停猜（dis 类保留禁用观感，但可接收点击）。
    UI.act('btFlee', () => {
      if (getSnapshot().opts.isBoss) {
        UI.log('[[icon:lock]] BOSS 战不可撤离——击败首脑或战败即终局', 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      // 撤离=判负不可逆：两步确认防误触（同设置弹窗危险钮模式，2.6 秒后自动还原）
      const btn = document.querySelector('#ovBody [data-act="btFlee"]');
      if (!btn || btn.dataset.confirm) { surrender(); return; }   // 玩法定版：主动撤离=本局失败（烟雾弹走 fleeBattle 豁免）
      const prev = btn.innerHTML;
      btn.dataset.confirm = '1';
      btn.innerHTML = SDT.Icons.rich('[[icon:runner]] 确认撤离？');
      btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.classList.remove('arm'); btn.innerHTML = prev; }
      }, 2600);
    });
    UI.act('btGrave', openGrave);
    UI.act('btDeck', openDeckView);
    UI.act('btDeckBack', closeDeckView);
    UI.act('btBag', () => {
      if (getSnapshot().opts.isBoss) {
        UI.log('[[icon:lock]] BOSS 战为牌库制：道具与资源不参战，背包不可打开', 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      openBagCmd();
    });
    UI.act('btSlam', () => {
      if (Date.now() - aimPlayedAt < 300) return;   // 拖拽松手刚砸完，忽略残留 click（同药水栏口径）
      bagSlam();
    });   // 背包砸击按钮（2026-09-16 老板：改回按钮形态，置于手牌左侧）；09-20 老板：支持按住拖到敌人身上松手释放
    UI.act('btInfuseStart', (d) => beginInfuse(d.uid));   // 需求 #15：卡面注能角标
    UI.act('btInfuseDirect', (d) => playDirect(d.uid));   // 09-20 老板定版：注能条内不注能直打
    UI.act('btInfuseGo', confirmInfuse);
    UI.act('btInfuseCancel', cancelInfuse);
    UI.act('btPickCancel', cancelPendingTarget);
    UI.act('btEquipSkill', (d) => useEquipSkill(d.uid));   // 已穿戴装备的限定技能（老板 #9）
    // —— 药水栏（2026-09-12 老板定向）：点击使用；敌方指向药水按住可拖到敌人身上 ——
    UI.act('btPotion', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 拖拽刚松手，忽略残留 click
      usePotion(d.uid);
    });
    const body = UI.el.ovBody;
    // 战斗氛围尘（P2）：低频上浮微光点，纯 transform/opacity 合成器动画；色调随场景资产键走 CSS
    const stageEl = body.querySelector('.battle-stage');
    if (stageEl && !stageEl.querySelector('.sts-ambient')) {
      const ambient = document.createElement('div');
      ambient.className = 'sts-ambient';
      ambient.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 12; i++) {
        const s = document.createElement('i');
        s.style.left = (Random.random('ambient') * 100).toFixed(1) + '%';
        s.style.animationDuration = (7 + Random.random('ambient') * 9).toFixed(1) + 's';
        s.style.animationDelay = (-Random.random('ambient') * 14).toFixed(1) + 's';
        const sz = (2 + Random.random('ambient') * 3).toFixed(1);
        s.style.width = s.style.height = sz + 'px';
        ambient.appendChild(s);
      }
      stageEl.prepend(ambient);
    }
    body.querySelectorAll('.bt-potion[data-potion-aim="1"]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el, 'potion'); });
    });
    // 砸击拖动释放（09-20 老板）：按住砸击按钮拖到敌人身上松手=结算；轻点仍走 btSlam 点选流
    body.querySelectorAll('.bt-slam-btn').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el, 'slam'); });
    });
    // 药水栏点击直接使用兜底（2026-09-16 留言 #11：普通战药水栏点不动）
    body.querySelectorAll('.bt-potion:not([data-potion-aim="1"]):not(.off)').forEach(el => {
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const uid = el.dataset.uid;
        if (uid) usePotion(uid);
      });
    });
    // 药水自绘文字提示栏（09-20 老板：悬停 / 触摸药水即出说明，不用系统 title）——
    // 挂在 .bt-potions 容器内贴药水栏正下方；触屏按下即显，松手收起（once 防残留）
    const potionTip = body.querySelector('[data-potion-tip]');
    if (potionTip) {
      const showPotionTip = (p) => {
        potionTip.innerHTML = p.usable === false
          ? `${SDT.Icons.img('flask')} 【<b>${esc(p.name)} ×${p.count}</b>】${esc(p.desc)}（不可使用——${esc(p.why)}）`
          : `${SDT.Icons.img('flask')} 【<b>${esc(p.name)} ×${p.count}</b>】${esc(p.desc)}${p.aim === 'enemy' ? '——点击或拖到敌人身上使用' : '——点击直接使用'}`;
        potionTip.hidden = false;
      };
      const hidePotionTip = () => { potionTip.hidden = true; };
      body.querySelectorAll('.bt-potion').forEach(el => {
        const p = potions[Number(el.dataset.potionIdx)];
        if (!p) return;
        el.addEventListener('mouseenter', () => showPotionTip(p));
        el.addEventListener('mouseleave', hidePotionTip);
        el.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          showPotionTip(p);
          document.addEventListener('pointerup', hidePotionTip, { once: true });
          document.addEventListener('pointercancel', hidePotionTip, { once: true });
        });
      });
    }
    // —— 指向施法（炉石/杀戮尖塔式）：按住指向卡轻微拎起，弯曲箭头跟随指针 ——
    //    指向敌人 = 红色箭头，指向自己（立绘）= 绿色箭头；松手在目标身上即打出，
    //    松手没目标自动取消回手牌；轻点仍可选牌确认。
    // 敌人点选（砸击/药水点选）已改在单位常驻层创建槽位时绑一次（见 mountUnitLayer），
    // 不再随渲染重复挂——点击时读 getSnapshot() 实时态，避免闭包过期
    // 指向拖拽的 pointerdown 已在常驻槽位创建时绑定（见 updateHand），不再随渲染重复挂
    // 人物去纸色背景，像模型一样站在场景里（art.js 内按图缓存，二次渲染零成本）
    // 手牌常驻层挂载 + 差分更新（批次A）：出牌动画事件只取一次，常驻层与克隆飞行共用
    const animEvents = takeCardAnims();
    // 单位区常驻层挂载 + 差分更新（批次B）：玩家/随从/敌人节点跨渲染复用（须在手牌层之前，
    // 复用其 handSuspended 判定「战斗中弹层挂起 vs 战斗已收尾」）
    const unitMounts = mountUnitLayer(body, snapshot.battleToken);
    if (unitMounts) updateUnits(unitMounts, snapshot, { isBoss: opts.isBoss, pendingTarget, pendingItem, slamPending, dartPending });
    if (SDT.Art.cutoutFigures) SDT.Art.cutoutFigures(body);
    attachUnitFrames(body);   // 批次D：玩家立绘切序列帧（无帧集/降动效自动跳过）
    mountHandLayer(body, tip, snapshot.battleToken);
    showBattleStartEquipFlash(snapshot.equipped, snapshot.battleToken);
    const handAnim = updateHand(snapshot, prevView, pageGroups, animEvents, { spellBonus, mode, discoverSrcRect });
    discoverSrcRect = null;
    if (preserveAim) resumeAimAfterRender(snapshot);
    // 牌局动画：离场克隆飞行 / 手牌区随回合显隐 / 能量与牌堆脉冲
    const anim = animateBattleTransition(prevView, body, animEvents, handAnim.flightMs);
    // BOSS 登场演出：竖线阴影压过场景 2.4s（每场一次）+ 开始动画（暗幕+立绘+名号亮相，约 1.5s）
    if (opts.isBoss && !dreadShown) {
      markDreadShown();
      const st = body.querySelector('.battle-stage');
      if (st) { st.classList.add('fx-dread'); schedulePresentationMs(() => st.classList.remove('fx-dread'), 2500); }
      const bossFoe = foes[0];
      const bossName = (bossFoe && bossFoe.name) || '???';
      const art = bossFoe && bossFoe.id && SDT.Art.has(bossFoe.id)
        ? SDT.Art.monsterArt(bossFoe.id)
        : SDT.Icons.img('demon');
      const intro = document.createElement('div');
      intro.className = 'boss-intro';
      intro.innerHTML = `
        <div class="boss-intro-inner">
          <div class="boss-intro-tag">BOSS战</div>
          <div class="boss-intro-art">${art}</div>
          <div class="boss-intro-title">${esc(bossName)}</div>
        </div>`;
      const ovEl = UI.el.overlay;
      if (ovEl) {
        ovEl.appendChild(intro);
        schedulePresentationMs(() => intro.remove(), 1800);   // 动画 1.6s + 缓冲后移除
      }
    }
    spawnFloats(body, anim.flightMs ? Math.min(340, anim.flightMs * 0.8) : 0);
    UI.refresh(SDT.game);
  }


  sdtDefine('Battle', Object.freeze({ ...BattleSession,
    _perf: Object.freeze({ frameCacheStats }),
    _test: Object.freeze({ refillDrawPile }),
  }));

configureBattleRenderer(render);

export { render };
