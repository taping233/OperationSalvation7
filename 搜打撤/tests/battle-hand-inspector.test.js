import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// 本文件验输入，资源就绪由 battle-entry-readiness 专门控制未兑现的加载 Promise 验证。
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
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
  BattleSession.start(game, Array.from({ length: count }, (_, i) => ({ id: `foe-${i}`, name: `敌人${i}`, hp: 40, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(async () => {
  // 拖拽松手后的 300ms click 吞噬是生产交互窗口；各用例不共享该手势。
  if (Date.now() - Aim.aimPlayedAt < 300) await new Promise(resolve => setTimeout(resolve, 310));
  frames = [];
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

it('routes rapid folded-slot infusion picks to distinct UIDs in one shared material stack', () => {
  start(1, { id: 'folded-infuse', name: '折叠注能', type: '法术', cost: 1, infuse: 3, desc: '注能(3)：获得 6 点护盾。' }, [
    { uid: 'folded-fuel-a', card: Cards.SHA }, { uid: 'folded-fuel-b', card: Cards.SHA }, { uid: 'folded-fuel-c', card: Cards.SHA },
  ]);
  inspectCard('inspect-card');
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  const material = UI.el.ovBody.querySelector('.bt-card[data-uid="folded-fuel-a"]');
  const foldedSlot = material.closest('.bt-slot');
  const pick = () => {
    foldedSlot.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    foldedSlot.click();
  };
  pick(); expect(BattleSession.getSnapshot().infusing.picked).toEqual(['folded-fuel-a']);
  pick(); expect(BattleSession.getSnapshot().infusing.picked).toEqual(['folded-fuel-a', 'folded-fuel-b']);
  expect(foldedSlot.dataset.uid).toBe(material.dataset.uid);
  expect(BattleSession.getSnapshot().energy).toBe(9);
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

it('inspects infusion cards and materials before either entering or changing the selection', () => {
  start(1, { id: 'inspect-infuse', name: '注能护体', type: '法术', cost: 1, infuse: 1, desc: '注能(1)：获得 6 点护盾。' }, [{ uid: 'inspect-fuel', card: Cards.SHA }]);
  inspectCard('inspect-card');
  expect(BattleSession.getSnapshot().infusing).toBeNull();
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  inspectCard('inspect-fuel');
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  expect(panel().querySelector('.bt-hand-detail-use').textContent).toBe('选作注能材料');
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['inspect-fuel']);
  expect(BattleSession.getSnapshot().energy).toBe(9);
  expect(BattleSession.getSnapshot().hand).toContain('inspect-fuel');
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
  [{ atk: 4, behavior: 'burn' }, {}, '攻击 4 · 灼烧', '攻击并灼烧', '基础攻击 4'],
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
  const presented = { ...before, foes: [{ ...before.foes[0], name, atk: 7, behavior: 'burn' }] };
  updateUnits(mountUnitLayer(UI.el.ovBody, before.battleToken), presented, {});
  const enemy = stage().querySelector('.sts-foe'), intent = enemy.querySelector('.sts-intent');
  expect(enemy.getAttribute('aria-label')).toContain(name); expect(enemy.querySelector('.sts-headrow>b')).toBeNull();
  expect(enemy.querySelector('.sts-headrow .sts-atkbadge')).toBeNull();
  expect(intent.querySelector('.bt-intent-short').textContent).toBe('攻击 7 · 灼烧');
  intent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(intent.getAttribute('aria-expanded')).toBe('true');
  expect(intent.querySelector('.bt-intent-detail').textContent).toContain('基础攻击 7');
  expect(intent.querySelector('.bt-intent-detail').textContent).toContain('攻击并灼烧');
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
  expect(groups).toEqual(['攻 6（含+2）', '法伤 1（含+1）', '盾 2', '甲 3', '格挡中']);
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
  BattleSession.commands.openGrave(); flush(); expect(stage()).toBeNull();
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
  expect(forecast.title).toBe(expected.note);
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
    expect(stats.querySelector('[data-asset-key="icon-plate"]')).not.toBeNull();
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

it('directly toggles infusion materials without opening the inspector', () => {
  start(1, { id:'fresh-infusion', name:'注能护体', type:'法术', cost:1, infuse:1, desc:'注能(1)：获得 6 点护盾。' }, [{ uid:'fuel', card:Cards.SHA }]);
  UI.el.ovBody.querySelector('[data-act=btInfuseStart]').click(); flush();
  UI.el.ovBody.querySelector('.bt-card[data-uid="fuel"]').click(); flush();
  expect(panel()).toBeNull();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['fuel']);
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'1',bubbles:true,cancelable:true})); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
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
