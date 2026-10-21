import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// 本文件验输入，资源就绪由 battle-entry-readiness 专门控制未兑现的加载 Promise 验证。
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode, options = {}) { this._overlayRevision = (this._overlayRevision || 0) + 1;
    if (options.battleBody) { if (!options.battleBody(rich(html))) return; }
    else this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
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
const { BattleSession, configureBattleRenderer, findEffectiveCard, infusionFuelReason, findCard, pileTip } = await import('../game/src/battle/core/battle.core.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { openHandInspector, closeHandInspector } = await import('../game/src/battle/view/battle.hand-inspector.js');
const { UI: zoomUI } = await import('../game/src/ui/ui.js');
UI.showCardZoom = zoomUI.showCardZoom;
window.SDT.UI = UI;
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const mockedIcons = window.SDT.Icons;
await import('../game/src/core/icons-bitmap.js');
window.SDT.Icons = mockedIcons;
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
const panel = () => document.querySelector('.bt-hand-detail');
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) { flush(); return; }
  }
  throw new Error('战斗动作没有收口');
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
  document.getElementById('cardZoom')?._closeCardZoom?.(true);
  closeHandInspector({ restoreFocus: false }); Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) { BattleSession.commands.cancelInfusion(); BattleSession.commands.flee(); }
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});


