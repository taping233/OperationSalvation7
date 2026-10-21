import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// 本文件验输入，资源就绪由 battle-entry-readiness 专门控制未兑现的加载 Promise 验证。
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  showCardZoom: vi.fn(),
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { openHandInspector, closeHandInspector, syncHandInspector } = await import('../game/src/battle/view/battle.hand-inspector.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { mountUnitLayer, updateUnits } = await import('../game/src/battle/view/battle.layers.js');
const { forecastEnemyTurn } = await import('../game/src/battle/view/battle.turn-forecast.js');
const { set$energy, set$turn } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const mockedIcons = window.SDT.Icons;
await import('../game/src/core/icons-bitmap.js');
const bitmapIcons = window.SDT.Icons;
window.SDT.Icons = mockedIcons;
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
// The retained inspector is exercised through its API; battle no longer exposes a details button.
const inspectCard = uid => openHandInspector(uid, selected => actions.get('btPlay')({ uid:selected }));
const panel = () => document.querySelector('.bt-hand-detail');
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const card = () => UI.el.ovBody.querySelector('.sts-hand .bt-card');
const infusionWorkspace = () => UI.el.ovBody.querySelector('[data-infusion-workspace]');
const infusionMaterial = (index = 0) => infusionWorkspace().querySelectorAll('.infusion-material')[index];
const infusionControl = (act, index = 0) => infusionMaterial(index).querySelector(`.infusion-quantity [data-act="${act}"]`);
const infusionResources = () => {
  const { energy, hand, grave, discard, player, foes } = BattleSession.getSnapshot();
  return { energy, hand, grave, discard, player, foes, coins:game.coins };
};
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) { flush(); return; }
  }
  throw new Error('战斗动作没有收口');
}
function start(count = 1, entry = Cards.SHA, extra = [], myClass = null) {
  game = {
    ownedCards: [{ uid: 'inspect-card', card: entry }, ...extra], inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass, state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd(opts) { this.lastBattleSummary = opts.battleSummary; },
  };
  window.SDT.game = game;
  BattleSession.start(game, Array.isArray(count) ? count : Array.from({ length: count }, (_, i) => ({ id: `foe-${i}`, name: `敌人${i}`, hp: 40, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(async () => {
  // 拖拽松手后的 300ms click 吞噬是生产交互窗口；各用例不共享该手势。
  if (Date.now() - Aim.aimPlayedAt < 300) await new Promise(resolve => setTimeout(resolve, 310));
  frames = []; UI.showCardZoom.mockClear();
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  closeHandInspector({ restoreFocus: false }); Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});

it.each([1, 2])('clicking with %s enemies only inspects; explicit use still requires target confirmation', async count => {
  start(count);
  const before = BattleSession.getSnapshot();
  inspectCard(card().dataset.uid);
  expect(panel()?.getAttribute('aria-modal')).toBe('true');
  expect(panel().querySelector('.hs-card.lg')).not.toBeNull();
  expect(stage().inert).toBe(true);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  panel().querySelector('.bt-hand-detail-use').click();
  expect(panel()).toBeNull(); expect(stage().inert).toBe(false);
  expect(Aim.clickSelectedUid).toBe('inspect-card');
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  UI.el.ovBody.querySelector('.bt-foe[data-eidx="0"]').click();
  await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(40);
});

it('keeps untargeted cards read-only until explicit use, and a repeated old confirmation cannot spend twice', async () => {
  start(1, { id: 'inspect-coins', name: '金币试验牌', type: '法术', rarity: '古朴', cost: 1, desc: '获得 3 金币。',
    rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [{ op: 'coins', n: 3 }] } } });
  inspectCard(card().dataset.uid); expect(game.coins).toBe(0);
  const use = panel().querySelector('.bt-hand-detail-use'); use.click(); use.click();
  await settle();
  expect(game.coins).toBe(3);
  expect(BattleSession.getSnapshot().energy).toBe(8);
});

it('opens from number/Enter keys, traps focus and blocks combat hotkeys until Escape restores the hand', () => {
  start(); card().focus();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', isComposing: true, bubbles: true }));
  card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  expect(panel()).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', shiftKey: true, bubbles: true }));
  expect(panel()).toBeNull(); inspectCard(card().dataset.uid);
  expect(panel()).not.toBeNull();
  const use = panel().querySelector('.bt-hand-detail-use'); use.focus();
  use.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(panel().querySelector('.bt-hand-detail-close'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
  expect(Aim.clickSelectedUid).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
  expect(panel()).not.toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(panel()).toBeNull(); expect(stage().inert).toBe(false); expect(document.activeElement).toBe(card());
  card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  expect(panel()).toBeNull(); expect(BattleSession.getSnapshot().energy).toBe(9);
});

it('keeps nine hand identities and stable corner controls while rerendering the battlefield', () => {
  const distinct = Array.from({ length: 8 }, (_, i) => ({ id: `layout-card-${i}`,
    name: `第${i + 1}张完整手牌`, type: '武术', cost: 1, desc: '造成 4 点物理伤害。', dmg: 4, dmgType: 'physical' }));
  start(2, Cards.SHA, distinct.map((entry, i) => ({ uid: `nine-${i}`, card: entry })));
  const hand = stage().querySelector('.sts-hand');
  expect(hand.querySelectorAll('.hs-card[data-card-layout="split"] .hsc-name')).toHaveLength(9);
  expect(hand.querySelectorAll('.hs-card[data-card-layout="split"] .hsc-cost')).toHaveLength(9);
  for (const entry of distinct) expect(hand.textContent).toContain(entry.name);
  expect(stage().querySelector('.sts-topbar .sts-options')).not.toBeNull();
  expect(stage().querySelector('.sts-hud .sts-hud-l')).not.toBeNull();
  expect(stage().querySelector('.sts-hud .sts-hud-r')).not.toBeNull();
  const previous = stage();
  render();
  expect(stage()).toBe(previous);
  expect(stage().querySelector('.sts-hand')).toBe(hand);
  expect(stage().querySelectorAll('[data-act="btEnd"]')).toHaveLength(1);
  expect(stage().querySelectorAll('[data-act="btSettings"]')).toHaveLength(1);
});

it.each(['face', 'bridge'])('selects a target on one %s pointer tap and suppresses the following synthetic click', route => {
  start();
  expect([...stage().querySelectorAll('.bt-card')].map(node => node.dataset.uid)).toEqual(['inspect-card']);
  const down = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 20, clientY: 600 });
  const hit = route === 'bridge' ? card().closest('.bt-slot') : card().querySelector('.hs-card');
  Object.defineProperty(down, 'pointerId', { value: 1 }); hit.dispatchEvent(down);
  expect(Aim.aim?.uid).toBe('inspect-card');
  const up = new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 20, clientY: 600 });
  Object.defineProperty(up, 'pointerId', { value: 1 }); window.dispatchEvent(up);
  expect(panel()).toBeNull(); hit.click();
  expect(Aim.aim?.uid).toBe('inspect-card'); expect(Aim.aim?.leftDown).toBe(false);
  expect(document.querySelectorAll('.bt-hand-detail')).toHaveLength(0);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
});

it('starts self-target equipment selection from the stable folded slot without spending or requiring a second click', () => {
  const sword = Cards.all().find(entry => entry.id === 'tt3-longsword');
  expect(sword).toBeTruthy(); start(3, sword);
  const before = BattleSession.getSnapshot();
  const foldedSlot = card().closest('.bt-slot');
  const pointer = type => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 900, clientY: 1064 });
    Object.defineProperty(event, 'pointerId', { value: 7 }); return event;
  };
  foldedSlot.dispatchEvent(pointer('pointerdown'));
  expect(Aim.aim?.uid).toBe('inspect-card');
  window.dispatchEvent(pointer('pointerup'));
  expect(Aim.aim?.uid).toBe('inspect-card'); expect(Aim.aim?.leftDown).toBe(false);
  expect(Aim.clickSelectedUid).toBeNull();
  expect(card().classList.contains('aim-lift')).toBe(true);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  foldedSlot.click(); // The release leaves this hand card following the pointer.
  expect(Aim.aim?.uid).toBe('inspect-card');
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
});

it('adds distinct material UIDs through the workspace and ignores a detached repeated button', () => {
  start(1, { id: 'folded-infuse', name: '折叠注能', type: '法术', cost: 1, infuse: 3, desc: '注能(3)：获得 6 点护盾。' }, [
    { uid: 'folded-fuel-a', card: Cards.SHA }, { uid: 'folded-fuel-b', card: Cards.SHA }, { uid: 'folded-fuel-c', card: Cards.SHA },
  ]);
  inspectCard('inspect-card');
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  const before = infusionResources();
  const oldButton = infusionControl('btInfuseAdd');
  oldButton.click(); flush(); oldButton.click();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['folded-fuel-a']);
  infusionControl('btInfuseAdd').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['folded-fuel-a', 'folded-fuel-b']);
  expect(infusionResources()).toEqual(before);
});

