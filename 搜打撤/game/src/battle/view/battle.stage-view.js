import { escAttr } from '../../core/shared.js';
import { setRunTopBarBattleOptions } from '../../ui/run-top-bar.js';

// A battle owns its shell and the small HUD regions inside it. These records are
// presentation-only: no state is attached to the game, snapshot, or save data.
const renderGuards = new WeakMap();
export const setBattleRenderGuard = (UI, guard) => renderGuards.set(UI, guard);
export const getBattleRenderGuard = UI => renderGuards.get(UI) || (() => true);
const renderedClasses = new WeakMap();
const desiredClasses = new WeakMap();
const noClasses = Object.freeze([]);
const controlledStates = {
  'bt-potion':['off', 'need-target'], 'bt-slam-btn':['active'],
  'bt-turn-forecast':['lethal'], 'sts-end-turn':['ok'],
  'sts-phase-dot':['self', 'foe', 'focus', 'warn'],
};
const controlledAttribute = name => /^(aria-|data-ui-tip|data-act$|data-uid$|data-potion-|data-skill-|data-hand-page-)/.test(name)
  || ['role', 'tabindex', 'title', 'disabled', 'type', 'src', 'alt', 'draggable', 'decoding'].includes(name);
const setAttribute = (node, name, value) => {
  if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
  else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
};
const setText = (node, value) => { if (node.textContent !== String(value)) node.textContent = String(value); };
function syncClasses(node, names) {
  // Mount identities usually own one class; avoid allocating a token set.
  if (!names.includes(' ')) {
    if (names && !node.classList.contains(names)) node.classList.add(names);
    return;
  }
  for (const name of names.split(/\s+/)) if (name && !node.classList.contains(name)) node.classList.add(name);
}
function desiredClassState(node) {
  const text = node.getAttribute('class') || '';
  let desired = desiredClasses.get(node);
  if (!desired || desired.text !== text) {
    const tokens = text ? text.split(/\s+/).filter(Boolean) : noClasses, absent = [];
    for (const base in controlledStates) {
      if (tokens.includes(base)) for (const state of controlledStates[base]) if (!tokens.includes(state)) absent.push(state);
    }
    // Action identity belongs to parsed markup; scalar prepare hooks never change it.
    if (node.getAttribute('data-act') === 'btFlee' && !tokens.includes('dis')) absent.push('dis');
    desired = { text, tokens, absent };
    desiredClasses.set(node, desired);
  }
  return desired;
}
function patchClasses(live, next, previousTree) {
  const desired = desiredClassState(next);
  // A replacement clone has no live record. Retain the old desired tree as
  // the cold ownership fallback, without copying any child collections.
  const previous = renderedClasses.get(live)
    || (previousTree?.nodeType === 1 ? desiredClassState(previousTree).tokens : noClasses);
  if (previous !== desired.tokens) {
    for (const name of previous) if (!desired.tokens.includes(name)) live.classList.remove(name);
    renderedClasses.set(live, desired.tokens);
  }
  // Repair unexpected controlled states too (notably potion.off blocks input),
  // while animation/hover/confirmation classes remain outside this ownership.
  for (const name of desired.absent) if (live.classList.contains(name)) live.classList.remove(name);
  // Cached desired tokens do not bypass live repair of externally removed classes.
  for (const name of desired.tokens) if (!live.classList.contains(name)) live.classList.add(name);
}
function compatible(live, next) {
  if (!live || live.nodeType !== next.nodeType || live.nodeName !== next.nodeName) return false;
  // Potion controls have different ownership for aimed / non-aimed / disabled
  // controls. A change of that role gets a fresh control, never both listeners.
  return next.nodeType !== 1 || !next.classList.contains('bt-potion')
    || (live.getAttribute('data-potion-aim') === next.getAttribute('data-potion-aim')
      && live.getAttribute('role') === next.getAttribute('role')
      && live.getAttribute('data-uid') === next.getAttribute('data-uid'));
}
function patchNode(live, next, previous, retainChild) {
  if (next.nodeType !== 1) {
    if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue;
    return;
  }
  patchClasses(live, next, previous);
  const liveAttributes = live.attributes, desiredAttributes = next.attributes;
  // Removal walks backwards; other validation reads the current collections
  // directly, without allocating two child arrays and an attribute array/node.
  for (let i = liveAttributes.length - 1; i >= 0; i--) {
    const attr = liveAttributes[i];
    if (attr.name !== 'class' && controlledAttribute(attr.name) && !next.hasAttribute(attr.name)) live.removeAttribute(attr.name);
  }
  for (let i = 0; i < desiredAttributes.length; i++) {
    const attr = desiredAttributes[i];
    if (attr.name === 'class' || attr.name === 'hidden' && next.hasAttribute('data-potion-tip')) continue;
    // The acquisition subsystem owns its badge and label suffix, not the base label.
    if (attr.name === 'aria-label' && retainChild) {
      const label = live.getAttribute('aria-label') || '';
      if (label !== attr.value && label.replace(/，其他栏新增 \d+ 张手牌$/, '') === attr.value) {
        let badge = live.lastElementChild;
        while (badge && !retainChild(live, badge)) badge = badge.previousElementSibling;
        if (badge) continue;
      }
    }
    setAttribute(live, attr.name, attr.value);
  }
  if (next.getAttribute('data-act') === 'btFlee' && live.dataset.confirm) return;
  // Hover text is transient presentation, not the potion region's children.
  if (next.hasAttribute('data-potion-tip')) return;
  let child = live.firstChild, previousChild = previous?.firstChild;
  for (let wanted = next.firstChild; wanted; wanted = wanted.nextSibling) {
    if (!compatible(child, wanted)) {
      const replacement = wanted.cloneNode(true);
      if (child) child.replaceWith(replacement); else live.appendChild(replacement);
      child = replacement;
    }
    patchNode(child, wanted, previousChild);
    child = child.nextSibling; previousChild = previousChild?.nextSibling;
  }
  while (child) {
    const following = child.nextSibling;
    if (!retainChild?.(live, child)) child.remove();
    child = following;
  }

}
function shellHTML(view) {
  return `<div class="battle-stage sts battle-sts" data-asset-key="${escAttr(view.assetKey)}" data-boss="${view.isBoss ? '1' : '0'}">
    <div class="battle-stage-shade"></div>
    <div class="sts-topbar"><div class="sts-encounter"></div></div>
    <div class="sts-arena"><div data-unit-mount="self"></div><div class="sts-allies" data-unit-mount="allies"></div><div class="sts-foes" data-unit-mount="foes"></div></div>
    <div class="sts-hud"><div class="sts-resource-dock"><div class="sts-hud-l" aria-label="抽牌堆"></div>
      <div class="sts-energy-wrap"><div class="sts-energy" role="group" tabindex="0"><img class="battle-energy-emblem battle-control-icon" src="${escAttr(view.energyArt)}" alt="" draggable="false" decoding="async"><span class="battle-control-value"><b></b><span></span></span></div></div></div>
      <div class="sts-hand-tools" aria-label="职业技能"></div><div class="sts-hud-r" aria-label="消耗牌堆"></div>
      <div class="bt-hand sts-hand" role="group" aria-label="当前手牌"></div>
      <div class="sts-tactics" aria-label="战术操作"><button class="ov-btn sts-end-turn" data-act="btEnd">结束回合</button></div>
    </div></div>`;
}
function element(parent, className, attributes = {}) {
  const node = document.createElement('div'); node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.appendChild(node); return node;
}
// Parent checks are deliberately live. A cached reference never makes a removed
// or externally replaced mount invisible to subsequent renders.
function mount(owner, key, parent, selector, create) {
  let node = owner[key];
  if (node?.parentNode !== parent) node = parent.querySelector(`:scope > ${selector}`) || create();
  // The cached identity is stronger than a mutable class/attribute selector.
  // Repair that identity instead of appending a duplicate visible container.
  if (selector.startsWith('.')) syncClasses(node, selector.slice(1));
  else {
    const attribute = /^\[([^=]+)="([^"]+)"\]$/.exec(selector);
    if (attribute) setAttribute(node, attribute[1], attribute[2]);
  }
  owner[key] = node; return node;
}
function repairMounts(owner) {
  const stage = owner.stage;
  const arena = mount(owner, 'arena', stage, '.sts-arena', () => element(stage, 'sts-arena'));
  const hud = mount(owner, 'hud', stage, '.sts-hud', () => element(stage, 'sts-hud'));
  mount(owner, 'topbar', stage, '.sts-topbar', () => { const node = element(stage, 'sts-topbar'); arena.before(node); return node; });
  if (owner.self?.parentNode !== arena) owner.self = arena.querySelector(':scope > #btSelf, :scope > [data-unit-mount="self"]') || element(arena, '', { 'data-unit-mount':'self' });
  mount(owner, 'allies', arena, '[data-unit-mount="allies"]', () => element(arena, 'sts-allies', { 'data-unit-mount':'allies' }));
  mount(owner, 'foes', arena, '[data-unit-mount="foes"]', () => element(arena, 'sts-foes', { 'data-unit-mount':'foes' }));
  mount(owner, 'dock', hud, '.sts-resource-dock', () => element(hud, 'sts-resource-dock'));
  mount(owner, 'hand', hud, '.sts-hand', () => element(hud, 'bt-hand sts-hand', {role:'group','aria-label':'当前手牌'}));
  const toolsHost = owner.self.querySelector(':scope > .sts-unit-vitals > .sts-unit-actions') || owner.self;
  if (owner.tools?.parentNode !== hud && owner.tools?.parentNode !== toolsHost) {
    owner.tools = toolsHost.querySelector(':scope > .sts-hand-tools') || owner.self.querySelector(':scope > .sts-hand-tools') || hud.querySelector(':scope > .sts-hand-tools')
      || element(hud, 'sts-hand-tools', { 'aria-label':'职业技能' });
  }
  syncClasses(owner.tools, 'sts-hand-tools');
  setAttribute(owner.tools, 'aria-label', '职业技能');
  mount(owner, 'tactics', hud, '.sts-tactics', () => element(hud, 'sts-tactics', { 'aria-label':'战术操作' }));
}
function region(owner, key, parent, selector, html, rich, before = null, prepare = null, retainChild = null) {
  let record = owner.regions.get(key);
  if (!record) { record = { html:null, tree:null, node:null }; owner.regions.set(key, record); }
  const previous = record.tree;
  if (record.html !== html) {
    const template = document.createElement('template');
    template.innerHTML = rich(html);
    record.tree = template.content.firstElementChild; record.html = html;
  }
  if (record.node?.parentNode !== parent) record.node = parent.querySelector(`:scope > ${selector}`);
  if (!record.tree) { record.node?.remove(); record.node = null; return null; }
  if (!compatible(record.node, record.tree)) {
    const next = record.tree.cloneNode(true);
    if (record.node) record.node.replaceWith(next); else parent.insertBefore(next, before?.parentNode === parent ? before : null);
    record.node = next;
  }
  prepare?.(record.tree);
  patchNode(record.node, record.tree, previous, retainChild);
  return record.node;
}