const canonical = id => structuredClone(Cards.all().find(card => card.id === id));
async function swordBattle(boss = true, sword = true, extraIds = []) {
  const cards = [...(sword ? ['tt3-immortal-blade'] : []), 'tt3sp-silverthorn',
    'starter-attack', 'starter-attack', 'starter-attack', 'starter-attack', ...extraIds];
  game = { ownedCards: cards.map((id, i) => ({ uid: `sword-${i}`, baseUid: `base-${i}`, card: canonical(id) })),
    inventory: [], usedPocket: [], hp: 100, maxHp: 100, atk: 4, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  window.SDT.game = game;
  window.SDT.MAP.rules.battleStartDraw = 99;
  runtime.set$lastDeckSel([]);
  BattleSession.start(game, [{ id: 'sword-foe', name: '骷髅剑靶', hp: 1000, atk: 0 }],
    { isBoss: boss, directBossStart: boss });
  await settle();
  return game.ownedCards.filter(entry => entry.card.id === 'starter-attack').map(entry => entry.uid);
}
function effectiveNode() { return [...UI.el.ovBody.querySelectorAll('.sts-hand .bt-card')]
  .find(node => findEffectiveCard(node.dataset.uid)?.card.name === '不朽斩'); }

it('BOSS逐UID变形含临时初始牌，卡面/详情/aria/选敌同源且重复回手不污染原卡', async () => {
  const originals = await swordBattle();
  const ownedBefore = JSON.stringify(game.ownedCards);
  const transformed = BattleSession.getSnapshot().hand.filter(uid => findCard(uid)?.card.id === 'starter-attack');
  expect(transformed).toHaveLength(5);
  expect(transformed.some(uid => uid.startsWith('boss-sha-'))).toBe(true);
  for (const uid of transformed) { expect(findEffectiveCard(uid).uid).toBe(uid); expect(findEffectiveCard(uid).card.name).toBe('不朽斩'); }
  let node = effectiveNode();
  expect(node.querySelector('.hsc-name').textContent).toBe('不朽斩');
  expect(node.querySelector('.hsc-name').textContent).toContain('不朽斩');
  expect(node.getAttribute('aria-label')).toContain('不朽斩');
  expect(node.querySelector('.bt-detail-chip')).toBeNull();
  const representative = node.dataset.uid;
  Aim.startAim({ button: 0, isPrimary: true, pointerId: 71, clientX: 200, clientY: 600 }, node);
  expect(Aim.aim.uid).toBe(representative);
  expect(Aim.aim.card.name).toBe('不朽斩');
  expect(Aim.aim.card.dmg).toBe(1);
  Aim.cancelAim();
  openHandInspector(representative);
  expect(panel().getAttribute('aria-label')).toBe('不朽斩：卡牌详情');
  expect(panel().textContent).toContain('无法用于注能');
  closeHandInspector();
  Aim.selectCardByClick(representative, false, { autoSingleTarget: false });
  expect(node.classList.contains('click-selected')).toBe(true);
  expect(node.getAttribute('aria-label')).toContain('不朽斩');
  Aim.cancelClickSelection();
  const before = BattleSession.getSnapshot();
  BattleSession.commands.playCard(originals[0], 0); await settle();
  BattleSession.commands.playCard(originals[0], 0); await settle();
  const after = BattleSession.getSnapshot();
  expect(after.foes[0].hp).toBe(before.foes[0].hp - 10);
  expect(after.energy).toBe(before.energy - 2);
  expect(after.hand).toContain(originals[0]);
  expect(after.hand.filter(uid => uid === originals[0])).toHaveLength(1);
  expect(after.grave).not.toContain(originals[0]);
  expect(JSON.stringify(game.ownedCards)).toBe(ownedBefore);
  BattleSession.commands.flee(); await settle();
  expect(findEffectiveCard(originals[0]).card.name).toBe('初始攻击');
  expect(JSON.stringify(game.ownedCards)).toBe(ownedBefore);
});

it('不朽斩不能选作注能材料，禁用原因与详情一致，拒绝不扣费不移牌', async () => {
  // 开战剑已消耗；提供独立合法燃料才能打开选材页，不能再依赖剑作燃料。
  const originals = await swordBattle(true, true, ['tt13-guard']);
  expect(runtime.consumed).toContain(game.ownedCards[0].uid);
  expect(runtime.hand).not.toContain(game.ownedCards[0].uid);
  const before = BattleSession.getSnapshot();
  const main = game.ownedCards.find(entry => entry.card.infuse > 0).uid;
  BattleSession.commands.beginInfusion(main); await settle();
  BattleSession.commands.selectInfusion(originals[0]); await settle();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  expect(infusionFuelReason(originals[0])).toContain('无法用于注能');
  const workspace = UI.el.ovBody.querySelector('[data-infusion-workspace]');
  const material = [...workspace.querySelectorAll('.infusion-material')]
    .find(entry => entry.querySelector('.hsc-name')?.textContent === '不朽斩');
  expect(material.classList.contains('is-unavailable')).toBe(true);
  expect(material.querySelector('.infusion-card-face').disabled).toBe(true);
  expect(material.querySelector('[data-act="btInfuseAdd"]').disabled).toBe(true);
  expect(material.querySelector('.infusion-material-note').textContent).toContain('无法用于注能');
  expect(effectiveNode().closest('.battle-stage').hasAttribute('inert')).toBe(true);
  material.querySelector('.infusion-card-face').click();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  material.querySelector('.infusion-detail').click();
  const zoom = document.getElementById('cardZoom');
  expect(zoom.textContent).toContain('不朽斩'); expect(zoom.textContent).toContain('无法用于注能');
  zoom._closeCardZoom(true);
  expect(UI.el.ovBody.querySelector('[data-infusion-workspace]')).toBe(workspace);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
});

it('材料已选后变形：确认前重验并清除非法选择，原卡和能量不动', async () => {
  const originals = await swordBattle();
  runtime.set$shaTransform(null);
  const main = game.ownedCards.find(entry => entry.card.infuse > 0).uid;
  BattleSession.commands.beginInfusion(main);
  BattleSession.commands.selectInfusion(originals[0]);
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([originals[0]]);
  const before = BattleSession.getSnapshot();
  runtime.set$shaTransform('不朽斩');
  BattleSession.commands.confirmInfusion(); await settle();
  const after = BattleSession.getSnapshot();
  expect(after.infusing.picked).toEqual([]);
  expect(after.hand).toEqual(before.hand);
  expect(after.energy).toBe(before.energy);
});

it('缺失变形模板fail-closed，拒绝出牌与材料，保持原UID和背包', async () => {
  const originals = await swordBattle();
  runtime.set$shaTransform('不存在的转换目标');
  const before = BattleSession.getSnapshot();
  expect(engine.unplayableReason(findEffectiveCard(originals[0]).card)).toContain('不存在的转换目标');
  expect(infusionFuelReason(originals[0])).toContain('不存在的转换目标');
  BattleSession.commands.playCard(originals[0], 0); await settle();
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(before.foes[0].hp);
});

it('普通战持有剑仍不触发，下次普通战不继承前场变形', async () => {
  await swordBattle(); BattleSession.commands.flee(); await settle();
  const originals = await swordBattle(false);
  expect(runtime.shaTransform).toBeNull();
  expect(BattleSession.getSnapshot().equipped).toEqual([]);
  expect(BattleSession.getSnapshot().hand).not.toContain('sword-0');
  for (const uid of originals) expect(findEffectiveCard(uid).card.name).toBe('初始攻击');
  const before = BattleSession.getSnapshot();
  BattleSession.commands.playCard(originals[0], 0); await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(before.foes[0].hp - 4);
  expect(BattleSession.getSnapshot().hand).not.toContain(originals[0]);
});

it('注能进入动作队列后才变形：最终支付屏障拒绝，不扣能量、不移牌', async () => {
  const originals = await swordBattle();
  runtime.set$shaTransform(null);
  const main = game.ownedCards.find(entry => entry.card.infuse > 0).uid;
  const before = BattleSession.getSnapshot();
  // The real queue starts synchronously; hold its presentation boundary so the
  // transformation happens after admission and before the payment commit.
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  configureBattleRenderer(() => ready);
  try {
    engine.queueCardExecution(main, findCard(main).card, [originals[0]], runtime.foes[0], false);
    runtime.set$shaTransform('不朽斩');
    release(true);
    await settle();
  } finally { configureBattleRenderer(render); }
  const after = BattleSession.getSnapshot();
  expect(after.hand).toEqual(before.hand);
  expect(after.energy).toBe(before.energy);
  expect(after.foes[0].hp).toBe(before.foes[0].hp);
});

it('原UID免能量与非初始override优先级沿用，后登记青龙形态替换不朽规则', async () => {
  const originals = await swordBattle();
  const uid = originals[0];
  runtime.cardOverrides.set(uid, { ...findCard(uid).card, cost: 0 });
  expect(findEffectiveCard(uid).card.cost).toBe(1);
  runtime.zeroFeeUntil.set(uid, runtime.turn);
  const before = BattleSession.getSnapshot();
  BattleSession.commands.playCard(uid, 0); await settle();
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(before.foes[0].hp - 5);
  const dragon = Cards.all().find(card => card.name === '青龙偃月斩');
  expect(dragon).toBeTruthy();
  runtime.set$shaTransform(dragon.name);
  expect(findEffectiveCard(uid).card.name).toBe(dragon.name);
  expect(infusionFuelReason(uid)).toBe('');
  runtime.cardOverrides.set(uid, { ...dragon, cost: 0 });
  runtime.set$shaTransform('不朽斩');
  expect(findEffectiveCard(uid).card.name).toBe(dragon.name);
  expect(findEffectiveCard(uid).card.cost).toBe(0);
  expect(findEffectiveCard(uid).uid).toBe(uid);
  expect(findEffectiveCard(uid).baseUid).toBe(game.ownedCards.find(entry => entry.uid === uid).baseUid);
  expect(game.ownedCards.find(entry => entry.uid === uid).baseUid).toBeTruthy();
});

it('真实青龙化身在剑后生效、再穿戴剑覆盖青龙：解析与结算沿用最后登记规则', async () => {
  const originals = await swordBattle(true, true, ['tt8-hero-warrior']);
  const hero = game.ownedCards.find(entry => entry.card.id === 'tt8-hero-warrior');
  expect(findEffectiveCard(originals[0]).card.name).toBe('不朽斩');
  BattleSession.commands.playCard(hero.uid, null); await settle();
  expect(runtime.shaTransform).toBe('青龙偃月斩');
  expect(findEffectiveCard(originals[0]).card.name).toBe('青龙偃月斩');
  const sword = game.ownedCards.find(entry => entry.card.id === 'tt3-immortal-blade');
  // 已消耗的开战剑不能再打；新获得的第二把剑可占剩余槽并重新登记变形。
  expect(BattleSession.commands.submitCardPlay(sword.uid, 'self').reason.code).toBe('NOT_IN_HAND');
  expect(runtime.shaTransform).toBe('青龙偃月斩');
  runtime.granted.push({ uid: 'fresh-sword', card: canonical('tt3-immortal-blade') });
  runtime.hand.push('fresh-sword');
  BattleSession.commands.playCard('fresh-sword', 'self'); await settle();
  expect(runtime.equipped.map(entry => entry.uid)).toEqual([sword.uid, 'fresh-sword']);
  expect(runtime.shaTransform).toBe('不朽斩');
  expect(findEffectiveCard(originals[0]).card.name).toBe('不朽斩');
});

it('BOSS仅持有但未编入剑：初始攻击不变形', async () => {
  await swordBattle(false); BattleSession.commands.flee(); await settle();
  window.SDT.MAP.rules.bossDeckSize = 1;
  try {
    runtime.set$lastDeckSel([]);
    BattleSession.start(game, [{ id: 'sword-unselected', name: '未编入验证靶', hp: 1000, atk: 0 }], { isBoss: true });
    const main = game.ownedCards.find(entry => entry.card.infuse > 0).uid;
    BattleSession.commands.selectDeckCard(main);
    BattleSession.commands.confirmDeck(); await settle();
    expect(runtime.shaTransform).toBeNull();
    expect(BattleSession.getSnapshot().equipped).toEqual([]);
    for (const uid of BattleSession.getSnapshot().hand.filter(uid => findCard(uid)?.card.id === 'starter-attack')) {
      expect(findEffectiveCard(uid).card.name).toBe('初始攻击');
    }
  } finally { window.SDT.MAP.rules.bossDeckSize = 15; }
});

it('注能入口只统计可用材料，四张不朽斩不能凑足两张燃料', async () => {
  await swordBattle();
  const main = game.ownedCards.find(entry => entry.card.infuse > 0);
  main.card = { ...main.card, infuse: 2 };
  const before = BattleSession.getSnapshot();
  BattleSession.commands.beginInfusion(main.uid); await settle();
  expect(BattleSession.getSnapshot().infusing).toBeNull();
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
});

it('其他手牌支付保持原有初始攻击资格，同时选牌面显示有效不朽斩', async () => {
  const originals = await swordBattle(true, true, ['tt7-thundergrudge']);
  const source = game.ownedCards.find(entry => entry.card.id === 'tt7-thundergrudge');
  BattleSession.commands.playCard(source.uid, 0); await settle();
  expect(BattleSession.getSnapshot().handSelecting?.act).toBe('payment');
  const choices = [...document.querySelectorAll('[data-act="btPickHand"]')];
  expect(choices).toHaveLength(5);
  for (const choice of choices) {
    expect(choice.textContent).toContain('不朽斩');
    expect(choice.getAttribute('aria-label')).toContain('不朽斩');
  }
  BattleSession.commands.pickHandSelect(originals[0]);
  BattleSession.commands.pickHandSelect(originals[1]); await settle();
  expect(BattleSession.getSnapshot().handSelecting).toBeNull();
  expect(BattleSession.getSnapshot().hand).not.toContain(originals[0]);
  expect(BattleSession.getSnapshot().hand).not.toContain(originals[1]);
});

it('内部免费释放按已显示不朽斩结算并同UID回手', async () => {
  const release = Cards.all().find(card => card.name === '剑荡妖邪');
  expect(release).toBeTruthy();
  const originals = await swordBattle(true, true, [release.id]);
  const source = game.ownedCards.find(entry => entry.card.id === release.id);
  BattleSession.commands.playCard(source.uid, 0); await settle();
  expect(BattleSession.getSnapshot().handSelecting?.act).toBe('play');
  const uid = originals[0];
  const option = document.querySelector(`[data-act="btPickHand"][data-uid="${uid}"]`);
  expect(option.textContent).toContain('不朽斩');
  const before = BattleSession.getSnapshot();
  BattleSession.commands.pickHandSelect(uid); await settle();
  const after = BattleSession.getSnapshot();
  console.log('DIRECT_RELEASE', JSON.stringify({shown: findEffectiveCard(uid).card.name, raw: findCard(uid).card.name, delta: before.foes[0].hp-after.foes[0].hp, retained: after.hand.includes(uid), energyDelta: before.energy-after.energy}));
  expect(before.foes[0].hp-after.foes[0].hp).toBe(5);
  expect(after.hand).toContain(uid);
});

it('内部免费释放缺少转换模板时不能回退初始攻击', async () => {
  const release = Cards.all().find(card => card.name === '剑荡妖邪');
  const originals = await swordBattle(true, true, [release.id]);
  runtime.set$shaTransform('不存在的转换目标');
  const source = game.ownedCards.find(entry => entry.card.id === release.id);
  BattleSession.commands.playCard(source.uid, 0); await settle();
  expect(BattleSession.getSnapshot().handSelecting?.act).toBe('play');
  const uid = originals[0];
  expect(engine.unplayableReason(findEffectiveCard(uid).card)).toContain('不存在的转换目标');
  const before = BattleSession.getSnapshot();
  BattleSession.commands.pickHandSelect(uid); await settle();
  const after = BattleSession.getSnapshot();
  console.log('MISSING_RELEASE', JSON.stringify({delta:before.foes[0].hp-after.foes[0].hp,retained:after.hand.includes(uid),raw:findCard(uid).card.name}));
  expect(after.foes[0].hp).toBe(before.foes[0].hp);
  expect(after.hand).toContain(uid);
});

it('draw释放全部初始攻击使用统一有效卡，免费释放且每UID只保留一份', async () => {
  await swordBattle();
  const uids = BattleSession.getSnapshot().hand.filter(uid => findCard(uid)?.card.name === '初始攻击');
  const before = BattleSession.getSnapshot();
  engine.resolveCard({ id: 'effective-release-all', name: '释放初始攻击探针', type: '法术', cost: 0,
    desc: '直接释放手牌中的所有「初始攻击」。' }, runtime.foes[0]);
  await settle();
  const after = BattleSession.getSnapshot();
  expect(after.foes[0].hp).toBe(before.foes[0].hp - 5 * uids.length);
  expect(after.energy).toBe(before.energy);
  for (const uid of uids) expect(after.hand.filter(value => value === uid)).toHaveLength(1);
  expect(game.ownedCards.filter(entry => entry.card.name === '初始攻击')).toHaveLength(4);
});

it('draw抽牌后自动释放其中武术使用有效不朽斩并免费回手', async () => {
  const [uid] = await swordBattle();
  runtime.set$hand(runtime.hand.filter(value => value !== uid));
  runtime.set$drawPile([uid]); runtime.set$discard([]);
  const before = BattleSession.getSnapshot();
  engine.resolveCard({ id: 'effective-draw-auto', name: '抽牌自动释放探针', type: '法术', cost: 0,
    draw: 1, desc: '抽 1 张牌，直接释放其中武术。' }, runtime.foes[0]);
  await settle();
  const after = BattleSession.getSnapshot();
  expect(after.foes[0].hp).toBe(before.foes[0].hp - 5);
  expect(after.energy).toBe(before.energy);
  expect(after.hand.filter(value => value === uid)).toHaveLength(1);
  expect(after.drawPile).not.toContain(uid);
});

it('draw灰烬满手同步直释也采用有效卡，保留原UID弃牌和手牌上限', async () => {
  const [uid] = await swordBattle();
  runtime.applyRuneFlag('ash');
  runtime.set$hand(runtime.hand.filter(value => value !== uid));
  while (runtime.hand.length < 9) engine.addTempCard({ id: `ash-fill-${runtime.hand.length}`, name: '占位资源', type: '资源', cost: 0, desc: '' });
  runtime.set$drawPile([uid]); runtime.set$discard([]);
  const before = BattleSession.getSnapshot();
  expect(engine.drawCards(1)).toBe(1);
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp - 5);
  expect(runtime.energy).toBe(before.energy);
  expect(runtime.hand).toHaveLength(9);
  expect(runtime.hand).not.toContain(uid);
  expect(runtime.discard.filter(value => value === uid)).toHaveLength(1);
  expect(runtime.drawPile).not.toContain(uid);
});

