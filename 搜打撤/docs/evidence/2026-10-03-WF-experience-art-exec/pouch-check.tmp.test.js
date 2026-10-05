// 中间内存实验，不进 Git；真实 UI.act 路径，禁写档位。
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
document.body.innerHTML = readFileSync('game/index.html', 'utf8');
window.SDT = { Icons: { img: () => '', rich: String, TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../../../game/src/cards/cards.js');
await import('../../../game/src/ui/ui.js');
await import('../../../game/src/hub/base.js');
const session = await import('../../../game/src/run/game.session.js');
const { showBackpack } = await import('../../../game/src/hub/game.bag.js');
const { game } = session;
const { UI, Cards, Base } = window.SDT;
UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
Cards.cardHTML = c => `<span>${c.name}</span>`; Cards.cardBackHTML = () => '';
Base.bagCap = () => 16;
session._set_active_slot(null);
const reports = [];
it('真实锦囊整叠取出：满包、差1格、正好够，无存档写入', () => {
  const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
  const spell = { id: 'probe-spell', name: '定向法术', type: '法术', rarity: '稀有' };
  for (const [label, occupied, bagSpellCount] of [['full',16,0],['short-one-slot',16,3],['exact',15,0]]) {
    Object.assign(game, { runActive: true, state: 'idle', myClass: '法师', inventory: [], usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null, terminalPending: null, battleActive: false, nestActive: false, hp: 20, maxHp: 30, elapsed: 0, elapsedSynced: 0 });
    game.inventory = Array.from({ length: occupied - 1 - (bagSpellCount ? 1 : 0) }, (_, i) => ({ name: `物资${i}`, value: 1, count: 1 }));
    game.ownedCards = [{ uid:'pouch', card:pouch }, ...Array.from({ length:bagSpellCount },(_,i)=>({ uid:`bag${i}`, card:spell })), ...Array.from({ length:3 },(_,i)=>({ uid:`stored${i}`, card:spell, stored:1, pouchOf:pouch.id }))];
    const before = { used:session.usedSlots(), cap:session.bagCap(), cardCount:game.ownedCards.length, supplies:JSON.stringify(game.inventory) };
    window.SDT.Chests = { isOpen:()=>false };
    showBackpack(true); UI._acts.inspectStack({name:pouch.name,safe:'0'}); UI._acts.pouchStoreZoom();
    UI._acts.pouchTake({name:spell.name});
    const after = { used:session.usedSlots(), cap:session.bagCap(), cardCount:game.ownedCards.length, stored:game.ownedCards.filter(o=>o.pouchOf===pouch.id).length, supplies:JSON.stringify(game.inventory) };
    reports.push({label,before,after});
    expect(after.cardCount).toBe(before.cardCount); expect(after.supplies).toBe(before.supplies);
    expect(after.used).toBe(occupied+1); expect(after.stored).toBe(0);
    UI.hideOverlay({immediate:true});
  }
  writeFileSync('docs/evidence/2026-10-03-WF-experience-art-exec/pouch-check.json', JSON.stringify({ owner:'A3 read-only experiment', status:'confirmed-over-capacity-no-loss-in-memory', experiment:'现有真实showBackpack→UI.act inspectStack→pouchStoreZoom→pouchTake；jsdom内存，activeSlot=null禁写对局存档，Base.bagCap只在隔离进程设16', reports },null,2));
});
