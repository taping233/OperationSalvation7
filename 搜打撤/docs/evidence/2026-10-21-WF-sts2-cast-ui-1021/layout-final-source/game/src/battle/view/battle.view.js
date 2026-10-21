/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

import { bindBattlePageAction, isInteractiveBattlePage } from './battle.page-activity.js';
import { sdtDefine } from '../../core/sdt-facade.js';
import { rect as uiRect } from '../../ui/ui-scale.js';
import { esc, escAttr } from '../../core/shared.js';
import { displayCardDescription } from '../../cards/card-description-text.js';
import { storeGet, storeSet } from '../../core/storage.js';
import { on as onBattleEvent } from '../../core/event-bus.js';
import { groupHandCards, orderHandGroups, createStableHandSlots } from '../core/battle.hand.js';
import { getPace, setPace } from '../runtime/battle.pace.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';
import { renderCombatPiles, consumedPileUids } from './battle.piles.view.js';
import { turnForecastHTML } from '../../ui/battle-hud-info.js';
import { careerSkillButtonHTML } from './battle.skill-view.js';
import { renderInfusionSelection } from './battle.infusion-view.js';
import { infusionHandCards } from './battle.infusion-material-state.js';
import { createBattlePotionUse } from './battle.potion-use.js';
import { discoverInfusionNote } from './battle.discover-infusion.js';
import { battleDiscoverBodyHTML } from './battle.discover-view.js';
import { bindBattleDecisionInspection, restoreCombatScene } from './battle.decision-shell.js';
import { battleChoiceBodyHTML, battleHandSelectBodyHTML, battleDiscoverLifecycleNote } from './battle.decision-content.js';
import { createDiscoverInputGate } from './battle.discover-input.js';
import { forecastEnemyTurn } from './battle.turn-forecast.js';
import { battleRestartHTML, bindBattleRestart } from '../../ui/settings-battle-restart.js';
import { createBattleSceneryCapture } from './battle.scenery.js';
import { attach as attachUnitFrames, hide as hideUnitFrames, cacheStats as frameCacheStats } from './battle.frames.js';
import { BattleSession, commands, configureBattleRenderer, getSnapshot, R, effCostOf, infuseOf, findEffectiveCard as findCard, markDreadShown, infusionFuelReason, targetSide, pileTip, refillDrawPile, takeCardAnims, unplayableReason } from '../core/battle.core.js';
import { renderDeckSelection, renderGrave, renderBattleBag, renderDeckPileView, showBattleDecision } from './battle.overlays.js';
import { mountHandLayer, updateHand, mountUnitLayer, updateUnits, HAND_PAGE_SIZE } from './battle.layers.js';
import { spawnFloats } from './battle.vfx.js';
import { captureBattleView, animateBattleTransition } from './battle.anim.view.js';
import { aim, aimPlayedAt, selectCardByClick, startAim, cancelAim, canPreserveAim, resumeAimAfterRender, setClickSelectedUid, updateClickSelectionUI } from './battle.aim.js';
import { createBattleEntryGate, waitForBattleImages } from './battle.presentation-ready.js';
import { presentVictory } from './battle.victory.js';
import { showThoughtBubble } from './battle.hover.js';