it('keeps unavailable cards readable and prevents stale confirmations after a battle switch', () => {
  start(); set$energy(0); render(); inspectCard(card().dataset.uid);
  expect(panel().querySelector('.bt-hand-detail-use').disabled).toBe(true);
  expect(panel().textContent).toContain('能量不足');
  closeHandInspector(); set$energy(9); render(); inspectCard(card().dataset.uid);
  const oldStage = stage(), oldUse = panel().querySelector('.bt-hand-detail-use');
  start(); oldUse.click();
  expect(panel()).toBeNull(); expect(oldStage.inert).toBe(false);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  inspectCard(card().dataset.uid);
  const currentPanel = panel(); oldUse.click();
  expect(panel()).toBe(currentPanel);
  expect(Aim.clickSelectedUid).toBeNull();
  stage().remove(); syncHandInspector();
  expect(panel()).toBeNull();
});

it('removes the inspector and restores inert state when the whole overlay is hidden', async () => {
  start(); inspectCard(card().dataset.uid);
  const oldStage = stage();
  UI.el.overlay.hidden = true;
  await Promise.resolve();
  expect(panel()).toBeNull();
  expect(oldStage.inert).toBe(false);
});

it('inspects the source before entry and keeps selected materials and scroll while reading details', () => {
  start(1, { id: 'inspect-infuse', name: '注能护体', type: '法术', cost: 1, infuse: 1, desc: '注能(1)：获得 6 点护盾。' }, [{ uid: 'inspect-fuel', card: Cards.SHA }]);
  inspectCard('inspect-card');
  expect(BattleSession.getSnapshot().infusing).toBeNull();
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  infusionControl('btInfuseAdd').click(); flush();
  const workspace = infusionWorkspace(), materials = workspace.querySelector('.infusion-materials');
  materials.scrollTop = 240;
  const detail = infusionMaterial().querySelector('[data-act="btInfuseInspect"]');
  const before = BattleSession.getSnapshot();
  detail.click(); flush();
  expect(UI.showCardZoom).toHaveBeenCalledWith(expect.objectContaining({ id:Cards.SHA.id }), { returnFocus:detail });
  expect(infusionWorkspace()).toBe(workspace);
  expect(materials.scrollTop).toBe(240);
  expect(BattleSession.getSnapshot()).toEqual(before);
  expect(before.infusing.picked).toEqual(['inspect-fuel']);
  expect(before.energy).toBe(9); expect(before.hand).toContain('inspect-fuel');
});

it.each(['cost', 'id', 'desc'])('keeps distinct hand groups keyed by %s and removes only the card actually played', async variant => {
  const original = Cards.all().find(entry => entry.id === 'tt3-fireball');
  const copy = { ...original,
    ...(variant === 'cost' ? { cost: 0, _baseCost: original.cost } : {}),
    ...(variant === 'id' ? { id: 'hand-identity-fireball-copy' } : {}),
    ...(variant === 'desc' ? { desc: original.desc + '（视图身份回归）' } : {}),
  };
  start(2, original, [{ uid: 'separate-copy', card: copy }]);
  const uids = () => [...stage().querySelectorAll('.sts-hand .bt-card')].map(node => node.dataset.uid);
  expect(uids()).toEqual(['inspect-card', 'separate-copy']); render(); expect(uids()).toEqual(['inspect-card', 'separate-copy']);
  BattleSession.commands.playCard('inspect-card', 0); await settle();
  expect(BattleSession.getSnapshot().hand).toEqual(['separate-copy']); expect(uids()).toEqual(['separate-copy']);
  inspectCard(card().dataset.uid); expect(panel()).not.toBeNull(); panel().querySelector('.bt-hand-detail-use').click();
  expect(Aim.clickSelectedUid).toBe('separate-copy');
  UI.el.ovBody.querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
  expect(BattleSession.getSnapshot().hand).toEqual([]); expect(uids()).toEqual([]);
});

it('leaves the original playable when its generated zero-cost copy is played first', async () => {
  const original = Cards.all().find(entry => entry.id === 'tt3-fireball');
  start(2, original, [{ uid: 'free-copy', card: { ...original, cost: 0, _baseCost: original.cost } }]);
  BattleSession.commands.playCard('free-copy', 0); await settle();
  expect([...stage().querySelectorAll('.sts-hand .bt-card')].map(node => node.dataset.uid)).toEqual(['inspect-card']);
  inspectCard(card().dataset.uid); expect(panel().querySelector('.bt-hand-detail-use').disabled).toBe(false);
  panel().querySelector('.bt-hand-detail-use').click();
  UI.el.ovBody.querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
  expect(stage().querySelectorAll('.sts-hand .bt-card')).toHaveLength(0);
});

it('reuses one stable slot for unchanged groups and clears it when the final copy leaves the hand', async () => {
  const original = Cards.all().find(entry => entry.id === 'tt3-fireball');
  start(2, original, [{ uid: 'same-copy', card: original }]);
  const slot = card().closest('.bt-slot');
  expect(stage().querySelectorAll('.sts-hand .bt-card')).toHaveLength(1); render(); expect(card().closest('.bt-slot')).toBe(slot);
  BattleSession.commands.playCard('inspect-card', 0); await settle();
  expect(card().dataset.uid).toBe('same-copy'); expect(card().closest('.bt-slot')).toBe(slot); expect(slot.dataset.uid).toBe('same-copy');
  BattleSession.commands.playCard('same-copy', 0); await settle();
  expect(stage().querySelectorAll('.sts-hand .bt-card')).toHaveLength(0);
});

it('keeps short card rules in the single large card without a redundant full-rule hand entry', () => {
  start();
  expect(stage().querySelector('.bt-hand-inspect')).toBeNull();
  const before = BattleSession.getSnapshot();
  inspectCard(card().dataset.uid);
  expect(panel().querySelector('.bt-hand-detail-copy')).toBeNull();
  expect(panel().querySelector('.hsc-desc').textContent).toContain('攻击伤害');
  closeHandInspector();
  expect(BattleSession.getSnapshot()).toEqual(before);
  expect(document.activeElement).toBe(card());
});

