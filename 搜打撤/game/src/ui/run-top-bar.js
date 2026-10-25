import { registerScreenOwner } from './screen-owner.js';
import { battleSettingsIcon } from './battle-menu-icons.js';
import { playerCombatStatValues } from './battle-hud-info.js';
import { updateMapHealthHud } from './map-health-hud.js';
import './run-top-bar.css';
import '../../css/archive-back.css';

const configurations = new WeakMap();
const mounted = new WeakMap();
const overlayControllers = new WeakMap();
const actionOwners = new WeakMap();
export function configureRunTopBar(UI, actions) {
  configurations.set(UI, actions);
  const doc = actions.document || document;
  for (const id of ['btnHome', 'btnMute']) {
    const button = doc.getElementById(id);
    if (!button) continue;
    const bound = actionOwners.has(button);
    actionOwners.set(button, UI);
    if (bound) continue;
    button.addEventListener('click', event => {
      event.stopPropagation();
      const current = configurations.get(actionOwners.get(button));
      if (id === 'btnHome') {
        const owner = actionOwners.get(button);
        const scene = !owner?.el?.overlay?.hidden && owner.el?.ovBody?.querySelector('.event-themed');
        if (scene && typeof owner._acts?.eventExit === 'function') owner._acts.eventExit();
        else current?.openLeaveMenu?.();
      }
      else {
        const sound = current?.readSound?.();
        if (sound) sound.setMuted(!sound.muted);
        button.classList.toggle('muted', !!sound?.muted);
        button.setAttribute('aria-pressed', String(!!sound?.muted));
      }
      mounted.get(UI)?.syncMute();
    });
  }
  mounted.get(UI)?.syncMute();
}
export function refreshRunTopBar(UI, game) {
  const controller = mounted.get(UI);
  if (!controller) return;
  controller.game = game;
  if (game.battleActive === false) controller.battle = null;
  controller.syncStats();
  controller.syncMute();
  controller.syncLocation();
}

export function setRunTopBarBattleStats(UI, snapshot) {
  const controller = mounted.get(UI);
  if (!controller || !snapshot.player) return;
  const values = playerCombatStatValues(snapshot.player, snapshot.pstat?.status);
  controller.battle = { ...snapshot.player, atk:values.atk, atkBase:snapshot.player.atk || 0,
    atkBonus:values.atkBuff, token:snapshot.battleToken };
  controller.syncStats();
}
export function runTopBarPlayerView(UI, game) {
  return game.battleActive !== false && mounted.get(UI)?.battle || game;
}
export function setRunTopBarBattleOptions(UI, stage) {
  const controller = mounted.get(UI);
  if (!controller) return;
  controller.stage = stage;
  controller.syncOptions();
}
// Overlay mode broadcasts precede its guarded commit. Read final page ownership
// only after the overlay has committed visibility and background isolation.
export function syncCommittedRunTopBar(owner) {
  // Entry readiness owns the overlay element, while page commits own the UI port.
  (mounted.get(owner) || overlayControllers.get(owner))?.syncOptions();
}

