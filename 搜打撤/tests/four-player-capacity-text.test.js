import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';

let session, game, showBackpack, UI;
const spell = { id: 'capacity-spell', name: '容量法术', type: '法术', rarity: '稀有' };
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '武术', rarity: '稀有' };

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.SDT = { Icons: { img: () => '', rich: String, TYPE_ART: {} },
    Sound: { music() {}, sfx: vi.fn(), setDucked() {} }, FX: { feedback() {} } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
  game = session.game;
  UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = c => `<span>${c.name}</span>`;
  window.SDT.Cards.cardBackHTML = () => '';
  vi.spyOn(window.SDT.Base, 'bagCap').mockReturnValue(16);
  window.SDT.Chests = { isOpen: () => false };
  session._set_active_slot(null);
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(game, { runActive: true, state: 'idle', myClass: '法师', inventory: [],
    usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null,
    terminalPending: null, battleActive: false, nestActive: false, hp: 20, maxHp: 30,
    elapsed: 0, elapsedSynced: 0 });
});
afterEach(() => UI.hideOverlay({ immediate: true }));

it('G07 普通容量16和珍珠盒资源9分别显示，收卡叠放规则保持', () => {
  game.ownedCards=[{uid:'pearl',card:pearl},{uid:'spell',card:spell}];
  game.inventory=Array.from({length:14},(_,i)=>({name:'物资'+i,count:1}));
  expect(game.bagCapacityText()).toBe('通用格 16/16 · 资源专用格 0/9');
  expect(game.canReceiveCard({...spell,name:'新普通牌'})).toBe(false);
  expect(game.canReceiveCard(spell)).toBe(true);
  expect(game.canReceiveCard({id:'res',name:'新资源',type:'资源'})).toBe(true);
  showBackpack(true);expect(UI.el.ovBody.textContent).toContain('通用格 16/16 · 资源专用格 0/9');
  game.inventory.push({name:'资源格占用',count:1});
  expect(game.bagCapacityText()).toBe('通用格 16/16 · 资源专用格 1/9');
});