it('renders every long-rule condition through the shared safe rich-text copy without spending or changing focus contracts', () => {
  const description = '回合开始时：获得 2 点能量。对敌人造成 3 点攻击伤害并施加 2 层流血。回合结束时：若你仍有护甲，回复 4 点生命。此牌仅本场战斗生效，消耗后不计之前战斗，不能改变上述触发时点。<img src=x onerror=alert(1)> & "保留原句"';
  start(1, { id: 'inspect-long-rules', name: '完整条件试验牌', type: '法术', rarity: '古朴', cost: 1, desc: description });
  const before = BattleSession.getSnapshot(); inspectCard(card().dataset.uid);
  const rules = panel().querySelector('.bt-hand-detail-rules.card-rules-copy');
  expect(rules).not.toBeNull();
  expect(rules.textContent).toBe(description);
  expect(rules.querySelector('img')).toBeNull();
  expect(rules.querySelector('.d-num')?.textContent).toBe('2');
  expect(rules.querySelector('[data-term="bleed"]')?.textContent).toBe('流血');
  const close = panel().querySelector('.bt-hand-detail-close');
  close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(panel().querySelector('.bt-hand-detail-use'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
  expect(panel()).not.toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(panel()).toBeNull(); expect(document.activeElement).toBe(card());
  expect(BattleSession.getSnapshot()).toEqual(before);
});

it.each([
  [{ atk: 5 }, {}, '攻击 5', '攻击 · 5', '基础攻击 5'],
  [{ atk: 3, affix: 'frenzy' }, {}, '双击 3×2 · 诅咒', '共6', '基础攻击 3×2'],
  [{ atk: 3, affix: 'frenzy' }, { bleed: 2 }, '双击 5×2 · 诅咒', '流血 2 层', '基础攻击 3×2'],
  [{ atk: 0 }, {}, '攻击 0', '攻击 · 0', '基础攻击 0'],
  [{ atk: 4, evenAttack: true }, {}, '蓄力 · 下回合行动', '下回合行动', '基础攻击 4'],
  [{ atk: 4, status: { freeze: 1 } }, {}, '冰冻中', '无法行动', '基础攻击 4'],
  [{ atk: 4, behavior: 'strike' }, {}, '攻击 4', '攻击', '基础攻击 4'],
  [{ atk: 5, behavior: 'general' }, {}, '攻击 5 · 回合末强化', '攻击·回合末强化', '基础攻击 5'],
  [{ atk: 6, behavior: 'curse' }, {}, '攻击 6 · 诅咒', '攻击并施加诅咒', '基础攻击 6'],
  [{ atk: 4, affix: 'aegis' }, {}, '攻击 4 · 偶数回合庇幕', '偶数回合减免所有伤害', '基础攻击 4'],
])('separates the actual next action from base attack and keeps detailed conditions for %j', (foe, status, short, detail, base) => {
  start();
  const before = BattleSession.getSnapshot();
  const presented = { ...before, foes: [{ ...before.foes[0], ...foe }], pstat: { ...before.pstat, status } };
  updateUnits(mountUnitLayer(UI.el.ovBody, before.battleToken), presented, {});
  const enemy = stage().querySelector('.sts-foe');
  expect(enemy.querySelector('.bt-intent-short').textContent).toBe(short);
  const [actionText, conditionText] = short.split(' · ');
  expect(enemy.querySelector('.bt-intent-action').textContent).toBe(actionText);
  expect(enemy.querySelector('.bt-intent-condition')?.textContent).toBe(conditionText ? ` · ${conditionText}` : undefined);
  expect(enemy.querySelector('.bt-intent-detail').textContent).toContain(detail);
  expect(enemy.querySelector('.sts-headrow .sts-atkbadge')).toBeNull();
  expect(enemy.querySelector('.bt-intent-detail .sts-atkbadge').textContent.trim()).toBe(base);
  expect(enemy.querySelector('.sts-intent').getAttribute('aria-label')).toContain(base);
  expect(enemy.querySelector('.sts-intent').getAttribute('aria-expanded')).toBe('false');
  expect(stage().querySelector('.sts-me .sts-stats').textContent).toContain('攻 4');
  expect(enemy.querySelector('.sts-hp span').textContent).toBe('40/40');
  enemy.querySelector('.sts-intent').click();
  expect(enemy.querySelector('.sts-intent').classList.contains('is-open')).toBe(true);
  expect(enemy.querySelector('.sts-intent').getAttribute('aria-expanded')).toBe('true');
  expect(BattleSession.getSnapshot()).toEqual(before);
  expect(Aim.clickSelectedUid).toBeNull();
});

it('keeps a long enemy name intact and exposes base attack through keyboard intent details without confirming a target', () => {
  start(); const before = BattleSession.getSnapshot();
  const name = '被冰雾侵蚀的联邦机械重装巡防指挥官';
  const presented = { ...before, foes: [{ ...before.foes[0], name, atk: 7, behavior: 'strike' }] };
  updateUnits(mountUnitLayer(UI.el.ovBody, before.battleToken), presented, {});
  const enemy = stage().querySelector('.sts-foe'), intent = enemy.querySelector('.sts-intent');
  expect(enemy.getAttribute('aria-label')).toContain(name); expect(enemy.querySelector('.sts-headrow>b')).toBeNull();
  expect(enemy.querySelector('.sts-headrow .sts-atkbadge')).toBeNull();
  expect(intent.querySelector('.bt-intent-short').textContent).toBe('攻击 7');
  intent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(intent.getAttribute('aria-expanded')).toBe('true');
  expect(intent.querySelector('.bt-intent-detail').textContent).toContain('基础攻击 7');
  expect(intent.querySelector('.bt-intent-detail').textContent).toContain('攻击');
  intent.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(intent.getAttribute('aria-expanded')).toBe('false');
  expect(BattleSession.getSnapshot()).toEqual(before); expect(Aim.clickSelectedUid).toBeNull();
});

it('keeps each player combat stat and its actual bonus in a compact unbroken group', () => {
  start(); const before = BattleSession.getSnapshot();
  const presented = { ...before, pstat: { ...before.pstat, status: { ...before.pstat.status, atkUp: 2, spellUp: 1 } },
    pdef: { ...before.pdef, shield: 2, armor: 3, guard: true } };
  updateUnits(mountUnitLayer(UI.el.ovBody, before.battleToken), presented, {});
  const groups = [...stage().querySelectorAll('.sts-me .sts-stats>.sts-stat')].map(node => node.textContent.trim());
  expect(groups).toEqual(['攻 6', '法伤 1', '盾 2', '格挡中']);
  const stats = [...stage().querySelectorAll('.sts-me .sts-stats>.sts-stat')];
  expect(stats[0].dataset.uiTipText).toBe('基础攻击 4，攻击强化 +2');
  expect(stats[1].dataset.uiTipText).toBe('基础法伤 0，法术强化 +1');
  expect(stage().querySelector('.sts-me .sts-hp-armor').textContent).toBe('甲 3');
  expect(stage().querySelector('.sts-me .sts-hp-armor').getAttribute('aria-label')).toBe('护甲 3');
  expect(BattleSession.getSnapshot()).toEqual(before);
});

it.each([
  ['侠客', '刺击', 1, '2 点固定伤害'], ['战士', '猛击', 2, '攻击一次'],
  ['法师', '搜刮', 1, '随机获得1张牌'], ['牧师', '圣疗', 1, '回复 3 生命'], ['降临者', '火球', 2, '4 点法术伤害'],
])('presents %s skill effect, available state and fee without changing its action', (myClass, name, cost, effect) => {
  start(1, Cards.SHA, [], myClass); render();
  const skill = stage().querySelector('[data-act=btSlam]');
  expect(skill.dataset.skillState).toBe('ready'); expect(skill.disabled).toBe(false);
  expect(skill.closest('.battle-skill-help').dataset.uiTipTitle).toBe(name);
  expect(skill.querySelector('.battle-skill-fee').textContent).toBe(String(cost));
  expect(skill.getAttribute('aria-label')).toContain(`${cost}费`);
  expect(skill.getAttribute('aria-label')).toContain('可用');
  expect(skill.getAttribute('aria-label')).toContain(effect);
  expect(skill.getAttribute('aria-label')).toContain('每回合一次');
  set$energy(0); render();
  const locked = stage().querySelector('[data-act=btSlam]');
  expect(locked.disabled).toBe(true); expect(locked.dataset.skillState).toBe('unaffordable');
  expect(locked.getAttribute('aria-label')).toContain(`差 ${cost} 费`);
  expect(locked.getAttribute('aria-label')).toContain(effect);
});

it('presents skill target selection, once-per-turn use and restored readiness through the existing command chain', async () => {
  start(1, Cards.SHA, [], '侠客'); render();
  stage().querySelector('[data-act=btSlam]').click(); flush();
  expect(stage().querySelector('[data-act=btSlam]').dataset.skillState).toBe('targeting');
  expect(stage().querySelector('[data-act=btSlam]').getAttribute('aria-label')).toContain('选目标');
  const target = stage().querySelector('.bt-foe.can-target');
  expect(target.getAttribute('role')).toBe('button');
  expect(target.getAttribute('aria-label')).toBe('敌人0，按 Enter 确认目标');
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle();
  const used = stage().querySelector('[data-act=btSlam]');
  expect(used.dataset.skillState).toBe('used'); expect(used.disabled).toBe(true);
  expect(used.getAttribute('aria-label')).toContain('已使用');
  expect(BattleSession.getSnapshot().energy).toBe(8);
  set$turn(2); render();
  expect(stage().querySelector('[data-act=btSlam]').dataset.skillState).toBe('ready');
  expect(stage().querySelector('[data-act=btSlam]').disabled).toBe(false);
});

it.each(['enemy', 'self'])('retains the %s target label and Enter action across redraw and a modal return', async side => {
  const entry = side === 'self' ? Cards.all().find(item => item.id === 'tt3-longsword') : Cards.SHA;
  start(2, entry);
  card().querySelector('.hs-card').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const selector = side === 'self' ? '#btSelf.can-target' : '.bt-foe.can-target';
  const label = side === 'self' ? '自己，按 Enter 确认目标' : '敌人0，按 Enter 确认目标';
  const target = stage().querySelector(selector);
  expect(target.getAttribute('role')).toBe('button'); expect(target.getAttribute('aria-label')).toContain(label);
  expect(target.getAttribute('tabindex')).toBe('0'); expect(document.activeElement).toBe(target);
  render();
  expect(stage().querySelector(selector)).toBe(target); expect(target.getAttribute('aria-label')).toContain(label);
  BattleSession.commands.openGrave(); flush(); expect(stage().hasAttribute('inert')).toBe(true);
  BattleSession.commands.closeGrave(); flush();
  expect(stage().querySelector(selector)).toBe(target); expect(target.getAttribute('aria-label')).toContain(label);
  expect(target.getAttribute('tabindex')).toBe('0');
  target.focus(); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle();
  expect(BattleSession.getSnapshot().hand).not.toContain('inspect-card');
  if (side === 'self') expect(BattleSession.getSnapshot().equipped.some(item => item.uid === 'inspect-card')).toBe(true);
  else expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(40);
  expect(Aim.clickSelectedUid).toBeNull();
});

it('emphasizes forecast damage and remaining HP as separate values and keeps the actual forecast semantics', () => {
  start(); game.hp = 1; set$turn(2); render();
  const expected = forecastEnemyTurn(BattleSession.getSnapshot());
  const forecast = stage().querySelector('.bt-turn-forecast');
  expect(forecast.querySelector('.bt-forecast-damage>b').textContent).toBe(String(expected.damage));
  expect(forecast.querySelector('.bt-forecast-hp>b').textContent).toBe(String(expected.hpAfter));
  expect(forecast.classList.contains('lethal')).toBe(expected.lethal);
  expect(forecast.querySelector('.bt-forecast-warning').textContent).toBe('可能致死');
  expect(forecast.dataset.uiTipText).toBe(expected.note);
  expect(forecast.dataset.uiTipTitle).toBe('承伤估算');
  expect(forecast.tabIndex).toBe(0);
  expect(game.hp).toBe(1); expect(BattleSession.getSnapshot().busy).toBe(false);
});

it('renders real unit icon bitmaps synchronously before observer/rAF hydration and reuses unchanged sections', () => {
  start();
  window.SDT.Icons = bitmapIcons;
  try {
    const before = BattleSession.getSnapshot();
    const presented = { ...before, foes: [{ ...before.foes[0], dead: true, atk: 5 }], pdef: { ...before.pdef, shield: 2, armor: 3 } };
    const mounts = mountUnitLayer(UI.el.ovBody, before.battleToken);
    updateUnits(mounts, presented, {});
    const head = stage().querySelector('.sts-foe .sts-headrow');
    expect(head.textContent).not.toContain('[[icon:');
    expect(head.querySelectorAll('img.ic')).toHaveLength(0);
    expect(stage().querySelector('.sts-foe').classList.contains('dead')).toBe(true);
    expect(head.querySelector('[data-asset-key="icon-swords"]')).toBeNull();
    const stats = stage().querySelector('.sts-me .sts-stats');
    expect(stats.textContent).not.toContain('[[icon:');
    expect(stats.querySelector('[data-asset-key="icon-shield"]')).not.toBeNull();
    expect(stage().querySelector('.sts-me .sts-hp-armor').hidden).toBe(false);
    expect(stage().querySelector('.sts-me .sts-hp-armor').getAttribute('aria-label')).toBe('护甲 3');
    const first = head.firstChild;
    updateUnits(mounts, presented, {});
    expect(head.firstChild).toBe(first);
    expect(BattleSession.getSnapshot()).toEqual(before);
  } finally { window.SDT.Icons = mockedIcons; }
});


it('single click selects a target and details stay separately accessible', async () => {
  start(1); card().click();
  expect(panel()).toBeNull(); expect(Aim.clickSelectedUid).toBe('inspect-card');
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  UI.el.ovBody.querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(40);
});

it('adds and removes infusion materials explicitly without opening the inspector or spending resources', () => {
  start(1, { id:'fresh-infusion', name:'注能护体', type:'法术', cost:1, infuse:1, desc:'注能(1)：获得 6 点护盾。' }, [{ uid:'fuel', card:Cards.SHA }]);
  UI.el.ovBody.querySelector('[data-act=btInfuseStart]').click(); flush();
  const before = infusionResources();
  infusionMaterial().querySelector('.infusion-card-face').click(); flush();
  expect(panel()).toBeNull();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['fuel']);
  expect(infusionControl('btInfuseAdd').disabled).toBe(true);
  infusionControl('btInfuseAdd').click();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['fuel']);
  infusionControl('btInfuseRemove').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  expect(infusionResources()).toEqual(before);
});

