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

it('highlights targets without reviving the retired secondary caption and clears access on cancel', () => {
  UI.el.ovBody.innerHTML = '<div class="sts-arena-caption"><span data-battle-detail="选择手牌，或结束回合">选择手牌，或结束回合</span></div><div class="sts-hand"><button class="bt-card" data-uid="view-0"></button></div><div class="bt-foe" data-eidx="0"></div><div class="bt-foe" data-eidx="1"></div>';
  selectCardByClick('view-0');
  const caption = UI.el.ovBody.querySelector('.sts-arena-caption span');
  expect(caption.textContent).toBe('选择手牌，或结束回合');
  expect(caption.hasAttribute('aria-label')).toBe(false);
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
  expect(rules).toBe('抽 2 张牌，并回复你的全部能量；消耗牌堆中每有 1 张法术牌，本牌费用减少 1 点。');
  expect(rules).toContain('消耗牌堆中每有 1 张法术牌');
  expect(rules).toContain('抽 2 张牌，并回复你的全部能量');
});

it('stores only the visible carried group when stored cards share the same id', () => {
  const original = game.ownedCards[1].card;
  const carried = [{ uid: 'carried-one', card: original }, { uid: 'carried-two', card: original }];
  const stored = { uid: 'stored-hidden', card: original, stored: true, safe: false };
  game.ownedCards = [...carried, stored]; game.safeCap = () => 2;
  renderBattleBag(BattleSession.getSnapshot());
  const button = UI.el.ovBody.querySelector('[data-act="btSafeMove"]');
  expect(button.textContent).toContain('×2'); expect(button.classList.contains('off')).toBe(false);
  actions.get('btSafeMove')(button.dataset);
  expect(carried.every(entry => entry.safe)).toBe(true); expect(stored.safe).toBe(false);
});

it('keeps all cards unchanged when the carried group does not fit in the safe capacity', () => {
  const original = game.ownedCards[1].card;
  const carried = [{ uid: 'large-one', card: original }, { uid: 'large-two', card: original }];
  const stored = { uid: 'stored-hidden', card: original, stored: true, safe: false };
  game.ownedCards = [...carried, stored]; game.safeCap = () => 1;
  renderBattleBag(BattleSession.getSnapshot());
  const button = UI.el.ovBody.querySelector('[data-act="btSafeMove"]');
  expect(button.classList.contains('off')).toBe(true); actions.get('btSafeMove')(button.dataset);
  expect(carried.some(entry => entry.safe)).toBe(false); expect(stored.safe).toBe(false);
});

it('does not expose a purely stored group or mutate it through a stale safe-move action', () => {
  const original = game.ownedCards[1].card;
  const stored = { uid: 'stored-only', card: original, stored: true, safe: false };
  game.ownedCards = [stored]; renderBattleBag(BattleSession.getSnapshot());
  expect(UI.el.ovBody.querySelector('[data-act="btSafeMove"]')).toBeNull();
  actions.get('btSafeMove')({ cardKey: `id:${original.id}` });
  expect(stored.safe).toBe(false);
});

it('transfers the complete carried group while preserving existing safe and stored entries', () => {
  const original = game.ownedCards[1].card;
  const carried = [{ uid: 'legal-one', card: original }, { uid: 'legal-two', card: original }];
  const safe = { uid: 'already-safe', card: original, safe: true };
  const stored = { uid: 'stored-hidden', card: original, stored: true, safe: false };
  game.ownedCards = [...carried, safe, stored]; game.safeCap = () => 3;
  game.safeUsed = () => game.ownedCards.filter(entry => entry.safe).length;
  renderBattleBag(BattleSession.getSnapshot());
  actions.get('btSafeMove')(UI.el.ovBody.querySelector('[data-act="btSafeMove"]').dataset);
  expect(carried.every(entry => entry.safe)).toBe(true); expect(safe.safe).toBe(true); expect(stored.safe).toBe(false);
  expect(game.safeUsed()).toBe(3); expect(UI.el.ovBody.querySelector('[data-act="btSafeMove"]')).toBeNull();
});

it.each(['reopen','hidden','inert','closing','other-page'])('does not move or save cards through an obsolete bag action: %s', state => {
  let saves=0; game.saveGame=()=>{saves++;};
  renderBattleBag(BattleSession.getSnapshot());
  const button=UI.el.ovBody.querySelector('[data-act="btSafeMove"]'), data={...button.dataset};
  const oldMove=actions.get('btSafeMove');
  if(state==='reopen')renderBattleBag(BattleSession.getSnapshot());
  if(state==='other-page')UI.showOverlay('宝箱','<button>领取</button>');
  if(state==='hidden')UI.el.overlay.hidden=true;
  if(state==='inert')UI.el.overlay.setAttribute('inert','');
  if(state==='closing')UI.el.overlay.classList.add('closing');
  oldMove(data);
  expect(game.ownedCards.some(entry=>entry.safe)).toBe(false);expect(saves).toBe(0);
});