it.each([false, true])('draw缺目标模板在普通抽牌/灰烬直释均fail-closed（灰烬=%s）', async ash => {
  const [uid] = await swordBattle();
  runtime.set$hand(runtime.hand.filter(value => value !== uid));
  if (ash) {
    runtime.applyRuneFlag('ash');
    while (runtime.hand.length < 9) engine.addTempCard({ id: `missing-fill-${runtime.hand.length}`, name: '占位资源', type: '资源', cost: 0, desc: '' });
  }
  runtime.set$drawPile([uid]); runtime.set$discard([]);
  runtime.set$shaTransform('不存在的转换目标');
  const before = BattleSession.getSnapshot();
  expect(engine.drawCards(1)).toBe(0);
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp);
  expect(runtime.energy).toBe(before.energy);
  expect(runtime.hand).toEqual(before.hand);
  expect(runtime.drawPile).toEqual([uid]);
  expect(runtime.discard).toEqual([]);
});

it('玩家已提交有效副本，支付前新规则缺模板仍拒绝扣费与打出', async () => {
  const originals = await swordBattle();
  const uid = originals[0];
  let release;
  const ready = new Promise(resolve => { release=resolve; });
  const before = BattleSession.getSnapshot();
  configureBattleRenderer(() => ready);
  try {
    BattleSession.commands.playCard(uid,0);
    runtime.set$shaTransform('不存在的转换目标');
    release(true); await settle();
  } finally { configureBattleRenderer(render); }
  const after = BattleSession.getSnapshot();
  console.log('PLAYER_SOURCE_RACE',JSON.stringify({delta:before.foes[0].hp-after.foes[0].hp,energyDelta:before.energy-after.energy,retained:after.hand.includes(uid)}));
  expect(after.foes[0].hp).toBe(before.foes[0].hp);
  expect(after.energy).toBe(before.energy);
  expect(after.hand).toEqual(before.hand);
});