it('keeps remaining shortcut numbers after a lower slot leaves', async () => {
  const fireball = Cards.all().find(c => c.id === 'tt3-fireball');
  start(2, Cards.SHA, [{uid:'second',card:fireball}]);
  const second = () => stage().querySelector('.bt-card[data-uid="second"]');
  expect(second().dataset.handIndex).toBe('2');
  BattleSession.commands.playCard('inspect-card',0); await settle();
  expect(second().dataset.handIndex).toBe('2');
});

it('shows and executes a structured raygun skill once despite repeated input', async () => {
  const gun = Cards.all().find(c => c.id === 'tt12-raygun');
  start(1, gun); BattleSession.commands.playCard('inspect-card', 'self'); await settle();
  const skill = stage().querySelector('[data-act=btEquipSkill]');
  expect(skill).not.toBeNull(); expect(skill.disabled).toBe(false);
  skill.click(); skill.click(); await settle();
  const snap = BattleSession.getSnapshot();
  expect(snap.equipped[0].used).toBe(true);
  expect(snap.discovering.options.length).toBeGreaterThan(0);
  expect(snap.discovering.act).toBe('play');
  BattleSession.commands.pickDiscover(snap.discovering.options.findIndex(c => !c.infuse)); await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(40);
});

it('calculates defense before warning and provides return or continue only for lethal turns', () => {
  start();
  const snapshot = BattleSession.getSnapshot();
  const input = { ...snapshot, player:{...snapshot.player,hp:3}, pdef:{shield:0,armor:5,guard:false}, foes:[{...snapshot.foes[0],atk:8}] };
  const before = JSON.stringify(input);
  expect(forecastEnemyTurn(input)).toMatchObject({damage:3,hpAfter:0,lethal:true});
  expect(JSON.stringify(input)).toBe(before);
  expect(forecastEnemyTurn({...input,pdef:{shield:0,armor:6,guard:false}})).toMatchObject({damage:2,lethal:false});
});

it('warns only on lethal end turn and lets the player return or proceed', async () => {
  start(); game.hp = 1; set$turn(2); render();
  stage().querySelector('[data-act=btEnd]').click();
  expect(UI.el.ovBody.querySelector('[data-act=btRiskBack]')).not.toBeNull();
  UI.el.ovBody.querySelector('[data-act=btRiskBack]').click();
  expect(stage()).not.toBeNull(); expect(game.hp).toBe(1);
  stage().querySelector('[data-act=btEnd]').click();
  UI.el.ovBody.querySelector('[data-act=btRiskContinue]').click();
  await settle(); expect(game.battleActive).toBe(false); expect(game.hp).toBe(0);
  expect(game.lastBattleSummary.round).toBe(2);
  expect(game.lastBattleSummary.damageTaken).toEqual([{source:'敌人0',damage:1,round:2}]);
  expect(Object.isFrozen(game.lastBattleSummary.remainingFoes)).toBe(true);
});


it('低能量卡的可访问说明与禁用原因一致，恢复后重新提示可用且拒绝不扣费', () => {
  start(); set$energy(0); render();
  const el=card();
  expect(el.dataset.handState).toBe('blocked');
  expect(el.getAttribute('aria-label')).toContain('能量不足：需要 1，当前 0');
  expect(el.querySelector('.hsc-desc .bt-rulehint').textContent).toBe('无法打出：能量不足：需要 1，当前 0');
  expect(el.querySelector('.hs-card').getAttribute('aria-label')).toContain('能量不足');
  expect(el.getAttribute('aria-label')).not.toContain('点击选择敌人');
  const before=BattleSession.getSnapshot();
  Aim.selectCardByClick(el.dataset.uid); flush();
  const after=BattleSession.getSnapshot();
  expect(stage().querySelector('.bt-thought-bubble').textContent).toContain('能量不足');
  expect(after.energy).toBe(before.energy); expect(after.turn).toBe(before.turn); expect(after.hand).toEqual(before.hand);
  set$energy(9); render();
  expect(card().dataset.handState).toBe('ready');
  expect(card().getAttribute('aria-label')).not.toContain('能量不足');
  expect(card().querySelector('.hsc-desc').textContent).not.toContain('能量不足');
  expect(card().getAttribute('aria-label')).toContain('点击选择敌人');
});
it('特殊禁用原因仍优先于能量提示，不回退成可用操作', () => {
  start(1,Cards.all().find(c => c.id === 'tt7-imitate')); set$energy(0); render();
  expect(card().dataset.handState).toBe('blocked');
  expect(card().getAttribute('aria-label')).toContain('先打出一张武术牌');
  expect(card().getAttribute('aria-label')).toContain('无法打出');
  expect(card().getAttribute('aria-label')).not.toContain('点击直接使用');
});


it('two real equipped cards block the next card and ARIA before submission, preserving rejection code and resources', async () => {
 const canonical=id=>Cards.all().find(c=>c.id===id);
 start(1,canonical('tt3eq-mistbox'),[{uid:'armor',card:canonical('tt3-grass-armor')},{uid:'gun',card:canonical('tt12-raygun')},{uid:'paid',card:{id:'paid',name:'有费装备',type:'装备',cost:2,desc:''}}]);
 BattleSession.commands.playCard('armor','self');await settle();
 BattleSession.commands.playCard('gun','self');await settle();render();
 const element=stage().querySelector('.sts-hand .bt-card[data-uid="inspect-card"]');
 expect(element.dataset.handState).toBe('blocked');expect(element.getAttribute('aria-label')).toContain('最多同时装配 2 件装备（已装配 2 件）');
 expect(element.getAttribute('aria-label')).not.toContain('点击直接使用');
 const engine=await import('../game/src/battle/core/battle.engine.js');
 expect(engine.unplayableReason(canonical('tt3eq-mistbox'))).toBeNull(); // Preserve automatic-effect eligibility.
 const publicCore=await import('../game/src/battle/core/battle.core.js');
 expect(publicCore.unplayableReason(canonical('tt3eq-mistbox'))).toContain('最多同时装配');
 expect(publicCore.unplayableReason({type:'装备',name:'封印装备',desc:'无法打出'})).toContain('封印之牌');
 const before=BattleSession.getSnapshot();
 const rejected=BattleSession.commands.submitCardPlay('inspect-card','self');
 expect(rejected.reason.code).toBe('EQUIPMENT_FULL');
 expect(BattleSession.getSnapshot().hand).toEqual(before.hand);expect(BattleSession.getSnapshot().energy).toBe(before.energy);expect(BattleSession.getSnapshot().turn).toBe(before.turn);
 expect(BattleSession.commands.submitCardPlay('armor','self').reason.code).toBe('NOT_IN_HAND');
 set$energy(0);expect(BattleSession.commands.submitCardPlay('paid','self').reason.code).toBe('INSUFFICIENT_ENERGY');set$energy(9);
 // Existing ability changes capacity by presence; removing it restores the original cap.
 game.ownedCards.push({uid:'extra-slot',card:canonical('tt8-hero-guardian')});render();
 expect(stage().querySelector('.sts-hand .bt-card[data-uid="inspect-card"]').dataset.handState).toBe('ready');
 game.ownedCards=game.ownedCards.filter(o=>o.uid!=='extra-slot');render();
 expect(stage().querySelector('.sts-hand .bt-card[data-uid="inspect-card"]').dataset.handState).toBe('blocked');
});
it('legacy passive gear occupies slots and rune capacity remains dynamic', async () => {
 const runtime=await import('../game/src/battle/runtime/battle.runtime.js');
 const canonical=id=>Cards.all().find(c=>c.id===id);
 start(1,canonical('tt3eq-mistbox'));
 runtime.set$equipped([{uid:'a',card:canonical('tt3-grass-armor')},{uid:'passive',card:canonical('tt12-raygun'),passive:true}]);render();
 expect(card().dataset.handState).toBe('blocked');
 const before = BattleSession.getSnapshot();
 expect(BattleSession.commands.submitCardPlay('inspect-card','self').reason.code).toBe('EQUIPMENT_FULL');
 expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
 expect(BattleSession.getSnapshot().energy).toBe(before.energy);
 runtime.set$nestSyn({...runtime.nestSyn,grass1:true});render();expect(card().dataset.handState).toBe('ready');
 runtime.set$nestSyn({...runtime.nestSyn,grass1:false,grass3:true});render();expect(card().dataset.handState).toBe('ready');
 runtime.set$nestSyn({...runtime.nestSyn,grass3:false});render();expect(card().dataset.handState).toBe('blocked');
});