const captureBattleScenery = createBattleSceneryCapture();
const battleEnergyArt = new URL('../../../assets/ui/battle-controls-glass-1016/energy.webp', import.meta.url).href;
let sceneryConfig = null;
let sceneryStage = null, sceneryToken = null, sceneryWorld = null, sceneryFront = null;
let sceneryReady = null;
const battleEntry = createBattleEntryGate();
let sceneryObserver = null, sceneryHideObserver = null, sceneryFrame = 0;
const potionUse = createBattlePotionUse({ UI, getSnapshot, commands });
if (import.meta.hot) import.meta.hot.dispose(() => potionUse.dispose());
function clearPotionTip() {
  potionUse.close();
}
function clearBattleScenery() {
  sceneryObserver?.disconnect(); sceneryObserver = null;
  sceneryHideObserver?.disconnect(); sceneryHideObserver = null;
  if (sceneryFrame) cancelAnimationFrame(sceneryFrame);
  sceneryFrame = 0;
  sceneryStage?.removeEventListener('pointermove', scheduleSceneryLayout);
  sceneryStage?.removeEventListener('pointerover', scheduleSceneryLayout);
  sceneryStage?.removeEventListener('pointerout', scheduleSceneryLayout);
  sceneryWorld?.remove(); sceneryFront?.remove();
  sceneryStage?.classList.remove('has-painted-scenery');
  sceneryStage = null; sceneryToken = null; sceneryWorld = null; sceneryFront = null;
  sceneryReady = null;
  sceneryConfig = null;
}
function scheduleSceneryLayout() {
  if (sceneryFrame) return;
  sceneryFrame = requestAnimationFrame(() => { sceneryFrame = 0; layoutBattleScenery(); });
}
function layoutBattleScenery() {
  if (!sceneryStage?.isConnected || sceneryStage._battleToken !== sceneryToken || !sceneryWorld || !sceneryConfig) return;
  const arena = /** @type {BattleElement} */ (sceneryStage.querySelector('.sts-arena'));
  if (sceneryConfig.stageLayers) {
    sceneryWorld.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    if (sceneryFront) sceneryFront.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    return;
  }
  const a = uiRect(arena), overlay = uiRect(UI.el.overlay);
  if (!a.width || !a.height) return;
  const figure = /** @type {HTMLImageElement} */ (sceneryStage.querySelector('.sts-me .sts-figure img')) || /** @type {BattleElement} */ (sceneryStage.querySelector('.sts-me .sts-figure'));
  const figureRect = figure ? uiRect(figure) : null;
  const localWidth = arena.clientWidth, localHeight = arena.clientHeight;
  if (!localWidth || !localHeight) return;
  const sx = a.width / localWidth, sy = a.height / localHeight;
  // Follow the standing layout, not an attack/entrance transform that would move the floor.
  let footprint = figure, foot = figure?.offsetHeight || 0;
  while (footprint && footprint !== arena) { foot += footprint.offsetTop; footprint = /** @type {HTMLElement} */ (footprint.offsetParent); }
  if (!figure?.offsetHeight || footprint !== arena) foot = figureRect?.height ? (figureRect.bottom - a.top) / sy : localHeight - 70;
  const width = Math.max(localWidth, localHeight * sceneryConfig.aspect);
  const height = width / sceneryConfig.aspect;
  const x = (localWidth - width) / 2, y = foot - height * sceneryConfig.footLine;
  sceneryWorld.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;clip-path:inset(${Math.max(0,-y)}px ${Math.max(0,x+width-localWidth)}px ${Math.max(0,y+height-localHeight)}px ${Math.max(0,-x)}px);`;
  if (!sceneryFront) return;
  sceneryFront.style.left = `${a.left - overlay.left + x * sx}px`;
  sceneryFront.style.top = `${a.top - overlay.top + y * sy}px`;
  sceneryFront.style.width = `${width * sx}px`; sceneryFront.style.height = `${height * sy}px`;
  // HUD 本身可透明且零高；只为实际可见控件开孔，保留其余前景覆盖地面。
  const protectedNodes = sceneryStage.querySelectorAll('.sts-topbar, .sts-nameplate, .sts-intent, .sts-arena-caption, .bt-potions, .bt-potion-use, .bt-infuse, .bt-card, .sts-energy-wrap, .sts-hand-tools, .sts-tactics, .bt-fpreview, .bt-thought-bubble, .sts-unit.can-target, #aimArrow');
  const holes = [...protectedNodes].map(node => {
    const r = uiRect(node);
    const padding = node.matches('.sts-unit.can-target') ? 10 : 4;
    return r.width && r.height ? `<rect x="${r.left - a.left - x * sx - padding}" y="${r.top - a.top - y * sy - padding}" width="${r.width + padding * 2}" height="${r.height + padding * 2}" fill="black"/>` : '';
  }).join('');
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * sx}" height="${height * sy}"><mask id="m" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="black"/><rect x="${-x * sx}" y="${-y * sy}" width="${a.width}" height="${a.height}" fill="white"/>${holes}</mask><rect width="100%" height="100%" fill="white" mask="url(#m)"/></svg>`;
  if (sceneryFront._maskMarkup !== mask) {
    sceneryFront.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(mask)}")`;
    sceneryFront._maskMarkup = mask;
  }
}
function syncBattleScenery(stage, token, config) {
  if (!stage || !config) { clearBattleScenery(); return Promise.resolve(false); }
  if (sceneryStage !== stage || sceneryToken !== token || sceneryConfig !== config || !sceneryWorld?.isConnected || (config.foreground && !sceneryFront?.isConnected)) {
    clearBattleScenery(); sceneryStage = stage; sceneryToken = token;
    sceneryConfig = config;
    stage.dataset.sceneryKey = config.key;
    sceneryWorld = document.createElement('div'); sceneryWorld.className = 'battle-scene-world';
    sceneryWorld.hidden = true;
    sceneryWorld.setAttribute('aria-hidden', 'true');
    for (const key of config.image ? ['static'] : ['far', 'mid', 'ground'].filter(name => config[name])) {
      const image = document.createElement('img'); image.src = config.image || config[key];
      image.className = `battle-scene-layer scene-${key}`; image.alt = ''; image.draggable = false;
      sceneryWorld.appendChild(image);
    }
    /** @type {BattleElement} */ (stage.querySelector('.sts-arena')).prepend(sceneryWorld);
    if (config.foreground) {
      sceneryFront = document.createElement('img'); sceneryFront.src = config.foreground;
      sceneryFront.className = 'battle-scene-foreground'; sceneryFront.alt = ''; sceneryFront.draggable = false;
      sceneryFront.hidden = true;
      sceneryFront.setAttribute('aria-hidden', 'true'); (config.stageLayers ? stage : UI.el.overlay).appendChild(sceneryFront);
    }
    const world = sceneryWorld, front = sceneryFront;
    const images = [.../** @type {NodeListOf<HTMLImageElement>} */ (world.querySelectorAll('img')), ...(front ? [front] : [])];
    sceneryReady = Promise.all(images.map(image => typeof image.decode === 'function' ? image.decode() : new Promise((/** @type {(value?: void) => void} */ resolve, reject) => {
      if (image.complete && image.naturalWidth) { resolve(); return; }
      image.addEventListener('load', resolve, { once:true });
      image.addEventListener('error', reject, { once:true });
    }))).then(() => {
      if (sceneryStage !== stage || sceneryToken !== token || stage._battleToken !== token
        || sceneryWorld !== world || sceneryFront !== front || sceneryConfig !== config || !stage.isConnected || UI.el.overlay.hidden
        // Retained secondary pages are still this battle's live presentation.
        // A successful decode may finish after the panel changes the UI mode.
        || (UI._lastMode !== 'battle' && !/** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-secondary-layer')))
        || !images.every(image => image.complete && image.naturalWidth > 0)) return false;
      world.hidden = false; if (front) front.hidden = false;
      stage.classList.add('has-painted-scenery'); layoutBattleScenery();
      return true;
    }).catch(error => {
      if (sceneryStage === stage && sceneryToken === token && sceneryWorld === world) console.warn('[battle:scenery] painted layer unavailable', error);
      return false;
    });
    if (typeof ResizeObserver !== 'undefined') {
      sceneryObserver = new ResizeObserver(scheduleSceneryLayout);
      sceneryObserver.observe(stage); sceneryObserver.observe(/** @type {BattleElement} */ (stage.querySelector('.sts-arena')));
      const footprint = /** @type {BattleElement} */ (stage.querySelector('.sts-me .sts-figure'));
      if (footprint) sceneryObserver.observe(footprint);
    }
    if (typeof MutationObserver !== 'undefined') {
      sceneryHideObserver = new MutationObserver(() => { if (UI.el.overlay.hidden) clearBattleScenery(); });
      sceneryHideObserver.observe(UI.el.overlay, { attributes:true, attributeFilter:['hidden'] });
    }
    if (front && !config.stageLayers) {
      stage.addEventListener('pointermove', scheduleSceneryLayout);
      stage.addEventListener('pointerover', scheduleSceneryLayout);
      stage.addEventListener('pointerout', scheduleSceneryLayout);
    }
  }
  layoutBattleScenery();
  return sceneryReady;
}
const clearSceneryOnMode = event => { clearPotionTip(); if (event.detail !== 'battle' && !/** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-secondary-layer'))) { clearBattleScenery(); battleEntry.cancel(); } };
const closeBattlePresentation = () => { clearPotionTip(); battleEntry.cancel(); };
document.addEventListener('sdt-overlay-mode', clearSceneryOnMode);
document.addEventListener('sdt-overlay-close', closeBattlePresentation);
if (import.meta.hot) import.meta.hot.dispose(() => {
  document.removeEventListener('sdt-overlay-mode', clearSceneryOnMode);
  document.removeEventListener('sdt-overlay-close', closeBattlePresentation);
  clearPotionTip();
  clearBattleScenery(); battleEntry.dispose();
});

// Subscribe once per module, never per render. A departed/older battle cannot
// put its warning on a newly mounted stage, even while asynchronous work finishes.
const unsubscribeRuleWarning = onBattleEvent('battle:rule-rejected', event => {
  const overlay = UI.el.overlay;
  const stage = /** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-stage.sts'));
  if (!SDT.game?.battleActive || !overlay?.isConnected || overlay.hidden || UI._lastMode !== 'battle'
    || !stage?.isConnected || !overlay.contains(stage) || stage._battleToken !== event?.battleToken
    || getSnapshot().battleToken !== event?.battleToken) return;
  showThoughtBubble(event.message);
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribeRuleWarning);

/* battle.view.js —— 战斗渲染：战场 DOM/手牌/指向施法箭头/拖拽预览 */
  const bagSlam = commands.bagSlam;             // 需求 #9：背包砸击
  const slamSkillOf = commands.slamSkill;       // 2026-10-02 老板：砸击换五职业分化技能（含牧师翻面态）
  const endTurn = commands.endTurn;
  const surrender = commands.surrender;   // 玩法定版：主动撤离视为本局失败
  const openGrave = commands.openGrave;
  const openDeckView = commands.openDeckView;
  const closeDeckView = commands.closeDeckView;
  const pickDiscover = commands.pickDiscover;
  const pickChoice = commands.pickChoice;
  const pickHandSelect = commands.pickHandSelect;
  const skipHandSelect = commands.skipHandSelect;
  const useEquipSkill = commands.useEquipSkill;
  // 双击放大已退役（2026-09-12 老板定向：紧凑手牌 + 单击展开完整卡面取代）

  // ---------- 渲染 ----------
  // 手牌一栏最多9叠；超出的用分栏按钮切换，单击详情不改变分组与牌序。
  let handPage = 0;
  const stableHandSlots = createStableHandSlots();
  // HAND_PAGE_SIZE 已随 updateHand 迁往 battle.layers.js（壳经 import 引入——批5）
  // 紧凑手牌（2026-09-12 老板二次定向）：常态只露牌面+名字，**悬停**弹出完整描述，
  // 点击直接选目标；详情按钮或 Shift 快捷键查看，拖拽可直接提交。
  // 发现选卡的飞入起点（2026-09-10 留言 #36）：发现浮层会整块替换战斗视图，抽卡动画取样不到
  // 旧手牌位——点中候选卡的瞬间记下它的屏幕矩形，让新卡从「被选中的那张卡」飞回手牌
  let discoverSrcRect = null;
  const discoverInput = createDiscoverInputGate();

  function combatStateCopy(snapshot, handCards) {
    const { phase = 'player', energy = 0, infusing, choosing, handSelecting,
      pendingTarget, pendingItem, slamPending, dartPending, busy } = snapshot;
    if (phase === 'enemy') return { label: '敌方行动', detail: '敌人正在行动', tone: 'foe' };
    if (busy || phase === 'resolving') return { label: '结算中', detail: '正在结算当前动作', tone: 'focus' };
    if (infusing) return { label: '注能选牌', detail: `已选 ${infusing.picked?.length || 0}/${infusing.need} 张`, tone: 'focus' };
    if (choosing || handSelecting) return { label: '选择中', detail: '完成当前选择后继续', tone: 'focus' };
    if (pendingTarget || pendingItem || slamPending || dartPending) return { label: '选择目标', detail: pendingTarget?.hint || '点击高亮目标 · Esc 取消', tone: 'focus' };
    // Reuse this render's resolved effective hand. The next render resolves it anew.
    // Eligibility and effective costs still read current rules below.
    const playable = handCards.some(entry => {
      if (unplayableReason(entry.card)) return false;
      return effCostOf(entry.card, entry.uid) <= energy;
    });
    if (playable) return { label: '你的行动', detail: '', tone: 'self' };
    if (energy > 0) return { label: '你的行动', detail: '当前没有可用卡牌', tone: 'warn' };
    return { label: '你的行动', detail: '能量已耗尽', tone: 'warn' };
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
  function syncBattleSlot(stage, previous, next, selector, before, after = false) {
    const oldNode = previous.querySelector(selector);
    const nextNode = next.querySelector(selector);
    if ((oldNode?.outerHTML || '') === (nextNode?.outerHTML || '')) return;
    const liveNode = stage.querySelector(selector);
    if (selector === ':scope > .bt-potions') clearPotionTip();
    if (!nextNode) { liveNode?.remove(); return; }
    const replacement = nextNode.cloneNode(true);
    if (liveNode) liveNode.replaceWith(replacement);
    else stage.querySelector(before)[after ? 'after' : 'before'](replacement);
  }
  function showBattleStage(html, token, backgroundOnly = false) {
    if (!backgroundOnly) restoreCombatScene(UI, token);
    const body = UI.el.ovBody;
    const stage = /** @type {BattleElement} */ (body.firstElementChild);
    const canReuse = !UI.el.overlay.hidden && (UI._lastMode === 'battle' || backgroundOnly)
      && stage?.matches('.battle-stage.sts') && stage._battleToken === token
      && stage._battleTemplate && stage.isConnected;
    if (!canReuse) {
      clearPotionTip();
      clearBattleScenery();
      UI.showOverlay('', html, 'battle');
      const fresh = /** @type {BattleElement} */ (body.firstElementChild);
      fresh._battleToken = token;
      fresh._battleTemplate = /** @type {BattleElement} */ (fresh.cloneNode(true));
      fresh._battleHtml = html;   // F4：模板字符串精确签名（见下方复用路径）
      battleEntry.begin(fresh, token, UI.el.overlay);
      fresh.classList.add('bt-entrance');   // 单位入场演出只挂场次首建；复用渲染绝不再带（令牌守卫）
      return;
    }
    // F4（09-30 性能审计）：html 与上一帧完全一致时，整舞台 rich 宏替换+解析与 12 个
    // syncBattleSlot 的 outerHTML 序列化比对必然全部无更新——字符串精确相等是零误判
    // 签名，直接短路（模板含随机内容时永不命中=退化为原行为，无损）。
    if (stage._battleHtml === html) {
      return;
    }
    stage._battleHtml = html;
    const template = document.createElement('template');
    template.innerHTML = SDT.Icons.rich(html);
    const next = /** @type {BattleElement} */ (template.content.firstElementChild);
    const previous = stage._battleTemplate;
    // 战场皮肤属于场次；异常切换时回到 showOverlay，保证背景与模式标志同步。
    if (stage.dataset.assetKey !== next.dataset.assetKey || stage.dataset.boss !== next.dataset.boss) {
      clearPotionTip();
      clearBattleScenery();
      UI.showOverlay('', html, 'battle');
      const fresh = /** @type {BattleElement} */ (body.firstElementChild);
      fresh._battleToken = token;
      fresh._battleTemplate = /** @type {BattleElement} */ (fresh.cloneNode(true));
      fresh._battleHtml = html;
      battleEntry.begin(fresh, token, UI.el.overlay);
      fresh.classList.add('bt-entrance');
      return;
    }
    if (stage.dataset.phase !== next.dataset.phase) {
      stage.classList.remove(`phase-${stage.dataset.phase}`);
      stage.classList.add(`phase-${next.dataset.phase}`);
      stage.dataset.phase = next.dataset.phase;
    }
    stage.dataset.battleState = next.dataset.battleState;
    // 模板之间比较，避免把动画临时加的类（牌堆脉冲、受击等）当成状态变化。
    // 单位、装备与手牌由 battle.layers 的差分层维护，绝不替换其挂载点。
    syncBattleSlot(stage, previous, next, ':scope > .bt-potions', '.sts-topbar');
    syncBattleSlot(stage, previous, next, '.sts-encounter');
    syncBattleSlot(stage, previous, next, '.sts-options');
    syncBattleSlot(stage, previous, next, '.sts-hud-l');
    syncBattleSlot(stage, previous, next, '.sts-hud-r');
    syncBattleSlot(stage, previous, next, ':scope > .bt-infuse:not(.bt-pick)', ':scope > .bt-infuse.bt-pick, .sts-hud');
    syncBattleSlot(stage, previous, next, ':scope > .bt-infuse.bt-pick', '.sts-hud');
    syncBattleSlot(stage, previous, next, '.sts-energy-wrap');
    syncBattleSlot(stage, previous, next, '.bt-hand-page', '.battle-skill-help', true);
    syncBattleSlot(stage, previous, next, '.battle-skill-help');
    syncBattleSlot(stage, previous, next, '.sts-tactics');
    stage._battleTemplate = next;
  }
  function render(snapshot = getSnapshot(), backgroundOnly = false) {
    // Refresh the retained scene from the current snapshot before covering it.
    // This is view-only: phase/resources stay real, and existing selection DOM
    // remains mounted until the presenter captures its focus and scroll.
    const secondary = snapshot.choosing || snapshot.discovering || snapshot.handSelecting
      || snapshot.viewingGrave || snapshot.viewingDeck || snapshot.viewingBag;
    if (secondary && !snapshot.deckSelection && !backgroundOnly) {
      render({ ...snapshot, choosing:null, discovering:null, handSelecting:null, infusing:null,
        viewingGrave:false, viewingDeck:false, viewingBag:false }, true);
    }
    // 出牌/抽牌动画事件提前取样：无事件时跳过 prevView 采样（整手牌 outerHTML 序列化+逐张布局读
    // 只被飞行动画消费，能量/角标等高频渲染纯浪费）。两个消费点（updateHand/animateBattleTransition）
    // 对 prev 均空值安全。
    const animEvents = takeCardAnims();
    const prevView = animEvents.length ? captureBattleView() : null;   // 重建前的手牌/牌堆位：供飞行与归位动画取样
    const preserveAim = !!aim && canPreserveAim(snapshot);
    if (snapshot.phase !== 'player' || snapshot.busy || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending) setClickSelectedUid(null);
    const {
      mode, turn, energy, maxEnergy, busy, phase = 'player', opts, player, pstat,
      foes, hand, drawPile, infusing, discovering, handSelecting, choosing,
      pendingTarget, viewingGrave, viewingBag, dreadShown, deckSelection,
      potionBar, pendingItem, slamPending, dartPending, viewingDeck,
    } = snapshot;
    if (!discovering && !backgroundOnly) discoverInput.reset();
    if (aim && !preserveAim) cancelAim();
    UI.hideTooltip();   // U8：重渲染摘换手牌节点时 mouseleave 不触发，防 tooltip 残留
    // 战斗中弹层接管（墓地/背包/抉择/选牌/发现）：序列帧层挂在 overlay 直下不随 ovBody
    // 销毁，不藏会浮在弹层之上（09-12 实机：背包弹层上残留玩家序列帧立绘）——
    // 卸下 sprite 恢复静态立绘，关闭弹层走主渲染 attach 自动恢复
    if (viewingGrave || viewingBag || choosing || handSelecting || discovering) hideUnitFrames();
    if (deckSelection) { renderDeckSelection(snapshot); return; }   // 战前编组：允许下次挂载时重置手牌层
    if (viewingGrave) { renderGrave(snapshot); return; }
    if (viewingDeck) { renderDeckPileView(snapshot); return; }
    if (viewingBag) { renderBattleBag(snapshot); return; }
    if (choosing) {
      // 2026-09-08 抉择面板：人工 N 选一（复用发现面板的弹层交互）
      showBattleDecision('[[icon:question]] 抉择', battleChoiceBodyHTML(choosing), 'discover', snapshot);
      bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btChoicePick', (d) => pickChoice(d.i));
      UI.refresh(SDT.game);
      return;
    }
    if (handSelecting) {
      // 2026-09-06 #24/#25：从手牌选择卡牌施放/消耗的通用弹层
      const isPayment = handSelecting.act === 'payment';
      const pool = handSelecting.candidateUids.map(findCard).filter(Boolean);
      const paymentName = handSelecting.payment?.card?.name;
      const paymentLabel = isPayment ? `支付代价${paymentName ? `：${esc(paymentName)}` : ''}` : '选择手牌';
      showBattleDecision(`[[icon:cards]] ${paymentLabel}`, battleHandSelectBodyHTML({ pool, handSelecting, cardHTML:(card,size) => SDT.Cards.cardHTML(card,size) }), 'discover', snapshot);
      bindBattleDecisionInspection({ UI, getSnapshot, cards:pool.map(entry => entry.card), snapshot });
      bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btPickHand', (d) => pickHandSelect(d.uid));
      if (handSelecting.canCancel) bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btPickHandSkip', () => skipHandSelect());
      UI.refresh(SDT.game);
      return;
    }
    if (discovering) {
      const inputTicket = discoverInput.bind(snapshot);
      if (!inputTicket) return;
      const discoverAction = {
        play: '选择 1 张免费施放', potion: '选择 1 张免费施放',
        playKeep: '选中牌免费施放，其余候选置入手牌',
        noInfuse: '选择 1 张置入手牌，使其无需注能',
        pouch: '从锦囊取出 1 张施放', dup: '选 1 张，获得两张复制并置入手牌',
      }[discovering.act] || '选择 1 张置入手牌';
      const discoverSource = discovering.sourceCardId
        ? SDT.Cards.all().find(card => card.id === discovering.sourceCardId)?.name : '';
      const discoverModifiers = [
        discovering.zeroCost ? '所选牌费用变为 0' : '',
        discovering.priceArmor ? '同时按所选牌估值获得护甲' : '',
        /** @type {number} */ (discovering.costDecayPerTurn) > 0 ? `所选牌每回合费用 -${discovering.costDecayPerTurn}` : discovering.decayEachTurn ? '所选牌每回合费用 -1' : '',
        discovering.consumeTempAtTurn ? '所选临时牌在下回合开始时消耗' : '',
        discovering.swapPair ? '两张发现牌入手后交换费用' : '',
      ].filter(Boolean);
      const fromDeckBottom = discovering.deckBottom && /** @type {readonly string[] | undefined} */ (discovering.deckBottomUids)?.length;
      const discoverNote = battleDiscoverLifecycleNote({ act:discovering.act, isBoss:mode === 'boss', fromDeckBottom });
      const candidates = discovering.options.map((option, i) => {
        const sourceUid = fromDeckBottom ? discovering.deckBottomUids[i] : null;
        const source = sourceUid ? findCard(sourceUid) : null;
        const c = source?.card || option;
        const sourceNote = source
          ? (SDT.game?.ownedCards?.some(entry => entry.uid === sourceUid) ? '随身牌来源' : '本场临时牌来源')
          : '';
        return { card:c, sourceNote, infusionNote:discoverInfusionNote(discovering.act, infuseOf(c), c), equipmentNote:c.type === '装备' && (c.rules?.equip?.battleStart?.length || /对战开始时/.test(c.desc || ''))
          ? '战中穿戴时立即补发开战效果' : '' };
      });
      showBattleDecision('[[icon:question]] 发现', battleDiscoverBodyHTML({
        candidates, cardHTML:(card, size) => SDT.Cards.cardHTML(card, size), action:discoverAction,
        remaining:discovering.n, source:discoverSource, note:discoverNote, modifiers:discoverModifiers, pageToken:inputTicket.pageToken,
      }), 'discover', snapshot);
      bindBattleDecisionInspection({ UI, getSnapshot, cards:candidates.map(entry => entry.card), snapshot });
      const page = /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-decision[data-decision-kind="discover"]'));
      const panel = /** @type {BattleElement} */ (page?.querySelector('[data-battle-discover]'));
      const buttons = [...(/** @type {NodeListOf<BattleElement>} */ (page?.querySelectorAll('[data-act="btDiscover"]')) || [])];
      const isCurrentPage = () => inputTicket.isCurrent() && isInteractiveBattlePage(UI, page)
        && /** @type {BattleElement} */ (UI.el?.ovBody?.querySelector('.battle-decision[data-decision-kind="discover"]')) === page
        && panel?.getAttribute('data-discover-page') === inputTicket.pageToken;
      // A bounded visual update follows only this DOM page; no delayed callback
      // can unlock a replacement page or restart the round's admission deadline.
      let previousOpening = null;
      const paintInputReadiness = () => {
        if (!isCurrentPage()) return;
        const opening = inputTicket.remainingMs() > 0;
        if (opening !== previousOpening) {
          previousOpening = opening;
          panel.setAttribute('aria-busy', String(opening));
          buttons.forEach(button => {
            if (opening) button.setAttribute('aria-disabled', 'true');
            else button.removeAttribute('aria-disabled');
          });
        }
        if (opening) requestAnimationFrame(paintInputReadiness);
      };
      if (typeof requestAnimationFrame === 'function') paintInputReadiness();
      UI.act('btDiscover', (d) => {
        if (!isCurrentPage()) return;
        const index = Number(d?.i);
        const el = buttons.find(button => button.dataset.i === String(index) && button.dataset.discoverPage === d?.discoverPage);
        if (!el?.isConnected || !page.contains(el) || !inputTicket.trySubmit(getSnapshot(), d?.discoverPage, index)) return;
        discoverSrcRect = uiRect(el);   // 布局口径：消费端喂 transform
        pickDiscover(index);
      });
      UI.refresh(SDT.game);
      return;
    }
    const cards = hand.map(findCard).filter(Boolean);
    const infusingNow = !!infusing;
    // —— 法伤加成同步（2026-09-09 需求）：有法伤加成时，造成法术伤害的招式卡面
    // 数值实时显示为「卡面值 + 法伤加成」，数字略微放大（口径同 combat.dealDamage）
    const spellBonus = (player.spellPower || 0) + (/** @type {number} */ ((pstat.status && pstat.status.spellUp) || 0));
    // —— 同名卡堆叠（v0.32 杀戮尖塔式手牌）：同名同描述的卡只占一个位置，显示 ×N ——
    // 注能时每个实际 UID 单独成卡；已选材料移到独立容器，主卡保持完整可读。
    // 初始攻击最左、招式在前、装备在后；类别内部保留槽位，不改变hand语义顺序
    const stable = infusingNow
      ? { groups:infusionHandCards(cards, infusing).filter(group => !infusing.picked.includes(group.uids[0])).map((group, displaySlot) => ({ ...group, displaySlot })), count:cards.length - 1 }
      : stableHandSlots(orderHandGroups(groupHandCards(cards)), snapshot.battleToken, snapshot.turn);
    const groups = stable.groups;
    const N = stable.count;
    // 分栏切页：只渲染当前栏的9叠，扇形布局按本栏实际张数计算。
    const handPages = infusingNow ? 1 : Math.max(1, Math.ceil(N / HAND_PAGE_SIZE));
    if (handPage >= handPages) handPage = handPages - 1;
    if (handPage < 0) handPage = 0;
    const pageGroups = infusingNow ? groups : groups.filter(g => Math.floor(g.displaySlot / HAND_PAGE_SIZE) === handPage)
      .map(g => ({ ...g, displayIndex: g.displaySlot % HAND_PAGE_SIZE, displayCount: Math.min(HAND_PAGE_SIZE, N - handPage * HAND_PAGE_SIZE) }));
    // 手牌 DOM 由常驻层差分维护（见 mountHandLayer / updateHand）：这里只算分组与目标扇形位，
    // 不再拼整段手牌 HTML（批次A 架构对齐：手牌区不随整屏重渲染重建）
    const pileView = renderCombatPiles({
      mode,
      drawCount: drawPile,
      graveCount: consumedPileUids(snapshot),
      pileTip,
      cardBackHTML: SDT.Cards.cardBackHTML(),
      escAttr,
    });
    const drawPileHTML = pileView.draw;
    const pilesHTML = pileView.rest;
    const tip = mode === 'boss'
      ? `开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 消耗牌堆不自动洗回，仅由卡牌效果取回`
      : '点击手牌查看大卡，确认使用后选择目标；也可直接拖拽到敌人、自己或战场空地。数字键与 Enter 同样先查看。';
    // —— 道具栏（2026-09-12 老板定向）：战斗界面上方常驻，点击使用 / 拖到敌人身上 ——
    // 2026-09-09 玩法定版：BOSS 战没有道具栏（背包里的道具无法使用）
    // 09-20 P1-7：空道具时整栏隐藏——顶部不再常驻「背包里没有道具」占位
    // 09-20 老板：药水说明不再挂系统 title（悬停延迟且触屏无效），改为自绘文字栏——
    // 悬停 / 按下药水时在药水栏正下方弹出（data-potion-idx 对应 potions 数组下标）
    const potions = (potionBar || []).map(potion => {
      const card = findCard(potion.uid);
      return { ...potion, desc: displayCardDescription(potion.desc, card?.id, card) };
    });
    const showItemBar = potions.length > 0;
    const potionsHTML = showItemBar ? `
      <div class="bt-potions">
        <span class="bt-potions-label">[[icon:flask]] 道具</span>
        ${potions.length ? potions.map((p, pi) => p.usable === false
          ? `<div class="bt-potion off" role="button" tabindex="0" data-uid="${p.uid}" aria-label="查看${escAttr(p.name)}：${escAttr(p.why || p.desc)}" data-potion-idx="${pi}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`
          : `<div class="bt-potion${p.aim === 'enemy' ? ' need-target' : ''}" role="button" tabindex="0" aria-label="查看${escAttr(p.name)}：${escAttr(p.desc)}${p.aim === 'enemy' ? '，使用后选择目标，或拖向敌人' : ''}" data-act="btPotion" data-uid="${p.uid}"
              ${p.aim === 'enemy' ? 'data-potion-aim="1"' : ''}
              data-potion-idx="${pi}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`).join('')
          : '<span class="bt-potions-empty">背包里没有道具</span>'}
      </div>` : '';
    const battleAssetKey = opts.isBoss
      ? ({ boss_general: 'battle-boss-general', boss_orc: 'battle-boss-orc', boss_elem: 'battle-boss-element' }[foes[0] && foes[0].id] || 'battle-boss-general')
      : 'battle-normal';
    const combatState = combatStateCopy(snapshot, cards);
    // 背包技能按钮（2026-10-02 老板：砸击换五职业分化技能）：文案/费用/提示按当前职业与翻面态切换
    const slamSkillInfo = slamSkillOf();
    const skillState = busy || infusingNow ? 'locked' : slamSkillInfo.used ? 'used' : slamPending ? 'targeting' : energy < slamSkillInfo.cost ? 'unaffordable' : 'ready';
    const skillAvailability = { locked: busy ? '结算中' : '选择中', used: '已使用', targeting: '选目标', unaffordable: `差 ${Math.max(0, slamSkillInfo.cost - energy)} 费`, ready: '可用' }[skillState];
    const skillEffect = slamSkillInfo.aimDesc || (slamSkillInfo.heal ? '回复 ' + slamSkillInfo.heal + ' 生命' : '随机获得1张牌');
    const turnForecast = forecastEnemyTurn(snapshot);
    // 战斗标题文字去掉（2026-09-13 留言）
    showBattleStage(`
      <div class="battle-stage sts battle-sts phase-${escAttr(phase)}" data-phase="${escAttr(phase)}" data-battle-state="${escAttr(combatState.tone)}" data-asset-key="${battleAssetKey}" data-boss="${opts.isBoss ? '1' : '0'}">
      <div class="battle-stage-shade"></div>
      ${potionsHTML}
      <div class="sts-topbar">
        <div class="sts-encounter">
          ${opts.isBoss ? '<span class="sts-encounter-kicker">首脑战</span>' : ''}
          <b>第 ${turn} 回合</b><span class="sts-phase-dot ${escAttr(combatState.tone)}"></span><span>${esc(combatState.label)}</span>
        </div>
        <details class="sts-options"><summary>[[icon:gear]] 选项</summary><div class="sts-options-menu">
          <button class="ov-btn ghost" data-act="btBossRules">战斗规则</button>
          <button class="ov-btn ghost${mode === 'boss' ? ' dis' : ''}" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}
            ${mode === 'boss' ? 'title="BOSS 战不可撤离——击败首脑或战败即终局"' : 'title="撤离将视为本局失败"'}>[[icon:runner]] 撤离（判负）</button>
          <button class="ov-btn ghost" data-act="btSettings" title="战斗设置（音频 / 震动）">[[icon:gear]] 设置</button>
        </div></details>
      </div>
      <div class="sts-arena">
        <div data-unit-mount="self"></div>
        <div class="sts-allies" data-unit-mount="allies"></div>
        <div class="sts-foes" data-unit-mount="foes"></div>
      </div>
      <div class="sts-hud">
        <div class="sts-resource-dock">
        <div class="sts-hud-l" aria-label="抽牌堆">${drawPileHTML}</div>
        <div class="sts-energy-wrap">
          <div class="sts-energy" role="group" tabindex="0" aria-label="能量 ${energy}，每回合 ${maxEnergy}" data-ui-tip data-ui-tip-title="能量" data-ui-tip-text="打出卡牌与使用职业技能时消耗。" data-ui-tip-note="回合开始恢复至 ${maxEnergy} 点">
            <img class="battle-energy-emblem" src="${escAttr(battleEnergyArt)}" alt="" draggable="false" decoding="async"><b>${energy}</b><span>/${maxEnergy}</span>
          </div>
        </div>
        </div>
        <div class="sts-hand-tools" aria-label="职业技能与手牌分栏">
          ${careerSkillButtonHTML({ skill:slamSkillInfo, state:skillState, availability:skillAvailability, effect:skillEffect,
            disabled:busy || infusingNow || slamSkillInfo.used || (energy < slamSkillInfo.cost && !slamPending) })}
          ${handPages > 1 ? `<button class="bt-hand-page has-more" data-act="btHandPage" aria-label="还有另一栏手牌，当前第 ${handPage + 1} 栏，共 ${handPages} 栏"
            title="手牌分栏：每栏最多 ${HAND_PAGE_SIZE} 叠；点击查看下一栏，末栏后回到第一栏">[[icon:cards]] 第 ${handPage + 1}/${handPages} 栏</button>` : ''}
        </div>
        <div class="sts-hud-r" aria-label="消耗牌堆">${pilesHTML}</div>
        <div class="bt-hand sts-hand" role="group" aria-label="当前手牌"></div>
        <div class="sts-tactics" aria-label="战术操作">
          ${turnForecastHTML(turnForecast)}
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'} sts-end-turn" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>结束回合</button>
        </div>
       </div>`, snapshot.battleToken, backgroundOnly);
    updateClickSelectionUI();   // 复用舞台也恢复已结束的点选提示；底层目标状态仍由战斗命令管理。
    // 手牌分栏切换（2026-09-10 留言 #27）
    UI.act('btHandPage', () => { handPage = (handPage + 1) % handPages; render(); });
    // sts-note 底部说明行已删（留言 2026-09-06：把下面的文字都去掉）
    const playHandCard = (d) => {
      if (!/** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-stage')) || /** @type {BattleElement} */ (UI.el.ovBody.querySelector('.battle-secondary-layer')) || getSnapshot().battleToken !== snapshot.battleToken) return;
      if (Date.now() - aimPlayedAt < 300) return;   // 指向松手刚打出，忽略残留 click
      const snap = getSnapshot();
      if (snap.infusing) {
        if (!infusing || snap.infusing.selectionId !== infusing.selectionId) return;
        if (groups.some(group => group.uids[0] === d.uid)) commands.selectInfusion(d.uid);
      }
      else selectCardByClick(d.uid, false, { autoSingleTarget: false });
    };
    UI.act('btPlay', playHandCard);
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btEnd', () => {
      const current = getSnapshot(), forecast = forecastEnemyTurn(current);
      if (!forecast.lethal) { endTurn(); return; }
      showBattleDecision('回合结束可能致死', `<p class="ov-stats">当前 ${current.player.hp} 生命；估算承伤 ${forecast.damage}。</p><p class="ov-note">${forecast.note}</p><div class="ov-btns"><button class="ov-btn" data-act="btRiskBack">返回操作</button><button class="ov-btn" data-act="btRiskContinue">仍然结束回合</button></div>`, 'settings', current);
      bindBattlePageAction({ UI, getSnapshot, snapshot:current }, 'btRiskBack', () => render());
      bindBattlePageAction({ UI, getSnapshot, snapshot:current }, 'btRiskContinue', () => {
        if (getSnapshot().battleToken !== current.battleToken) return;
        render(); endTurn();
      });
    }, '.battle-stage');
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btBossRules', () => {
      const rules = mode === 'boss'
        ? `<p class="ov-stats">选择 ${R().bossDeckSize} 张招式、装备或能力卡，另加入 ${R().starterSha} 张初始攻击；不足时按可编数量开战。</p><p class="ov-note">开局抽 ${R().battleStartDraw} 张，每回合抽 ${R().battleTurnDraw} 张，手牌上限 ${R().battleHandMax}。打出、弃置或消耗的牌统一进入消耗牌堆，不自动洗回，仅由卡牌效果取回。开战装备计入编组，混沌之眼增加5张上限。</p>`
        : '<p class="ov-stats">随身可用牌开局入手，另有 99 张初始攻击组成的本场牌库。</p><p class="ov-note">开局和每回合不自动抽牌，只有抽牌效果从牌库取牌；库空后不补牌。打出、弃置或消耗的牌统一进入消耗牌堆，仅由卡牌效果取回。</p>';
      showBattleDecision(mode === 'boss' ? '首脑战 · 牌库规则' : '普通战 · 效果抽牌', `${rules}<div class="ov-btns"><button class="ov-btn" data-act="btRulesBack">返回战斗</button></div>`, 'settings', getSnapshot());
      bindBattlePageAction({ UI, getSnapshot, snapshot:getSnapshot() }, 'btRulesBack', () => render());
    }, '.battle-stage');
    // 战斗设置（2026-09-13 留言：战斗界面保留设置键）——轻量浮层，不动 game.state，
    // 关闭直接重渲染战斗（openSettings 全功能版会清 overlay 导致战斗界面丢失）
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btSettings', () => {
      showBattleDecision('[[icon:gear]] 战斗设置', `
        <div class="bt-settings">
          <label class="chk"><input type="checkbox" id="btSetMusic" ${SDT.Sound.musicMuted ? '' : 'checked'}> 背景音乐</label>
          <label class="chk"><input type="checkbox" id="btSetSfx" ${SDT.Sound.sfxMuted ? '' : 'checked'}> 音效</label>
          <label class="chk"><input type="checkbox" id="btSetShake" ${storeGet('sdt-reduce-shake') === '1' ? '' : 'checked'}> 屏幕震动反馈</label>
          <label class="chk"><input type="checkbox" id="btSetPace" ${getPace() === 2 ? 'checked' : ''}> 2× 战斗节奏（敌方行动加速）</label>
          ${battleRestartHTML({ SDT, game: SDT.game, buttonClass: 'ov-btn' })}
          <p class="ov-note">完整设置可在基地 / 标题页打开。关闭后回到战斗。</p>
          <div class="ov-btns"><button class="ov-btn ok" data-act="btSettingsBack">[[icon:cross]] 返回战斗</button></div>
        </div>`, true);
      // 迭代评审 09-20：删除无参 setDucked()——它被 setDucked 内部 !!v 强转成 false，
      // 战斗中关音乐会静默解除侧链压低；setMusicMuted 内部已走 syncBgm，无需额外调用
      const settingsPage = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('.battle-decision'));
      bindBattleRestart({ SDT, UI, game: SDT.game, page: settingsPage });
      const onSetting = handler => event => {
        if (isInteractiveBattlePage(UI, settingsPage) && getSnapshot().battleToken === snapshot.battleToken) handler(event);
      };
      const syncMusic = (on) => { SDT.Sound.setMusicMuted(!on); };
      document.getElementById('btSetMusic').addEventListener('change', onSetting((e) => syncMusic(e.target.checked)));
      document.getElementById('btSetSfx').addEventListener('change', onSetting((e) => { SDT.Sound.setSfxMuted(!e.target.checked); }));
      document.getElementById('btSetShake').addEventListener('change', onSetting((e) => { storeSet('sdt-reduce-shake', e.target.checked ? '0' : '1'); }));
      // 2× 演示倍率（迭代评审 09-20）：单一倍率同步缩放步进/序列帧/前摇/飘字四处时长（battle.pace.js）
      document.getElementById('btSetPace').addEventListener('change', onSetting((e) => { setPace(e.target.checked ? 2 : 1); }));
      bindBattlePageAction({ UI, getSnapshot, snapshot:getSnapshot() }, 'btSettingsBack', () => render());
    }, '.battle-stage');
    // U4（2026-09-19 走查）：BOSS 态两钮不再 disabled——点了给 log+音效说明原因，
    // 不再让玩家对着灰按钮悬停猜（dis 类保留禁用观感，但可接收点击）。
    UI.act('btFlee', () => {
      if (getSnapshot().opts.isBoss) {
        UI.log('[[icon:lock]] BOSS 战不可撤离——击败首脑或战败即终局', 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      // 撤离=判负不可逆：两步确认防误触（同设置弹窗危险钮模式，2.6 秒后自动还原）。
      // W2-01（2026-09-27 R2）：arm 态此前只换文本——.arm 类全 css 无样式（评审实锤
      // 「无色彩升级」），不可逆钮埋在低危排里第二击即判负，危险度必须映射到视觉
      // 维度（透镜 #66）。battle.css 冻结、独立片 include 管线未通 → 模块级注入
      // 样式表（head 内 .ov-btn.ghost.arm 规则，!important 压 winter 底式）；实测
      // 异步环节可能剥 style 属性但不动 class，故样式挂类、内联仅作双保险。
      const btn = /** @type {BattleElement} */ (document.querySelector('#ovBody [data-act="btFlee"]'));
      if (!btn || btn.dataset.confirm) { surrender(); return; }   // 玩法定版：主动撤离=本局失败（烟雾弹走 fleeBattle 豁免）
      const prev = btn.innerHTML;
      const prevStyle = btn.getAttribute('style') || '';   // 模板自带的 margin:0 12px（危险钮间距分级）还原基准
      btn.dataset.confirm = '1';
      btn.innerHTML = SDT.Icons.rich('[[icon:runner]] 确认撤离？');
      btn.classList.add('arm');
      Object.assign(btn.style, {
        color: '#f6ddd6', background: '#61241f', borderColor: '#c96a5c',
        boxShadow: '0 0 10px rgba(201,106,92,.45), inset 0 0 8px rgba(120,40,32,.5)',
        transform: 'scale(1.07)',
      });
      setTimeout(() => {
        if (btn.isConnected) {
          delete btn.dataset.confirm; btn.classList.remove('arm'); btn.innerHTML = prev;
          btn.setAttribute('style', prevStyle);
        }
      }, 2600);
    });
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btGrave', () => { if (!getSnapshot().infusing) openGrave(); }, '.battle-stage');
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btDeck', () => { if (!getSnapshot().infusing) openDeckView(); }, '.battle-stage');
    UI.act('btDeckBack', closeDeckView);
    UI.act('btSlam', () => {
      if (Date.now() - aimPlayedAt < 300) return;   // 拖拽松手刚砸完，忽略残留 click（同药水栏口径）
      bagSlam();
    });   // 背包砸击按钮（2026-09-16 老板：改回按钮形态，置于手牌左侧）；09-20 老板：支持按住拖到敌人身上松手释放
    UI.act('btInfuseStart', (d) => commands.beginInfusion(d.uid));
    UI.act('btEquipSkill', (d) => useEquipSkill(d.uid));   // 已穿戴装备的限定技能（老板 #9）
    // —— 药水栏（2026-09-12 老板定向）：点击使用；敌方指向药水按住可拖到敌人身上 ——
    UI.act('btPotion', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 拖拽刚松手，忽略残留 click
      potionUse.open(d.uid);
    });
    const body = UI.el.ovBody;
    // —— 药水栏/砸击绑定：节点跨渲染保留（syncBattleSlot 差分命中即复用旧节点），dataset 标记
    // 去重防监听器无界累积（此前每次 render 重挂，几十次渲染=同节点 N 套闭包）——
    /** @type {NodeListOf<BattleElement>} */ (body.querySelectorAll('.bt-potion[data-potion-aim="1"]')).forEach(el => {
      if (el.dataset.aimBound) return;
      el.dataset.aimBound = '1';
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el, 'potion'); });
    });
    // 砸击拖动释放（09-20 老板）：按住砸击按钮拖到敌人身上松手=结算；轻点仍走 btSlam 点选流
    /** @type {NodeListOf<HTMLButtonElement>} */ (body.querySelectorAll('.bt-slam-btn')).forEach(el => {
      if (el.dataset.aimBound) return;
      el.dataset.aimBound = '1';
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el, 'slam'); });
    });
    // —— 指向施法（炉石/杀戮尖塔式）：按住指向卡轻微拎起，弯曲箭头跟随指针 ——
    //    指向敌人 = 红色箭头，指向自己（立绘）= 绿色箭头；松手在目标身上即打出，
    //    松手没目标自动取消回手牌；轻点先放大查看，再明确确认使用。
    // 敌人点选（砸击/药水点选）已改在单位常驻层创建槽位时绑一次（见 mountUnitLayer），
    // 不再随渲染重复挂——点击时读 getSnapshot() 实时态，避免闭包过期
    // 固定选区输入由常驻手牌层统一绑定，普通 click 复用同一个 playHandCard。
    // 人物去纸色背景，像模型一样站在场景里（art.js 内按图缓存，二次渲染零成本）
    // 手牌常驻层挂载 + 差分更新（批次A）：出牌动画事件已在 render 开头取样，常驻层与克隆飞行共用
    // 单位区常驻层挂载 + 差分更新（批次B）：玩家/随从/敌人节点跨渲染复用（须在手牌层之前挂载）
    const unitMounts = mountUnitLayer(body, snapshot.battleToken);
    if (unitMounts) updateUnits(unitMounts, snapshot, { isBoss: opts.isBoss, pendingTarget, pendingItem, slamPending, dartPending });
    // Selection instructions and cancellation share the status strip; no duplicate bubble.
    /** @type {BattleElement} */ (body.querySelector('.bt-thought-bubble[data-target-prompt]'))?.remove();
    if (SDT.Art.cutoutFigures) SDT.Art.cutoutFigures(body);
    const entryStage = /** @type {BattleElement} */ (body.querySelector('.battle-stage.sts'));
    const simplifiedEntry = entryStage?.dataset.battleEntry === 'degraded';
    // 本场已选择简化显示时，选择面板返回也保留该结果，不重新创建失败的 GPU 画面。
    // The frame host is an overlay sibling, above the stage's stacking context.
    // Selection suspends it while the card workspace owns the foreground.
    if (infusingNow) hideUnitFrames();
    const framesReady = infusingNow || simplifiedEntry ? true : attachUnitFrames(body);   // 首次揭示等待实际帧首画面。
    // 静态冬城图层独立于 GPU 单位帧；简化显示仍保留它，面板返回时按场次重建。
    const paintedReady = syncBattleScenery(entryStage, snapshot.battleToken, captureBattleScenery(snapshot, SDT.game?.layerIdx || 0));
    mountHandLayer(body, tip, snapshot.battleToken, playHandCard);
    showBattleStartEquipFlash(snapshot.equipped, snapshot.battleToken);
    const focusedHandUid = snapshot.infusing && document.activeElement instanceof HTMLElement
      ? /** @type {BattleElement} */ (document.activeElement.closest('.sts-hand .bt-card'))?.dataset.uid : null;
    const handAnim = updateHand(snapshot, prevView, pageGroups, animEvents, { spellBonus, mode, discoverSrcRect });
    renderInfusionSelection({ UI, snapshot, getSnapshot, findCard, infusionFuelReason, targetSide, commands, focusedHandUid, cardHTML:(card, size) => SDT.Cards.cardHTML(card, size) });
    potionUse.sync(entryStage, snapshot, potions);
    if (simplifiedEntry) battleEntry.begin(entryStage, snapshot.battleToken, UI.el.overlay);
    if (battleEntry.pending(entryStage)) {
      const images = waitForBattleImages(entryStage);
      battleEntry.wait(entryStage, snapshot.battleToken, [paintedReady, framesReady, images.promise], {
        cancelImages: images.cancel,
        onFallback: () => { hideUnitFrames(); },
      });
    }
    discoverSrcRect = null;
    if (preserveAim) resumeAimAfterRender(snapshot);
    // 牌局动画：离场克隆飞行 / 手牌区随回合显隐 / 能量与牌堆脉冲
    const anim = animateBattleTransition(prevView, body, animEvents, handAnim.flightMs);
    // BOSS 登场演出：竖线阴影压过场景 2.4s（每场一次）+ 开始动画（暗幕+立绘+名号亮相，约 1.5s）
    if (opts.isBoss && !dreadShown) {
      markDreadShown();
      const st = /** @type {BattleElement} */ (body.querySelector('.battle-stage'));
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
          <div class="boss-intro-art${SDT.game?.nestActive ? '' : ' sts-figure'}">${art}</div>
          <div class="boss-intro-title">${esc(bossName)}</div>
        </div>`;
      const ovEl = UI.el.overlay;
      if (!SDT.game?.nestActive) SDT.Art?.cutoutFigures?.(intro);
      if (ovEl) {
        ovEl.appendChild(intro);
        schedulePresentationMs(() => intro.remove(), 1800);   // 动画 1.6s + 缓冲后移除
      }
    }
    spawnFloats(body, anim.flightMs ? Math.min(340, anim.flightMs * 0.8) : 0);
    UI.refresh(SDT.game);
    return battleEntry.ready(entryStage, snapshot.battleToken);
  }


  export const Battle = Object.freeze({ ...BattleSession,
    presentVictory,
    _perf: Object.freeze({ frameCacheStats }),
    _test: Object.freeze({ refillDrawPile }),
  });
  sdtDefine('Battle', Battle);

configureBattleRenderer(render);

/* W2-01（2026-09-27 R2）：撤离 arm 态样式。battle.css 冻结、独立片 include 管线
 * 未通 → 模块级向 head 注入一条规则（term-tips 的「模块执行时 DOM 已解析」同款
 * 直接挂法）。!important 压 winter.css .ov-btn 底式；实测异步环节可能剥按钮的
 * style 属性但不动 class，故视觉挂 .arm 类而非内联。 */
/* W3-02（2026-09-27 R2）：熟练度进度微条样式（顶栏 sts-encounter 尾部）。
 * 主色=暗金弱存在（不与回合信息争权重，透镜 #66 通道分权）；hairline 进度条。 */
if (!document.getElementById('stsXpChipStyle')) {
  document.head.insertAdjacentHTML('beforeend',
    '<style id="stsXpChipStyle">.sts-xp-chip{display:inline-flex;align-items:center;gap:6px;margin-left:12px;padding:2px 9px;border:1px solid rgba(217,187,130,.3);border-radius:999px;background:rgba(10,20,28,.55);color:#cbb795;font-size:10.5px;letter-spacing:.5px;vertical-align:middle}.sts-xp-chip .sts-xp-bar{display:inline-block;width:52px;height:4px;border-radius:999px;background:#0b141c;overflow:hidden}.sts-xp-chip .sts-xp-bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a25a,#ecd9ad)}</style>');
}
if (!document.getElementById('btFleeArmStyle')) {
  document.head.insertAdjacentHTML('beforeend',
    '<style id="btFleeArmStyle">.ov-btn.ghost.arm{color:#f6ddd6!important;background:#61241f!important;border-color:#c96a5c!important;box-shadow:0 0 10px rgba(201,106,92,.45),inset 0 0 8px rgba(120,40,32,.5)!important;transform:scale(1.07)!important}</style>');
}

export { render };