it.each([1, 2])('极速按有效青龙费用预检：当前能量%s，足费才打出', async energy => {
  const [uid] = await swordBattle();
  runtime.set$shaTransform('青龙偃月斩');
  runtime.set$hand([uid]); runtime.set$drawPile([]); runtime.set$discard([]);
  runtime.set$energy(energy); runtime.applyRuneFlag('swift');
  const before = BattleSession.getSnapshot();
  const expectedDamage = energy < 2 ? 0 : 4 + findEffectiveCard(uid).card.dmg;
  BattleSession.commands.endTurn(); await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(before.foes[0].hp - expectedDamage);
  if (energy < 2) expect(BattleSession.getSnapshot().hand).toContain(uid);
});
it('免费内部青龙释放在零能量仍正常，不影响非免费支付不足拒绝', async () => {
  const [uid] = await swordBattle();
  runtime.set$shaTransform('青龙偃月斩'); runtime.set$energy(0);
  const before = BattleSession.getSnapshot();
  engine.queueCardExecution(uid, findCard(uid).card, [], runtime.foes[0], true);
  await settle();
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp - 4 - findEffectiveCard(uid).card.dmg);
  expect(runtime.energy).toBe(0);
});
it('非免费动作入队后能量不足：真正支付前拒绝，UID/手牌/伤害不变', async () => {
  const [uid] = await swordBattle();
  let release; const ready = new Promise(resolve => { release = resolve; });
  const before = BattleSession.getSnapshot(); configureBattleRenderer(() => ready);
  try {
    BattleSession.commands.playCard(uid, 0);
    runtime.set$energy(0); release(true); await settle();
  } finally { configureBattleRenderer(render); }
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp);
  expect(runtime.hand).toEqual(before.hand);
  expect(runtime.energy).toBe(0);
});