it('普通战武装共享提示明确从本场牌库抽取对应类型，仍可使用', () => {
  const arm = Cards.all().find(c => c.id === 'tt7-armup');
  start(1, arm);
  render(); flush();
  const handCard = card();
  expect(handCard.getAttribute('aria-label')).toContain('从本场牌库抽取符合类型的牌');
  expect(handCard.textContent).toContain('从本场牌库抽取符合类型的牌');
  expect(handCard.getAttribute('aria-disabled')).not.toBe('true');
});


it('describes and cycles three hand pages without changing cards or combat state', async () => {
  const entries = Array.from({ length: 19 }, (_, i) => ({
    uid: `page-${i}`, card: { ...Cards.SHA, id: `page-card-${i}`, name: `分页牌${i}` },
  }));
  start(1, entries[0].card, entries.slice(1));
  const before = BattleSession.getSnapshot();
  for (const page of [1, 2, 3, 1]) {
    const button = stage().querySelector('[data-act="btHandPage"]');
    expect(button.title).toBe('手牌分栏：每栏最多 9 叠；点击查看下一栏，末栏后回到第一栏');
    expect(button.getAttribute('aria-label')).toContain(`当前第 ${page} 栏，共 3 栏`);
    expect(stage().querySelectorAll('.sts-hand .bt-card').length).toBe(page === 3 ? 1 : 9);
    expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
    expect(BattleSession.getSnapshot().energy).toBe(before.energy);
    expect(BattleSession.getSnapshot().turn).toBe(before.turn);
    button.click(); flush();
    await new Promise(resolve => setTimeout(resolve, 260));
    flush();
  }
});

it('does not show pagination help for a single hand page', () => {
  start();
  expect(stage().querySelector('[data-act="btHandPage"]')).toBeNull();
  expect(stage().querySelectorAll('.sts-hand .bt-card')).toHaveLength(1);
});


it.each(['mouse', 'touch'])('keeps %s untargeted pickup pending until field confirmation or Escape', pointerType => {
  const mana = Cards.all().find(c => c.id === 'cc-mana-surge');
  expect(mana).toBeTruthy(); start(1, mana);
  const before = BattleSession.getSnapshot(), face = card();
  expect(face.getAttribute('aria-label')).toContain('拖至战场空地使用；拿起后 Esc 取消；聚焦卡面按 Enter 直接使用');
  expect(face.getAttribute('aria-label')).not.toContain('点击直接使用');
  const pointer = type => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 900, clientY: 950 });
    Object.defineProperties(event, { pointerId: { value: 88 }, pointerType: { value: pointerType } });
    return event;
  };
  face.querySelector('.hs-card').dispatchEvent(pointer('pointerdown'));
  window.dispatchEvent(pointer('pointerup'));
  expect(Aim.aim?.uid).toBe('inspect-card'); expect(Aim.aim.mode).toBe('drag');
  expect(Aim.aim.leftDown).toBe(false); expect(face.inert).toBe(true);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
  expect(BattleSession.getSnapshot().busy).toBe(false);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(Aim.aim).toBeNull();
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
});

it.each(['Enter', ' '])('directly plays an untargeted card from focused card-face %s', async key => {
  start(1, { id: 'keyboard-coins', name: '无目标金币', type: '法术', rarity: '古朴', cost: 1, desc: '获得 3 金币。',
    rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [{ op: 'coins', n: 3 }] } } });
  expect(card().getAttribute('aria-label')).toContain('聚焦卡面按 Enter 直接使用');
  card().querySelector('.hs-card').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await settle();
  expect(game.coins).toBe(3); expect(BattleSession.getSnapshot().energy).toBe(8);
  expect(BattleSession.getSnapshot().hand).not.toContain('inspect-card'); expect(Aim.aim).toBeNull();
});

it('updates the entire career skill help across busy and energy changes', async () => {
  const { set$busy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
  start();
  const check = (disabled, reason) => {
    const wrapper = stage().querySelector('.battle-skill-help');
    const button = wrapper.querySelector('.bt-slam-btn');
    expect(button.disabled).toBe(disabled);
    expect(button.getAttribute('aria-label')).toContain(reason);
    expect(wrapper.dataset.uiTipNote).toContain(reason);
    if (disabled) expect(wrapper.getAttribute('aria-label')).toContain(reason);
    else { expect(wrapper.hasAttribute('aria-label')).toBe(false); expect(wrapper.hasAttribute('tabindex')).toBe(false); }
  };
  check(false, '可用');
  set$busy(true); render(); check(true, '结算中');
  set$busy(false); render(); check(false, '可用');
  set$energy(0); render(); check(true, '差 2 费');
  set$energy(9); render(); check(false, '可用');
  const { set$hand } = await import('../game/src/battle/runtime/battle.runtime.piles.js');
  const extra = Array.from({ length: 10 }, (_, i) => ({ uid: `skill-page-${i}`, card: { ...Cards.SHA, id: `skill-page-${i}`, name: `技能分页${i}` } }));
  game.ownedCards.push(...extra);
  set$hand([...BattleSession.getSnapshot().hand, ...extra.map(entry => entry.uid)]);
  render();
  const page = stage().querySelector('[data-act="btHandPage"]');
  expect(page).not.toBeNull(); expect(page.closest('.battle-skill-help')).toBeNull();
  expect(page.previousElementSibling?.matches('.battle-skill-help')).toBe(true);
  set$busy(true); render(); check(true, '结算中');
  set$busy(false); render(); check(false, '可用');
  expect(stage().querySelector('[data-act="btHandPage"]')).toBe(page);
  page.click(); flush();
  expect(stage().querySelector('[data-act="btHandPage"]').getAttribute('aria-label')).toContain('当前第 2 栏');
});

it('同叠注能逐张加减，数量、按钮与剩余提示同步且不循环撤选', () => {
  start(1, { id:'stack-click-infusion', name:'堆叠注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' }, [
    { uid:'stack-fuel-a', card:Cards.SHA }, { uid:'stack-fuel-b', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  const before = infusionResources();
  expect(infusionControl('btInfuseRemove').disabled).toBe(true);
  infusionControl('btInfuseAdd').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['stack-fuel-a']);
  expect(infusionMaterial().querySelector('.infusion-quantity span').textContent).toContain('1 / 2');
  expect(infusionWorkspace().querySelector('[role="status"]').textContent).toBe('已选 1/2');
  expect(infusionControl('btInfuseAdd').getAttribute('aria-label')).toContain('增加一张');
  infusionControl('btInfuseAdd').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['stack-fuel-a', 'stack-fuel-b']);
  expect(infusionControl('btInfuseAdd').disabled).toBe(true);
  expect(UI.el.ovBody.querySelector('[data-act="btInfuseGo"]').disabled).toBe(false);
  infusionControl('btInfuseAdd').click();
  expect(BattleSession.getSnapshot().infusing.picked).toHaveLength(2);
  infusionControl('btInfuseRemove').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['stack-fuel-b']);
  expect(UI.el.ovBody.querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
  expect(infusionResources()).toEqual(before);
});

it('更新后旧加减回调失效，当前按钮继续逐张选取独立UID', () => {
  start(1, { id:'stack-click-fast', name:'快速注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' }, [
    { uid:'click-a', card:Cards.SHA }, { uid:'click-b', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  const oldAdd = actions.get('btInfuseAdd'), oldRemove = actions.get('btInfuseRemove');
  oldAdd({ i:'0' }); flush();
  oldAdd({ i:'0' }); oldRemove({ i:'0' });
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['click-a']);
  infusionControl('btInfuseAdd').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['click-a', 'click-b']);
});

it('工作区数字键逐张加入当前材料组，取消保留全部手牌和能量', () => {
  start(1, { id:'stack-key', name:'键盘注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' }, [
    { uid:'key-a', card:Cards.SHA }, { uid:'key-b', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  const before = infusionResources();
  for (let i = 0; i < 2; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key:'1', bubbles:true, cancelable:true })); flush();
  }
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['key-a', 'key-b']);
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'1', bubbles:true, cancelable:true })); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['key-b']);
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true })); flush();
  expect(BattleSession.getSnapshot().infusing).toBeNull();
  expect(infusionResources()).toEqual(before);
});

