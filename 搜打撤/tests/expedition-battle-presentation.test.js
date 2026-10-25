import { inventoryFields } from './helpers/environment-fixtures.js';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, showCardZoom: vi.fn(), act: (name, fn) => actions.set(name, fn), refresh() {}, log() {},
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
const { UI: zoomUI } = await import('../game/src/ui/ui.js');
UI.showCardZoom = vi.fn(zoomUI.showCardZoom);
window.SDT.UI = UI;
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
let game;

beforeEach(() => {
  UI.showCardZoom.mockClear();
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  game = {
    ownedCards: [Cards.SHA, Cards.all().find(card => card.id === 'tt12-backupcell')].map((card, index) => ({ uid: `view-${index}`, card })),
    ...inventoryFields(30, 30, 0, null), log() {}, heal() {}, onBattleEnd() {},
    safeCap: () => 3, safeUsed: () => 0,
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'left', name: '左敌人', hp: 40, atk: 1 }, { id: 'right', name: '右敌人', hp: 40, atk: 1 }], { isBoss: false });
});
afterEach(() => {
  document.getElementById('cardZoom')?._closeCardZoom(true);
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
  const before = BattleSession.getSnapshot(), ownedUids = game.ownedCards.map(entry => entry.uid);
  const snapshot = { ...before, drawPile: ['view-1'] };
  if (kind === 'deck') renderDeckPileView(snapshot);
  else renderBattleBag(snapshot);
  const root = UI.el.ovBody.querySelector('.battle-decision');
  let rules;
  if (kind === 'deck') {
    const trigger = root.querySelector('[data-act="btDecisionInspect"]');
    actions.get('btDecisionInspect')(trigger.dataset);
    expect(UI.showCardZoom).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'tt12-backupcell' }), expect.objectContaining({ returnFocus: trigger, items:expect.any(Array), index:0 }));
    const zoom = document.getElementById('cardZoom');
    expect(zoom.getAttribute('role')).toBe('dialog');
    rules = zoom.querySelector('.hsc-desc').textContent;
    zoom._closeCardZoom(true);
    expect(document.activeElement).toBe(trigger);
  } else {
    expect(UI.showCardZoom).not.toHaveBeenCalled();
    rules = root.querySelector('.battle-decision-inspect-rules').textContent;
  }
  expect(UI.el.ovBody.querySelector('.battle-decision')).toBe(root);
  expect(BattleSession.getSnapshot()).toEqual(before);
  expect(game.ownedCards.map(entry => entry.uid)).toEqual(ownedUids);
  expect(rules).toBe('抽 2 张牌，并回复你的全部能量；消耗牌堆中每有 1 张法术牌，本牌费用减少 1 点。');
  expect(rules).toContain('消耗牌堆中每有 1 张法术牌');
  expect(rules).toContain('抽 2 张牌，并回复你的全部能量');
});

it.each(['reopen', 'hidden', 'inert', 'closing', 'other-page'])('rejects obsolete deck inspection without spending or opening zoom: %s', state => {
  const before = BattleSession.getSnapshot(), snapshot = { ...before, drawPile: ['view-1'] };
  renderDeckPileView(snapshot);
  const trigger = UI.el.ovBody.querySelector('[data-act="btDecisionInspect"]');
  const oldInspect = actions.get('btDecisionInspect'), data = { ...trigger.dataset };
  if (state === 'reopen') renderDeckPileView(snapshot);
  if (state === 'other-page') UI.showOverlay('其他页面', '<button>返回</button>');
  if (state === 'hidden') UI.el.overlay.hidden = true;
  if (state === 'inert') UI.el.overlay.setAttribute('inert', '');
  if (state === 'closing') UI.el.overlay.classList.add('closing');
  oldInspect(data);
  expect(UI.showCardZoom).not.toHaveBeenCalled();
  expect(BattleSession.getSnapshot()).toEqual(before);
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