export function createBattleStageView({ UI, rich, onReplace, onMount, onPotionsChange, ownsHandPageFeedback, ownsPotionPanel }) {
  let current = null;
  /** @param {{ backgroundOnly?: boolean, isCurrent?: () => boolean, validateHost?: () => boolean }} [options] */
  function show(view, options = {}) {
    const { backgroundOnly = false, isCurrent = () => true, validateHost = () => true } = options;
    const body = UI.el.ovBody;
    let owner = current;
    const canReuse = owner && owner.body === body && owner.token === view.token && owner.stage._battleToken === view.token
      && owner.stage.parentNode === body && body.firstElementChild === owner.stage && owner.stage.isConnected && !UI.el.overlay.hidden
      && (UI._lastMode === 'battle' || backgroundOnly)
      && owner.assetKey === view.assetKey && owner.isBoss === view.isBoss;
    let crossedHost = false;
    if (!canReuse) {
      onReplace?.();
      UI.showOverlay('', shellHTML(view), 'battle'); crossedHost = true;
      // showOverlay dispatches synchronous host hooks. A newer render owns the
      // body now; do not stamp its stage with this older token or bind old inputs.
      if (!isCurrent() || UI.el.ovBody !== body || !validateHost()) return null;
      const stage = body.firstElementChild;
      if (!stage?.matches('.battle-stage.sts')) return null;
      stage._battleToken = view.token;
      owner = { stage, token:view.token, body, assetKey:view.assetKey, isBoss:view.isBoss, regions:new Map(), latestView:view };
      current = owner;
      onMount?.(stage, view.token);
      if (!isCurrent()) return null;
    }
    owner.latestView = view;
    repairMounts(owner);
    const stage = owner.stage;
    for (let i = stage.classList.length - 1; i >= 0; i--) {
      const name = stage.classList[i];
      if (name.startsWith('phase-') && name !== `phase-${view.phase}`) stage.classList.remove(name);
    }
    syncClasses(stage, `battle-stage sts battle-sts phase-${view.phase}`);
    setAttribute(stage, 'data-phase', view.phase); setAttribute(stage, 'data-battle-state', view.combatState.tone);
    setAttribute(stage, 'data-turn', view.turn);
    setAttribute(stage, 'data-asset-key', view.assetKey); setAttribute(stage, 'data-boss', view.isBoss ? '1' : '0');
    const oldPotions = owner.regions.get('potions')?.html;
    if (oldPotions !== view.potionsHTML) onPotionsChange?.();
    region(owner, 'potions', owner.topbar, '.bt-potions', view.potionsHTML, rich, null, null, ownsPotionPanel);
    region(owner, 'encounter', owner.topbar, '.sts-encounter', `<div class="sts-encounter">${view.isBoss ? '<span class="sts-encounter-kicker">首脑战</span>' : ''}<b></b><span class="sts-phase-dot"></span><span></span></div>`, rich, owner.topbar.firstElementChild, tree => {
      const children = tree.children, offset = view.isBoss ? 1 : 0;
      setText(children[offset], `第 ${view.turn} 回合`);
      children[offset + 1].className = `sts-phase-dot ${view.combatState.tone}`;
      setText(children[offset + 2], view.combatState.label);
      const liveDot = owner.regions.get('encounter').node.children[offset + 1];
      if (owner.tone && owner.tone !== view.combatState.tone) liveDot?.classList.remove(owner.tone);
      owner.tone = view.combatState.tone;
    });
    setRunTopBarBattleOptions(UI, owner.stage);
    region(owner, 'draw', owner.dock, '.sts-hud-l', `<div class="sts-hud-l" aria-label="抽牌堆">${view.drawHTML}</div>`, rich, owner.dock.firstElementChild);
    region(owner, 'energy', owner.dock, '.sts-energy-wrap', `<div class="sts-energy-wrap"><div class="sts-energy" role="group" tabindex="0"><img class="battle-energy-emblem battle-control-icon" src="${escAttr(view.energyArt)}" alt="" draggable="false" decoding="async"><span class="battle-control-value"><b></b><span></span></span></div></div>`, rich, null, tree => {
      const energy = tree.firstElementChild;
      setAttribute(energy, 'aria-label', `能量 ${view.energy}，每回合 ${view.maxEnergy}`);
      setText(energy.children[1].children[0], view.energy); setText(energy.children[1].children[1], `/${view.maxEnergy}`);
    });
    region(owner, 'rest', owner.hud, '.sts-hud-r', `<div class="sts-hud-r" aria-label="消耗牌堆">${view.restHTML}</div>`, rich, owner.hand);
    region(owner, 'skill', owner.tools, '.battle-skill-help', view.skillHTML, rich, owner.tools.firstElementChild);
    // The pager belongs to the resource dock. Restore a displaced owned pager in
    // place (including old tools placement), preserving its focus and badge.
    const pageRecord = owner.regions.get('page');
    const retainedPage = pageRecord?.node;
    if (retainedPage && stage.contains(retainedPage) && retainedPage.parentNode !== owner.dock) {
      owner.dock.insertBefore(retainedPage, owner.regions.get('energy').node);
    }
    // Only the feedback owner's exact current badge may extend this component.
    region(owner, 'page', owner.dock, '.bt-hand-page', view.pageHTML, rich, owner.regions.get('energy').node, null, ownsHandPageFeedback);
    region(owner, 'forecast', owner.tactics, '.bt-turn-forecast', view.forecastHTML, rich, owner.tactics.firstElementChild);
    region(owner, 'end', owner.tactics, '.sts-end-turn', '<button class="ov-btn sts-end-turn" data-act="btEnd">结束回合</button>', rich, null, tree => {
      const locked = view.locked || view.phase !== 'player';
      const label = view.phase === 'enemy' ? '敌方行动中' : view.phase === 'resolving' || view.locked ? '结算中…' : view.phase !== 'player' ? '请完成当前选择' : '结束回合';
      setText(tree, label); setAttribute(tree, 'title', locked ? label : '结束本回合并进入敌方行动');
      tree.classList.toggle('ok', !locked); setAttribute(tree, 'disabled', locked ? '' : null);
    });
    return { owner, crossedHost };
  }
  return { show, get current() { return current; }, dispose() { current = null; } };
}