it('独立工作区展示全部材料，旧手牌入口不能选离屏UID', () => {
  start(1, { id:'paged-infusion', name:'分页注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' },
    Array.from({ length:10 }, (_, i) => ({ uid:`page-fuel-${i}`, card:{ id:`page-fuel-${i}`, name:`分页材料${i}`, type:'法术', cost:0, desc:'获得1点护盾。' } })));
  const oldHand = stage().querySelector('.sts-hand'), oldPlay = actions.get('btPlay');
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  expect(oldHand.isConnected).toBe(true);
  expect(oldHand.closest('[inert]')).toBe(stage());
  expect(infusionWorkspace().querySelectorAll('.infusion-material')).toHaveLength(10);
  expect(UI.el.ovBody.querySelector('.battle-secondary-panel [data-act="btHandPage"]')).toBeNull();
  oldPlay({ uid:'page-fuel-0' }); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  infusionControl('btInfuseAdd', 9).click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['page-fuel-9']);
});

it('选量变化保留材料滚动和可用控件焦点，更换材料不提前消耗', () => {
  start(1, { id:'scroll-infusion', name:'滚动注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' }, [
    { uid:'scroll-a', card:Cards.SHA }, { uid:'scroll-b', card:Cards.SHA },
    { uid:'scroll-c', card:{ ...Cards.SHA, id:'other-fuel', name:'另一材料' } }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  const before = infusionResources();
  infusionWorkspace().querySelector('.infusion-materials').scrollTop = 180;
  infusionControl('btInfuseAdd').focus(); infusionControl('btInfuseAdd').click(); flush();
  expect(infusionWorkspace().querySelector('.infusion-materials').scrollTop).toBe(180);
  expect(document.activeElement.dataset.act).toBe('btInfuseAdd');
  expect(document.activeElement.dataset.i).toBe('0');
  infusionControl('btInfuseRemove').click(); flush();
  infusionControl('btInfuseAdd', 1).click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['scroll-c']);
  expect(infusionWorkspace().querySelector('.infusion-selection-summary').textContent).toContain('另一材料 ×1');
  expect(infusionWorkspace().querySelector('.infusion-materials').scrollTop).toBe(180);
  expect(infusionResources()).toEqual(before);
});

it('取消或切换战斗后旧工作区确认、直打、选量与详情回调均失效', () => {
  const source = { id:'stale-infusion', name:'旧页注能', type:'法术', cost:1, infuse:1, desc:'注能(1)：获得6点护盾。' };
  start(1, source, [{ uid:'stale-fuel', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  infusionControl('btInfuseAdd').click(); flush();
  const old = ['btInfuseAdd', 'btInfuseRemove', 'btInfuseInspect', 'btInfuseCancel', 'btInfuseDirect', 'btInfuseGo'].map(name => actions.get(name));
  UI.el.ovBody.querySelector('[data-act="btInfuseCancel"]').click(); flush();
  const cancelled = BattleSession.getSnapshot();
  old.forEach(action => action({ i:'0', uid:'inspect-card' })); flush();
  expect(BattleSession.getSnapshot()).toEqual(cancelled);
  start(1, source, [{ uid:'stale-fuel', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  const restarted = BattleSession.getSnapshot();
  old.forEach(action => action({ i:'0', uid:'inspect-card' })); flush();
  expect(BattleSession.getSnapshot()).toEqual(restarted);
  expect(UI.showCardZoom).not.toHaveBeenCalled();
});

it('pending infusion recreates its actual battlefield when restored without a mounted scene', () => {
  start(1, { id:'pending-overlay', name:'待选注能', type:'法术', cost:1, infuse:2, desc:'注能(2)：获得6点护盾。' }, [
    { uid:'pending-a', card:Cards.SHA }, { uid:'pending-b', card:Cards.SHA }]);
  BattleSession.commands.beginInfusion('inspect-card'); flush();
  infusionControl('btInfuseAdd').click(); flush();
  const before = infusionResources();
  const picked = [...BattleSession.getSnapshot().infusing.picked];
  UI.el.ovBody.replaceChildren();
  render(); flush();
  expect(stage()).not.toBeNull();
  expect(stage()._battleToken).toBe(BattleSession.getSnapshot().battleToken);
  expect(stage().hasAttribute('inert')).toBe(true);
  expect(infusionWorkspace()).not.toBeNull();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(picked);
  expect(infusionResources()).toEqual(before);
});

it('choice backdrop refreshes paid energy and removed hand card, and survives the real overlay mode event', async () => {
  start(1, Cards.all().find(entry => entry.id === 'tt3-magic-lamp'));
  const originalStage = stage();
  const scenery = stage().querySelector('.battle-scene-world');
  const foreground = stage().querySelector('.battle-scene-foreground');
  expect(scenery).not.toBeNull();
  BattleSession.commands.playCard('inspect-card', 0);
  await settle();
  const snap = BattleSession.getSnapshot();
  expect(snap.choosing).not.toBeNull();
  expect(stage()).toBe(originalStage);
  expect(stage().querySelector('.sts-energy').getAttribute('aria-label')).toContain(`能量 ${snap.energy}，`);
  expect(snap.hand).not.toContain('inspect-card');
  expect(stage().querySelector('.sts-hand [data-uid="inspect-card"]')).toBeNull();
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail:'discover' }));
  expect(stage().querySelector('.battle-scene-world')).toBe(scenery);
  expect(stage().querySelector('.battle-scene-foreground')).toBe(foreground);
  expect(stage().hasAttribute('inert')).toBe(true);
});

it('扰敌真实双选：首点保留手牌，排除已选敌人高亮，第二点才扣费互殴', async () => {
  start(3, Cards.all().find(c => c.id === 'tt7-provoke'));
  Aim.selectCardByClick('inspect-card', false);
  expect(Aim.clickSelectedTarget('enemy', 2)).toBe(true); flush();
  let snapshot = BattleSession.getSnapshot();
  expect(snapshot.hand).toContain('inspect-card'); expect(snapshot.energy).toBe(9);
  expect(snapshot.foes.map(f => f.hp)).toEqual([40, 40, 40]);
  expect(stage().textContent).toContain('已选 敌人2 先攻击');
  expect(stage().querySelector('.bt-foe[data-eidx="2"]').classList.contains('can-target')).toBe(false);
  expect(stage().querySelector('.bt-foe[data-eidx="1"]').classList.contains('can-target')).toBe(true);
  expect(Aim.clickSelectedTarget('enemy', 1)).toBe(true); await settle();
  snapshot = BattleSession.getSnapshot();
  expect(snapshot.hand).not.toContain('inspect-card'); expect(snapshot.energy).toBe(8);
  expect(snapshot.foes.map(f => f.hp)).toEqual([40, 39, 39]);
  expect(snapshot.pendingTarget).toBeNull();
});
it('扰敌首选后Esc撤销不消费，只有一敌时不能空耗卡牌', async () => {
  const provoke = Cards.all().find(c => c.id === 'tt7-provoke');
  start(2, provoke);
  Aim.selectCardByClick('inspect-card', false); Aim.clickSelectedTarget('enemy', 0); flush();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); flush();
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  expect(BattleSession.getSnapshot().energy).toBe(9);
  expect(BattleSession.getSnapshot().hand).toContain('inspect-card');
  start(1, provoke); flush();
  expect(card().dataset.handState).toBe('blocked');
  expect(card().getAttribute('aria-label')).toContain('场上敌人不足两名');
});

it('keeps an actively held touch owned when a different primary mouse or pen presses', () => {
  start();
  const before = infusionResources();
  const pointer = (type, pointerId, pointerType) => {
    const event = new MouseEvent(type, { bubbles:true, button:0, clientX:900, clientY:950 });
    Object.defineProperties(event, { pointerId:{value:pointerId}, pointerType:{value:pointerType}, isPrimary:{value:true} });
    return event;
  };
  card().querySelector('.hs-card').dispatchEvent(pointer('pointerdown', 88, 'touch'));
  expect(Aim.aim?.pointerId).toBe(88);
  for (const [id, type] of [[1,'mouse'],[42,'pen']]) {
    window.dispatchEvent(pointer('pointerdown', id, type));
    expect(Aim.aim?.pointerId).toBe(88);
    window.dispatchEvent(pointer('pointerup', id, type));
    expect(Aim.aim?.leftDown).toBe(true);
  }
  window.dispatchEvent(pointer('pointercancel', 88, 'touch'));
  expect(Aim.aim).toBeNull();
  expect(infusionResources()).toEqual(before);
});

it('allows a new primary pointer to continue a pickup only after its owner releases', () => {
  start();
  const before=infusionResources();
  const pointer=(type,id)=>{
    const event=new MouseEvent(type,{bubbles:true,button:0,clientX:900,clientY:950});
    Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:true}});return event;
  };
  card().querySelector('.hs-card').dispatchEvent(pointer('pointerdown',88));
  window.dispatchEvent(pointer('pointerup',88));
  expect(Aim.aim?.leftDown).toBe(false);
  window.dispatchEvent(pointer('pointerdown',1));
  expect(Aim.aim?.pointerId).toBe(1);
  expect(Aim.aim?.leftDown).toBe(true);
  window.dispatchEvent(pointer('pointercancel',1));
  expect(Aim.aim).toBeNull();expect(infusionResources()).toEqual(before);
});