it('原raw已入队后新增非初始override：支付前按当前UID有效卡结算', async () => {
  const [uid] = await swordBattle(false, false);
  const dragon = { ...Cards.all().find(card => card.name === '青龙偃月斩'), cost: 0 };
  let release; const ready = new Promise(resolve => { release = resolve; });
  const before = BattleSession.getSnapshot(); configureBattleRenderer(() => ready);
  try {
    BattleSession.commands.playCard(uid, 0);
    runtime.cardOverrides.set(uid, dragon); release(true); await settle();
  } finally { configureBattleRenderer(render); }
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp - 4 - dragon.dmg);
  expect(runtime.energy).toBe(before.energy);
  expect(game.ownedCards.find(entry => entry.uid === uid).card.name).toBe('初始攻击');
});
it('显式自定义raw同名执行候选不会被后来的UID override吞掉cost和rules', async () => {
  const [uid] = await swordBattle(false, false);
  const custom = { id: 'custom-internal-execution', name: '初始攻击', type: '武术', cost: 2,
    dmg: 2, dmgType: 'fixed', desc: '造成 2 点固定伤害。' };
  let release; const ready = new Promise(resolve => { release = resolve; });
  const before = BattleSession.getSnapshot(); configureBattleRenderer(() => ready);
  try {
    engine.queueCardExecution(uid, custom, [], runtime.foes[0], false);
    runtime.cardOverrides.set(uid, { ...Cards.all().find(card => card.name === '青龙偃月斩'), cost: 0 });
    release(true); await settle();
  } finally { configureBattleRenderer(render); }
  expect(runtime.foes[0].hp).toBe(before.foes[0].hp - 2);
  expect(runtime.energy).toBe(before.energy - 2);
});