// One physical header owns both map and battle controls. Moving the same nodes
// preserves HUD references/listeners; room controls live inside the modal boundary.
export function installRunTopBar(UI) {
  if (mounted.get(UI)?.bar.isConnected) return mounted.get(UI);
  const doc = UI.el?.viewport?.ownerDocument || document;
  const bar = doc.createElement('header');
  bar.id = 'runTopBar'; bar.className = 'run-topbar';
  bar.setAttribute('aria-label', '远征状态与系统');
  const actions = doc.createElement('nav'); actions.className = 'run-top-actions'; actions.setAttribute('aria-label', '系统操作');
  const person = doc.createElement('div'); person.className = 'run-top-person';
  const resources = doc.createElement('div'); resources.className = 'run-top-resources';
  const secondary = doc.createElement('div'); secondary.className = 'run-top-secondary';
  const move = (id, parent, action) => {
    const node = doc.getElementById(id);
    if (node) { parent.append(node); if (action) node.dataset.runAction = action; }
    return node;
  };
  move('btnHome', actions, 'leave'); move('btnMute', actions, 'mute');
  const optionsButton = doc.createElement('button');
  optionsButton.id = 'btnBattleOptions'; optionsButton.type = 'button'; optionsButton.hidden = true;
  optionsButton.innerHTML = battleSettingsIcon;
  optionsButton.setAttribute('aria-label', '战斗设置');
  optionsButton.title = '战斗设置';
  optionsButton.setAttribute('aria-haspopup', 'dialog');
  actions.append(optionsButton);
  const avatar = move('heroAva', person);
  if (avatar) { delete avatar.dataset.runAction; avatar.setAttribute('aria-label', '人物头像'); avatar.removeAttribute('aria-expanded'); }
  move('hpHud', person);
  move('resHud', resources);
  const gold = resources.querySelector('.res-gold'), attack = resources.querySelector('.res-atk');
  if (gold) gold.dataset.runAction = 'gold';
  if (attack) attack.dataset.runAction = 'attack';
  const location = doc.createElement('div'); location.className = 'run-top-location';
  move('expeditionChapter', location);
  const status = doc.createElement('div'); status.id = 'saveStatus'; status.className = 'save-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.innerHTML = '<span data-save-label>尚未保存</span><button type="button" data-run-action="retry" data-save-retry hidden>重试保存</button>';
  secondary.append(status);
  const detail = doc.createElement('section'); detail.className = 'run-top-detail'; detail.hidden = true;
  detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-label', '远征状态说明');
  detail.innerHTML = '<h2></h2><p></p><button type="button" data-run-action="close">返回</button>';
  bar.append(actions, person, location, resources, secondary, detail);
  let returnFocus = null, releaseOwner = null, initialized = false;
  const closeDetail = () => {
    if (detail.hidden) return;
    detail.hidden = true; releaseOwner?.(); releaseOwner = null;
    returnFocus?.setAttribute('aria-expanded', 'false');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll:true });
  };
  const getActions = () => configurations.get(UI);
  const controller = {
    bar, game:null, battle:null, stage:null,
    syncOptions() {
      const stage = controller.stage;
      const retained = stage?.isConnected && stage.parentNode === UI.el?.ovBody && !UI.el?.overlay?.hidden;
      const secondary = retained && UI.el.ovBody.querySelector(':scope > .battle-secondary-layer');
      const game = getActions()?.readState?.().game || controller.game;
      const coveredBattle = game?.battleActive && controller.battle && !UI.el?.overlay?.hidden && !retained;
      const interactive = retained && UI._lastMode === 'battle' && !stage.inert
        && !stage.closest('[inert],[hidden],[aria-hidden="true"]') && !bar.closest('[inert]');
      // System/help pages may replace the scene while combat stays active.
      // Keep their controls aligned; action guards still require a live stage.
      optionsButton.hidden = !(interactive || secondary || coveredBattle);
    },
    syncStats() {
      const stats = controller.battle;
      if (!stats) return;
      const attack = bar.querySelector('#charAtk');
      if (attack) attack.textContent = String(stats.atk);
      updateMapHealthHud(bar.querySelector('#hpHud'), { hp:stats.hp, maxHp:stats.maxHp, active:true });
    },
    syncMute() {
      const mute = bar.querySelector('#btnMute'), sound = getActions()?.readSound?.();
      if (!mute || !sound) return;
      mute.classList.toggle('muted', !!sound.muted);
      mute.setAttribute('aria-pressed', String(!!sound.muted));
      mute.setAttribute('aria-label', sound.muted ? '开启音效与音乐' : '静音音效与音乐');
    },
    syncLocation() {
      if (initialized && !bar.isConnected) return;
      initialized = true;
      const room = UI.el?.overlay && !UI.el.overlay.hidden && !doc.body.classList.contains('lobby');
      const host = room ? UI.el.overlay : UI.el?.viewport || doc.getElementById('viewport') || doc.body;
      if (host && bar.parentNode !== host) host.prepend(bar);
      bar.hidden = doc.body.classList.contains('lobby');
      bar.dataset.surface = room && (UI._lastMode === 'battle' || UI._hasBattleStage) ? 'battle' : room ? 'room' : 'map';
      const node = room && UI.el?.ovBody?.querySelector('.event-themed');
      bar.querySelector('#btnHome')?.setAttribute('aria-label', node ? '返回地图' : '离开对局');
      controller.syncOptions();
    },
  };
  optionsButton.addEventListener('click', event => {
    event.stopPropagation(); closeDetail();
    controller.syncOptions();
    if (!optionsButton.hidden && UI._lastMode === 'battle' && !controller.stage?.inert
        && !controller.stage?.closest('[inert],[hidden],[aria-hidden="true"]') && !bar.closest('[inert]')) UI._acts?.btSettings?.({});
  });
  const showDetail = (kind, trigger) => {
    const live = getActions()?.readState?.().game || controller.game;
    if (!live) return;
    const game = controller.battle ? { ...live, ...controller.battle } : live;
    closeDetail(); returnFocus = trigger;
    const descriptions = {
      gold:['金币', `当前持有 ${game.coins || 0} 币，可用于商店交易。`],
      attack:['攻击力', controller.battle
        ? `当前攻击 ${game.atk}。基础攻击 ${game.atkBase}${game.atkBonus ? `，攻击强化 +${game.atkBonus}` : ''}；与场内攻击读数一致。攻击伤害按卡牌数值加攻击力结算。`
        : `当前基础攻击 ${game.atk || 0}。攻击伤害按卡牌数值加攻击力结算；战斗中的临时加成与减益见状态栏。`],
    };
    const content = descriptions[kind]; if (!content) return;
    detail.querySelector('h2').textContent = content[0]; detail.querySelector('p').textContent = content[1];
    detail.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    releaseOwner = registerScreenOwner({ root:detail, priority:110, onBack:closeDetail });
    detail.querySelector('button').focus({ preventScroll:true });
  };
  bar.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-run-action]');
    if (!trigger || !bar.contains(trigger)) return;
    event.stopPropagation();
    const action = trigger.dataset.runAction;
    if (action === 'retry') UI._retrySave?.();
    else if (action === 'close') closeDetail();
    else showDetail(action, trigger);
  });
  doc.addEventListener('pointerdown', event => {
    if (!bar.contains(event.target) || event.target.closest?.('#hpHud')) closeDetail();
  });
  detail.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); detail.querySelector('button').focus(); }
  });
  doc.addEventListener('sdt-overlay-mode', () => { closeDetail(); controller.syncLocation(); });
  doc.addEventListener('sdt-overlay-close', () => {
    if (!bar.isConnected) return;
    closeDetail(); controller.battle = null; controller.stage = null; controller.syncOptions();
    // The overlay restores this shared node after its departure has finished.
    // Moving it at close-request time makes the header vanish before the scene.
    bar.hidden = doc.body.classList.contains('lobby');
  });
  doc.addEventListener('sdt-save-state', event => {
    const message = event.detail || {};
    if (status.dataset.state === 'failed' && message.scope === 'run' && message.state !== 'failed') return;
    status.dataset.state = message.state;
    status.querySelector('[data-save-label]').textContent = message.message || (message.state === 'saving' ? '保存中…' : message.state === 'failed' ? '保存失败' : '已保存');
    status.querySelector('[data-save-retry]').hidden = message.state !== 'failed';
  });
  mounted.set(UI, controller);
  if (UI.el?.overlay) overlayControllers.set(UI.el.overlay, controller);
  controller.syncLocation(); controller.syncMute();
  return controller;
}