it('lets real window aim cancellation consume the down before the retained hand can pick up another card', () => {
  const mana = Cards.all().find(c => c.id === 'cc-mana-surge');
  start(1, mana, [{ uid:'other-hand-card', card:Cards.SHA }]);
  const before = infusionResources();
  const pointer = (type, y=950) => {
    const event = new MouseEvent(type,{bubbles:true,button:0,clientX:900,clientY:y});
    Object.defineProperties(event,{pointerId:{value:88},pointerType:{value:'mouse'},isPrimary:{value:true}});
    return event;
  };
  const source = UI.el.ovBody.querySelector('.bt-card[data-uid="inspect-card"]');
  source.querySelector('.hs-card').dispatchEvent(pointer('pointerdown'));
  window.dispatchEvent(pointer('pointerup'));
  expect(Aim.aim?.leftDown).toBe(false);
  window.dispatchEvent(pointer('pointermove', Aim.aim.playY - 50)); flush();
  expect(Aim.aim?.mode).toBe('multi');expect(Aim.aim.targetMode).toBe('click');
  const next = UI.el.ovBody.querySelector('.bt-card[data-uid="other-hand-card"]');
  next.querySelector('.hs-card').dispatchEvent(pointer('pointerdown'));
  expect(Aim.aim).toBeNull();expect(infusionResources()).toEqual(before);
});


it('扰敌同种三敌DOM点击0→2：重绘只排首实例，拒重复，单次扣费且不打中间敌', async () => {
  start(Array.from({ length:3 }, () => ({ id:'grass_el', name:'滋生异变体', hp:12, atk:5 })), Cards.all().find(c => c.id === 'tt7-provoke'));
  const foe = index => stage().querySelector(`.bt-foe[data-eidx="${index}"]`);
  Aim.selectCardByClick('inspect-card', false);
  foe(0).click(); flush(); render(); flush();
  expect(BattleSession.getSnapshot().pendingTarget.excludedTargetIndex).toBe(0);
  expect([0, 1, 2].map(index => foe(index).classList.contains('can-target'))).toEqual([false, true, true]);
  // A direct DOM click must be rejected even though it bypasses visual highlighting.
  foe(0).click(); flush();
  expect(BattleSession.getSnapshot().energy).toBe(9);
  expect(BattleSession.getSnapshot().foes.map(f => f.hp)).toEqual([12, 12, 12]);
  foe(2).click(); await settle();
  const snapshot = BattleSession.getSnapshot();
  expect(snapshot.foes.map(f => f.hp)).toEqual([7, 12, 7]);
  expect(snapshot.energy).toBe(8);
  expect(snapshot.hand).not.toContain('inspect-card');
  expect(snapshot.pendingTarget).toBeNull();
});

it('扰敌同种双敌取消后可反向重选，无遗留实例排除', async () => {
  start(Array.from({ length:2 }, () => ({ id:'grass_el', name:'滋生异变体', hp:12, atk:5 })), Cards.all().find(c => c.id === 'tt7-provoke'));
  Aim.selectCardByClick('inspect-card', false);
  Aim.clickSelectedTarget('enemy', 0); flush();
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); flush();
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  expect(BattleSession.getSnapshot().energy).toBe(9);
  expect(BattleSession.getSnapshot().hand).toContain('inspect-card');
  Aim.selectCardByClick('inspect-card', false);
  expect(Aim.clickSelectedTarget('enemy', 1)).toBe(true); flush(); render();
  expect(BattleSession.getSnapshot().pendingTarget.excludedTargetIndex).toBe(1);
  expect(stage().querySelector('.bt-foe[data-eidx="0"]').classList.contains('can-target')).toBe(true);
  expect(Aim.clickSelectedTarget('enemy', 0)).toBe(true); await settle();
  expect(BattleSession.getSnapshot().foes.map(f => f.hp)).toEqual([7, 7]);
  expect(BattleSession.getSnapshot().energy).toBe(8);
});


it('普通战流光斩可选择目标，确认前不消耗牌或能量', () => {
  start(2, Cards.all().find(entry => entry.id === 'tt3-flux-slash'));
  const desc = card().querySelector('.hsc-desc');
  expect(desc.querySelector('.bt-rulehint')).toBeNull();
  expect(card().dataset.handState).not.toBe('blocked');
  const before = infusionResources();
  Aim.selectCardByClick(card().dataset.uid); flush();
  expect(Aim.clickSelectedUid).toBe('inspect-card');
  expect(stage().querySelectorAll('.bt-foe.can-target')).toHaveLength(2);
  expect(infusionResources()).toEqual(before);
});

it('禁用理由占用单个提示槽，能量变化更新数值，恢复后还原补充规则', () => {
  start(1, { ...Cards.all().find(entry => entry.id === 'tt7-armup'), cost: 3 });
  const hint = () => card().querySelector('.hsc-desc .bt-rulehint');
  expect(hint().textContent).toBe('从本场牌库抽取符合类型的牌。');
  set$energy(0); render();
  expect(hint().textContent).toContain('能量不足');
  expect(hint().textContent).toContain('当前 0');
  expect(card().querySelectorAll('.bt-rulehint')).toHaveLength(1);
  set$energy(1); render();
  expect(hint().textContent).toBe('无法打出：能量不足：需要 3，当前 1');
  set$energy(9); render();
  expect(hint().textContent).toBe('从本场牌库抽取符合类型的牌。');
  expect(card().querySelector('.hsc-desc').textContent).not.toContain('能量不足');
});

it('卡文已包含禁用原因时不追加相同阅读提示', () => {
  const reason = '先打出一张武术牌，使本牌变形';
  start(1, { ...Cards.all().find(entry => entry.id === 'tt7-imitate'), desc: reason });
  const desc = card().querySelector('.hsc-desc');
  expect(card().dataset.handState).toBe('blocked');
  expect(desc.textContent).toContain(reason);
  expect(desc.querySelector('.bt-rulehint')).toBeNull();
});

it.each(['enemy', 'self'])('键盘选牌 Esc 取消后恢复 %s 原卡面焦点且不消费', side => {
  start(2, side === 'self' ? Cards.all().find(item => item.id === 'tt3-longsword') : Cards.SHA);
  const face = card().querySelector('.hs-card');
  const before = infusionResources();
  face.focus();
  face.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  expect(document.activeElement).toBe(stage().querySelector(side === 'self' ? '#btSelf' : '.bt-foe'));
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
  flush();
  expect(Aim.clickSelectedUid).toBeNull();
  expect(stage().querySelector('.can-target')).toBeNull();
  expect(infusionResources()).toEqual(before);
  expect(document.activeElement).toBe(face);
});

it('鼠标来源选牌即便目标获得焦点，Esc 也不抢回手牌', () => {
  start(2);
  Aim.selectCardByClick('inspect-card', false, { autoSingleTarget:false });
  const target = stage().querySelector('.bt-foe.can-target');
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
  expect(Aim.clickSelectedUid).toBeNull();
  expect(document.activeElement).toBe(target);
});