it('BOSS牌库与统一消耗牌堆摘要按有效卡计数，打开查看不改UID', async () => {
  const originals = await swordBattle();
  const ownedBefore = JSON.stringify(game.ownedCards);
  runtime.set$hand(runtime.hand.filter(uid => !originals.includes(uid)));
  runtime.set$drawPile(originals.slice(0, 2));
  runtime.set$discard([originals[2]]); runtime.set$grave([originals[3]]);
  const before = BattleSession.getSnapshot();
  render(); flush();
  const draw = UI.el.ovBody.querySelector('[data-act="btDeck"]');
  const grave = UI.el.ovBody.querySelector('[data-act="btGrave"]');
  expect([...UI.el.ovBody.querySelectorAll('.bt-pile')].some(node => node.title.startsWith('弃牌堆：'))).toBe(false);
  for (const [node, count] of [[draw, 2], [grave, 3]]) {
    expect(node.title).toContain('不朽斩×2');
    expect(node.title).not.toContain('初始攻击');
    expect(node.querySelector('b').textContent).toBe(String(count));
  }
  expect(draw.getAttribute('aria-label')).toBe(draw.title);
  expect(grave.getAttribute('aria-label')).toBe(grave.title);
  expect(pileTip(before.drawPile)).toBe('不朽斩×2');
  expect(before.consumedPile).toHaveLength(3); // Two attacks plus the already played sword.
  expect(pileTip(before.consumedPile)).toContain('不朽斩×2');
  actions.get('btDeck')(); await settle();
  expect(UI.el.ovBody.querySelector('.battle-pile-card').getAttribute('aria-label')).toContain('不朽斩');
  expect(UI.el.ovBody.querySelector('.battle-decision-inspect h4').textContent).toBe('不朽斩');
  actions.get('btDeckBack')(); await settle();
  actions.get('btGrave')(); await settle();
  const consumedLabels = [...UI.el.ovBody.querySelectorAll('.battle-pile-card')].map(node => node.getAttribute('aria-label'));
  expect(consumedLabels).toEqual(['查看 骷髅王剑 的完整规则，1 张', '查看 不朽斩 的完整规则，2 张']);
  expect(UI.el.ovBody.querySelector('.battle-decision-inspect h4').textContent).toBe('骷髅王剑');
  const after = BattleSession.getSnapshot();
  expect(after.drawPile).toEqual(before.drawPile);
  expect(after.discard).toEqual(before.discard);
  expect(after.grave).toEqual(before.grave);
  expect(after.energy).toBe(before.energy);
  expect(JSON.stringify(game.ownedCards)).toBe(ownedBefore);
});

it('堆摘要实时跟随青龙/取消变形和非初始override，普通战持剑仍报初始攻击', async () => {
  const normal = await swordBattle(false);
  expect(pileTip(normal)).toBe('初始攻击×4');
  BattleSession.commands.flee(); await settle();
  const originals = await swordBattle();
  expect(pileTip(originals)).toBe('不朽斩×4');
  runtime.set$shaTransform('青龙偃月斩');
  expect(pileTip(originals)).toBe('青龙偃月斩×4');
  runtime.set$shaTransform(null);
  expect(pileTip(originals)).toBe('初始攻击×4');
  const dragon = { ...Cards.all().find(card => card.name === '青龙偃月斩'), cost: 0 };
  runtime.cardOverrides.set(originals[0], dragon);
  runtime.set$shaTransform('不朽斩');
  expect(pileTip(originals)).toBe('青龙偃月斩×1，不朽斩×3');
  expect(pileTip([])).toBe('（空）');
  expect(pileTip(['missing-pile-uid'])).toBe('（空）');
  expect(originals.map(uid => game.ownedCards.find(entry => entry.uid === uid).card.name))
    .toEqual(Array(4).fill('初始攻击'));
});
