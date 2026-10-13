import { beforeEach, afterEach, expect, it } from 'vitest';

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, act: (name, fn) => actions.set(name, fn), refresh() {}, log() {},
  showOverlay(title, html) { this.el.ovBody.innerHTML = rich(html); },
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { selectCardByClick, cancelClickSelection } = await import('../game/src/battle/view/battle.aim.js');
const { renderDeckPileView, renderBattleBag } = await import('../game/src/battle/view/battle.overlays.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
let game;

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  game = {
    ownedCards: [Cards.SHA, Cards.all().find(card => card.id === 'tt12-backupcell')].map((card, index) => ({ uid: `view-${index}`, card })),
    inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log() {}, heal() {}, onBattleEnd() {},
    safeCap: () => 3, safeUsed: () => 0,
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'left', name: '左敌人', hp: 40, atk: 1 }, { id: 'right', name: '右敌人', hp: 40, atk: 1 }], { isBoss: false });
});
afterEach(() => {
  cancelClickSelection();
  if (game.battleActive) BattleSession.commands.flee();
  actions.clear();
});

it('shows one short target instruction and clears auxiliary keyboard help on cancel', () => {
  UI.el.ovBody.innerHTML = '<div class="sts-arena-caption"><span data-battle-detail="选择手牌，或结束回合">选择手牌，或结束回合</span></div><div class="sts-hand"><button class="bt-card" data-uid="view-0"></button></div><div class="bt-foe" data-eidx="0"></div><div class="bt-foe" data-eidx="1"></div>';
  selectCardByClick('view-0');
  const caption = UI.el.ovBody.querySelector('.sts-arena-caption span');
  expect(caption.textContent).toBe('【初始攻击】· 选择 高亮敌人 · Esc 取消');
  expect(caption.getAttribute('aria-label')).toContain('方向键切换目标');
  expect(UI.el.ovBody.querySelectorAll('.can-target')).toHaveLength(2);
  cancelClickSelection();
  expect(caption.textContent).toBe('选择手牌，或结束回合');
  expect(caption.hasAttribute('aria-label')).toBe(false);
  expect(caption.hasAttribute('title')).toBe(false);
  expect(UI.el.ovBody.querySelectorAll('.can-target')).toHaveLength(0);
});

it.each(['deck', 'bag'])('keeps the canonical full rule when inspecting the %s surface', kind => {
  const snapshot = { ...BattleSession.getSnapshot(), drawPile: ['view-1'] };
  if (kind === 'deck') renderDeckPileView(snapshot);
  else renderBattleBag(snapshot);
  const rules = UI.el.ovBody.querySelector('.battle-decision-inspect-rules').textContent;
  expect(rules).toContain('本场战斗消耗牌');
  expect(rules).toContain('不计之前战斗');
  expect(rules).toContain('仅进入墓地的牌不计');
});