it.each(['removed-card', 'changed-token', 'detached-stage', 'hidden-overlay', 'inert-stage', 'busy'])('键盘取消不恢复已失效来源：%s', async invalidation => {
  start(2);
  const face = card().querySelector('.hs-card');
  face.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  const focus = vi.spyOn(face, 'focus');
  if (invalidation === 'removed-card') {
    const { set$hand } = await import('../game/src/battle/runtime/battle.runtime.piles.js');
    set$hand([]);
  } else if (invalidation === 'changed-token') stage()._battleToken = 'another-battle';
  else if (invalidation === 'detached-stage') stage().remove();
  else if (invalidation === 'hidden-overlay') UI.el.overlay.hidden = true;
  else if (invalidation === 'inert-stage') stage().setAttribute('inert', '');
  else {
    const { set$busy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
    set$busy(true);
  }
  Aim.cancelClickSelection({ restoreFocus:true });
  expect(focus).not.toHaveBeenCalled();
  if (invalidation === 'busy') {
    const { set$busy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
    set$busy(false);
  }
});

it('键盘选牌后主动转焦其他控件，Esc 不抢走新焦点', () => {
  start(2);
  card().querySelector('.hs-card').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  const other = stage().querySelector('[data-act=btSlam]');
  other.focus();
  other.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
  expect(Aim.clickSelectedUid).toBeNull();
  expect(document.activeElement).toBe(other);
});

it('键盘正常确认出牌不恢复原卡焦点', async () => {
  start(2);
  const face = card().querySelector('.hs-card');
  face.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  const focus = vi.spyOn(face, 'focus');
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  await settle();
  expect(BattleSession.getSnapshot().hand).not.toContain('inspect-card');
  expect(focus).not.toHaveBeenCalled();
});

it('扰敌首个目标后提供可点击取消，清提示和高亮且不消费', () => {
  start(2, Cards.all().find(entry => entry.id === 'tt7-provoke'));
  const before = infusionResources();
  Aim.selectCardByClick('inspect-card', false);
  stage().querySelector('.bt-foe[data-eidx="0"]').click(); flush();
  expect(BattleSession.getSnapshot().pendingTarget).not.toBeNull();
  expect(stage().querySelector('[data-selection-prompt]')?.textContent).toContain('已选 敌人0');
  expect(stage().querySelector('.bt-thought-bubble[data-target-prompt]')).toBeNull();
  const cancel = stage().querySelector('[data-act="btPickCancel"]');
  expect(cancel).not.toBeNull();
  cancel.click(); flush();
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  expect(stage().querySelector('.bt-thought-bubble[data-target-prompt]')).toBeNull();
  expect(stage().querySelector('.can-target')).toBeNull();
  expect(stage().querySelector('[data-act="btPickCancel"]')).toBeNull();
  expect(infusionResources()).toEqual(before);
});

it('扰敌触屏取消条转义牌名，正常第二次选靶完成后移除', async () => {
  const name = '<img src=x onerror=alert(1)>扰敌';
  start(2, { ...Cards.all().find(entry => entry.id === 'tt7-provoke'), name });
  Aim.selectCardByClick('inspect-card', false);
  stage().querySelector('.bt-foe[data-eidx="0"]').click(); flush();
  const bar = stage().querySelector('.bt-pick');
  expect(bar.textContent).toContain(name);
  expect(bar.querySelector('.bt-infuse-title img')).toBeNull();
  expect(bar.querySelectorAll('[data-act="btPickCancel"]')).toHaveLength(1);
  stage().querySelector('.bt-foe[data-eidx="1"]').click(); await settle();
  expect(BattleSession.getSnapshot().pendingTarget).toBeNull();
  expect(BattleSession.getSnapshot().hand).not.toContain('inspect-card');
  expect(BattleSession.getSnapshot().energy).toBe(8);
  expect(BattleSession.getSnapshot().foes.map(foe => foe.hp)).toEqual([39, 39]);
  expect(stage().querySelector('.bt-pick')).toBeNull();
  expect(stage().querySelector('.bt-thought-bubble[data-target-prompt]')).toBeNull();
});

it('点击选牌、职业技能和卡牌目标共用唯一可见取消条', () => {
  start(2);
  const before=infusionResources();
  Aim.selectCardByClick('inspect-card',false);
  expect(stage().querySelectorAll('[data-selection-prompt]')).toHaveLength(1);
  stage().querySelector('[data-act="btPickCancel"]').click();flush();
  expect(Aim.clickSelectedUid).toBeNull();expect(stage().querySelector('.can-target')).toBeNull();expect(infusionResources()).toEqual(before);
  stage().querySelector('[data-act="btSlam"]').click();flush();
  expect(BattleSession.getSnapshot().slamPending).toBe(true);
  expect(stage().querySelectorAll('[data-selection-prompt]')).toHaveLength(1);
  stage().querySelector('[data-act="btPickCancel"]').click();flush();
  expect(BattleSession.getSnapshot().slamPending).toBe(false);expect(stage().querySelector('.can-target')).toBeNull();expect(infusionResources()).toEqual(before);
});

it('旧取消按钮不能撤销同场新选择，当前按钮仍可正常取消', () => {
  start(2,Cards.SHA,[{uid:'next-card',card:Cards.all().find(entry=>entry.id==='tt3-fireball')}]);
  Aim.selectCardByClick('inspect-card',false);const old=stage().querySelector('[data-act="btPickCancel"]');
  Aim.selectCardByClick('next-card',false);
  old.click();expect(Aim.clickSelectedUid).toBe('next-card');
  stage().querySelector('[data-act="btPickCancel"]').click();expect(Aim.clickSelectedUid).toBeNull();
});

it.each(['Escape','Enter','pointer'])('键盘选牌后焦点转到取消控件，%s 按来源恢复焦点', input => {
  start(2);const face=card().querySelector('.hs-card');
  face.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  const cancel=stage().querySelector('[data-act="btPickCancel"]');cancel.focus();
  const focus=vi.spyOn(face,'focus');
  if(input==='Escape')cancel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  else cancel.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:input==='pointer'?1:0}));
  flush();expect(Aim.clickSelectedUid).toBeNull();
  if(input==='pointer')expect(focus).not.toHaveBeenCalled();else expect(document.activeElement).toBe(face);
});

it('普通战从空本场消耗牌堆到实际注能材料均可查看，返回保持战斗', async () => {
  start(2,{id:'pile-infusion',name:'注能护盾',type:'法术',cost:1,infuse:1,desc:'注能(1)：获得6点护盾。'},[{uid:'pile-fuel',card:Cards.SHA}]);
  const badge=()=>stage().querySelector('[data-act="btGrave"]');
  expect(badge().textContent).toContain('0');badge().click();flush();
  expect(UI.el.ovBody.textContent).toContain('消耗牌堆为空');
  UI.el.ovBody.querySelector('[data-act="btGraveBack"]').click();flush();
  BattleSession.commands.beginInfusion('inspect-card');flush();
  BattleSession.commands.selectInfusion('pile-fuel');flush();
  BattleSession.commands.confirmInfusion();await settle();
  const snap=BattleSession.getSnapshot();
  expect(snap.consumed).toContain('pile-fuel');expect(snap.grave).not.toContain('pile-fuel');
  expect(badge().textContent).toContain('2');badge().click();flush();
  expect(UI.el.ovBody.querySelector('.battle-pile-summary').textContent).toContain('2');
  expect([...UI.el.ovBody.querySelectorAll('.battle-pile-card')].map(node => node.textContent).join(' ')).toContain('初始攻击');
  expect(snap.consumedPile).toEqual(['inspect-card', 'pile-fuel']);
  UI.el.ovBody.querySelector('[data-act="btGraveBack"]').click();flush();
  expect(BattleSession.getSnapshot().consumed).toEqual(snap.consumed);
});

it('shows only active player rules via readonly snapshot and clears retained chips immediately', async () => {
  const effects = await import('../game/src/battle/runtime/battle.runtime.effects.js');
  const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
  start();
  const before = BattleSession.getSnapshot();
  expect(document.querySelector('[data-player-effect]')).toBeNull();
  effects.set$playerCurseImmune(true); effects.set$spellCost1(true); effects.set$meleeCost1(true);
  effects.set$nextSpellTwice(1); effects.set$allSpellsInfused(true);
  runtime.pstat.status.discoverPlus = 2; runtime.pstat.status.bleedAmp = 1;
  effects.set$deathSave(2); effects.set$extraTurn(true);
  runtime.delayed.push({ special: 'curseImmuneOff', restore: false });
  const snapshot = BattleSession.getSnapshot();
  expect(snapshot).not.toBe(before);
  expect(snapshot.playerEffects).toHaveLength(8);
  expect(Object.isFrozen(snapshot.playerEffects[0])).toBe(true);
  render(); flush();
  const chips = [...document.querySelectorAll('#btSelf [data-player-effect]')];
  expect(chips).toHaveLength(8);
  expect(chips.every(chip => chip.hasAttribute('data-ui-tip') && chip.hasAttribute('data-term') && chip.tabIndex === 0)).toBe(true);
  expect(chips.find(chip => chip.dataset.playerEffect === 'curseImmunity').textContent).toContain('本回合');
  expect(chips.find(chip => chip.dataset.playerEffect === 'moveCost').textContent).toContain('招式1费');
  expect(runtime.delayed).toHaveLength(1);
  delete runtime.delayed[0].restore; // old jobs restore false through the same boolean coercion
  expect(BattleSession.getSnapshot().playerEffects.find(effect => effect.key === 'curseImmunity').duration).toBe('本回合');
  runtime.delayed[0].restore = true;
  expect(BattleSession.getSnapshot().playerEffects.find(effect => effect.key === 'curseImmunity').duration).toBe('本场');
  effects.set$playerCurseImmune(false); effects.set$spellCost1(false); effects.set$meleeCost1(false);
  effects.set$nextSpellTwice(0); effects.set$allSpellsInfused(false);
  runtime.pstat.status.discoverPlus = 0; runtime.pstat.status.bleedAmp = 0;
  effects.set$deathSave(0); effects.set$extraTurn(false);
  render(); flush();
  expect(document.querySelector('[data-player-effect]')).toBeNull();
  expect(runtime.delayed).toHaveLength(1);
  expect(snapshot.playerEffects).toHaveLength(8);
});
